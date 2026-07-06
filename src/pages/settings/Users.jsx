import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SettingsNavigation } from './General';
import { Select } from '../../components/ui/Select';
import { userApi, settingsApi } from '../../services/api';
import { Pagination } from '../../components/ui/Pagination';

const EMPTY_STAFF = {
  name: '',
  email: '',
  mobile: '',
  role_id: '4',
  policy_id: '',
  status: 'Active'
};

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_STAFF);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchUsers();

    settingsApi.policies.list()
      .then(res => setPolicies(res.data || []))
      .catch(() => {});
  }, []);

  const fetchUsers = () => {
    userApi.list()
      .then(res => setUsers(res.data || []))
      .catch(() => {});
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(EMPTY_STAFF);
    setShowForm(true);
  };

  const handleOpenEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name || '',
      email: u.email || '',
      mobile: u.mobile || '',
      role_id: String(u.role_id || '4'),
      policy_id: String(u.policy_id || ''),
      status: u.status || 'Active',
      branch_id: u.branch_id,
      area_id: u.area_id,
      agent_id: u.agent_id
    });
    setShowForm(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.name || !form.mobile) {
      alert('Please fill out Name and Mobile Number.');
      return;
    }

    const op = editing ? userApi.update(editing.id, form) : userApi.create(form);

    op.then(() => {
        fetchUsers();
        setShowForm(false);
        setForm(EMPTY_STAFF);
        setEditing(null);
        alert(editing ? 'User updated successfully.' : 'New system user created successfully.');
      })
      .catch(err => alert(err.message || 'Failed to save user.'));
  };

  const handleDeleteStaff = async (id) => {
    if (await window.confirm('Are you sure you want to delete this staff user?')) {
      userApi.delete(id)
        .then(() => {
          fetchUsers();
          alert('Staff user deleted successfully.');
        })
        .catch(err => {
          alert(err.message || 'Failed to delete staff user.');
        });
    }
  };

  const handleResetPassword = async (id) => {
    const password = await window.prompt('Enter new password (min 6 chars). Leave blank to skip:', '');
    if (password === null) return; // user cancelled
    const pin = await window.prompt('Enter new 4-digit security PIN. Leave blank to skip:', '');
    if (pin === null) return; // user cancelled
    if (!password && !pin) return;

    userApi.resetPassword(id, password || undefined, pin || undefined)
      .then((res) => {
        alert(res.message || 'Credentials updated successfully.');
      })
      .catch(err => {
        alert(err.message || 'Failed to reset credentials.');
      });
  };

  return (
    <div className="space-y-6">
      <SettingsNavigation />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
        <div>
          <h3 className="text-base font-bold text-primary-text mb-0.5">Staff & Users</h3>
          <p className="text-xs text-secondary-text leading-snug">Configure management permissions, create user profiles, or reset passwords</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="material-symbols-rounded text-sm select-none">add</span>
          Add New User
        </button>
      </div>

      {/* Users List Table */}
      {/* Users List Table */}
      <div className="lg:bg-surface lg:rounded-2xl lg:border lg:border-border-fin lg:shadow-sm lg:overflow-hidden">
        <div className="overflow-x-auto">
          {/* Desktop Table View */}
          <table className="hidden lg:table min-w-full divide-y divide-border-fin">
            <thead className="bg-background-fin">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">User Name</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">System Role</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Contact Number</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Email Address</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Policy profile</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-fin text-xs font-medium text-secondary-text">
              {(() => {
                const sortedUsers = [...users].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
                const paginatedUsers = sortedUsers.slice((currentPage - 1) * 20, currentPage * 20);
                
                return paginatedUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/50 cursor-pointer"
                    onClick={() => navigate(u.agent_id ? `/settings/agent/${u.agent_id}` : `/settings/user/${u.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-primary-text">
                      {u.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">{u.role_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{u.mobile}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{u.email || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-primary-text">{u.policy_name || 'System Default'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : 'Never'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        u.status === 'Active' ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1 rounded text-primary hover:bg-primary/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Edit User"
                      >
                        <span className="material-symbols-rounded text-sm select-none">edit</span>
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.id)}
                        className="p-1 rounded text-primary hover:bg-primary/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Reset Credentials"
                      >
                        <span className="material-symbols-rounded text-sm select-none">key</span>
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(u.id)}
                        className="p-1 rounded text-danger-fin hover:bg-danger-fin/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Delete User"
                      >
                        <span className="material-symbols-rounded text-sm select-none">delete</span>
                      </button>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="block lg:hidden space-y-4">
          {(() => {
            const sortedUsers = [...users].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
            const paginatedUsers = sortedUsers.slice((currentPage - 1) * 20, currentPage * 20);

            if (paginatedUsers.length === 0) {
              return (
                <div className="bg-surface border border-border-fin rounded-2xl p-8 text-center text-xs text-secondary-text shadow-sm">
                  No users found.
                </div>
              );
            }

            return paginatedUsers.map((u) => (
              <div 
                key={u.id} 
                onClick={() => navigate(u.agent_id ? `/settings/agent/${u.agent_id}` : `/settings/user/${u.id}`)}
                className="bg-surface border border-border-fin rounded-2xl p-4 shadow-sm space-y-3.5 cursor-pointer"
              >
                {/* Title & Code */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-primary-text block">{u.name}</span>
                    <span className="text-[10px] text-secondary-text font-bold uppercase tracking-wider">{u.role_name}</span>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                    u.status === 'Active' ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                  }`}>
                    {u.status}
                  </span>
                </div>

                {/* Details: Contact, Email, Policy, Last Login */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-secondary-text bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-secondary-text/60 block text-[8px] uppercase tracking-wider">Contact</span>
                    <span className="text-primary-text block">{u.mobile}</span>
                    <span className="text-secondary-text/80 block font-semibold truncate text-[9px]">{u.email || 'No Email'}</span>
                  </div>
                  <div>
                    <span className="text-secondary-text/60 block text-[8px] uppercase tracking-wider">Policy profile</span>
                    <span className="text-primary-text block truncate">{u.policy_name || 'System Default'}</span>
                  </div>
                  <div className="col-span-2 border-t border-slate-100/80 pt-1.5 mt-0.5">
                    <span className="text-secondary-text/60 block text-[8px] uppercase tracking-wider">Last Login</span>
                    <span className="text-primary-text block truncate">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : 'Never'}</span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-primary cursor-pointer active:scale-90 transition-all border border-[#E2E8F0] flex items-center justify-center animate-none"
                      title="Edit User"
                    >
                      <span className="material-symbols-rounded text-sm select-none">edit</span>
                    </button>
                    <button
                      onClick={() => handleResetPassword(u.id)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-primary cursor-pointer active:scale-90 transition-all border border-[#E2E8F0] flex items-center justify-center animate-none"
                      title="Reset Credentials"
                    >
                      <span className="material-symbols-rounded text-sm select-none">key</span>
                    </button>
                    <button
                      onClick={() => handleDeleteStaff(u.id)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-danger-fin cursor-pointer active:scale-90 transition-all border border-[#E2E8F0] flex items-center justify-center animate-none"
                      title="Delete User"
                    >
                      <span className="material-symbols-rounded text-sm select-none">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
      <Pagination 
        currentPage={currentPage}
        totalPages={Math.ceil(users.length / 20)}
        onPageChange={setCurrentPage}
      />

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-6 rounded-[2rem] border border-border-fin max-w-md w-full shadow-2xl space-y-5 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-border-fin">
              <h4 className="text-base font-extrabold text-primary-text">{editing ? 'Edit User' : 'Create User'}</h4>
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="p-1 rounded-lg hover:bg-slate-100 text-secondary-text cursor-pointer active:scale-90"
              >
                <span className="material-symbols-rounded block text-lg select-none">close</span>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Full Name <span className="text-danger-fin">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amit Kumar"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Mobile Number <span className="text-danger-fin">*</span></label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9628717175"
                  value={form.mobile}
                  onChange={(e) => setForm(prev => ({ ...prev, mobile: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. amit@umbrella.com"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>

              <div className="space-y-1">
                <Select
                  label="System Role *"
                  required={true}
                  options={[
                    { value: '1', label: 'Super Admin' },
                    { value: '2', label: 'Branch Manager' },
                    { value: '3', label: 'Area Manager' },
                    { value: '4', label: 'Agent / Collection Executive' }
                  ]}
                  value={form.role_id}
                  onChange={(val) => setForm(prev => ({ ...prev, role_id: val }))}
                />
              </div>

              <div className="space-y-1">
                <Select
                  label="Operational Policy Profile"
                  required={false}
                  options={[{ value: '', label: 'No Policy' }, ...policies.map(p => ({ value: String(p.id), label: p.name }))]}
                  value={form.policy_id}
                  onChange={(val) => setForm(prev => ({ ...prev, policy_id: val }))}
                />
              </div>

              {editing && (
                <div className="space-y-1">
                  <Select
                    label="Account Status"
                    options={[
                      { value: 'Active', label: 'Active' },
                      { value: 'Inactive', label: 'Inactive' },
                      { value: 'Suspended', label: 'Suspended' }
                    ]}
                    value={form.status}
                    onChange={(val) => setForm(prev => ({ ...prev, status: val }))}
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10"
              >
                {editing ? 'Save Changes' : 'Register System User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
