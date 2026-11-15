"""Endpoint pengujian awal; belum ada operasi data pelanggan."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from ..database import get_engine

router = APIRouter(prefix="/api", tags=["Health"])

@router.get("/health")
def app_health():
    return {"status": "ok", "service": "antrian-barber-api"}

@router.get("/health/db")
def database_health(engine: Engine = Depends(get_engine)):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError) as exc:
        raise HTTPException(status_code=503, detail="Koneksi database belum berhasil") from exc
    return {"status": "ok", "database": "connected"}
