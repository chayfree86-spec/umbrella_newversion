import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SettingsNavigation } from './General';
import { Select } from '../../components/ui/Select';
import { agentApi, branchApi, areaApi, settingsApi } from '../../services/api';
import { Pagination } from '../../components/ui/Pagination';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [newAgent, setNewAgent] = useState({
    code: '',
    name: '',
    mobile: '',
    email: '',
    branch_id: '',
    area_id: '',
    policy_id: '',
    joining_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAgents();
    
    branchApi.list()
      .then(res => setBranches(res.data || []))
      .catch(() => {});

    areaApi.list()
      .then(res => setAreas(res.data || []))
      .catch(() => {});

    settingsApi.policies.list()
      .then(res => setPolicies(res.data || []))
      .catch(() => {});
  }, []);

  const fetchAgents = () => {
    agentApi.list()
      .then(res => setAgents(res.data || []))
      .catch(() => {});
  };

  const handleAddAgent = (e) => {
    e.preventDefault();
    if (!newAgent.code || !newAgent.name || !newAgent.mobile || !newAgent.branch_id || !newAgent.area_id) {
      alert('Please fill out all required fields.');
      return;
    }

    agentApi.create(newAgent)
      .then(() => {
        fetchAgents();
        setShowAddForm(false);
        setNewAgent({
          code: '', name: '', mobile: '', email: '', branch_id: '', area_id: '', policy_id: '',
          joining_date: new Date().toISOString().split('T')[0]
        });
        alert('New agent profile created successfully.');
      })
      .catch(err => {
        alert(err.message || 'Failed to create agent.');
      });
  };

  const handleDeleteAgent = async (id) => {
    if (await window.confirm('Are you sure you want to delete this agent?')) {
      agentApi.delete(id)
        .then(() => {
          fetchAgents();
          alert('Agent profile deleted successfully.');
        })
        .catch(err => {
          alert(err.message || 'Failed to delete agent.');
        });
    }
  };

  return (
    <div className="space-y-6">
      <SettingsNavigation />

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-primary-text">Field Agents</h3>
          <p className="text-xs text-secondary-text">Manage collection agents, link policies, and parent branch areas</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="material-symbols-rounded text-sm select-none">add</span>
          Add New Agent
        </button>
      </div>

      {/* Agents List Table */}
      <div className="bg-surface rounded-2xl border border-border-fin shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-fin">
            <thead className="bg-background-fin">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Agent Code</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Agent Name</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Contact Info</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Parent Branch / Area</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Policy profile</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-fin text-xs font-medium text-secondary-text">
              {(() => {
                const sortedAgents = [...agents].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
                const paginatedAgents = sortedAgents.slice((currentPage - 1) * 20, currentPage * 20);

                return paginatedAgents.map((ag) => (
                  <tr key={ag.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-primary-text">{ag.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">{ag.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="block font-bold text-primary-text">{ag.mobile}</span>
                      <span className="block text-[10px] text-secondary-text">{ag.email || 'No Email'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="block font-semibold text-primary-text">{ag.branch_name}</span>
                      <span className="block text-[10px] text-secondary-text">{ag.area_name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-primary-text">{ag.policy_name || 'No Policy Link'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        ag.status === 'Active' ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                      }`}>
                        {ag.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                      <Link
                        to={`/settings/agent/${ag.id}`}
                        className="p-1 rounded text-primary hover:bg-primary/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Edit Agent"
                      >
                        <span className="material-symbols-rounded text-sm select-none">edit</span>
                      </Link>
                      <button
                        onClick={() => handleDeleteAgent(ag.id)}
                        className="p-1 rounded text-danger-fin hover:bg-danger-fin/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Delete Agent"
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
          totalPages={Math.ceil(agents.length / 20)}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-6 rounded-[2rem] border border-border-fin max-w-md w-full shadow-2xl space-y-5 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-border-fin">
              <h4 className="text-base font-extrabold text-primary-text">Create Agent profile</h4>
              <button 
                onClick={() => setShowAddForm(false)} 
                className="p-1 rounded-lg hover:bg-slate-100 text-secondary-text cursor-pointer active:scale-90"
              >
                <span className="material-symbols-rounded block text-lg select-none">close</span>
              </button>
            </div>
            <form onSubmit={handleAddAgent} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Agent Code <span className="text-danger-fin">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AG-005"
                  value={newAgent.code}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Agent Name <span className="text-danger-fin">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Singh"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Mobile <span className="text-danger-fin">*</span></label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={newAgent.mobile}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, mobile: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  placeholder="e.g. agent@umbrella.com"
                  value={newAgent.email}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Branch *"
                  required={true}
                  options={branches.map(b => ({ value: String(b.id), label: b.name }))}
                  value={newAgent.branch_id}
                  onChange={(val) => setNewAgent(prev => ({ ...prev, branch_id: val, area_id: '' }))}
                />
                <Select
                  label="Area *"
                  required={true}
                  options={areas
                    .filter(a => !newAgent.branch_id || String(a.branch_id) === String(newAgent.branch_id))
                    .map(a => ({ value: String(a.id), label: a.name }))}
                  value={newAgent.area_id}
                  onChange={(val) => setNewAgent(prev => ({ ...prev, area_id: val }))}
                />
              </div>

              <div className="space-y-1">
                <Select
                  label="Link Policy profile"
                  required={false}
                  options={policies
                    .filter(p => p.role.includes('Agent'))
                    .map(p => ({ value: String(p.id), label: p.name }))}
                  value={newAgent.policy_id}
                  onChange={(val) => setNewAgent(prev => ({ ...prev, policy_id: val }))}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10"
              >
                Register Field Agent
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
