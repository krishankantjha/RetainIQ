from collections import defaultdict
import os
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, asc, desc, or_

from app.database.session import get_db
from app.database.models.customer import Customer
from app.database.models.prediction import Prediction
from app.constants.cohort_personas import COHORT_PERSONAS, get_cohort_persona_name
from app.services.user_scoping import (
    AuthContext,
    filter_customers_by_scope,
    filter_predictions_by_scope,
    get_auth_context,
)
from app.services.risk_bands import get_risk_band_thresholds

router = APIRouter(prefix="/analytics", tags=["analytics"])

TENURE_BIN_LABELS = ("0-12", "13-24", "25-36", "37-48", "49-60", "61+")

SortField = Literal["customer_id", "churn_probability", "tenure", "monthly_charges"]
SortDirection = Literal["asc", "desc"]

SORT_COLUMNS = {
    "customer_id": Customer.customer_id,
    "churn_probability": Prediction.churn_probability,
    "tenure": Customer.tenure,
    "monthly_charges": Customer.monthly_charges,
}


def _tenure_range_for_bin(label: str) -> tuple[int, int] | None:
    ranges = {
        "0-12": (0, 12),
        "13-24": (13, 24),
        "25-36": (25, 36),
        "37-48": (37, 48),
        "49-60": (49, 60),
        "61+": (61, 999),
    }
    return ranges.get(label)


def _customer_ids_for_campaign(db: Session, campaign: str, auth: AuthContext) -> list[int]:
    rows = filter_predictions_by_scope(
        db.query(Prediction.customer_id, Prediction.save_plays),
        auth,
    ).all()
    return [
        customer_id
        for customer_id, plays in rows
        if plays and any(play.get("campaign") == campaign for play in plays)
    ]


def _serialize_cohort_row(row) -> dict:
    return {
        "customer_id": row.customer_id,
        "gender": row.gender,
        "tenure": row.tenure,
        "contract": row.contract,
        "internet_service": row.internet_service,
        "monthly_charges": row.monthly_charges,
        "total_charges": row.total_charges,
        "churn": row.churn,
        "churn_probability": row.churn_probability,
        "is_high_risk": row.is_high_risk,
        "cluster": row.cluster,
        "cohort_persona": get_cohort_persona_name(row.cluster),
        "predicted_at": row.predicted_at.isoformat() if row.predicted_at else None,
    }


