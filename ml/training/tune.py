"""
Hyperparameter tuning on natural training data.

SMOTE is applied inside each CV fold via imblearn Pipeline (no leakage).
"""

import os
import sys
import logging

import pandas as pd
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV
from xgboost import XGBClassifier

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from configs.dataset_config import config_loader
from ml.training.natural_features import (
    load_natural_train_matrix,
    natural_scale_pos_weight,
    pruned_feature_columns,
)

logger = logging.getLogger("ml.training.tune")


def _smote_pipeline(estimator, seed: int, k_neighbors: int) -> ImbPipeline:
    return ImbPipeline([
        ("smote", SMOTE(random_state=seed, k_neighbors=k_neighbors)),
        ("clf", estimator),
    ])


def tune_logistic_regression(X_train: pd.DataFrame, y_train: pd.Series, seed: int, k_neighbors: int) -> dict:
    logger.info("Tuning Logistic Regression...")
    lr_features = [c for c in X_train.columns if c != "binary__is_early_stage"]
    param_grid = config_loader.model.get("tuning", {}).get("logistic_regression", {
        "clf__C": [0.01, 0.1, 1.0, 10.0],
        "clf__penalty": ["l1", "l2"],
        "clf__solver": ["liblinear"],
    })

    model = _smote_pipeline(
        LogisticRegression(max_iter=1000, random_state=seed),
        seed,
        k_neighbors,
    )
    search = GridSearchCV(model, param_grid, scoring="roc_auc", cv=5, n_jobs=-1)
    search.fit(X_train[lr_features], y_train)

    best = {k.replace("clf__", ""): v for k, v in search.best_params_.items()}
    logger.info(f"Best LR parameters: {best}")
    logger.info(f"Best LR CV ROC-AUC: {search.best_score_:.4f}")
    return best


def tune_xgboost(X_train: pd.DataFrame, y_train: pd.Series, seed: int, k_neighbors: int) -> dict:
    logger.info("Tuning XGBoost...")
    param_grid = config_loader.model.get("tuning", {}).get("xgboost", {
        "clf__max_depth": [3, 4, 5],
        "clf__learning_rate": [0.01, 0.05, 0.1],
        "clf__n_estimators": [50, 100, 150],
        "clf__min_child_weight": [1, 3, 5],
    })

    xgb = XGBClassifier(
        random_state=seed,
        eval_metric="logloss",
        scale_pos_weight=natural_scale_pos_weight(y_train),
    )
    model = _smote_pipeline(xgb, seed, k_neighbors)
    search = GridSearchCV(model, param_grid, scoring="roc_auc", cv=5, n_jobs=-1)
    search.fit(X_train, y_train)

    best = {k.replace("clf__", ""): v for k, v in search.best_params_.items()}
    logger.info(f"Best XGB parameters: {best}")
    logger.info(f"Best XGB CV ROC-AUC: {search.best_score_:.4f}")
    return best


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

    seed = config_loader.model.get("random_seed", 42)
    k_neighbors = config_loader.model.get("smote", {}).get("k_neighbors", 5)

    X_train, y_train = load_natural_train_matrix()
    features = pruned_feature_columns(X_train.columns)
    X_train = X_train[features]

    best_lr = tune_logistic_regression(X_train, y_train, seed, k_neighbors)
    best_xgb = tune_xgboost(X_train, y_train, seed, k_neighbors)

    print("\nTuning Results:")
    print(f"  Best Logistic Regression params : {best_lr}")
    print(f"  Best XGBoost params             : {best_xgb}")
