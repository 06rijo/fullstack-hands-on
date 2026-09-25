"""
Shadow Protocol — backend API

Covers, at a "playable vertical slice" level, the account/profile/progression
side of the user stories in Epics 1, 2 and 9:
  - create account / login (01, 02)
  - edit profile (03)
  - cloud-saved profile + stats, always read/written server-side (04, 05)
  - loadout: primary/secondary weapon selection (08, 09)
  - XP, levels, match stats, leaderboard (41, 42, 44)

Auth is intentionally simple (salted-hash passwords + opaque bearer tokens in
SQLite) — good enough for a local/LAN game, not a production identity system.
"""
import hashlib
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = os.environ.get("DB_PATH", "/data/shadow.db")
WEAPONS_PRIMARY = ["assault_rifle", "smg", "marksman_rifle", "shotgun"]
WEAPONS_SECONDARY = ["pistol", "machine_pistol"]

app = FastAPI(title="Shadow Protocol API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local/dev game client; tighten for real deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def xp_for_level(level: int) -> int:
    """XP required to reach the next level. Simple escalating curve."""
    return 100 + (level - 1) * 60


@contextmanager
def db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                avatar_color TEXT DEFAULT '#4ade80',
                primary_weapon TEXT DEFAULT 'assault_rifle',
                secondary_weapon TEXT DEFAULT 'pistol',
                level INTEGER DEFAULT 1,
                xp INTEGER DEFAULT 0,
                matches_played INTEGER DEFAULT 0,
                kills INTEGER DEFAULT 0,
                deaths INTEGER DEFAULT 0,
                headshots INTEGER DEFAULT 0,
                best_wave INTEGER DEFAULT 0,
                created_at REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tokens (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at REAL NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)


@app.on_event("startup")
def on_startup():
    init_db()


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode()).hexdigest()


def user_public(row: sqlite3.Row) -> dict:
    return {
        "username": row["username"],
        "avatar_color": row["avatar_color"],
        "primary_weapon": row["primary_weapon"],
        "secondary_weapon": row["secondary_weapon"],
        "level": row["level"],
        "xp": row["xp"],
        "xp_to_next": xp_for_level(row["level"]),
        "matches_played": row["matches_played"],
        "kills": row["kills"],
        "deaths": row["deaths"],
        "headshots": row["headshots"],
        "best_wave": row["best_wave"],
    }


def get_current_user(authorization: Optional[str] = Header(None)) -> sqlite3.Row:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    with db() as conn:
        row = conn.execute(
            "SELECT users.* FROM tokens JOIN users ON tokens.user_id = users.id "
            "WHERE tokens.token = ?",
            (token,),
        ).fetchone()
    if not row:
        raise HTTPException(401, "Invalid or expired token")
    return row


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=4, max_length=100)


class LoginRequest(BaseModel):
    username: str
    password: str


class ProfileUpdate(BaseModel):
    avatar_color: Optional[str] = None


class LoadoutUpdate(BaseModel):
    primary_weapon: str
    secondary_weapon: str


class MatchResult(BaseModel):
    kills: int = 0
    deaths: int = 0
    headshots: int = 0
    wave_reached: int = 1
    xp_earned: int = 0


def issue_token(user_id: int) -> str:
    token = secrets.token_hex(24)
    with db() as conn:
        conn.execute(
            "INSERT INTO tokens (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, time.time()),
        )
    return token


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/register")
def register(body: RegisterRequest):
    salt = secrets.token_hex(8)
    pw_hash = hash_password(body.password, salt)
    with db() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?", (body.username,)
        ).fetchone()
        if existing:
            raise HTTPException(409, "Username already taken")
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, salt, created_at) "
            "VALUES (?, ?, ?, ?)",
            (body.username, pw_hash, salt, time.time()),
        )
        user_id = cur.lastrowid
    token = issue_token(user_id)
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"token": token, "profile": user_public(row)}


@app.post("/api/auth/login")
def login(body: LoginRequest):
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (body.username,)
        ).fetchone()
    if not row or hash_password(body.password, row["salt"]) != row["password_hash"]:
        raise HTTPException(401, "Invalid username or password")
    token = issue_token(row["id"])
    return {"token": token, "profile": user_public(row)}


@app.get("/api/profile")
def get_profile(user: sqlite3.Row = Depends(get_current_user)):
    return user_public(user)


@app.post("/api/profile")
def update_profile(body: ProfileUpdate, user: sqlite3.Row = Depends(get_current_user)):
    if body.avatar_color:
        with db() as conn:
            conn.execute(
                "UPDATE users SET avatar_color = ? WHERE id = ?",
                (body.avatar_color, user["id"]),
            )
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return user_public(row)


@app.get("/api/loadout/options")
def loadout_options():
    return {"primary": WEAPONS_PRIMARY, "secondary": WEAPONS_SECONDARY}


@app.post("/api/loadout")
def update_loadout(body: LoadoutUpdate, user: sqlite3.Row = Depends(get_current_user)):
    if body.primary_weapon not in WEAPONS_PRIMARY:
        raise HTTPException(400, "Unknown primary weapon")
    if body.secondary_weapon not in WEAPONS_SECONDARY:
        raise HTTPException(400, "Unknown secondary weapon")
    with db() as conn:
        conn.execute(
            "UPDATE users SET primary_weapon = ?, secondary_weapon = ? WHERE id = ?",
            (body.primary_weapon, body.secondary_weapon, user["id"]),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return user_public(row)


@app.post("/api/match/submit")
def submit_match(body: MatchResult, user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        level, xp = row["level"], row["xp"] + max(0, body.xp_earned)
        while xp >= xp_for_level(level):
            xp -= xp_for_level(level)
            level += 1
        conn.execute(
            """UPDATE users SET
                level = ?, xp = ?, matches_played = matches_played + 1,
                kills = kills + ?, deaths = deaths + ?, headshots = headshots + ?,
                best_wave = MAX(best_wave, ?)
               WHERE id = ?""",
            (level, xp, max(0, body.kills), max(0, body.deaths),
             max(0, body.headshots), max(0, body.wave_reached), user["id"]),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    leveled_up = level > user["level"]
    return {"profile": user_public(row), "leveled_up": leveled_up}


@app.get("/api/leaderboard")
def leaderboard(limit: int = 10):
    with db() as conn:
        rows = conn.execute(
            "SELECT username, level, xp, kills, best_wave FROM users "
            "ORDER BY level DESC, xp DESC, kills DESC LIMIT ?",
            (min(max(limit, 1), 50),),
        ).fetchall()
    return [dict(r) for r in rows]
