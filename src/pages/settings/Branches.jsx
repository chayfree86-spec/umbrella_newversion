import React, { useState, useEffect } from 'react';
import { SettingsNavigation } from './General';
import { Select } from '../../components/ui/Select';
import { branchApi, userApi } from '../../services/api';

const EMPTY_BRANCH = { code: '', name: '', city: '', address: '', manager_id: '' };

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [managers, setManagers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_BRANCH);

  useEffect(() => {
    fetchBranches();
    fetchManagers();
  }, []);

  const fetchBranches = () => {
    branchApi.list()
      .then(res => setBranches(res.data || []))
      .catch(() => {});
  };

  const fetchManagers = () => {
    userApi.list()
      .then(res => {
        // Only Super Admin (1) and Branch Manager (2) can manage a branch
        const eligible = (res.data || []).filter(u => [1, 2].includes(Number(u.role_id)) && u.status === 'Active');
        setManagers(eligible);
      })
      .catch(() => {});
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(EMPTY_BRANCH);
    setShowForm(true);
  };

  const handleOpenEdit = (b) => {
    setEditing(b);
    setForm({
      code: b.code || '',
      name: b.name || '',
      city: b.city || '',
      address: b.address || '',
      manager_id: b.manager_id || '',
      status: b.status || 'Active',
      allow_registrations: !!b.allow_registrations,
      allow_collections: !!b.allow_collections
    });
    setShowForm(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      alert('Please fill out the Branch Code and Name.');
      return;
    }

    const op = editing
      ? branchApi.update(editing.id, form)
      : branchApi.create(form);

    op.then(() => {
        fetchBranches();
        setShowForm(false);
        setForm(EMPTY_BRANCH);
        setEditing(null);
        alert(editing ? 'Branch updated successfully.' : 'New branch added successfully.');
      })
      .catch(err => alert(err.message || 'Failed to save branch.'));
  };

  const handleDelete = async (b) => {
    if (!await window.confirm(`Delete branch "${b.name}"?`)) return;
    branchApi.delete(b.id)
      .then(() => {
        fetchBranches();
        alert('Branch deleted successfully.');
      })
      .catch(err => alert(err.message || 'Failed to delete branch.'));
  };

  const togglePolicy = (branch, policyKey) => {
    const newVal = !branch[policyKey];
    const data = {
      code: branch.code,
      name: branch.name,
      city: branch.city,
      address: branch.address,
      manager_id: branch.manager_id,
      status: branch.status,
      allow_registrations: policyKey === 'allow_registrations' ? newVal : branch.allow_registrations,
      allow_collections: policyKey === 'allow_collections' ? newVal : branch.allow_collections
    };

    branchApi.update(branch.id, data)
      .then(() => {
        fetchBranches();
        const label = policyKey === 'allow_registrations' ? 'Onboarding' : 'Collections';
        alert(`${branch.name}: ${label} policy updated successfully.`);
      })
      .catch(err => {
        alert(err.message || 'Failed to update branch policy.');
      });
  };

  return (
    <div className="space-y-6">
      <SettingsNavigation />

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-primary-text">Branches Settings</h3>
          <p className="text-xs text-secondary-text">Configure operational rules, stop registrations, or freeze collections per branch</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="material-symbols-rounded text-sm select-none">add</span>
          Add New Branch
        </button>
      </div>

      {/* Branches List Table */}
      <div className="bg-surface rounded-2xl border border-border-fin shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-fin">
            <thead className="bg-background-fin">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Branch Code</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Branch Name</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">City</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Branch Manager</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Onboarding Policy</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Collections Policy</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-fin text-xs font-medium text-secondary-text">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-primary-text">{b.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">{b.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{b.city || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-primary-text">{b.manager_name || 'Not Assigned'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => togglePolicy(b, 'allow_registrations')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase transition-all cursor-pointer ${
                        b.allow_registrations 
                          ? 'bg-[#16A34A]/10 text-[#16A34A] hover:bg-[#16A34A]/15' 
                          : 'bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/15'
                      }`}
                    >
                      <span className="material-symbols-rounded text-xs select-none">
                        {b.allow_registrations ? 'check_circle' : 'cancel'}
                      </span>
                      {b.allow_registrations ? 'Allowed' : 'Suspended'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => togglePolicy(b, 'allow_collections')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase transition-all cursor-pointer ${
                        b.allow_collections 
                          ? 'bg-[#16A34A]/10 text-[#16A34A] hover:bg-[#16A34A]/15' 
                          : 'bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/15'
                      }`}
                    >
                      <span className="material-symbols-rounded text-xs select-none">
                        {b.allow_collections ? 'check_circle' : 'cancel'}
                      </span>
                      {b.allow_collections ? 'Allowed' : 'Suspended'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      b.status === 'Active' ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(b)}
                      className="p-1 rounded text-primary hover:bg-primary/10 cursor-pointer transition-all active:scale-[0.95]"
                      title="Edit Branch"
                    >
                      <span className="material-symbols-rounded text-sm select-none">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(b)}
                      className="p-1 rounded text-danger-fin hover:bg-danger-fin/10 cursor-pointer transition-all active:scale-[0.95]"
                      title="Delete Branch"
                    >
                      <span className="material-symbols-rounded text-sm select-none">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-6 rounded-[2rem] border border-border-fin max-w-md w-full shadow-2xl space-y-5 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-border-fin">
              <h4 className="text-base font-extrabold text-primary-text">{editing ? 'Edit Branch' : 'Create Branch'}</h4>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-secondary-text cursor-pointer active:scale-90"
              >
                <span className="material-symbols-rounded block text-lg select-none">close</span>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Branch Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BR-LKO-01"
                  value={form.code}
                  onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Branch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hazratganj Branch"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">City</label>
                <input
                  type="text"
                  placeholder="e.g. Lucknow"
                  value={form.city}
                  onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Address</label>
                <input
                  type="text"
                  placeholder="Branch location address"
                  value={form.address}
                  onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>

              <div className="space-y-1">
                <Select
                  label="Branch Manager"
                  options={[
                    { value: '', label: 'Not Assigned' },
                    ...managers.map(m => ({ value: String(m.id), label: `${m.name} (${m.role_name})` }))
                  ]}
                  value={String(form.manager_id || '')}
                  onChange={(val) => setForm(prev => ({ ...prev, manager_id: val }))}
                />
                {managers.length === 0 && (
                  <p className="text-[10px] text-secondary-text mt-1">No active Super Admin / Branch Manager users found. Create one in User Management first.</p>
                )}
              </div>

              {editing && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-primary-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.allow_registrations}
                      onChange={(e) => setForm(prev => ({ ...prev, allow_registrations: e.target.checked }))}
                      className="rounded border-border-fin accent-primary"
                    />
                    Allow Registrations
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-primary-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.allow_collections}
                      onChange={(e) => setForm(prev => ({ ...prev, allow_collections: e.target.checked }))}
                      className="rounded border-border-fin accent-primary"
                    />
                    Allow Collections
                  </label>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10"
              >
                {editing ? 'Save Changes' : 'Register Branch'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
