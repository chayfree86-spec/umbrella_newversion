import React, { useState, useEffect } from 'react';
import { SettingsNavigation } from './General';
import { Select } from '../../components/ui/Select';
import { settingsApi } from '../../services/api';

export default function Policies() {
  const [globalParams, setGlobalParams] = useState({
    allow_registrations: true,
    mandatory_kyc: true,
    allow_collections: true,
    allow_sunday_collections: true,
    defaulter_days: 30,
    disbursement_limit: 50000
  });

  const [profiles, setProfiles] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    role: 'Agent / Collection Executive',
    allow_login: true,
    allow_disbursement: false,
    allow_agent_assignment: false,
    allow_out_area: false,
    max_limit: 10000,
    allow_online_apply: false,
    allow_backdated: false,
    session_timeout: 30
  });

  // Load from API on mount
  useEffect(() => {
    fetchGlobalsAndProfiles();
  }, []);

  const fetchGlobalsAndProfiles = () => {
    // Load global settings
    settingsApi.get()
      .then(res => {
        const data = res.data || {};
        setGlobalParams({
          allow_registrations: data.allow_registrations !== undefined ? data.allow_registrations : true,
          mandatory_kyc: data.mandatory_kyc !== undefined ? data.mandatory_kyc : true,
          allow_collections: data.allow_collections !== undefined ? data.allow_collections : true,
          allow_sunday_collections: data.allow_sunday_collections !== undefined ? data.allow_sunday_collections : true,
          defaulter_days: data.defaulter_days !== undefined ? Number(data.defaulter_days) : 30,
          disbursement_limit: data.disbursement_limit !== undefined ? Number(data.disbursement_limit) : 50000
        });
      })
      .catch(() => {});

    // Load policy profiles
    settingsApi.policies.list()
      .then(res => {
        setProfiles(res.data || []);
      })
      .catch(() => {});
  };

  const handleToggleGlobal = (key) => {
    const updatedVal = !globalParams[key];
    const updatedParams = { ...globalParams, [key]: updatedVal };
    setGlobalParams(updatedParams);

    settingsApi.update({ [key]: updatedVal })
      .then(() => {
        // Update local session storage if layout depends on it
        localStorage.setItem(key, String(updatedVal));
      })
      .catch(() => {});
  };

  const handleNumParamChange = (key, value) => {
    const numVal = parseInt(value) || 0;
    const updatedParams = { ...globalParams, [key]: numVal };
    setGlobalParams(updatedParams);

    settingsApi.update({ [key]: numVal })
      .then(() => {
        localStorage.setItem(key, String(numVal));
      })
      .catch(() => {});
  };

  const handleOpenCreate = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      role: 'Agent / Collection Executive',
      allow_login: true,
      allow_disbursement: false,
      allow_agent_assignment: false,
      allow_out_area: false,
      max_limit: 10000,
      allow_online_apply: false,
      allow_backdated: false,
      session_timeout: 30
    });
    setShowFormModal(true);
  };

  const handleOpenEdit = (prof) => {
    if (prof.is_system) {
      alert('System policy profiles cannot be modified.');
      return;
    }
    setEditingProfile(prof);
    setFormData({
      name: prof.name,
      role: prof.role,
      allow_login: prof.allow_login === 1 || prof.allow_login === true,
      allow_disbursement: prof.allow_disbursement === 1 || prof.allow_disbursement === true,
      allow_agent_assignment: prof.allow_agent_assignment === 1 || prof.allow_agent_assignment === true,
      allow_out_area: prof.allow_out_area === 1 || prof.allow_out_area === true,
      max_limit: Number(prof.max_limit) || 10000,
      allow_online_apply: prof.allow_online_apply === 1 || prof.allow_online_apply === true,
      allow_backdated: prof.allow_backdated === 1 || prof.allow_backdated === true,
      session_timeout: Number(prof.session_timeout) || 30
    });
    setShowFormModal(true);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Please enter a policy name.');
      return;
    }

    if (editingProfile) {
      settingsApi.policies.update(editingProfile.id, formData)
        .then(() => {
          fetchGlobalsAndProfiles();
          setShowFormModal(false);
          alert('Policy profile updated successfully.');
        })
        .catch(err => {
          alert(err.message || 'Failed to update policy.');
        });
    } else {
      settingsApi.policies.create(formData)
        .then(() => {
          fetchGlobalsAndProfiles();
          setShowFormModal(false);
          alert('New policy profile created successfully.');
        })
        .catch(err => {
          alert(err.message || 'Failed to create policy.');
        });
    }
  };

  const handleDeleteProfile = async (id) => {
    if (await window.confirm('Are you sure you want to delete this policy profile?')) {
      settingsApi.policies.delete(id)
        .then(() => {
          fetchGlobalsAndProfiles();
          alert('Policy profile deleted successfully.');
        })
        .catch(err => {
          alert(err.message || 'Failed to delete policy.');
        });
    }
  };

  return (
    <div className="space-y-8">
      <SettingsNavigation />

      {/* Global Rules Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-primary-text">Global Operational Rules</h3>
          <p className="text-xs text-secondary-text">Lock entire system functions or configure strict parameters for all branches</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface p-5 rounded-2xl border border-border-fin flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-secondary-text uppercase block mb-1">New Registrations</span>
              <span className={`text-xs font-bold ${globalParams.allow_registrations ? 'text-success-fin' : 'text-danger-fin'}`}>
                {globalParams.allow_registrations ? 'Allowed System-wide' : 'Locked (Suspended)'}
              </span>
            </div>
            <button
              onClick={() => handleToggleGlobal('allow_registrations')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                globalParams.allow_registrations ? 'bg-success-fin/10 text-success-fin' : 'bg-danger-fin/10 text-danger-fin'
              }`}
            >
              <span className="material-symbols-rounded select-none block">
                {globalParams.allow_registrations ? 'toggle_on' : 'toggle_off'}
              </span>
            </button>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-border-fin flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-secondary-text uppercase block mb-1">Mandatory KYC Checks</span>
              <span className={`text-xs font-bold ${globalParams.mandatory_kyc ? 'text-success-fin' : 'text-danger-fin'}`}>
                {globalParams.mandatory_kyc ? 'Strict Verified Required' : 'Optional Drafts Allowed'}
              </span>
            </div>
            <button
              onClick={() => handleToggleGlobal('mandatory_kyc')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                globalParams.mandatory_kyc ? 'bg-success-fin/10 text-success-fin' : 'bg-danger-fin/10 text-danger-fin'
              }`}
            >
              <span className="material-symbols-rounded select-none block">
                {globalParams.mandatory_kyc ? 'toggle_on' : 'toggle_off'}
              </span>
            </button>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-border-fin flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-secondary-text uppercase block mb-1">Daily Collections</span>
              <span className={`text-xs font-bold ${globalParams.allow_collections ? 'text-success-fin' : 'text-danger-fin'}`}>
                {globalParams.allow_collections ? 'Active' : 'Frozen (Suspended)'}
              </span>
            </div>
            <button
              onClick={() => handleToggleGlobal('allow_collections')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                globalParams.allow_collections ? 'bg-success-fin/10 text-success-fin' : 'bg-danger-fin/10 text-danger-fin'
              }`}
            >
              <span className="material-symbols-rounded select-none block">
                {globalParams.allow_collections ? 'toggle_on' : 'toggle_off'}
              </span>
            </button>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-border-fin flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-secondary-text uppercase block mb-1">Sunday Collections</span>
              <span className={`text-xs font-bold ${globalParams.allow_sunday_collections ? 'text-success-fin' : 'text-danger-fin'}`}>
                {globalParams.allow_sunday_collections ? 'Active' : 'No collections Sunday'}
              </span>
            </div>
            <button
              onClick={() => handleToggleGlobal('allow_sunday_collections')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                globalParams.allow_sunday_collections ? 'bg-success-fin/10 text-success-fin' : 'bg-danger-fin/10 text-danger-fin'
              }`}
            >
              <span className="material-symbols-rounded select-none block">
                {globalParams.allow_sunday_collections ? 'toggle_on' : 'toggle_off'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface p-5 rounded-2xl border border-border-fin flex flex-col justify-between space-y-2">
            <span className="text-[11px] font-bold text-secondary-text uppercase block">Automatic Defaulter Trigger (Days)</span>
            <div className="flex gap-2">
              <input
                type="number"
                value={globalParams.defaulter_days}
                onChange={(e) => handleNumParamChange('defaulter_days', e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-border-fin rounded-xl text-xs font-semibold text-primary-text placeholder-secondary-text focus:outline-none"
              />
            </div>
          </div>
          <div className="bg-surface p-5 rounded-2xl border border-border-fin flex flex-col justify-between space-y-2">
            <span className="text-[11px] font-bold text-secondary-text uppercase block">Max Single Disbursement Limit</span>
            <div className="flex gap-2">
              <input
                type="number"
                value={globalParams.disbursement_limit}
                onChange={(e) => handleNumParamChange('disbursement_limit', e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-border-fin rounded-xl text-xs font-semibold text-primary-text placeholder-secondary-text focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Profiles Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
          <div>
            <h3 className="text-base font-bold text-primary-text mb-0.5">Operational Policy Profiles</h3>
            <p className="text-xs text-secondary-text leading-snug">Configure fine-grained roles limitations for field staff and managers</p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="material-symbols-rounded text-sm select-none">add</span>
            Create Policy Profile
          </button>
        </div>

        <div className="lg:bg-surface lg:rounded-2xl lg:border lg:border-border-fin lg:shadow-sm lg:overflow-hidden">
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="hidden lg:table min-w-full divide-y divide-border-fin">
              <thead className="bg-background-fin">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Profile Name</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Applicable Role</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Allow login</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Disbursement</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Max Limit</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Session Timeout</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-fin text-xs font-medium text-secondary-text">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-primary-text">{p.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-800">{p.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        p.allow_login === 1 || p.allow_login === true ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                      }`}>
                        {p.allow_login === 1 || p.allow_login === true ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        p.allow_disbursement === 1 || p.allow_disbursement === true ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                      }`}>
                        {p.allow_disbursement === 1 || p.allow_disbursement === true ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-primary-text">₹{parseFloat(p.max_limit).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{p.session_timeout} Minutes</td>
                    <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        disabled={p.is_system}
                        className={`p-1 rounded text-primary hover:bg-primary/10 cursor-pointer transition-all active:scale-[0.95] ${
                          p.is_system ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                        title="Edit Policy"
                      >
                        <span className="material-symbols-rounded text-sm select-none">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(p.id)}
                        disabled={p.is_system}
                        className={`p-1 rounded text-danger-fin hover:bg-danger-fin/10 cursor-pointer transition-all active:scale-[0.95] ${
                          p.is_system ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                        title="Delete Policy"
                      >
                        <span className="material-symbols-rounded text-sm select-none">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="block lg:hidden space-y-4">
            {profiles.length === 0 ? (
              <div className="bg-surface border border-border-fin rounded-2xl p-8 text-center text-xs text-secondary-text shadow-sm">
                No policy profiles configured.
              </div>
            ) : (
              profiles.map((p) => (
                <div key={p.id} className="bg-surface border border-border-fin rounded-2xl p-4 shadow-sm space-y-3.5">
                  {/* Title & Role */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-primary-text block">{p.name}</span>
                      <span className="text-[10px] text-secondary-text font-bold uppercase tracking-wider">Role: {p.role}</span>
                    </div>
                    {p.is_system && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                        System Default
                      </span>
                    )}
                  </div>

                  {/* Details: Allow Login, Disbursement, Max Limit, Timeout */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-secondary-text bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-secondary-text/60 block text-[8px] uppercase tracking-wider">Allow Login</span>
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase ${
                        p.allow_login === 1 || p.allow_login === true ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                      }`}>
                        {p.allow_login === 1 || p.allow_login === true ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-secondary-text/60 block text-[8px] uppercase tracking-wider">Disbursement</span>
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase ${
                        p.allow_disbursement === 1 || p.allow_disbursement === true ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                      }`}>
                        {p.allow_disbursement === 1 || p.allow_disbursement === true ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="col-span-2 border-t border-slate-100/80 pt-1.5 mt-0.5 flex justify-between">
                      <div>
                        <span className="text-secondary-text/60 block text-[8px] uppercase tracking-wider">Max Limit</span>
                        <span className="text-primary-text">₹{parseFloat(p.max_limit).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-secondary-text/60 block text-[8px] uppercase tracking-wider text-right">Timeout</span>
                        <span className="text-primary-text block text-right">{p.session_timeout} Mins</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex justify-end items-center">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        disabled={p.is_system}
                        className={`p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-primary active:scale-90 transition-all border border-[#E2E8F0] flex items-center justify-center ${
                          p.is_system ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        title="Edit Policy"
                      >
                        <span className="material-symbols-rounded text-sm select-none">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(p.id)}
                        disabled={p.is_system}
                        className={`p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-danger-fin active:scale-90 transition-all border border-[#E2E8F0] flex items-center justify-center ${
                          p.is_system ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        title="Delete Policy"
                      >
                        <span className="material-symbols-rounded text-sm select-none">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-6 rounded-[2rem] border border-border-fin max-w-lg w-full shadow-2xl space-y-5 overflow-y-auto max-h-[90vh] animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-border-fin">
              <h4 className="text-base font-extrabold text-primary-text">{editingProfile ? 'Edit Policy' : 'Create Policy Profile'}</h4>
              <button 
                onClick={() => setShowFormModal(false)} 
                className="p-1 rounded-lg hover:bg-slate-100 text-secondary-text cursor-pointer active:scale-90"
              >
                <span className="material-symbols-rounded block text-lg select-none">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Policy Name <span className="text-danger-fin">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Field Collector Policy"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>

              <div className="space-y-1">
                <Select
                  label="Target System Role *"
                  required={true}
                  options={[
                    { value: 'Super Admin', label: 'Super Admin' },
                    { value: 'Branch Manager', label: 'Branch Manager' },
                    { value: 'Area Manager', label: 'Area Manager' },
                    { value: 'Agent / Collection Executive', label: 'Agent / Collection Executive' }
                  ]}
                  value={formData.role}
                  onChange={(val) => setFormData(prev => ({ ...prev, role: val }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-primary-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_login}
                    onChange={(e) => setFormData(prev => ({ ...prev, allow_login: e.target.checked }))}
                    className="rounded border-border-fin text-primary focus:ring-primary"
                  />
                  Allow System Login
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-primary-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_disbursement}
                    onChange={(e) => setFormData(prev => ({ ...prev, allow_disbursement: e.target.checked }))}
                    className="rounded border-border-fin text-primary focus:ring-primary"
                  />
                  Allow disbursements
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-primary-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_agent_assignment}
                    onChange={(e) => setFormData(prev => ({ ...prev, allow_agent_assignment: e.target.checked }))}
                    className="rounded border-border-fin text-primary focus:ring-primary"
                  />
                  Allow Agent Assignments
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-primary-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_out_area}
                    onChange={(e) => setFormData(prev => ({ ...prev, allow_out_area: e.target.checked }))}
                    className="rounded border-border-fin text-primary focus:ring-primary"
                  />
                  Allow Out Area Operations
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-primary-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_online_apply}
                    onChange={(e) => setFormData(prev => ({ ...prev, allow_online_apply: e.target.checked }))}
                    className="rounded border-border-fin text-primary focus:ring-primary"
                  />
                  Allow Mobile Onboarding
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-primary-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_backdated}
                    onChange={(e) => setFormData(prev => ({ ...prev, allow_backdated: e.target.checked }))}
                    className="rounded border-border-fin text-primary focus:ring-primary"
                  />
                  Allow Backdated Entries
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Max Limit (₹)</label>
                  <input
                    type="number"
                    value={formData.max_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_limit: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Session Timeout (Mins)</label>
                  <input
                    type="number"
                    value={formData.session_timeout}
                    onChange={(e) => setFormData(prev => ({ ...prev, session_timeout: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10"
              >
                {editingProfile ? 'Save Changes' : 'Create Policy Profile'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
