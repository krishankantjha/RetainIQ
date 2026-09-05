from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database.session import get_db
from app.database.models.user import User
from app.schemas.auth import (
    Token,
    UserCreate,
    UserResponse,
    PasswordReset,
    PasswordChange,
    UserProfile,
    UserProfileUpdate,
)
from app.services.auth_service import authenticate_user, get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    OAuth2 compatible token login, retrieve a JWT access token for future requests.
    This endpoint supports interactive login in Swagger UI.
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_version = 0
    full_name: str | None = "Admin" if user == settings.ADMIN_USERNAME else None
    if user != settings.ADMIN_USERNAME:
        db_user = db.query(User).filter(User.username == user).first()
        if db_user:
            token_version = int(db_user.token_version or 0)
            full_name = db_user.full_name

    access_token = create_access_token(subject=user, token_version=token_version)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user,
        "full_name": full_name,
    }


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account with secure Bcrypt password hashing and security questions."""
    if not settings.ALLOW_USER_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User registration is disabled on this server."
        )

    if user_in.username.lower() == settings.ADMIN_USERNAME.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    email = user_in.username.strip().lower()

    try:
        existing_user = (
            db.query(User)
            .filter(func.lower(User.username) == email)
            .first()
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        hashed = get_password_hash(user_in.password)
        sec_ans_clean = user_in.security_answer.strip().lower()
        hashed_sec_ans = get_password_hash(sec_ans_clean)

        new_user = User(
            username=email,
            full_name=user_in.full_name.strip(),
            hashed_password=hashed,
            security_question=user_in.security_question,
            security_answer_hash=hashed_sec_ans
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database tables not found. Please run database migrations first."
        )


@router.get("/me", response_model=UserProfile)
def read_current_user(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the authenticated user's profile for UI display."""
    if current_user == settings.ADMIN_USERNAME:
        return UserProfile(username=current_user, full_name="Admin")

    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return UserProfile(username=user.username, full_name=user.full_name)


@router.patch("/me", response_model=UserProfile)
def update_current_user(
    profile_in: UserProfileUpdate,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the authenticated user's display profile."""
    full_name = profile_in.full_name.strip()

    if current_user == settings.ADMIN_USERNAME:
        return UserProfile(username=current_user, full_name=full_name)

    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.full_name = full_name
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile.",
        )

    return UserProfile(username=user.username, full_name=user.full_name)


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change password for the authenticated user after verifying the current password."""
    if current_user == settings.ADMIN_USERNAME:
        if not verify_password(payload.current_password, settings.ADMIN_PASSWORD_HASH):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin password cannot be changed in-app. Update ADMIN_PASSWORD_HASH in server config.",
        )

    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    user.hashed_password = get_password_hash(payload.new_password)
    user.token_version = int(user.token_version or 0) + 1
    try:
        db.add(user)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password.",
        )

    return {"success": True, "message": "Password updated. Please sign in again with your new password."}


@router.get("/security-question/{username}")
def get_security_question(username: str, db: Session = Depends(get_db)):
    """Fetch the security question registered by the user."""
    if username.lower() == settings.ADMIN_USERNAME.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to retrieve security question for this account."
        )

    user = (
        db.query(User)
        .filter(func.lower(User.username) == username.strip().lower())
        .first()
    )
    if not user or not user.security_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to retrieve security question for this account."
        )

    return {"security_question": user.security_question}


@router.post("/reset-password")
def reset_password(reset_in: PasswordReset, db: Session = Depends(get_db)):
    """Verify the security question answer and update the password."""
    username = reset_in.username.strip().lower()
    if username == settings.ADMIN_USERNAME.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to reset password for this account."
        )

    user = db.query(User).filter(func.lower(User.username) == username).first()
    if not user or not user.security_answer_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to reset password for this account."
        )

    ans_clean = reset_in.security_answer.strip().lower()
    if not verify_password(ans_clean, user.security_answer_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect answer to the security question."
        )

    user.hashed_password = get_password_hash(reset_in.new_password)
    user.token_version = int(user.token_version or 0) + 1
    try:
        db.add(user)
        db.commit()
        return {"success": True, "message": "Password reset successful. Please sign in with your new password."}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password in database."
        )