@router.get("/overview")
def get_analytics_overview(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Retrieve overview statistics for predicted customers.
    """
    total_customers = (
        filter_predictions_by_scope(db.query(func.count(Prediction.id)), auth).scalar() or 0
    )
    if total_customers == 0:
        return {
            "total_customers": 0,
            "average_churn_probability": 0.0,
            "total_value_at_risk": 0.0,
            "risk_distribution": {
                "high": 0,
                "medium": 0,
                "low": 0
            }
        }
        
    avg_probability = (
        filter_predictions_by_scope(db.query(func.avg(Prediction.churn_probability)), auth).scalar()
        or 0.0
    )

    total_value_at_risk = (
        filter_customers_by_scope(
            db.query(func.sum(Customer.monthly_charges))
            .join(Prediction, Customer.id == Prediction.customer_id),
            auth,
        )
        .filter(Prediction.is_high_risk == True)
        .filter(
            or_(
                Customer.churn.is_(None),
                func.lower(Customer.churn) != "yes",
            )
        )
        .scalar()
        or 0.0
    )

    decision_threshold, elevated_min = get_risk_band_thresholds()

    high_count = (
        filter_predictions_by_scope(db.query(func.count(Prediction.id)), auth)
        .filter(Prediction.churn_probability >= elevated_min)
        .scalar()
        or 0
    )
    medium_count = (
        filter_predictions_by_scope(db.query(func.count(Prediction.id)), auth)
        .filter(Prediction.churn_probability >= decision_threshold)
        .filter(Prediction.churn_probability < elevated_min)
        .scalar()
        or 0
    )
    low_count = (
        filter_predictions_by_scope(db.query(func.count(Prediction.id)), auth)
        .filter(Prediction.churn_probability < decision_threshold)
        .scalar()
        or 0
    )

    return {
        "total_customers": total_customers,
        "average_churn_probability": float(avg_probability),
        "total_value_at_risk": float(total_value_at_risk),
        "risk_distribution": {
            "high": high_count,
            "medium": medium_count,
            "low": low_count,
        },
        "risk_bands": {
            "decision_threshold": decision_threshold,
            "elevated_min": elevated_min,
            "actionable_high": medium_count + high_count,
        },
    }


@router.get("/save-plays")
def get_save_plays_analytics(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Retrieve aggregates of recommended Save Play campaigns.
    """
    predictions = filter_predictions_by_scope(db.query(Prediction.save_plays), auth).all()
    
    campaign_counts = defaultdict(int)
    campaign_impacts = defaultdict(list)
    
    for row in predictions:
        plays = row[0]
        if not plays:
            continue
        for play in plays:
            campaign = play.get("campaign")
            impact = play.get("estimated_impact", 0.0)
            if campaign:
                campaign_counts[campaign] += 1
                campaign_impacts[campaign].append(impact)
                
    results = []
    for campaign, count in campaign_counts.items():
        impacts = campaign_impacts[campaign]
        avg_impact = sum(impacts) / len(impacts) if impacts else 0.0
        results.append({
            "campaign": campaign,
            "recommendation_count": count,
            "average_estimated_impact": float(avg_impact)
        })
        
    results.sort(key=lambda x: x["recommendation_count"], reverse=True)
    return results


@router.get("/personas")
def get_persona_summary(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Behavioral cluster (K-means persona) summary across the scored cohort.
    """
    rows = filter_predictions_by_scope(
        db.query(
            Prediction.cluster,
            Prediction.churn_probability,
            Prediction.is_high_risk,
        ),
        auth,
    ).all()

    if not rows:
        return {"personas": [], "total_subscribers": 0}

    buckets: dict[int, dict] = defaultdict(
        lambda: {"subscriber_count": 0, "churn_sum": 0.0, "high_risk_count": 0}
    )
    unassigned = {"subscriber_count": 0, "churn_sum": 0.0, "high_risk_count": 0}

    for cluster, churn_probability, is_high_risk in rows:
        if cluster is None:
            unassigned["subscriber_count"] += 1
            unassigned["churn_sum"] += float(churn_probability)
            if is_high_risk:
                unassigned["high_risk_count"] += 1
            continue
        bucket = buckets[cluster]
        bucket["subscriber_count"] += 1
        bucket["churn_sum"] += float(churn_probability)
        if is_high_risk:
            bucket["high_risk_count"] += 1

    personas = []
    for cluster_id in sorted(buckets.keys()):
        bucket = buckets[cluster_id]
        count = bucket["subscriber_count"]
        personas.append({
            "cluster_id": cluster_id,
            "persona": get_cohort_persona_name(cluster_id),
            "subscriber_count": count,
            "average_churn_probability": bucket["churn_sum"] / count if count else 0.0,
            "high_risk_count": bucket["high_risk_count"],
        })

    if unassigned["subscriber_count"] > 0:
        count = unassigned["subscriber_count"]
        personas.append({
            "cluster_id": None,
            "persona": "Unassigned",
            "subscriber_count": count,
            "average_churn_probability": unassigned["churn_sum"] / count,
            "high_risk_count": unassigned["high_risk_count"],
        })

    return {
        "personas": personas,
        "total_subscribers": len(rows),
    }


@router.get("/cohort-data")
def get_cohort_data(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(500, ge=1, le=1000, description="Rows per page (max 1000)"),
    high_risk: Optional[bool] = Query(None, description="Filter to high-risk subscribers only"),
    contract: Optional[str] = Query(None, description="Filter by contract type"),
    cluster: Optional[int] = Query(None, ge=0, description="Filter by behavioral cluster ID"),
    campaign: Optional[str] = Query(None, description="Filter to subscribers with this save-play campaign"),
    tenure_bin: Optional[str] = Query(None, description="Filter by tenure bin label (e.g. 0-12)"),
    min_churn: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum churn probability"),
    max_churn: Optional[float] = Query(None, ge=0.0, le=1.0, description="Maximum churn probability"),
    sort_by: SortField = Query("customer_id", description="Sort column"),
    sort_dir: SortDirection = Query("asc", description="Sort direction"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Retrieve paginated customer demographic, contract, and churn prediction details for cohort analysis.
    """
    if min_churn is not None and max_churn is not None and min_churn > max_churn:
        raise HTTPException(status_code=400, detail="min_churn cannot exceed max_churn")

    base_query = filter_customers_by_scope(
        db.query(
        Customer.customer_id,
        Customer.gender,
        Customer.tenure,
        Customer.contract,
        Customer.internet_service,
        Customer.monthly_charges,
        Customer.total_charges,
        Customer.churn,
        Prediction.churn_probability,
        Prediction.is_high_risk,
        Prediction.cluster,
        Prediction.predicted_at,
        ).join(Prediction, Customer.id == Prediction.customer_id),
        auth,
    )

    if high_risk is True:
        base_query = base_query.filter(Prediction.is_high_risk.is_(True))
    elif high_risk is False:
        base_query = base_query.filter(Prediction.is_high_risk.is_(False))

    if contract:
        base_query = base_query.filter(Customer.contract == contract)

    if cluster is not None:
        base_query = base_query.filter(Prediction.cluster == cluster)

    if min_churn is not None:
        base_query = base_query.filter(Prediction.churn_probability >= min_churn)

    if max_churn is not None:
        base_query = base_query.filter(Prediction.churn_probability <= max_churn)

    if tenure_bin:
        tenure_range = _tenure_range_for_bin(tenure_bin)
        if tenure_range is None:
            raise HTTPException(status_code=400, detail=f"Invalid tenure_bin: {tenure_bin}")
        tenure_min, tenure_max = tenure_range
        base_query = base_query.filter(Customer.tenure >= tenure_min)
        base_query = base_query.filter(Customer.tenure <= tenure_max)

    if campaign:
        matching_ids = _customer_ids_for_campaign(db, campaign, auth)
        if not matching_ids:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0,
                "filters": {
                    "high_risk": high_risk,
                    "contract": contract,
                    "cluster": cluster,
                    "campaign": campaign,
                    "tenure_bin": tenure_bin,
                    "min_churn": min_churn,
                    "max_churn": max_churn,
                    "sort_by": sort_by,
                    "sort_dir": sort_dir,
                },
            }
        base_query = base_query.filter(Customer.id.in_(matching_ids))

    sort_column = SORT_COLUMNS[sort_by]
    order_clause = asc(sort_column) if sort_dir == "asc" else desc(sort_column)

    total = base_query.count()
    offset = (page - 1) * page_size
    results = (
        base_query
        .order_by(order_clause)
        .offset(offset)
        .limit(page_size)
        .all()
    )

    total_pages = (total + page_size - 1) // page_size if total else 0

    return {
        "items": [_serialize_cohort_row(r) for r in results],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "filters": {
            "high_risk": high_risk,
            "contract": contract,
            "cluster": cluster,
            "campaign": campaign,
            "tenure_bin": tenure_bin,
            "min_churn": min_churn,
            "max_churn": max_churn,
            "sort_by": sort_by,
            "sort_dir": sort_dir,
        },
    }


@router.get("/diagnostics-metadata")
def get_diagnostics_metadata(
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Retrieve diagnostics metadata to identify version drift in user interfaces.
    """
    import os
    import json
    from app.core.security import calculate_file_sha256
    
    # Resolve absolute path to diagnostics_metadata.json relative to backend project root
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
    metadata_path = os.path.join(PROJECT_ROOT, "ml", "artifacts", "diagnostics_metadata.json")
    model_path = os.path.join(PROJECT_ROOT, "ml", "artifacts", "models", "ensemble_model.pkl")
    
    # Compute active model's SHA-256
    model_sha256 = ""
    if os.path.exists(model_path):
        try:
            model_sha256 = calculate_file_sha256(model_path)
        except Exception:
            pass
            
    if not os.path.exists(metadata_path):
        return {
            "success": False,
            "drift_detected": True,
            "message": "Diagnostics metadata file not found.",
            "model_version": "unknown",
            "diagnostics_version": "unknown",
            "artifact_timestamp": "unknown",
            "evaluation_timestamp": "unknown",
            "model_sha256": "unknown",
            "actual_model_sha256": model_sha256
        }
        
    try:
        with open(metadata_path, "r") as f:
            data = json.load(f)
            
        expected_sha = data.get("model_sha256", "")
        drift_detected = (expected_sha != model_sha256)
        
        return {
            "success": True,
            "drift_detected": drift_detected,
            "actual_model_sha256": model_sha256,
            **data
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read diagnostics metadata: {e}"
        )


@router.get("/model-health")
def get_model_health(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Retrieve model health metadata, expected performance metrics,
    and Kolmogorov-Smirnov test results indicating feature drift.
    """
    try:
        from app.services.prediction_service import get_preprocessed_active_customers
        from ml.training.model_monitor import get_system_health
        
        X_active = get_preprocessed_active_customers(db, user_id=auth.user_id)
        health_status = get_system_health(X_active)
        return health_status
    except Exception as e:
        import logging
        logging.getLogger("backend.app.api.routes.analytics").error(f"Failed to check model health: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check model health: {str(e)}"
        )


DIAGNOSTIC_PLOTS: dict[str, dict[str, str]] = {
    "roc_curve": {"file": "roc_curve.png", "title": "ROC curve"},
    "precision_recall_curve": {"file": "precision_recall_curve.png", "title": "Precision–recall curve"},
    "calibration_curve": {"file": "calibration_curve.png", "title": "Calibration curve"},
    "confusion_matrix": {"file": "confusion_matrix.png", "title": "Confusion matrix"},
    "threshold_sweep": {"file": "threshold_sweep.png", "title": "Threshold sweep"},
    "shap_summary": {"file": "shap_summary.png", "title": "SHAP summary"},
    "shap_beeswarm": {"file": "shap_beeswarm.png", "title": "SHAP beeswarm"},
}


def _diagnostics_plots_dir() -> str:
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
    return os.path.join(project_root, "ml", "artifacts", "plots")


@router.get("/diagnostics-plots")
def list_diagnostics_plots(
    auth: AuthContext = Depends(get_auth_context),
):
    """List training-time diagnostic plots available for the UI."""
    plots_dir = _diagnostics_plots_dir()
    return [
        {
            "id": plot_id,
            "title": meta["title"],
            "filename": meta["file"],
            "available": os.path.isfile(os.path.join(plots_dir, meta["file"])),
        }
        for plot_id, meta in DIAGNOSTIC_PLOTS.items()
    ]


@router.get("/diagnostics-plots/{plot_id}")
def get_diagnostics_plot(
    plot_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """Serve a single diagnostic plot image from ML artifacts."""
    from fastapi.responses import FileResponse

    meta = DIAGNOSTIC_PLOTS.get(plot_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Unknown diagnostic plot: {plot_id}")

    plot_path = os.path.join(_diagnostics_plots_dir(), meta["file"])
    if not os.path.isfile(plot_path):
        raise HTTPException(status_code=404, detail=f"Plot file not found: {meta['file']}")

    return FileResponse(plot_path, media_type="image/png", filename=meta["file"])


def _tenure_bin_label(tenure: int) -> str:
    if tenure <= 12:
        return "0-12"
    if tenure <= 24:
        return "13-24"
    if tenure <= 36:
        return "25-36"
    if tenure <= 48:
        return "37-48"
    if tenure <= 60:
        return "49-60"
    return "61+"


@router.get("/risk-trend")
def get_risk_trend(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Daily aggregates of churn probability and high-risk counts by prediction date.
    """
    day_expr = func.date(Prediction.predicted_at)
    rows = (
        filter_predictions_by_scope(
            db.query(
                day_expr.label("day"),
                func.count(Prediction.id).label("subscriber_count"),
                func.avg(Prediction.churn_probability).label("avg_churn_probability"),
                func.sum(case((Prediction.is_high_risk == True, 1), else_=0)).label("high_risk_count"),
            )
            .group_by(day_expr)
            .order_by(day_expr),
            auth,
        )
        .all()
    )

    return {
        "points": [
            {
                "date": str(r.day),
                "subscriber_count": int(r.subscriber_count or 0),
                "avg_churn_probability": float(r.avg_churn_probability or 0.0),
                "high_risk_count": int(r.high_risk_count or 0),
            }
            for r in rows
        ]
    }


@router.get("/global-drivers")
def get_global_drivers(
    top_n: int = Query(15, ge=5, le=30, description="Number of features to return"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Cohort-level SHAP driver summary aggregated from stored per-subscriber explanations.
    """
    rows = filter_predictions_by_scope(db.query(Prediction.top_drivers), auth).all()
    if not rows:
        return {"drivers": [], "subscriber_count": 0}

    sums: dict[str, float] = defaultdict(float)
    abs_sums: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)

    for row in rows:
        drivers = row[0] or []
        for driver in drivers:
            feature = driver.get("feature")
            shap_value = driver.get("shap_value")
            if not feature or shap_value is None:
                continue
            sums[feature] += float(shap_value)
            abs_sums[feature] += abs(float(shap_value))
            counts[feature] += 1

    ranked = sorted(abs_sums.items(), key=lambda item: item[1], reverse=True)[:top_n]
    drivers = [
        {
            "feature": feature,
            "mean_shap": sums[feature] / counts[feature],
            "mean_abs_shap": abs_sums[feature] / counts[feature],
            "occurrence_count": counts[feature],
        }
        for feature, _ in ranked
    ]

    return {
        "drivers": drivers,
        "subscriber_count": len(rows),
    }


@router.get("/segment-matrix")
def get_segment_matrix(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Contract × tenure-bin matrix of average churn probability for cohort segmentation.
    """
    rows = filter_customers_by_scope(
        db.query(
            Customer.contract,
            Customer.tenure,
            Prediction.churn_probability,
        ).join(Prediction, Customer.id == Prediction.customer_id),
        auth,
    ).all()

    if not rows:
        return {
            "contracts": [],
            "tenure_bins": list(TENURE_BIN_LABELS),
            "matrix": [],
            "counts": [],
            "cells": [],
        }

    cell_probs: dict[tuple[str, str], list[float]] = defaultdict(list)
    contract_totals: dict[str, int] = defaultdict(int)

    for contract, tenure, churn_probability in rows:
        contract_label = contract or "Unknown"
        tenure_label = _tenure_bin_label(int(tenure or 0))
        cell_probs[(contract_label, tenure_label)].append(float(churn_probability))
        contract_totals[contract_label] += 1

    contracts = sorted(contract_totals.keys(), key=lambda c: contract_totals[c], reverse=True)
    tenure_bins = list(TENURE_BIN_LABELS)

    matrix: list[list[float | None]] = []
    counts: list[list[int]] = []
    cells = []

    for contract in contracts:
        prob_row: list[float | None] = []
        count_row: list[int] = []
        for tenure_bin in tenure_bins:
            values = cell_probs.get((contract, tenure_bin), [])
            count = len(values)
            avg_prob = sum(values) / count if count else None
            prob_row.append(avg_prob)
            count_row.append(count)
            if count:
                cells.append({
                    "contract": contract,
                    "tenure_bin": tenure_bin,
                    "avg_churn_probability": avg_prob,
                    "count": count,
                })
        matrix.append(prob_row)
        counts.append(count_row)

    return {
        "contracts": contracts,
        "tenure_bins": tenure_bins,
        "matrix": matrix,
        "counts": counts,
        "cells": cells,
    }

