"""FastAPI v2.7: reservation API plus a staff back office (login, queue, status workflow)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_cors_origins
from .errors import register_error_handlers
from .observability import RequestContextMiddleware, configure_logging
from .security.rate_limit import RateLimitMiddleware
from .api.health import router as health_router
from .api.reservations import router as reservation_router
from .api.staff import router as staff_router

configure_logging()

app = FastAPI(
    title="Antrian Barber API",
    version="2.7",
    description="REST API demo reservasi barbershop berbasis PostgreSQL, dengan login staf (admin/barber), antrean harian, dan alur status booking. Belum production-ready.",
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
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-Booking-Token", "Authorization"],
    expose_headers=["X-Request-ID", "Retry-After"],
)
app.include_router(health_router)
app.include_router(reservation_router)
app.include_router(staff_router)
