from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    codle_api_url: str = "https://dev-class.codle.io"
    codle_token: str = ""

    model_config = {"env_prefix": "CODLE_", "env_file": ".env"}


settings = Settings()
