import sqlite3, hashlib, secrets, os
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "users.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            query TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL,
            added_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(user_id, query, category)
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            query TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            recorded_at TEXT DEFAULT (datetime('now'))
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )""")
        db.commit()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_user(email: str, password: str):
    try:
        with get_db() as db:
            db.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)",
                      (email.lower().strip(), hash_password(password)))
            db.commit()
        return {"ok": True}
    except sqlite3.IntegrityError:
        return {"ok": False, "error": "Email уже зарегистрирован"}

def login_user(email: str, password: str):
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE email=? AND password_hash=?",
                         (email.lower().strip(), hash_password(password))).fetchone()
        if not user:
            return {"ok": False, "error": "Неверный email или пароль"}
        token = secrets.token_hex(32)
        expires = (datetime.now() + timedelta(days=30)).isoformat()
        db.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
                  (token, user["id"], expires))
        db.commit()
        return {"ok": True, "token": token, "email": user["email"]}

def get_user_by_token(token: str):
    if not token:
        return None
    with get_db() as db:
        row = db.execute("""SELECT u.* FROM users u
            JOIN sessions s ON s.user_id = u.id
            WHERE s.token=? AND s.expires_at > datetime('now')""", (token,)).fetchone()
        return dict(row) if row else None

def logout_user(token: str):
    with get_db() as db:
        db.execute("DELETE FROM sessions WHERE token=?", (token,))
        db.commit()

def get_watchlist(user_id: int):
    with get_db() as db:
        rows = db.execute("SELECT * FROM watchlist WHERE user_id=? ORDER BY added_at DESC", (user_id,)).fetchall()
        return [dict(r) for r in rows]

def add_to_watchlist(user_id: int, query: str, category: str, price: float = None):
    try:
        with get_db() as db:
            db.execute("INSERT OR IGNORE INTO watchlist (user_id, query, category, price) VALUES (?, ?, ?, ?)",
                      (user_id, query, category, price))
            db.execute("UPDATE watchlist SET price=? WHERE user_id=? AND query=? AND category=?",
                      (price, user_id, query, category))
            db.commit()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def remove_from_watchlist(user_id: int, query: str, category: str):
    with get_db() as db:
        db.execute("DELETE FROM watchlist WHERE user_id=? AND query=? AND category=?",
                  (user_id, query, category))
        db.commit()
    return {"ok": True}

def add_price_history(user_id: int, query: str, category: str, price: float):
    with get_db() as db:
        db.execute("INSERT INTO price_history (user_id, query, category, price) VALUES (?, ?, ?, ?)",
                  (user_id, query, category, price))
        db.commit()

def get_price_history(user_id: int, query: str, category: str):
    with get_db() as db:
        rows = db.execute("""SELECT price, recorded_at FROM price_history
            WHERE user_id=? AND query=? AND category=?
            ORDER BY recorded_at DESC LIMIT 30""", (user_id, query, category)).fetchall()
        return [dict(r) for r in rows]

def update_watchlist_prices(user_id: int, updates: list):
    with get_db() as db:
        for upd in updates:
            db.execute("UPDATE watchlist SET price=? WHERE user_id=? AND query=? AND category=?",
                      (upd["price"], user_id, upd["query"], upd["category"]))
        db.commit()
