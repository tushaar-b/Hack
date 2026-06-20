import os
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()

@router.get("/")
def list_active_universe():
    """
    Returns the list of active stocks in the universe.
    """
    res = supabase.table('universe').select('*').eq('is_active', True).execute()
    return res.data

@router.get("/{symbol}")
def get_stock_profile(symbol: str):
    """
    Returns profile information (sector, cap, etc.) and latest sentiment/features.
    """
    res = supabase.table('universe').select('*').eq('symbol', symbol.upper()).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Symbol not found in universe")
        
    profile = res.data[0]
    
    # Fetch latest features
    feat_res = supabase.table('daily_features').select('*').eq('symbol', symbol.upper()).order('trade_date', desc=True).limit(1).execute()
    if feat_res.data:
        profile['latest_features'] = feat_res.data[0]
    else:
        profile['latest_features'] = {}
        
    # Fetch fundamentals
    fund_res = supabase.table('fundamentals_weekly').select('*').eq('symbol', symbol.upper()).order('as_of_date', desc=True).limit(1).execute()
    if fund_res.data:
        fund_data = fund_res.data[0]
        # Merge mappings for the frontend
        profile['latest_features']['trailing_pe'] = fund_data.get('trailing_pe')
        profile['latest_features']['debt_equity'] = fund_data.get('debt_equity')
        profile['latest_features']['roce'] = fund_data.get('return_on_equity')
        profile['latest_features']['revenue_growth'] = fund_data.get('revenue_growth_yoy')
        profile['latest_features']['eps_growth'] = fund_data.get('eps_growth_yoy')
        profile['latest_features']['current_ratio'] = fund_data.get('current_ratio')

    # Fetch actual last 60 days of closes from ohlcv_daily for the chart
    ohlcv_res = supabase.table('ohlcv_daily').select('trade_date, close').eq('symbol', symbol.upper()).order('trade_date', desc=True).limit(60).execute()
    if ohlcv_res.data:
        profile['last_close_date'] = ohlcv_res.data[0]['trade_date']
        profile['last_close_price'] = ohlcv_res.data[0]['close']
        profile['price_history'] = ohlcv_res.data
    else:
        profile['price_history'] = []

    # Fetch sentiment
    sent_res = supabase.table('news_sentiment').select('*').eq('symbol', symbol.upper()).order('published_at', desc=True).limit(5).execute()
    profile['news'] = sent_res.data if sent_res.data else []
        
    return profile
