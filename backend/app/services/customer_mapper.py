"""Maps Customer ORM records to ML pipeline input dictionaries."""

from typing import Any, Iterable, Optional

import pandas as pd

from app.database.models.customer import Customer

# SimulateRequest field names (snake_case + common JSON aliases) → ML record columns.
SIMULATION_FIELD_TO_ML_KEY: dict[str, str] = {
    "customer_id": "customerID",
    "customerID": "customerID",
    "gender": "gender",
    "senior_citizen": "SeniorCitizen",
    "SeniorCitizen": "SeniorCitizen",
    "partner": "Partner",
    "Partner": "Partner",
    "dependents": "Dependents",
    "Dependents": "Dependents",
    "tenure": "tenure",
    "phone_service": "PhoneService",
    "PhoneService": "PhoneService",
    "multiple_lines": "MultipleLines",
    "MultipleLines": "MultipleLines",
    "internet_service": "InternetService",
    "InternetService": "InternetService",
    "online_security": "OnlineSecurity",
    "OnlineSecurity": "OnlineSecurity",
    "online_backup": "OnlineBackup",
    "OnlineBackup": "OnlineBackup",
    "device_protection": "DeviceProtection",
    "DeviceProtection": "DeviceProtection",
    "tech_support": "TechSupport",
    "TechSupport": "TechSupport",
    "streaming_tv": "StreamingTV",
    "StreamingTV": "StreamingTV",
    "streaming_movies": "StreamingMovies",
    "StreamingMovies": "StreamingMovies",
    "contract": "Contract",
    "Contract": "Contract",
    "paperless_billing": "PaperlessBilling",
    "PaperlessBilling": "PaperlessBilling",
    "payment_method": "PaymentMethod",
    "PaymentMethod": "PaymentMethod",
    "monthly_charges": "MonthlyCharges",
    "MonthlyCharges": "MonthlyCharges",
    "total_charges": "TotalCharges",
    "TotalCharges": "TotalCharges",
    "churn": "Churn",
    "Churn": "Churn",
}


def simulation_edits_from_records(
    baseline: dict[str, Any],
    simulated: dict[str, Any],
    *,
    changed_ml_keys: Iterable[str] | None = None,
) -> dict[str, Any]:
    """Return ML-column edits that differ between baseline and simulated records."""
    keys = changed_ml_keys if changed_ml_keys is not None else simulated.keys()
    return {
        key: simulated[key]
        for key in keys
        if key in simulated and baseline.get(key) != simulated[key]
    }


