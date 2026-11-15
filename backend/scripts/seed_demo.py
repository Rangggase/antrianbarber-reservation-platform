"""Optional idempotent fictitious catalog seed (NO customer data, bookings or schedules)."""
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_engine
from app.models import Barber, Service

SERVICES = [
    ("classic", "Classic Haircut", "Potongan klasik, rapi, dan presisi.", 45, 55000),
    ("fade", "Fade & Taper", "Gradasi modern dan detail yang bersih.", 60, 75000),
    ("wash", "Cut & Wash", "Potong rambut dan keramas.", 60, 85000),
    ("beard", "Beard Trim", "Perapian jenggot dan garis wajah.", 30, 35000),
]
BARBERS = [
    ("raka", "Raka Pratama", "Precision fade & taper"),
    ("naufal", "Naufal Ardi", "Textured crop & modern cut"),
    ("dimas", "Dimas Putra", "Classic cut & beard detail"),
]

def main() -> None:
    # Intentionally insert missing records only; never overwrite user edits.
    with Session(get_engine()) as session:
        for code, name, description, minutes, price in SERVICES:
            if session.scalar(select(Service.id).where(Service.code == code)) is None:
                session.add(Service(code=code, name=name, description=description,
                                    duration_minutes=minutes, price_idr=price))
        for code, name, specialty in BARBERS:
            if session.scalar(select(Barber.id).where(Barber.code == code)) is None:
                session.add(Barber(code=code, full_name=name, specialty=specialty))
        session.commit()
    print("Catalog demo checked: 4 services and 3 barbers. Existing records were not overwritten.")

if __name__ == "__main__":
    main()
