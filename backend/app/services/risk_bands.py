"""Shared risk tier boundaries for analytics overview and charts."""

from configs.dataset_config import config_loader


def get_risk_band_thresholds() -> tuple[float, float]:
    model_cfg = config_loader.model
    decision_threshold = float(model_cfg.get("decision_threshold", 0.15))
    elevated_min = float(model_cfg.get("risk_display_bands", {}).get("medium_min", 0.25))
    return decision_threshold, elevated_min


def classify_risk_tier(churn_probability: float) -> str:
    decision_threshold, elevated_min = get_risk_band_thresholds()
    if churn_probability >= elevated_min:
        return "high"
    if churn_probability >= decision_threshold:
        return "medium"
    return "low"
