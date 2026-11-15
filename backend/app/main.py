"""FastAPI v2.2c: public demo catalog, availability and reservation API."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .security.rate_limit import RateLimitMiddleware
from .api.health import router as health_router
from .api.reservations import router as reservation_router

app = FastAPI(
    title="Antrian Barber API",
    version="2.2c",
    description="REST API demo berbasis PostgreSQL, belum terintegrasi dengan frontend publik dan belum production-ready.",
)
# Intentionally local-only until production origins and authentication are planned.

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Booking-Token"],
)
app.include_router(health_router)
app.include_router(reservation_router)
