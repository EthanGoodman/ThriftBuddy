from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.session import get_db
from db.models import VisitorId 

router = APIRouter()

VISITOR_COOKIE = "tb_vid"

def is_prod() -> bool:
    return os.getenv("ENV", "").lower() == "production"


@router.post("/track")
def track_visit(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    """
    Tracks unique visitors with an anonymous cookie + DB table.
    - If cookie missing: set a new random UUID cookie
    - Insert into visitor_ids once (only if not already present)
    """
    vid = request.cookies.get(VISITOR_COOKIE)

    if not vid:
        vid = str(uuid.uuid4())
        response.set_cookie(
            key=VISITOR_COOKIE,
            value=vid,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=60 * 60 * 24 * 365,  # 1 year
        )

    # "ON CONFLICT DO NOTHING" equivalent in portable ORM form:
    exists = db.get(VisitorId, vid)  # primary key lookup
    if not exists:
        db.add(VisitorId(id=vid))
        db.commit()

    return {"ok": True}


@router.get("/count")
def unique_user_count(db: Session = Depends(get_db)) -> dict:
    n = db.query(func.count(VisitorId.id)).scalar() or 0
    return {"unique_users": int(n)}
