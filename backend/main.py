import json
import asyncio
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel, field_validator

from database import init_db, get_db
from models import Dashboard, Widget, DataSource, DashboardShare
from services.query_engine import execute_query
from services.widget_data import transform_for_widget

app = FastAPI(title="Real-Time Dashboard Builder")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connected_clients: dict[int, set[WebSocket]] = {}


class DSBase(BaseModel):
    name: str
    type: str
    connection_config: dict


class DSResponse(DSBase):
    id: int
    model_config = {"from_attributes": True}


class DashboardBase(BaseModel):
    name: str
    description: str = ""
    layout: dict = {}
    auto_refresh: int = 0


class DashboardResponse(DashboardBase):
    id: int
    created_at: str = ""
    updated_at: str = ""
    model_config = {"from_attributes": True}

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def _stringify_dt(cls, v):
        return v.isoformat() if hasattr(v, "isoformat") else (v or "")


class WidgetBase(BaseModel):
    dashboard_id: int
    data_source_id: Optional[int] = None
    widget_type: str
    title: str
    config: dict = {}
    position: dict = {}
    query_text: str = ""
    refresh_interval: int = 0


class WidgetResponse(WidgetBase):
    id: int
    model_config = {"from_attributes": True}


class QueryRequest(BaseModel):
    data_source_id: int
    query: str


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/datasources", response_model=List[DSResponse])
def list_ds(db: Session = Depends(get_db)):
    return db.query(DataSource).all()


@app.post("/api/datasources", response_model=DSResponse)
def create_ds(data: DSBase, db: Session = Depends(get_db)):
    ds = DataSource(**data.model_dump())
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return ds


@app.post("/api/datasources/{ds_id}/test")
def test_ds(ds_id: int, db: Session = Depends(get_db)):
    ds = db.query(DataSource).filter(DataSource.id == ds_id).first()
    if not ds:
        raise HTTPException(status_code=404)
    try:
        if ds.type == "postgresql":
            query = "SELECT 1 AS test"
            result = execute_query(ds.connection_config, query)
            return {"ok": True, "result": result}
        elif ds.type == "rest":
            result = execute_query(ds.connection_config, "")
            return {"ok": True, "preview": result[:5] if result else []}
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/query")
def run_query(req: QueryRequest, db: Session = Depends(get_db)):
    ds = db.query(DataSource).filter(DataSource.id == req.data_source_id).first()
    if not ds:
        raise HTTPException(status_code=404)
    result = execute_query(ds.connection_config, req.query)
    return {"data": result, "count": len(result), "columns": list(result[0].keys()) if result else []}


@app.get("/api/dashboards", response_model=List[DashboardResponse])
def list_dashboards(db: Session = Depends(get_db)):
    return db.query(Dashboard).order_by(Dashboard.updated_at.desc()).all()


@app.post("/api/dashboards", response_model=DashboardResponse)
def create_dashboard(data: DashboardBase, db: Session = Depends(get_db)):
    d = Dashboard(**data.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@app.get("/api/dashboards/{dash_id}", response_model=DashboardResponse)
def get_dashboard(dash_id: int, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(Dashboard.id == dash_id).first()
    if not d:
        raise HTTPException(status_code=404)
    return d


@app.put("/api/dashboards/{dash_id}")
def update_dashboard(dash_id: int, data: DashboardBase, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(Dashboard.id == dash_id).first()
    if not d:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump().items():
        setattr(d, k, v)
    db.commit()
    return {"ok": True}


@app.delete("/api/dashboards/{dash_id}")
def delete_dashboard(dash_id: int, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(Dashboard.id == dash_id).first()
    if not d:
        raise HTTPException(status_code=404)
    db.delete(d)
    db.commit()
    return {"ok": True}


@app.get("/api/dashboards/{dash_id}/widgets", response_model=List[WidgetResponse])
def list_widgets(dash_id: int, db: Session = Depends(get_db)):
    return db.query(Widget).filter(Widget.dashboard_id == dash_id).order_by(Widget.id).all()


@app.post("/api/widgets", response_model=WidgetResponse)
def create_widget(data: WidgetBase, db: Session = Depends(get_db)):
    w = Widget(**data.model_dump())
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


@app.put("/api/widgets/{widget_id}")
def update_widget(widget_id: int, data: WidgetBase, db: Session = Depends(get_db)):
    w = db.query(Widget).filter(Widget.id == widget_id).first()
    if not w:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump().items():
        setattr(w, k, v)
    db.commit()
    return {"ok": True}


@app.delete("/api/widgets/{widget_id}")
def delete_widget(widget_id: int, db: Session = Depends(get_db)):
    w = db.query(Widget).filter(Widget.id == widget_id).first()
    if not w:
        raise HTTPException(status_code=404)
    db.delete(w)
    db.commit()
    return {"ok": True}


@app.get("/api/widgets/{widget_id}/data")
def get_widget_data(widget_id: int, db: Session = Depends(get_db)):
    w = db.query(Widget).filter(Widget.id == widget_id).first()
    if not w:
        raise HTTPException(status_code=404)
    if not w.data_source_id:
        return {"data": [], "type": w.widget_type}
    ds = db.query(DataSource).filter(DataSource.id == w.data_source_id).first()
    if not ds:
        return {"data": [], "type": w.widget_type}
    query = w.query_text or "SELECT * FROM (SELECT 1 AS sample) t"
    raw = execute_query(ds.connection_config, query)
    transformed = transform_for_widget(raw, w.widget_type, w.config)
    return transformed


@app.websocket("/ws/dashboard/{dash_id}")
async def ws_dashboard(ws: WebSocket, dash_id: int):
    await ws.accept()
    if dash_id not in connected_clients:
        connected_clients[dash_id] = set()
    connected_clients[dash_id].add(ws)
    try:
        while True:
            try:
                msg = await asyncio.wait_for(ws.receive_text(), timeout=30)
                if msg == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
                elif msg.startswith("refresh:"):
                    widget_id = int(msg.split(":")[1])
                    from database import SessionLocal
                    db = SessionLocal()
                    try:
                        w = db.query(Widget).filter(Widget.id == widget_id).first()
                        if w and w.data_source_id:
                            ds = db.query(DataSource).filter(DataSource.id == w.data_source_id).first()
                            if ds:
                                query = w.query_text or "SELECT 1 AS sample"
                                raw = execute_query(ds.connection_config, query)
                                transformed = transform_for_widget(raw, w.widget_type, w.config)
                                await ws.send_text(json.dumps({"type": "widget_data", "widget_id": widget_id, "data": transformed}))
                    finally:
                        db.close()
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        connected_clients[dash_id].discard(ws)
        if not connected_clients[dash_id]:
            del connected_clients[dash_id]
    except Exception:
        connected_clients[dash_id].discard(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
