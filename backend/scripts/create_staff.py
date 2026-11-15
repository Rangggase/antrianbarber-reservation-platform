"""Create (or reset the password of) a staff account.

Examples (from backend/):
    python -m scripts.create_staff --username admin --full-name "Admin Barber" --role admin
    python -m scripts.create_staff --username raka --full-name "Raka Pratama" --role barber --barber-code raka

The password is read from the STAFF_PASSWORD environment variable if set, otherwise prompted
(hidden). It is never accepted on the command line, so it stays out of shell history.
"""
import argparse
import getpass
import os
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_engine
from app.models import Barber, StaffUser
from app.security.passwords import MIN_PASSWORD_LENGTH, hash_password


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--username", required=True)
    parser.add_argument("--full-name", required=True)
    parser.add_argument("--role", choices=["admin", "barber"], required=True)
    parser.add_argument("--barber-code", help="required for role=barber (the barber's code, e.g. raka)")
    args = parser.parse_args()

    if (args.role == "barber") != bool(args.barber_code):
        print("--barber-code is required for role barber and not allowed for role admin.", file=sys.stderr)
        return 2
    password = os.getenv("STAFF_PASSWORD") or getpass.getpass(f"Password (min {MIN_PASSWORD_LENGTH} chars): ")
    if not os.getenv("STAFF_PASSWORD") and getpass.getpass("Repeat password: ") != password:
        print("Passwords do not match.", file=sys.stderr)
        return 2
    try:
        password_hash = hash_password(password)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 2

    username = args.username.strip().lower()
    with Session(get_engine()) as session:
        barber_id = None
        if args.barber_code:
            barber = session.scalar(select(Barber).where(Barber.code == args.barber_code))
            if barber is None:
                print(f"Barber with code {args.barber_code!r} not found. Run scripts.seed_demo first.", file=sys.stderr)
                return 2
            barber_id = barber.id
        user = session.scalar(select(StaffUser).where(StaffUser.username == username))
        if user is None:
            session.add(StaffUser(username=username, full_name=args.full_name, password_hash=password_hash, role=args.role, barber_id=barber_id))
            action = "created"
        else:
            user.full_name, user.password_hash, user.role, user.barber_id, user.is_active = args.full_name, password_hash, args.role, barber_id, True
            action = "updated"
        session.commit()
    print(f"Staff account {username!r} {action} (role={args.role}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
