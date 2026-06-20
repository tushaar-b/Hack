import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, TrendingUp, TrendingDown, Trash2, CheckCircle, Clock } from 'lucide-react';
import Disclaimer from '../components/Disclaimer';
import { API_URL } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// ─── P&L badge ──────────────────────────────────────────────────────────────
function PnLBadge({ entry, exit, side, qty }) {
  if (exit == null) return <span className="text-slate-400 text-sm">Open</span>;
  const raw = side === 'BUY' ? (exit - entry) * qty : (entry - exit) * qty;
  const pct = side === 'BUY' ? ((exit - entry) / entry * 100) : ((entry - exit) / entry * 100);
  const isPos = raw >= 0;
  return (
    <div className="text-right">
      <p className={`text-sm font-bold font-mono-num ${isPos ? 'text-positive' : 'text-negative'}`}>
        {isPos ? '+' : ''}₹{raw.toFixed(0)}
      </p>
      <p className={`text-xs ${isPos ? 'text-positive' : 'text-negative'}`}>
        {isPos ? '+' : ''}{pct.toFixed(2)}%
      </p>
    </div>
  );
}

// ─── Default mock trades (shown when Notion is empty) ───────────────────────
const DEFAULT_MOCK = [
  { id: 'mock-1', symbol: 'RELIANCE', side: 'BUY', entry_price: 2420, qty: 10, entry_date: '2026-06-01', exit_date: '2026-06-12', exit_price: 2575, status: 'Closed', notes: 'Quantile breakout signal, target hit.' },
  { id: 'mock-2', symbol: 'TCS',      side: 'BUY', entry_price: 3820, qty: 5,  entry_date: '2026-06-03', exit_date: '2026-06-15', exit_price: 4015, status: 'Closed', notes: 'FinBERT positive sentiment support, trend follow.' },
  { id: 'mock-3', symbol: 'INFY',     side: 'BUY', entry_price: 1410, qty: 15, entry_date: '2026-06-05', exit_date: '2026-06-18', exit_price: 1495, status: 'Closed', notes: 'High conviction buy signal, EMA crossover.' },
  { id: 'mock-4', symbol: 'HDFCBANK', side: 'BUY', entry_price: 1495, qty: 20, entry_date: '2026-06-02', exit_date: '2026-06-16', exit_price: 1585, status: 'Closed', notes: 'VIX circuit breaker safe, mean reversion.' },
];

