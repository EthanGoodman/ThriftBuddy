from __future__ import annotations

import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Response, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import get_db

router = APIRouter()

# Anonymous visitor cookie (unique per browser/device unless cleared)
VISITOR_COOKIE = "tb_vid"

def is_prod() -> bool:
    return os.getenv("ENV", "").lower() == "production"

@router.post("/track")
def track_visit(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    """
    Tracks unique visitors with an anonymous cookie + DB table.
    - If cookie missing: set a new random UUID cookie
    - Insert into visitor_ids once (ON CONFLICT DO NOTHING)
    """
    vid = request.cookies.get(VISITOR_COOKIE)

    if not vid:
        vid = str(uuid.uuid4())
        response.set_cookie(
            key=VISITOR_COOKIE,
            value=vid,
            httponly=True,
            secure=is_prod(),
            samesite="lax",
            path="/",
            max_age=60 * 60 * 24 * 365,  # 1 year
        )

    db.execute(
        text(
            """
            INSERT INTO visitor_ids (id)
            VALUES (:id)
            ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": vid},
    )
    db.commit()

    return {"ok": True}

@router.get("/count")
def unique_user_count(db: Session = Depends(get_db)) -> dict:
    """
    Returns total unique visitor IDs recorded.
    NOTE: This is public as-written. If you don't want users to see it,
    remove this route or guard it behind an env var / internal header.
    """
    n = db.execute(text("SELECT COUNT(*) FROM visitor_ids")).scalar_one()
    return {"unique_users": int(n)}
