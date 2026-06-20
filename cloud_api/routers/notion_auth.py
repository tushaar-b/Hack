import os
import hashlib
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import jwt
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

NOTION_API_KEY  = os.environ.get("NOTION_API_KEY",       "").strip()
USERS_DB_ID     = os.environ.get("NOTION_USERS_DB_ID",    "").strip()
WATCHLIST_DB_ID = os.environ.get("NOTION_WATCHLIST_DB_ID","").strip()
TRADELOG_DB_ID  = os.environ.get("NOTION_TRADELOG_DB_ID", "").strip()
SSO_SECRET_KEY  = os.environ.get("SSO_SECRET_KEY", "my_super_secret_sso_key").strip()

NOTION_VERSION = "2022-06-28"
NOTION_BASE    = "https://api.notion.com/v1"

router = APIRouter()

# ─── Notion HTTP helpers ──────────────────────────────────────────────────────

def _headers():
    return {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }

def _get(endpoint: str):
    with httpx.Client(timeout=15) as c:
        r = c.get(f"{NOTION_BASE}/{endpoint}", headers=_headers())
        r.raise_for_status()
        return r.json()

def _post(endpoint: str, body: dict):
    with httpx.Client(timeout=15) as c:
        r = c.post(f"{NOTION_BASE}/{endpoint}", headers=_headers(), json=body)
        r.raise_for_status()
        return r.json()

def _patch(endpoint: str, body: dict):
    with httpx.Client(timeout=15) as c:
        r = c.patch(f"{NOTION_BASE}/{endpoint}", headers=_headers(), json=body)
        r.raise_for_status()
        return r.json()

# ─── Property extraction helpers ─────────────────────────────────────────────

def _title(prop) -> str:
    try:
        return prop["title"][0]["text"]["content"]
    except (KeyError, IndexError, TypeError):
        return ""

def _rich(prop) -> str:
    try:
        return prop["rich_text"][0]["text"]["content"]
    except (KeyError, IndexError, TypeError):
        return ""

def _select(prop) -> Optional[str]:
    try:
        return prop["select"]["name"]
    except (KeyError, TypeError):
        return None

def _date(prop) -> Optional[str]:
    try:
        return prop["date"]["start"]
    except (KeyError, TypeError):
        return None

def _num(prop) -> Optional[float]:
    return prop.get("number") if prop else None

# ─── Password ─────────────────────────────────────────────────────────────────

def _hash(password: str) -> str:
    """SHA-256 — matches the scheme used by NeuroX/AarthiAI Notion users table."""
    return hashlib.sha256(password.encode()).hexdigest()

# ═══════════════════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════════════════

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class SSOLoginRequest(BaseModel):
    token: str

@router.post("/login")
def login(req: LoginRequest):
    email   = req.email.strip().lower()
    pw_hash = _hash(req.password)

    try:
        result = _post(f"databases/{USERS_DB_ID}/query", {
            "filter": {"property": "Email", "title": {"equals": email}}
        })
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Notion error: {e.response.text}")

    pages = result.get("results", [])
    if not pages:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    page  = pages[0]
    props = page["properties"]

    # Locate property keys case-insensitively
    pw_key   = next((k for k in props if k.lower() == "password"), None)
    name_key = next((k for k in props if k.lower() == "name"),     None)

    stored_hash = _rich(props[pw_key])   if pw_key   else ""
    name        = _rich(props[name_key]) if name_key else email.split("@")[0]

    if stored_hash != pw_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "user": {
            "id":           page["id"],
            "email":        email,
            "name":         name,
            "notionPageId": page["id"],
        }
    }

@router.post("/signup")
def signup(req: SignupRequest):
    email   = req.email.strip().lower()
    pw_hash = _hash(req.password)

    # Prevent duplicate registrations
    try:
        check = _post(f"databases/{USERS_DB_ID}/query", {
            "filter": {"property": "Email", "title": {"equals": email}}
        })
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Notion error: {e.response.text}")

    if check.get("results"):
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    body = {
        "parent": {"database_id": USERS_DB_ID},
        "properties": {
            "Email":    {"title":     [{"type": "text", "text": {"content": email}}]},
            "Password": {"rich_text": [{"type": "text", "text": {"content": pw_hash}}]},
            "Name":     {"rich_text": [{"type": "text", "text": {"content": req.name}}]},
        }
    }
    try:
        page = _post("pages", body)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Notion error: {e.response.text}")

    return {
        "success": True,
        "user": {
            "id":           page["id"],
            "email":        email,
            "name":         req.name,
            "notionPageId": page["id"],
        }
    }

@router.post("/sso")
def sso_login(req: SSOLoginRequest):
    try:
        payload = jwt.decode(req.token, SSO_SECRET_KEY, algorithms=["HS256"])
        email = payload.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Invalid token payload")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="SSO token expired")
    except Exception as e:
        print("JWT ERROR:", repr(e))
        raise HTTPException(status_code=401, detail=f"Invalid SSO token: {repr(e)}")

    email = email.strip().lower()

    try:
        result = _post(f"databases/{USERS_DB_ID}/query", {
            "filter": {"property": "Email", "title": {"equals": email}}
        })
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Notion error: {e.response.text}")

    pages = result.get("results", [])
    if not pages:
        # Auto-create user for seamless SSO
        name = email.split("@")[0]
        import secrets
        pw_hash = _hash(secrets.token_urlsafe(16))
        
        body = {
            "parent": {"database_id": USERS_DB_ID},
            "properties": {
                "Email":    {"title":     [{"type": "text", "text": {"content": email}}]},
                "Password": {"rich_text": [{"type": "text", "text": {"content": pw_hash}}]},
                "Name":     {"rich_text": [{"type": "text", "text": {"content": name}}]},
            }
        }
        try:
            page = _post("pages", body)
            return {
                "user": {
                    "id":           page["id"],
                    "email":        email,
                    "name":         name,
                    "notionPageId": page["id"],
                }
            }
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Notion error: {e.response.text}")

    page  = pages[0]
    props = page["properties"]
    name_key = next((k for k in props if k.lower() == "name"), None)
    name     = _rich(props[name_key]) if name_key else email.split("@")[0]

    return {
        "user": {
            "id":           page["id"],
            "email":        email,
            "name":         name,
            "notionPageId": page["id"],
        }
    }

