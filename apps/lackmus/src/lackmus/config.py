from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Text-extraction path (readable PDF text -> structured fields): GLM,
    # same free-tier default as DSG/DSA Compliance in this account.
    glm_api_key: str | None = None
    glm_model: str = "glm-4.5-flash"
    glm_base_url: str = "https://api.z.ai/api/paas/v4/"
    # Vision path (scanned PDF pages / plain images, no extractable text
    # layer): Gemini - GLM's chat endpoint here has no documented image
    # input support, Gemini's does via google-genai's Part.from_bytes.
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash-lite"

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"), extra="ignore"
    )


settings = Settings()
