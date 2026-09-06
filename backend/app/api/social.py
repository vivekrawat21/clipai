import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.social_account import SocialAccount
from app.schemas.social import SocialAccountResponse
from app.services.social.oauth import (
    OAuthExchangeError,
    PlatformConfigError,
    build_instagram_auth_url,
    build_youtube_auth_url,
    exchange_instagram_code,
    exchange_youtube_code,
    get_instagram_account_info,
    get_youtube_account_info,
)
from app.services.secrets import encrypt_secret


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/api/social",
    tags=["Social"],
)


_DEFAULT_USER_ID = "default"


def _to_response(
    account: SocialAccount,
    display_name: str | None = None,
) -> SocialAccountResponse:
    return SocialAccountResponse(
        id=account.id,
        platform=account.platform,
        external_account_id=account.external_account_id,
        display_name=display_name,
        token_expires_at=account.token_expires_at,
        is_active=account.is_active,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )


async def _parse_metadata(account: SocialAccount) -> dict:
    import json

    if not account.metadata_:
        return {}

    try:
        return json.loads(account.metadata_)
    except (TypeError, ValueError):
        return {}


@router.get(
    "/accounts",
    response_model=list[SocialAccountResponse],
)
async def list_accounts(
    user_id: str = _DEFAULT_USER_ID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SocialAccount)
        .where(
            SocialAccount.user_id == user_id
        )
        .order_by(
            SocialAccount.platform.asc()
        )
    )

    accounts_raw = result.scalars().all()

    accounts = []

    for account in accounts_raw:
        meta = await _parse_metadata(account)
        display_name = (
            meta.get("username")
            or meta.get("channel_name")
            or account.external_account_id
        )
        accounts.append(_to_response(account, display_name))

    return accounts


@router.get(
    "/{platform}/auth-url",
)
async def get_auth_url(
    platform: str,
):
    if platform == "instagram":
        try:
            return {
                "auth_url": build_instagram_auth_url(),
            }
        except PlatformConfigError as exc:
            raise HTTPException(
                status_code=500,
                detail=str(exc),
            )

    if platform == "youtube":
        try:
            return {
                "auth_url": build_youtube_auth_url(),
            }
        except PlatformConfigError as exc:
            raise HTTPException(
                status_code=500,
                detail=str(exc),
            )

    raise HTTPException(
        status_code=404,
        detail=f"Unsupported platform: {platform}",
    )


@router.get(
    "/{platform}/callback",
)
async def oauth_callback(
    platform: str,
    code: str,
    db: AsyncSession = Depends(get_db),
):
    if platform == "instagram":
        return await _handle_instagram_callback(code, db)

    if platform == "youtube":
        return await _handle_youtube_callback(code, db)

    raise HTTPException(
        status_code=404,
        detail=f"Unsupported platform: {platform}",
    )


async def _handle_instagram_callback(
    code: str,
    db: AsyncSession,
):
    try:
        exchanged = await exchange_instagram_code(code)
    except (OAuthExchangeError, PlatformConfigError) as exc:
        logger.exception("Instagram OAuth callback failed")
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    access_token = exchanged.get("access_token", "")
    ig_user_id = exchanged.get("external_account_id", "")

    metadata = dict(exchanged.get("metadata") or {})

    if access_token and ig_user_id:
        try:
            info = await get_instagram_account_info(
                access_token,
                ig_user_id,
            )
            metadata["username"] = info.get("username", "")
            metadata["account_type"] = info.get("account_type", "")
        except Exception:
            logger.exception(
                "Failed to fetch Instagram account info"
            )

    account = await _upsert_account(
        db,
        platform="instagram",
        external_id=ig_user_id,
        access_token=access_token,
        refresh_token=exchanged.get("refresh_token") or "",
        token_expires_at=exchanged.get("token_expires_at"),
        metadata=metadata,
    )

    return {
        "connected": True,
        "platform": "instagram",
        "account_id": account.id,
        "external_account_id": account.external_account_id,
        "display_name": metadata.get("username"),
    }


async def _handle_youtube_callback(
    code: str,
    db: AsyncSession,
):
    try:
        exchanged = await exchange_youtube_code(code)
    except (OAuthExchangeError, PlatformConfigError) as exc:
        logger.exception("YouTube OAuth callback failed")
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    access_token = exchanged.get("access_token", "")

    metadata = {}

    if access_token:
        try:
            info = await get_youtube_account_info(access_token)
            metadata.update(info)
        except Exception:
            logger.exception(
                "Failed to fetch YouTube account info"
            )

    channel_id = metadata.get("channel_id") or ""

    account = await _upsert_account(
        db,
        platform="youtube",
        external_id=channel_id,
        access_token=access_token,
        refresh_token=exchanged.get("refresh_token") or "",
        token_expires_at=exchanged.get("token_expires_at"),
        metadata=metadata,
    )

    return {
        "connected": True,
        "platform": "youtube",
        "account_id": account.id,
        "external_account_id": account.external_account_id,
        "display_name": metadata.get("channel_name"),
    }


async def _upsert_account(
    db: AsyncSession,
    *,
    platform: str,
    external_id: str,
    access_token: str,
    refresh_token: str,
    token_expires_at,
    metadata: dict,
):
    import json

    result = await db.execute(
        select(SocialAccount)
        .where(
            SocialAccount.user_id == _DEFAULT_USER_ID,
            SocialAccount.platform == platform,
            SocialAccount.external_account_id == external_id,
        )
    )

    account = result.scalar_one_or_none()

    if account is None:
        account = SocialAccount(
            user_id=_DEFAULT_USER_ID,
            platform=platform,
            external_account_id=external_id,
        )
        db.add(account)

    account.access_token_encrypted = encrypt_secret(access_token)
    account.refresh_token_encrypted = encrypt_secret(refresh_token)
    account.token_expires_at = token_expires_at
    account.metadata_ = json.dumps(metadata)
    account.is_active = True

    await db.commit()
    await db.refresh(account)

    return account