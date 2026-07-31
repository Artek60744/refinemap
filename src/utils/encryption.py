from __future__ import annotations

import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from src.config.settings import settings


class EncryptionService:
    def __init__(self, secret_key: str) -> None:
        derived = hashlib.sha256(secret_key.encode("utf-8")).digest()
        self._fernet = Fernet(base64.urlsafe_b64encode(derived))

    def encrypt(self, value: str) -> str:
        if not value:
            return value
        return self._fernet.encrypt(value.encode("utf-8")).decode("utf-8")

    def decrypt(self, value: str) -> Optional[str]:
        if not value:
            return value
        try:
            return self._fernet.decrypt(value.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            return None
        except Exception:
            return None


_service: EncryptionService | None = None


def get_encryption_service() -> EncryptionService:
    global _service
    if _service is None:
        _service = EncryptionService(settings.secret_key or "refinement-dev-key")
    return _service


def encrypt_value(value: str) -> str:
    return get_encryption_service().encrypt(value)


def decrypt_value(value: str) -> Optional[str]:
    return get_encryption_service().decrypt(value)
