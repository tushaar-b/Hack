import os
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import create_client, Client
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()

@router.get("/latest")
def get_latest_forecasts(limit: int = 50, stance: Optional[str] = None):
    """
    Returns the most recent forecasts, sorted by Conviction Score.
    Optionally filter by stance (BUY/SELL).
    """
    query = supabase.table('forecasts').select('*')
    if stance:
        query = query.eq('signal_stance', stance.upper())
        
    # We want the most recent date
    # But since we can't easily do a subquery in PostgREST for MAX(date),
    # we just sort by date desc, and conviction_score desc
    res = query.order('forecast_date', desc=True).order('conviction_score', desc=True).limit(limit).execute()
    data = res.data

    if data:
        # Fetch sectors for these symbols manually
        symbols = list(set(r['symbol'] for r in data))
        uni_res = supabase.table('universe').select('symbol, sector').in_('symbol', symbols).execute()
        sector_map = {u['symbol']: u['sector'] for u in uni_res.data}
        
        for r in data:
            r['universe'] = {'sector': sector_map.get(r['symbol'], 'Unknown')}
            
    return data

@router.get("/{symbol}")
def get_forecast_history(symbol: str, limit: int = 30):
    """
    Returns the historical forecasts for a specific symbol to render charts.
    """
    res = supabase.table('forecasts').select('*').eq('symbol', symbol.upper()).order('forecast_date', desc=True).limit(limit).execute()
    return res.data
