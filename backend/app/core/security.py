from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
import bcrypt
from jose import jwt
from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against the hashed version using bcrypt directly."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Generate a bcrypt hash of the password using bcrypt directly."""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    token_version: int = 0,
) -> str:
    """Generate a JWT access token for a subject (e.g. username)."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject), "tv": int(token_version)}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


class ArtifactValidationError(ValueError):
    """Exception raised when an ML artifact fails its integrity or validation checks."""
    pass


def calculate_file_sha256(filepath: str) -> str:
    """
    Computes the SHA-256 checksum of a file.
    """
    import hashlib
    import os
    
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Critical file not found for hash computation: {filepath}")
        
    sha256 = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
    except Exception as e:
        raise OSError(f"Failed to read file for hash computation at {filepath}: {e}")
        
    return sha256.hexdigest()


def verify_file_hash(filepath: str, expected_hash: str) -> None:
    """
    Computes the SHA-256 checksum of a file and raises ArtifactValidationError if there is a mismatch.
    """
    import os
    try:
        actual_hash = calculate_file_sha256(filepath)
    except (FileNotFoundError, OSError) as e:
        raise ArtifactValidationError(f"Failed to compute file hash: {e}")
        
    if actual_hash != expected_hash:
        raise ArtifactValidationError(
            f"Artifact integrity check failed for file: {os.path.basename(filepath)}. "
            f"Expected SHA-256: {expected_hash}, Actual: {actual_hash}"
        )

