from app.services.risk_bands import classify_risk_tier


def test_classify_risk_tier_mutually_exclusive_bands():
    assert classify_risk_tier(0.10) == "low"
    assert classify_risk_tier(0.15) == "medium"
    assert classify_risk_tier(0.24) == "medium"
    assert classify_risk_tier(0.25) == "high"
    assert classify_risk_tier(0.90) == "high"
