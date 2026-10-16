"""Novel V3 REST API and same-origin static frontend.

SQLite is suited to local demos and single-instance deployments. Use persistent storage,
a backed-up volume and a single write instance in production.
"""
from __future__ import annotations

import hmac
import json
import os
import re
import secrets
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

import jwt
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv("DATABASE_PATH", str(ROOT / ".data" / "novel.db")))
ENV = os.getenv("APP_ENV", "development")
SECRET = os.getenv("SECRET_KEY") or secrets.token_urlsafe(48)
if ENV == "production" and len(os.getenv("SECRET_KEY", "")) < 32:
    raise RuntimeError("Set SECRET_KEY (at least 32 characters) in production")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def now() -> str:
    return datetime.now(timezone.utc).isoformat()

def count_value(value: object) -> int:
    if isinstance(value, int):
        return max(0, value)
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*([kmb]?)\s*", str(value), re.I)
    return int(float(match.group(1)) * {"": 1, "k": 1000, "m": 1000000, "b": 1000000000}[match.group(2).lower()]) if match else 0

@contextmanager
def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA busy_timeout=15000")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

def initialize():
    with db() as c:
        c.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'reader',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '',
                genres TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'Đang tiến hành',
                views INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chapters (
                id INTEGER PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                number INTEGER NOT NULL CHECK(number > 0), title TEXT NOT NULL,
                markdown TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(book_id, number)
            );
            CREATE TABLE IF NOT EXISTS library (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                added_at TEXT NOT NULL, PRIMARY KEY(user_id, book_id)
            );
            CREATE TABLE IF NOT EXISTS progress (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                chapter_number INTEGER NOT NULL, updated_at TEXT NOT NULL,
                PRIMARY KEY(user_id, book_id)
            );
            CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id, number);
            CREATE INDEX IF NOT EXISTS idx_books_updated ON books(updated_at);
        """)
        catalog = json.loads((ROOT / "novels" / "index.json").read_text(encoding="utf-8"))
        for entry in catalog["novels"]:
            slug = entry["id"]
            if not SLUG.fullmatch(slug):
                continue
            info_path = ROOT / "novels" / slug / "info.json"
            if not info_path.is_file():
                continue
            info = json.loads(info_path.read_text(encoding="utf-8"))
            c.execute("""INSERT OR IGNORE INTO books
                (id,title,author,description,cover,genres,status,views,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (slug, info["title"], info["author"], info.get("description", ""),
                 info.get("cover", ""), json.dumps(info.get("genres", [])),
                 info.get("status", "Đang tiến hành"), count_value(info.get("views", 0)),
                 now(), now()))
            for item in info.get("chapters", []):
                filename = item.get("file", "")
                if not re.fullmatch(r"[a-zA-Z0-9_-]+\.md", filename):
                    continue
                chapter_path = ROOT / "novels" / slug / filename
                if not chapter_path.is_file():
                    continue
                c.execute("""INSERT OR IGNORE INTO chapters
                    (book_id,number,title,markdown,created_at) VALUES (?,?,?,?,?)""",
                    (slug, item["number"], item["title"],
                     chapter_path.read_text(encoding="utf-8"), item.get("date", now())))

@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize()
    yield

app = FastAPI(title="Novel V3 API", version="3.0.0", lifespan=lifespan)

def fail(code: int, message: str):
    raise HTTPException(code, message)

def auth_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = __import__("hashlib").pbkdf2_hmac("sha256", password.encode(), salt, 310000)
    return "pbkdf2_sha256$310000$" + salt.hex() + "$" + digest.hex()

def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, rounds, salt, expected = encoded.split("$")
        if scheme != "pbkdf2_sha256" or int(rounds) > 1000000:
            return False
        digest = __import__("hashlib").pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(digest, bytes.fromhex(expected))
    except (ValueError, TypeError):
        return False

