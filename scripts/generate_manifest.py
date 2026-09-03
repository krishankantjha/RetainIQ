"""
Hash production ML artifacts and verify required pipeline outputs exist on disk.

Run at the end of every full training pipeline (after shap_global.py).
"""

import hashlib
import json
import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ARTIFACTS_DIR = os.path.join(PROJECT_ROOT, "ml", "artifacts")

# Pickled artifacts verified at API startup (SHA-256 in manifest).
FILES_TO_HASH = {
    "ensemble_model.pkl": os.path.join("models", "ensemble_model.pkl"),
    "pipeline.pkl": "pipeline.pkl",
    "encoders.pkl": "encoders.pkl",
    "model_metadata.pkl": "model_metadata.pkl",
    "kmeans_model.pkl": os.path.join("models", "kmeans_model.pkl"),
    "autoencoder_model.pkl": os.path.join("models", "autoencoder_model.pkl"),
}

# Must exist after a full pipeline run; not all are hashed.
REQUIRED_PIPELINE_OUTPUTS = [
    ("data/processed/train_features_natural.csv", "Pre-SMOTE training baseline"),
    ("ml/artifacts/metrics/threshold_metrics.json", "Threshold evaluation"),
    ("ml/artifacts/metrics/confusion_matrix.json", "Confusion matrix counts"),
    ("ml/artifacts/metrics/shap_global_importance.json", "Global SHAP baseline (run shap_global.py)"),
    ("ml/artifacts/plots/shap_summary.png", "SHAP summary plot"),
    ("ml/artifacts/plots/shap_beeswarm.png", "SHAP beeswarm plot"),
    ("ml/artifacts/diagnostics_metadata.json", "Diagnostics metadata"),
]


def _sha256(filepath: str) -> str:
    digest = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            digest.update(chunk)
    return digest.hexdigest()


def verify_pipeline_outputs() -> None:
    """Fail fast if any required post-pipeline file is missing."""
    missing = []
    for rel_path, label in REQUIRED_PIPELINE_OUTPUTS:
        filepath = os.path.join(PROJECT_ROOT, rel_path.replace("/", os.sep))
        if not os.path.isfile(filepath):
            missing.append(f"  - {rel_path} ({label})")

    if missing:
        print("ERROR: Required pipeline outputs are missing:\n" + "\n".join(missing), file=sys.stderr)
        print(
            "\nFull run order: docs/ml_pipeline.md\n"
            "If SHAP files are missing: python ml/explainability/shap_global.py",
            file=sys.stderr,
        )
        raise FileNotFoundError(f"{len(missing)} required pipeline output(s) missing")


def main() -> None:
    verify_pipeline_outputs()

    manifest = {}
    for name, rel_path in FILES_TO_HASH.items():
        filepath = os.path.join(ARTIFACTS_DIR, rel_path)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Required artifact missing: {filepath}")
        manifest[name] = _sha256(filepath)
        print(f"Hashed {name}: {manifest[name]}")

    manifest_path = os.path.join(ARTIFACTS_DIR, "artifacts_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=4)
    print(f"Manifest written to {manifest_path}")
    print("All required pipeline outputs present.")


if __name__ == "__main__":
    main()
