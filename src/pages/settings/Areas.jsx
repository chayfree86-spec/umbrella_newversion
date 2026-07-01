import React, { useState, useEffect } from 'react';
import { SettingsNavigation } from './General';
import { Select } from '../../components/ui/Select';
import { areaApi, branchApi } from '../../services/api';
import { Pagination } from '../../components/ui/Pagination';

const EMPTY_AREA = { code: '', name: '', branch_id: '', manager_id: '', status: 'Active' };

export default function Areas() {
  const [areas, setAreas] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_AREA);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchAreas();
    branchApi.list()
      .then(res => setBranches(res.data || []))
      .catch(() => {});
  }, []);

  const fetchAreas = () => {
    areaApi.list()
      .then(res => setAreas(res.data || []))
      .catch(() => {});
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(EMPTY_AREA);
    setShowForm(true);
  };

  const handleOpenEdit = (a) => {
    setEditing(a);
    setForm({
      code: a.code || '',
      name: a.name || '',
      branch_id: String(a.branch_id || ''),
      manager_id: a.manager_id || '',
      status: a.status || 'Active'
    });
    setShowForm(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.branch_id) {
      alert('Please fill out Code, Name, and select a Branch.');
      return;
    }

    const op = editing
      ? areaApi.update(editing.id, form)
      : areaApi.create(form);

    op.then(() => {
        fetchAreas();
        setShowForm(false);
        setForm(EMPTY_AREA);
        setEditing(null);
        alert(editing ? 'Area updated successfully.' : 'New area created successfully.');
      })
      .catch(err => alert(err.message || 'Failed to save area.'));
  };

  const handleDeleteArea = async (a) => {
    if (!await window.confirm(`Delete area "${a.name}"?`)) return;
    areaApi.delete(a.id)
      .then(() => {
        fetchAreas();
        alert('Area deleted successfully.');
      })
      .catch(err => alert(err.message || 'Failed to delete area.'));
  };

  return (
    <div className="space-y-6">
      <SettingsNavigation />

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-primary-text">Operational Areas</h3>
          <p className="text-xs text-secondary-text">Manage collection circles, pin codes, and area manager assignments</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="material-symbols-rounded text-sm select-none">add</span>
          Add New Area
        </button>
      </div>

      {/* Areas List Table */}
      <div className="bg-surface rounded-2xl border border-border-fin shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-fin">
            <thead className="bg-background-fin">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Area Code</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Area Name</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Parent Branch</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Area Manager</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Active Agents</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-fin text-xs font-medium text-secondary-text">
              {(() => {
                const sortedAreas = [...areas].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
                const paginatedAreas = sortedAreas.slice((currentPage - 1) * 20, currentPage * 20);

                return paginatedAreas.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-primary-text">{a.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">{a.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-primary-text">{a.branch_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{a.manager_name || 'Not Assigned'}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-extrabold text-primary-text">{a.agents_count ?? 0} Agents</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        a.status === 'Active' ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(a)}
                        className="p-1 rounded text-primary hover:bg-primary/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Edit Area"
                      >
                        <span className="material-symbols-rounded text-sm select-none">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteArea(a)}
                        className="p-1 rounded text-danger-fin hover:bg-danger-fin/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Delete Area"
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
        <Pagination 
          currentPage={currentPage}
          totalPages={Math.ceil(areas.length / 20)}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-6 rounded-[2rem] border border-border-fin max-w-md w-full shadow-2xl space-y-5 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-border-fin">
              <h4 className="text-base font-extrabold text-primary-text">{editing ? 'Edit Area' : 'Create Operational Area'}</h4>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-secondary-text cursor-pointer active:scale-90"
              >
                <span className="material-symbols-rounded block text-lg select-none">close</span>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Area Code <span className="text-danger-fin">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AR-HZT-01"
                  value={form.code}
                  onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Area Name <span className="text-danger-fin">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hazratganj Core"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>

              <div className="space-y-1">
                <Select
                  label="Parent Branch *"
                  required={true}
                  options={branches.map(b => ({ value: String(b.id), label: b.name }))}
                  value={form.branch_id}
                  onChange={(val) => setForm(prev => ({ ...prev, branch_id: val }))}
                />
              </div>

              {editing && (
                <div className="space-y-1">
                  <Select
                    label="Status"
                    options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
                    value={form.status}
                    onChange={(val) => setForm(prev => ({ ...prev, status: val }))}
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10"
              >
                {editing ? 'Save Changes' : 'Register Area'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
