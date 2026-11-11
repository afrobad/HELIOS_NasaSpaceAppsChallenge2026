"""
backend/app/db/database.py
Initializes SQLite connection pool with Write-Ahead Logging (WAL) and memory mapping.
"""

import os
import sqlite3
from typing import Optional
from .models import SCHEMA_DDL

DEFAULT_DB_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "data"
)
DEFAULT_DB_PATH = os.path.join(DEFAULT_DB_DIR, "astronaut_health.db")


def _apply_pragmas(cursor: sqlite3.Cursor) -> None:
    """Safely configures SQLite pragmas with automatic fallback for WSL DrvFs /mnt/c shared mounts."""
    # Attempt WAL mode. If filesystem rejects shared-memory mapping (e.g. WSL /mnt/c), fallback to DELETE
    try:
        cursor.execute("PRAGMA journal_mode = WAL;")
        cursor.execute("PRAGMA wal_autocheckpoint = 500;")
    except sqlite3.OperationalError:
        try:
            cursor.execute("PRAGMA journal_mode = DELETE;")
        except Exception:
            pass

    for pragma in [
        "PRAGMA synchronous = NORMAL;",
        "PRAGMA busy_timeout = 5000;",
        "PRAGMA cache_size = -32000;",
        "PRAGMA foreign_keys = ON;",
    ]:
        try:
            cursor.execute(pragma)
        except Exception:
            pass

    try:
        cursor.execute("PRAGMA mmap_size = 67108864;")
    except Exception:
        pass


def get_connection(db_path: str = DEFAULT_DB_PATH, force_recovery: bool = False) -> sqlite3.Connection:
    """
    Connects to the SQLite database and tunes pragmas for aerospace performance:
    WAL mode (or DELETE on WSL mounts), normal sync, memory mapping, and cache sizing.
    Includes automatic self-healing recovery if a file is malformed from an interrupted process.
    """
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

    def _clean_and_reopen():
        for ext in ["", "-wal", "-shm"]:
            f = db_path + ext
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass
        new_conn = sqlite3.connect(db_path, timeout=30.0, check_same_thread=False)
        new_conn.row_factory = sqlite3.Row
        cur = new_conn.cursor()
        _apply_pragmas(cur)
        cur.executescript(SCHEMA_DDL)
        new_conn.commit()
        return new_conn

    if force_recovery:
        return _clean_and_reopen()

    try:
        conn = sqlite3.connect(db_path, timeout=5.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        _apply_pragmas(cursor)
        conn.commit()
        return conn
    except (sqlite3.DatabaseError, sqlite3.OperationalError):
        return _clean_and_reopen()


def init_database(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Initializes database tables, indexes, and ensures multimodal column migrations."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.executescript(SCHEMA_DDL)

    # Periodic WAL truncation on startup to prevent disk bloat
    try:
        cursor.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    except Exception:
        pass

    conn.commit()

    # Dynamic schema migration for laboratory biomarker columns
    new_cols = [
        ("potassium", "REAL"),
        ("hematocrit", "REAL"),
        ("wbc_count", "REAL"),
        ("il_6", "REAL"),
        ("platelet_count", "REAL"),
        ("crp", "REAL"),
        ("computed_qtc", "REAL"),
        ("computed_epi", "REAL"),
        ("computed_arf", "REAL"),
        ("computed_trm", "REAL"),
        ("radiation_flux", "REAL"),
        ("lymphocyte_count", "REAL"),
        ("radiation_dose_gy", "REAL"),
        ("computed_rsi", "REAL")
    ]

    cursor.execute("PRAGMA table_info(telemetry_log);")
    existing_cols = {row["name"] for row in cursor.fetchall()}
    for col_name, col_type in new_cols:
        if col_name not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE telemetry_log ADD COLUMN {col_name} {col_type};")
            except Exception:
                pass
    conn.commit()
    return conn