# ═══════════════════════════════════════════════════════════════════════════════
# WATCHLIST
# ═══════════════════════════════════════════════════════════════════════════════

class WatchlistAddRequest(BaseModel):
    email: str
    symbol: str

@router.get("/watchlist")
def get_watchlist(email: str):
    email = email.strip().lower()
    result = _post(f"databases/{WATCHLIST_DB_ID}/query", {
        "filter": {"property": "User Email", "email": {"equals": email}},
        "sorts":  [{"timestamp": "created_time", "direction": "ascending"}],
    })
    items = []
    for page in result.get("results", []):
        props   = page["properties"]
        sym_key = next((k for k in props if props[k]["type"] == "title"), "Symbol")
        sym     = _title(props[sym_key])
        if sym:
            items.append({"id": page["id"], "symbol": sym})
    return items

@router.post("/watchlist")
def add_to_watchlist(req: WatchlistAddRequest):
    email  = req.email.strip().lower()
    symbol = req.symbol.strip().upper()

    # Duplicate guard
    existing = _post(f"databases/{WATCHLIST_DB_ID}/query", {
        "filter": {
            "and": [
                {"property": "User Email", "email": {"equals": email}},
                {"property": "Symbol",     "title": {"equals": symbol}},
            ]
        }
    })
    if existing.get("results"):
        raise HTTPException(status_code=400, detail="Symbol already in watchlist")

    page = _post("pages", {
        "parent": {"database_id": WATCHLIST_DB_ID},
        "properties": {
            "Symbol":     {"title": [{"type": "text", "text": {"content": symbol}}]},
            "User Email": {"email": email},
            "Added at":   {"date":  {"start": datetime.utcnow().date().isoformat()}},
        }
    })
    return {"id": page["id"], "symbol": symbol}

@router.delete("/watchlist/{page_id}")
def remove_from_watchlist(page_id: str):
    _patch(f"pages/{page_id}", {"archived": True})
    return {"success": True}

# ═══════════════════════════════════════════════════════════════════════════════
# TRADE LOG
# ═══════════════════════════════════════════════════════════════════════════════

class TradeAddRequest(BaseModel):
    email:       str
    symbol:      str
    side:        str   # BUY | SELL
    entry_price: float
    qty:         float
    entry_date:  str
    notes:       Optional[str] = ""

class TradeCloseRequest(BaseModel):
    exit_price: float
    exit_date:  str

@router.get("/trades")
def get_trades(email: str):
    email  = email.strip().lower()
    result = _post(f"databases/{TRADELOG_DB_ID}/query", {
        "filter": {"property": "User Email", "email": {"equals": email}},
        "sorts":  [{"timestamp": "created_time", "direction": "descending"}],
    })
    trades = []
    for page in result.get("results", []):
        props = page["properties"]
        trades.append({
            "id":          page["id"],
            "symbol":      _rich  (props.get("Symbol",      {})),
            "side":        _select(props.get("Side",        {})),
            "entry_price": _num   (props.get("Entry Price", {})),
            "qty":         _num   (props.get("Qty",         {})),
            "entry_date":  _date  (props.get("Entry Date",  {})),
            "exit_price":  _num   (props.get("Exit Price",  {})),
            "exit_date":   _date  (props.get("Exit Date",   {})),
            "status":      _select(props.get("Status",      {})) or "Open",
            "notes":       _rich  (props.get("Notes",       {})),
        })
    return trades

@router.post("/trades")
def add_trade(req: TradeAddRequest):
    email  = req.email.strip().lower()
    symbol = req.symbol.strip().upper()
    title  = f"{email.split('@')[0]} · {symbol} · {req.entry_date}"

    props = {
        "Title":       {"title":     [{"type": "text", "text": {"content": title}}]},
        "User Email":  {"email":     email},
        "Symbol":      {"rich_text": [{"type": "text", "text": {"content": symbol}}]},
        "Side":        {"select":    {"name": req.side.upper()}},
        "Entry Price": {"number":    req.entry_price},
        "Qty":         {"number":    req.qty},
        "Entry Date":  {"date":      {"start": req.entry_date}},
        "Status":      {"select":    {"name": "Open"}},
    }
    if req.notes:
        props["Notes"] = {"rich_text": [{"type": "text", "text": {"content": req.notes}}]}

    page = _post("pages", {"parent": {"database_id": TRADELOG_DB_ID}, "properties": props})
    return {"id": page["id"], "success": True}

@router.patch("/trades/{page_id}/close")
def close_trade(page_id: str, req: TradeCloseRequest):
    _patch(f"pages/{page_id}", {
        "properties": {
            "Exit Price": {"number": req.exit_price},
            "Exit Date":  {"date":   {"start": req.exit_date}},
            "Status":     {"select": {"name": "Closed"}},
        }
    })
    return {"success": True}

@router.delete("/trades/{page_id}")
def delete_trade(page_id: str):
    _patch(f"pages/{page_id}", {"archived": True})
    return {"success": True}
