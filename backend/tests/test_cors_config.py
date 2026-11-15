"""CORS origin configuration (pure function tests; no database)."""
import pytest

from app.config import DEFAULT_CORS_ORIGINS, get_cors_origins


def test_defaults_are_local_dev_origins(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert get_cors_origins() == list(DEFAULT_CORS_ORIGINS)


def test_blank_value_falls_back_to_defaults(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "   ")
    assert get_cors_origins() == list(DEFAULT_CORS_ORIGINS)


def test_custom_origins_are_trimmed_and_normalised(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", " https://app.example.com/ , http://localhost:5173 ")
    assert get_cors_origins() == ["https://app.example.com", "http://localhost:5173"]


@pytest.mark.parametrize("bad", ["*", "https://*.example.com", "app.example.com", "https://app.example.com/path", "ftp://x.example.com"])
def test_invalid_origins_are_rejected(monkeypatch, bad):
    monkeypatch.setenv("CORS_ORIGINS", bad)
    with pytest.raises(RuntimeError):
        get_cors_origins()
