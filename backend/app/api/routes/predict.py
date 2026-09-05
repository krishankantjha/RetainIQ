import io
import logging
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.config import settings
from app.database.models.uploads import Upload
from app.database.models.customer import Customer
from app.services.user_scoping import (
    AuthContext,
    filter_customers_by_scope,
    get_auth_context,
    get_customer_for_user,
    get_upload_for_user,
    scoped_uploads_query,
)
from app.services.prediction_service import batch_predict_and_explain, score_single_customer
from app.services.customer_mapper import (
    customer_to_ml_record,
    merge_simulation_request,
    simulation_edits_from_records,
)
from app.constants.cohort_personas import get_cohort_persona_name
from app.schemas.prediction import CustomerExplainResponse, SimulateRequest

logger = logging.getLogger("backend.app.api.routes.predict")

router = APIRouter(tags=["predict"])


def _serialize_upload(upload: Upload) -> dict:
    return {
        "upload_id": upload.id,
        "filename": upload.filename,
        "status": upload.status,
        "row_count": upload.row_count or 0,
        "decision_threshold": upload.decision_threshold,
        "error_message": upload.error_message,
        "uploaded_at": upload.uploaded_at.isoformat() if upload.uploaded_at else None,
    }


def _build_customer_explain_response(
    customer: Customer,
    prediction,
    *,
    customer_dict: dict | None = None,
    simulations: list | None = None,
) -> CustomerExplainResponse:
    persona_name = get_cohort_persona_name(prediction.cluster)
    return CustomerExplainResponse(
        customer_id=customer.customer_id,
        gender=customer.gender,
        tenure=customer.tenure,
        monthly_charges=customer.monthly_charges,
        total_charges=customer.total_charges or 0.0,
        churn_probability=prediction.churn_probability,
        is_high_risk=prediction.is_high_risk,
        top_drivers=prediction.top_drivers,
        save_plays=prediction.save_plays,
        cluster=prediction.cluster,
        cohort_persona=persona_name,
        segmentation={
            "cluster_id": prediction.cluster,
            "persona": persona_name,
        } if prediction.cluster is not None else None,
        simulations=simulations,
        customer_features=customer_dict,
        predicted_at=prediction.predicted_at,
    )


def process_upload_task(upload_id: int, file_bytes: bytes, threshold: float = None):
    """Background task to process the uploaded CSV file and run predictions."""
    # Obtain a fresh database session inside the background thread
    from app.database.session import SessionLocal
    db = SessionLocal()
    try:
        # Get upload record
        upload = db.query(Upload).filter(Upload.id == upload_id).first()
        if not upload:
            logger.error(f"Upload record not found: {upload_id}")
            return
            
        upload.status = "processing"
        if threshold is not None:
            upload.decision_threshold = threshold
        db.commit()
        
        # Load CSV into pandas DataFrame with encoding fallbacks to prevent decode failures
        df = None
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding=encoding)
                break
            except (UnicodeDecodeError, ValueError):
                continue
                
        if df is None:
            raise ValueError("CSV Decoding Error: Failed to parse character encoding (tried UTF-8, Latin-1, CP1252)")
        
        # Run predictions and save
        row_count = batch_predict_and_explain(df, db, upload_id, threshold=threshold)
        
        # Update upload record on success
        upload.status = "completed"
        upload.row_count = row_count
        db.commit()
        logger.info(f"Background upload task completed successfully for upload ID {upload_id}")
    except Exception as e:
        db.rollback()
        logger.exception(f"Background upload task failed for upload ID {upload_id}: {e}")
        try:
            # Re-fetch upload to record failure
            upload = db.query(Upload).filter(Upload.id == upload_id).first()
            if upload:
                upload.status = "failed"
                # Map technical db errors to user-friendly messages
                error_str = str(e)
                if "UNIQUE constraint" in error_str or "duplicate key" in error_str:
                    upload.error_message = "Integrity Constraint Error: Dataset contains duplicate customer IDs already present in the database."
                else:
                    upload.error_message = error_str[:500]
                db.commit()
        except Exception as inner_err:
            logger.error(f"Failed to record upload failure state: {inner_err}")
    finally:
        db.close()
 
 