def set_session(response: Response, user_id: int):
    token = jwt.encode({"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(days=7),
                        "iat": datetime.now(timezone.utc)}, SECRET, algorithm="HS256")
    secure = ENV == "production"
    response.set_cookie("novel_session", token, httponly=True, secure=secure, samesite="lax", max_age=604800)
    response.set_cookie("novel_csrf", secrets.token_urlsafe(24), httponly=False,
                        secure=secure, samesite="lax", max_age=604800)

def current_user(request: Request) -> dict:
    token = request.cookies.get("novel_session", "")
    try:
        claims = jwt.decode(token, SECRET, algorithms=["HS256"], options={"require": ["exp", "sub"]})
        user_id = int(claims["sub"])
    except (jwt.PyJWTError, ValueError, TypeError):
        fail(401, "Vui lòng đăng nhập")
    with db() as c:
        row = c.execute("SELECT id,email,role FROM users WHERE id=?", (user_id,)).fetchone()
    if not row:
        fail(401, "Phiên đăng nhập không hợp lệ")
    return dict(row)

def mutation_user(request: Request, user: dict = Depends(current_user)) -> dict:
    expected = request.cookies.get("novel_csrf", "")
    supplied = request.headers.get("X-CSRF-Token", "")
    if not expected or not hmac.compare_digest(expected, supplied):
        fail(403, "CSRF token không hợp lệ")
    return user

def admin_user(user: dict = Depends(mutation_user)) -> dict:
    if user["role"] != "admin":
        fail(403, "Chỉ quản trị viên được thực hiện")
    return user

class Credentials(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=128)
    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL.fullmatch(value):
            raise ValueError("Email không hợp lệ")
        return value

class BookInput(BaseModel):
    id: str = Field(max_length=80)
    title: str = Field(min_length=1, max_length=180)
    author: str = Field(min_length=1, max_length=180)
    description: str = Field(default="", max_length=20000)
    cover: str = Field(default="", max_length=1000)
    genres: list[str] = Field(default_factory=list, max_length=20)
    status: str = Field(default="Đang tiến hành", max_length=50)
    @field_validator("id")
    @classmethod
    def check_slug(cls, value: str) -> str:
        if not SLUG.fullmatch(value):
            raise ValueError("ID chỉ được dùng chữ thường, số và dấu -")
        return value
    @field_validator("genres")
    @classmethod
    def check_genres(cls, value: list[str]) -> list[str]:
        if any(not (1 <= len(tag.strip()) <= 40) for tag in value):
            raise ValueError("Thể loại không hợp lệ")
        return [tag.strip() for tag in value]

class ChapterInput(BaseModel):
    number: int = Field(ge=1, le=1000000)
    title: str = Field(min_length=1, max_length=220)
    markdown: str = Field(min_length=1, max_length=2000000)

class ProgressInput(BaseModel):
    chapter_number: int = Field(ge=1)

def format_book(row: sqlite3.Row, *, with_chapters: bool = False) -> dict:
    value = dict(row)
    value["genres"] = json.loads(value["genres"])
    if with_chapters:
        with db() as c:
            value["chapters"] = [dict(ch) for ch in c.execute(
                "SELECT number,title,created_at AS date FROM chapters WHERE book_id=? ORDER BY number",
                (value["id"],)).fetchall()]
    return value

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "3.0.0"}

@app.get("/api/books")
def get_books(q: str = "", genre: str = "", sort: str = "updated", limit: int = 24, offset: int = 0):
    if not 1 <= limit <= 100 or offset < 0:
        fail(422, "Phân trang không hợp lệ")
    order = {"updated": "b.updated_at DESC", "popular": "b.views DESC",
             "title": "b.title COLLATE NOCASE ASC"}.get(sort)
    if not order:
        fail(422, "Kiểu sắp xếp không hợp lệ")
    query = """ FROM books b WHERE (b.title LIKE ? OR b.author LIKE ?)
                 AND (?='' OR EXISTS (SELECT 1 FROM json_each(b.genres) WHERE value=?)) """
    term = "%" + q[:100].replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    query = query.replace("LIKE ?", "LIKE ? ESCAPE '\\'")  # literal substring search
    args = (term, term, genre, genre)
    with db() as c:
        total = c.execute("SELECT count(*) " + query, args).fetchone()[0]
        rows = c.execute("""SELECT b.*, (SELECT count(*) FROM chapters ch
            WHERE ch.book_id=b.id) AS chapter_count""" + query + f" ORDER BY {order} LIMIT ? OFFSET ?",
            (*args, limit, offset)).fetchall()
    return {"items": [format_book(row) for row in rows], "total": total, "limit": limit, "offset": offset}

