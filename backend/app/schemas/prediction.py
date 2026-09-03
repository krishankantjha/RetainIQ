from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.services.customer_mapper import simulation_input_to_ml_record


class ShapDriver(BaseModel):
    feature: str = Field(..., description="The name of the feature driving the churn probability")
    shap_value: float = Field(..., description="The SHAP value indicating feature contribution")


class SavePlay(BaseModel):
    campaign: str = Field(..., description="Name of the retention campaign play")
    action: str = Field(..., description="Action items for the account manager or automated system")
    estimated_impact: float = Field(..., description="Expected impact score of the campaign play")


class SimulateRequest(BaseModel):
    """Validated input for live counterfactual churn simulations."""

    model_config = ConfigDict(populate_by_name=True)

    customer_id: Optional[str] = Field(None, alias="customerID")
    gender: Optional[str] = None
    senior_citizen: Optional[int] = Field(None, alias="SeniorCitizen")
    partner: Optional[str] = Field(None, alias="Partner")
    dependents: Optional[str] = Field(None, alias="Dependents")
    tenure: Optional[int] = None
    phone_service: Optional[str] = Field(None, alias="PhoneService")
    multiple_lines: Optional[str] = Field(None, alias="MultipleLines")
    internet_service: Optional[str] = Field(None, alias="InternetService")
    online_security: Optional[str] = Field(None, alias="OnlineSecurity")
    online_backup: Optional[str] = Field(None, alias="OnlineBackup")
    device_protection: Optional[str] = Field(None, alias="DeviceProtection")
    tech_support: Optional[str] = Field(None, alias="TechSupport")
    streaming_tv: Optional[str] = Field(None, alias="StreamingTV")
    streaming_movies: Optional[str] = Field(None, alias="StreamingMovies")
    contract: Optional[str] = Field(None, alias="Contract")
    paperless_billing: Optional[str] = Field(None, alias="PaperlessBilling")
    payment_method: Optional[str] = Field(None, alias="PaymentMethod")
    monthly_charges: Optional[float] = Field(None, alias="MonthlyCharges")
    total_charges: Optional[float] = Field(None, alias="TotalCharges")
    churn: Optional[str] = Field(None, alias="Churn")

    def to_ml_record(self) -> dict:
        return simulation_input_to_ml_record(
            customer_id=self.customer_id,
            gender=self.gender,
            senior_citizen=self.senior_citizen,
            partner=self.partner,
            dependents=self.dependents,
            tenure=self.tenure,
            phone_service=self.phone_service,
            multiple_lines=self.multiple_lines,
            internet_service=self.internet_service,
            online_security=self.online_security,
            online_backup=self.online_backup,
            device_protection=self.device_protection,
            tech_support=self.tech_support,
            streaming_tv=self.streaming_tv,
            streaming_movies=self.streaming_movies,
            contract=self.contract,
            paperless_billing=self.paperless_billing,
            payment_method=self.payment_method,
            monthly_charges=self.monthly_charges,
            total_charges=self.total_charges,
            churn=self.churn,
        )


class SegmentDetail(BaseModel):
    cluster_id: Optional[int] = Field(None, description="Behavioral customer cluster segment assignment")
    persona: Optional[str] = Field(None, description="Mapped customer cohort persona characteristics")


class SimulationDetail(BaseModel):
    intervention: str = Field(..., description="Prescriptive action campaign description")
    original_risk: float = Field(..., description="Original churn probability score")
    simulated_risk: float = Field(..., description="Simulated churn probability after intervention")
    risk_reduction: float = Field(..., description="Expected reduction in churn risk")


class CustomerExplainResponse(BaseModel):
    customer_id: str
    gender: str
    tenure: int
    monthly_charges: float
    total_charges: float
    churn_probability: float
    is_high_risk: bool
    top_drivers: List[ShapDriver]
    save_plays: List[SavePlay]
    cluster: Optional[int] = None
    cohort_persona: Optional[str] = None
    segmentation: Optional[SegmentDetail] = None
    simulations: Optional[List[SimulationDetail]] = None
    customer_features: Optional[dict] = None
    predicted_at: datetime

