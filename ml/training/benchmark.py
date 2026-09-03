"""
Model Benchmarking Module.
Trains 8 model configurations on natural training data (SMOTE applied once before fit)
and evaluates on the holdout set at the operational decision threshold.
"""

import os
import sys
import logging

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, AdaBoostClassifier, GradientBoostingClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from configs.dataset_config import config_loader
from ml.preprocessing.imbalance import resample_training_data
from ml.training.natural_features import (
    load_natural_train_matrix,
    load_test_matrix,
    natural_scale_pos_weight,
    pruned_feature_columns,
)

logger = logging.getLogger("ml.training.benchmark")


def run_bootstrap_validation(model, X_test: pd.DataFrame, y_test: pd.Series, threshold: float, n_bootstraps: int = 200, seed: int = 42) -> dict:
    """Bootstrap F1 and ROC-AUC statistics on the holdout test set."""
    rng = np.random.default_rng(seed)
    f1_scores = []
    auc_scores = []

    try:
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X_test)[:, 1]
        else:
            probs = model.predict(X_test).astype(float)
    except Exception as e:
        logger.warning(f"Failed to generate predictions for bootstrap: {e}")
        return {}

    n_samples = len(y_test)
    y_test_arr = y_test.to_numpy()

    for _ in range(n_bootstraps):
        indices = rng.choice(n_samples, size=n_samples, replace=True)
        y_boot = y_test_arr[indices]
        probs_boot = probs[indices]
        preds_boot = (probs_boot >= threshold).astype(int)

        f1_scores.append(f1_score(y_boot, preds_boot, zero_division=0))
        if len(np.unique(y_boot)) > 1:
            auc_scores.append(roc_auc_score(y_boot, probs_boot))
        else:
            auc_scores.append(np.nan)

    f1_arr = np.array(f1_scores)
    auc_arr = np.array(auc_scores)
    auc_arr_clean = auc_arr[~np.isnan(auc_arr)]

    return {
        "F1_Mean": np.mean(f1_arr),
        "F1_Std": np.std(f1_arr),
        "F1_CI_Lower": np.percentile(f1_arr, 2.5),
        "F1_CI_Upper": np.percentile(f1_arr, 97.5),
        "AUC_Mean": np.mean(auc_arr_clean) if len(auc_arr_clean) > 0 else np.nan,
        "AUC_Std": np.std(auc_arr_clean) if len(auc_arr_clean) > 0 else np.nan,
        "AUC_CI_Lower": np.percentile(auc_arr_clean, 2.5) if len(auc_arr_clean) > 0 else np.nan,
        "AUC_CI_Upper": np.percentile(auc_arr_clean, 97.5) if len(auc_arr_clean) > 0 else np.nan,
    }


