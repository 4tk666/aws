import os
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from main import Base, app, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(engine)


def override_db():
    with Session(engine, expire_on_commit=False) as session:
        yield session


app.dependency_overrides[get_db] = override_db
client = TestClient(app)


def test_task_crud() -> None:
    created = client.post("/api/tasks", json={"title": "AWSを学ぶ"})
    assert created.status_code == 201
    task_id = created.json()["id"]
    assert created.json()["completed"] is False

    listed = client.get("/api/tasks")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    updated = client.patch(f"/api/tasks/{task_id}", json={"completed": True})
    assert updated.status_code == 200
    assert updated.json()["completed"] is True

    deleted = client.delete(f"/api/tasks/{task_id}")
    assert deleted.status_code == 204
    assert client.get("/api/tasks").json() == []
