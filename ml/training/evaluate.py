"""
Holdout evaluation plots for the production CalibratedGBDTEnsemble.

Loads ensemble_model.pkl, scores the holdout set at the operational decision threshold,
and writes ROC, precision-recall, and confusion-matrix plots. SHAP plots are produced
by ml/explainability/shap_global.py (not overwritten here).
"""

import os
import sys
import pickle
import logging
import pandas as pd

# Add project root to path to load configs
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)
from configs.dataset_config import config_loader
from ml.training.ensemble import CalibratedGBDTEnsemble  # noqa: F401 — required for pickle

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.metrics import (
    classification_report,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    roc_curve,
    precision_recall_curve,
    ConfusionMatrixDisplay,
)

logger = logging.getLogger("ml.training.evaluate")


def evaluate_model(test_features_path: str, artifacts_dir: str) -> None:
    """Evaluate the production ensemble on holdout data and save classification plots."""
    logger.info("Starting ensemble evaluation on holdout set")

    model_path = os.path.join(artifacts_dir, "models", "ensemble_model.pkl")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Ensemble model not found: {model_path}")

    with open(model_path, "rb") as f:
        ensemble = pickle.load(f)

    if not os.path.exists(test_features_path):
        raise FileNotFoundError(f"Test features CSV not found: {test_features_path}")

    target_col = config_loader.feature.get("target_column", "Churn")
    test_df = pd.read_csv(test_features_path)
    y_test = test_df[target_col]
    X_test = test_df.drop(columns=[target_col])

    feature_names = ensemble.xgb_.feature_names_in_
    missing_cols = [col for col in feature_names if col not in X_test.columns]
    if missing_cols:
        raise ValueError(f"Feature schema mismatch. Missing columns: {missing_cols}")
    X_test_aligned = X_test[feature_names]

    threshold = config_loader.model.get("decision_threshold")
    if threshold is None:
        raise ValueError("decision_threshold is missing from configuration")

    logger.info(f"Using operational threshold: {threshold:.3f}")

    y_prob = ensemble.predict_proba(X_test_aligned)[:, 1]
    y_pred = (y_prob >= threshold).astype(int)

    auc_roc = roc_auc_score(y_test, y_prob)
    auc_pr = average_precision_score(y_test, y_prob)

    logger.info("Holdout metrics:")
    logger.info(f"  ROC-AUC: {auc_roc:.4f}")
    logger.info(f"  PR-AUC : {auc_pr:.4f}")

    report = classification_report(y_test, y_pred)
    print("\n=== Ensemble Classification Report (holdout) ===")
    print(report)

    plots_dir = os.path.join(artifacts_dir, "plots")
    os.makedirs(plots_dir, exist_ok=True)
    threshold_label = f"{threshold:.2f}"

    plt.figure(figsize=(6, 5))
    cm = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["Non-Churn", "Churn"])
    disp.plot(cmap="Blues", values_format="d")
    plt.title(f"Confusion Matrix (threshold={threshold_label})")
    plt.tight_layout()
    cm_plot_path = os.path.join(plots_dir, "confusion_matrix.png")
    plt.savefig(cm_plot_path)
    plt.close()
    logger.info(f"Saved confusion matrix plot to: {cm_plot_path}")

    plt.figure(figsize=(6, 5))
    fpr, tpr, _ = roc_curve(y_test, y_prob)
    plt.plot(fpr, tpr, color="darkorange", lw=2, label=f"ROC curve (AUC = {auc_roc:.4f})")
    plt.plot([0, 1], [0, 1], color="navy", lw=2, linestyle="--")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("Receiver Operating Characteristic (ROC) Curve — Ensemble")
    plt.legend(loc="lower right")
    plt.tight_layout()
    roc_plot_path = os.path.join(plots_dir, "roc_curve.png")
    plt.savefig(roc_plot_path)
    plt.close()
    logger.info(f"Saved ROC curve plot to: {roc_plot_path}")

    plt.figure(figsize=(6, 5))
    precision, recall, _ = precision_recall_curve(y_test, y_prob)
    plt.plot(recall, precision, color="blue", lw=2, label=f"PR curve (AUC = {auc_pr:.4f})")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("Precision-Recall Curve — Ensemble")
    plt.legend(loc="lower left")
    plt.tight_layout()
    pr_plot_path = os.path.join(plots_dir, "precision_recall_curve.png")
    plt.savefig(pr_plot_path)
    plt.close()
    logger.info(f"Saved Precision-Recall curve plot to: {pr_plot_path}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s | %(levelname)s | %(message)s")

    config_test_path = config_loader.training["data_paths"]["test_features"]
    config_artifacts_dir = config_loader.training["data_paths"]["artifacts_dir"]
    test_csv = config_test_path if os.path.isabs(config_test_path) else os.path.join(base_dir, config_test_path)
    artifacts = config_artifacts_dir if os.path.isabs(config_artifacts_dir) else os.path.join(base_dir, config_artifacts_dir)

    try:
        evaluate_model(test_csv, artifacts)
        print("Evaluation succeeded.")
    except Exception as e:
        logger.exception(f"Evaluation failed: {e}")
        raise
