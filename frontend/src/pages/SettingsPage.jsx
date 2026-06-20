import React, { useState } from 'react';
import { Settings, Bell, MessageCircle, User, Save, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import Disclaimer from '../components/Disclaimer';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [telegram, setTelegram] = useState({ enabled: false, chatId: '' });
  const [alerts, setAlerts] = useState({ minConviction: 6, emailOnBuy: true, emailOnSell: false });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="bg-mesh min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Settings className="w-6 h-6 text-slate-400" />
            <span>Settings</span>
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Notification preferences and account settings</p>
        </div>

        {/* Account */}
        <div className="glass-card p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center space-x-2">
            <User className="w-4 h-4" />
            <span>Account</span>
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input value={user?.email || ''} disabled className="input-field opacity-60 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Role</label>
              <input value={user?.user_metadata?.role || 'subscriber'} disabled className="input-field opacity-60 cursor-not-allowed" />
            </div>
          </div>
        </div>

        {/* Telegram */}
        <div className="glass-card p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center space-x-2">
            <MessageCircle className="w-4 h-4 text-blue-400" />
            <span>Telegram Alerts</span>
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Enable Telegram signals</p>
                <p className="text-xs text-slate-500">Receive daily BUY/SELL alerts via Telegram bot</p>
              </div>
              <button
                onClick={() => setTelegram(t => ({...t, enabled: !t.enabled}))}
                className={`relative w-11 h-6 rounded-full transition-colors ${telegram.enabled ? 'bg-blue-500' : 'bg-slate-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${telegram.enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {telegram.enabled && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Telegram Chat ID</label>
                <input
                  value={telegram.chatId}
                  onChange={e => setTelegram(t => ({...t, chatId: e.target.value}))}
                  placeholder="Your Telegram chat ID (start @AarthiAIBot)"
                  className="input-field"
                />
                <p className="text-xs text-slate-500 mt-1">Send /start to @AarthiAIBot to get your Chat ID</p>
              </div>
            )}
          </div>
        </div>

        {/* Alert preferences */}
        <div className="glass-card p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center space-x-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Alert Preferences</span>
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Minimum Conviction for Alerts</label>
              <select
                value={alerts.minConviction}
                onChange={e => setAlerts(a => ({...a, minConviction: Number(e.target.value)}))}
                className="input-field"
              >
                {[4,5,6,7,8,9].map(c => <option key={c} value={c}>{c}/10</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {[
                { key: 'emailOnBuy', label: 'Email on BUY signals' },
                { key: 'emailOnSell', label: 'Email on SELL signals' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-300">{label}</span>
                  <input
                    type="checkbox"
                    checked={alerts[key]}
                    onChange={e => setAlerts(a => ({...a, [key]: e.target.checked}))}
                    className="w-4 h-4 accent-blue-500"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Save */}
        <button onClick={handleSave} className="btn-primary w-full flex items-center justify-center space-x-2">
          {saved ? <CheckCircle className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Settings saved!' : 'Save Settings'}</span>
        </button>

        <div className="mt-8"><Disclaimer /></div>
      </div>
    </div>
  );
}
