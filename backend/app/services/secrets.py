"""
Secret / sensitive-value helpers.

OAuth tokens are stored encrypted at rest using Fernet. When no explicit
encryption key is configured (development), a stable key is derived and
persisted locally so existing rows remain decryptable across restarts.
"""
import base64
import hashlib
import logging
from pathlib import Path

from cryptography.fernet import Fernet

from app.core.config import settings


logger = logging.getLogger(__name__)


_DERIVED_KEY_PATH = Path(".dev_fernet_key")


def _load_or_create_key() -> bytes:
    configured = settings.SOCIAL_TOKEN_ENCRYPTION_KEY.strip()

    if configured:
        return configured.encode()

    # Development fallback: derive + persist a stable key. This degrades
    # gracefully but a warning makes the security posture explicit.
    if _DERIVED_KEY_PATH.exists():
        return _DERIVED_KEY_PATH.read_bytes().strip()

    key = Fernet.generate_key()
    _DERIVED_KEY_PATH.write_bytes(key)

    logger.warning(
        "SOCIAL_TOKEN_ENCRYPTION_KEY not configured; using a "
        "development key stored at %s",
        _DERIVED_KEY_PATH,
    )

    return key


_fernet = Fernet(_load_or_create_key())


def encrypt_secret(value: str) -> str:
    """Encrypt a secret for storage."""
    if value is None:
        return ""
    return _fernet.encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    """Decrypt a stored secret."""
    if not value:
        return ""
    try:
        return _fernet.decrypt(value.encode()).decode()
    except Exception:
        logger.error("Failed to decrypt a stored secret", exc_info=True)
        return ""