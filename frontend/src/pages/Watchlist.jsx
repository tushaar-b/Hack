import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, Clock, Plus, Search, Trash2, ChevronRight } from 'lucide-react';
import { API_URL } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import Disclaimer from '../components/Disclaimer';

export default function Watchlist() {
  const { user }    = useAuthStore();
  const navigate    = useNavigate();
  const [watchlist, setWatchlist]   = useState([]); // [{ id, symbol }]
  const [forecasts, setForecasts]   = useState({});
  const [search,    setSearch]      = useState('');
  const [addSymbol, setAddSymbol]   = useState('');
  const [loading,   setLoading]     = useState(true);
  const [adding,    setAdding]      = useState(false);
  const [error,     setError]       = useState(null);

  // ─── Load from Notion ───────────────────────────────────────────────────────
  async function loadWatchlist() {
    if (!user?.email) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/notion/watchlist?email=${encodeURIComponent(user.email)}`);
      const data = res.ok ? await res.json() : [];
      setWatchlist(data);

      // Fetch latest forecast for each symbol from Supabase signal API (unchanged)
      const fmap = {};
      await Promise.all(data.map(async ({ symbol: sym }) => {
        try {
          const r = await fetch(`${API_URL}/forecasts/${sym}?limit=1`);
          if (r.ok) {
            const d = await r.json();
            if (d[0]) fmap[sym] = d[0];
          }
        } catch (_) {}
      }));
      setForecasts(fmap);
    } catch (err) {
      console.error('Watchlist load error', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadWatchlist(); }, [user]);

  // ─── Add ────────────────────────────────────────────────────────────────────
  const addToWatchlist = async () => {
    const sym = addSymbol.trim().toUpperCase();
    if (!sym) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/notion/watchlist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: user.email, symbol: sym }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add symbol');
      setAddSymbol('');
      loadWatchlist();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  // ─── Remove ─────────────────────────────────────────────────────────────────
  const removeFromWatchlist = async (pageId, sym) => {
    try {
      await fetch(`${API_URL}/notion/watchlist/${pageId}`, { method: 'DELETE' });
      setWatchlist(w => w.filter(x => x.id !== pageId));
      setForecasts(f => { const n = { ...f }; delete n[sym]; return n; });
    } catch (err) {
      console.error('Remove watchlist error', err);
    }
  };

  const filtered = watchlist.filter(({ symbol: s }) => !search || s.includes(search.toUpperCase()));

  return (
    <div className="bg-mesh min-h-screen p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Star className="w-6 h-6 text-amber-400" />
              <span>Watchlist</span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Track your favourite Nifty 500 stocks · synced to Notion</p>
          </div>
        </div>

        {/* Add symbol */}
        <div className="glass-card p-4 mb-3 flex gap-3">
          <input
            value={addSymbol}
            onChange={e => setAddSymbol(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addToWatchlist()}
            placeholder="Add symbol (e.g. RELIANCE)"
            className="input-field flex-1"
          />
          <button onClick={addToWatchlist} disabled={adding} className="btn-primary flex items-center space-x-1">
            <Plus className="w-4 h-4" />
            <span>{adding ? '...' : 'Add'}</span>
          </button>
        </div>
        {error && <p className="text-rose-400 text-xs mb-3 px-1">{error}</p>}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter watchlist..."
            className="input-field pl-9"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="shimmer h-16 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Star className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Your watchlist is empty</p>
            <p className="text-sm text-slate-500 mt-1">Add symbols above to track their signals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(({ id: pageId, symbol: sym }) => {
              const f      = forecasts[sym];
              const stance = f?.signal_stance || null;
              return (
                <div
                  key={pageId}
                  className="glass-card p-4 flex items-center justify-between cursor-pointer hover:border-blue-500/30 transition-all"
                  onClick={() => navigate(`/stock/${sym}`)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{sym[0]}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">{sym}</p>
                      {f && <p className="text-xs text-slate-400">₹{f.closing_price} · {f.forecast_date}</p>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {stance && (
                      <span className={`badge-${stance.toLowerCase()} px-2.5 py-1 rounded-full text-xs font-bold flex items-center space-x-1`}>
                        {stance === 'BUY'  && <TrendingUp   className="w-3 h-3" />}
                        {stance === 'SELL' && <TrendingDown className="w-3 h-3" />}
                        {stance === 'HOLD' && <Clock        className="w-3 h-3" />}
                        <span>{stance}</span>
                      </span>
                    )}
                    {f && <span className="text-xs font-mono-num text-slate-400">{f.conviction_score}/10</span>}
                    <button
                      onClick={e => { e.stopPropagation(); removeFromWatchlist(pageId, sym); }}
                      className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-600 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8"><Disclaimer /></div>
      </div>
    </div>
  );
}
