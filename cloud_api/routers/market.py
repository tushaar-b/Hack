import os
from fastapi import APIRouter
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()

@router.get("/regime")
def get_market_regime():
    """
    Returns the latest macro data (Nifty 50, VIX, etc.) to establish the market regime.
    """
    res = supabase.table('macro_daily').select('*').order('trade_date', desc=True).limit(1).execute()
    if not res.data:
        return {"status": "unknown"}
    
    latest = res.data[0]
    vix = latest.get('india_vix', 0)
    
    regime = "NORMAL"
    if vix > 25:
        regime = "HIGH_VOLATILITY"
    elif vix < 12:
        regime = "LOW_VOLATILITY"
        
    return {
        "trade_date": latest['trade_date'],
        "nifty_50": latest['nifty_50'],
        "india_vix": vix,
        "usd_inr": latest.get('usd_inr'),
        "regime": regime
    }

@router.get("/news")
def get_market_news(limit: int = 30):
    """
    Returns the latest market-wide news headlines from the news_sentiment table.
    """
    res = supabase.table('news_sentiment').select('*').order('published_at', desc=True).limit(limit).execute()
    return res.data