def get_existing_book(c: sqlite3.Connection, book_id: str):
    if not SLUG.fullmatch(book_id):
        fail(404, "Không tìm thấy truyện")
    row = c.execute("""SELECT b.*, (SELECT count(*) FROM chapters ch WHERE ch.book_id=b.id)
                       AS chapter_count FROM books b WHERE b.id=?""", (book_id,)).fetchone()
    if not row:
        fail(404, "Không tìm thấy truyện")
    return row

@app.get("/api/books/{book_id}")
def get_book(book_id: str):
    with db() as c:
        row = get_existing_book(c, book_id)
    return format_book(row, with_chapters=True)

@app.get("/api/books/{book_id}/chapters/{chapter_number}")
def get_chapter(book_id: str, chapter_number: int):
    with db() as c:
        get_existing_book(c, book_id)
        row = c.execute("SELECT number,title,markdown FROM chapters WHERE book_id=? AND number=?",
                        (book_id, chapter_number)).fetchone()
    if not row:
        fail(404, "Chương không tồn tại")
    return dict(row)

@app.post("/api/auth/register", status_code=201)
def register(body: Credentials, response: Response):
    with db() as c:
        try:
            cursor = c.execute("INSERT INTO users(email,password_hash,created_at) VALUES(?,?,?)",
                               (body.email, auth_password(body.password), now()))
        except sqlite3.IntegrityError:
            fail(409, "Email đã được sử dụng")
        user_id = cursor.lastrowid
    set_session(response, user_id)
    return {"id": user_id, "email": body.email, "role": "reader"}

@app.post("/api/auth/login")
def login(body: Credentials, response: Response):
    with db() as c:
        row = c.execute("SELECT * FROM users WHERE email=?", (body.email,)).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        fail(401, "Email hoặc mật khẩu không đúng")
    set_session(response, row["id"])
    return {"id": row["id"], "email": row["email"], "role": row["role"]}

@app.post("/api/auth/logout")
def logout(response: Response, _: dict = Depends(mutation_user)):
    response.delete_cookie("novel_session")
    response.delete_cookie("novel_csrf")
    return {"ok": True}

@app.get("/api/auth/me")
def me(user: dict = Depends(current_user)):
    return user

@app.get("/api/me/library")
def library(user: dict = Depends(current_user)):
    with db() as c:
        rows = c.execute("""SELECT b.*, p.chapter_number AS progress FROM library l
            JOIN books b ON b.id=l.book_id
            LEFT JOIN progress p ON p.user_id=l.user_id AND p.book_id=l.book_id
            WHERE l.user_id=? ORDER BY l.added_at DESC""", (user["id"],)).fetchall()
    return [format_book(row) for row in rows]

@app.put("/api/me/library/{book_id}")
def add_library(book_id: str, user: dict = Depends(mutation_user)):
    with db() as c:
        get_existing_book(c, book_id)
        c.execute("INSERT OR IGNORE INTO library(user_id,book_id,added_at) VALUES(?,?,?)",
                  (user["id"], book_id, now()))
    return {"following": True}

@app.delete("/api/me/library/{book_id}")
def remove_library(book_id: str, user: dict = Depends(mutation_user)):
    with db() as c:
        c.execute("DELETE FROM library WHERE user_id=? AND book_id=?", (user["id"], book_id))
    return {"following": False}

