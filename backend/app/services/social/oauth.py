"""
OAuth service for social platform account connection.

Implements the official OAuth 2.0 flows only — no browser automation,
no password-based login.

    Instagram (Instagram Login for Business, 2026 requirements):
        scope: instagram_business_basic, instagram_business_content_publish
        auth host: https://api.instagram.com/oauth/authorize
        token host: https://api.instagram.com/oauth/access_token
        long-lived exchange: https://graph.instagram.com/access_token

    YouTube (YouTube Data API v3):
        scope: https://www.googleapis.com/auth/youtube.upload (offline)
        auth host: https://accounts.google.com/o/oauth2/v2/auth
        token host: https://oauth2.googleapis.com/token
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

import requests

from app.core.config import settings


logger = logging.getLogger(__name__)


INSTAGRAM_AUTH_URL = "https://api.instagram.com/oauth/authorize"
INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
INSTAGRAM_GRAPH_URL = "https://graph.instagram.com"

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload"
YOUTUBE_PROFILE_SCOPE = "https://www.googleapis.com/auth/userinfo.profile"


class PlatformConfigError(Exception):
    """Raised when OAuth client credentials are not configured."""


class OAuthExchangeError(Exception):
    """Raised when a token exchange fails."""


def _redirect_uri(platform: str) -> str:
    return (
        f"{settings.SOCIAL_CALLBACK_BASE_URL.rstrip('/')}/api/social/"
        f"{platform}/callback"
    )


def build_instagram_auth_url() -> str:
    client_id = settings.INSTAGRAM_CLIENT_ID.strip()

    if not client_id:
        raise PlatformConfigError(
            "INSTAGRAM_CLIENT_ID is not configured"
        )

    params = {
        "client_id": client_id,
        "redirect_uri": _redirect_uri("instagram"),
        "response_type": "code",
        "scope": (
            "instagram_business_basic,"
            "instagram_business_content_publish"
        ),
        "state": "clipai",
    }

    return f"{INSTAGRAM_AUTH_URL}?{urlencode(params)}"


def build_youtube_auth_url() -> str:
    client_id = settings.YOUTUBE_CLIENT_ID.strip()

    if not client_id:
        raise PlatformConfigError(
            "YOUTUBE_CLIENT_ID is not configured"
        )

    params = {
        "client_id": client_id,
        "redirect_uri": _redirect_uri("youtube"),
        "response_type": "code",
        "scope": f"{YOUTUBE_UPLOAD_SCOPE} {YOUTUBE_PROFILE_SCOPE}",
        "access_type": "offline",
        "prompt": "consent",
        "state": "clipai",
    }

    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_instagram_code(
    code: str,
) -> dict[str, Any]:
    client_id = settings.INSTAGRAM_CLIENT_ID.strip()
    client_secret = settings.INSTAGRAM_CLIENT_SECRET.strip()

    if not client_id or not client_secret:
        raise PlatformConfigError(
            "INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET "
            "are not configured"
        )

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            INSTAGRAM_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "authorization_code",
                "redirect_uri": _redirect_uri("instagram"),
                "code": code,
            },
        )

        if response.status_code != 200:
            logger.error(
                "Instagram token exchange failed: "
                "status=%s body=%s",
                response.status_code,
                response.text,
            )
            raise OAuthExchangeError(
                f"Instagram token exchange failed: {response.text}"
            )

        data = response.json()

    access_token = data.get("access_token")
    user_id = data.get("user_id")

    token_expires_at = None
    if data.get("expires_in"):
        token_expires_at = datetime.now(
            timezone.utc
        ) + timedelta(seconds=int(data["expires_in"]))

    # Exchange short-lived token for a long-lived one when available.
    refresh_token = data.get("refresh_token", "")
    return {
        "platform": "instagram",
        "external_account_id": str(user_id) if user_id else "",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_expires_at": token_expires_at,
        "metadata": {
            "username": data.get("username", ""),
        },
    }


async def exchange_youtube_code(
    code: str,
) -> dict[str, Any]:
    client_id = settings.YOUTUBE_CLIENT_ID.strip()
    client_secret = settings.YOUTUBE_CLIENT_SECRET.strip()

    if not client_id or not client_secret:
        raise PlatformConfigError(
            "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET "
            "are not configured"
        )

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": _redirect_uri("youtube"),
                "grant_type": "authorization_code",
            },
        )

        if response.status_code != 200:
            logger.error(
                "YouTube token exchange failed: "
                "status=%s body=%s",
                response.status_code,
                response.text,
            )
            raise OAuthExchangeError(
                f"YouTube token exchange failed: {response.text}"
            )

        data = response.json()

    token_expires_at = None
    if data.get("expires_in"):
        token_expires_at = datetime.now(
            timezone.utc
        ) + timedelta(seconds=int(data["expires_in"]))

    return {
        "platform": "youtube",
        "external_account_id": "",
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token", ""),
        "token_expires_at": token_expires_at,
        "metadata": {},
    }


async def get_instagram_account_info(
    access_token: str,
    ig_user_id: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{INSTAGRAM_GRAPH_URL}/{ig_user_id}",
            params={
                "fields": "id,username,account_type",
                "access_token": access_token,
            },
        )
        response.raise_for_status()
        return response.json()


async def get_youtube_account_info(
    access_token: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://www.googleapis.com/youtube/v3/channels",
            params={
                "part": "snippet,contentDetails",
                "mine": "true",
                "access_token": access_token,
            },
        )
        response.raise_for_status()

        data = response.json()
        items = data.get("items") or []

        if not items:
            return {}

        snippet = items[0].get("snippet", {})
        return {
            "channel_id": items[0].get("id"),
            "channel_name": snippet.get("title", ""),
            "thumbnails": snippet.get("thumbnails", {}),
        }


def refresh_youtube_access_token(
    refresh_token: str,
) -> dict[str, Any]:
    """Synchronous refresh (used from the sync Celery publisher)."""
    client_id = settings.YOUTUBE_CLIENT_ID.strip()
    client_secret = settings.YOUTUBE_CLIENT_SECRET.strip()

    if not client_id or not client_secret:
        raise PlatformConfigError(
            "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET "
            "are not configured"
        )

    try:
        response = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        raise OAuthExchangeError(
            f"YouTube token refresh request failed: {exc}"
        )

    if response.status_code != 200:
        logger.error(
            "YouTube token refresh failed: "
            "status=%s body=%s",
            response.status_code,
            response.text,
        )
        raise OAuthExchangeError(
            f"YouTube token refresh failed: {response.text}"
        )

    data = response.json()

    return data