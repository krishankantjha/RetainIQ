# ML Training Pipeline

Production inference uses **`ml/artifacts/models/ensemble_model.pkl`** (`CalibratedGBDTEnsemble`).

## Run order

From the project root, with dependencies installed (`pip install -r backend/requirements-dev.txt`):

```bash
# 1. Clean raw data and build features
python ml/preprocessing/clean.py
python ml/preprocessing/pipeline.py

# 2. Segmentation (autoencoder + K-Means)
python ml/segmentation/train_autoencoder.py
python ml/segmentation/kmeans.py

# 3. Champion model (ensemble; also writes diagnostics_metadata.json)
python ml/training/ensemble.py

# 4. Threshold, evaluation, and monitoring baselines
python ml/training/threshold.py
python ml/training/confusion_matrix.py
python ml/training/calibration.py
python ml/explainability/shap_global.py

# 5. Verify outputs + integrity manifest (fails if SHAP or baselines missing)
python scripts/generate_manifest.py
```

## Outputs

| Artifact | Purpose |
|----------|---------|
| `data/processed/train_features_natural.csv` | Pre-SMOTE training matrix (used by training scripts) |
| `data/processed/train_features.csv` | SMOTE-balanced training matrix (legacy compatibility) |
| `data/processed/test_features.csv` | Holdout test matrix (natural distribution) |
| `ml/artifacts/pipeline.pkl` | Fitted `ColumnTransformer` |
| `ml/artifacts/encoders.pkl` | Feature metadata and train median |
| `ml/artifacts/model_metadata.pkl` | `feature_names_in` and model type |
| `ml/artifacts/models/ensemble_model.pkl` | **Production classifier** |
| `ml/artifacts/models/kmeans_model.pkl` | Customer segments |
| `ml/artifacts/models/autoencoder_model.pkl` | Latent projection for clustering |
| `ml/artifacts/diagnostics_metadata.json` | Model version, SHA, holdout metrics (written by `ensemble.py`) |
| `ml/artifacts/artifacts_manifest.json` | SHA-256 hashes verified at API boot |
| `ml/artifacts/metrics/shap_global_importance.json` | Global SHAP baseline (required) |
| `ml/artifacts/plots/shap_summary.png`, `shap_beeswarm.png` | SHAP plots (required) |

Optional evaluation reports (not checked by `generate_manifest.py`):

- `ml/artifacts/metrics/benchmark_results.csv`
- `ml/artifacts/metrics/statistical_results.json`

## Optional / research scripts

## Optional / research scripts

- `ml/training/tune.py` — hyperparameter search (not wired into the default pipeline)
- `ml/training/benchmark.py` — model comparison report
- `ml/training/statistical_validation.py` — 5×2 CV significance tests
- `ml/training/evaluate.py` — holdout ROC/PR/confusion plots for `ensemble_model.pkl`

## Legacy (do not use for production)

- `ml/training/train.py` — old single XGBoost export to `model.pkl` (not in manifest or API)

Drift detection uses `train_features_natural.csv` at runtime via `detect_feature_drift()` (no separate script).

## Configuration

- `configs/feature_config.yaml` — column definitions
- `configs/model_config.yaml` — `decision_threshold`, hyperparameters, segmentation
- `configs/training_config.yaml` — data paths

## sklearn version

Training and inference require **scikit-learn 1.5.x** (pinned in `backend/requirements.txt`).
