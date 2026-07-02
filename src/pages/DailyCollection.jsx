import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { loanApi, savingApi } from '../services/api';
import { DatePicker } from '../components/ui/DatePicker';
import { Select } from '../components/ui/Select';
import { Pagination } from '../components/ui/Pagination';

const inr = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const mapLoan = (l) => ({
  id: l.id,
  accNo: l.loan_account_no,
  type: 'Loan',
  status: l.account_status,
  planName: l.plan_name,
  principal: Number(l.principal_amount),
  totalPaid: Number(l.total_paid),
  outstanding: Number(l.outstanding_amount),
  emi: Number(l.emi_amount),
  cycle: l.collection_frequency,
  todayDue: Number(l.today_due || 0),
  nextDueDate: l.next_due_date,
  paidInstallments: Number(l.paid_installments || 0),
  totalInstallments: Number(l.total_installments || 0),
  startDate: l.start_date,
  endDate: l.end_date,
  customerName: l.customer_name,
  customerMobile: l.customer_mobile,
  agentName: l.agent_name,
  branchName: l.branch_name,
  areaName: l.area_name,
  approvedAt: l.approved_at
});

const mapSaving = (s) => ({
  id: s.id,
  accNo: s.saving_account_no,
  type: 'Saving',
  status: s.account_status,
  planName: s.plan_name,
  principal: Number(s.deposit_amount),
  totalPaid: Number(s.total_deposited),
  outstanding: Math.max(0, Number(s.maturity_amount || 0) - Number(s.total_deposited || 0)),
  emi: Number(s.deposit_amount),
  cycle: s.collection_frequency,
  todayDue: Number(s.today_due || 0),
  nextDueDate: s.maturity_date,
  startDate: s.start_date,
  customerName: s.customer_name,
  customerMobile: s.customer_mobile,
  agentName: s.agent_name,
  branchName: s.branch_name,
  areaName: s.area_name,
  approvedAt: s.approved_at
});

const STATUS_STYLES = {
  Active:     'bg-[#16A34A]/10 text-[#16A34A]',
  Approved:   'bg-[#16A34A]/10 text-[#16A34A]',
  Processing: 'bg-[#2563EB]/10 text-[#2563EB]',
  Defaulter:  'bg-[#DC2626]/10 text-[#DC2626]',
  NPA:        'bg-[#7F1D1D]/10 text-[#7F1D1D]',
  Rejected:   'bg-[#B91C1C]/10 text-[#B91C1C]',
  Closed:     'bg-[#64748B]/10 text-[#64748B]',
  Matured:    'bg-[#16A34A]/10 text-[#16A34A]'
};

