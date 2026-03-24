import os
from pathlib import Path
import yaml


def _load() -> dict:
    path = Path(__file__).parent / "config.yaml"
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


_cfg = _load()


class Settings:
    db_url: str = _cfg["database"]["url"]
    redis_url: str = _cfg["redis"]["url"]
    base_url: str = _cfg["server"]["base_url"]
    server_name: str = _cfg["server"]["name"]
    auth_enabled: bool = _cfg["auth"]["enabled"]
    auth_token: str = _cfg["auth"]["token"]
    session_ttl_seconds: int = _cfg["session"]["ttl_seconds"]
    session_key_prefix: str = _cfg["session"]["key_prefix"]

    model_name: str = _cfg["model"]["model_name"]
    model_base_url: str = _cfg["model"]["base_url"]
    model_api_key: str = _cfg["model"]["api_key"]

settings = Settings()
