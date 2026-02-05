"""Configuration management for RSS Reader backend."""

import os
from functools import lru_cache
from typing import Any, Dict, Tuple

import yaml
from pydantic import BaseModel
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)


class DatabaseConfig(BaseModel):
    """Database configuration."""

    path: str = "/data/rss-reader.db"


class LoggingConfig(BaseModel):
    """Logging configuration."""

    level: str = "INFO"
    format: str = "text"  # text or json


class SchedulerConfig(BaseModel):
    """Scheduler configuration."""

    feed_refresh_interval: int = 1800  # 30 minutes
    log_job_execution: bool = False


class Settings(BaseSettings):
    """Application settings with nested configuration sections.

    Priority order:
    1. Environment variables (e.g., DATABASE__PATH for database.path)
    2. .env file
    3. YAML config file (if CONFIG_FILE env var is set)
    4. Default values

    The app works with NO config file - just defaults.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )

    database: DatabaseConfig = DatabaseConfig()
    logging: LoggingConfig = LoggingConfig()
    scheduler: SchedulerConfig = SchedulerConfig()

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> Tuple[PydanticBaseSettingsSource, ...]:
        """Customize settings sources to add YAML config file support.

        Priority order (highest to lowest):
        1. Environment variables
        2. .env file
        3. YAML config file (optional)
        4. Default values
        """
        # Custom YAML config source
        yaml_settings = YamlConfigSettingsSource(settings_cls)

        return (
            env_settings,
            dotenv_settings,
            yaml_settings,
            init_settings,
        )


class YamlConfigSettingsSource(PydanticBaseSettingsSource):
    """Custom settings source for YAML configuration files.

    Loads config from file specified in CONFIG_FILE environment variable.
    """

    def get_field_value(
        self, field: Any, field_name: str
    ) -> Tuple[Any, str, bool]:
        # Not used for nested models
        return None, field_name, False

    def __call__(self) -> Dict[str, Any]:
        """Load settings from YAML file if CONFIG_FILE is set."""
        config_file = os.getenv("CONFIG_FILE")

        if not config_file:
            return {}

        if not os.path.exists(config_file):
            return {}

        try:
            with open(config_file, "r") as f:
                data = yaml.safe_load(f)
                return data if data else {}
        except Exception:
            # Silently ignore config file errors - app should work without it
            return {}


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance (singleton pattern)."""
    return Settings()
