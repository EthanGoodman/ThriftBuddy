from sqlalchemy import String, Boolean, DateTime, Integer, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    email: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)

    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

    email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    oauth_provider: Mapped[str | None] = mapped_column(String, nullable=True)
    oauth_subject: Mapped[str | None] = mapped_column(String, nullable=True)

    # -----------------------------
    # Passwordless login (OTP)
    # -----------------------------
    login_code_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    login_code_expires_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    login_code_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    last_login_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
