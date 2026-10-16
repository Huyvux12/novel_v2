"""Create an admin only through a trusted server shell:
    python -m backend.admin promote user@example.com
"""
import argparse
from .main import db, initialize

def main():
    parser = argparse.ArgumentParser(description="Promote an existing registered user")
    parser.add_argument("command", choices=["promote", "demote"])
    parser.add_argument("email")
    args = parser.parse_args()
    initialize()
    with db() as c:
        result = c.execute("UPDATE users SET role=? WHERE email=?",
                           ("admin" if args.command == "promote" else "reader", args.email.strip().lower()))
        if result.rowcount != 1:
            parser.error("This email has not registered yet")
    print("User role updated")

if __name__ == "__main__":
    main()
