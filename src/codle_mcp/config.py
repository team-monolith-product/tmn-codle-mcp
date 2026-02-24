from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_url: str = "https://class.dev.codle.io"
    auth_url: str = ""  # user-rails URL (e.g. https://user.dev.codle.io)
    email: str = ""
    password: str = ""
    client_id: str = ""

    model_config = {"env_prefix": "CODLE_", "env_file": ".env"}


settings = Settings()
