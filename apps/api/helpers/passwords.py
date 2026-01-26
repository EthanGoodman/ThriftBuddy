from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# These defaults are solid for most web apps.
# You can tune later if you want higher cost.
_ph = PasswordHasher(
    time_cost=2,
    memory_cost=102400,  # 100 MB
    parallelism=8,
    hash_len=32,
    salt_len=16,
)

def hash_password(password: str) -> str:
    """
    Returns an encoded Argon2 hash string.
    Store this in users.password_hash.
    """
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    return _ph.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    """
    Verifies password against encoded hash.
    Returns True/False.
    """
    if not password_hash:
        return False
    try:
        return _ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False

def maybe_upgrade_hash(password: str, password_hash: str) -> str | None:
    """
    If parameters have changed, argon2 can tell you a hash needs rehashing.
    Return the new hash to store, or None if no upgrade needed.
    """
    if not password_hash:
        return None
    try:
        if _ph.check_needs_rehash(password_hash):
            return _ph.hash(password)
    except VerifyMismatchError:
        return None
    return None
