from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class Token(BaseModel):
    access_token: str = Field(..., description="The JWT access token")
    token_type: str = Field(..., description="The type of token (e.g. bearer)")
    username: str = Field(..., description="Login identifier (email or admin username)")
    full_name: Optional[str] = Field(None, description="Display name for the authenticated user")


class TokenData(BaseModel):
    username: Optional[str] = Field(None, description="Email or admin id encoded in the JWT subject")


EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"


class UserCreate(BaseModel):
    username: str = Field(
        ...,
        min_length=5,
        max_length=50,
        pattern=EMAIL_PATTERN,
        description="User email address (stored as login identifier)",
    )
    full_name: str = Field(..., min_length=2, max_length=100, description="Display name")
    password: str = Field(..., min_length=6, description="Cleartext password")
    security_question: str = Field(..., description="Security question chosen by user")
    security_answer: str = Field(..., description="Security answer provided by user")


class PasswordReset(BaseModel):
    username: str = Field(
        ...,
        pattern=EMAIL_PATTERN,
        description="Email of the user requesting password reset",
    )
    security_answer: str = Field(..., description="Answer to their security question")
    new_password: str = Field(..., min_length=6, description="New password")


class PasswordChange(BaseModel):
    current_password: str = Field(..., min_length=6, description="Current account password")
    new_password: str = Field(..., min_length=6, description="New password")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: Optional[str] = None
    created_at: datetime


class UserProfile(BaseModel):
    username: str
    full_name: Optional[str] = None


class UserProfileUpdate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Display name shown in the app")
