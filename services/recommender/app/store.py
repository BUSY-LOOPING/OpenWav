from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple

import psycopg
from psycopg.types.json import Jsonb

from .model import Interaction, tokens_for

SCHEMA = """
CREATE SCHEMA IF NOT EXISTS recsys;
CREATE TABLE IF NOT EXISTS recsys.interactions (
  event_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  media_id uuid NOT NULL,
  weight real NOT NULL,
  occurred_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS interactions_user_time_idx ON recsys.interactions (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS interactions_time_idx ON recsys.interactions (occurred_at);
CREATE TABLE IF NOT EXISTS recsys.models (
  version bigint PRIMARY KEY,
  trained_at timestamptz NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
"""

Row = Tuple[str, str, str, float, datetime]


class PgStore:
    def __init__(self, dsn: str):
        self.dsn = dsn

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(self.dsn, autocommit=True, prepare_threshold=None)

    def ensure_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(SCHEMA)

    def add_interactions(self, rows: Sequence[Row]) -> int:
        if not rows:
            return 0
        with self._connect() as conn, conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO recsys.interactions (event_id, user_id, media_id, weight, occurred_at) "
                "VALUES (%s, %s, %s, %s, %s) ON CONFLICT (event_id) DO NOTHING",
                rows,
            )
            return max(cur.rowcount, 0)

    def load_interactions(self, max_age_days: int = 365) -> List[Interaction]:
        with self._connect() as conn:
            return [
                (str(u), str(m), float(w), t)
                for u, m, w, t in conn.execute(
                    "SELECT user_id, media_id, weight, occurred_at FROM recsys.interactions "
                    "WHERE occurred_at > now() - make_interval(days => %s)",
                    (max_age_days,),
                )
            ]

    def load_content(self) -> Dict[str, List[str]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT m.id::text, COALESCE(m.metadata->'tags', '[]'::jsonb), "
                "COALESCE(array_agg(ma.artist_id::text) FILTER (WHERE ma.artist_id IS NOT NULL), '{}') "
                "FROM media m LEFT JOIN media_artists ma ON ma.media_id = m.id "
                "WHERE m.status = 'completed' GROUP BY m.id"
            ).fetchall()
        return {media: tokens_for([t for t in tags if isinstance(t, str)] if isinstance(tags, list) else [], artists)
                for media, tags, artists in rows}

    def recent_media(self, user_id: str, since: Optional[datetime]) -> List[str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT media_id::text FROM recsys.interactions WHERE user_id = %s AND weight > 0 "
                "AND (%s::timestamptz IS NULL OR occurred_at > %s::timestamptz) ORDER BY occurred_at DESC LIMIT 50",
                (user_id, since, since),
            ).fetchall()
        return [r[0] for r in rows]

    def save_model(self, version: int, trained_at: datetime, meta: dict) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO recsys.models (version, trained_at, meta) VALUES (%s, %s, %s) "
                "ON CONFLICT (version) DO UPDATE SET trained_at = EXCLUDED.trained_at, meta = EXCLUDED.meta",
                (version, trained_at, Jsonb(meta)),
            )

    def ping(self) -> bool:
        with self._connect() as conn:
            conn.execute("SELECT 1")
        return True
