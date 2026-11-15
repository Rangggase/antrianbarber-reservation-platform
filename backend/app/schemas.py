"""Pydantic request/response models for the reservation API."""
from datetime import date, datetime
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CatalogService(BaseModel):
    id: int
    code: str
    name: str
    description: str | None
    duration_minutes: int
    price_idr: int
    model_config = {"from_attributes": True}


class CatalogBarber(BaseModel):
    id: int
    code: str
    full_name: str
    specialty: str | None
    bio: str | None
    model_config = {"from_attributes": True}


class SlotList(BaseModel):
    date: date
    barber_id: int
    service_id: int
    timezone: str = "Asia/Jakarta"
    slots: list[datetime]


class BookingCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=20)
    barber_id: int = Field(gt=0)
    service_id: int = Field(gt=0)
    starts_at: datetime

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Nama minimal 2 karakter")
        return value

    @field_validator("phone")
    @classmethod
    def phone_indo(cls, value: str) -> str:
        value = re.sub(r"[\s-]", "", value)
        if not re.fullmatch(r"(?:\+62|0)8\d{8,11}", value):
            raise ValueError("Nomor ponsel Indonesia tidak valid")
        if value.startswith("+62"):
            value = "0" + value[3:]
        return value

    @field_validator("starts_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("starts_at harus ISO 8601 dengan zona waktu, contohnya +07:00")
        return value


class BookingView(BaseModel):
    reference_code: str
    barber_id: int
    service_id: int
    starts_at: datetime
    ends_at: datetime
    status: str
    price_idr: int
    # Does not return phone/name; reference_code alone grants no lookup.
    model_config = {"from_attributes": True}


class BookingCreated(BookingView):
    access_token: str


class BookingDetail(BookingView):
    """Customer-facing detail: adds queue position info (no personal data)."""
    queue_number: int | None = None
    # Only for pending/confirmed bookings on the current local day.
    ahead_count: int | None = None
    estimated_wait_minutes: int | None = None


# --- staff (back office) ---------------------------------------------------------

BookingStatus = Literal["pending", "confirmed", "in_service", "completed", "cancelled", "no_show"]
NewStatus = Literal["confirmed", "in_service", "completed", "cancelled", "no_show"]


class StaffLogin(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class StaffUserView(BaseModel):
    id: int
    username: str
    full_name: str
    role: Literal["admin", "barber"]
    barber_id: int | None
    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: StaffUserView


class StatusChange(BaseModel):
    status: NewStatus


class StaffBooking(BaseModel):
    reference_code: str
    customer_name: str
    customer_phone: str
    barber_id: int
    barber_name: str
    service_id: int
    service_name: str
    starts_at: datetime
    ends_at: datetime
    status: BookingStatus
    queue_number: int | None
    price_idr: int
    allowed_next: list[str]


class QueueResponse(BaseModel):
    date: date
    barber_id: int | None
    bookings: list[StaffBooking]
    counts: dict[str, int]
