import sqlite3, hashlib, secrets, os, smtplib
from datetime import datetime, timedelta
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

DB_PATH = Path(__file__).parent / "users.db"

EMAIL_USER = os.environ.get("EMAIL_USER", "")
EMAIL_PASS = os.environ.get("EMAIL_PASS", "")
SITE_URL = os.environ.get("SITE_URL", "https://toolmarket.onrender.com")

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
        db.execute("""CREATE TABLE IF NOT EXISTS reset_tokens (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )""")
        db.commit()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def send_email(to_email: str, subject: str, html_body: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = EMAIL_USER
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.sendmail(EMAIL_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False

def send_reset_email(to_email: str, token: str) -> bool:
    reset_link = f"{SITE_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#1a202c;color:#e2e8f0;padding:32px;border-radius:12px">
      <h2 style="color:#667eea;margin-bottom:8px">🔧 ToolMarket Monitor</h2>
      <p style="color:#a0aec0;margin-bottom:24px">Восстановление пароля</p>
      <p>Вы запросили сброс пароля. Нажмите кнопку ниже:</p>
      <a href="{reset_link}" style="display:inline-block;background:#667eea;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">
        Сбросить пароль
      </a>
      <p style="font-size:.85rem;color:#718096;margin-top:24px">
        Ссылка действует <strong>1 час</strong>.<br>
        Если вы не запрашивали сброс — просто проигнорируйте это письмо.
      </p>
    </div>
    """
    return send_email(to_email, "Восстановление пароля — ToolMarket Monitor", html)

def create_reset_token(email: str):
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE email=?", (email.lower().strip(),)).fetchone()
        if not user:
            return {"ok": False, "error": "Email не найден"}
        token = secrets.token_hex(32)
        expires = (datetime.now() + timedelta(hours=1)).isoformat()
        db.execute("INSERT INTO reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
                  (token, user["id"], expires))
        db.commit()
        sent = send_reset_email(email, token)
        if sent:
            return {"ok": True}
        return {"ok": False, "error": "Ошибка отправки письма"}

def reset_password(token: str, new_password: str):
    with get_db() as db:
        row = db.execute("""SELECT * FROM reset_tokens
            WHERE token=? AND used=0 AND expires_at > datetime('now')""", (token,)).fetchone()
        if not row:
            return {"ok": False, "error": "Ссылка недействительна или истекла"}
        db.execute("UPDATE users SET password_hash=? WHERE id=?",
                  (hash_password(new_password), row["user_id"]))
        db.execute("UPDATE reset_tokens SET used=1 WHERE token=?", (token,))
        db.commit()
        return {"ok": True}

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
    if not token: return None
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
