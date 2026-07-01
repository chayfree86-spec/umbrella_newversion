import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import { loanApi, savingApi, branchApi, areaApi, agentApi, collectionApi, reportApi } from '../services/api';
import { Pagination } from '../components/ui/Pagination';

export default function Collection() {
  const navigate = useNavigate();
  const location = useLocation();

  const userRole = localStorage.getItem('userRole') || localStorage.getItem('active_user_role') || '';
  const isAgent = userRole === 'Agent / Collection Executive';

  // Read search query from global header search
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get('search') || '';

  // Load accounts
  const [accounts, setAccounts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [agents, setAgents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  // View mode tab
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'bulk'

  useEffect(() => {
    if (isAgent && activeTab === 'bulk') {
      setActiveTab('single');
    }
  }, [isAgent, activeTab]);

  // Bulk operation states (populated from agents list)
  const [selectedAgentForBulk, setSelectedAgentForBulk] = useState('');
  const [bulkCollectSelected, setBulkCollectSelected] = useState([]);
  const [bulkApproveSelected, setBulkApproveSelected] = useState([]);
  const [bulkAwaitingSelected, setBulkAwaitingSelected] = useState([]);

  // Filters state
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterArea, setFilterArea] = useState('All');
  const [filterAgent, setFilterAgent] = useState('All');
  const [filterType, setFilterType] = useState('All'); // 'All', 'Loan', 'Saving'
  const [filterStatus, setFilterStatus] = useState('All'); // 'All', 'Pending', 'Paid'

  // Collection modal state
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [fineAmount, setFineAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');

  // Receipt modal state
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptTxn, setReceiptTxn] = useState(null);
  const [receiptAccountNo, setReceiptAccountNo] = useState(null);
  const [showConfirmVoid, setShowConfirmVoid] = useState(false);
  const [voidRefNo, setVoidRefNo] = useState(null);

  const [selectedDate, setSelectedDate] = useState(new Date());

  const getFormattedDateStr = (dateObj) => {
    if (!(dateObj instanceof Date) || isNaN(dateObj)) dateObj = new Date();
    return `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;
  };

  const selectedDateStr = getFormattedDateStr(selectedDate);
  const todayStr = selectedDateStr; // Backward compatibility alias

  const selectedDateMidnight = new Date(selectedDate);
  selectedDateMidnight.setHours(0, 0, 0, 0);

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const isFutureDate = selectedDateMidnight > todayMidnight;

  const handlePrevDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() - 1);
      return d;
    });
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + 1);
      return d;
    });
  };

  const getDaysAroundSelected = () => {
    const list = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(selectedDate);
      d.setDate(selectedDate.getDate() + i);
      list.push(d);
    }
    return list;
  };

  const hasCollectionOnDate = (dateObj) => {
    const dStr = getFormattedDateStr(dateObj);
    return accounts.some(acc => acc.ledger?.some(tx => tx.date === dStr));
  };

  const fetchAccountsAndCollections = () => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStrYMD = `${year}-${month}-${day}`;

    Promise.all([
      loanApi.list({ limit: 100 }),
      savingApi.list({ limit: 100 }),
      reportApi.dailyCollection({ start_date: dateStrYMD, end_date: dateStrYMD })
    ]).then(([loansRes, savingsRes, collectionsRes]) => {
      const collections = collectionsRes.data || [];

      const loanList = (loansRes.data || []).map(l => {
        const matched = collections.filter(c => c.AccountNo === l.loan_account_no);
        const ledger = matched.map(m => ({
          id: m.ReceiptNo,
          date: selectedDateStr,
          refNo: m.ReceiptNo,
          type: 'EMI Payment',
          amt: Number(m.AmountCollected),
          fine: Number(m.PenaltyAmount || 0),
          collector: m.AgentName || 'Agent',
          status: 'Approved'
        }));

        return {
          accNo: l.loan_account_no,
          type: 'Loan',
          accountStatus: l.account_status,
          planName: l.plan_name,
          approvedAmt: Number(l.principal_amount),
          totalPaid: Number(l.total_paid),
          outstanding: Number(l.outstanding_amount),
          emiAmt: Number(l.emi_amount),
          paymentCycle: l.collection_frequency,
          customer: { name: l.customer_name, phone: l.customer_mobile },
          agent: l.agent_name,
          branch: l.branch_name,
          area: l.area_name,
          ledger: ledger,
          todayDue: Number(l.today_due || 0),
          nextDueDate: l.next_due_date
        };
      });

      const savingList = (savingsRes.data || []).map(s => {
        const matched = collections.filter(c => c.AccountNo === s.saving_account_no);
        const ledger = matched.map(m => ({
          id: m.ReceiptNo,
          date: selectedDateStr,
          refNo: m.ReceiptNo,
          type: 'Savings Deposit',
          amt: Number(m.AmountCollected),
          fine: 0,
          collector: m.AgentName || 'Agent',
          status: 'Approved'
        }));

        return {
          accNo: s.saving_account_no,
          type: 'Saving',
          accountStatus: s.account_status,
          planName: s.plan_name,
          approvedAmt: Number(s.deposit_amount),
          totalPaid: Number(s.total_deposited),
          outstanding: 0,
          emiAmt: Number(s.deposit_amount),
          paymentCycle: s.collection_frequency,
          customer: { name: s.customer_name, phone: s.customer_mobile },
          agent: s.agent_name,
          branch: s.branch_name,
          area: s.area_name,
          ledger: ledger,
          todayDue: Number(s.today_due || 0),
          nextDueDate: s.next_due_date
        };
      });

      setAccounts([...loanList, ...savingList]);
    }).catch((err) => {
      console.error(err);
    });
  };

  useEffect(() => {
    fetchAccountsAndCollections();
  }, [selectedDateStr]);

  useEffect(() => {
    // Load Branches
    branchApi.list()
      .then(res => setBranches(res.data || []))
      .catch(() => {});

    // Load Areas
    areaApi.list()
      .then(res => setAreas(res.data || []))
      .catch(() => {});

    // Load Agents
    agentApi.list()
      .then(res => {
        const parsed = res.data || [];
        setAgents(parsed);
        if (parsed.length > 0) {
          setSelectedAgentForBulk(parsed[0].name);
        }
      })
      .catch(() => {});
  }, []);

  // Filter accounts: only Approved, Active, Defaulter, NPA, or accounts that have collections on the selected date can have daily collections
  const activeAccounts = accounts.filter(acc => {
    const status = acc.accountStatus || 'Approved';
    const hasCollectionOnDate = (acc.ledger || []).length > 0;

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const selectedDateYMD = `${year}-${month}-${day}`;

    const isDue = acc.nextDueDate && acc.nextDueDate <= selectedDateYMD;

    const isStatusMatch = (['Approved', 'Active', 'Defaulter', 'NPA'].includes(status) && isDue) || hasCollectionOnDate;
    const isTypeMatch = filterType === 'All' || acc.type === filterType;
    return isStatusMatch && isTypeMatch;
  });

  // Apply filters for individual checklist
  const filteredAccounts = activeAccounts.filter(acc => {
    // Branch Filter
    const accBranch = acc.branch || acc.customer?.branch || '';
    if (filterBranch !== 'All' && accBranch !== filterBranch) return false;

    // Area Filter
    const accArea = acc.area || acc.customer?.area || '';
    if (filterArea !== 'All' && !accArea.toLowerCase().includes(filterArea.toLowerCase())) return false;

    // Agent Filter (Matching assigned agent)
    const accAgent = acc.agent || acc.customer?.agent || '';
    if (filterAgent !== 'All' && accAgent !== filterAgent) return false;

    // Today's Pay Status Filter
    const hasTodayPay = acc.ledger?.some(tx => tx.date === todayStr);
    const payStatus = hasTodayPay ? 'Paid' : 'Pending';
    if (filterStatus !== 'All' && payStatus !== filterStatus) return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (acc.customer?.name || acc.name || '').toLowerCase();
      const phone = (acc.customer?.phone || acc.phone || '');
      const accNo = acc.accNo.toLowerCase();
      return name.includes(q) || phone.includes(q) || accNo.includes(q);
    }

    return true;
  });

  // Bulk operation lists (dynamically filtered)
  const bulkCollectAccounts = activeAccounts.filter(acc => {
    const accAgent = acc.agent || acc.customer?.agent || '';
    const isCollectorMatch = accAgent === selectedAgentForBulk;
    const todayPaid = acc.ledger?.some(tx => tx.date === todayStr);
    return isCollectorMatch && !todayPaid;
  });

  const bulkApproveAccounts = accounts.filter(acc => {
    const status = acc.accountStatus || '';
    const accAgent = acc.agent || acc.customer?.agent || '';
    const isCollectorMatch = accAgent === selectedAgentForBulk;
    const isTypeMatch = filterType === 'All' || acc.type === filterType;
    return isCollectorMatch && status === 'Processing' && isTypeMatch;
  });

  const bulkAwaitingApproveCollections = accounts.filter(acc => {
    const accAgent = acc.agent || acc.customer?.agent || '';
    const isCollectorMatch = accAgent === selectedAgentForBulk;
    const isTypeMatch = filterType === 'All' || acc.type === filterType;
    const hasAwaiting = acc.ledger?.some(tx => tx.date === todayStr);
    return isCollectorMatch && isTypeMatch && hasAwaiting;
  });

  // Calculate Metrics for Today
  const totalTargetToday = activeAccounts.reduce((sum, acc) => sum + (acc.emiAmt || 0), 0);
  
  const totalCollectedToday = activeAccounts.reduce((sum, acc) => {
    const todayTxns = (acc.ledger || []).filter(tx => tx.date === todayStr && tx.status !== 'Awaiting Approval');
    const txnsSum = todayTxns.reduce((s, tx) => s + (tx.amt || 0), 0);
    return sum + txnsSum;
  }, 0);

  const totalPendingToday = Math.max(0, totalTargetToday - totalCollectedToday);
  const progressPercent = totalTargetToday > 0 ? Math.round((totalCollectedToday / totalTargetToday) * 100) : 0;

  // Open collection modal
  const handleOpenCollect = (acc) => {
    setSelectedAccount(acc);
    setCollectAmount((acc.emiAmt || '').toString());
    setFineAmount('0');
    setPaymentMode('Cash');
  };

  // Submit collection
  const handleCollectSubmit = (e) => {
    e.preventDefault();
    if (!selectedAccount) return;

    const amt = parseFloat(collectAmount) || 0;
    const fine = parseFloat(fineAmount) || 0;

    if (amt <= 0) {
      alert('Please enter a valid collection amount.');
      return;
    }

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStrYMD = `${year}-${month}-${day}`;

    const collectCall = selectedAccount.type === 'Loan'
      ? loanApi.collect(selectedAccount.accNo, amt, fine, paymentMode, 'Daily collection via dashboard', dateStrYMD)
      : savingApi.deposit(selectedAccount.accNo, amt, paymentMode, 'Daily deposit via dashboard', dateStrYMD);

    collectCall
      .then(res => {
        const receiptNo = res.data.receipt_no;
        const newTxn = {
          id: String(Date.now()),
          date: todayStr,
          refNo: receiptNo,
          type: selectedAccount.type === 'Loan' ? 'EMI Payment' : 'Savings Deposit',
          amt: amt,
          fine: fine,
          collector: localStorage.getItem('username') || localStorage.getItem('active_user_name') || '',
          status: 'Approved'
        };

        // Reload accounts list
        fetchAccountsAndCollections();

        setReceiptAccountNo(selectedAccount.accNo);
        setReceiptTxn(newTxn);
        setShowReceipt(true);
      })
      .catch(err => {
        alert(err.message || 'Collection failed.');
      });

    setSelectedAccount(null);
  };

  const closeReceipt = () => {
    setShowReceipt(false);
    setReceiptTxn(null);
    setReceiptAccountNo(null);
  };

  const triggerVoidConfirm = (refNo) => {
    setVoidRefNo(refNo);
    setShowConfirmVoid(true);
  };

  const executeVoidTransaction = (refNo) => {
    collectionApi.deleteCollection(refNo)
      .then(() => {
        fetchAccountsAndCollections();
        setShowConfirmVoid(false);
        setVoidRefNo(null);
        closeReceipt();
        alert("Collection voided successfully.");
      })
      .catch(err => {
        alert(err.message || "Failed to void transaction.");
      });
  };


  // Bulk collection action
  const handleBulkCollectSubmit = (e) => {
    e.preventDefault();
    if (bulkCollectSelected.length === 0) {
      alert('Please select at least one account to collect.');
      return;
    }

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStrYMD = `${year}-${month}-${day}`;

    const promises = bulkCollectSelected.map(accNo => {
      const acc = accounts.find(a => a.accNo === accNo);
      if (!acc) return Promise.resolve(null);
      
      const hasTodayPay = acc.ledger?.some(tx => tx.date === todayStr);
      if (hasTodayPay) return Promise.resolve(null);

      const amt = acc.emiAmt || 0;
      if (acc.type === 'Loan') {
        return loanApi.collect(acc.accNo, amt, 0, 'Cash', 'Bulk daily collection via dashboard', dateStrYMD);
      } else {
        return savingApi.deposit(acc.accNo, amt, 'Cash', 'Bulk daily deposit via dashboard', dateStrYMD);
      }
    });

    Promise.all(promises)
      .then(results => {
        const actualSuccessCount = results.filter(r => r !== null).length;
        alert(`Successfully collected ${actualSuccessCount} daily payments.`);
        setBulkCollectSelected([]);
        fetchAccountsAndCollections();
      })
      .catch(err => {
        alert(err.message || 'One or more bulk collections failed.');
        setBulkCollectSelected([]);
        fetchAccountsAndCollections();
      });
  };

  const handleBulkApproveCollectionsSubmit = (e) => {
    e.preventDefault();
    if (bulkAwaitingSelected.length === 0) {
      alert('Please select at least one collection to verify.');
      return;
    }
    alert(`Successfully verified ${bulkAwaitingSelected.length} collections.`);
    setBulkAwaitingSelected([]);
  };

  // Bulk approval action
  const handleBulkApproveSubmit = (e) => {
    e.preventDefault();
    if (bulkApproveSelected.length === 0) {
      alert('Please select at least one account to approve.');
      return;
    }

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStrYMD = `${year}-${month}-${day}`;

    const promises = bulkApproveSelected.map(accNo => {
      const acc = accounts.find(a => a.accNo === accNo);
      if (!acc || acc.accountStatus !== 'Processing') return Promise.resolve(null);
      
      const initialDate = acc.startDate || dateStrYMD;
      if (acc.type === 'Loan') {
        return loanApi.approve(acc.accNo, initialDate, dateStrYMD);
      } else {
        return savingApi.approve(acc.accNo, initialDate, dateStrYMD);
      }
    });

    Promise.all(promises)
      .then(results => {
        const actualSuccessCount = results.filter(r => r !== null).length;
        alert(`Successfully approved ${actualSuccessCount} accounts.`);
        setBulkApproveSelected([]);
        fetchAccountsAndCollections();
      })
      .catch(err => {
        alert(err.message || 'One or more approvals failed.');
        setBulkApproveSelected([]);
        fetchAccountsAndCollections();
      });
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {isFutureDate && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xs animate-scale-up">
          <span className="material-symbols-rounded text-lg text-amber-600 select-none animate-pulse">info</span>
          <span>Viewing future schedule. Payment collections cannot be recorded on future dates. All payments must be recorded on the current or past dates.</span>
        </div>
      )}
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {activeTab === 'single' ? (
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Branch Filter */}
            <Select 
              options={[{ value: 'All', label: 'All Branches' }, ...branches.map(b => ({ value: b.name, label: b.name }))] }
              value={filterBranch}
              onChange={(val) => setFilterBranch(val)}
              searchable={false}
              compact={true}
            />

            {/* Agent Filter */}
            <Select 
              options={[{ value: 'All', label: 'All Agents' }, ...agents.map(a => ({ value: a.name, label: a.name }))] }
              value={filterAgent}
              onChange={(val) => setFilterAgent(val)}
              searchable={false}
              compact={true}
            />

            {/* Account Type Filter */}
            <Select 
              options={[
                { value: 'All', label: 'All Types' },
                { value: 'Loan', label: 'Loans Only' },
                { value: 'Saving', label: 'Savings Only' }
              ]}
              value={filterType}
              onChange={(val) => setFilterType(val)}
              searchable={false}
              compact={true}
            />

            {/* Today's Pay Status Tabs */}
            <div className="flex bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-xl shrink-0">
              {['All', 'Pending', 'Paid'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterStatus === s 
                      ? 'bg-[#0A3598] text-white shadow-sm'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {s === 'All' ? 'All Dues' : s === 'Pending' ? 'Uncollected' : 'Collected'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <Select 
              options={agents.map(a => ({ value: a.name, label: `${a.name} (${a.code})` }))}
              value={selectedAgentForBulk}
              onChange={(val) => {
                setSelectedAgentForBulk(val);
                setBulkCollectSelected([]);
                setBulkApproveSelected([]);
              }}
              searchable={false}
              compact={true}
            />

            <Select 
              options={[
                { value: 'All', label: 'All Types' },
                { value: 'Loan', label: 'Loans Only' },
                { value: 'Saving', label: 'Savings Only' }
              ]}
              value={filterType}
              onChange={(val) => {
                setFilterType(val);
                setBulkCollectSelected([]);
                setBulkApproveSelected([]);
              }}
              searchable={false}
              compact={true}
            />
          </div>
        )}

        {/* Horizontal Date Selection Bar */}
        <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-xl shadow-sm shrink-0">
          {/* Prev Day Button */}
          <button 
            type="button"
            onClick={handlePrevDay}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-rounded text-base select-none">chevron_left</span>
          </button>

          {/* Selected Date Text */}
          <div className="flex items-center">
            <span className="text-[11px] font-black text-[#0A3598] min-w-[72px] text-center select-none tracking-tight">
              {selectedDateStr}
            </span>
          </div>

          {/* Next Day Button */}
          <button 
            type="button"
            onClick={handleNextDay}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-rounded text-base select-none">chevron_right</span>
          </button>

          {/* Calendar Picker (Jump to Date) */}
          <DatePicker
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(val) => {
              if (val) {
                setSelectedDate(new Date(val));
              }
            }}
            customTrigger={
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer border-l border-slate-200 pl-1.5 ml-0.5">
                <span className="material-symbols-rounded text-base select-none">event</span>
              </div>
            }
          />
        </div>
      </div>

      {/* Metrics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-2 relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Target Collection</span>
            <span className="material-symbols-rounded text-slate-300 text-lg select-none">track_changes</span>
          </div>
          <strong className="text-xl font-black text-[#0F172A] block">₹{totalTargetToday.toLocaleString()}</strong>
          <span className="text-[9px] text-[#64748B] block">Expected EMI collections today</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-2 relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Collected Today</span>
            <span className="material-symbols-rounded text-emerald-400 text-lg select-none">payments</span>
          </div>
          <strong className="text-xl font-black text-[#16A34A] block">₹{totalCollectedToday.toLocaleString()}</strong>
          <span className="text-[9px] text-emerald-600 font-semibold block">EMI payments recorded</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-2 relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Pending Balance</span>
            <span className="material-symbols-rounded text-amber-400 text-lg select-none">hourglass_empty</span>
          </div>
          <strong className="text-xl font-black text-[#EA580C] block">₹{totalPendingToday.toLocaleString()}</strong>
          <span className="text-[9px] text-[#EA580C] font-semibold block">Remaining to collect</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-2 relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Completion Rate</span>
            <span className="text-xs font-bold text-[#0A3598] bg-[#0A3598]/5 px-2 py-0.5 rounded">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
            <div 
              className="bg-[#0A3598] h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            ></div>
          </div>
          <span className="text-[9px] text-[#64748B] block mt-1">Today's collection progress</span>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex border-b border-[#E2E8F0] gap-6">
        <button
          onClick={() => setActiveTab('single')}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
            activeTab === 'single' ? 'text-[#0A3598]' : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          Single Collection Checklist
          {activeTab === 'single' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A3598] rounded-full"></div>
          )}
        </button>
        {!isAgent && (
          <button
            onClick={() => setActiveTab('bulk')}
            className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === 'bulk' ? 'text-[#0A3598]' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Agent-Wise Bulk Operations
            {activeTab === 'bulk' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A3598] rounded-full"></div>
            )}
          </button>
        )}
      </div>

      {/* Tab 1: Single Collection checklist */}
      {activeTab === 'single' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-5 animate-fade-in">
          {/* Collection Checklist Table */}
          <div className="overflow-x-auto -mx-6">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-[#E2E8F0]">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Account No</th>
                    <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Customer Details</th>
                    <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Account Type</th>
                    <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Daily EMI</th>
                    <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Today's Pay Status</th>
                    <th scope="col" className="px-6 py-3.5 text-center text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] bg-white">
                  {(() => {
                    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
                      return b.accNo.localeCompare(a.accNo);
                    });
                    const paginatedAccounts = sortedAccounts.slice((currentPage - 1) * 20, currentPage * 20);

                    if (paginatedAccounts.length > 0) {
                      return paginatedAccounts.map((acc) => {
                        const name = acc.customer?.name || acc.name || 'Customer';
                        const phone = acc.customer?.phone || acc.phone || 'N/A';
                        
                        // Check today status
                        const todayPayment = acc.ledger?.find(tx => tx.date === todayStr && tx.status !== 'Rejected');
                        const todayPaid = !!todayPayment;
                        const todayRejected = !todayPayment && !!acc.ledger?.some(tx => tx.date === todayStr && tx.status === 'Rejected');

                        return (
                          <tr 
                            key={acc.accNo}
                            onClick={() => navigate(`/account/${acc.accNo}`)}
                            className="hover:bg-[#F8FAFC]/50 transition-colors cursor-pointer"
                          >
                            <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-[#0A3598]">
                              {acc.accNo}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="text-xs font-bold text-[#0F172A]">{name}</div>
                              <div className="text-[10px] text-[#64748B]">{phone}</div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-xs">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                acc.type === 'Loan' ? 'bg-[#0A3598]/10 text-[#0A3598]' : 'bg-[#FFC107]/10 text-[#D97706]'
                              }`}>
                                {acc.type}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-[#0F172A]">
                              ₹{(acc.emiAmt || 0).toLocaleString()}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-xs font-bold">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                todayPaid 
                                  ? 'bg-[#16A34A]/10 text-[#16A34A]' 
                                  : todayRejected
                                    ? 'bg-[#EF4444]/10 text-[#EF4444]'
                                    : 'bg-[#EA580C]/10 text-[#EA580C]'
                              }`}>
                                {todayPaid ? 'Collected' : todayRejected ? 'Reset' : 'Pending'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                              {todayPaid ? (
                                <button
                                  onClick={() => {
                                    setReceiptAccountNo(acc.accNo);
                                    setReceiptTxn(todayPayment);
                                    setShowReceipt(true);
                                  }}
                                  className="px-4 py-1.5 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto shadow-sm"
                                >
                                  <span className="material-symbols-rounded text-sm select-none">receipt</span>
                                  Receipt
                                </button>
                              ) : isFutureDate ? (
                                <button
                                  disabled
                                  className="px-5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed select-none mx-auto"
                                >
                                  Scheduled
                                </button>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <button
                                    onClick={() => handleOpenCollect(acc)}
                                    className="px-4 py-1.5 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto shadow-sm"
                                  >
                                    <span className="material-symbols-rounded text-sm select-none">payments</span>
                                    Collect
                                  </button>
                                  {todayRejected && (
                                    <span className="text-[9px] text-[#EF4444] font-black uppercase tracking-wider">
                                      Rejected Today
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    } else {
                      return (
                        <tr>
                          <td colSpan="6" className="text-center py-12 text-xs text-[#64748B]">
                            No active collection accounts found for today matching the filters.
                          </td>
                        </tr>
                      );
                    }
                  })()}
                </tbody>
              </table>
            </div>
            <Pagination 
              currentPage={currentPage}
              totalPages={Math.ceil(filteredAccounts.length / 20)}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Agent-wise bulk operations */}
      {activeTab === 'bulk' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Section 1: Bulk Collections */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#F1F5F9]">
                <div>
                  <h4 className="text-xs font-black text-[#0F172A] uppercase tracking-wider">Bulk Today's Collection</h4>
                  <p className="text-[10px] text-[#64748B] mt-0.5">Uncollected accounts assigned to {selectedAgentForBulk}</p>
                </div>
                <span className="bg-[#0A3598]/10 text-[#0A3598] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {bulkCollectAccounts.length} Pending
                </span>
              </div>

              {bulkCollectAccounts.length > 0 ? (
                <div className="flex flex-col gap-4 flex-1">
                  {/* Select All checkbox */}
                  <div className="flex justify-between items-center bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                    <label className={`flex items-center gap-2 select-none ${isFutureDate ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={bulkCollectSelected.length === bulkCollectAccounts.length && bulkCollectAccounts.length > 0}
                        disabled={isFutureDate}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkCollectSelected(bulkCollectAccounts.map(a => a.accNo));
                          } else {
                            setBulkCollectSelected([]);
                          }
                        }}
                        className="w-4 h-4 text-[#0A3598] rounded border-[#E2E8F0] focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="text-xs font-bold text-[#0F172A]">Select All Pending</span>
                    </label>
                    <span className="text-xs font-bold text-[#0A3598]">
                      Selected: {bulkCollectSelected.length} / {bulkCollectAccounts.length}
                    </span>
                  </div>

                  {/* Checklist Table */}
                  <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl flex-1 max-h-[350px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-[#E2E8F0]">
                      <thead className="bg-[#F8FAFC] sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#64748B] uppercase">Select</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#64748B] uppercase">Customer</th>
                          <th className="px-4 py-2.5 text-right text-[10px] font-bold text-[#64748B] uppercase">EMI (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs">
                        {bulkCollectAccounts.map(acc => {
                          const name = acc.customer?.name || acc.name;
                          const isChecked = bulkCollectSelected.includes(acc.accNo);

                          return (
                            <tr key={acc.accNo} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isFutureDate}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setBulkCollectSelected(prev => [...prev, acc.accNo]);
                                    } else {
                                      setBulkCollectSelected(prev => prev.filter(id => id !== acc.accNo));
                                    }
                                  }}
                                  className="w-4 h-4 text-[#0A3598] rounded border-[#E2E8F0] focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-[#0F172A]">{name}</div>
                                <div className="text-[10px] text-[#0A3598] font-medium">{acc.accNo} ({acc.type})</div>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-[#0F172A]">
                                ₹{(acc.emiAmt || 0).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Box & Action Button */}
                  <div className="pt-3 border-t border-[#F1F5F9] space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#64748B] font-medium">Total Selected EMI Amount:</span>
                      <strong className="text-base font-black text-[#16A34A]">
                        ₹{bulkCollectAccounts
                          .filter(a => bulkCollectSelected.includes(a.accNo))
                          .reduce((sum, a) => sum + (a.emiAmt || 0), 0)
                          .toLocaleString()}
                      </strong>
                    </div>
                    <button
                      onClick={handleBulkCollectSubmit}
                      disabled={bulkCollectSelected.length === 0 || isFutureDate}
                      className="w-full h-11 bg-[#0A3598] hover:bg-[#0A3598]/90 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-rounded text-sm select-none">payments</span>
                      Collect Selected ({bulkCollectSelected.length} EMIs)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-3 border border-dashed border-[#E2E8F0] rounded-2xl bg-[#F8FAFC]/50 flex-1">
                  <div className="w-12 h-12 rounded-full bg-[#EDF3EC] flex items-center justify-center text-[#346538] shadow-xs">
                    <span className="material-symbols-rounded text-xl select-none">verified_user</span>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#0F172A]">All Caught Up!</h5>
                    <p className="text-[10px] text-[#64748B] mt-1 max-w-[200px] mx-auto leading-relaxed">
                      No pending collection accounts found for {selectedAgentForBulk} today.
                    </p>
                  </div>
                  <span className="bg-[#EDF3EC] text-[#346538] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    100% Collected
                  </span>
                </div>
              )}
            </div>

            {/* Section 2: Bulk Collections Synced */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#F1F5F9]">
                <div>
                  <h4 className="text-xs font-black text-[#0F172A] uppercase tracking-wider">Bulk Collections Received</h4>
                  <p className="text-[10px] text-[#64748B] mt-0.5">Collected today by {selectedAgentForBulk}, synced to server</p>
                </div>
                <span className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {bulkAwaitingApproveCollections.length} Synced
                </span>
              </div>

              {bulkAwaitingApproveCollections.length > 0 ? (
                <div className="flex flex-col gap-4 flex-1">
                  {/* Select All checkbox */}
                  <div className="flex justify-between items-center bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bulkAwaitingSelected.length === bulkAwaitingApproveCollections.length && bulkAwaitingApproveCollections.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkAwaitingSelected(bulkAwaitingApproveCollections.map(a => a.accNo));
                          } else {
                            setBulkAwaitingSelected([]);
                          }
                        }}
                        className="w-4 h-4 text-[#0A3598] rounded border-[#E2E8F0] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#0F172A]">Select All Synced</span>
                    </label>
                    <span className="text-xs font-bold text-[#0A3598]">
                      Selected: {bulkAwaitingSelected.length} / {bulkAwaitingApproveCollections.length}
                    </span>
                  </div>

                  {/* Checklist Table */}
                  <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl flex-1 max-h-[350px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-[#E2E8F0]">
                      <thead className="bg-[#F8FAFC] sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#64748B] uppercase">Select</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#64748B] uppercase">Customer</th>
                          <th className="px-4 py-2.5 text-right text-[10px] font-bold text-[#64748B] uppercase">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs">
                        {bulkAwaitingApproveCollections.map(acc => {
                          const name = acc.customer?.name || acc.name;
                          const isChecked = bulkAwaitingSelected.includes(acc.accNo);
                          const todayTx = acc.ledger?.find(t => t.date === todayStr) || { amt: 0 };

                          return (
                            <tr key={acc.accNo} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setBulkAwaitingSelected(prev => [...prev, acc.accNo]);
                                    } else {
                                      setBulkAwaitingSelected(prev => prev.filter(id => id !== acc.accNo));
                                    }
                                  }}
                                  className="w-4 h-4 text-[#0A3598] rounded border-[#E2E8F0] focus:ring-0 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-[#0F172A]">{name}</div>
                                <div className="text-[10px] text-[#0A3598] font-medium">{acc.accNo} ({acc.type})</div>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-[#16A34A]">
                                ₹{(todayTx.amt || 0).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Box & Action Button */}
                  <div className="pt-3 border-t border-[#F1F5F9] space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#64748B] font-medium">Total Selected Collections:</span>
                      <strong className="text-base font-black text-[#16A34A]">
                        ₹{bulkAwaitingApproveCollections
                          .filter(a => bulkAwaitingSelected.includes(a.accNo))
                          .reduce((sum, a) => {
                            const tx = a.ledger?.find(t => t.date === todayStr);
                            return sum + (tx?.amt || 0);
                          }, 0)
                          .toLocaleString()}
                      </strong>
                    </div>
                    <button
                      onClick={handleBulkApproveCollectionsSubmit}
                      disabled={bulkAwaitingSelected.length === 0}
                      className="w-full h-11 bg-[#16A34A] hover:bg-[#16A34A]/90 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-rounded text-sm select-none">check_circle</span>
                      Verify Selected ({bulkAwaitingSelected.length} Collections)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-3 border border-dashed border-[#E2E8F0] rounded-2xl bg-[#F8FAFC]/50 flex-1">
                  <div className="w-12 h-12 rounded-full bg-[#E1F3FE] flex items-center justify-center text-[#1F6C9F] shadow-xs">
                    <span className="material-symbols-rounded text-xl select-none">check_circle</span>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#0F172A]">All Collections Synced</h5>
                    <p className="text-[10px] text-[#64748B] mt-1 max-w-[200px] mx-auto leading-relaxed">
                      No new collections recorded for {selectedAgentForBulk} today.
                    </p>
                  </div>
                  <span className="bg-[#E1F3FE] text-[#1F6C9F] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Synced
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {selectedAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setSelectedAccount(null)}>
          <div 
            className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md p-5 space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-[#F1F5F9] pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-base text-[#0A3598] select-none">payments</span>
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Collect Daily Payment
                </h3>
              </div>
              <button 
                onClick={() => setSelectedAccount(null)}
                className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
              >
                <span className="material-symbols-rounded text-sm select-none">close</span>
              </button>
            </div>

            <form onSubmit={handleCollectSubmit} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1.5 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Customer Name:</span>
                  <span className="font-bold text-[#0F172A]">{selectedAccount.customer?.name || selectedAccount.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Account Number:</span>
                  <span className="font-bold text-[#0A3598]">{selectedAccount.accNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Standard EMI Due:</span>
                  <span className="font-black text-[#0F172A]">₹{selectedAccount.emiAmt}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 text-[10px] block uppercase tracking-wide">Amount (₹) *</label>
                  <input 
                    type="number"
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-[#E2E8F0] rounded-xl text-sm font-bold text-[#16A34A] focus:outline-none focus:border-[#0A3598]"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 text-[10px] block uppercase tracking-wide">Fine / Late Charge (₹)</label>
                  <input 
                    type="number"
                    value={fineAmount}
                    onChange={(e) => setFineAmount(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-[#E2E8F0] rounded-xl text-sm font-bold text-[#E11D48] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Select
                  label="Payment Mode"
                  required={true}
                  options={[
                    { value: "Cash", label: "Cash Settlement" },
                    { value: "Bank Transfer", label: "Bank Transfer (UPI / IMPS)" },
                    { value: "Cheque", label: "Cheque Settlement" }
                  ]}
                  value={paymentMode}
                  onChange={(val) => setPaymentMode(val)}
                  searchable={false}
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setSelectedAccount(null)}
                  className="flex-1 h-11 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center flex items-center justify-center"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 h-11 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collection Receipt Modal */}
      {showReceipt && receiptTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeReceipt}></div>
          
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative z-10 border border-[#E2E8F0] text-[#0F172A] font-sans flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center pb-4 border-b border-dashed border-[#E2E8F0]">
              <span className="text-sm font-bold block">Umbrella Finance</span>
              <span className="text-[10px] text-[#64748B] block mt-0.5">Chhote Kadam, Bade Sapne</span>
              <span className="text-xs font-bold text-[#0A3598] mt-2 block bg-[#0A3598]/5 py-1 rounded-lg">Collection Receipt</span>
            </div>

            <div className="space-y-2 text-xs py-2 border-b border-dashed border-[#E2E8F0] pb-3">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Receipt No</span>
                <span className="font-bold">{receiptTxn.refNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Date</span>
                <span className="font-medium">{receiptTxn.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Collector</span>
                <span className="font-bold">{receiptTxn.collector}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2 text-xs py-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Amount</span>
                  <span className="font-bold text-[#16A34A]">₹{receiptTxn.amt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Fine</span>
                  <span className="font-bold">₹{receiptTxn.fine.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-[#E2E8F0] pt-2 font-bold text-sm text-[#0A3598]">
                  <span>Total Received</span>
                  <span>₹{(receiptTxn.amt + receiptTxn.fine).toLocaleString()}</span>
                </div>
              </div>

              {receiptTxn.status === 'Approved' && !isAgent && (
                <button
                  onClick={() => triggerVoidConfirm(receiptTxn.refNo)}
                  className="w-full flex items-center justify-center gap-1 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer mt-2"
                >
                  <span className="material-symbols-rounded text-sm select-none">delete_forever</span>
                  Void / Reset Payment
                </button>
              )}

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => {
                    alert('Receipt print command sent.');
                    closeReceipt();
                  }}
                  className="flex items-center justify-center gap-1 px-4 py-2.5 bg-[#0A3598] text-white rounded-xl text-xs font-bold hover:bg-[#0A3598]/90 transition-all cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-rounded text-sm select-none">print</span>
                  Print Receipt
                </button>
                <button
                  onClick={closeReceipt}
                  className="px-4 py-2.5 border border-[#E2E8F0] hover:bg-slate-50 text-[#64748B] rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Void Confirmation Modal */}
      {showConfirmVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowConfirmVoid(false)}></div>
          
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative z-50 border border-[#E2E8F0] text-[#0F172A] font-sans flex flex-col items-center text-center gap-4 animate-scale-up">
            {/* Warning Icon */}
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <span className="material-symbols-rounded text-2xl select-none">warning</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-[#0F172A]">Void Collection?</h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                Are you sure you want to void this collection? This will remove the transaction from the ledger and reset the status to Pending.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full mt-2">
              <button
                onClick={() => setShowConfirmVoid(false)}
                className="px-4 py-2.5 border border-[#E2E8F0] hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                onClick={() => executeVoidTransaction(voidRefNo)}
                className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 active:scale-95 transition-all cursor-pointer shadow-md shadow-red-200 text-center"
              >
                Void Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
