from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from app.main import app
from app.database import get_engine


def test_health():
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_database_health_with_test_database():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    app.dependency_overrides[get_engine] = lambda: engine
    try:
        with TestClient(app) as client:
            response = client.get("/api/health/db")
        assert response.status_code == 200
        assert response.json()["database"] == "connected"
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
