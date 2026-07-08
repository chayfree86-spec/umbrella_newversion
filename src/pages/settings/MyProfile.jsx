import React, { useState, useEffect } from 'react';
import { authApi } from '../../services/api';

/**
 * MyProfile — logged-in user (mainly Agent) ki apni profile.
 * Details READ-ONLY hain; sirf password / PIN change kar sakte hain.
 */
export default function MyProfile() {
  const [profile, setProfile] = useState(null);
  const [creds, setCreds] = useState({
    password: '', confirmPassword: '', pin: '', confirmPin: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authApi.profile()
      .then(res => setProfile(res.data))
      .catch(() => {
        // Fallback localStorage se basic info
        setProfile({
          name: localStorage.getItem('username') || 'User',
          role: localStorage.getItem('userRole') || '',
          mobile: '',
          email: ''
        });
      });
  }, []);

  const handleUpdateCredentials = (e) => {
    e.preventDefault();

    if (creds.password) {
      if (creds.password.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
      }
      if (creds.password !== creds.confirmPassword) {
        alert('New Password and Confirm Password do not match.');
        return;
      }
    }
    if (creds.pin) {
      if (creds.pin.length !== 4 || isNaN(creds.pin)) {
        alert('Security PIN must be a 4-digit numeric code.');
        return;
      }
      if (creds.pin !== creds.confirmPin) {
        alert('New PIN and Confirm PIN do not match.');
        return;
      }
    }
    if (!creds.password && !creds.pin) {
      alert('Please enter a new password or PIN to update.');
      return;
    }

    setSaving(true);
    authApi.changePassword(creds.password || undefined, creds.pin || undefined)
      .then(() => {
        setCreds({ password: '', confirmPassword: '', pin: '', confirmPin: '' });
        let msg = 'Credentials updated:';
        if (creds.password) msg += ' Password changed.';
        if (creds.pin) msg += ' PIN changed.';
        alert(msg);
      })
      .catch(err => alert(err.message || 'Failed to update credentials.'))
      .finally(() => setSaving(false));
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary-text text-sm">
        Loading profile...
      </div>
    );
  }

  const roleName = profile.role || profile.role_name || '';

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
            <span className="material-symbols-rounded text-2xl select-none">badge</span>
          </div>
          <div>
            <h3 className="text-base font-black text-primary-text">{profile.name}</h3>
            <div className="flex flex-wrap gap-2 mt-1.5 items-center">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent/10 text-accent">
                {roleName}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-secondary-text space-y-1">
          <p className="font-semibold text-primary-text">{profile.mobile || '—'}</p>
          <p>{profile.email || 'No email set'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Read-only details */}
        <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-sm font-bold text-primary-text mb-1">My Details</h4>
            <p className="text-xs text-secondary-text">View-only — contact admin to change these.</p>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Full Name', value: profile.name },
              { label: 'Role', value: roleName },
              { label: 'Mobile Number', value: profile.mobile },
              { label: 'Email Address', value: profile.email || '—' }
            ].map((f, i) => (
              <div key={i} className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">{f.label}</label>
                <div className="w-full px-4 py-3 bg-slate-100/70 border border-border-fin rounded-xl text-sm font-semibold text-primary-text select-none">
                  {f.value || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Change password / PIN */}
        <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-sm font-bold text-primary-text mb-1">Security Credentials</h4>
            <p className="text-xs text-secondary-text">Change your password or 4-digit mobile login PIN</p>
          </div>

          <form onSubmit={handleUpdateCredentials} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">New Password</label>
              <input
                type="password"
                placeholder="Leave blank to keep current"
                value={creds.password}
                onChange={(e) => setCreds(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Confirm New Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={creds.confirmPassword}
                onChange={(e) => setCreds(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
              />
            </div>

            <div className="border-t border-border-fin pt-4 space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">New 4-Digit Security PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4-digit PIN"
                  value={creds.pin}
                  onChange={(e) => setCreds(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Confirm New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Confirm 4-digit PIN"
                  value={creds.confirmPin}
                  onChange={(e) => setCreds(prev => ({ ...prev, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-warning-fin text-white rounded-xl text-xs font-bold hover:bg-warning-fin/90 transition-all cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Updating…' : 'Update Credentials'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
