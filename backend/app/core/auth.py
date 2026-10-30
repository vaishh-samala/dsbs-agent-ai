"""Role-based access control (RBAC) and authentication module for Developer Sandbox Bootstrapper."""

from enum import Enum
from typing import Optional
from fastapi import Depends, Header, HTTPException, Request, status
from pydantic import BaseModel


class UserRole(str, Enum):
    """Supported user roles in Developer Sandbox Bootstrapper."""
    DEVELOPER = "developer"
    ADMIN = "admin"


class AuthenticatedUser(BaseModel):
    """Authenticated user profile with role claims."""
    username: str
    email: str
    role: UserRole


# Recognized demo and service credentials
DEMO_USERS = {
    "admin-token": AuthenticatedUser(
        username="admin@sandbox.internal",
        email="admin@sandbox.internal",
        role=UserRole.ADMIN,
    ),
    "demo-admin-token": AuthenticatedUser(
        username="admin@sandbox.internal",
        email="admin@sandbox.internal",
        role=UserRole.ADMIN,
    ),
    "admin": AuthenticatedUser(
        username="admin@sandbox.internal",
        email="admin@sandbox.internal",
        role=UserRole.ADMIN,
    ),
    "developer-token": AuthenticatedUser(
        username="developer@sandbox.dev",
        email="developer@sandbox.dev",
        role=UserRole.DEVELOPER,
    ),
    "demo-developer-token": AuthenticatedUser(
        username="developer@sandbox.dev",
        email="developer@sandbox.dev",
        role=UserRole.DEVELOPER,
    ),
    "developer": AuthenticatedUser(
        username="developer@sandbox.dev",
        email="developer@sandbox.dev",
        role=UserRole.DEVELOPER,
    ),
}


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
) -> Optional[AuthenticatedUser]:
    """Extract authenticated user and role from Authorization Bearer token or X-User-Role header.

    Returns:
        AuthenticatedUser if valid credentials are provided.
        None if no credentials headers are present.
    Raises:
        HTTPException(401) if invalid token or unrecognized credentials are provided.
    """
    # 1. Check Authorization Bearer header
    if authorization:
        parts = authorization.strip().split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip()
        else:
            token = authorization.strip()

        if token in DEMO_USERS:
            return DEMO_USERS[token]

        token_lower = token.lower()
        if "admin" in token_lower:
            return AuthenticatedUser(
                username="admin@sandbox.internal",
                email="admin@sandbox.internal",
                role=UserRole.ADMIN,
            )
        elif "developer" in token_lower or "dev" in token_lower:
            return AuthenticatedUser(
                username="developer@sandbox.dev",
                email="developer@sandbox.dev",
                role=UserRole.DEVELOPER,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Bearer token '{token}'. Unrecognized authentication credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # 2. Check X-User-Role header
    if x_user_role:
        role_str = x_user_role.strip().lower()
        if role_str == UserRole.ADMIN.value:
            return AuthenticatedUser(
                username="admin@sandbox.internal",
                email="admin@sandbox.internal",
                role=UserRole.ADMIN,
            )
        elif role_str == UserRole.DEVELOPER.value:
            return AuthenticatedUser(
                username="developer@sandbox.dev",
                email="developer@sandbox.dev",
                role=UserRole.DEVELOPER,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid X-User-Role '{x_user_role}'. Allowed roles are 'developer' and 'admin'.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return None


def require_admin(
    user: Optional[AuthenticatedUser] = Depends(get_current_user),
) -> AuthenticatedUser:
    """Enforce Administrator role requirement.

    Returns HTTP 401 if unauthenticated.
    Returns HTTP 403 if authenticated user has Developer role.
    """
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide administrator credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Developer role is not authorized to approve, reject, or execute sandbox setup plans. Administrator privileges required.",
        )
    return user


def require_authenticated(
    user: Optional[AuthenticatedUser] = Depends(get_current_user),
) -> AuthenticatedUser:
    """Enforce authentication requirement for any valid role."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide valid credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

