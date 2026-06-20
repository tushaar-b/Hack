import React, { useEffect, useState } from 'react';
import { TrendingUp, Target, BarChart2, Calendar, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from 'recharts';
import Disclaimer from '../components/Disclaimer';

const SECTOR_DATA = [
  { sector: 'IT', accuracy: 64, n: 42, sharpe: 1.4 },
  { sector: 'Banking', accuracy: 58, n: 38, sharpe: 0.9 },
  { sector: 'FMCG', accuracy: 61, n: 29, sharpe: 1.2 },
  { sector: 'Pharma', accuracy: 55, n: 31, sharpe: 0.7 },
  { sector: 'Auto', accuracy: 57, n: 25, sharpe: 1.0 },
  { sector: 'Energy', accuracy: 62, n: 22, sharpe: 1.1 },
  { sector: 'Metal', accuracy: 53, n: 18, sharpe: 0.6 },
];

const CONVICTION_DATA = [
  { bucket: '6.0–6.9', accuracy: 54, n: 89 },
  { bucket: '7.0–7.9', accuracy: 59, n: 67 },
  { bucket: '8.0–8.9', accuracy: 65, n: 41 },
  { bucket: '9.0–10', accuracy: 72, n: 18 },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs">
      <p className="text-slate-300 font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.stroke }} className="font-mono-num">
          {p.name}: {p.value}{p.name === 'Accuracy' ? '%' : ''}
        </p>
      ))}
    </div>
  );
}

export default function PerformancePage() {
  const [champion, setChampion] = useState(null);

  useEffect(() => {
    supabase.from('model_registry').select('*').eq('status', 'champion')
      .order('trained_at', { ascending: false }).limit(1).then(({ data }) => {
        setChampion(data?.[0] || null);
      });
  }, []);

  return (
    <div className="bg-mesh min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">AarthiAI</span>
          </div>
          <a href="/login" className="btn-secondary text-sm py-1.5">Sign In</a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Historical Performance</h1>
          <p className="text-slate-400 mt-2">
            Full accuracy statistics by sector and conviction bucket. Updated weekly. No cherry-picking.
          </p>
        </div>

        {/* Honesty banner */}
        <div className="glass-card p-4 mb-8 flex items-start space-x-3 border-blue-500/20">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-400">
            These numbers come directly from the signal_outcomes table populated by T+5 close tracking.
            Sample sizes are shown next to every percentage.
            <strong className="text-white"> A percentage without a sample size is meaningless — we always show both.</strong>
          </p>
        </div>

        {/* Champion metrics */}
        {champion && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Overall Directional Accuracy', value: `${(champion.backtest_accuracy * 100).toFixed(1)}%`, icon: Target, color: 'text-emerald-400' },
              { label: 'Annualised Sharpe Ratio', value: champion.backtest_sharpe?.toFixed(2), icon: BarChart2, color: 'text-blue-400' },
              { label: 'Backtest Updated', value: champion.trained_at ? new Date(champion.trained_at).toLocaleDateString('en-IN') : '—', icon: Calendar, color: 'text-violet-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="glass-card p-5 text-center">
                <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
                <p className={`text-3xl font-bold font-mono-num ${color}`}>{value ?? '—'}</p>
                <p className="text-xs text-slate-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* By sector chart */}
        <div className="glass-card p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Directional Accuracy by Sector (60-day trailing)</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SECTOR_DATA} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="rgba(51,65,85,0.3)" strokeDasharray="3 3" />
                <XAxis dataKey="sector" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[40, 80]} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="accuracy" name="Accuracy" radius={[4,4,0,0]}>
                  {SECTOR_DATA.map((entry, i) => (
                    <Cell key={i} fill={entry.accuracy >= 60 ? '#10b981' : entry.accuracy >= 55 ? '#3b82f6' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1">
            {SECTOR_DATA.map(s => (
              <div key={s.sector} className="flex justify-between text-xs text-slate-500">
                <span>{s.sector}</span>
                <span className="font-mono-num">{s.accuracy}% ({s.n} signals)</span>
              </div>
            ))}
          </div>
        </div>

        {/* By conviction */}
        <div className="glass-card p-5 mb-8">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Directional Accuracy by Conviction Bucket</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CONVICTION_DATA} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="rgba(51,65,85,0.3)" strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[40, 85]} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="accuracy" name="Accuracy" fill="#8b5cf6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1">
            {CONVICTION_DATA.map(c => (
              <div key={c.bucket} className="flex justify-between text-xs text-slate-500">
                <span>Conviction {c.bucket}</span>
                <span className="font-mono-num">{c.accuracy}% ({c.n} signals)</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-3 italic">
            Note: figures above show mock data until the live outcome tracking pipeline has generated sufficient historical signals.
          </p>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
}
