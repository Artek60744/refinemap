from __future__ import annotations

from sqlalchemy.orm import Session

from src.models.app_settings import AppSetting


class SettingsRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_setting(self, key: str) -> AppSetting | None:
        return self.db.query(AppSetting).filter(AppSetting.key == key).first()

    def get(self, key: str) -> str | None:
        setting = self.get_setting(key)
        return setting.value if setting else None

    def set(
        self,
        *,
        key: str,
        value: str | None,
        category: str,
        description: str | None = None,
        is_encrypted: bool = False,
    ) -> AppSetting:
        setting = self.get_setting(key)
        if setting is None:
            setting = AppSetting(
                key=key,
                value=value,
                category=category,
                description=description,
                is_encrypted=is_encrypted,
            )
            self.db.add(setting)
        else:
            setting.value = value
            setting.category = category
            setting.description = description
            setting.is_encrypted = is_encrypted

        self.db.commit()
        self.db.refresh(setting)
        return setting

    def delete(self, key: str) -> bool:
        setting = self.get_setting(key)
        if setting is None:
            return False
        self.db.delete(setting)
        self.db.commit()
        return True
