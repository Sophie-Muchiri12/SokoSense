"""Auth request/response models (phone + password, role-based)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

UserRole = Literal["farmer", "sacco"]


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=9, max_length=20)
    password: str = Field(min_length=6, max_length=128)
    role: UserRole = "farmer"


class LoginRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=20)
    password: str = Field(min_length=1, max_length=128)


class AdminLoginRequest(BaseModel):
    pin: str = Field(min_length=7, max_length=7)


class UserOut(BaseModel):
    id: int | None = None
    name: str
    phone: str
    role: str
    created_at: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
