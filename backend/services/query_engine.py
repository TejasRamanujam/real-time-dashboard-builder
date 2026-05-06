import sqlparse
from typing import Dict, Any, List


def validate_sql(query: str) -> tuple[bool, str]:
    parsed = sqlparse.parse(query.strip())
    statements = [s for s in parsed if s.tokens]
    if len(statements) == 0:
        return False, "Empty query"
    if len(statements) > 1:
        return False, "Only one SQL statement allowed"

    stmt = statements[0]
    stmt_type = stmt.get_type()
    if stmt_type not in ("SELECT", "UNKNOWN"):
        return False, f"Forbidden statement type: {stmt_type}"

    return True, "ok"


def execute_query(connection_config: Dict[str, Any], query: str) -> List[Dict[str, Any]]:
    valid, msg = validate_sql(query)
    if not valid:
        raise ValueError(f"Invalid SQL: {msg}")

    conn_type = connection_config.get("type", "postgresql")

    if conn_type == "postgresql":
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(
            host=connection_config.get("host", "localhost"),
            port=connection_config.get("port", 5432),
            dbname=connection_config.get("database", "postgres"),
            user=connection_config.get("user", "postgres"),
            password=connection_config.get("password", ""),
            connect_timeout=10,
        )
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(query)
                return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

    elif conn_type == "rest":
        import httpx
        url = connection_config.get("url", "")
        headers = connection_config.get("headers", {})
        resp = httpx.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            records = data.get("data") or data.get("results") or data.get("records") or [data]
            return records if isinstance(records, list) else [records]
        return []

    elif conn_type == "csv":
        import pandas as pd
        import io
        import base64
        csv_content = connection_config.get("csv_content", "")
        if not csv_content:
            return []
        df = pd.read_csv(io.StringIO(csv_content))
        return df.to_dict(orient="records")

    return []
