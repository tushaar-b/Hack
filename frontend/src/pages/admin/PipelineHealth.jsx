import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/supabase';

function StatusRow({ label, lastRun, staleDays = 1 }) {
  const isStale = !lastRun || (Date.now() - new Date(lastRun).getTime()) > staleDays * 24 * 3600 * 1000;
  const icon = isStale
    ? <XCircle className="w-4 h-4 text-rose-400" />
    : <CheckCircle className="w-4 h-4 text-emerald-400" />;

  const timeAgo = lastRun
    ? (() => {
        const ms = Date.now() - new Date(lastRun).getTime();
        const h = Math.floor(ms / 3600000);
        const d = Math.floor(h / 24);
        return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : 'Recently';
      })()
    : 'Never run';

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${
      isStale ? 'bg-rose-500/5 border-rose-500/20' : 'bg-emerald-500/5 border-emerald-500/20'
    }`}>
      <div className="flex items-center space-x-2.5">
        {icon}
        <span className="text-sm text-slate-200">{label}</span>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium font-mono-num ${isStale ? 'text-rose-400' : 'text-emerald-400'}`}>{timeAgo}</p>
        {lastRun && <p className="text-xs text-slate-500">{new Date(lastRun).toLocaleString('en-IN')}</p>}
      </div>
    </div>
  );
}

export default function AdminPipeline() {
  const [market, setMarket] = useState(null);
  const [forecastCount, setForecastCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastForecastDate, setLastForecastDate] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [mRes] = await Promise.all([
          fetch(`${API_URL}/market/regime`),
        ]);
        if (mRes.ok) setMarket(await mRes.json());

        const { data: forecasts } = await supabase
          .from('forecasts')
          .select('forecast_date, created_at')
          .order('forecast_date', { ascending: false })
          .limit(1);
        
        if (forecasts?.[0]) {
          setLastForecastDate(forecasts[0].created_at || forecasts[0].forecast_date);
        }

        const { count } = await supabase
          .from('forecasts')
          .select('id', { count: 'exact', head: true });
        setForecastCount(count);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const sources = [
    { label: 'Bhavcopy (OHLCV)', lastRun: lastForecastDate, staleDays: 2 },
    { label: 'Forecast Generation (LightGBM)', lastRun: lastForecastDate, staleDays: 2 },
    { label: 'Market Macro (Nifty/VIX)', lastRun: market?.trade_date ? new Date(market.trade_date).toISOString() : null, staleDays: 2 },
    { label: 'RSS News + FinBERT Sentiment', lastRun: null, staleDays: 2 },
    { label: 'Weekly Fundamentals', lastRun: null, staleDays: 8 },
    { label: 'Signal Outcome Tracking (T+5)', lastRun: null, staleDays: 7 },
  ];

  return (
    <div className="bg-mesh min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Activity className="w-6 h-6 text-blue-400" />
            <span>Pipeline Health</span>
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Data freshness per source · Admin only</p>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-4 text-center">
            <Database className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{forecastCount ?? '—'}</p>
            <p className="text-xs text-slate-400">Total Forecasts</p>
          </div>
          <div className="glass-card p-4 text-center">
            <Activity className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{market?.nifty_50?.toLocaleString('en-IN') ?? '—'}</p>
            <p className="text-xs text-slate-400">Last Nifty 50</p>
          </div>
          <div className="glass-card p-4 text-center">
            <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{market?.india_vix?.toFixed(1) ?? '—'}</p>
            <p className="text-xs text-slate-400">India VIX</p>
          </div>
        </div>

        {/* Source statuses */}
        <div className="glass-card p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Data Source Status</h2>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="shimmer h-14 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map(s => <StatusRow key={s.label} {...s} />)}
            </div>
          )}
        </div>

        {/* Run instructions */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Running the Pipeline</h2>
          <p className="text-xs text-slate-400 mb-3">
            The local pipeline runs on your machine via Task Scheduler. To trigger a manual run:
          </p>
          <div className="bg-slate-900/60 rounded-lg p-3 font-mono text-xs text-emerald-400 space-y-1">
            <p>cd C:\path\to\aarthiai\local_engine</p>
            <p>python run_pipeline.py</p>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            The pipeline: downloads bhavcopy → builds features → runs FinBERT → trains/scores LightGBM → pushes to Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
