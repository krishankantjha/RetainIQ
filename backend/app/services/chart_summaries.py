"""Server-side cohort chart aggregates — avoids shipping full cohort rows to the browser."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy.orm import Session

from app.database.models.customer import Customer
from app.database.models.prediction import Prediction
from app.services.risk_bands import classify_risk_tier
from app.services.user_scoping import AuthContext, filter_customers_by_scope

CONTRACT_ORDER = ("Month-to-month", "One year", "Two year")


def _contract_sort_index(contract: str) -> int:
    try:
        return CONTRACT_ORDER.index(contract)
    except ValueError:
        return len(CONTRACT_ORDER)


def build_chart_summaries(db: Session, auth: AuthContext) -> dict:
    rows = filter_customers_by_scope(
        db.query(
            Customer.contract,
            Customer.tenure,
            Customer.monthly_charges,
            Prediction.churn_probability,
            Prediction.is_high_risk,
        ).join(Prediction, Customer.id == Prediction.customer_id),
        auth,
    ).all()

    if not rows:
        return {
            "total_subscribers": 0,
            "total_mrr": 0.0,
            "histogram": [],
            "contract_risk": [],
            "tenure_risk": [],
        }

    bin_count = 10
    step = 1 / bin_count
    histogram = []
    for i in range(bin_count):
        min_p = i * step
        max_p = 1.0 if i == bin_count - 1 else (i + 1) * step
        low_pct = round(min_p * 100)
        high_pct = 100 if i == bin_count - 1 else round(max_p * 100)
        histogram.append(
            {
                "label": f"{low_pct}–{high_pct}%",
                "count": 0,
                "min": min_p,
                "max": max_p,
            }
        )

    contract_map: dict[str, dict] = {}
    tenure_bins: dict[int, dict] = {}
    total_mrr = 0.0
    max_tenure = 0
    months_per_bin = 12

    for contract, tenure, monthly_charges, churn_probability, is_high_risk in rows:
        total_mrr += float(monthly_charges or 0)
        max_tenure = max(max_tenure, int(tenure or 0))

        prob = float(churn_probability or 0)
        bin_index = min(int(prob / step), bin_count - 1)
        histogram[bin_index]["count"] += 1

        contract_key = contract or "Unknown"
        entry = contract_map.setdefault(
            contract_key,
            {"contract": contract_key, "high": 0, "medium": 0, "low": 0, "total": 0},
        )
        entry["total"] += 1
        tier = classify_risk_tier(prob)
        entry[tier] += 1

        tenure_index = int(tenure or 0) // months_per_bin
        tenure_entry = tenure_bins.setdefault(
            tenure_index,
            {"high": 0, "total": 0},
        )
        tenure_entry["total"] += 1
        if is_high_risk:
            tenure_entry["high"] += 1

    contract_risk = sorted(
        contract_map.values(),
        key=lambda row: _contract_sort_index(row["contract"]),
    )

    bin_count_tenure = max(1, (max_tenure + 1 + months_per_bin - 1) // months_per_bin)
    tenure_risk = []
    for i in range(bin_count_tenure):
        entry = tenure_bins.get(i)
        if not entry or entry["total"] == 0:
            continue
        start = i * months_per_bin
        end = start + months_per_bin - 1
        tenure_risk.append(
            {
                "label": f"{start}–{end} mo",
                "highRate": entry["high"] / entry["total"],
                "total": entry["total"],
                "high": entry["high"],
            }
        )

    return {
        "total_subscribers": len(rows),
        "total_mrr": round(total_mrr, 2),
        "histogram": histogram,
        "contract_risk": contract_risk,
        "tenure_risk": tenure_risk,
    }