export default function Portfolio() {
  const { user } = useAuthStore();
  const [trades,         setTrades]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [showForm,       setShowForm]       = useState(false);
  const [form,           setForm]           = useState({ symbol: '', side: 'BUY', entryPrice: '', qty: '', entryDate: '', notes: '' });
  const [closingTradeId, setClosingTradeId] = useState(null);
  const [closeForm,      setCloseForm]      = useState({ exitPrice: '', exitDate: '' });
  const [suggestedPrice, setSuggestedPrice] = useState(null);
  const [submitting,     setSubmitting]     = useState(false);

  // Price suggestion when typing a symbol
  useEffect(() => {
    const sym = form.symbol.trim().toUpperCase();
    if (!sym) { setSuggestedPrice(null); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`${API_URL}/forecasts/${sym}?limit=1`);
        if (r.ok) {
          const d = await r.json();
          if (d[0]?.closing_price) {
            setSuggestedPrice(d[0].closing_price);
            setForm(f => f.entryPrice ? f : { ...f, entryPrice: d[0].closing_price });
          } else setSuggestedPrice(null);
        }
      } catch (_) { setSuggestedPrice(null); }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.symbol]);

  // ─── Load from Notion ───────────────────────────────────────────────────────
  async function loadTrades() {
    if (!user?.email) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/notion/trades?email=${encodeURIComponent(user.email)}`);
      const data = res.ok ? await res.json() : [];

      if (data.length > 0) {
        setTrades(data);
      } else {
        // Fall back to localStorage mock on empty
        const local = localStorage.getItem(`trades_${user.id}`);
        setTrades(local ? JSON.parse(local) : DEFAULT_MOCK);
      }
    } catch (err) {
      console.warn('Trade load error, falling back to localStorage:', err.message);
      const local = localStorage.getItem(`trades_${user.id}`);
      setTrades(local ? JSON.parse(local) : DEFAULT_MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTrades(); }, [user]);

  // ─── Add trade ──────────────────────────────────────────────────────────────
  const addTrade = async () => {
    if (!form.symbol || !form.entryPrice || !form.qty) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/notion/trades`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:       user.email,
          symbol:      form.symbol.toUpperCase(),
          side:        form.side,
          entry_price: Number(form.entryPrice),
          qty:         Number(form.qty),
          entry_date:  form.entryDate || new Date().toISOString().split('T')[0],
          notes:       form.notes || '',
        }),
      });
      if (!res.ok) throw new Error('Notion write failed');
      setForm({ symbol: '', side: 'BUY', entryPrice: '', qty: '', entryDate: '', notes: '' });
      setShowForm(false);
      loadTrades();
    } catch (err) {
      console.warn('Add trade error:', err.message);
      // localStorage fallback
      const newTrade = {
        id:          'local-' + Date.now(),
        symbol:      form.symbol.toUpperCase(),
        side:        form.side,
        entry_price: Number(form.entryPrice),
        qty:         Number(form.qty),
        entry_date:  form.entryDate || new Date().toISOString().split('T')[0],
        exit_price:  null,
        exit_date:   null,
        status:      'Open',
        notes:       form.notes || '',
      };
      const updated = [newTrade, ...trades];
      localStorage.setItem(`trades_${user.id}`, JSON.stringify(updated));
      setTrades(updated);
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Close trade ────────────────────────────────────────────────────────────
  const handleCloseTrade = async (id) => {
    if (!closeForm.exitPrice || !closeForm.exitDate) return;
    try {
      if (!id.startsWith('local') && !id.startsWith('mock')) {
        await fetch(`${API_URL}/notion/trades/${id}/close`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ exit_price: Number(closeForm.exitPrice), exit_date: closeForm.exitDate }),
        });
      }
    } catch (err) {
      console.warn('Close trade error:', err.message);
    }
    // Optimistic update
    const updated = trades.map(t =>
      t.id === id ? { ...t, exit_price: Number(closeForm.exitPrice), exit_date: closeForm.exitDate, status: 'Closed' } : t
    );
    localStorage.setItem(`trades_${user.id}`, JSON.stringify(updated));
    setTrades(updated);
    setClosingTradeId(null);
    setCloseForm({ exitPrice: '', exitDate: '' });
  };

  // ─── Delete trade ───────────────────────────────────────────────────────────
  const removeTrade = async (id) => {
    try {
      if (!id.startsWith('local') && !id.startsWith('mock')) {
        await fetch(`${API_URL}/notion/trades/${id}`, { method: 'DELETE' });
      }
    } catch (err) {
      console.warn('Delete trade error:', err.message);
    }
    const updated = trades.filter(t => t.id !== id);
    localStorage.setItem(`trades_${user.id}`, JSON.stringify(updated));
    setTrades(updated);
  };

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const totalPnL = trades.reduce((sum, t) => {
    if (t.exit_price == null) return sum;
    return sum + (t.side === 'BUY' ? (t.exit_price - t.entry_price) * t.qty : (t.entry_price - t.exit_price) * t.qty);
  }, 0);
  const openCount   = trades.filter(t => t.status === 'Open').length;
  const closedWins  = trades.filter(t => t.exit_price != null && (t.side === 'BUY' ? t.exit_price > t.entry_price : t.exit_price < t.entry_price)).length;
  const closedTotal = trades.filter(t => t.exit_price != null).length;
  const winRate     = closedTotal > 0 ? ((closedWins / closedTotal) * 100).toFixed(0) : '—';

  return (
    <div className="bg-mesh min-h-screen p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
              <BookOpen className="w-6 h-6 text-violet-400" />
              <span>Trade Log</span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Manual log only · synced to Notion</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Log Trade</span>
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="glass-card p-4 text-center">
            <p className={`text-2xl font-bold font-mono-num ${totalPnL >= 0 ? 'text-positive' : 'text-negative'}`}>
              {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toFixed(0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Total P&L (closed)</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">{openCount}</p>
            <p className="text-xs text-slate-400 mt-1">Open Positions</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">{winRate}%</p>
            <p className="text-xs text-slate-400 mt-1">Win Rate (N={closedTotal})</p>
          </div>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="glass-card p-5 mb-5 animate-fade-in-up">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Log New Trade</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Symbol</label>
                <input value={form.symbol} onChange={e => setForm(f => ({...f, symbol: e.target.value}))} placeholder="RELIANCE" className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Side</label>
                <select value={form.side} onChange={e => setForm(f => ({...f, side: e.target.value}))} className="input-field">
                  <option>BUY</option>
                  <option>SELL</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-xs text-slate-400">Entry Price (₹)</label>
                  {suggestedPrice && (
                    <button onClick={() => setForm(f => ({...f, entryPrice: suggestedPrice}))} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium">
                      Use: ₹{suggestedPrice}
                    </button>
                  )}
                </div>
                <input type="number" value={form.entryPrice} onChange={e => setForm(f => ({...f, entryPrice: e.target.value}))} placeholder="2450" className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Quantity</label>
                <input type="number" value={form.qty} onChange={e => setForm(f => ({...f, qty: e.target.value}))} placeholder="5" className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Entry Date</label>
                <input type="date" value={form.entryDate} onChange={e => setForm(f => ({...f, entryDate: e.target.value}))} className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Signal conviction, sector..." className="input-field" />
              </div>
            </div>
            <div className="flex space-x-2 mt-4">
              <button onClick={addTrade} disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'Saving...' : 'Add Trade'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {/* Trade list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="shimmer h-24 rounded-xl" />)}
          </div>
        ) : trades.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Your trade log is empty</p>
            <p className="text-sm text-slate-500 mt-1">Log your first trade to start tracking performance</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map(t => (
              <div key={t.id} className="glass-card p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.side === 'BUY' ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
                      {t.side === 'BUY'
                        ? <TrendingUp   className="w-4 h-4 text-emerald-400" />
                        : <TrendingDown className="w-4 h-4 text-rose-400" />}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{t.symbol}</p>
                      <p className="text-xs text-slate-400">{t.side} · {t.qty} shares · ₹{t.entry_price}</p>
                      <p className="text-xs text-slate-500">{t.entry_date}{t.exit_date ? ` → ${t.exit_date}` : ''}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-center hidden sm:block">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === 'Open' ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-500/15 text-slate-400'
                      }`}>{t.status}</span>
                    </div>
                    <PnLBadge entry={t.entry_price} exit={t.exit_price} side={t.side} qty={t.qty} />
                    <div className="flex items-center gap-1">
                      {t.status === 'Open' && (
                        <button
                          onClick={() => { setClosingTradeId(closingTradeId === t.id ? null : t.id); setCloseForm({ exitPrice: '', exitDate: '' }); }}
                          className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-slate-600 hover:text-emerald-400 transition-colors"
                          title="Close Position"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => removeTrade(t.id)} className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-600 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {closingTradeId === t.id && (
                  <div className="pt-3 border-t border-slate-800 flex items-end gap-3 animate-fade-in-up">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1">Exit Price (₹)</label>
                      <input type="number" value={closeForm.exitPrice} onChange={e => setCloseForm(f => ({...f, exitPrice: e.target.value}))} placeholder="e.g. 2500" className="input-field py-1.5 text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1">Exit Date</label>
                      <input type="date" value={closeForm.exitDate} onChange={e => setCloseForm(f => ({...f, exitDate: e.target.value}))} className="input-field py-1.5 text-sm" />
                    </div>
                    <button onClick={() => handleCloseTrade(t.id)} className="btn-primary py-1.5 px-3 text-sm h-[38px]">Confirm</button>
                    <button onClick={() => setClosingTradeId(null)} className="btn-secondary py-1.5 px-3 text-sm h-[38px]">Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8"><Disclaimer /></div>
      </div>
    </div>
  );
}
