from sqlalchemy import Column, Integer, String, Float, ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import relationship
from app.database.base import Base


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        CheckConstraint("monthly_charges >= 0.0", name="ck_customer_monthly_charges"),
        CheckConstraint("senior_citizen IN (0, 1)", name="ck_customer_senior_citizen"),
        CheckConstraint("total_charges >= 0.0", name="ck_customer_total_charges"),
        Index("ix_customers_upload_id", "upload_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String(50), unique=True, index=True, nullable=False)

    # Demographics
    gender = Column(String(20), nullable=False)
    senior_citizen = Column(Integer, nullable=False)  # 0 or 1
    partner = Column(String(20), nullable=False)          # Yes or No
    dependents = Column(String(20), nullable=False)       # Yes or No

    # Services
    tenure = Column(Integer, nullable=False)
    phone_service = Column(String(20), nullable=False)    # Yes or No
    multiple_lines = Column(String(50), nullable=False)   # Yes, No, No phone service
    internet_service = Column(String(50), nullable=False) # DSL, Fiber optic, No
    online_security = Column(String(50), nullable=False)  # Yes, No, No internet service
    online_backup = Column(String(50), nullable=False)    # Yes, No, No internet service
    device_protection = Column(String(50), nullable=False) # Yes, No, No internet service
    tech_support = Column(String(50), nullable=False)     # Yes, No, No internet service
    streaming_tv = Column(String(50), nullable=False)     # Yes, No, No internet service
    streaming_movies = Column(String(50), nullable=False) # Yes, No, No internet service

    # Contract / Billing
    contract = Column(String(50), nullable=False, index=True)         # Month-to-month, One year, Two year
    paperless_billing = Column(String(20), nullable=False) # Yes or No
    payment_method = Column(String(100), nullable=False)    # Electronic check, Mailed check, Bank transfer, Credit card
    monthly_charges = Column(Float, nullable=False)
    total_charges = Column(Float, nullable=False)

    # True historical label (nullable if uploading fresh/unlabeled records)
    churn = Column(String(20), nullable=True, index=True)             # Yes or No

    # Foreign key referencing parent upload batch
    upload_id = Column(Integer, ForeignKey("uploads.id", ondelete="CASCADE"), nullable=False)

    # Relationships
    upload = relationship("Upload", back_populates="customers")
    prediction = relationship("Prediction", back_populates="customer", uselist=False, cascade="all, delete-orphan")
