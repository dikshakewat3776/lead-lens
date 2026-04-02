import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from jose import jwt

from app.config import get_settings
from app.schemas import LoginRequest, Token

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_USER = "admin"
# Demo only — use a proper password store in production
DEMO_PASSWORD_SHA256 = hashlib.sha256(b"admin123").hexdigest()


@router.post("/token", response_model=Token)
async def login(body: LoginRequest) -> Token:
    got = hashlib.sha256(body.password.encode()).hexdigest()
    if body.username != DEMO_USER or got != DEMO_PASSWORD_SHA256:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    token = jwt.encode(
        {"sub": body.username, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return Token(access_token=token)
