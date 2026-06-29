import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { settingsApi } from '../../services/api';

export function SettingsNavigation() {
  const links = [
    { name: 'General Settings', path: '/settings', icon: 'settings' },
    { name: 'User Management', path: '/settings/users', icon: 'manage_accounts' },
    { name: 'System Policies', path: '/settings/policies', icon: 'gavel' },
    { name: 'Branches', path: '/settings/branches', icon: 'domain' },
    { name: 'Areas', path: '/settings/areas', icon: 'map' },
    { name: 'Agents', path: '/settings/agents', icon: 'support_agent' },
    { name: 'Plans', path: '/settings/plans', icon: 'workspace_premium' }
  ];

  return (
    <div className="flex border-b border-border-fin overflow-x-auto space-x-6 mb-6">
      {links.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            window.location.pathname === link.path
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary-text hover:text-primary-text'
          }`}
        >
          <span className="material-symbols-rounded text-sm select-none">{link.icon}</span>
          {link.name}
        </Link>
      ))}
    </div>
  );
}

const EDITABLE_KEYS = [
  'company_name', 'company_tagline',
  'allow_registrations', 'allow_collections', 'allow_sunday_collections', 'mandatory_kyc', 'custom_interest_rate',
  'defaulter_days', 'npa_days', 'disbursement_limit', 'sync_interval_seconds'
];

export default function General() {
  const [form, setForm] = useState(null);
  const [readOnly, setReadOnly] = useState({ currency_symbol: '', currency_code: '', timezone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = () => {
    setLoading(true);
    settingsApi.get()
      .then(res => {
        const d = res.data || {};
        setForm({
          company_name: d.company_name ?? '',
          company_tagline: d.company_tagline ?? '',
          allow_registrations: !!d.allow_registrations,
          allow_collections: !!d.allow_collections,
          allow_sunday_collections: !!d.allow_sunday_collections,
          mandatory_kyc: !!d.mandatory_kyc,
          custom_interest_rate: !!d.custom_interest_rate,
          defaulter_days: Number(d.defaulter_days ?? 30),
          npa_days: Number(d.npa_days ?? 90),
          disbursement_limit: Number(d.disbursement_limit ?? 0),
          sync_interval_seconds: Number(d.sync_interval_seconds ?? 15)
        });
        setReadOnly({
          currency_symbol: d.currency_symbol ?? '₹',
          currency_code: d.currency_code ?? 'INR',
          timezone: d.timezone ?? 'Asia/Kolkata'
        });
        setError('');
      })
      .catch(err => setError(err?.message || 'Failed to load settings'))
      .finally(() => setLoading(false));
  };

  const handleField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!form) return;
    setSaving(true);
    const payload = {};
    EDITABLE_KEYS.forEach(k => { payload[k] = form[k]; });
    settingsApi.update(payload)
      .then(() => {
        alert('Settings saved successfully.');
        loadSettings();
      })
      .catch(err => alert(err?.message || 'Failed to save settings.'))
      .finally(() => setSaving(false));
  };

  if (loading || !form) {
    return (
      <div className="space-y-6">
        <SettingsNavigation />
        <div className="bg-surface p-10 rounded-2xl border border-border-fin shadow-sm text-center text-secondary-text text-xs font-bold">
          {error ? error : 'Loading settings…'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsNavigation />

      <div className="bg-surface p-6 rounded-2xl border border-border-fin shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-bold text-primary-text mb-1">General System Settings</h3>
          <p className="text-xs text-secondary-text">Core settings for Umbrella Finance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">Company Name</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => handleField('company_name', e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-border-fin rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">Tagline</label>
              <input
                type="text"
                value={form.company_tagline}
                onChange={(e) => handleField('company_tagline', e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-border-fin rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">Currency</label>
              <input
                type="text"
                value={`${readOnly.currency_symbol} (${readOnly.currency_code})`}
                disabled
                className="w-full px-4 py-3 bg-background-fin/70 border border-border-fin rounded-xl text-sm font-medium text-secondary-text cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">System Timezone</label>
              <input
                type="text"
                value={readOnly.timezone}
                disabled
                className="w-full px-4 py-3 bg-background-fin/70 border border-border-fin rounded-xl text-sm font-medium text-secondary-text cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Operational Toggles */}
        <div className="pt-2">
          <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider mb-3">Operational Toggles</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['allow_registrations', 'Allow New Customer Registrations'],
              ['allow_collections', 'Allow Daily Collections'],
              ['allow_sunday_collections', 'Allow Sunday Collections'],
              ['mandatory_kyc', 'Mandatory KYC on Registration'],
              ['custom_interest_rate', 'Allow Custom Interest Rate per Loan']
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 px-4 py-3 bg-background-fin/40 border border-border-fin rounded-xl cursor-pointer select-none">
                <span className="text-xs font-bold text-primary-text">{label}</span>
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={(e) => handleField(key, e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Numeric Limits */}
        <div className="pt-2">
          <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider mb-3">Risk & Operational Limits</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['defaulter_days', 'Defaulter Days'],
              ['npa_days', 'NPA Days'],
              ['disbursement_limit', 'Disbursement Limit (₹)'],
              ['sync_interval_seconds', 'Sync Interval (sec)']
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-[10px] font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">{label}</label>
                <input
                  type="number"
                  min="0"
                  value={form[key]}
                  onChange={(e) => handleField(key, Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-surface border border-border-fin rounded-xl text-sm font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border-fin">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
