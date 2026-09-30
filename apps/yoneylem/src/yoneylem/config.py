from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    chat_provider: str = "glm"  # "glm" | "gemini"
    glm_api_key: str | None = None
    glm_model: str = "glm-4.5-flash"
    glm_base_url: str = "https://api.z.ai/api/paas/v4/"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash-lite"

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"), extra="ignore"
    )


settings = Settings()
