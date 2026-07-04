"""Configuration management for RSS Reader backend."""

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)

# Repo root, anchored to this file (backend/src/backend/config.py) so dev
# defaults work regardless of the working directory. In Docker images these
# paths don't exist; env vars / CONFIG_FILE are used there instead.
_REPO_ROOT = Path(__file__).resolve().parents[3]

# Repo-local config used in development when CONFIG_FILE is not set.
_DEFAULT_CONFIG_FILE = _REPO_ROOT / "config" / "app.yaml"


class DatabaseConfig(BaseModel):
    """Database configuration."""

    path: str = "./data/rss-reader.db"


class LoggingConfig(BaseModel):
    """Logging configuration."""

    level: str = "INFO"
    format: str = "text"  # text or json


class SchedulerConfig(BaseModel):
    """Scheduler configuration."""

    model_config = ConfigDict(extra="ignore")

    log_job_execution: bool = False


class LLMTaskConfig(BaseModel):
    """Per-task Azure deployment routing."""

    deployment: str
    batch_size: int = 5


class LLMConfig(BaseModel):
    """Azure OpenAI configuration (ADR-0002).

    Deployment routing and batch sizes live here; endpoint and API key
    come from env vars only (AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY).
    """

    api_version: str = "2024-10-21"
    tasks: dict[str, LLMTaskConfig] = {}


class Settings(BaseSettings):
    """Application settings with nested configuration sections.

    Priority order:
    1. Environment variables (e.g., DATABASE__PATH for database.path)
    2. .env file (repo root, then CWD — the latter wins on conflicts)
    3. YAML config file (CONFIG_FILE env var, or the repo's config/app.yaml)
    4. Default values

    The app works with NO config file - just defaults.
    """

    model_config = SettingsConfigDict(
        env_file=(str(_REPO_ROOT / ".env"), ".env"),
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )

    database: DatabaseConfig = DatabaseConfig()
    logging: LoggingConfig = LoggingConfig()
    scheduler: SchedulerConfig = SchedulerConfig()
    llm: LLMConfig = LLMConfig()

    # Azure credentials — env only (AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY),
    # never the YAML file. Missing values degrade scoring, not the app.
    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
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

    Loads config from the file named by the CONFIG_FILE environment variable
    (a real env var — values in .env files are not visible here), falling
    back to the repo's config/app.yaml when present.
    """

    def get_field_value(self, field: Any, field_name: str) -> tuple[Any, str, bool]:
        # Not used for nested models
        return None, field_name, False

    def __call__(self) -> dict[str, Any]:
        """Load settings from the YAML config file, if one can be found."""
        config_file = os.getenv("CONFIG_FILE")

        if not config_file:
            if not _DEFAULT_CONFIG_FILE.exists():
                return {}
            config_file = str(_DEFAULT_CONFIG_FILE)
        elif not os.path.exists(config_file):
            logging.getLogger(__name__).warning(
                f"CONFIG_FILE points to a missing file, ignoring: {config_file}"
            )
            return {}

        try:
            with open(config_file) as f:
                data = yaml.safe_load(f)
                return data if data else {}
        except Exception as e:
            logging.getLogger(__name__).warning(
                f"Failed to parse config file: path={config_file} error={e}"
            )
            return {}


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance (singleton pattern)."""
    return Settings()
