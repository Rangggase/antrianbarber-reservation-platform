"""Back-office API for staff: login, daily queue, booking status changes.

All responses are `Cache-Control: no-store` because they contain customer names and phones.
"""
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.orm import Session

from ..models import StaffUser
from ..schemas import LoginResponse, QueueResponse, StaffBooking, StaffLogin, StaffUserView, StatusChange
from ..security.staff_auth import authenticate_bearer, issue_token
from ..services import staff_service
from ..services.booking_service import LOCAL_ZONE
from .reservations import get_session


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/api/v1/staff", tags=["Staff"], dependencies=[Depends(_no_store)])


def current_staff(
    authorization: Annotated[str | None, Header()] = None,
    session: Session = Depends(get_session),
) -> StaffUser:
    return authenticate_bearer(session, authorization)


@router.post("/login", response_model=LoginResponse)
def login(body: StaffLogin, session: Session = Depends(get_session)):
    user = staff_service.authenticate(session, body.username, body.password)
    token, expires_in = issue_token(user)
    return LoginResponse(access_token=token, expires_in=expires_in, user=StaffUserView.model_validate(user))


@router.get("/me", response_model=StaffUserView)
def me(staff: StaffUser = Depends(current_staff)):
    return staff


@router.get("/queue", response_model=QueueResponse)
def queue(
    day: Annotated[date | None, Query(alias="date")] = None,
    barber_id: Annotated[int | None, Query(gt=0)] = None,
    staff: StaffUser = Depends(current_staff),
    session: Session = Depends(get_session),
):
    chosen_day = day or datetime.now(LOCAL_ZONE).date()
    scope, bookings, counts = staff_service.get_queue(session, staff, chosen_day, barber_id)
    return QueueResponse(date=chosen_day, barber_id=scope, bookings=bookings, counts=counts)


@router.post("/bookings/{reference_code}/status", response_model=StaffBooking)
def change_status(
    reference_code: str,
    body: StatusChange,
    staff: StaffUser = Depends(current_staff),
    session: Session = Depends(get_session),
):
    return staff_service.change_status(session, staff, reference_code, body.status)
