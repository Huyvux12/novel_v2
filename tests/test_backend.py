import importlib
import os
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

@pytest.fixture
def client():
    with tempfile.TemporaryDirectory() as folder:
        os.environ["DATABASE_PATH"] = str(Path(folder) / "app.db")
        os.environ["SECRET_KEY"] = "unit-test-only-secret-do-not-use-in-production"
        os.environ["APP_ENV"] = "development"
        from backend import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            yield client, main

def test_catalog_seed(client):
    c,_=client
    assert c.get("/api/health").json()["status"]=="ok"
    books=c.get("/api/books").json()
    assert books["total"]==3
    b=books["items"][0]["id"]
    chapter=c.get("/api/books/"+b).json()["chapters"][0]["number"]
    assert c.get(f"/api/books/{b}/chapters/{chapter}").status_code==200

def test_auth_library_csrf(client):
    c,_=client
    user={"email":"reader@example.com","password":"very secret password"}
    assert c.post("/api/auth/register",json=user).status_code==201
    b=c.get("/api/books").json()["items"][0]["id"]
    assert c.put("/api/me/library/"+b).status_code==403
    headers={"X-CSRF-Token":c.cookies.get("novel_csrf")}
    assert c.put("/api/me/library/"+b,headers=headers).status_code==200
    assert len(c.get("/api/me/library").json())==1
    number=c.get("/api/books/"+b).json()["chapters"][0]["number"]
    assert c.put("/api/me/progress/"+b,headers=headers,json={"chapter_number":number}).status_code==200
    assert c.get("/api/me/progress/"+b).json()["chapter_number"]==number
    assert c.post("/api/admin/books",headers=headers,json={"id":"x","title":"X","author":"A"}).status_code==403
    assert c.post("/api/auth/logout",headers=headers).status_code==200
    assert c.get("/api/auth/me").status_code==401

def test_admin_and_source_protection(client):
    c,m=client
    assert c.get("/backend/main.py").status_code==404
    assert c.get("/.env.example").status_code==404
    assert c.get("/").status_code==200
    user={"email":"admin@example.com","password":"very secure password"}
    assert c.post("/api/auth/register",json=user).status_code==201
    with m.db() as conn:
        conn.execute("UPDATE users SET role='admin' WHERE email=?",(user["email"],))
    headers={"X-CSRF-Token":c.cookies.get("novel_csrf")}
    assert c.post("/api/admin/books",headers=headers,json={"id":"test-book","title":"Test","author":"Author"}).status_code==201
    assert c.put("/api/admin/books/test-book/chapters",headers=headers,json={"number":1,"title":"First","markdown":"# Hi"}).status_code==200
    assert c.get("/api/books/test-book/chapters/1").json()["markdown"]=="# Hi"
    assert c.delete("/api/admin/books/test-book",headers=headers).status_code==200

def test_validation(client):
    c,_=client
    assert c.get("/api/books?limit=0").status_code==422
    assert c.post("/api/auth/login",json={"email":"test@example.com","password":"incorrect pw"}).status_code==401
