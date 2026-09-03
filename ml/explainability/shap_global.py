"""
Global SHAP Explanations.
Computes global importance from the ensemble XGB component on the natural training baseline.
"""

import os
import sys
import json
import pickle
import logging

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import shap
from sklearn.model_selection import train_test_split

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from configs.dataset_config import config_loader
from ml.training.natural_features import baseline_train_csv_path

logger = logging.getLogger("ml.explainability.shap_global")

DEFAULT_MAX_SHAP_SAMPLES = 500


def _subsample_training_frame(train_df: pd.DataFrame, max_samples: int, seed: int) -> pd.DataFrame:
    """Cap SHAP compute cost while preserving class balance when Churn is present."""
    if len(train_df) <= max_samples:
        return train_df

    target_col = config_loader.feature.get("target_column", "Churn")
    if target_col in train_df.columns and train_df[target_col].nunique() > 1:
        _, sample = train_test_split(
            train_df,
            train_size=max_samples,
            random_state=seed,
            stratify=train_df[target_col],
        )
        return sample

    return train_df.sample(n=max_samples, random_state=seed)


def compute_global_shap(
    train_path: str,
    model_path: str,
    output_dir: str,
    max_samples: int = DEFAULT_MAX_SHAP_SAMPLES,
) -> dict:
    """Compute global SHAP on natural training data and save plots + JSON artifact."""
    logger.info("Computing global SHAP values...")

    if not os.path.exists(train_path):
        raise FileNotFoundError(f"Training features CSV not found: {train_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Ensemble model path not found: {model_path}")

    os.makedirs(output_dir, exist_ok=True)

    train_df = pd.read_csv(train_path)
    seed = config_loader.model.get("random_seed", 42)
    train_df = _subsample_training_frame(train_df, max_samples=max_samples, seed=seed)

    target_col = config_loader.feature.get("target_column", "Churn")
    if target_col in train_df.columns:
        X_train = train_df.drop(columns=[target_col])
    else:
        X_train = train_df

    with open(model_path, "rb") as f:
        ensemble = pickle.load(f)

    xgb_features = ensemble.xgb_.feature_names_in_
    X_train_aligned = X_train[xgb_features]
    champion_model = ensemble.xgb_

    explainer = shap.Explainer(champion_model)
    shap_values = explainer(X_train_aligned)

    mean_abs_shap = np.abs(shap_values.values).mean(axis=0)
    global_importance = dict(zip(xgb_features, [float(v) for v in mean_abs_shap]))
    ranked = sorted(global_importance.items(), key=lambda item: item[1], reverse=True)

    plots_dir = os.path.join(output_dir, "plots")
    os.makedirs(plots_dir, exist_ok=True)

    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, X_train_aligned, plot_type="bar", show=False)
    plt.title("Global Feature Importance (Mean |SHAP Value|)")
    plt.tight_layout()
    summary_path = os.path.join(plots_dir, "shap_summary.png")
    plt.savefig(summary_path, dpi=150)
    plt.close()
    logger.info(f"Saved global SHAP summary plot to: {summary_path}")

    plt.figure(figsize=(10, 6))
    shap.plots.beeswarm(shap_values, max_display=15, show=False)
    plt.title("Feature Impact on Churn Prediction (Beeswarm Plot)")
    plt.tight_layout()
    beeswarm_path = os.path.join(plots_dir, "shap_beeswarm.png")
    plt.savefig(beeswarm_path, dpi=150)
    plt.close()
    logger.info(f"Saved global SHAP beeswarm plot to: {beeswarm_path}")

    metrics_dir = os.path.join(output_dir, "metrics")
    os.makedirs(metrics_dir, exist_ok=True)
    importance_path = os.path.join(metrics_dir, "shap_global_importance.json")
    payload = {
        "baseline_source": os.path.basename(train_path),
        "sample_size": int(len(X_train_aligned)),
        "max_samples": max_samples,
        "top_features": [{"feature": name, "mean_abs_shap": score} for name, score in ranked[:20]],
        "global_importance": global_importance,
    }
    with open(importance_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    logger.info(f"Saved global SHAP importance JSON to: {importance_path}")

    return {
        "global_importance": global_importance,
        "importance_json_path": importance_path,
        "summary_plot_path": summary_path,
        "beeswarm_plot_path": beeswarm_path,
        "baseline_source": os.path.basename(train_path),
        "sample_size": int(len(X_train_aligned)),
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

    config_artifacts_dir = config_loader.training["data_paths"]["artifacts_dir"]
    train_csv = baseline_train_csv_path()
    artifacts_dir = config_artifacts_dir if os.path.isabs(config_artifacts_dir) else os.path.join(base_dir, config_artifacts_dir)
    model_file = os.path.join(artifacts_dir, "models", "ensemble_model.pkl")

    try:
        compute_global_shap(train_csv, model_file, artifacts_dir)
        print("Global SHAP computation succeeded.")
    except Exception as e:
        logger.exception(f"Global SHAP execution failed: {e}")
        sys.exit(1)