@app.get("/api/me/progress/{book_id}")
def read_progress(book_id: str, user: dict = Depends(current_user)):
    with db() as c:
        row = c.execute("SELECT chapter_number,updated_at FROM progress WHERE user_id=? AND book_id=?",
                        (user["id"], book_id)).fetchone()
    return dict(row) if row else {"chapter_number": None}

@app.put("/api/me/progress/{book_id}")
def update_progress(book_id: str, body: ProgressInput, user: dict = Depends(mutation_user)):
    with db() as c:
        get_existing_book(c, book_id)
        if not c.execute("SELECT 1 FROM chapters WHERE book_id=? AND number=?",
                         (book_id, body.chapter_number)).fetchone():
            fail(404, "Chương không tồn tại")
        c.execute("""INSERT INTO progress(user_id,book_id,chapter_number,updated_at) VALUES(?,?,?,?)
            ON CONFLICT(user_id,book_id) DO UPDATE SET
            chapter_number=excluded.chapter_number,updated_at=excluded.updated_at""",
            (user["id"], book_id, body.chapter_number, now()))
    return {"chapter_number": body.chapter_number}

@app.post("/api/admin/books", status_code=201)
def create_book(body: BookInput, _: dict = Depends(admin_user)):
    with db() as c:
        try:
            c.execute("""INSERT INTO books(id,title,author,description,cover,genres,status,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?)""",
                (body.id, body.title, body.author, body.description, body.cover,
                 json.dumps(body.genres, ensure_ascii=False), body.status, now(), now()))
        except sqlite3.IntegrityError:
            fail(409, "ID truyện đã tồn tại")
    return get_book(body.id)

@app.put("/api/admin/books/{book_id}")
def edit_book(book_id: str, body: BookInput, _: dict = Depends(admin_user)):
    if body.id != book_id:
        fail(400, "Không thể đổi ID truyện")
    with db() as c:
        get_existing_book(c, book_id)
        c.execute("""UPDATE books SET title=?,author=?,description=?,cover=?,genres=?,status=?,updated_at=?
                     WHERE id=?""",
                  (body.title, body.author, body.description, body.cover,
                   json.dumps(body.genres, ensure_ascii=False), body.status, now(), book_id))
    return get_book(book_id)

@app.delete("/api/admin/books/{book_id}")
def delete_book(book_id: str, _: dict = Depends(admin_user)):
    with db() as c:
        if not c.execute("SELECT 1 FROM books WHERE id=?", (book_id,)).fetchone():
            fail(404, "Không tìm thấy truyện")
        c.execute("DELETE FROM books WHERE id=?", (book_id,))
    return {"ok": True}

@app.put("/api/admin/books/{book_id}/chapters")
def save_chapter(book_id: str, body: ChapterInput, _: dict = Depends(admin_user)):
    with db() as c:
        get_existing_book(c, book_id)
        c.execute("""INSERT INTO chapters(book_id,number,title,markdown,created_at) VALUES(?,?,?,?,?)
            ON CONFLICT(book_id,number) DO UPDATE SET title=excluded.title,markdown=excluded.markdown""",
            (book_id, body.number, body.title, body.markdown, now()))
        c.execute("UPDATE books SET updated_at=? WHERE id=?", (now(), book_id))
    return {"ok": True, "number": body.number}

@app.delete("/api/admin/books/{book_id}/chapters/{chapter_number}")
def delete_chapter(book_id: str, chapter_number: int, _: dict = Depends(admin_user)):
    with db() as c:
        result = c.execute("DELETE FROM chapters WHERE book_id=? AND number=?", (book_id, chapter_number))
        if result.rowcount == 0:
            fail(404, "Chương không tồn tại")
        c.execute("UPDATE books SET updated_at=? WHERE id=?", (now(), book_id))
    return {"ok": True}

# A single-origin deployment avoids cross-site cookies, CORS and mixed-content issues.
# Keep API declarations above StaticFiles; the latter is a catch-all.
app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="frontend")