export default function DailyCollection() {
  const location = useLocation();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [collectionAmount, setCollectionAmount] = useState('');
  const [fineAmount, setFineAmount] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterStatus, searchFilter]);

  // Approval modal states
  const [approvingAccount, setApprovingAccount] = useState(null);
  const [approvalStartDate, setApprovalStartDate] = useState('');
  const [approvalDate, setApprovalDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const fetchAccounts = useCallback(() => {
    setLoading(true);
    Promise.all([
      loanApi.list({ limit: 100 }),
      savingApi.list({ limit: 100 })
    ])
      .then(([loansRes, savingsRes]) => {
        const loans = (loansRes.data || []).map(mapLoan);
        const savings = (savingsRes.data || []).map(mapSaving);
        setAccounts([...loans, ...savings]);
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchVal = params.get('search');
    setSearchFilter(searchVal || '');
  }, [location.search]);

  const handleApprove = (acc) => {
    setApprovingAccount(acc);
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const initialDate = acc.startDate || today;
    setApprovalStartDate(initialDate);
    setApprovalDate(initialDate);
  };

  const handleConfirmApproval = () => {
    if (!approvingAccount) return;
    
    if (approvalDate < approvalStartDate) {
      alert("Approved Date cannot be before the Account Opening Date.");
      return;
    }

    const call = approvingAccount.type === 'Loan'
      ? loanApi.approve(approvingAccount.accNo, approvalStartDate, approvalDate)
      : savingApi.approve(approvingAccount.accNo, approvalStartDate, approvalDate);

    call.then(() => {
      alert(`${approvingAccount.accNo} approved successfully. Schedule generated.`);
      setApprovingAccount(null);
      fetchAccounts();
    }).catch(err => alert(err.message || 'Approval failed.'));
  };

  const handleReject = (acc) => {
    if (!window.confirm(`Reject ${acc.accNo}?`)) return;
    const call = acc.type === 'Loan' ? loanApi.reject(acc.accNo) : savingApi.reject(acc.accNo);
    call.then(() => {
      alert(`${acc.accNo} rejected.`);
      fetchAccounts();
    }).catch(err => alert(err.message || 'Rejection failed.'));
  };

  const handleOpenCollect = (acc) => {
    setSelectedAccount(acc);
    const due = acc.todayDue > 0 ? acc.todayDue : acc.emi;
    setCollectionAmount(String(due));
    setFineAmount('0');
  };

  const handleSubmitCollection = (e) => {
    e.preventDefault();
    if (!selectedAccount) return;

    const amt = parseFloat(collectionAmount) || 0;
    const fine = parseFloat(fineAmount) || 0;
    if (amt <= 0) {
      alert('Please enter a valid collection amount.');
      return;
    }

    setSubmitting(true);
    const today = new Date().toISOString().slice(0, 10);
    const call = selectedAccount.type === 'Loan'
      ? loanApi.collect(selectedAccount.accNo, amt, fine, 'Cash', null, today)
      : savingApi.deposit(selectedAccount.accNo, amt, 'Cash', null, today);

    call.then(res => {
        setReceipt({
          accNo: selectedAccount.accNo,
          customer: selectedAccount.customerName,
          type: selectedAccount.type,
          amt,
          fine,
          total: amt + fine,
          receiptNo: res.data?.receipt_no,
          date: new Date().toLocaleDateString('en-IN'),
          collector: localStorage.getItem('username') || 'System'
        });
        setSelectedAccount(null);
        fetchAccounts();
      })
      .catch(err => alert(err.message || 'Collection failed.'))
      .finally(() => setSubmitting(false));
  };

  const filteredAccounts = accounts.filter(acc => {
    if (filterType !== 'All' && acc.type !== filterType) return false;
    if (filterStatus !== 'All' && acc.status !== filterStatus) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase().trim();
      
      // Smart matching for short account numbers (e.g., "8", "10", "12")
      const isShortNumber = /^\d+$/.test(q);
      let shortNumberMatch = false;
      if (isShortNumber) {
        const padded = q.padStart(6, '0');
        if (acc.accNo.endsWith(padded)) {
          shortNumberMatch = true;
        }
      }

      const hit = shortNumberMatch
        || (acc.accNo || '').toLowerCase().includes(q)
        || (acc.customerName || '').toLowerCase().includes(q)
        || (acc.customerMobile || '').includes(q);
      if (!hit) return false;
    }
    return true;
  });

  return (
    <div className="w-full space-y-6">
      <div className="w-full bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#F1F5F9] pb-4">
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">Daily Collection Accounts</h3>
            <p className="text-xs text-[#64748B]">Manage open loan and savings collections — approve, schedule, collect.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-xl">
              {['All', 'Loan', 'Saving'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === t
                      ? 'bg-[#0A3598] text-white shadow-sm'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {t === 'All' ? 'All Accounts' : t === 'Loan' ? 'Loans Only' : 'Savings Only'}
                </button>
              ))}
            </div>

            <Select
              options={[
                { value: "All", label: "All Statuses" },
                { value: "Processing", label: "Processing" },
                { value: "Approved", label: "Approved" },
                { value: "Active", label: "Active" },
                { value: "Defaulter", label: "Defaulter" },
                { value: "NPA", label: "NPA" },
                { value: "Rejected", label: "Rejected" },
                { value: "Closed", label: "Closed" },
                { value: "Matured", label: "Matured" }
              ]}
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              searchable={false}
              compact={true}
            />
          </div>
        </div>

        {searchFilter && (
          <div className="flex items-center justify-between bg-[#0A3598]/5 border border-[#0A3598]/25 rounded-xl px-4 py-2.5 text-xs font-semibold text-[#0A3598]">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-rounded text-sm select-none">filter_alt</span>
              <span>Active Search: "{searchFilter}"</span>
            </div>
            <button onClick={() => { setSearchFilter(''); navigate('/collection'); }} className="text-xs font-bold hover:underline cursor-pointer">Clear</button>
          </div>
        )}

        {/* Desktop Table (Hidden on Mobile) */}
        <div className="hidden lg:block overflow-x-auto -mx-6">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-[#E2E8F0]">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Account No</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Today's Due</th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Outstanding</th>
                  <th className="px-6 py-3.5 text-center text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] bg-white">
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-10 text-xs text-[#64748B]">Loading accounts…</td></tr>
                ) : (() => {
                  const sorted = [...filteredAccounts].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
                  const paginated = sorted.slice((currentPage - 1) * 20, currentPage * 20);

                  if (paginated.length === 0) {
                    return <tr><td colSpan="7" className="text-center py-12 text-xs text-[#64748B]">No accounts match current filters.</td></tr>;
                  }

                  return paginated.map(acc => (
                    <tr key={`${acc.type}-${acc.id}`} className="hover:bg-[#F8FAFC]/50 transition-colors cursor-pointer" onClick={() => navigate(`/account/${acc.accNo}`)}>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-[#0A3598]">{acc.accNo}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-xs font-bold text-[#0F172A]">{acc.customerName}</div>
                        <div className="text-[10px] text-[#64748B]">{acc.customerMobile}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          acc.type === 'Loan' ? 'bg-[#0A3598]/10 text-[#0A3598]' : 'bg-[#FFC107]/10 text-[#D97706]'
                        }`}>{acc.type}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_STYLES[acc.status] || 'bg-slate-100 text-slate-600'}`}>{acc.status}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-right text-[#EA580C]">₹{inr(acc.todayDue)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-semibold text-right text-[#0F172A]">₹{inr(acc.outstanding)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {acc.status === 'Processing' ? (
                          <div className="flex gap-1.5 justify-center">
                            <button
                              onClick={() => handleApprove(acc)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#16A34A] text-white hover:bg-[#16A34A]/90 transition-all cursor-pointer shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(acc)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : ['Approved', 'Active', 'Defaulter'].includes(acc.status) ? (
                          <button
                            onClick={() => handleOpenCollect(acc)}
                            className="px-4 py-1.5 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto shadow-sm"
                          >
                            <span className="material-symbols-rounded text-sm select-none">payments</span>
                            Collect
                          </button>
                        ) : (
                          <Link to={`/account/${acc.accNo}`} className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider hover:text-[#0A3598]">
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile-friendly Card List (No Horizontal Scroll, Hidden on Desktop) */}
        <div className="block lg:hidden space-y-3 px-4 -mx-6 mb-4">
          {loading ? (
            <div className="text-center py-8 text-xs text-[#64748B]">Loading accounts…</div>
          ) : (() => {
            const sorted = [...filteredAccounts].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
            const paginated = sorted.slice((currentPage - 1) * 20, currentPage * 20);

            if (paginated.length === 0) {
              return (
                <div className="text-center py-8 text-secondary-text font-bold text-xs">
                  No accounts match current filters.
                </div>
              );
            }

            return paginated.map(acc => (
              <div 
                key={`${acc.type}-${acc.id}`} 
                className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3 shadow-sm hover:border-[#0A3598]/30 transition-all cursor-pointer"
                onClick={() => navigate(`/account/${acc.accNo}`)}
              >
                {/* Header: Acc No & Type */}
                <div className="flex justify-between items-center border-b border-[#E2E8F0]/50 pb-2">
                  <span className="font-extrabold text-[#0A3598] text-xs select-all">
                    {acc.accNo}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                      acc.type === 'Loan' ? 'bg-[#0A3598]/10 text-[#0A3598]' : 'bg-[#FFC107]/10 text-[#D97706]'
                    }`}>
                      {acc.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${STATUS_STYLES[acc.status] || 'bg-slate-100 text-slate-600'}`}>
                      {acc.status}
                    </span>
                  </div>
                </div>

                {/* Body Details */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-0.5 col-span-2">
                    <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider block">Customer</span>
                    <span className="text-[#0F172A] font-extrabold block">{acc.customerName}</span>
                    <span className="text-[10px] text-[#64748B] font-semibold block">{acc.customerMobile}</span>
                  </div>
                  
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider block">Today's Due</span>
                    <span className="text-[#EA580C] font-black text-xs">₹{inr(acc.todayDue)}</span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider block">Outstanding</span>
                    <span className="text-[#0F172A] font-extrabold text-xs">₹{inr(acc.outstanding)}</span>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="border-t border-[#E2E8F0]/50 pt-2.5 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  {acc.status === 'Processing' ? (
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => handleApprove(acc)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#16A34A] text-white active:scale-95 transition-all cursor-pointer shadow-sm text-center"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(acc)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-200 active:scale-95 transition-all cursor-pointer text-center"
                      >
                        Reject
                      </button>
                    </div>
                  ) : ['Approved', 'Active', 'Defaulter'].includes(acc.status) ? (
                    <button
                      onClick={() => handleOpenCollect(acc)}
                      className="w-full py-2 bg-[#0A3598] text-white rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-rounded text-sm select-none">payments</span>
                      Collect
                    </button>
                  ) : (
                    <Link to={`/account/${acc.accNo}`} className="text-[10px] text-[#0A3598] font-black uppercase tracking-wider hover:underline flex items-center gap-0.5">
                      View Details
                      <span className="material-symbols-rounded text-xs select-none">chevron_right</span>
                    </Link>
                  )}
                </div>
              </div>
            ));
          })()}
        </div>
        <Pagination 
          currentPage={currentPage}
          totalPages={Math.ceil(filteredAccounts.length / 20)}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Collection Modal */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedAccount(null)}></div>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative z-10 border border-[#E2E8F0] text-[#0F172A] flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold">Collection Entry</h3>
              <button onClick={() => setSelectedAccount(null)} className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg hover:bg-slate-100">
                <span className="material-symbols-rounded text-lg select-none">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitCollection} className="space-y-4">
              <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold">{selectedAccount.customerName}</h4>
                    <span className="text-[10px] text-[#64748B] block mt-0.5">{selectedAccount.customerMobile}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    selectedAccount.type === 'Loan' ? 'bg-[#0A3598]/10 text-[#0A3598]' : 'bg-[#FFC107]/10 text-[#D97706]'
                  }`}>
                    {selectedAccount.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] pt-2 border-t border-[#E2E8F0] text-[#64748B]">
                  <div><span className="block font-semibold">Account No</span><strong className="text-[#0F172A]">{selectedAccount.accNo}</strong></div>
                  <div><span className="block font-semibold">Plan</span><strong className="text-[#0F172A]">{selectedAccount.planName}</strong></div>
                  <div><span className="block font-semibold">EMI / Deposit</span><strong className="text-[#0A3598]">₹{inr(selectedAccount.emi)}</strong></div>
                  <div><span className="block font-semibold">Today's Due</span><strong className="text-[#EA580C]">₹{inr(selectedAccount.todayDue)}</strong></div>
                  <div><span className="block font-semibold">Outstanding</span><strong className="text-[#0F172A]">₹{inr(selectedAccount.outstanding)}</strong></div>
                  <div><span className="block font-semibold">Cycle</span><strong className="text-[#0F172A]">{selectedAccount.cycle}</strong></div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Amount Collected (₹) <span className="text-danger-fin">*</span></label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  required
                  value={collectionAmount}
                  onChange={(e) => setCollectionAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl text-sm font-bold focus:outline-none focus:border-[#0A3598] focus:ring-2 focus:ring-[#0A3598]/10"
                />
                <div className="flex gap-2 mt-2">
                  {[selectedAccount.emi, selectedAccount.todayDue, selectedAccount.outstanding].filter(v => v > 0).map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCollectionAmount(String(q))}
                      className="px-2.5 py-1 bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#0A3598] text-[#0A3598] rounded-lg text-[10px] font-bold"
                    >
                      ₹{inr(q)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedAccount.type === 'Loan' && (
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Fine / Penalty (₹)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={fineAmount}
                    onChange={(e) => setFineAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl text-sm font-bold focus:outline-none focus:border-[#0A3598] focus:ring-2 focus:ring-[#0A3598]/10"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setSelectedAccount(null)} className="flex-1 px-4 py-2.5 border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] rounded-xl text-xs font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-[#0A3598] text-white rounded-xl text-xs font-bold hover:bg-[#0A3598]/90 shadow-md shadow-[#0A3598]/10 disabled:opacity-60">
                  {submitting ? 'Saving…' : 'Save Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setReceipt(null)}></div>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative z-10 border border-[#E2E8F0] flex flex-col gap-4">
            <div className="text-center pb-4 border-b border-dashed border-[#E2E8F0]">
              <span className="text-sm font-bold block">Umbrella Finance</span>
              <span className="text-[10px] text-[#64748B] block mt-0.5">Collection Receipt</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[#64748B]">Receipt No</span><span className="font-bold">{receipt.receiptNo}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Date</span><span className="font-medium">{receipt.date}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Account</span><span className="font-bold">{receipt.accNo}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Customer</span><span className="font-medium">{receipt.customer}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Collector</span><span className="font-bold">{receipt.collector}</span></div>
            </div>
            <div className="space-y-2 p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs">
              <div className="flex justify-between"><span className="text-[#64748B]">Amount</span><span className="font-bold text-[#16A34A]">₹{inr(receipt.amt)}</span></div>
              {receipt.fine > 0 && <div className="flex justify-between"><span className="text-[#64748B]">Fine</span><span className="font-bold">₹{inr(receipt.fine)}</span></div>}
              <div className="flex justify-between border-t border-dashed border-[#E2E8F0] pt-2 font-bold text-sm text-[#0A3598]">
                <span>Total Received</span><span>₹{inr(receipt.total)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => window.print()} className="flex items-center justify-center gap-1 px-4 py-2.5 bg-[#0A3598] text-white rounded-xl text-xs font-bold hover:bg-[#0A3598]/90">
                <span className="material-symbols-rounded text-sm select-none">print</span>Print
              </button>
              <button onClick={() => setReceipt(null)} className="px-4 py-2.5 border border-[#E2E8F0] hover:bg-slate-50 text-[#64748B] rounded-xl text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Approval Modal */}
      {approvingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setApprovingAccount(null)}></div>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative z-10 border border-[#E2E8F0] flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-[#F1F5F9] pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-base text-[#16A34A] select-none">check_circle</span>
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Approve & Start Account
                </h3>
              </div>
              <button 
                onClick={() => setApprovingAccount(null)}
                className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
              >
                <span className="material-symbols-rounded text-sm select-none">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-[#64748B] leading-relaxed">
                Are you sure you want to approve account <strong>{approvingAccount.accNo}</strong>? Please select the Account Opening Date and Approved Date.
              </p>

              <div className="space-y-3">
                <DatePicker 
                  label="Account Opening Date"
                  value={approvalStartDate}
                  onChange={(val) => setApprovalStartDate(val)}
                  required
                />
                <DatePicker 
                  label="Approved Date"
                  value={approvalDate}
                  onChange={(val) => setApprovalDate(val)}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setApprovingAccount(null)}
                  className="flex-1 h-11 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center flex items-center justify-center"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmApproval}
                  className="flex-1 h-11 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1.5"
                >
                  Confirm & Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