@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    threshold: float | None = Query(None, ge=0.01, le=0.99, description="High-risk decision threshold"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Upload a customer churn dataset CSV.
    Processing runs asynchronously in the background.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only CSV files are supported."
        )
        
    try:
        file_bytes = await file.read()
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if len(file_bytes) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum upload size of {settings.MAX_UPLOAD_SIZE_MB} MB."
            )

        # Initialize upload record in database
        upload = Upload(
            filename=file.filename,
            status="pending",
            decision_threshold=threshold,
            user_id=auth.user_id,
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
        
        # Trigger background processing
        background_tasks.add_task(process_upload_task, upload.id, file_bytes, threshold)
        
        return {
            "upload_id": upload.id,
            "filename": upload.filename,
            "status": upload.status,
            "decision_threshold": upload.decision_threshold,
            "message": "File upload accepted. Processing in progress."
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception(f"File upload initialization failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize file upload."
        )


@router.get("/customers/{customer_id}/explain", response_model=CustomerExplainResponse)
def get_customer_explain(
    customer_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Retrieve churn predictions, SHAP drivers, and Save Plays for a specific customer.
    """
    customer = get_customer_for_user(db, customer_id, auth)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found."
        )
        
    prediction = customer.prediction
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No churn prediction found for customer {customer_id}."
        )

    from app.services.prediction_service import load_artifacts
    from ml.explainability.shap_local import LocalExplainer

    customer_dict = None
    simulations = []
    try:
        model_obj, preprocessor_obj, encoders_meta, metadata, explainer_obj, _ = load_artifacts()
        local_explainer = LocalExplainer(
            model_obj,
            metadata["feature_names_in"],
            explainer=explainer_obj,
            preprocessor=preprocessor_obj,
            encoders=encoders_meta,
            metadata=metadata,
        )

        customer_dict = customer_to_ml_record(customer)
        customer_df = pd.DataFrame([customer_dict])
        simulations = local_explainer.run_simulations(customer_df)
    except Exception as e:
        logger.error(f"Failed to generate counterfactual simulations for customer {customer_id}: {e}", exc_info=True)

    return _build_customer_explain_response(
        customer,
        prediction,
        customer_dict=customer_dict,
        simulations=simulations,
    )


@router.post("/predict/score", response_model=CustomerExplainResponse)
def score_customer(
    request: SimulateRequest,
    threshold: float | None = Query(None, ge=0.01, le=0.99, description="High-risk decision threshold"),
    replace_existing: bool = Query(True, description="Replace an existing scored subscriber with the same ID"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Score a single subscriber from IBM Telco feature inputs and persist the result.
    """
    if not request.customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="customerID is required for single-customer scoring",
        )

    try:
        customer, prediction = score_single_customer(
            request.to_ml_record(),
            db,
            threshold=threshold,
            replace_existing=replace_existing,
            user_id=auth.user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Single-customer scoring failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scoring error: {str(e)}",
        ) from e

    from app.services.prediction_service import load_artifacts
    from ml.explainability.shap_local import LocalExplainer

    customer_dict = customer_to_ml_record(customer)
    simulations: list = []
    try:
        model_obj, preprocessor_obj, encoders_meta, metadata, explainer_obj, _ = load_artifacts()
        local_explainer = LocalExplainer(
            model_obj,
            metadata["feature_names_in"],
            explainer=explainer_obj,
            preprocessor=preprocessor_obj,
            encoders=encoders_meta,
            metadata=metadata,
        )
        simulations = local_explainer.run_simulations(pd.DataFrame([customer_dict]))
    except Exception as e:
        logger.error(f"Failed to generate counterfactual simulations after scoring: {e}", exc_info=True)

    return _build_customer_explain_response(
        customer,
        prediction,
        customer_dict=customer_dict,
        simulations=simulations,
    )


@router.post("/predict/simulate")
def simulate_prediction(
    request: SimulateRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Run a single live counterfactual simulation for edited customer inputs.
    """
    from app.services.prediction_service import load_artifacts
    from ml.explainability.shap_local import LocalExplainer

    try:
        model_obj, preprocessor_obj, encoders_meta, metadata, explainer_obj, _ = load_artifacts()
        local_explainer = LocalExplainer(
            model_obj,
            metadata["feature_names_in"],
            explainer=explainer_obj,
            preprocessor=preprocessor_obj,
            encoders=encoders_meta,
            metadata=metadata,
        )

        simulated_record = request.to_ml_record()
        fields_set = set(request.model_fields_set)

        customer = None
        if request.customer_id:
            customer = get_customer_for_user(db, request.customer_id, auth)

        if customer:
            baseline_record = customer_to_ml_record(customer)
            _, edits = merge_simulation_request(
                baseline_record, simulated_record, fields_set
            )
        else:
            baseline_record = simulated_record
            edits = simulation_edits_from_records(baseline_record, simulated_record)

        customer_df = pd.DataFrame([baseline_record])
        sim_prob = local_explainer.simulate_intervention(customer_df, edits)
        return {"simulated_probability": sim_prob}
    except Exception as e:
        logger.error(f"Failed live counterfactual simulation prediction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation error: {str(e)}"
        )


@router.get("/uploads")
def list_uploads(
    limit: int = Query(20, ge=1, le=100, description="Maximum uploads to return"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    List recent CSV upload jobs and their processing status.
    """
    uploads = (
        scoped_uploads_query(db, auth)
        .order_by(Upload.uploaded_at.desc())
        .limit(limit)
        .all()
    )
    return [
        _serialize_upload(upload)
        for upload in uploads
    ]


@router.get("/uploads/{upload_id}/status")
def get_upload_status(
    upload_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Query the database uploads table to check processing state.
    """
    upload = get_upload_for_user(db, upload_id, auth)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with ID {upload_id} not found."
        )
    return _serialize_upload(upload)


@router.get("/customers/search")
def search_customers(
    q: str = "",
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Search customer IDs matching a prefix query for autocomplete.
    """
    if not q:
        return []
    results = (
        filter_customers_by_scope(db.query(Customer.customer_id), auth)
        .filter(Customer.customer_id.like(f"{q}%"))
        .limit(15)
        .all()
    )
    return [r[0] for r in results]


