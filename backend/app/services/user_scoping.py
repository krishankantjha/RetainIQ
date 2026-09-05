"""Helpers for per-user upload and cohort data isolation."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Query, Session

from app.core.config import settings
from app.database.models.customer import Customer
from app.database.models.prediction import Prediction
from app.database.models.uploads import Upload
from app.database.models.user import User
from app.database.session import get_db
from app.schemas.auth import TokenData
from app.services.auth_service import oauth2_scheme


@dataclass(frozen=True)
class AuthContext:
    username: str
    user_id: int | None  # None = admin (sees all uploads)


def get_auth_context(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    """Validate JWT and return username plus DB user id (None for admin)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except (JWTError, ValidationError):
        raise credentials_exception

    if token_data.username == settings.ADMIN_USERNAME:
        return AuthContext(username=token_data.username, user_id=None)

    try:
        user = db.query(User).filter(User.username == token_data.username).first()
        if not user:
            raise credentials_exception
        token_version = payload.get("tv", 0)
        if int(token_version) != int(user.token_version or 0):
            raise credentials_exception
        return AuthContext(username=user.username, user_id=user.id)
    except SQLAlchemyError:
        raise credentials_exception


def scoped_uploads_query(db: Session, auth: AuthContext) -> Query:
    query = db.query(Upload)
    if auth.user_id is not None:
        query = query.filter(Upload.user_id == auth.user_id)
    return query


def get_upload_for_user(db: Session, upload_id: int, auth: AuthContext) -> Upload | None:
    return scoped_uploads_query(db, auth).filter(Upload.id == upload_id).first()


def filter_customers_by_scope(query: Query, auth: AuthContext) -> Query:
    query = query.join(Upload, Customer.upload_id == Upload.id)
    if auth.user_id is not None:
        query = query.filter(Upload.user_id == auth.user_id)
    return query


def filter_predictions_by_scope(query: Query, auth: AuthContext) -> Query:
    query = (
        query.join(Customer, Prediction.customer_id == Customer.id)
        .join(Upload, Customer.upload_id == Upload.id)
    )
    if auth.user_id is not None:
        query = query.filter(Upload.user_id == auth.user_id)
    return query


def get_customer_for_user(
    db: Session,
    customer_id: str,
    auth: AuthContext,
) -> Customer | None:
    query = db.query(Customer).filter(Customer.customer_id == customer_id)
    return filter_customers_by_scope(query, auth).first()
