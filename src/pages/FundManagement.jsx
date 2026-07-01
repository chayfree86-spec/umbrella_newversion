import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { DatePicker } from '../components/ui/DatePicker';
import { Select } from '../components/ui/Select';
import { fundApi } from '../services/api';
import { Pagination } from '../components/ui/Pagination';

const inr = (val) => Number(val || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MonthPicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [year, setYear] = useState(() => value ? parseInt(value.split('-')[0]) : new Date().getFullYear());
  const wrapperRef = useRef(null);

  const months = [
    { name: 'Jan', value: '01' },
    { name: 'Feb', value: '02' },
    { name: 'Mar', value: '03' },
    { name: 'Apr', value: '04' },
    { name: 'May', value: '05' },
    { name: 'Jun', value: '06' },
    { name: 'Jul', value: '07' },
    { name: 'Aug', value: '08' },
    { name: 'Sep', value: '09' },
    { name: 'Oct', value: '10' },
    { name: 'Nov', value: '11' },
    { name: 'Dec', value: '12' }
  ];

  useEffect(() => {
    if (value) {
      setYear(parseInt(value.split('-')[0]));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLabel = () => {
    if (!value) return 'Select Month';
    const parts = value.split('-');
    if (parts.length < 2) return 'Select Month';
    const y = parts[0];
    const m = parts[1];
    const monthName = months[parseInt(m, 10) - 1]?.name;
    return `${monthName} ${y}`;
  };

  const handleMonthSelect = (mVal) => {
    const formatted = `${year}-${mVal}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-w-[150px] px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0F172A] flex items-center justify-between gap-2 transition-all cursor-pointer select-none active:scale-[0.98]"
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-rounded text-slate-400 text-base">calendar_month</span>
          {getLabel()}
        </span>
        <span className="material-symbols-rounded text-slate-400 text-sm">keyboard_arrow_down</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl z-50 p-4 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setYear(y => y - 1)}
              className="p-1 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <span className="material-symbols-rounded text-base">chevron_left</span>
            </button>
            <span className="text-xs font-extrabold text-[#0F172A]">{year}</span>
            <button
              type="button"
              onClick={() => setYear(y => y + 1)}
              className="p-1 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <span className="material-symbols-rounded text-base">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {months.map((m) => {
              const isSelected = value === `${year}-${m.value}`;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleMonthSelect(m.value)}
                  className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1E3A8A] text-white animate-scale-up'
                      : 'bg-slate-50 hover:bg-slate-100 text-[#0F172A]'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-bold text-danger-fin hover:underline cursor-pointer"
            >
              Clear Filter
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setYear(now.getFullYear());
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                onChange(`${now.getFullYear()}-${mm}`);
                setIsOpen(false);
              }}
              className="text-[10px] font-bold text-[#1E3A8A] hover:underline cursor-pointer"
            >
              This Month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FundManagement() {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = () => {
    setLoading(true);
    Promise.all([fundApi.summary(), fundApi.transactions()])
      .then(([sumRes, txRes]) => {
        setSummary(sumRes.data || null);
        setTransactions(txRes.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const location = useLocation();

  // Filter States
  const [searchFilter, setSearchFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter, monthFilter, typeFilter]);

  // Sync with global header search query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchVal = params.get('search') || '';
    setSearchFilter(searchVal);
  }, [location.search]);

  // Filtered Transactions
  const filteredTransactions = transactions.filter(txn => {
    // 1. Search Query filter
    const matchesSearch = !searchFilter || 
      (txn.description || txn.desc || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (txn.reference_no || txn.ref || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (txn.created_by || txn.user || '').toLowerCase().includes(searchFilter.toLowerCase());

    // 2. Month filter (date format: YYYY-MM-DD or DD-MM-YYYY)
    let matchesMonth = true;
    if (monthFilter) {
      const dateStr = txn.transaction_date || txn.date || ''; // '2026-06-29' or '29-06-2026'
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts[0].length === 4) {
          // format is YYYY-MM-DD
          matchesMonth = dateStr.startsWith(monthFilter);
        } else if (parts[2].length === 4) {
          // format is DD-MM-YYYY
          const targetYearMonth = parts[2] + '-' + parts[1]; // '2026-06'
          matchesMonth = targetYearMonth === monthFilter;
        }
      } else {
        matchesMonth = false;
      }
    }

    // 3. Type filter
    let matchesType = true;
    if (typeFilter !== 'all') {
      const typeLower = (txn.transaction_type || txn.type || '').toLowerCase();
      if (typeFilter === 'capital') {
        matchesType = typeLower.includes('capital') || typeLower.includes('funding');
      } else if (typeFilter === 'transfer') {
        matchesType = typeLower.includes('transfer');
      } else if (typeFilter === 'deposit') {
        matchesType = typeLower.includes('deposit');
      }
    }

    return matchesSearch && matchesMonth && matchesType;
  });

  // Modal Forms States
  const [showAddCapitalModal, setShowAddCapitalModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditCapitalModal, setShowEditCapitalModal] = useState(false);

  // Capital Form
  const [investorName, setInvestorName] = useState('');
  const [capitalAmount, setCapitalAmount] = useState('');
  const [capitalDate, setCapitalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [capitalSource, setCapitalSource] = useState('Self');
  const [capitalNote, setCapitalNote] = useState('');

  // Transfer Form
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferNote, setTransferNote] = useState('');
  const [transferType, setTransferType] = useState('saving_to_loan');

  // Edit Transaction Form
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');

  const handleAddCapitalSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(capitalAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const apiCall = capitalSource === 'Self'
      ? fundApi.addCapital(amt, capitalNote || 'Owner Equity Injection')
      : fundApi.addInvestor(investorName, amt, capitalNote || `Investor: ${investorName}`);

    apiCall
      .then(() => {
        fetchData();
        setShowAddCapitalModal(false);
        setInvestorName('');
        setCapitalAmount('');
        setCapitalNote('');
        alert('Capital added successfully!');
      })
      .catch(err => alert(err.message || 'Failed to add capital.'));
  };

  const handleTransferSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid transfer amount.');
      return;
    }

    const defaultNote = transferType === 'saving_to_loan'
      ? 'Savings to Loan Fund Transfer'
      : 'Loan to Savings Fund Transfer';

    fundApi.executeTransfer(transferType, amt, transferNote || defaultNote, transferDate)
      .then(() => {
        fetchData();
        setShowTransferModal(false);
        setTransferAmount('');
        setTransferNote('');
        alert('Transfer executed successfully!');
      })
      .catch(err => alert(err.message || 'Transfer failed.'));
  };

  const handleEditClick = (txn) => {
    setSelectedTxn(txn);
    setEditAmount(String(txn.amount));
    setEditNote(txn.desc || txn.description || '');
    setEditDate(txn.entry_date || txn.date || new Date().toISOString().slice(0, 10));
    setShowEditCapitalModal(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    fundApi.updateTransaction(selectedTxn.id, amt, editNote, editDate)
      .then(() => {
        fetchData();
        setShowEditCapitalModal(false);
        setSelectedTxn(null);
        setEditAmount('');
        setEditNote('');
        setEditDate('');
        alert('Transaction updated successfully!');
      })
      .catch(err => alert(err.message || 'Failed to update transaction.'));
  };

  const handleDeleteClick = (id) => {
    if (window.confirm('Are you sure you want to delete this transaction? This will also revert its impact from the cash book and capital pool.')) {
      fundApi.deleteTransaction(id)
        .then(() => {
          fetchData();
          alert('Transaction deleted successfully!');
        })
        .catch(err => alert(err.message || 'Failed to delete transaction.'));
    }
  };

  // Derive values from API summary
  const totalCapital = Number(summary?.total_capital || 0);
  const totalSavings = Number(summary?.total_savings || 0);
  const availableSavingsCash = Number(summary?.available_savings_cash || 0);
  const netSavingsTransferred = Number(summary?.net_savings_transferred || 0);
  const loanPool = Number(summary?.loan_pool || 0);
  const totalDisbursed = Number(summary?.total_disbursed || 0);
  const interestReceived = Number(summary?.total_interest || 0);
  const overallCashBalance = Number(summary?.cash_balance || 0);
  const availableLoanFund = Number(summary?.available_loan_fund || 0);


  // Reading this as: Redesign of Capital & Fund Management page to align with the .agents guidelines, leaning toward Soft Structuralism + Asymmetric Bento + Double-Bezel nested cards.
  return (
    <div className="w-full space-y-8 py-2">
      {/* Header with Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Month/Year Filter (Custom MonthPicker) */}
          <MonthPicker
            value={monthFilter}
            onChange={setMonthFilter}
          />

          {/* Type Filter */}
          <Select
            options={[
              { value: 'all', label: 'All Transaction Types' },
              { value: 'capital', label: 'Capital Additions' },
              { value: 'transfer', label: 'Fund Transfers' },
              { value: 'deposit', label: 'Savings Deposits' }
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            compact={true}
            searchable={false}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <span className="material-symbols-rounded text-sm select-none">swap_horiz</span>
            Internal Fund Transfer
          </button>
          <button
            onClick={() => setShowAddCapitalModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1E3A8A]/90 transition-all cursor-pointer"
          >
            <span className="material-symbols-rounded text-sm select-none">add</span>
            Add Capital / Investment
          </button>
        </div>
      </div>

      {/* Funds Summary Matrix Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Capital */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Capital</span>
            <span className="material-symbols-rounded text-base text-[#1E3A8A] select-none">account_balance</span>
          </div>
          <h3 className="text-lg font-extrabold text-[#0F172A]">{inr(totalCapital)}</h3>
          <p className="text-[9px] text-[#64748B]">Owner & Investors Equity</p>
        </div>

        {/* Card 2: Savings Balance */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Savings Balance</span>
            <span className="material-symbols-rounded text-base text-[#D97706] select-none">savings</span>
          </div>
          <h3 className="text-lg font-extrabold text-[#D97706]">{inr(totalSavings)}</h3>
          <p className="text-[9px] text-[#64748B] leading-snug">
            Available Cash: <span className="font-bold text-slate-800">{inr(availableSavingsCash)}</span>
            {netSavingsTransferred > 0 && (
              <span className="block text-[8px] text-[#EA580C] font-semibold mt-0.5">
                (Transferred {inr(netSavingsTransferred)} to Loan)
              </span>
            )}
          </p>
        </div>

        {/* Card 3: Loans Disbursed */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Active Loans</span>
            <span className="material-symbols-rounded text-base text-[#EA580C] select-none">credit_score</span>
          </div>
          <h3 className="text-lg font-extrabold text-[#EA580C]">{inr(totalDisbursed)}</h3>
          <p className="text-[9px] text-[#64748B]">Out on field</p>
        </div>

        {/* Card 4: Available Loan Fund */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Available Loan Fund</span>
            <span className="material-symbols-rounded text-base text-[#16A34A] select-none">payments</span>
          </div>
          <h3 className="text-lg font-extrabold text-[#16A34A]">{inr(availableLoanFund)}</h3>
          <p className="text-[9px] text-[#64748B] leading-snug">
            {netSavingsTransferred > 0 ? (
              <>
                Ready for loans
                <span className="block text-[8px] text-[#16A34A] font-semibold mt-0.5">
                  (Includes {inr(netSavingsTransferred)} from Savings)
                </span>
              </>
            ) : (
              'Ready for new disbursements'
            )}
          </p>
        </div>

        {/* Card 5: Overall Cash Balance */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-2 col-span-2 lg:col-span-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Overall Cash</span>
            <span className="material-symbols-rounded text-base text-[#1E3A8A] select-none">wallet</span>
          </div>
          <h3 className="text-lg font-extrabold text-[#1E3A8A]">{inr(overallCashBalance)}</h3>
          <p className="text-[9px] text-[#64748B]">Total actual cash in hand</p>
        </div>
      </div>

      {/* Transaction History Log */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden space-y-4 p-6">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A]">Fund Transaction Logs</h3>
          <p className="text-xs text-[#64748B]">Audit log of capital additions, internal transfers, and allocations</p>
        </div>

        <div className="overflow-x-auto -mx-6">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-[#E2E8F0]">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Transaction Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Description</th>
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Reference No</th>
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Processed By</th>
                  <th scope="col" className="px-6 py-3 text-right text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] bg-white">
                {(() => {
                  const sorted = [...filteredTransactions].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
                  const paginated = sorted.slice((currentPage - 1) * 20, currentPage * 20);

                  if (paginated.length === 0) {
                    return (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-xs text-[#64748B]">
                          {loading ? 'Loading transactions...' : 'No matching transactions found.'}
                        </td>
                      </tr>
                    );
                  }

                  return paginated.map((txn) => (
                    <tr key={txn.id} className="hover:bg-[#F8FAFC]/50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs font-medium text-[#64748B]">{txn.transaction_date || txn.date}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs font-bold text-[#0F172A]">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                            (txn.transaction_type || txn.type || '').includes('Capital') || (txn.transaction_type || txn.type || '').includes('Funding') ? 'bg-[#1E3A8A]/10 text-[#1E3A8A]' :
                            (txn.transaction_type || txn.type || '').includes('Transfer') ? 'bg-[#FFC107]/10 text-[#D97706]' :
                            (txn.transaction_type || txn.type || '').includes('Deposit') ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#64748B]/10 text-[#64748B]'
                          }`}>
                          {txn.transaction_type || txn.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs font-semibold text-[#0F172A]">{txn.description || txn.desc}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs font-semibold text-[#64748B]">{txn.reference_no || txn.ref}</td>
                      <td className={`whitespace-nowrap px-6 py-3.5 text-xs font-bold ${
                        (txn.transaction_type || txn.type || '').includes('Capital') || (txn.transaction_type || txn.type || '').includes('Funding') || (txn.transaction_type || txn.type || '').includes('Deposit')
                          ? 'text-success-fin'
                          : 'text-danger-fin'
                      }`}>
                        {inr(txn.amount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs font-medium text-[#64748B]">{txn.created_by || txn.user}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-right text-xs font-medium flex justify-end gap-1.5">
                        <button
                          onClick={() => handleEditClick(txn)}
                          className="p-1 rounded text-primary hover:bg-primary/10 cursor-pointer transition-all active:scale-[0.95]"
                          title="Edit Transaction"
                        >
                          <span className="material-symbols-rounded text-sm select-none">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(txn.id)}
                          className="p-1 rounded text-danger-fin hover:bg-danger-fin/10 cursor-pointer transition-all active:scale-[0.95]"
                          title="Delete Transaction"
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
        </div>
        <Pagination 
          currentPage={currentPage}
          totalPages={Math.ceil(filteredTransactions.length / 20)}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Capital Modal Form */}
      {showAddCapitalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-6 rounded-[2rem] border border-border-fin max-w-md w-full max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl space-y-5 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-border-fin">
              <h4 className="text-base font-extrabold text-primary-text">Add Capital / Investment</h4>
              <button
                onClick={() => setShowAddCapitalModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-secondary-text hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-rounded text-sm select-none">close</span>
              </button>
            </div>

            <form onSubmit={handleAddCapitalSubmit} className="space-y-4">
              <Select
                label="Funding Source *"
                options={[
                  { value: 'Self', label: 'Self Equity (Owner Investment)' },
                  { value: 'Investor', label: 'External Investor Funding' }
                ]}
                value={capitalSource}
                onChange={(val) => setCapitalSource(val)}
              />

              {capitalSource === 'Investor' && (
                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Investor Name <span className="text-danger-fin">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Ramesh Singhania"
                    value={investorName}
                    onChange={(e) => setInvestorName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Investment Amount (₹) <span className="text-danger-fin">*</span></label>
                <input
                  type="number"
                  required
                  placeholder="E.g., 50000"
                  value={capitalAmount}
                  onChange={(e) => setCapitalAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-bold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>

              <DatePicker
                label="Investment Date"
                value={capitalDate}
                onChange={(val) => setCapitalDate(val)}
              />

              <div>
                <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Particulars / Note</label>
                <textarea
                  placeholder="Add optional notes..."
                  value={capitalNote}
                  onChange={(e) => setCapitalNote(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-fin">
                <button
                  type="button"
                  onClick={() => setShowAddCapitalModal(false)}
                  className="px-4 py-2 border border-border-fin text-secondary-text hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1E3A8A]/90 transition-all cursor-pointer"
                >
                  Inject Capital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Savings to Loan Modal Form */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-6 rounded-[2rem] border border-border-fin max-w-md w-full max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl space-y-5 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-border-fin">
              <h4 className="text-base font-extrabold text-primary-text">Internal Fund Transfer</h4>
              <button
                onClick={() => setShowTransferModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-secondary-text hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-rounded text-sm select-none">close</span>
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <Select
                label="Transfer Direction *"
                options={[
                  { value: 'saving_to_loan', label: 'Savings to Loan Fund (Increase Lending Pool)' },
                  { value: 'loan_to_saving', label: 'Loan to Savings Fund (Reduce Lending Pool)' }
                ]}
                value={transferType}
                onChange={(val) => setTransferType(val)}
              />

              {transferType === 'saving_to_loan' ? (
                <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 space-y-0.5">
                   <span className="text-[10px] text-secondary-text block font-bold uppercase tracking-wider">Available Savings Cash</span>
                   <span className="text-lg font-extrabold text-amber-600">{inr(totalSavings)}</span>
                </div>
               ) : (
                <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 space-y-0.5">
                   <span className="text-[10px] text-secondary-text block font-bold uppercase tracking-wider">Available Loan Fund</span>
                   <span className="text-lg font-extrabold text-emerald-600">{inr(availableLoanFund)}</span>
                </div>
               )}

              <div>
                <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Amount to Transfer (₹) <span className="text-danger-fin">*</span></label>
                <input
                  type="number"
                  required
                  placeholder="E.g., 10000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-bold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>

              <DatePicker
                label="Transfer Date"
                value={transferDate}
                onChange={(val) => setTransferDate(val)}
              />

              <div>
                <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Transfer Note / Purpose</label>
                <textarea
                  placeholder="E.g., Moving surplus to active pool"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-fin">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 border border-border-fin text-secondary-text hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1E3A8A]/90 transition-all cursor-pointer"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal Form */}
      {showEditCapitalModal && selectedTxn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-6 rounded-[2rem] border border-border-fin max-w-md w-full max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl space-y-5 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-border-fin">
              <h4 className="text-base font-extrabold text-primary-text">Edit Fund Transaction</h4>
              <button
                onClick={() => {
                  setShowEditCapitalModal(false);
                  setSelectedTxn(null);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-secondary-text hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-rounded text-sm select-none">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="p-3.5 bg-slate-100 rounded-2xl border border-border-fin space-y-0.5">
                <span className="text-[10px] text-secondary-text block font-bold uppercase tracking-wider">Transaction Type</span>
                <span className="text-xs font-bold text-primary-text">{selectedTxn.type || selectedTxn.transaction_type}</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Amount (₹) <span className="text-danger-fin">*</span></label>
                <input
                  type="number"
                  required
                  placeholder="E.g., 50000"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-bold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>

              <DatePicker
                label="Transaction Date *"
                value={editDate}
                onChange={(val) => setEditDate(val)}
              />

              <div>
                <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Description / Note <span className="text-danger-fin">*</span></label>
                <textarea
                  required
                  placeholder="Enter details..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-fin">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditCapitalModal(false);
                    setSelectedTxn(null);
                  }}
                  className="px-4 py-2 border border-border-fin text-secondary-text hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1E3A8A]/90 transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
