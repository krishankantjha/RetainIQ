import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import verify_password
from app.database.models.user import User
from app.database.session import get_db
from app.schemas.auth import TokenData

logger = logging.getLogger("backend.app.services.auth_service")

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


def authenticate_user(db: Session, username: str, password: str) -> Optional[str]:
    """Authenticate a user using settings configurations or database profiles."""
    if username == settings.ADMIN_USERNAME and verify_password(password, settings.ADMIN_PASSWORD_HASH):
        return username

    try:
        user = db.query(User).filter(User.username == username).first()
        if user and verify_password(password, user.hashed_password):
            return username
    except SQLAlchemyError as e:
        logger.error(f"Database error during authentication: {e}")

    return None


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> str:
    """FastAPI dependency to extract and validate the JWT token, returning the username."""
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
        return token_data.username

    try:
        user = db.query(User).filter(User.username == token_data.username).first()
        if not user:
            raise credentials_exception
        token_version = payload.get("tv", 0)
        if int(token_version) != int(user.token_version or 0):
            raise credentials_exception
    except SQLAlchemyError as e:
        logger.error(f"Database error during token user validation: {e}")
        raise credentials_exception

    return token_data.username
