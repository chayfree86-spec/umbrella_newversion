import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SettingsNavigation } from './General';
import { Select } from '../../components/ui/Select';
import { userApi, settingsApi } from '../../services/api';

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);

  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    mobile: '',
    policy_id: '',
    password: '',
    confirmPassword: '',
    pin: '',
    confirmPin: ''
  });

  useEffect(() => {
    // Load user from API
    userApi.get(id)
      .then(res => {
        const u = res.data;
        setUser(u);
        setProfileData(prev => ({
          ...prev,
          name: u.name || '',
          email: u.email || '',
          mobile: u.mobile || '',
          policy_id: String(u.policy_id || '')
        }));
      })
      .catch(() => {
        alert('System user not found.');
        navigate('/settings/users');
      });

    // Load policy profiles
    settingsApi.policies.list()
      .then(res => setProfiles(res.data || []))
      .catch(() => {});
  }, [id, navigate]);

  const handleSaveInfo = (e) => {
    e.preventDefault();
    if (!profileData.name || !profileData.mobile) {
      alert('Please fill out Name and Mobile Number.');
      return;
    }

    userApi.update(id, {
      name: profileData.name,
      email: profileData.email,
      mobile: profileData.mobile,
      role_id: user.role_id,
      branch_id: user.branch_id,
      area_id: user.area_id,
      agent_id: user.agent_id,
      status: user.status,
      policy_id: profileData.policy_id || null
    })
      .then(() => {
        setUser(prev => ({ ...prev, name: profileData.name, email: profileData.email, mobile: profileData.mobile }));
        alert('User profile information updated successfully.');
      })
      .catch(err => {
        alert(err.message || 'Failed to update profile.');
      });
  };

  const handleUpdateCredentials = (e) => {
    e.preventDefault();

    if (profileData.password) {
      if (profileData.password.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
      }
      if (profileData.password !== profileData.confirmPassword) {
        alert('New Password and Confirm Password do not match.');
        return;
      }
    }

    if (profileData.pin) {
      if (profileData.pin.length !== 4 || isNaN(profileData.pin)) {
        alert('Security PIN must be a 4-digit numeric code.');
        return;
      }
      if (profileData.pin !== profileData.confirmPin) {
        alert('New PIN and Confirm PIN do not match.');
        return;
      }
    }

    if (!profileData.password && !profileData.pin) {
      alert('Please enter a new password or PIN to update credentials.');
      return;
    }

    userApi.resetPassword(id, profileData.password || undefined, profileData.pin || undefined)
      .then(() => {
        setProfileData(prev => ({ ...prev, password: '', confirmPassword: '', pin: '', confirmPin: '' }));
        let message = 'Credentials updated successfully:';
        if (profileData.password) message += ' Password updated.';
        if (profileData.pin) message += ' Security PIN updated.';
        alert(message);
      })
      .catch(err => {
        alert(err.message || 'Failed to update credentials.');
      });
  };

  if (!user) return (
    <div className="space-y-6">
      <SettingsNavigation />
      <div className="flex items-center justify-center py-20 text-secondary-text text-sm">Loading profile...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <SettingsNavigation />

      {/* Profile Header Card */}
      <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              // Agent-linked user hai to seedhe uske agent profile par wapas
              // jao (reload/direct-load par bhi sahi jagah), warna history back.
              if (user.agent_id && user.role_slug === 'agent') {
                navigate(`/settings/agent/${user.agent_id}`);
              } else {
                navigate(-1);
              }
            }}
            className="w-11 h-11 bg-slate-50 hover:bg-slate-100 text-secondary-text rounded-xl border border-border-fin cursor-pointer transition-all active:scale-90 flex items-center justify-center"
            title="Back"
          >
            <span className="material-symbols-rounded text-base font-black select-none">arrow_back</span>
          </button>
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
            <span className="material-symbols-rounded text-2xl select-none">person</span>
          </div>
          <div>
            <h3 className="text-base font-black text-primary-text">{user.name}</h3>
            <div className="flex flex-wrap gap-2 mt-1.5 items-center">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                user.role_name === 'Super Admin' ? 'bg-primary/10 text-primary' :
                user.role_name === 'Branch Manager' ? 'bg-success-fin/10 text-success-fin' :
                user.role_name === 'Area Manager' ? 'bg-warning-fin/10 text-warning-fin' :
                'bg-accent/10 text-accent'
              }`}>
                {user.role_name}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                user.status === 'Active' ? 'bg-success-fin/10 text-success-fin' : 'bg-danger-fin/10 text-danger-fin'
              }`}>
                {user.status}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-secondary-text space-y-1">
          <p className="font-semibold text-primary-text">{user.mobile}</p>
          <p>{user.email || 'No email set'}</p>
          <p className="text-[10px] uppercase tracking-wide">User ID: #{user.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info Form */}
        <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-sm font-bold text-primary-text mb-1">Basic Information</h4>
            <p className="text-xs text-secondary-text">Update name, contact details, and policy assignment</p>
          </div>

          <form onSubmit={handleSaveInfo} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Full Name <span className="text-danger-fin">*</span></label>
              <input
                type="text"
                required
                value={profileData.name}
                onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Mobile Number <span className="text-danger-fin">*</span></label>
              <input
                type="tel"
                required
                value={profileData.mobile}
                onChange={(e) => setProfileData(prev => ({ ...prev, mobile: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
              />
            </div>
            <div className="space-y-1">
              <Select
                label="Policy Profile"
                options={profiles.map(p => ({ value: String(p.id), label: p.name }))}
                value={profileData.policy_id}
                onChange={(val) => setProfileData(prev => ({ ...prev, policy_id: val }))}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer"
            >
              Save Information
            </button>
          </form>
        </div>

        {/* Credentials Form */}
        <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-sm font-bold text-primary-text mb-1">Security Credentials</h4>
            <p className="text-xs text-secondary-text">Change password or update the 4-digit mobile login PIN</p>
          </div>

          <form onSubmit={handleUpdateCredentials} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">New Password</label>
              <input
                type="password"
                placeholder="Leave blank to keep current"
                value={profileData.password}
                onChange={(e) => setProfileData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Confirm New Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={profileData.confirmPassword}
                onChange={(e) => setProfileData(prev => ({ ...prev, confirmPassword: e.target.value }))}
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
                  value={profileData.pin}
                  onChange={(e) => setProfileData(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
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
                  value={profileData.confirmPin}
                  onChange={(e) => setProfileData(prev => ({ ...prev, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-warning-fin text-white rounded-xl text-xs font-bold hover:bg-warning-fin/90 transition-all cursor-pointer"
            >
              Update Credentials
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
