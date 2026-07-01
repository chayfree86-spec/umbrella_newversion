import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SettingsNavigation } from './General';
import { Select } from '../../components/ui/Select';
import { agentApi, branchApi, areaApi, settingsApi } from '../../services/api';

export default function AgentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [areas, setAreas] = useState([]);

  const [profileData, setProfileData] = useState({
    name: '',
    mobile: '',
    email: '',
    branch_id: '',
    area_id: '',
    policy_id: '',
    status: 'Active'
  });

  useEffect(() => {
    agentApi.get(id)
      .then(res => {
        const ag = res.data;
        setAgent(ag);
        setProfileData({
          name: ag.name || '',
          mobile: ag.mobile || '',
          email: ag.email || '',
          branch_id: String(ag.branch_id || ''),
          area_id: String(ag.area_id || ''),
          policy_id: String(ag.policy_id || ''),
          status: ag.status || 'Active'
        });
      })
      .catch(() => {
        alert('Agent profile not found.');
        navigate('/settings/agents');
      });

    branchApi.list().then(res => setBranches(res.data || [])).catch(() => {});
    areaApi.list().then(res => setAreas(res.data || [])).catch(() => {});
    settingsApi.policies.list().then(res => setPolicies(res.data || [])).catch(() => {});
  }, [id, navigate]);

  const handleSaveInfo = (e) => {
    e.preventDefault();
    if (!profileData.name || !profileData.mobile) {
      alert('Name and Mobile are required.');
      return;
    }

    agentApi.update(id, { ...profileData, code: agent.code })
      .then(() => {
        setAgent(prev => ({ ...prev, name: profileData.name, mobile: profileData.mobile, email: profileData.email }));
        alert('Agent profile updated successfully.');
      })
      .catch(err => {
        alert(err.message || 'Failed to update agent profile.');
      });
  };

  const handleToggleStatus = () => {
    const newStatus = agent.status === 'Active' ? 'Inactive' : 'Active';
    agentApi.update(id, { ...profileData, code: agent.code, status: newStatus })
      .then(() => {
        setAgent(prev => ({ ...prev, status: newStatus }));
        setProfileData(prev => ({ ...prev, status: newStatus }));
        alert(`Agent status changed to ${newStatus}.`);
      })
      .catch(err => {
        alert(err.message || 'Failed to update status.');
      });
  };

  if (!agent) return (
    <div className="space-y-6">
      <SettingsNavigation />
      <div className="flex items-center justify-center py-20 text-secondary-text text-sm">Loading agent profile...</div>
    </div>
  );

  const filteredAreas = areas.filter(a => !profileData.branch_id || String(a.branch_id) === profileData.branch_id);

  return (
    <div className="space-y-6">
      <SettingsNavigation />

      {/* Agent Header */}
      <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-accent/10 text-accent rounded-2xl flex items-center justify-center">
            <span className="material-symbols-rounded text-2xl select-none">support_agent</span>
          </div>
          <div>
            <h3 className="text-base font-black text-primary-text">{agent.name}</h3>
            <div className="flex flex-wrap gap-2 mt-1.5 items-center">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent/10 text-accent">
                Field Agent
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                agent.status === 'Active' ? 'bg-success-fin/10 text-success-fin' : 'bg-danger-fin/10 text-danger-fin'
              }`}>
                {agent.status}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleStatus}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              agent.status === 'Active'
                ? 'bg-danger-fin/10 text-danger-fin hover:bg-danger-fin/15'
                : 'bg-success-fin/10 text-success-fin hover:bg-success-fin/15'
            }`}
          >
            {agent.status === 'Active' ? 'Deactivate Agent' : 'Activate Agent'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info Form */}
        <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-sm font-bold text-primary-text mb-1">Agent Information</h4>
            <p className="text-xs text-secondary-text">Update profile data, branch/area assignment, and policy</p>
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

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Parent Branch"
                options={branches.map(b => ({ value: String(b.id), label: b.name }))}
                value={profileData.branch_id}
                onChange={(val) => setProfileData(prev => ({ ...prev, branch_id: val, area_id: '' }))}
              />
              <Select
                label="Assigned Area"
                options={filteredAreas.map(a => ({ value: String(a.id), label: a.name }))}
                value={profileData.area_id}
                onChange={(val) => setProfileData(prev => ({ ...prev, area_id: val }))}
              />
            </div>

            <div className="space-y-1">
              <Select
                label="Policy Profile"
                options={policies.map(p => ({ value: String(p.id), label: p.name }))}
                value={profileData.policy_id}
                onChange={(val) => setProfileData(prev => ({ ...prev, policy_id: val }))}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer"
            >
              Save Agent Profile
            </button>
          </form>
        </div>

        {/* Stats Card */}
        <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-sm font-bold text-primary-text mb-1">Agent Performance</h4>
            <p className="text-xs text-secondary-text">Active accounts and collection statistics assigned to this agent</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/5 rounded-xl p-4 text-center">
              <span className="text-2xl font-black text-primary block">{agent.active_loan_accounts ?? 0}</span>
              <span className="text-[10px] text-secondary-text font-semibold uppercase mt-1 block">Active Loan Accounts</span>
            </div>
            <div className="bg-success-fin/5 rounded-xl p-4 text-center">
              <span className="text-2xl font-black text-success-fin block">{agent.active_saving_accounts ?? 0}</span>
              <span className="text-[10px] text-secondary-text font-semibold uppercase mt-1 block">Saving Accounts</span>
            </div>
            <div className="bg-warning-fin/5 rounded-xl p-4 text-center">
              <span className="text-2xl font-black text-warning-fin block">₹{Number(agent.today_collection ?? 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-secondary-text font-semibold uppercase mt-1 block">Today's Collection</span>
            </div>
            <div className="bg-accent/5 rounded-xl p-4 text-center">
              <span className="text-2xl font-black text-accent block">₹{Number(agent.monthly_collection ?? 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-secondary-text font-semibold uppercase mt-1 block">Monthly Collection</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border-fin space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-secondary-text font-semibold">Agent Code</span>
              <span className="font-bold text-primary-text">{agent.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-text font-semibold">Joining Date</span>
              <span className="font-bold text-primary-text">{agent.joining_date ? new Date(agent.joining_date).toLocaleDateString('en-IN') : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-text font-semibold">Parent Branch</span>
              <span className="font-bold text-primary-text">{agent.branch_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-text font-semibold">Assigned Area</span>
              <span className="font-bold text-primary-text">{agent.area_name || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
