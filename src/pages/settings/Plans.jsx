import React, { useState, useEffect } from 'react';
import { SettingsNavigation } from './General';
import { Select } from '../../components/ui/Select';
import { planApi, settingsApi } from '../../services/api';

const EMPTY_PLAN = {
  name: '',
  min_amount: '',
  max_amount: '',
  interest_rate: '',
  interest_type: 'Flat',
  duration_value: '',
  duration_unit: 'Days',
  collection_frequency: 'Daily',
  processing_fee: '',
  penalty_per_day: '',
  deposit_amount: '',
  maturity_amount: ''
};

export default function Plans() {
  const [activePlanTab, setActivePlanTab] = useState('loan');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [loanPlans, setLoanPlans] = useState([]);
  const [savingPlans, setSavingPlans] = useState([]);
  const [termsSavings, setTermsSavings] = useState([]);
  const [termsLoan, setTermsLoan] = useState([]);
  const [isSavingTerms, setIsSavingTerms] = useState(false);

  const [newPlan, setNewPlan] = useState(EMPTY_PLAN);

  useEffect(() => {
    fetchPlans();
    fetchTerms();
  }, []);

  const fetchPlans = () => {
    planApi.loanPlans.list()
      .then(res => setLoanPlans(res.data || []))
      .catch(() => {});

    planApi.savingPlans.list()
      .then(res => setSavingPlans(res.data || []))
      .catch(() => {});
  };

  const fetchTerms = () => {
    settingsApi.get()
      .then(res => {
        setTermsSavings(res.data?.terms_savings || []);
        setTermsLoan(res.data?.terms_loan || []);
      })
      .catch(() => {});
  };

  const handleSaveTerms = () => {
    setIsSavingTerms(true);
    const cleanSavings = termsSavings.map(t => t.trim()).filter(Boolean);
    const cleanLoan = termsLoan.map(t => t.trim()).filter(Boolean);

    settingsApi.update({
      terms_savings: cleanSavings,
      terms_loan: cleanLoan
    })
      .then(() => {
        setTermsSavings(cleanSavings);
        setTermsLoan(cleanLoan);
        alert('Terms & Conditions updated successfully.');
      })
      .catch((err) => {
        alert(err.message || 'Failed to update Terms & Conditions.');
      })
      .finally(() => {
        setIsSavingTerms(false);
      });
  };

  const handleOpenCreate = () => {
    setEditing(null);
    resetForm();
    setShowAddForm(true);
  };

  const handleOpenEdit = (plan, type) => {
    setActivePlanTab(type);
    setEditing({ ...plan, _type: type });
    setNewPlan({
      ...EMPTY_PLAN,
      name: plan.name || '',
      min_amount: plan.min_amount ?? '',
      max_amount: plan.max_amount ?? '',
      interest_rate: plan.interest_rate ?? '',
      interest_type: plan.interest_type || 'Flat',
      duration_value: plan.duration_value ?? '',
      duration_unit: plan.duration_unit || 'Days',
      collection_frequency: plan.collection_frequency || 'Daily',
      processing_fee: plan.processing_fee ?? '',
      penalty_per_day: plan.penalty_per_day ?? '',
      deposit_amount: plan.deposit_amount ?? '',
      maturity_amount: plan.maturity_amount ?? ''
    });
    setShowAddForm(true);
  };

  const handleAddPlan = (e) => {
    e.preventDefault();
    if (!newPlan.name || !newPlan.interest_rate || !newPlan.duration_value) {
      alert('Please fill out Name, Interest Rate, and Duration.');
      return;
    }

    if (activePlanTab === 'loan') {
      const data = {
        name: newPlan.name,
        min_amount: parseFloat(newPlan.min_amount) || 0,
        max_amount: parseFloat(newPlan.max_amount) || 0,
        interest_rate: parseFloat(newPlan.interest_rate) || 0,
        interest_type: newPlan.interest_type,
        duration_value: parseInt(newPlan.duration_value) || 0,
        duration_unit: newPlan.duration_unit,
        collection_frequency: newPlan.collection_frequency,
        processing_fee: parseFloat(newPlan.processing_fee) || 0,
        penalty_per_day: parseFloat(newPlan.penalty_per_day) || 0
      };

      const op = editing
        ? planApi.loanPlans.update(editing.id, data)
        : planApi.loanPlans.create(data);

      op.then(() => {
          fetchPlans();
          setShowAddForm(false);
          setEditing(null);
          resetForm();
          alert(editing ? 'Loan plan updated successfully.' : 'Loan plan registered successfully.');
        })
        .catch(err => alert(err.message || 'Failed to save loan plan.'));
    } else {
      const data = {
        name: newPlan.name,
        deposit_amount: parseFloat(newPlan.deposit_amount) || 0,
        interest_rate: parseFloat(newPlan.interest_rate) || 0,
        duration_value: parseInt(newPlan.duration_value) || 0,
        duration_unit: newPlan.duration_unit,
        collection_frequency: newPlan.collection_frequency,
        maturity_amount: parseFloat(newPlan.maturity_amount) || 0
      };

      const op = editing
        ? planApi.savingPlans.update(editing.id, data)
        : planApi.savingPlans.create(data);

      op.then(() => {
          fetchPlans();
          setShowAddForm(false);
          setEditing(null);
          resetForm();
          alert(editing ? 'Savings plan updated successfully.' : 'Savings plan registered successfully.');
        })
        .catch(err => alert(err.message || 'Failed to save savings plan.'));
    }
  };

  const resetForm = () => {
    setNewPlan(EMPTY_PLAN);
  };

  const handleDeletePlan = async (id, type) => {
    if (await window.confirm('Are you sure you want to delete this plan?')) {
      const deleteCall = type === 'loan' ? planApi.loanPlans.delete(id) : planApi.savingPlans.delete(id);
      deleteCall
        .then(() => {
          fetchPlans();
          alert('Plan deleted successfully.');
        })
        .catch(err => {
          alert(err.message || 'Failed to delete plan.');
        });
    }
  };

  return (
    <div className="space-y-6">
      <SettingsNavigation />

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-primary-text">Plan Master</h3>
          <p className="text-xs text-secondary-text">Configure loan plans, savings templates, and terms & conditions</p>
        </div>
        {activePlanTab !== 'terms' && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="material-symbols-rounded text-sm select-none">add</span>
            Add New Plan
          </button>
        )}
      </div>

      {/* Plan Tabs */}
      <div className="flex border-b border-border-fin">
        <button
          onClick={() => { setActivePlanTab('loan'); resetForm(); }}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activePlanTab === 'loan' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-secondary-text hover:text-primary-text'
          }`}
        >
          Loan Plans
        </button>
        <button
          onClick={() => { setActivePlanTab('saving'); resetForm(); }}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activePlanTab === 'saving' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-secondary-text hover:text-primary-text'
          }`}
        >
          Savings Plans
        </button>
        <button
          onClick={() => { setActivePlanTab('terms'); }}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activePlanTab === 'terms' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-secondary-text hover:text-primary-text'
          }`}
        >
          Terms & Conditions
        </button>
      </div>

      {/* Plans Table */}
      {activePlanTab === 'terms' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fadeIn_0.2s_ease-out]">
          {/* Savings T&C Card */}
          <div className="bg-surface rounded-2xl border border-border-fin shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-border-fin">
              <div>
                <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider">Savings Terms & Conditions</h4>
                <p className="text-[10px] text-secondary-text mt-0.5">These will print on Passbook & Maturity Bond</p>
              </div>
              <button
                type="button"
                onClick={() => setTermsSavings(prev => [...prev, ''])}
                className="px-3 py-1.5 bg-[#FFC107]/15 text-[#D97706] rounded-xl text-xs font-bold hover:bg-[#FFC107]/25 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-rounded text-sm">add</span>
                Add Condition
              </button>
            </div>

            {termsSavings.length === 0 ? (
              <p className="text-xs text-secondary-text text-center py-6">No terms added. Click "Add Condition" to create one.</p>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 no-scrollbar">
                {termsSavings.map((term, idx) => (
                  <div key={idx} className="flex items-center gap-2 animate-[fadeIn_0.15s_ease-out]">
                    <span className="text-xs font-extrabold text-secondary-text w-5 text-right">{idx + 1}.</span>
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => {
                        const newTerms = [...termsSavings];
                        newTerms[idx] = e.target.value;
                        setTermsSavings(newTerms);
                      }}
                      placeholder="Enter terms/condition statement..."
                      className="flex-1 px-4 py-2.5 bg-slate-50/50 border border-border-fin rounded-xl text-xs font-semibold text-primary-text focus:outline-none focus:bg-white focus:border-[#D97706]/45 focus:ring-4 focus:ring-[#D97706]/5 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setTermsSavings(termsSavings.filter((_, i) => i !== idx));
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      title="Delete"
                    >
                      <span className="material-symbols-rounded text-base">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Loan T&C Card */}
          <div className="bg-surface rounded-2xl border border-border-fin shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-border-fin">
              <div>
                <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider">Loan Terms & Conditions</h4>
                <p className="text-[10px] text-secondary-text mt-0.5">These will print on Account Passbook</p>
              </div>
              <button
                type="button"
                onClick={() => setTermsLoan(prev => [...prev, ''])}
                className="px-3 py-1.5 bg-[#FFC107]/15 text-[#D97706] rounded-xl text-xs font-bold hover:bg-[#FFC107]/25 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-rounded text-sm">add</span>
                Add Condition
              </button>
            </div>

            {termsLoan.length === 0 ? (
              <p className="text-xs text-secondary-text text-center py-6">No terms added. Click "Add Condition" to create one.</p>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 no-scrollbar">
                {termsLoan.map((term, idx) => (
                  <div key={idx} className="flex items-center gap-2 animate-[fadeIn_0.15s_ease-out]">
                    <span className="text-xs font-extrabold text-secondary-text w-5 text-right">{idx + 1}.</span>
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => {
                        const newTerms = [...termsLoan];
                        newTerms[idx] = e.target.value;
                        setTermsLoan(newTerms);
                      }}
                      placeholder="Enter terms/condition statement..."
                      className="flex-1 px-4 py-2.5 bg-slate-50/50 border border-border-fin rounded-xl text-xs font-semibold text-primary-text focus:outline-none focus:bg-white focus:border-[#D97706]/45 focus:ring-4 focus:ring-[#D97706]/5 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setTermsLoan(termsLoan.filter((_, i) => i !== idx));
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      title="Delete"
                    >
                      <span className="material-symbols-rounded text-base">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="lg:col-span-2 flex justify-end">
            <button
              onClick={handleSaveTerms}
              disabled={isSavingTerms}
              className="px-6 py-3 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #FFD54A 0%, #FBBF24 35%, #F59E0B 70%, #E67E00 100%)' }}
            >
              <span className="material-symbols-rounded text-sm">save</span>
              {isSavingTerms ? 'Saving Terms...' : 'Save Terms & Conditions'}
            </button>
          </div>
        </div>
      ) : activePlanTab === 'loan' ? (
        <div className="bg-surface rounded-2xl border border-border-fin shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-fin">
              <thead className="bg-background-fin">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Plan Name</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Principal Limits</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Interest Config</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Frequency</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Processing Fee</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Penalty</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-fin text-xs font-medium text-secondary-text">
                {loanPlans.map((lp) => (
                  <tr key={lp.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-primary-text">{lp.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{parseFloat(lp.min_amount).toLocaleString()} - ₹{parseFloat(lp.max_amount).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{lp.interest_rate}% ({lp.interest_type})</td>
                    <td className="px-6 py-4 whitespace-nowrap">{lp.duration_value} {lp.duration_unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap capitalize">{lp.collection_frequency}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{parseFloat(lp.processing_fee).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{parseFloat(lp.penalty_per_day).toLocaleString()}/day</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        lp.status === 'Active' ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                      }`}>
                        {lp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(lp, 'loan')}
                        className="p-1 rounded text-primary hover:bg-primary/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Edit Plan"
                      >
                        <span className="material-symbols-rounded text-sm select-none">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeletePlan(lp.id, 'loan')}
                        className="p-1 rounded text-danger-fin hover:bg-danger-fin/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Delete Plan"
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
      ) : activePlanTab === 'saving' ? (
        <div className="bg-surface rounded-2xl border border-border-fin shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-fin">
              <thead className="bg-background-fin">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Plan Name</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Deposit Size</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Interest Rate</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Frequency</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Estimated Maturity</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-secondary-text uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-fin text-xs font-medium text-secondary-text">
                {savingPlans.map((sp) => (
                  <tr key={sp.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-primary-text">{sp.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{parseFloat(sp.deposit_amount).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{sp.interest_rate}%</td>
                    <td className="px-6 py-4 whitespace-nowrap">{sp.duration_value} {sp.duration_unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap capitalize">{sp.collection_frequency}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-success-fin font-bold">₹{parseFloat(sp.maturity_amount).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        sp.status === 'Active' ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                      }`}>
                        {sp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(sp, 'saving')}
                        className="p-1 rounded text-primary hover:bg-primary/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Edit Plan"
                      >
                        <span className="material-symbols-rounded text-sm select-none">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeletePlan(sp.id, 'saving')}
                        className="p-1 rounded text-danger-fin hover:bg-danger-fin/10 cursor-pointer transition-all active:scale-[0.95]"
                        title="Delete Plan"
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
      ) : null}

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-6 rounded-[2rem] border border-border-fin max-w-md w-full max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl space-y-5 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-border-fin">
              <h4 className="text-base font-extrabold text-primary-text">{editing ? 'Edit' : 'Add'} {activePlanTab === 'loan' ? 'Loan' : 'Savings'} Plan</h4>
              <button
                onClick={() => { setShowAddForm(false); setEditing(null); resetForm(); }}
                className="p-1 rounded-lg hover:bg-slate-100 text-secondary-text cursor-pointer active:scale-90"
              >
                <span className="material-symbols-rounded block text-lg select-none">close</span>
              </button>
            </div>
            <form onSubmit={handleAddPlan} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Plan Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily Business Loan"
                  value={newPlan.name}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>

              {activePlanTab === 'loan' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Min Amount *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 5000"
                        value={newPlan.min_amount}
                        onChange={(e) => setNewPlan(prev => ({ ...prev, min_amount: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Max Amount *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 20000"
                        value={newPlan.max_amount}
                        onChange={(e) => setNewPlan(prev => ({ ...prev, max_amount: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Interest Rate (%) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 12"
                        value={newPlan.interest_rate}
                        onChange={(e) => setNewPlan(prev => ({ ...prev, interest_rate: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                    <Select
                      label="Interest Type"
                      required={true}
                      options={[
                        { value: 'Flat', label: 'Flat Interest' },
                        { value: 'Reducing', label: 'Reducing Balance' }
                      ]}
                      value={newPlan.interest_type}
                      onChange={(val) => setNewPlan(prev => ({ ...prev, interest_type: val }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Duration Value *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 100"
                        value={newPlan.duration_value}
                        onChange={(e) => setNewPlan(prev => ({ ...prev, duration_value: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                    <Select
                      label="Duration Unit"
                      required={true}
                      options={[
                        { value: 'Days', label: 'Days' },
                        { value: 'Months', label: 'Months' },
                        { value: 'Years', label: 'Years' }
                      ]}
                      value={newPlan.duration_unit}
                      onChange={(val) => setNewPlan(prev => ({ ...prev, duration_unit: val }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Processing Fee</label>
                      <input
                        type="number"
                        placeholder="e.g. 200"
                        value={newPlan.processing_fee}
                        onChange={(e) => setNewPlan(prev => ({ ...prev, processing_fee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Penalty / Day</label>
                      <input
                        type="number"
                        placeholder="e.g. 10"
                        value={newPlan.penalty_per_day}
                        onChange={(e) => setNewPlan(prev => ({ ...prev, penalty_per_day: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                  </div>
                  <Select
                    label="Collection Frequency"
                    required={true}
                    options={[
                      { value: 'Daily', label: 'Daily Collection' },
                      { value: 'Weekly', label: 'Weekly Collection' },
                      { value: 'Monthly', label: 'Monthly Collection' }
                    ]}
                    value={newPlan.collection_frequency}
                    onChange={(val) => setNewPlan(prev => ({ ...prev, collection_frequency: val }))}
                  />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Deposit Size *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 100"
                        value={newPlan.deposit_amount}
                        onChange={(e) => setNewPlan(prev => ({ ...prev, deposit_amount: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Interest Rate (%) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 6"
                        value={newPlan.interest_rate}
                        onChange={(e) => setNewPlan(prev => ({ ...prev, interest_rate: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Duration Value *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 365"
                        value={newPlan.duration_value}
                        onChange={(e) => setNewPlan(prev => ({ ...prev, duration_value: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                      />
                    </div>
                    <Select
                      label="Duration Unit"
                      required={true}
                      options={[
                        { value: 'Days', label: 'Days' },
                        { value: 'Months', label: 'Months' },
                        { value: 'Years', label: 'Years' }
                      ]}
                      value={newPlan.duration_unit}
                      onChange={(val) => setNewPlan(prev => ({ ...prev, duration_unit: val }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Estimated Maturity Amount</label>
                    <input
                      type="number"
                      placeholder="e.g. 38690"
                      value={newPlan.maturity_amount}
                      onChange={(e) => setNewPlan(prev => ({ ...prev, maturity_amount: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                  </div>
                  <Select
                    label="Collection Frequency"
                    required={true}
                    options={[
                      { value: 'Daily', label: 'Daily Collection' },
                      { value: 'Weekly', label: 'Weekly Collection' },
                      { value: 'Monthly', label: 'Monthly Collection' }
                    ]}
                    value={newPlan.collection_frequency}
                    onChange={(val) => setNewPlan(prev => ({ ...prev, collection_frequency: val }))}
                  />
                </>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10"
              >
                {editing ? 'Save Changes' : 'Create Plan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