def merge_simulation_request(
    baseline: dict[str, Any],
    simulated: dict[str, Any],
    fields_set: set[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Apply only explicitly provided simulation fields onto a baseline record.

    Returns the merged record and the edit dict expected by simulate_intervention.
    """
    merged = dict(baseline)
    changed_keys: list[str] = []
    for field_name in fields_set:
        ml_key = SIMULATION_FIELD_TO_ML_KEY.get(field_name)
        if ml_key is None:
            continue
        merged[ml_key] = simulated[ml_key]
        changed_keys.append(ml_key)
    edits = simulation_edits_from_records(baseline, merged, changed_ml_keys=changed_keys)
    return merged, edits


def customer_to_ml_record(customer: Customer) -> dict[str, Any]:
    """Convert a Customer model instance to the feature dict expected by the ML pipeline."""
    return {
        "customerID": customer.customer_id,
        "gender": customer.gender,
        "SeniorCitizen": customer.senior_citizen,
        "Partner": customer.partner,
        "Dependents": customer.dependents,
        "tenure": customer.tenure,
        "PhoneService": customer.phone_service,
        "MultipleLines": customer.multiple_lines,
        "InternetService": customer.internet_service,
        "OnlineSecurity": customer.online_security,
        "OnlineBackup": customer.online_backup,
        "DeviceProtection": customer.device_protection,
        "TechSupport": customer.tech_support,
        "StreamingTV": customer.streaming_tv,
        "StreamingMovies": customer.streaming_movies,
        "Contract": customer.contract,
        "PaperlessBilling": customer.paperless_billing,
        "PaymentMethod": customer.payment_method,
        "MonthlyCharges": customer.monthly_charges,
        "TotalCharges": customer.total_charges or 0.0,
        "Churn": customer.churn,
    }


def simulation_input_to_ml_record(
    *,
    customer_id: Optional[str] = None,
    gender: Optional[str] = None,
    senior_citizen: Optional[int] = None,
    partner: Optional[str] = None,
    dependents: Optional[str] = None,
    tenure: Optional[int] = None,
    phone_service: Optional[str] = None,
    multiple_lines: Optional[str] = None,
    internet_service: Optional[str] = None,
    online_security: Optional[str] = None,
    online_backup: Optional[str] = None,
    device_protection: Optional[str] = None,
    tech_support: Optional[str] = None,
    streaming_tv: Optional[str] = None,
    streaming_movies: Optional[str] = None,
    contract: Optional[str] = None,
    paperless_billing: Optional[str] = None,
    payment_method: Optional[str] = None,
    monthly_charges: Optional[float] = None,
    total_charges: Optional[float] = None,
    churn: Optional[str] = None,
) -> dict[str, Any]:
    """Build an ML pipeline input dict from counterfactual simulation parameters."""
    return {
        "customerID": customer_id or "SIM",
        "gender": gender or "Male",
        "SeniorCitizen": senior_citizen if senior_citizen is not None else 0,
        "Partner": partner or "No",
        "Dependents": dependents or "No",
        "tenure": tenure if tenure is not None else 0,
        "PhoneService": phone_service or "Yes",
        "MultipleLines": multiple_lines or "No",
        "InternetService": internet_service or "No",
        "OnlineSecurity": online_security or "No",
        "OnlineBackup": online_backup or "No",
        "DeviceProtection": device_protection or "No",
        "TechSupport": tech_support or "No",
        "StreamingTV": streaming_tv or "No",
        "StreamingMovies": streaming_movies or "No",
        "Contract": contract or "Month-to-month",
        "PaperlessBilling": paperless_billing or "No",
        "PaymentMethod": payment_method or "Mailed check",
        "MonthlyCharges": monthly_charges if monthly_charges is not None else 0.0,
        "TotalCharges": total_charges if total_charges is not None else 0.0,
        "Churn": churn or "No",
    }


def customers_from_upload_dataframe(
    df: pd.DataFrame,
    original_churns: list[Optional[str]],
    upload_id: int,
) -> list[Customer]:
    """Build Customer ORM rows from a cleaned upload frame without iterrows."""
    return [
        Customer(
            customer_id=str(cid),
            gender=str(gender),
            senior_citizen=int(sc),
            partner=str(partner),
            dependents=str(deps),
            tenure=int(tenure),
            phone_service=str(phone),
            multiple_lines=str(mlines),
            internet_service=str(inet),
            online_security=str(osec),
            online_backup=str(oback),
            device_protection=str(dprot),
            tech_support=str(tsup),
            streaming_tv=str(stv),
            streaming_movies=str(smov),
            contract=str(contract),
            paperless_billing=str(pb),
            payment_method=str(pm),
            monthly_charges=float(mc),
            total_charges=float(tc),
            churn=churn,
            upload_id=upload_id,
        )
        for cid, gender, sc, partner, deps, tenure, phone, mlines, inet, osec, oback, dprot, tsup, stv, smov, contract, pb, pm, mc, tc, churn in zip(
            df["customerID"],
            df["gender"],
            df["SeniorCitizen"],
            df["Partner"],
            df["Dependents"],
            df["tenure"],
            df["PhoneService"],
            df["MultipleLines"],
            df["InternetService"],
            df["OnlineSecurity"],
            df["OnlineBackup"],
            df["DeviceProtection"],
            df["TechSupport"],
            df["StreamingTV"],
            df["StreamingMovies"],
            df["Contract"],
            df["PaperlessBilling"],
            df["PaymentMethod"],
            df["MonthlyCharges"],
            df["TotalCharges"],
            original_churns,
        )
    ]
