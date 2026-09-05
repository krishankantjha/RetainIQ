from datetime import datetime, timezone
from sqlalchemy import Column, ForeignKey, Integer, String, Float, DateTime, CheckConstraint
from sqlalchemy.orm import relationship
from app.database.base import Base


class Upload(Base):
    __tablename__ = "uploads"
    __table_args__ = (
        CheckConstraint("row_count >= 0", name="ck_upload_row_count"),
        CheckConstraint("status IN ('pending', 'processing', 'completed', 'failed')", name="ck_upload_status")
    )

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending, processing, completed, failed
    row_count = Column(Integer, nullable=True)
    decision_threshold = Column(Float, nullable=True)
    error_message = Column(String(500), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    owner = relationship("User", back_populates="uploads")
    customers = relationship("Customer", back_populates="upload", cascade="all, delete-orphan")

