"""Diagnostics metadata writer tests."""

import json
import os

import pytest

from ml.training.diagnostics_metadata import sha256_file, write_diagnostics_metadata


def test_write_diagnostics_metadata(tmp_path):
    model_path = tmp_path / "models" / "ensemble_model.pkl"
    model_path.parent.mkdir(parents=True)
    model_path.write_bytes(b"test-model-bytes")

    artifacts_dir = tmp_path
    out_path = write_diagnostics_metadata(
        str(artifacts_dir),
        ensemble_model_path=str(model_path),
        holdout_accuracy=0.6757,
        holdout_f1=0.5952,
        holdout_roc_auc=0.8404,
        decision_threshold=0.15,
        artifact_timestamp="2026-09-03T14:00:00Z",
        evaluation_timestamp="2026-09-03T14:00:01Z",
    )

    assert out_path == os.path.join(str(artifacts_dir), "diagnostics_metadata.json")
    with open(out_path, encoding="utf-8") as f:
        data = json.load(f)

    assert data["model_version"] == "CalibratedGBDTEnsemble_v1.1"
    assert data["decision_threshold"] == 0.15
    assert data["model_sha256"] == sha256_file(str(model_path))
    assert data["holdout_metrics"]["f1"] == 0.5952


def test_write_diagnostics_metadata_missing_model(tmp_path):
    with pytest.raises(FileNotFoundError):
        write_diagnostics_metadata(
            str(tmp_path),
            ensemble_model_path=str(tmp_path / "missing.pkl"),
            holdout_accuracy=0.5,
            holdout_f1=0.5,
            holdout_roc_auc=0.5,
            decision_threshold=0.15,
        )
