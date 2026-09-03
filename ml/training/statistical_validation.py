"""
Statistical Validation Module.
Performs 5x2cv Paired t-Test to compare models under strict fold isolation,
and executes 1,000-trial Bootstrap Validation to calculate standard errors and confidence intervals.
"""

import os
import sys
import json
import pickle
import logging

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, roc_auc_score

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from configs.dataset_config import config_loader
from ml.training.ensemble import CalibratedGBDTEnsemble
from ml.preprocessing.imbalance import resample_training_data
from ml.training.natural_features import (
    load_natural_train_matrix,
    load_test_matrix,
    pruned_feature_columns,
)

logger = logging.getLogger("ml.training.statistical_validation")


def run_statistical_validation(test_path: str, model_path: str, output_dir: str) -> dict:
    """Run 5x2cv paired t-tests and bootstrap validation on the holdout set."""
    logger.info("Initializing statistical validation...")

    if not os.path.exists(test_path):
        raise FileNotFoundError(f"Test features path not found: {test_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Ensemble model path not found: {model_path}")

    X_train_transformed, y_train_clean = load_natural_train_matrix()
    X_test_raw, y_test = load_test_matrix(test_path)

    seed = config_loader.model.get("random_seed", 42)
    threshold = config_loader.model.get("decision_threshold")
    if threshold is None:
        raise ValueError("Configuration Error: 'decision_threshold' is missing from the model configuration.")
    linear_exclusions = config_loader.model.get("linear_model_exclusions", ["binary__is_early_stage", "AvgMonthlyCharge"])
    k_neighbors = config_loader.model.get("smote", {}).get("k_neighbors", 5)

    features_all = pruned_feature_columns(X_train_transformed.columns)
    features_linear = [col for col in features_all if col not in linear_exclusions]

    X_train_all = X_train_transformed[features_all]
    X_test_all = X_test_raw[features_all]

    logger.info("Starting 5x2cv Paired t-Test...")

    diffs_f1 = []
    diffs_auc = []
    vars_f1 = []
    vars_auc = []
    first_diff_f1 = None
    first_diff_auc = None

    lr_params = {"C": 1.0, "solver": "liblinear", "random_state": seed}

    for r in range(5):
        logger.info(f"Processing 5x2cv Replication {r+1}/5...")
        X_a, X_b, y_a, y_b = train_test_split(
            X_train_all,
            y_train_clean,
            test_size=0.5,
            random_state=seed + r,
            stratify=y_train_clean,
        )

        X_a_resampled, y_a_resampled = resample_training_data(
            X_a, y_a, random_seed=seed, default_k_neighbors=k_neighbors
        )
        X_b_resampled, y_b_resampled = resample_training_data(
            X_b, y_b, random_seed=seed, default_k_neighbors=k_neighbors
        )
        X_a_resampled_lr = X_a_resampled[features_linear]
        X_b_resampled_lr = X_b_resampled[features_linear]
        X_a_lr = X_a[features_linear]
        X_b_lr = X_b[features_linear]

        ens1 = CalibratedGBDTEnsemble(
            seed=seed, decision_threshold=threshold, calibration_method="isotonic", reconstruct_clean=False
        )
        ens1.fit(X_a, y_a)

        lr1 = LogisticRegression(**lr_params)
        lr1.fit(X_a_resampled_lr, y_a_resampled)

        p_ens1 = ens1.predict_proba(X_b)[:, 1]
        preds_ens1 = (p_ens1 >= threshold).astype(int)
        f1_ens1 = f1_score(y_b, preds_ens1, zero_division=0)
        auc_ens1 = roc_auc_score(y_b, p_ens1)

        p_lr1 = lr1.predict_proba(X_b_lr)[:, 1]
        preds_lr1 = (p_lr1 >= threshold).astype(int)
        f1_lr1 = f1_score(y_b, preds_lr1, zero_division=0)
        auc_lr1 = roc_auc_score(y_b, p_lr1)

        diff_f1_1 = f1_ens1 - f1_lr1
        diff_auc_1 = auc_ens1 - auc_lr1

        if r == 0:
            first_diff_f1 = diff_f1_1
            first_diff_auc = diff_auc_1

        ens2 = CalibratedGBDTEnsemble(
            seed=seed, decision_threshold=threshold, calibration_method="isotonic", reconstruct_clean=False
        )
        ens2.fit(X_b, y_b)

        lr2 = LogisticRegression(**lr_params)
        lr2.fit(X_b_resampled_lr, y_b_resampled)

        p_ens2 = ens2.predict_proba(X_a)[:, 1]
        preds_ens2 = (p_ens2 >= threshold).astype(int)
        f1_ens2 = f1_score(y_a, preds_ens2, zero_division=0)
        auc_ens2 = roc_auc_score(y_a, p_ens2)

        p_lr2 = lr2.predict_proba(X_a_lr)[:, 1]
        preds_lr2 = (p_lr2 >= threshold).astype(int)
        f1_lr2 = f1_score(y_a, preds_lr2, zero_division=0)
        auc_lr2 = roc_auc_score(y_a, p_lr2)

        diff_f1_2 = f1_ens2 - f1_lr2
        diff_auc_2 = auc_ens2 - auc_lr2

        mean_diff_f1 = (diff_f1_1 + diff_f1_2) / 2.0
        mean_diff_auc = (diff_auc_1 + diff_auc_2) / 2.0

        vars_f1.append((diff_f1_1 - mean_diff_f1) ** 2 + (diff_f1_2 - mean_diff_f1) ** 2)
        vars_auc.append((diff_auc_1 - mean_diff_auc) ** 2 + (diff_auc_2 - mean_diff_auc) ** 2)

        diffs_f1.append(diff_f1_1)
        diffs_auc.append(diff_auc_1)

    sum_vars_f1 = sum(vars_f1)
    sum_vars_auc = sum(vars_auc)

    t_stat_f1 = first_diff_f1 / (np.sqrt(0.2 * sum_vars_f1)) if sum_vars_f1 > 0 else 0.0
    t_stat_auc = first_diff_auc / (np.sqrt(0.2 * sum_vars_auc)) if sum_vars_auc > 0 else 0.0

    p_val_f1 = stats.t.sf(np.abs(t_stat_f1), 5) * 2.0
    p_val_auc = stats.t.sf(np.abs(t_stat_auc), 5) * 2.0

    logger.info(f"5x2cv F1 Paired t-test -> t-statistic: {t_stat_f1:.4f}, p-value: {p_val_f1:.4f}")
    logger.info(f"5x2cv AUC Paired t-test -> t-statistic: {t_stat_auc:.4f}, p-value: {p_val_auc:.4f}")

    logger.info("Running Bootstrap Validation (1,000 trials) on holdout test set...")
    with open(model_path, "rb") as f:
        ensemble_model = pickle.load(f)

    rng = np.random.default_rng(seed)
    test_probs = ensemble_model.predict_proba(X_test_all)[:, 1]

    boot_f1s = []
    boot_aucs = []
    n_samples = len(y_test)
    y_test_arr = y_test.to_numpy()

    for _ in range(1000):
        indices = rng.choice(n_samples, size=n_samples, replace=True)
        y_boot = y_test_arr[indices]
        probs_boot = test_probs[indices]
        preds_boot = (probs_boot >= threshold).astype(int)
        boot_f1s.append(f1_score(y_boot, preds_boot, zero_division=0))
        if len(np.unique(y_boot)) > 1:
            boot_aucs.append(roc_auc_score(y_boot, probs_boot))

    boot_f1s = np.array(boot_f1s)
    boot_aucs = np.array(boot_aucs)

    bootstrap_stats = {
        "F1": {
            "Mean": float(np.mean(boot_f1s)),
            "Std": float(np.std(boot_f1s)),
            "CI_Lower": float(np.percentile(boot_f1s, 2.5)),
            "CI_Upper": float(np.percentile(boot_f1s, 97.5)),
        },
        "ROC_AUC": {
            "Mean": float(np.mean(boot_aucs)),
            "Std": float(np.std(boot_aucs)),
            "CI_Lower": float(np.percentile(boot_aucs, 2.5)),
            "CI_Upper": float(np.percentile(boot_aucs, 97.5)),
        },
    }

    logger.info(
        f"Bootstrap F1 -> Mean: {bootstrap_stats['F1']['Mean']:.4f}, "
        f"95% CI: [{bootstrap_stats['F1']['CI_Lower']:.4f}, {bootstrap_stats['F1']['CI_Upper']:.4f}]"
    )
    logger.info(
        f"Bootstrap AUC -> Mean: {bootstrap_stats['ROC_AUC']['Mean']:.4f}, "
        f"95% CI: [{bootstrap_stats['ROC_AUC']['CI_Lower']:.4f}, {bootstrap_stats['ROC_AUC']['CI_Upper']:.4f}]"
    )

    results = {
        "Threshold": threshold,
        "Methodology": "5x2cv Paired t-Test (Dietterich, 1998)",
        "Paired_T_Test": {
            "F1": {
                "T_Statistic": float(t_stat_f1) if not np.isnan(t_stat_f1) else None,
                "P_Value": float(p_val_f1) if not np.isnan(p_val_f1) else None,
            },
            "ROC_AUC": {
                "T_Statistic": float(t_stat_auc) if not np.isnan(t_stat_auc) else None,
                "P_Value": float(p_val_auc) if not np.isnan(p_val_auc) else None,
            },
        },
        "Bootstrap_1000_Trials": bootstrap_stats,
    }

    os.makedirs(output_dir, exist_ok=True)
    out_json = os.path.join(output_dir, "statistical_results.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=4)
    logger.info(f"Successfully saved statistical validation results to: {out_json}")

    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

    config_test_path = config_loader.training["data_paths"]["test_features"]
    config_artifacts_dir = config_loader.training["data_paths"]["artifacts_dir"]

    test_csv = config_test_path if os.path.isabs(config_test_path) else os.path.join(base_dir, config_test_path)
    artifacts_dir = config_artifacts_dir if os.path.isabs(config_artifacts_dir) else os.path.join(base_dir, config_artifacts_dir)

    model_path = os.path.join(artifacts_dir, "models", "ensemble_model.pkl")
    output_dir = os.path.join(artifacts_dir, "metrics")

    try:
        run_statistical_validation(test_csv, model_path, output_dir)
        print("Statistical validation succeeded.")
    except Exception as e:
        logger.exception(f"Statistical validation failed: {e}")
        sys.exit(1)
