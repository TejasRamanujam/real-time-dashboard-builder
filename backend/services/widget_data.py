from typing import Dict, Any, List
import json


def transform_for_widget(raw_data: List[Dict[str, Any]], widget_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
    if not raw_data:
        return {"data": [], "type": widget_type, "config": config}

    if widget_type == "line_chart" or widget_type == "bar_chart":
        x_field = config.get("x_field") or find_string_col(raw_data)
        y_field = config.get("y_field") or find_numeric_col(raw_data)
        data = []
        for row in raw_data:
            data.append({
                "x": _safe_val(row.get(x_field, "")),
                "y": _safe_num(row.get(y_field, 0)),
            })
        return {"data": data, "x_field": x_field, "y_field": y_field, "type": widget_type}

    if widget_type == "pie_chart":
        name_field = config.get("name_field") or find_string_col(raw_data)
        value_field = config.get("value_field") or find_numeric_col(raw_data)
        data = []
        for row in raw_data:
            data.append({
                "name": str(_safe_val(row.get(name_field, ""))),
                "value": _safe_num(row.get(value_field, 0)),
            })
        return {"data": data, "type": widget_type}

    if widget_type == "data_table":
        columns = list(raw_data[0].keys()) if raw_data else []
        rows = []
        for row in raw_data:
            rows.append({k: _safe_val(v) for k, v in row.items()})
        return {"data": rows, "columns": columns, "type": widget_type}

    if widget_type == "stat_card":
        field = config.get("field") or find_numeric_col(raw_data)
        values = [_safe_num(r.get(field, 0)) for r in raw_data if field in r]
        total = sum(values)
        avg = total / len(values) if values else 0
        return {
            "data": {"value": total, "average": avg, "count": len(values)},
            "label": config.get("label", field or "Value"),
            "type": widget_type,
        }

    return {"data": raw_data, "type": widget_type, "config": config}


def find_numeric_col(data: List[Dict]) -> str | None:
    if not data:
        return None
    for k in data[0].keys():
        vals = [row.get(k) for row in data[:5]]
        if any(isinstance(v, (int, float)) for v in vals):
            return k
    return list(data[0].keys())[0] if data[0] else None


def find_string_col(data: List[Dict]) -> str | None:
    if not data:
        return None
    for k in data[0].keys():
        vals = [row.get(k) for row in data[:5]]
        if all(not isinstance(v, (int, float)) or v is None for v in vals):
            return k
    return list(data[0].keys())[0] if data[0] else None


def _safe_val(v: Any) -> Any:
    if isinstance(v, (int, float, str, bool, type(None))):
        return v
    return str(v)


def _safe_num(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0
