"""Populate fictional weekly schedules Tue-Sun 09:00-17:00 for demo barbers.

Idempotent; does not overwrite existing schedules. Run only on demo DB.
"""
from datetime import time
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_engine
from app.models import Barber, Schedule


def main():
    inserted = 0
    with Session(get_engine()) as session:
        for barber in session.scalars(select(Barber).where(Barber.is_active.is_(True))).all():
            for day in range(1, 7):
                has_schedule = session.scalar(select(Schedule.id).where(
                    Schedule.barber_id == barber.id, Schedule.weekday == day,
                    Schedule.start_time == time(9, 0), Schedule.end_time == time(17, 0),
                ))
                if has_schedule is None:
                    session.add(Schedule(barber_id=barber.id, weekday=day,
                                         start_time=time(9, 0), end_time=time(17, 0)))
                    inserted += 1
        session.commit()
    print(f"Demo schedules: {inserted} added, existing rows retained")


if __name__ == "__main__":
    main()
