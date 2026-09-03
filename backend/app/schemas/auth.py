from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class Token(BaseModel):
    access_token: str = Field(..., description="The JWT access token")
    token_type: str = Field(..., description="The type of token (e.g. bearer)")


class TokenData(BaseModel):
    username: Optional[str] = Field(None, description="Username encoded in the JWT token subject")


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    password: str = Field(..., min_length=6, description="Cleartext password")
    security_question: str = Field(..., description="Security question chosen by user")
    security_answer: str = Field(..., description="Security answer provided by user")


class PasswordReset(BaseModel):
    username: str = Field(..., description="Username of the user requesting password reset")
    security_answer: str = Field(..., description="Answer to their security question")
    new_password: str = Field(..., min_length=6, description="New password")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    created_at: datetime
