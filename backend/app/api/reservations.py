"""Public demo reservation API (thin HTTP layer; rules live in services/booking_service.py).

The API deliberately provides no admin access and never exposes booking PII without a
signed, client-held token.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.orm import Session

from ..database import get_engine
from ..schemas import BookingCreate, BookingCreated, BookingView, CatalogBarber, CatalogService, SlotList
from ..services import booking_service as service

router = APIRouter(prefix="/api/v1", tags=["Reservation Demo API"])


def get_session():
    with Session(get_engine()) as session:
        yield session


@router.get("/services", response_model=list[CatalogService])
def list_services(session: Session = Depends(get_session)):
    return service.list_services(session)


@router.get("/barbers", response_model=list[CatalogBarber])
def list_barbers(session: Session = Depends(get_session)):
    return service.list_barbers(session)


@router.get("/availability", response_model=SlotList)
def get_availability(
    barber_id: Annotated[int, Query(gt=0)],
    service_id: Annotated[int, Query(gt=0)],
    day: Annotated[date, Query(alias="date")],
    session: Session = Depends(get_session),
):
    slots = service.get_slots(session, barber_id, service_id, day)
    return SlotList(date=day, barber_id=barber_id, service_id=service_id, slots=slots)


@router.post("/bookings", response_model=BookingCreated, status_code=status.HTTP_201_CREATED)
def create_booking(body: BookingCreate, session: Session = Depends(get_session)):
    booking, token = service.create_booking(session, body)
    return BookingCreated(**BookingView.model_validate(booking).model_dump(), access_token=token)


@router.get("/bookings/{reference_code}", response_model=BookingView)
def get_booking(
    reference_code: str,
    booking_token: Annotated[str | None, Header(alias="X-Booking-Token")] = None,
    session: Session = Depends(get_session),
):
    return service.get_booking(session, reference_code, booking_token)


@router.post("/bookings/{reference_code}/cancel", response_model=BookingView)
def cancel_booking(
    reference_code: str,
    booking_token: Annotated[str | None, Header(alias="X-Booking-Token")] = None,
    session: Session = Depends(get_session),
):
    return service.cancel_booking(session, reference_code, booking_token)
