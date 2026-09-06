from datetime import datetime

from pydantic import BaseModel


class SocialAccountResponse(BaseModel):
    id: int
    platform: str
    external_account_id: str | None = None
    display_name: str | None = None
    token_expires_at: datetime | None = None
    is_active: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None