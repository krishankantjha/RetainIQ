from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database.session import get_db
from app.database.models.user import User
from app.schemas.auth import Token, UserCreate, UserResponse, PasswordReset
from app.services.auth_service import authenticate_user
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
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_version = 0
    if user != settings.ADMIN_USERNAME:
        db_user = db.query(User).filter(User.username == user).first()
        if db_user:
            token_version = int(db_user.token_version or 0)

    access_token = create_access_token(subject=user, token_version=token_version)
    return {
        "access_token": access_token,
        "token_type": "bearer"
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
            detail="Username already registered"
        )

    try:
        existing_user = db.query(User).filter(User.username == user_in.username).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )

        hashed = get_password_hash(user_in.password)
        sec_ans_clean = user_in.security_answer.strip().lower()
        hashed_sec_ans = get_password_hash(sec_ans_clean)

        new_user = User(
            username=user_in.username,
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


@router.get("/security-question/{username}")
def get_security_question(username: str, db: Session = Depends(get_db)):
    """Fetch the security question registered by the user."""
    if username.lower() == settings.ADMIN_USERNAME.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to retrieve security question for this account."
        )

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.security_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to retrieve security question for this account."
        )

    return {"security_question": user.security_question}


@router.post("/reset-password")
def reset_password(reset_in: PasswordReset, db: Session = Depends(get_db)):
    """Verify the security question answer and update the password."""
    username = reset_in.username
    if username.lower() == settings.ADMIN_USERNAME.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to reset password for this account."
        )

    user = db.query(User).filter(User.username == username).first()
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
