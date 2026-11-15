"""FastAPI v2.6: demo catalog, availability and reservation API with token auth, rate limiting and DB-enforced booking rules."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_cors_origins
from .errors import register_error_handlers
from .observability import RequestContextMiddleware, configure_logging
from .security.rate_limit import RateLimitMiddleware
from .api.health import router as health_router
from .api.reservations import router as reservation_router

configure_logging()

app = FastAPI(
    title="Antrian Barber API",
    version="2.6",
    description="REST API demo reservasi barbershop berbasis PostgreSQL. Belum production-ready dan belum memiliki autentikasi admin.",
)
register_error_handlers(app)

# Middleware order: the last one added is outermost. CORS must wrap everything so that
# error and 429 responses still carry CORS headers; RequestContext wraps the rate limiter
# so 429 responses also get a request id.
# Local dev origins by default; set CORS_ORIGINS (comma-separated) for a deployed frontend.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Booking-Token"],
    expose_headers=["X-Request-ID", "Retry-After"],
)
app.include_router(health_router)
app.include_router(reservation_router)
