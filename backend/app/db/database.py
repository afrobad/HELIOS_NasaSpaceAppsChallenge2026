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


def get_connection(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """
    Connects to the SQLite database and tunes pragmas for aerospace performance:
    WAL mode, normal sync, memory mapping (256 MB), and cache sizing (64 MB).
    """
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # WAL mode: Concurrent reads and writes with zero lock blocking
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    cursor.execute("PRAGMA mmap_size = 268435456;") # 256 MB memory-mapped I/O
    cursor.execute("PRAGMA cache_size = -64000;")    # 64 MB RAM cache
    cursor.execute("PRAGMA foreign_keys = ON;")
    conn.commit()

    return conn


def init_database(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Initializes database tables, indexes, and ensures multimodal column migrations."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.executescript(SCHEMA_DDL)
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
