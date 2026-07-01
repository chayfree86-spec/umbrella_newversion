import React, { useState } from 'react';
import { SettingsNavigation } from './General';

export default function AdminSecurity() {
  const [profile, setProfile] = useState({
    name: 'Sandeep Kumar',
    email: 'admin@umbrellafinance.in',
    mobile: '9876543210'
  });

  const [security, setSecurity] = useState({
    currentPin: '',
    newPin: '',
    confirmPin: ''
  });

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    if (!profile.name || !profile.email || !profile.mobile) {
      alert('Please fill out all profile fields.');
      return;
    }
    alert('Admin profile updated successfully.');
  };

  const handleChangeSecurity = (e) => {
    e.preventDefault();
    if (!security.currentPin || !security.newPin || !security.confirmPin) {
      alert('Please fill out all password/PIN fields.');
      return;
    }
    if (security.newPin !== security.confirmPin) {
      alert('New Password/PIN and Confirm Password/PIN do not match.');
      return;
    }
    alert('Admin security credentials updated successfully.');
    setSecurity({ currentPin: '', newPin: '', confirmPin: '' });
  };

  return (
    <div className="space-y-6">
      <SettingsNavigation />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-surface p-6 rounded-2xl border border-border-fin shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-primary-text mb-1">Admin Profile Info</h3>
            <p className="text-xs text-secondary-text">Update admin email, name and mobile number</p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">Admin Name <span className="text-danger-fin">*</span></label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-surface border border-border-fin rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">Email Address <span className="text-danger-fin">*</span></label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 bg-surface border border-border-fin rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">Mobile Number <span className="text-danger-fin">*</span></label>
              <input
                type="tel"
                value={profile.mobile}
                onChange={(e) => setProfile(prev => ({ ...prev, mobile: e.target.value }))}
                className="w-full px-4 py-3 bg-surface border border-border-fin rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-border-fin">
              <button
                type="submit"
                className="px-6 py-3 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
              >
                Update Profile
              </button>
            </div>
          </form>
        </div>

        {/* Credentials Security Card */}
        <div className="bg-surface p-6 rounded-2xl border border-border-fin shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-primary-text mb-1">Security & Credentials</h3>
            <p className="text-xs text-secondary-text">Change admin login password or transactional security PIN</p>
          </div>

          <form onSubmit={handleChangeSecurity} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">Current Password / PIN <span className="text-danger-fin">*</span></label>
              <input
                type="password"
                placeholder="••••••••"
                value={security.currentPin}
                onChange={(e) => setSecurity(prev => ({ ...prev, currentPin: e.target.value }))}
                className="w-full px-4 py-3 bg-surface border border-border-fin rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">New Password / PIN <span className="text-danger-fin">*</span></label>
              <input
                type="password"
                placeholder="••••••••"
                value={security.newPin}
                onChange={(e) => setSecurity(prev => ({ ...prev, newPin: e.target.value }))}
                className="w-full px-4 py-3 bg-surface border border-border-fin rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary-text mb-1.5 uppercase tracking-wider">Confirm New Password / PIN <span className="text-danger-fin">*</span></label>
              <input
                type="password"
                placeholder="••••••••"
                value={security.confirmPin}
                onChange={(e) => setSecurity(prev => ({ ...prev, confirmPin: e.target.value }))}
                className="w-full px-4 py-3 bg-surface border border-border-fin rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-border-fin">
              <button
                type="submit"
                className="px-6 py-3 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
              >
                Change Credentials
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
