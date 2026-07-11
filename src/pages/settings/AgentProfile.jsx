import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { SettingsNavigation } from './General';
import { Select } from '../../components/ui/Select';
import { agentApi, branchApi, areaApi, settingsApi, customerApi, userApi } from '../../services/api';

export default function AgentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [agent, setAgent] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [credentialForm, setCredentialForm] = useState({
    password: '',
    confirmPassword: '',
    pin: '',
    confirmPin: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const [profileData, setProfileData] = useState({
    name: '',
    mobile: '',
    email: '',
    branch_id: '',
    area_id: '',
    policy_id: '',
    status: 'Active'
  });

  const fetchAgentDetails = () => {
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
  };

  const fetchCustomers = () => {
    setLoadingCustomers(true);
    customerApi.list({ agent_id: id, limit: 1000 })
      .then(res => {
        setCustomers(res.data || []);
        setLoadingCustomers(false);
      })
      .catch(() => {
        setLoadingCustomers(false);
      });
  };

  useEffect(() => {
    fetchAgentDetails();
    fetchCustomers();

    branchApi.list().then(res => setBranches(res.data || [])).catch(() => {});
    areaApi.list().then(res => setAreas(res.data || [])).catch(() => {});
    settingsApi.policies.list().then(res => setPolicies(res.data || [])).catch(() => {});
  }, [id, navigate]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('edit') === 'true') {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [location.search]);

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
        setIsEditing(false);
        fetchAgentDetails();
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
        fetchAgentDetails();
      })
      .catch(err => {
        alert(err.message || 'Failed to update status.');
      });
  };

  const handleCreateLogin = () => {
    if (!window.confirm('Create a system login user account for this agent?')) return;
    
    userApi.create({
      name: agent.name,
      mobile: agent.mobile,
      email: agent.email || '',
      role_id: '4', // Role: Agent
      branch_id: agent.branch_id ? String(agent.branch_id) : '',
      area_id: agent.area_id ? String(agent.area_id) : '',
      agent_id: agent.id,
      policy_id: agent.policy_id ? String(agent.policy_id) : '',
      status: 'Active'
    })
      .then(() => {
        alert('System login user account created successfully. Default password is "admin123" and PIN is "1234".');
        fetchAgentDetails();
      })
      .catch(err => {
        alert(err.message || 'Failed to create system login user account.');
      });
  };

  const handleUpdateCredentials = (e) => {
    e.preventDefault();
    if (!agent.linked_user) return;

    if (credentialForm.password) {
      if (credentialForm.password.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
      }
      if (credentialForm.password !== credentialForm.confirmPassword) {
        alert('New Password and Confirm Password do not match.');
        return;
      }
    }

    if (credentialForm.pin) {
      if (credentialForm.pin.length !== 4 || isNaN(credentialForm.pin)) {
        alert('Security PIN must be a 4-digit numeric code.');
        return;
      }
      if (credentialForm.pin !== credentialForm.confirmPin) {
        alert('New PIN and Confirm PIN do not match.');
        return;
      }
    }

    if (!credentialForm.password && !credentialForm.pin) {
      alert('Please enter a new password or PIN to update.');
      return;
    }

    userApi.resetPassword(agent.linked_user.id, credentialForm.password || undefined, credentialForm.pin || undefined)
      .then(() => {
        setCredentialForm({ password: '', confirmPassword: '', pin: '', confirmPin: '' });
        let message = 'Credentials updated successfully:';
        if (credentialForm.password) message += ' Password updated.';
        if (credentialForm.pin) message += ' Security PIN updated.';
        alert(message);
      })
      .catch(err => {
        alert(err.message || 'Failed to update credentials.');
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
          <button 
            onClick={() => navigate('/settings/agents')} 
            className="w-11 h-11 bg-slate-50 hover:bg-slate-100 text-secondary-text rounded-xl border border-border-fin cursor-pointer transition-all active:scale-90 flex items-center justify-center"
            title="Back to Agents"
          >
            <span className="material-symbols-rounded text-base font-black select-none">arrow_back</span>
          </button>
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
            onClick={() => setIsEditing(prev => !prev)}
            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-primary border border-border-fin rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-rounded text-xs select-none">
              {isEditing ? 'visibility' : 'edit'}
            </span>
            {isEditing ? 'View Performance' : 'Edit Profile & Login'}
          </button>
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

      {!isEditing ? (
        <div className="space-y-6">
          {/* Agent Performance Box */}
          <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm space-y-6">
            <div>
              <h4 className="text-sm font-bold text-primary-text mb-1">Agent Performance</h4>
              <p className="text-xs text-secondary-text">Active accounts and collection statistics assigned to this agent</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <div className="pt-4 border-t border-border-fin grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-secondary-text font-semibold">Agent Code</span>
                <span className="font-bold text-primary-text">{agent.code}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-secondary-text font-semibold">Joining Date</span>
                <span className="font-bold text-primary-text">{agent.joining_date ? new Date(agent.joining_date).toLocaleDateString('en-IN') : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-secondary-text font-semibold">Parent Branch</span>
                <span className="font-bold text-primary-text">{agent.branch_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-secondary-text font-semibold">Assigned Area</span>
                <span className="font-bold text-primary-text">{agent.area_name || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Assigned Customers Box */}
          <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm space-y-5">
            <div>
              <h4 className="text-sm font-bold text-primary-text mb-1">Assigned Customers ({customers.length})</h4>
              <p className="text-xs text-secondary-text">List of customers assigned to this agent for collections</p>
            </div>

            {loadingCustomers ? (
              <div className="flex items-center justify-center py-10 text-xs text-secondary-text">Loading customers...</div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-secondary-text">
                <span className="material-symbols-rounded text-3xl select-none text-slate-300">group</span>
                <p className="text-xs font-bold text-slate-400 mt-2">No customers assigned yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full divide-y divide-border-fin">
                  <thead className="bg-background-fin sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-[9px] font-bold text-secondary-text uppercase tracking-wider">Code</th>
                      <th className="px-4 py-2 text-left text-[9px] font-bold text-secondary-text uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2 text-left text-[9px] font-bold text-secondary-text uppercase tracking-wider">Mobile</th>
                      <th className="px-4 py-2 text-left text-[9px] font-bold text-secondary-text uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-right text-[9px] font-bold text-secondary-text uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-fin text-[11px] font-medium text-secondary-text">
                    {customers.map((c) => {
                      const accNo = c.loan_account_no || c.saving_account_no;
                      return (
                        <tr 
                          key={c.id} 
                          onClick={() => navigate(accNo ? `/account/${accNo}` : `/customer/${c.id}?tab=kyc`)} 
                          className="hover:bg-slate-50/50 cursor-pointer"
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap font-bold text-primary-text">{accNo || c.customer_code}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-bold text-slate-800">{c.full_name}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-bold text-primary-text">{c.mobile}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase ${
                              c.status === 'Active' ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                            <Link
                              to={accNo ? `/account/${accNo}` : `/customer/${c.id}?tab=kyc`}
                              className="text-primary hover:underline font-bold text-[10px]"
                            >
                              View Profile
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
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

          {/* System Login Account Details & Reset Form */}
          <div className="bg-surface rounded-2xl border border-border-fin p-6 shadow-sm space-y-5">
            <div>
              <h4 className="text-sm font-bold text-primary-text mb-1">System Login Account</h4>
              <p className="text-xs text-secondary-text">Manage system login access, reset passwords, or assign PINs for mobile app</p>
            </div>

            {agent.linked_user ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50/50 border border-border-fin rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-secondary-text font-semibold">Login Mobile / Username</span>
                    <span className="font-bold text-primary-text">{agent.linked_user.mobile}</span>
                  </div>
                  {agent.linked_user.email && (
                    <div className="flex justify-between">
                      <span className="text-secondary-text font-semibold">Email</span>
                      <span className="font-bold text-primary-text">{agent.linked_user.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-secondary-text font-semibold">Account Status</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      agent.linked_user.status === 'Active' ? 'bg-success-fin/10 text-success-fin' : 'bg-danger-fin/10 text-danger-fin'
                    }`}>{agent.linked_user.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-text font-semibold">Last Login</span>
                    <span className="font-bold text-primary-text">{agent.linked_user.last_login_at ? new Date(agent.linked_user.last_login_at).toLocaleString('en-IN') : 'Never'}</span>
                  </div>
                </div>

                {/* Reset credentials form */}
                <form onSubmit={handleUpdateCredentials} className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-secondary-text uppercase tracking-wider block">Reset Credentials</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-secondary-text uppercase">New Password</label>
                      <input
                        type="password"
                        placeholder="Min 6 chars"
                        value={credentialForm.password}
                        onChange={(e) => setCredentialForm(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50/50 border border-border-fin rounded-xl text-xs font-semibold text-primary-text focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-secondary-text uppercase">Confirm Password</label>
                      <input
                        type="password"
                        placeholder="Repeat password"
                        value={credentialForm.confirmPassword}
                        onChange={(e) => setCredentialForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50/50 border border-border-fin rounded-xl text-xs font-semibold text-primary-text focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-secondary-text uppercase">New PIN (4 digits)</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="4-digit PIN"
                        value={credentialForm.pin}
                        onChange={(e) => setCredentialForm(prev => ({ ...prev, pin: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50/50 border border-border-fin rounded-xl text-xs font-semibold text-primary-text focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-secondary-text uppercase">Confirm PIN</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="Repeat PIN"
                        value={credentialForm.confirmPin}
                        onChange={(e) => setCredentialForm(prev => ({ ...prev, confirmPin: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50/50 border border-border-fin rounded-xl text-xs font-semibold text-primary-text focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer"
                  >
                    Update Login Credentials
                  </button>
                </form>
              </div>
            ) : (
              <div className="py-6 text-center space-y-4 border border-dashed border-border-fin rounded-2xl">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <span className="material-symbols-rounded text-xl select-none">no_accounts</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-primary-text">No Linked System Login</p>
                  <p className="text-[10px] text-secondary-text max-w-[240px] mx-auto leading-relaxed">This agent does not have a system login user account linked. They cannot login to collect payments.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateLogin}
                  className="px-4 py-2 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer"
                >
                  Create System Login Account
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
