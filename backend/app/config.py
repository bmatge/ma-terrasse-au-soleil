from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://terrasse:devpassword@db:5432/terrasse_soleil"
    DATABASE_URL_SYNC: str = "postgresql://terrasse:devpassword@db:5432/terrasse_soleil"
    REDIS_URL: str = "redis://redis:6379/0"
    LOG_LEVEL: str = "info"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
