import os
import sys
import pickle
import logging
import threading
from typing import List, Dict, Any, Tuple
import pandas as pd
import numpy as np
import shap
from sqlalchemy.orm import Session

from app.database.models.customer import Customer
from app.database.models.prediction import Prediction
from app.database.models.uploads import Upload

# Resolve project root dynamically to support importing and file resolution
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.preprocessing.engineer import engineer_features
from configs.dataset_config import config_loader
from ml.preprocessing.validator import DataValidator
from app.core.security import verify_file_hash, ArtifactValidationError
from app.services.ingestion import clean_uploaded_data, log_prediction_events
from app.services.customer_mapper import customer_to_ml_record, customers_from_upload_dataframe

logger = logging.getLogger("backend.app.services.prediction_service")

REQUIRED_SKLEARN_MAJOR_MINOR = (1, 5)


def _verify_sklearn_version() -> None:
    """Reject incompatible scikit-learn versions before unpickling trained artifacts."""
    import sklearn

    installed = sklearn.__version__.split(".")
    try:
        installed_mm = (int(installed[0]), int(installed[1]))
    except (IndexError, ValueError) as exc:
        raise ArtifactValidationError(
            f"Unable to parse installed scikit-learn version: {sklearn.__version__}"
        ) from exc

    if installed_mm != REQUIRED_SKLEARN_MAJOR_MINOR:
        raise ArtifactValidationError(
            f"Incompatible scikit-learn version {sklearn.__version__}. "
            f"Artifacts require scikit-learn {REQUIRED_SKLEARN_MAJOR_MINOR[0]}.{REQUIRED_SKLEARN_MAJOR_MINOR[1]}.x. "
            "Install backend/requirements.txt or retrain artifacts with the current sklearn version."
        )


# Resolve absolute artifact paths from config loader
artifacts_dir_relative = config_loader.training["data_paths"].get("artifacts_dir", "ml/artifacts")
artifacts_dir = os.path.join(PROJECT_ROOT, artifacts_dir_relative)
models_dir = os.path.join(artifacts_dir, "models")

ENSEMBLE_MODEL_PATH = os.path.join(models_dir, "ensemble_model.pkl")
PIPELINE_PATH = os.path.join(artifacts_dir, "pipeline.pkl")
ENCODERS_PATH = os.path.join(artifacts_dir, "encoders.pkl")
METADATA_PATH = os.path.join(artifacts_dir, "model_metadata.pkl")
MANIFEST_PATH = os.path.join(artifacts_dir, "artifacts_manifest.json")
KMEANS_PATH = os.path.join(models_dir, "kmeans_model.pkl")
AUTOENCODER_PATH = os.path.join(models_dir, "autoencoder_model.pkl")


# Global variables to cache loaded models
_model = None
_preprocessor = None
_encoders_meta = None
_model_metadata = None
_explainer = None
_kmeans_model = None
_autoencoder = None

# Thread lock to guarantee safe lazy loading of ML artifacts in multi-threaded runtime
_lock = threading.Lock()


def _resolve_shap_estimator(model: Any) -> Any:
    """Tree estimator used for SHAP (ensemble delegates to its XGB component)."""
    if hasattr(model, "calibrated_classifiers_"):
        return model.calibrated_classifiers_[0].estimator
    if hasattr(model, "xgb_"):
        return model.xgb_
    return model


