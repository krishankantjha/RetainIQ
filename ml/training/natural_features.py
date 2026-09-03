"""Rebuild pre-SMOTE training matrices from clean data and the fitted pipeline."""

import os
import pickle
from typing import Tuple

import pandas as pd
from sklearn.model_selection import train_test_split

from configs.dataset_config import config_loader
from ml.preprocessing.engineer import engineer_features

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _resolve(path: str) -> str:
    return path if os.path.isabs(path) else os.path.join(PROJECT_ROOT, path)


def pruned_feature_columns(columns) -> list:
    pruned = config_loader.model.get("pruned_columns", ["binary__has_support"])
    return [col for col in columns if col not in pruned]


def natural_scale_pos_weight(y: pd.Series) -> float:
    positives = int((y == 1).sum())
    if positives == 0:
        return 1.0
    return float((y == 0).sum() / positives)


def load_natural_train_matrix() -> Tuple[pd.DataFrame, pd.Series]:
    """Return transformed training features before SMOTE."""
    target_col = config_loader.feature.get("target_column", "Churn")
    seed = config_loader.model.get("random_seed", 42)

    clean_csv = _resolve(config_loader.training["data_paths"]["clean_data"])
    artifacts_dir = _resolve(config_loader.training["data_paths"]["artifacts_dir"])
    pipeline_path = os.path.join(artifacts_dir, "pipeline.pkl")

    if not os.path.exists(clean_csv):
        raise FileNotFoundError(f"Clean data CSV not found: {clean_csv}")
    if not os.path.exists(pipeline_path):
        raise FileNotFoundError(f"Fitted pipeline not found: {pipeline_path}")

    clean_df = pd.read_csv(clean_csv)
    X_clean = clean_df.drop(columns=[target_col])
    y_clean = clean_df[target_col]

    X_train_raw, _, y_train, _ = train_test_split(
        X_clean,
        y_clean,
        test_size=0.20,
        random_state=seed,
        stratify=y_clean,
    )

    with open(pipeline_path, "rb") as f:
        preprocessor = pickle.load(f)

    median = float(X_train_raw["MonthlyCharges"].median())
    engineered = engineer_features(
        X_train_raw.assign(**{target_col: y_train.values}),
        median,
    )
    y_train = engineered.pop(target_col)
    feature_names = preprocessor.get_feature_names_out()
    X_transformed = pd.DataFrame(
        preprocessor.transform(engineered),
        columns=feature_names,
    )
    return X_transformed, y_train


def load_test_matrix(test_path: str = None) -> Tuple[pd.DataFrame, pd.Series]:
    """Load holdout features from processed test CSV."""
    target_col = config_loader.feature.get("target_column", "Churn")
    if test_path is None:
        test_path = _resolve(config_loader.training["data_paths"]["test_features"])
    if not os.path.exists(test_path):
        raise FileNotFoundError(f"Test features not found: {test_path}")

    test_df = pd.read_csv(test_path)
    y_test = test_df[target_col]
    X_test = test_df.drop(columns=[target_col])
    return X_test, y_test


def baseline_train_csv_path() -> str:
    """Pre-SMOTE training CSV used as drift and SHAP baseline."""
    paths = config_loader.training["data_paths"]
    rel = paths.get("train_features_natural") or paths["train_features"]
    return _resolve(rel)


def load_baseline_train_frame(include_target: bool = False) -> pd.DataFrame:
    """Load the monitoring baseline training frame (natural distribution)."""
    path = baseline_train_csv_path()
    if not os.path.exists(path):
        raise FileNotFoundError(f"Baseline training features not found: {path}")

    df = pd.read_csv(path)
    if not include_target:
        target_col = config_loader.feature.get("target_column", "Churn")
        if target_col in df.columns:
            df = df.drop(columns=[target_col])
    return df
