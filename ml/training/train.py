"""
Legacy single-model trainer (model.pkl).

Uses natural training data with fold-isolated SMOTE via imblearn Pipeline.
Production inference uses ml/training/ensemble.py.
"""

import os
import sys
import pickle
import logging

from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.calibration import CalibratedClassifierCV
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

logger = logging.getLogger("ml.training.train")


def train_model(artifacts_dir: str) -> None:
    """Train calibrated XGBoost on natural data with SMOTE inside CV folds only."""
    logger.info("Starting legacy XGBoost training (natural train split)")

    X_train, y_train = load_natural_train_matrix()
    features = pruned_feature_columns(X_train.columns)
    X_train = X_train[features]

    seed = config_loader.model.get("random_seed", 42)
    k_neighbors = config_loader.model.get("smote", {}).get("k_neighbors", 5)

    params = config_loader.model.get("champion_model", {}).copy()
    params.pop("algorithm", None)
    params["random_state"] = seed
    params["scale_pos_weight"] = natural_scale_pos_weight(y_train)

    pipeline = ImbPipeline([
        ("smote", SMOTE(random_state=seed, k_neighbors=k_neighbors)),
        ("xgb", XGBClassifier(**params)),
    ])
    model = CalibratedClassifierCV(pipeline, method="isotonic", cv=5)
    model.fit(X_train, y_train)
    logger.info("Trained calibrated XGBoost with fold-isolated SMOTE")

    os.makedirs(artifacts_dir, exist_ok=True)
    model_path = os.path.join(artifacts_dir, "model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    logger.info(f"Saved model binary to: {model_path}")

    metadata = {
        "feature_names_in": features,
        "hyperparameters": params,
        "model_type": "CalibratedClassifierCV(ImbPipeline(SMOTE+XGBClassifier))",
    }
    metadata_path = os.path.join(artifacts_dir, "model_metadata.pkl")
    with open(metadata_path, "wb") as f:
        pickle.dump(metadata, f)
    logger.info(f"Saved model metadata to: {metadata_path}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

    artifacts = config_loader.training["data_paths"]["artifacts_dir"]
    artifacts_dir = artifacts if os.path.isabs(artifacts) else os.path.join(base_dir, artifacts)

    try:
        train_model(artifacts_dir)
        print("Training succeeded.")
    except Exception as e:
        logger.exception(f"Training failed: {e}")
        raise