def load_artifacts() -> Tuple[Any, Any, Dict[str, Any], Dict[str, Any], Any, Any]:
    """
    Loads and caches model, pipeline, metadata, SHAP explainer, and K-Means artifacts.
    Uses a thread-safe double-checked lock pattern to prevent redundant I/O operations
    when multiple API requests try to load the artifacts concurrently on startup.
    """
    global _model, _preprocessor, _encoders_meta, _model_metadata, _explainer, _kmeans_model, _autoencoder
    
    if _model is not None:
        return _model, _preprocessor, _encoders_meta, _model_metadata, _explainer, _kmeans_model
        
    with _lock:
        # Double-check inside lock boundary to prevent redundant read operations
        if _model is not None:
            return _model, _preprocessor, _encoders_meta, _model_metadata, _explainer, _kmeans_model
            
        logger.info("Loading model and pipeline artifacts from disk (thread-safe lock acquired)...")
        _verify_sklearn_version()

        if not os.path.exists(MANIFEST_PATH):
            raise ArtifactValidationError(f"Artifacts manifest not found at {MANIFEST_PATH}")

        import json
        try:
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception as e:
            raise ArtifactValidationError(f"Corrupt artifacts manifest: {e}") from e

        required_files = {
            "ensemble_model.pkl": ENSEMBLE_MODEL_PATH,
            "pipeline.pkl": PIPELINE_PATH,
            "encoders.pkl": ENCODERS_PATH,
            "model_metadata.pkl": METADATA_PATH,
            "kmeans_model.pkl": KMEANS_PATH,
            "autoencoder_model.pkl": AUTOENCODER_PATH,
        }
        try:
            for manifest_key, filepath in required_files.items():
                verify_file_hash(filepath, manifest.get(manifest_key, ""))
        except Exception as e:
            raise ArtifactValidationError(f"Artifact verification failed: {e}") from e

        for filepath in required_files.values():
            if not os.path.exists(filepath):
                raise FileNotFoundError(f"Artifact file not found at {filepath}")

        from ml.segmentation.autoencoder import AutoencoderWrapper
        import ml.training.ensemble  # noqa: F401 — required for ensemble unpickling

        with open(ENSEMBLE_MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        with open(PIPELINE_PATH, "rb") as f:
            _preprocessor = pickle.load(f)
        with open(ENCODERS_PATH, "rb") as f:
            _encoders_meta = pickle.load(f)
        with open(METADATA_PATH, "rb") as f:
            _model_metadata = pickle.load(f)
        with open(KMEANS_PATH, "rb") as f:
            _kmeans_model = pickle.load(f)
        with open(AUTOENCODER_PATH, "rb") as f:
            _autoencoder = pickle.load(f)

        _explainer = shap.Explainer(_resolve_shap_estimator(_model))
            
        logger.info("Artifacts successfully loaded and explainer cached.")
        return _model, _preprocessor, _encoders_meta, _model_metadata, _explainer, _kmeans_model


def get_autoencoder():
    """Returns the cached AutoencoderWrapper model, loading it if not cached."""
    global _autoencoder
    if _autoencoder is None:
        load_artifacts()
    return _autoencoder





def batch_predict_and_explain(df: pd.DataFrame, db: Session, upload_id: int, threshold: float = None) -> int:
    """
    Cleans the uploaded DataFrame, runs the feature engineering & encoding pipeline,
    generates calibrated churn probability predictions, continuous customer segment classifications,
    and SHAP explainability metrics/recommended Save Plays, and bulk inserts them.
    """
    model_obj, preprocessor_obj, encoders, metadata, explainer_obj, kmeans_obj = load_artifacts()
    
    # Clean data
    df_clean = clean_uploaded_data(df)

    # Perform strict modular validations to protect prediction pipeline
    validator = DataValidator(logger)
    validator.validate_schema(df_clean, strict=True)
    validator.validate_data_types(df_clean, strict=True)
    validator.validate_value_bounds(df_clean, strict=True)
    validator.validate_categorical_domains(df_clean, strict=True)
    
    target_col = config_loader.feature.get("target_column", "Churn")
    # Keep track of original Churn values to save in the DB (keep None/NaN as null)
    original_churns = df_clean[target_col].apply(lambda val: str(val) if pd.notna(val) else None).tolist()
    
    # Run feature engineering (this requires train_monthly_charges_median to prevent leakage)
    df_engineered = engineer_features(df_clean, encoders["train_monthly_charges_median"])
    
    # Run column transformer (StandardScaler, encoders, etc.)
    X_transformed = preprocessor_obj.transform(df_engineered)
    X_df = pd.DataFrame(X_transformed, columns=encoders["feature_names_out"])
    
    # Align to model's expected inputs (dropping binary__has_support etc)
    X_aligned = X_df[metadata["feature_names_in"]]
    
    # Model predictions
    y_prob = model_obj.predict_proba(X_aligned)[:, 1]
    # Resolve classification threshold dynamically (override parameter -> config)
    threshold = resolve_decision_threshold(threshold)
    is_high_risk = (y_prob >= threshold).astype(bool)
    
    # Predict clusters by projecting preprocessed features to 16-dimensional latent space via Autoencoder
    autoencoder = get_autoencoder()
    seg_cfg = config_loader.model.get("segmentation")
    if seg_cfg is None or "continuous_features" not in seg_cfg:
        raise ValueError("Configuration Error: 'segmentation.continuous_features' is missing from the model configuration.")
    cont_cols = seg_cfg["continuous_features"]
    
    if autoencoder is not None:
        try:
            X_latent = autoencoder.transform(X_transformed.astype(np.float32))
            cluster_labels = kmeans_obj.predict(X_latent)
        except Exception as e:
            logger.warning(f"Failed to project features using Autoencoder: {e}. Falling back to raw continuous features.")
            actual_cont_cols = [col for col in cont_cols if col in X_df.columns]
            X_continuous = X_df[actual_cont_cols] if actual_cont_cols else X_df
            cluster_labels = kmeans_obj.predict(X_continuous)
    else:
        logger.warning("Autoencoder model is None. Falling back to raw continuous features for cluster prediction.")
        actual_cont_cols = [col for col in cont_cols if col in X_df.columns]
        X_continuous = X_df[actual_cont_cols] if actual_cont_cols else X_df
        cluster_labels = kmeans_obj.predict(X_continuous)
    
    # Instantiate LocalExplainer for save-play logic and SHAP fallbacks.
    from ml.explainability.shap_local import LocalExplainer
    local_explainer = LocalExplainer(
        model_obj,
        metadata["feature_names_in"],
        explainer=explainer_obj,
        preprocessor=preprocessor_obj,
        encoders=encoders,
        metadata=metadata,
    )

    customers_to_insert = customers_from_upload_dataframe(df_clean, original_churns, upload_id)

    # Bulk insert customers using add_all
    db.add_all(customers_to_insert)
    db.flush()

    logger.info(f"Computing SHAP values for batch of {len(customers_to_insert)} customers...")
    try:
        batch_shap_values = explainer_obj(X_aligned)   # shape: (n_rows, n_features)
        batch_shap_array = batch_shap_values.values     # numpy array
    except Exception as shap_err:
        logger.warning(f"Batch SHAP computation failed ({shap_err}); falling back to per-row mode.")
        batch_shap_array = None

    raw_feature_cols = [col for col in df_clean.columns if col not in X_aligned.columns]
    if raw_feature_cols:
        combined_features = pd.concat(
            [X_aligned.reset_index(drop=True), df_clean[raw_feature_cols].reset_index(drop=True)],
            axis=1,
        )
    else:
        combined_features = X_aligned.reset_index(drop=True)

    predictions_to_insert = []
    for i, cust in enumerate(customers_to_insert):
        customer_row = combined_features.iloc[i]

        # Use pre-computed batch SHAP row where available; fall back to single-call
        if batch_shap_array is not None:
            explanation = local_explainer.explain_from_shap_values(
                batch_shap_array[i], customer_row
            )
        else:
            explanation = local_explainer.explain_customer(combined_features.iloc[[i]])

        # Format Save Plays to match prediction DB schema
        db_save_plays = []
        for play in explanation["save_plays"]:
            db_save_plays.append({
                "campaign": play["play_name"],
                "action": play["recommendation"],
                "estimated_impact": float(play["contribution"]),
                "feature": play["feature"]
            })

        pred = Prediction(
            customer_id=cust.id,
            churn_probability=float(y_prob[i]),
            is_high_risk=bool(is_high_risk[i]),
            top_drivers=explanation["top_drivers"],
            save_plays=db_save_plays,
            cluster=int(cluster_labels[i])
        )
        predictions_to_insert.append(pred)
        
    # Log prediction events to audit trail
    log_prediction_events([cust.customer_id for cust in customers_to_insert], y_prob, is_high_risk, cluster_labels)
    
    # Bulk insert predictions using add_all
    db.add_all(predictions_to_insert)
    db.commit()
    return len(customers_to_insert)


def resolve_decision_threshold(threshold: float | None) -> float:
    """Resolve the churn decision threshold from an override or model config."""
    if threshold is not None:
        return float(threshold)
    configured = config_loader.model.get("decision_threshold")
    if configured is None:
        raise ValueError("Configuration Error: 'decision_threshold' is missing from the model configuration.")
    return float(configured)


def score_single_customer(
    ml_record: dict,
    db: Session,
    threshold: float | None = None,
    *,
    replace_existing: bool = True,
) -> tuple[Customer, Prediction]:
    """
    Score one IBM Telco subscriber, persist Customer + Prediction, and return both rows.
  """
    customer_id = str(ml_record.get("customerID") or "").strip()
    if not customer_id:
        raise ValueError("customerID is required for single-customer scoring")

    existing = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if existing:
        if not replace_existing:
            raise ValueError(f"Customer {customer_id} already exists in the scored cohort")
        db.delete(existing)
        db.flush()

    resolved_threshold = resolve_decision_threshold(threshold)
    upload = Upload(
        filename=f"single-score-{customer_id}.json",
        status="processing",
        decision_threshold=resolved_threshold,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    try:
        df = pd.DataFrame([ml_record])
        row_count = batch_predict_and_explain(df, db, upload.id, threshold=resolved_threshold)
        upload.status = "completed"
        upload.row_count = row_count
        db.commit()
    except Exception:
        db.rollback()
        upload = db.query(Upload).filter(Upload.id == upload.id).first()
        if upload:
            upload.status = "failed"
            upload.error_message = "Single-customer scoring failed"
            db.commit()
        raise

    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer or not customer.prediction:
        raise RuntimeError("Scoring completed but customer prediction was not persisted")
    return customer, customer.prediction


def get_preprocessed_active_customers(db: Session) -> pd.DataFrame:
    """Return a capped, preprocessed feature matrix for drift monitoring."""
    _, preprocessor_obj, encoders, _, _, _ = load_artifacts()

    # Cap sample size for health-check polling.
    customers = db.query(Customer).limit(1000).all()
    if not customers:
        return pd.DataFrame(columns=encoders["feature_names_out"])
        
    # Map model attributes back to dict for clean dataframe reconstruction
    data_list = [customer_to_ml_record(c) for c in customers]
        
    df_clean = pd.DataFrame(data_list)
    df_engineered = engineer_features(df_clean, encoders["train_monthly_charges_median"])
    X_transformed = preprocessor_obj.transform(df_engineered)
    X_df = pd.DataFrame(X_transformed, columns=encoders["feature_names_out"])
    return X_df
