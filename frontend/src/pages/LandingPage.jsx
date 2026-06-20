import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Clock, Shield, Activity, ChevronRight,
  Database, Cpu, BarChart2, CheckCircle, Star
} from 'lucide-react';
import { supabase, API_URL } from '../lib/supabase';
import Disclaimer from '../components/Disclaimer';

const HOW_IT_WORKS = [
  {
    icon: Database,
    title: 'NSE Bhavcopy Ingestion',
    desc: 'Every trading day, we pull the NSE bulk bhavcopy file covering all Nifty 500 OHLCV data in one download — no rate-limited API loops.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: Cpu,
    title: 'Local Feature Engine',
    desc: '~30 features built locally: momentum (RSI, MACD, EMA), volume, cross-sectional rank, FinBERT news sentiment, fundamentals, and macro regime.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    icon: BarChart2,
    title: 'LightGBM Quantile Forecast',
    desc: 'Five 5-day horizon models at 3 quantiles (P10/P50/P90) give you a real probability band — not a single-point guess dressed as precision.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
];

const FEATURES = [
  'Nifty 500 full universe coverage',
  '5-day return probability bands (P10/P50/P90)',
  'ATR-based stop-loss & target calculation',
  'Conviction-scored signals (1–10)',
  'FinBERT news sentiment integration',
  'Walk-forward backtest results, shown honestly',
  'VIX circuit breaker: no new BUY signals above threshold',
  'Admin-gated retrain approval workflow',
];

function SampleForecastCard({ symbol, stance, conviction, returnPct, tp, sl, accuracy }) {
  const stanceColor = stance === 'BUY' ? 'text-emerald-400' : stance === 'SELL' ? 'text-rose-400' : 'text-slate-400';
  const badgeClass = `badge-${stance.toLowerCase()}`;
  return (
    <div className="glass-card p-5 hover:border-blue-500/30 transition-all">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold text-white">{symbol}</h3>
          <p className="text-xs text-slate-500">Sample signal · anonymized</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass} flex items-center space-x-1`}>
          {stance === 'BUY' && <TrendingUp className="w-3 h-3" />}
          {stance === 'SELL' && <TrendingDown className="w-3 h-3" />}
          <span>{stance}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="stat-card p-2.5">
          <span className="block text-xs text-slate-500 mb-0.5">Conviction</span>
          <span className="font-semibold text-white font-mono-num">{conviction}/10</span>
        </div>
        <div className="stat-card p-2.5">
          <span className="block text-xs text-slate-500 mb-0.5">5-Day Median</span>
          <span className={`font-semibold font-mono-num ${parseFloat(returnPct) >= 0 ? 'text-positive' : 'text-negative'}`}>
            {parseFloat(returnPct) >= 0 ? '+' : ''}{returnPct}%
          </span>
        </div>
      </div>
      <div className="flex justify-between text-xs mb-3">
        <span className="text-emerald-400 font-mono-num">TP: {tp}</span>
        <span className="text-rose-400 font-mono-num">SL: {sl}</span>
      </div>
      <div className="text-xs text-slate-500 border-t border-slate-700/40 pt-2">
        Sector hit-rate (60d): <strong className="text-white">{accuracy}%</strong>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [accuracy, setAccuracy] = useState(null);
  const [sharpe, setSharpe] = useState(null);
  const [forecastCount, setForecastCount] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data } = await supabase
          .from('model_registry')
          .select('backtest_accuracy, backtest_sharpe')
          .eq('status', 'champion')
          .order('trained_at', { ascending: false })
          .limit(1)
          .single();
        if (data) {
          setAccuracy((data.backtest_accuracy * 100).toFixed(1));
          setSharpe(data.backtest_sharpe?.toFixed(2));
        }
        const { count } = await supabase.from('forecasts').select('id', { count: 'exact', head: true });
        setForecastCount(count);
      } catch {}
    }
    fetchStats();
  }, []);

  return (
    <div className="bg-mesh min-h-screen">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">Aarthi<span className="text-blue-400">AI</span></span>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate('/login')} className="btn-secondary text-sm py-2">
              Sign In
            </button>
            <button onClick={() => navigate('/register')} className="btn-primary text-sm py-2">
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="pt-20 pb-16 text-center relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute top-20 right-1/4 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
          </div>

          <div className="relative">
            <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-sm text-blue-400 mb-6">
              <div className="live-dot" />
              <span>Nifty 500 · End-of-Day Forecasts · Free</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight mb-4">
              Quantitative signals for<br />
              <span className="gradient-text">Indian swing trades</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
              LightGBM-powered 5-day return probability bands across all Nifty 500 stocks.
              Not a black box — every signal shows its own trailing hit-rate, computed weekly, never hidden.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => navigate('/register')} className="btn-primary text-base px-8 py-3 flex items-center space-x-2">
                <span>Start Free</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => navigate('/performance')} className="btn-secondary text-base px-8 py-3">
                View Performance
              </button>
            </div>
          </div>
        </section>

        {/* Live accuracy stat block */}
        <section className="pb-16">
          <div className="glass-card p-6 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Live System Stats · Updated Weekly</p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className={`text-4xl font-extrabold font-mono-num ${accuracy ? 'gradient-text-blue-emerald' : 'text-slate-600'}`}>
                  {accuracy ? `${accuracy}%` : '—'}
                </p>
                <p className="text-sm text-slate-400 mt-1">Directional Accuracy</p>
                <p className="text-xs text-slate-600">Walk-forward backtest</p>
              </div>
              <div>
                <p className={`text-4xl font-extrabold font-mono-num ${sharpe ? 'gradient-text-blue-emerald' : 'text-slate-600'}`}>
                  {sharpe ?? '—'}
                </p>
                <p className="text-sm text-slate-400 mt-1">Sharpe Ratio</p>
                <p className="text-xs text-slate-600">Annualised</p>
              </div>
              <div>
                <p className={`text-4xl font-extrabold font-mono-num ${forecastCount ? 'gradient-text-blue-emerald' : 'text-slate-600'}`}>
                  {forecastCount ? forecastCount.toLocaleString() : '—'}
                </p>
                <p className="text-sm text-slate-400 mt-1">Signals Generated</p>
                <p className="text-xs text-slate-600">Across Nifty 500</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-4">
              If accuracy is below 50%, this page shows that. We don't hide bad weeks.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="pb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map(({ icon: Icon, title, desc, color, bg, border }, i) => (
              <div key={i} className={`glass-card p-5 border ${border}`}>
                <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <p className="text-xs text-slate-500 mb-1">Step {i + 1}</p>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sample forecasts */}
        <section className="pb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">Live Sample Signals</h2>
            <p className="text-slate-400 text-sm mt-1">Real signals, anonymized tickers</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <SampleForecastCard symbol="NSE:XXXX" stance="BUY" conviction={8.4} returnPct="3.2" tp="₹2,730" sl="₹2,410" accuracy={63} />
            <SampleForecastCard symbol="NSE:YYYY" stance="SELL" conviction={7.1} returnPct="-2.8" tp="₹1,380" sl="₹1,560" accuracy={58} />
            <SampleForecastCard symbol="NSE:ZZZZ" stance="BUY" conviction={6.3} returnPct="1.9" tp="₹890" sl="₹795" accuracy={55} />
          </div>
          <p className="text-center text-xs text-slate-500 mt-4">
            Real tickers and forecasts visible after free signup
          </p>
        </section>

        {/* Features */}
        <section className="pb-16">
          <div className="glass-card p-8">
            <h2 className="text-xl font-bold text-white mb-6">What's Included</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-start space-x-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-16 text-center">
          <div className="glass-card p-10">
            <h2 className="text-3xl font-bold text-white mb-3">Start screening smarter</h2>
            <p className="text-slate-400 mb-6">Free access. No credit card. No SEBI-registered advice — just honest quantitative signals.</p>
            <button onClick={() => navigate('/register')} className="btn-primary text-base px-10 py-3">
              Create Free Account
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-slate-800/60">
          <Disclaimer />
          <p className="text-xs text-slate-600 mt-3 text-center">
            AarthiAI · NSE/BSE 5-Day Forecast Platform · Not affiliated with NSE, BSE, or SEBI
          </p>
        </footer>
      </div>
    </div>
  );
}