def run_benchmarks(metrics_dir: str, test_path: str = None) -> pd.DataFrame:
    """Train benchmark models on natural data and evaluate at decision_threshold."""
    logger.info("Starting production benchmarking loop...")

    X_train, y_train = load_natural_train_matrix()
    X_test, y_test = load_test_matrix(test_path)

    pruned_cols = config_loader.model.get("pruned_columns", ["binary__has_support"])
    linear_exclusions = config_loader.model.get("linear_model_exclusions", ["binary__is_early_stage", "AvgMonthlyCharge"])

    features = pruned_feature_columns(X_train.columns)
    X_train_aligned = X_train[features]
    X_test_aligned = X_test[features]

    seed = config_loader.model.get("random_seed", 42)
    k_neighbors = config_loader.model.get("smote", {}).get("k_neighbors", 5)
    threshold = config_loader.model.get("decision_threshold")
    if threshold is None:
        raise ValueError("Configuration Error: 'decision_threshold' is missing from the model configuration.")

    X_train_smote, y_train_smote = resample_training_data(
        X_train_aligned,
        y_train,
        random_seed=seed,
        default_k_neighbors=k_neighbors,
    )

    models = {
        "DummyBaseline": DummyClassifier(strategy="most_frequent"),
        "LogisticRegression": LogisticRegression(max_iter=1000, random_state=seed),
        "RandomForest": RandomForestClassifier(n_estimators=100, random_state=seed, n_jobs=-1),
        "AdaBoost": AdaBoostClassifier(n_estimators=100, random_state=seed),
        "GradientBoosting": GradientBoostingClassifier(n_estimators=100, random_state=seed),
        "XGBoost": XGBClassifier(
            n_estimators=100,
            random_state=seed,
            eval_metric="logloss",
            scale_pos_weight=natural_scale_pos_weight(y_train),
            n_jobs=-1,
        ),
        "LightGBM": LGBMClassifier(n_estimators=100, random_state=seed, verbosity=-1, n_jobs=-1),
        "MLP": MLPClassifier(max_iter=1000, random_state=seed),
    }

    results = []

    for name, model in models.items():
        logger.info(f"Training and evaluating {name}...")
        try:
            if name == "LogisticRegression":
                lr_features = [col for col in features if col not in linear_exclusions]
                X_tr = X_train_smote[lr_features]
                X_te = X_test_aligned[lr_features]
                y_tr = y_train_smote
            elif name == "DummyBaseline":
                X_tr = X_train_aligned
                X_te = X_test_aligned
                y_tr = y_train
            else:
                X_tr = X_train_smote
                X_te = X_test_aligned
                y_tr = y_train_smote

            model.fit(X_tr, y_tr)

            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(X_te)[:, 1]
            else:
                probs = model.predict(X_te).astype(float)

            preds = (probs >= threshold).astype(int)
            acc = accuracy_score(y_test, preds)
            prec = precision_score(y_test, preds, zero_division=0)
            rec = recall_score(y_test, preds, zero_division=0)
            f1 = f1_score(y_test, preds, zero_division=0)
            auc = roc_auc_score(y_test, probs) if len(np.unique(y_test)) > 1 else float("nan")

            boot = run_bootstrap_validation(model, X_te, y_test, threshold, seed=seed)

            results.append({
                "Model": name,
                "Threshold": threshold,
                "Accuracy (Holdout)": acc,
                "Precision (Holdout)": prec,
                "Recall (Holdout)": rec,
                "F1-Score (Holdout)": f1,
                "ROC-AUC (Holdout)": auc,
                "F1-Score (Bootstrap Mean)": boot.get("F1_Mean"),
                "F1-Score (Bootstrap Std)": boot.get("F1_Std"),
                "F1-Score (Bootstrap 95% CI Lower)": boot.get("F1_CI_Lower"),
                "F1-Score (Bootstrap 95% CI Upper)": boot.get("F1_CI_Upper"),
                "ROC-AUC (Bootstrap Mean)": boot.get("AUC_Mean"),
                "ROC-AUC (Bootstrap Std)": boot.get("AUC_Std"),
                "ROC-AUC (Bootstrap 95% CI Lower)": boot.get("AUC_CI_Lower"),
                "ROC-AUC (Bootstrap 95% CI Upper)": boot.get("AUC_CI_Upper"),
            })

            logger.info(f"{name} (threshold={threshold:.2f}) -> Holdout F1: {f1:.4f}, Holdout ROC-AUC: {auc:.4f}")
        except Exception as e:
            logger.error(f"Failed to run model {name}: {e}")

    results_df = pd.DataFrame(results)
    os.makedirs(metrics_dir, exist_ok=True)
    results_csv_path = os.path.join(metrics_dir, "benchmark_results.csv")
    results_df.to_csv(results_csv_path, index=False)
    logger.info(f"Saved production benchmark results to: {results_csv_path}")

    return results_df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

    config_test_path = config_loader.training["data_paths"]["test_features"]
    config_artifacts_dir = config_loader.training["data_paths"]["artifacts_dir"]

    test_csv = config_test_path if os.path.isabs(config_test_path) else os.path.join(base_dir, config_test_path)
    artifacts_dir = config_artifacts_dir if os.path.isabs(config_artifacts_dir) else os.path.join(base_dir, config_artifacts_dir)
    metrics_dir = os.path.join(artifacts_dir, "metrics")

    run_benchmarks(metrics_dir, test_path=test_csv)
