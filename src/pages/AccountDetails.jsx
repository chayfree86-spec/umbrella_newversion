import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import Chart from 'react-apexcharts';
import { loanApi, savingApi, customerApi, collectionApi } from '../services/api';

export default function AccountDetails() {
  const { accNo } = useParams();
  const navigate = useNavigate();

  const isLoan = accNo.startsWith('UF-LN-') || accNo.startsWith('LN-');

  const fetchAccount = useCallback(async () => {
    try {
      const res = isLoan ? await loanApi.get(accNo) : await savingApi.get(accNo);
      const accData = res.data || null;
      if (accData && accData.customer_id) {
        try {
          const custRes = await customerApi.profile(accData.customer_id);
          const custData = custRes.data || null;
          if (custData) {
            const permAddr = (custData.addresses || []).find(a => a.address_type === 'Permanent') || (custData.addresses || [])[0];
            const fullAddr = permAddr 
              ? `${permAddr.address_line1}${permAddr.address_line2 ? ', ' + permAddr.address_line2 : ''}, ${permAddr.city}, ${permAddr.state} - ${permAddr.pincode}`
              : 'N/A';
            
            accData.customer = {
              name: custData.full_name || 'N/A',
              occupation: custData.occupation || 'Business',
              phone: custData.mobile || 'N/A',
              aadhaar: custData.kyc?.aadhaar_no || 'N/A',
              pan: custData.kyc?.pan_no || 'N/A',
              monthlyIncome: custData.monthly_income ? `₹${Number(custData.monthly_income).toLocaleString('en-IN')}` : '₹0',
              address: fullAddr,
              bank: {
                name: custData.kyc?.bank_name || 'N/A',
                accountNo: custData.kyc?.bank_account_no || 'N/A',
                ifsc: custData.kyc?.bank_ifsc || 'N/A'
              }
            };

            const guarantorObj = (custData.guarantors || [])[0];
            accData.guarantor = guarantorObj ? {
              name: guarantorObj.name || 'N/A',
              phone: guarantorObj.mobile || 'N/A',
              relation: guarantorObj.relation || 'N/A',
              monthlyIncome: guarantorObj.monthly_income ? `₹${Number(guarantorObj.monthly_income).toLocaleString('en-IN')}` : '₹0',
              address: guarantorObj.address || 'N/A'
            } : null;
          }
        } catch (err) {
          console.error("Failed to load customer profile", err);
        }
      }
      setAccount(accData);
    } catch (e) {
      setAccount(null);
    }
  }, [accNo, isLoan]);

  const fetchStatement = useCallback(async () => {
    try {
      const res = isLoan ? await loanApi.statement(accNo) : await savingApi.statement(accNo);
      setStatementData(res.data || []);
    } catch (e) {
      setStatementData([]);
    }
  }, [accNo, isLoan]);

  const [account, setAccount] = useState(null);
  const [statementData, setStatementData] = useState([]);
  

  // Account approval / reset states
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvalStartDate, setApprovalStartDate] = useState('');
  const [approvalDate, setApprovalDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isClearLedgerModalOpen, setIsClearLedgerModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  
  const userRole = localStorage.getItem('active_user_role') || 'Super Admin';

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closePayMode, setClosePayMode] = useState('Cash');
  const [confirmClosure, setConfirmClosure] = useState(false);

  // Flexible closure inputs state
  const [closePrincipal, setClosePrincipal] = useState(0);
  const [closeInterestFine, setCloseInterestFine] = useState(0);
  const [closeDiscountCharges, setCloseDiscountCharges] = useState(0);

  // Collection Entry Modal States
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [selectedDayObj, setSelectedDayObj] = useState(null);
  const [earliestUnpaidDate, setEarliestUnpaidDate] = useState(null);
  const [collectAmt, setCollectAmt] = useState(0);
  const [collectFine, setCollectFine] = useState(0);
  const [collectPayMode, setCollectPayMode] = useState('Cash');
  const [collectPrevDues, setCollectPrevDues] = useState(0);
  const [collectTodayDue, setCollectTodayDue] = useState(0);
  const [collectTotalDue, setCollectTotalDue] = useState(0);
  // Month Selection States for Payment Calendar
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchAccount();
    fetchStatement();
    setConfirmClosure(false);
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
  }, [accNo, fetchAccount, fetchStatement]);

  if (!account) {
    return <div className="text-center p-12 text-sm text-[#64748B]">Loading account details...</div>;
  }

  // Normalize account fields for compatibility with database schema
  account.accNo = account.loan_account_no || account.saving_account_no || accNo;
  account.type = isLoan ? 'Loan' : 'Saving';
  account.paymentCycle = account.collection_frequency || 'Daily';
  account.emiAmt = Number(account.emi_amount || account.deposit_amount || 0);
  account.totalPaid = Number(account.total_paid || account.total_deposited || 0);
  const isApprovedOrActive = ['Approved', 'Active', 'Defaulter', 'NPA', 'Closed'].includes(account.account_status || account.status || '');
  account.outstanding = isApprovedOrActive ? Number(account.outstanding_amount || 0) : 0;
  account.approvedAmt = Number(account.principal_amount || 0);
  account.disbursedAmt = isApprovedOrActive ? Number(account.principal_amount || 0) : 0;
  account.processingFee = Number(account.processing_fee || 0);
  account.interestRate = account.interest_rate ? `${account.interest_rate}%` : '0%';
  account.tenureDays = isLoan 
    ? (account.duration_days || 0) 
    : (account.duration_months ? account.duration_months * 30 : 365);
  account.nextDueDate = isLoan 
    ? (account.end_date || 'N/A') 
    : (account.maturity_date || 'N/A');

  account.disbursalDate = account.start_date || 'N/A';
  const startVal = account.start_date ? new Date(account.start_date) : new Date();
  const todayVal = new Date();
  const diffTimeVal = Math.max(0, todayVal - startVal);
  const diffDaysVal = Math.floor(diffTimeVal / (1000 * 60 * 60 * 24));
  account.paidDays = Math.min(diffDaysVal, account.tenureDays || 365);

  account.status = account.account_status || account.status || 'Pending';

  // Fallback for customer object to prevent crashes if loading fails or during transitions
  account.customer = account.customer || {
    name: account.customer_name || 'N/A',
    occupation: account.occupation || 'Business',
    phone: account.customer_mobile || 'N/A',
    aadhaar: 'N/A',
    pan: 'N/A',
    monthlyIncome: '₹0',
    address: 'N/A',
    bank: { name: 'N/A', accountNo: 'N/A', ifsc: 'N/A' }
  };

  // Fallback for guarantor object to prevent crashes
  account.guarantor = account.guarantor || {
    name: 'N/A',
    phone: 'N/A',
    relation: 'N/A',
    monthlyIncome: '₹0',
    address: 'N/A'
  };

  // Fallback for nominee object to prevent crashes
  account.nominee = account.nominee || {
    name: 'N/A',
    phone: 'N/A',
    relation: 'N/A',
    age: 'N/A',
    share: '100%'
  };

  // Map ledger from statementData.transactions
  account.ledger = statementData.transactions || [];

  // Build account shape from API data for compatibility
  const customerAccounts = [];

  // Approval / Reset Handlers
  const handleApproveAccount = () => {
    if (approvalDate < approvalStartDate) {
      alert("Approved Date cannot be before the Account Opening Date.");
      return;
    }

    const api = isLoan ? loanApi : savingApi;
    api.approve(accNo, approvalStartDate, approvalDate)
      .then(() => { 
        fetchAccount(); 
        fetchStatement();
        setIsApproveModalOpen(false); 
      })
      .catch(err => alert(err.message || 'Approval failed.'));
  };

  const handleRejectAccount = () => {
    const api = isLoan ? loanApi : savingApi;
    api.reject(accNo)
      .then(() => {
        fetchAccount();
        fetchStatement();
      })
      .catch(err => alert(err.message || 'Rejection failed.'));
  };

  const handleResetToProcessing = () => {
    const api = isLoan ? loanApi : savingApi;
    api.reset(accNo)
      .then(() => {
        fetchAccount();
        fetchStatement();
      })
      .catch(err => alert(err.message || 'Reset failed.'));
  };

  const handleDeleteAccount = () => {
    if (!window.confirm("Are you sure you want to delete this rejected account? This action cannot be undone.")) return;
    const api = isLoan ? loanApi : savingApi;
    api.delete(accNo)
      .then(() => {
        alert("Account deleted successfully.");
        navigate('/collection');
      })
      .catch(err => alert(err.message || 'Deletion failed.'));
  };

  const handleResetCollection = (receiptNo) => {
    if (!window.confirm(`Are you sure you want to reset/delete collection receipt ${receiptNo}? This will recalculate the ledger. This action cannot be undone.`)) return;
    collectionApi.deleteCollection(receiptNo)
      .then(() => {
        alert("Collection reset successfully.");
        fetchAccount();
        fetchStatement();
      })
      .catch(err => alert(err.message || 'Reset failed.'));
  };

  const handleClearLedger = () => {
    if (!window.confirm("Are you sure you want to clear the entire payment ledger for this account? All collected collections/deposits will be permanently deleted and all installments will be reset to Pending. This action cannot be undone.")) return;
    const api = isLoan ? loanApi : savingApi;
    api.clearLedger(accNo)
      .then(() => {
        alert("Payment ledger cleared successfully.");
        setIsClearLedgerModalOpen(false);
        fetchAccount();
        fetchStatement();
      })
      .catch(err => alert(err.message || 'Clearing ledger failed.'));
  };

  // Helper to open modal and set defaults
  const openClosureModal = () => {
    if (account.type === 'Loan') {
      setClosePrincipal(account.outstanding);
      setCloseInterestFine(0); // Accrued Interest / Fine
      setCloseDiscountCharges(0); // Waiver / Discount
    } else {
      setClosePrincipal(account.totalPaid);
      setCloseInterestFine(812); // Expected Interest (6.5%)
      setCloseDiscountCharges(0); // Penalty / Charges
    }
    setConfirmClosure(false);
    setIsCloseModalOpen(true);
  };

  // Closure function
  const handleCloseAccount = () => {
    if (!confirmClosure) return;
    const apiCall = isLoan
      ? loanApi.close(accNo)
      : savingApi.mature(accNo, closePayMode);
    apiCall
      .then(() => {
        fetchAccount();
        fetchStatement();
        setIsCloseModalOpen(false);
        alert(`${isLoan ? 'Loan Account' : 'Savings Account'} closed successfully!`);
      })
      .catch(err => alert(err.message || 'Closure failed.'));
  };

  const handleDayClick = (dayObj) => {
    setSelectedDayObj(dayObj);
    
    const installments = statementData.installments || [];
    const emiAmt = Number(account.emi_amount || account.emiAmt || account.installment_amount || 0);
    const clickedDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayObj.day).padStart(2, '0')}`;
    
    let prevDues = 0;
    let todayDue = 0;
    
    // Find earliest unpaid installment
    const firstUnpaidInst = installments.find(inst => inst.status !== 'Paid');
    const earliestDate = firstUnpaidInst ? firstUnpaidInst.due_date.slice(0, 10) : null;
    setEarliestUnpaidDate(earliestDate);
    
    installments.forEach(inst => {
      const dueStr = inst.due_date.slice(0, 10);
      if (dueStr <= clickedDateStr && inst.status !== 'Paid') {
        const pending = Number(inst.total_due || 0) - Number(inst.paid_amount || 0);
        if (dueStr < clickedDateStr) {
          prevDues += pending;
        } else if (dueStr === clickedDateStr) {
          todayDue += pending;
        }
      }
    });

    setCollectPrevDues(prevDues);
    setCollectTodayDue(todayDue);
    
    const totalDue = prevDues + todayDue;
    setCollectTotalDue(totalDue);
    setCollectAmt(totalDue > 0 ? totalDue : emiAmt);
    
    setCollectFine(0);
    setCollectPayMode('Cash');
    setIsCollectModalOpen(true);
  };


  const handleCollectSubmit = (e) => {
    if (e) e.preventDefault();
    if (!collectAmt || collectAmt <= 0) {
      alert('Please enter a valid collection amount.');
      return;
    }

    const collectionDate = selectedDayObj
      ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDayObj.day).padStart(2, '0')}`
      : new Date().toISOString().slice(0, 10);

    const apiCall = isLoan
      ? loanApi.collect(accNo, collectAmt, collectFine, collectPayMode, '', collectionDate)
      : savingApi.deposit(accNo, collectAmt, collectPayMode, '', collectionDate);

    apiCall
      .then(() => {
        fetchAccount();
        fetchStatement();
        setIsCollectModalOpen(false);
        alert(`Collection of ₹${Number(collectAmt).toLocaleString('en-IN')} recorded successfully!`);
      })
      .catch(err => alert(err.message || 'Collection failed.'));
  };

  const loanPayOptions = [
    { value: 'Cash', label: 'Cash Settlement' },
    { value: 'Bank Transfer', label: 'Bank Transfer (UPI / IMPS)' },
    { value: 'Cheque', label: 'Cheque Settlement' }
  ];

  const savingsPayOptions = [
    { value: 'Cash', label: 'Cash Handover' },
    { value: 'Bank Transfer', label: 'Direct Bank Transfer' },
    { value: 'Cheque', label: 'Maturity Cheque' }
  ];

  const getRepaymentTrendData = () => {
    const txList = (statementData.transactions || []);
    if (!txList.length) {
      return { categories: [], data: [] };
    }
    const collections = txList
      .filter(tx => 
        (tx.transaction_type || '').toLowerCase().includes('collection') || 
        (tx.transaction_type || '').toLowerCase().includes('payment') || 
        (tx.transaction_type || '').toLowerCase().includes('deposit')
      )
      .map(tx => {
        const dateObj = new Date(tx.transaction_date);
        return { amt: Number(tx.amount), date: tx.transaction_date, dateObj };
      })
      .sort((a, b) => a.dateObj - b.dateObj);

    let cumulativeSum = 0;
    const data = [];
    const categories = [];

    collections.forEach(c => {
      cumulativeSum += c.amt;
      data.push(cumulativeSum);
      categories.push(c.date.slice(5, 10));
    });

    return { categories, data };
  };

  const handleWhatsAppShare = () => {
    const txList = statementData.transactions || [];
    const collected = Number(account.total_paid || account.totalPaid || 0);
    const remaining = isLoan ? Number(account.outstanding_amount || account.outstanding || 0) : 0;
    
    let text = `*Umbrella Finance - Payment Ledger Summary*\n\n`;
    text += `*Customer:* ${account.customer_name || (account.customer && account.customer.name) || 'N/A'}\n`;
    text += `*Account No:* ${account.loan_account_no || account.saving_account_no || accNo}\n`;
    text += `*Status:* ${account.account_status || account.status}\n`;
    text += `*Total Paid:* ₹${collected.toLocaleString('en-IN')}\n`;
    text += `*Outstanding/Remaining:* ₹${remaining.toLocaleString('en-IN')}\n\n`;
    text += `*Recent Payments:*\n`;
    
    txList.slice(0, 3).forEach(row => {
      text += `- ${row.transaction_date}: ₹${row.amount} (${row.transaction_type})\n`;
    });
    
    text += `\nThank you for banking with Umbrella Finance!`;
    
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleExcelExport = () => {
    const txList = statementData.transactions || [];
    const headers = ['Date', 'Reference No', 'Payment Type', 'Amount Paid (INR)', 'Late Fine (INR)', 'Collected By'];
    const rows = txList.map(row => [
      row.transaction_date,
      row.receipt_no || row.reference_no || '',
      row.transaction_type,
      row.amount,
      row.penalty_amount || 0,
      row.agent_name || row.collected_by || ''
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${accNo}_ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const accStatus = account.status;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A] hover:underline cursor-pointer"
          >
            <span className="material-symbols-rounded text-sm select-none">arrow_back</span>
            Back to previous page
          </button>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <h2 className="text-xl font-black text-[#0F172A]">Account Ledger: {account.accNo}</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
              accStatus === 'Approved' ? 'bg-[#16A34A]/10 text-[#16A34A]' :
              accStatus === 'Defaulter' ? 'bg-[#DC2626]/10 text-[#DC2626]' :
              accStatus === 'NPA' ? 'bg-[#7F1D1D]/10 text-[#7F1D1D]' :
              accStatus === 'Written Off' ? 'bg-[#475569]/10 text-[#475569]' :
              accStatus === 'Processing' ? 'bg-[#2563EB]/10 text-[#2563EB]' :
              accStatus === 'Pending' ? 'bg-[#D97706]/10 text-[#D97706]' :
              accStatus === 'Rejected' ? 'bg-[#B91C1C]/10 text-[#B91C1C]' :
              'bg-[#64748B]/10 text-[#64748B]'
            }`}>
              {accStatus}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
              account.type === 'Loan' ? 'bg-[#1E3A8A]/10 text-[#1E3A8A]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'
            }`}>
              {account.type}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700">
              {account.paymentCycle} Cycle
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
              EMI: ₹{account.emiAmt.toLocaleString()} / {account.paymentCycle.toLowerCase() === 'daily' ? 'day' : account.paymentCycle.toLowerCase() === 'weekly' ? 'week' : 'month'}
            </span>
          </div>

          {/* Horizontal Account Lifecycle Stepper */}
          <div className="flex items-center gap-3 sm:gap-5 mt-3.5 max-w-2xl w-full text-[10px] sm:text-xs font-bold text-slate-700 select-none bg-slate-50/50 p-3 rounded-2xl border border-slate-100 overflow-x-auto">
            {/* Step 1: Registered */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-[10px] ring-4 ring-blue-100 shrink-0">
                1
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold leading-none">Registered</p>
                <p className="text-[10px] font-black text-[#0F172A] mt-0.5 whitespace-nowrap">
                  {account.created_at ? new Date(account.created_at).toLocaleDateString('en-IN') : 'N/A'}
                </p>
              </div>
            </div>

            {/* Rail Line 1 */}
            <div className={`flex-1 h-0.5 min-w-[20px] shrink-0 ${account.status === 'Rejected' ? 'bg-[#DC2626]' : account.approved_at ? 'bg-[#16A34A]' : 'bg-slate-200'}`}></div>

            {/* Step 2: Approved / Rejected */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                account.status === 'Rejected'
                  ? 'bg-[#DC2626] text-white ring-4 ring-rose-100'
                  : account.approved_at 
                    ? 'bg-[#16A34A] text-white ring-4 ring-emerald-100' 
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}>
                2
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold leading-none">
                  {account.status === 'Rejected' ? 'Rejected' : 'Approved'}
                </p>
                <p className="text-[10px] font-black text-[#0F172A] mt-0.5 whitespace-nowrap">
                  {account.status === 'Rejected' 
                    ? 'Rejected'
                    : account.approved_at ? new Date(account.approved_at).toLocaleDateString('en-IN') : 'Awaiting Approval'}
                </p>
              </div>
            </div>

            {account.status !== 'Rejected' && (
              <>
                {/* Rail Line 2 */}
                <div className={`flex-1 h-0.5 min-w-[20px] shrink-0 ${account.approved_at ? 'bg-[#3B82F6]' : 'bg-slate-200'}`}></div>

                {/* Step 3: End Date */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    account.approved_at 
                      ? 'bg-[#3B82F6] text-white ring-4 ring-blue-100' 
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}>
                    3
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold leading-none">End Date</p>
                    <p className="text-[10px] font-black text-[#0F172A] mt-0.5 whitespace-nowrap">
                      {account.approved_at 
                        ? new Date(account.type === 'Loan' ? account.end_date : account.maturity_date).toLocaleDateString('en-IN') 
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Rail Line 3 */}
                <div className={`flex-1 h-0.5 min-w-[20px] shrink-0 ${account.status === 'Closed' ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

                {/* Step 4: Closed */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    account.status === 'Closed' 
                      ? 'bg-slate-700 text-white ring-4 ring-slate-100' 
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}>
                    4
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold leading-none">Closed</p>
                    <p className="text-[10px] font-black text-[#0F172A] mt-0.5 whitespace-nowrap">
                      {account.status === 'Closed' 
                        ? (account.closed_at ? new Date(account.closed_at).toLocaleDateString('en-IN') : 'Closed') 
                        : 'Active'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {['Approved', 'Active', 'Defaulter', 'NPA'].includes(accStatus) ? (
            <>
              <Link
                to={`/collection?search=${account.accNo}`}
                className="px-4 py-2 bg-[#1E3A8A] text-white hover:bg-[#1E3A8A]/90 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-rounded text-sm select-none">payments</span>
                Collect Payment
              </Link>
              {account.type === 'Loan' ? (
                <button
                  onClick={openClosureModal}
                  className="px-4 py-2 bg-[#E11D48] hover:bg-[#E11D48]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-rounded text-sm select-none">cancel_presentation</span>
                  Close Loan (NOC)
                </button>
              ) : (
                <button
                  onClick={openClosureModal}
                  className="px-4 py-2 bg-[#EA580C] hover:bg-[#EA580C]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-rounded text-sm select-none">auto_awesome</span>
                  Maturity Close
                </button>
              )}
            </>
          ) : accStatus === 'Account Closed' ? (
            <span className="px-4 py-2 bg-slate-100 text-slate-500 text-xs font-extrabold rounded-xl border border-slate-200 flex items-center gap-1.5 select-none">
              <span className="material-symbols-rounded text-sm">lock_clock</span>
              Account Settled & Closed
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-4 py-2 bg-amber-50 text-amber-700 text-xs font-extrabold rounded-xl border border-amber-200 flex items-center gap-1.5 select-none">
                <span className="material-symbols-rounded text-sm">info</span>
                {accStatus === 'Processing' ? 'Awaiting Approval' : accStatus === 'Pending' ? 'Draft Pending' : 'Account Rejected'}
              </span>
              {accStatus === 'Rejected' && (
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-rounded text-sm select-none">delete</span>
                  Delete Account
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Account Status Workflow Controls (Approve/Reject / Reset) */}
      {accStatus === 'Processing' && (
        <div className="bg-[#2563EB]/5 border border-[#2563EB]/25 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <span className="bg-[#2563EB]/15 text-[#2563EB] px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide inline-block">
              Awaiting Approval
            </span>
            <h4 className="text-sm font-bold text-[#0F172A]">This account is pending review and approval.</h4>
            <p className="text-xs text-[#64748B]">Please review the customer details, documents, and click Approve to select start date or Reject.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
                const initialDate = account.start_date || today;
                setApprovalStartDate(initialDate);
                setApprovalDate(initialDate);
                setIsApproveModalOpen(true);
              }}
              className="flex-1 md:flex-none px-4 py-2 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-rounded text-sm">check_circle</span>
              Approve Account
            </button>
            <button
              onClick={() => handleRejectAccount()}
              className="flex-1 md:flex-none px-4 py-2 bg-[#DC2626] hover:bg-[#DC2626]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-rounded text-sm">cancel</span>
              Reject Account
            </button>
          </div>
        </div>
      )}

      {/* Admin Reset Control Panel */}
      {['Approved', 'Active', 'Rejected', 'Defaulter', 'NPA', 'Written Off'].includes(accStatus) && userRole === 'Super Admin' && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Super Admin Controls</span>
            <p className="text-xs text-[#64748B]">
              You have the right to reset this account status back to <strong className="text-[#2563EB]">Processing</strong> for re-evaluation.
            </p>
          </div>
          <div>
            {(account.ledger && account.ledger.length > 0) ? (
              <div className="text-right">
                <button
                  disabled
                  className="px-4 py-2 bg-slate-200 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed flex items-center gap-1.5 select-none"
                  title="To reset this account back to Processing, you must first clear all collected transactions from the payment ledger."
                >
                  <span className="material-symbols-rounded text-sm">lock</span>
                  Status Locked (Payments Exist)
                </button>
                <button
                  onClick={() => setIsClearLedgerModalOpen(true)}
                  className="text-[10px] text-[#DC2626] font-bold hover:underline block mt-1 text-center sm:text-right cursor-pointer"
                >
                  Clear Ledger & Unlock Status
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsResetModalOpen(true)}
                className="px-4 py-2 border border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-rounded text-sm">restart_alt</span>
                Reset to Processing
              </button>
            )}
          </div>
        </div>
      )}

      {/* Financial summaries (Full Width) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {account.type === 'Loan' ? (
          <>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Approved Amt</span>
              <strong className="text-base font-black text-[#0F172A] mt-1 block">₹{account.approvedAmt.toLocaleString()}</strong>
              <span className="text-[9px] text-[#64748B] block mt-0.5">Interest: {account.interestRate}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Disbursed</span>
              <strong className="text-base font-black text-[#1E3A8A] mt-1 block">₹{account.disbursedAmt.toLocaleString()}</strong>
              <span className="text-[9px] text-[#64748B] block mt-0.5">Fee: ₹{account.processingFee}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Total Repaid</span>
              <strong className="text-base font-black text-[#16A34A] mt-1 block">₹{account.totalPaid.toLocaleString()}</strong>
              <span className="text-[9px] text-[#64748B] block mt-0.5">EMI: ₹{account.emiAmt}/day</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Outstanding</span>
              <strong className="text-base font-black text-[#E11D48] mt-1 block">₹{account.outstanding.toLocaleString()}</strong>
              <span className="text-[9px] text-[#EA580C] font-semibold block mt-0.5">Next: {account.nextDueDate}</span>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Total Deposited</span>
              <strong className="text-base font-black text-[#1E3A8A] mt-1 block">₹{account.totalPaid.toLocaleString()}</strong>
              <span className="text-[9px] text-[#64748B] block mt-0.5">Goal: ₹{account.emiAmt}/day</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Interest Rate</span>
              <strong className="text-base font-black text-[#16A34A] mt-1 block">{account.interestRate}</strong>
              <span className="text-[9px] text-[#64748B] block mt-0.5">Compound p.a.</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Maturity Target</span>
              <strong className="text-base font-black text-[#F59E0B] mt-1 block">₹36,500</strong>
              <span className="text-[9px] text-[#64748B] block mt-0.5">Tenure: {account.tenureDays} Days</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Maturity Date</span>
              <strong className="text-base font-black text-[#0F172A] mt-1 block">20-04-2027</strong>
              <span className="text-[9px] text-[#64748B] block mt-0.5">Lock-in applied</span>
            </div>
          </>
        )}
      </div>

      {/* Customer Portfolio Switcher (Full Width above Calendar) */}
      {customerAccounts.length > 1 && (
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider mr-2 select-none">
            Linked Accounts:
          </span>
            {customerAccounts.map(acc => {
              const isActive = acc.accNo === account.accNo;
              return (
                <Link
                  key={acc.accNo}
                  to={`/account/${acc.accNo}`}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white shadow-xs'
                      : 'bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-rounded text-sm">
                    {acc.type === 'Loan' ? 'payments' : 'savings'}
                  </span>
                  {acc.accNo} ({acc.type})
                  {acc.status === 'Closed' && (
                    <span className="text-[8px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-extrabold uppercase ml-1">Closed</span>
                  )}
                </Link>
              );
            })}
        </div>
      )}

      {/* Payment Calendar Ledger (Full Width) */}
      {(() => {
        const monthsList = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Build per-date map from real installments + transactions (backend data only)
        const todayDate = new Date();
        const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

        const startDateStr = account.start_date || null;
        const startDateObj = startDateStr ? new Date(startDateStr) : null;
        const beforeApproval = startDateObj && (
          selectedYear < startDateObj.getFullYear() ||
          (selectedYear === startDateObj.getFullYear() && selectedMonth < startDateObj.getMonth())
        );

        const installmentsList = statementData.installments || [];
        const transactionsList = statementData.transactions || [];

        const dateMap = {};
        installmentsList.forEach(inst => {
          if (!inst.due_date) return;
          const key = inst.due_date.slice(0, 10);
          const totalDue = Number(inst.total_due || 0);
          const paid = Number(inst.paid_amount || 0);
          let status;
          if (inst.status === 'Paid') status = 'Paid';
          else if (paid > 0) status = 'Partial';
          else if (key < todayStr) status = 'Unpaid';
          else status = 'Schedule';
          dateMap[key] = { status, amt: status === 'Paid' || status === 'Partial' ? paid : totalDue, total_due: totalDue, paid };
        });
        // Advance payments: transactions on dates that have no installment scheduled
        transactionsList.forEach(t => {
          const td = t.date || t.collection_date || t.deposit_date;
          if (!td) return;
          const key = td.slice(0, 10);
          if (!dateMap[key]) {
            dateMap[key] = { status: 'Advance', amt: Number(t.amt || t.amount || 0) };
          }
        });

        // Helper to get all days for selected month — backend driven
        const getCalendarDays = () => {
          if (beforeApproval) return [];
          const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
          const tempDays = [];
          for (let i = 1; i <= daysInMonth; i++) {
            const key = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            // Before account start_date → no cell content
            if (startDateStr && key < startDateStr) {
              tempDays.push({ day: i, status: null, amt: 0, empty: true });
              continue;
            }
            const entry = dateMap[key];
            if (entry) tempDays.push({ day: i, ...entry, dateStr: key, hasRecord: true });
            else tempDays.push({ day: i, status: 'Schedule', amt: 0, dateStr: key, hasRecord: false });
          }
          return tempDays;
        };

        const displayDays = getCalendarDays();
        const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay();
        const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

        return (
          <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 border-b border-[#F1F5F9] pb-3.5">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">Payment Calendar Ledger</h3>
                  <p className="text-[11px] text-[#64748B] font-semibold">
                    Repayment / Deposit checklist for {monthsList[selectedMonth]} {selectedYear}
                  </p>
                </div>
              </div>

              {/* Month/Year Combined Selection controls (Horizontal Left / Right Navigation) */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 p-1 rounded-xl shadow-xs select-none" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonth === 0) {
                      setSelectedMonth(11);
                      setSelectedYear(selectedYear - 1);
                    } else {
                      setSelectedMonth(selectedMonth - 1);
                    }
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-white active:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-[#1E3A8A] transition-all cursor-pointer border border-transparent hover:border-slate-100 hover:shadow-xs"
                >
                  <span className="material-symbols-rounded text-base font-bold">chevron_left</span>
                </button>
                
                <span className="text-[11px] font-black text-[#0F172A] px-3.5 min-w-[110px] text-center tracking-wide uppercase">
                  {monthsList[selectedMonth]} {selectedYear}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonth === 11) {
                      setSelectedMonth(0);
                      setSelectedYear(selectedYear + 1);
                    } else {
                      setSelectedMonth(selectedMonth + 1);
                    }
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-white active:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-[#1E3A8A] transition-all cursor-pointer border border-transparent hover:border-slate-100 hover:shadow-xs"
                >
                  <span className="material-symbols-rounded text-base font-bold">chevron_right</span>
                </button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2.5 text-[10px] font-bold text-[#64748B] flex-wrap">
                <span className="flex items-center gap-1 bg-[#16A34A]/5 px-2 py-1 rounded-md border border-[#16A34A]/10">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A]"></span> Paid
                </span>
                <span className="flex items-center gap-1 bg-[#E11D48]/5 px-2 py-1 rounded-md border border-[#E11D48]/10">
                  <span className="w-2 h-2 rounded-full bg-[#E11D48]"></span> Unpaid
                </span>
                <span className="flex items-center gap-1 bg-[#F59E0B]/5 px-2 py-1 rounded-md border border-[#F59E0B]/10">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span> Partial
                </span>
                <span className="flex items-center gap-1 bg-[#7C3AED]/5 px-2 py-1 rounded-md border border-[#7C3AED]/10">
                  <span className="w-2 h-2 rounded-full bg-[#7C3AED]"></span> Advance
                </span>
                <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] animate-pulse"></span> Schedule
                </span>
              </div>
            </div>

            {beforeApproval ? (
              <div className="py-10 text-center text-xs font-bold text-slate-500 bg-slate-50/40 border border-dashed border-slate-200 rounded-xl">
                <span className="material-symbols-rounded text-2xl select-none block mb-1.5 text-slate-400">event_busy</span>
                Account approved on <strong className="text-[#0F172A]">{new Date(account.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>. No EMI schedule before this date.
              </div>
            ) : (
            <>
            {/* Grid Calendar representation */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider mb-2">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
              <div>Sun</div>
            </div>

            <div className="grid grid-cols-7 gap-2.5">
              {/* Padding Offset Cells */}
              {Array.from({ length: startOffset }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-20 bg-slate-50/30 border border-dashed border-slate-100 rounded-xl"></div>
              ))}

              {displayDays.map((d, index) => {
                const isEmpty = d.empty || d.status === null;
                const isPaid = d.status === 'Paid';
                const isUnpaid = d.status === 'Unpaid';
                const isPartial = d.status === 'Partial';
                const isAdvance = d.status === 'Advance';
                const isSchedule = d.status === 'Schedule';
                const isToday = d.dateStr === todayStr;
                const isStart = d.dateStr === account.start_date;
                const isEnd = d.dateStr === (isLoan ? account.end_date : account.maturity_date);
                const isApproved = account.approved_at && d.dateStr === account.approved_at.slice(0, 10);

                if (isEmpty) {
                  return (
                    <div
                      key={index}
                      className="h-20 flex flex-col justify-start p-2 rounded-xl border border-dashed border-slate-100 bg-slate-50/40"
                    >
                      <span className="text-xs sm:text-sm md:text-base font-black text-slate-300">{d.day}</span>
                    </div>
                  );
                }

                return (
                    <div
                      key={index}
                      onClick={() => handleDayClick(d)}
                      className={`h-20 flex flex-col justify-between p-2 rounded-xl border relative group transition-all duration-150 shadow-2xs hover:shadow-xs cursor-pointer ${
                        isToday ? 'ring-2 ring-amber-500 border-amber-500 shadow-md z-10' : ''
                      } ${
                        isPaid ? 'bg-[#16A34A]/5 border-[#16A34A]/25 text-[#16A34A] hover:bg-[#16A34A]/10' :
                        isUnpaid ? 'bg-[#E11D48]/5 border-[#E11D48]/25 text-[#E11D48] hover:bg-[#E11D48]/10' :
                        isPartial ? 'bg-[#F59E0B]/5 border-[#F59E0B]/25 text-[#D97706] hover:bg-[#F59E0B]/10' :
                        isAdvance ? 'bg-[#7C3AED]/5 border-[#7C3AED]/25 text-[#7C3AED] hover:bg-[#7C3AED]/10' :
                        'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {/* Top Row: Date on left, icon indicator on right */}
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs sm:text-sm md:text-base font-black text-[#0F172A]">{d.day}</span>
                          {isToday && (
                            <span className="text-[7px] md:text-[8px] bg-amber-500 text-white font-extrabold px-1 py-0.5 rounded select-none uppercase tracking-wider scale-90">Today</span>
                          )}
                          {isStart && (
                            <span className="text-[7px] md:text-[8px] bg-[#16A34A] text-white font-extrabold px-1.5 py-0.5 rounded select-none uppercase tracking-wider scale-90">Start</span>
                          )}
                          {isApproved && (
                            <span className="text-[7px] md:text-[8px] bg-[#4F46E5] text-white font-extrabold px-1.5 py-0.5 rounded select-none uppercase tracking-wider scale-90">Approved</span>
                          )}
                          {isEnd && (
                            <span className="text-[7px] md:text-[8px] bg-[#E11D48] text-white font-extrabold px-1.5 py-0.5 rounded select-none uppercase tracking-wider scale-90">End</span>
                          )}
                        </div>
                        {isPaid && (
                          <span className="material-symbols-rounded text-xs sm:text-sm select-none text-[#16A34A]">check_circle</span>
                        )}
                        {isUnpaid && (
                          <span className="material-symbols-rounded text-xs sm:text-sm select-none text-[#E11D48]">cancel</span>
                        )}
                        {isPartial && (
                          <span className="material-symbols-rounded text-xs sm:text-sm select-none text-[#D97706]">adjust</span>
                        )}
                        {isAdvance && (
                          <span className="material-symbols-rounded text-xs sm:text-sm select-none text-[#7C3AED]">verified</span>
                        )}
                        {isSchedule && d.hasRecord && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse"></span>
                        )}
                      </div>

                      {/* Middle/Bottom: Display Amount */}
                      <div className="text-center w-full pb-0.5">
                        {isPartial ? (
                          <span className="text-xs sm:text-sm font-black block tracking-tight">
                            <span className="text-[#D97706]">₹{(d.amt || 0).toLocaleString()}</span>
                            <span className="text-slate-300 mx-0.5 sm:mx-1">/</span>
                            <span className="text-[#E11D48]">₹{Math.max(0, account.emiAmt - (d.amt || 0)).toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className={`text-xs sm:text-sm font-black block tracking-tight ${
                            isPaid ? 'text-[#16A34A]' :
                            isUnpaid ? 'text-[#E11D48]' :
                            isAdvance ? 'text-[#7C3AED]' :
                            'text-slate-500'
                          }`}>
                            {d.hasRecord ? `₹${(isUnpaid ? account.emiAmt : (d.amt || account.emiAmt)).toLocaleString()}` : ''}
                          </span>
                        )}
                      </div>

                    </div>
                );
              })}
            </div>
            </>
            )}
          </div>
        );
      })()}

      {/* Official Documents & Passbook Card (Horizontal below Calendar) */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
          <span className="material-symbols-rounded text-lg text-[#1E3A8A] select-none">verified_user</span>
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Account Documents & Passbook</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Passbook (All Accounts) */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-between space-y-2">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-base text-[#1E3A8A] select-none">book_5</span>
                  Account Passbook
                </span>
                <span className="bg-[#16A34A]/10 text-[#16A34A] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">Ready</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-1">Contains all transaction logs, interest details, and payment histories.</p>
            </div>
            <div className="flex gap-2 pt-2 flex-wrap sm:flex-nowrap">
              <button 
                onClick={() => alert(`Downloading Passbook PDF for Account: ${account.accNo}...`)}
                className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-rounded text-sm">download</span>
                PDF
              </button>
              <button 
                onClick={() => window.print()}
                className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-rounded text-sm">print</span>
                Print
              </button>
              <button 
                onClick={() => window.open(`https://api.whatsapp.com/send?text=Hello, sharing my Passbook for Account ${account.accNo}`)}
                className="flex-1 py-1.5 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-rounded text-sm flex items-center justify-center gap-0.5"><img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-3 h-3 select-none filter invert brightness-200" alt="" /></span>
                WhatsApp
              </button>
            </div>
          </div>

          {/* 2. NOC Certificate (Loan Accounts) */}
          {account.type === 'Loan' && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-between space-y-2">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                    <span className="material-symbols-rounded text-base text-[#1E3A8A] select-none">assignment_turned_in</span>
                    NOC Certificate
                  </span>
                  {account.status === 'Closed' ? (
                    <span className="bg-[#16A34A]/10 text-[#16A34A] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">Issued</span>
                  ) : (
                    <span className="bg-[#EA580C]/10 text-[#EA580C] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">On Closure</span>
                  )}
                </div>
                <p className="text-[10px] text-[#64748B] mt-1">No Objection Certificate issued by Umbrella Finance upon full clearance.</p>
              </div>
              
              {account.status === 'Closed' ? (
                <div className="flex gap-2 pt-2 flex-wrap sm:flex-nowrap">
                  <button 
                    onClick={() => alert(`Downloading Loan NOC Certificate for Account: ${account.accNo}...`)}
                    className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-rounded text-sm">download</span>
                    PDF
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-rounded text-sm">print</span>
                    Print
                  </button>
                  <button 
                    onClick={() => window.open(`https://api.whatsapp.com/send?text=Hello, sharing my Loan NOC Certificate for Account ${account.accNo}`)}
                    className="flex-1 py-1.5 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-rounded text-sm flex items-center justify-center gap-0.5"><img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-3 h-3 select-none filter invert brightness-200" alt="" /></span>
                    WhatsApp
                  </button>
                </div>
              ) : (
                <div className="pt-2">
                  <button 
                    disabled
                    className="w-full py-1.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-lg cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-rounded text-sm">lock</span>
                    Locked (Available after Loan Closure)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Maturity Bond (Savings Accounts) */}
          {account.type === 'Saving' && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-between space-y-2">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                    <span className="material-symbols-rounded text-base text-[#1E3A8A] select-none">workspace_premium</span>
                    Savings Maturity Bond
                  </span>
                  <span className="bg-[#1E3A8A]/10 text-[#1E3A8A] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">Active</span>
                </div>
                <p className="text-[10px] text-[#64748B] mt-1">Official bond certificate declaring deposit terms, maturity date, and nominee details.</p>
              </div>
              <div className="flex gap-2 pt-2 flex-wrap sm:flex-nowrap">
                <button 
                  onClick={() => alert(`Downloading Savings Maturity Bond Certificate for Account: ${account.accNo}...`)}
                  className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-rounded text-sm">download</span>
                  PDF
                </button>
                <button 
                  onClick={() => window.print()}
                  className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-rounded text-sm">print</span>
                  Print
                </button>
                <button 
                  onClick={() => window.open(`https://api.whatsapp.com/send?text=Hello, sharing my Savings Maturity Bond Certificate for Account ${account.accNo}`)}
                  className="flex-1 py-1.5 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-rounded text-sm flex items-center justify-center gap-0.5"><img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-3 h-3 select-none filter invert brightness-200" alt="" /></span>
                  WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile, Guarantor/Nominee, and Tenure Progress Grid (Below Calendar & Documents) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Profile Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
          <div className="flex items-center gap-3.5 border-b border-[#F1F5F9] pb-4">
            <div className="w-12 h-12 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-black text-sm uppercase select-none">
              {(account.customer?.name || '').split(' ').filter(Boolean).map(n => n[0]).join('')}
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#0F172A]">{account.customer?.name || 'N/A'}</h4>
              <span className="text-[10px] text-[#64748B] font-bold tracking-wider block uppercase">{account.customer?.occupation || 'Business'}</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
              <span className="text-[#64748B]">Mobile Number</span>
              <span className="font-bold text-[#0F172A]">{account.customer.phone}</span>
            </div>
            <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
              <span className="text-[#64748B]">Aadhaar Card No</span>
              <span className="font-bold text-[#0F172A]">{account.customer.aadhaar}</span>
            </div>
            <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
              <span className="text-[#64748B]">PAN Card No</span>
              <span className="font-bold text-[#0F172A]">{account.customer.pan}</span>
            </div>
            <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
              <span className="text-[#64748B]">Monthly Income</span>
              <span className="font-bold text-[#16A34A]">{account.customer.monthlyIncome}</span>
            </div>
            <div>
              <span className="text-[#64748B] block mb-1">Residential Address</span>
              <p className="font-medium text-[#0F172A] leading-relaxed bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-100 text-[11px]">
                {account.customer.address}
              </p>
            </div>
            {/* Bank details block */}
            <div className="pt-3 border-t border-[#F1F5F9] space-y-1.5">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Bank Account Details</span>
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Bank Name</span>
                <span className="font-bold text-[#0F172A]">{account.customer.bank?.name || 'State Bank of India'}</span>
              </div>
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Account Number</span>
                <span className="font-bold text-[#0F172A]">{account.customer.bank?.accountNo || '30291049281'}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-[#64748B]">IFSC Code</span>
                <span className="font-bold text-[#0F172A]">{account.customer.bank?.ifsc || 'SBIN0001234'}</span>
              </div>
            </div>

            {/* Customer Documents */}
            <div className="pt-3 border-t border-[#F1F5F9] space-y-2">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Customer Documents</span>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-[#1E3A8A]">
                <a 
                  href="#view-aadhaar" 
                  onClick={(e) => { e.preventDefault(); alert("Opening Customer Aadhaar Card Front & Back..."); }}
                  className="flex items-center justify-center gap-1 p-2 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 border border-[#1E3A8A]/10 rounded-xl transition-all text-center"
                >
                  <span className="material-symbols-rounded text-sm select-none">badge</span>
                  Aadhaar
                </a>
                <a 
                  href="#view-pan" 
                  onClick={(e) => { e.preventDefault(); alert("Opening Customer PAN Card..."); }}
                  className="flex items-center justify-center gap-1 p-2 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 border border-[#1E3A8A]/10 rounded-xl transition-all text-center"
                >
                  <span className="material-symbols-rounded text-sm select-none">credit_card</span>
                  PAN
                </a>
                <a 
                  href="#view-cheque" 
                  onClick={(e) => { e.preventDefault(); alert("Opening Bank Cheque / Passbook..."); }}
                  className="flex items-center justify-center gap-1 p-2 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 border border-[#1E3A8A]/10 rounded-xl transition-all text-center"
                >
                  <span className="material-symbols-rounded text-sm select-none">payments</span>
                  Cheque
                </a>
              </div>
            </div>


          </div>
        </div>

        {/* Guarantor / Nominee Card */}
        {account.type === 'Loan' ? (
          /* Guarantor Details */
          <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3.5">
              <span className="material-symbols-rounded text-lg text-[#1E3A8A] select-none">supervisor_account</span>
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Loan Guarantor Profile</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Full Name</span>
                <span className="font-bold text-[#0F172A]">{account.guarantor.name}</span>
              </div>
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Phone Number</span>
                <span className="font-bold text-[#0F172A]">{account.guarantor.phone}</span>
              </div>
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Relationship</span>
                <span className="font-bold text-[#0F172A]">{account.guarantor.relation}</span>
              </div>
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Aadhaar Card No</span>
                <span className="font-bold text-[#0F172A]">{account.guarantor.aadhaar}</span>
              </div>
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Verified Income</span>
                <span className="font-bold text-[#16A34A]">{account.guarantor.income}</span>
              </div>
              <div>
                <span className="text-[#64748B] block mb-1">Guarantor Address</span>
                <p className="font-medium text-[#0F172A] leading-relaxed bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-100 text-[11px]">
                  {account.guarantor.address}
                </p>
              </div>
              {/* Guarantor Documents */}
              <div className="pt-3 border-t border-[#F1F5F9] space-y-2">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Guarantor Documents</span>
                <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-[#1E3A8A]">
                  <a 
                    href="#view-g-photo" 
                    onClick={(e) => { e.preventDefault(); alert("Opening Guarantor Photo..."); }}
                    className="flex items-center justify-center gap-1 p-2 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 border border-[#1E3A8A]/10 rounded-xl transition-all text-center"
                  >
                    <span className="material-symbols-rounded text-sm select-none">account_box</span>
                    Photo
                  </a>
                  <a 
                    href="#view-g-aadhaar-front" 
                    onClick={(e) => { e.preventDefault(); alert("Opening Guarantor Aadhaar Front..."); }}
                    className="flex items-center justify-center gap-1 p-2 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 border border-[#1E3A8A]/10 rounded-xl transition-all text-center"
                  >
                    <span className="material-symbols-rounded text-sm select-none">badge</span>
                    Aadhaar F
                  </a>
                  <a 
                    href="#view-g-aadhaar-back" 
                    onClick={(e) => { e.preventDefault(); alert("Opening Guarantor Aadhaar Back..."); }}
                    className="flex items-center justify-center gap-1 p-2 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 border border-[#1E3A8A]/10 rounded-xl transition-all text-center"
                  >
                    <span className="material-symbols-rounded text-sm select-none">badge</span>
                    Aadhaar B
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Nominee Details */
          <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3.5">
              <span className="material-symbols-rounded text-lg text-[#F59E0B] select-none">person_add</span>
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Savings Nominee Profile</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Nominee Name</span>
                <span className="font-bold text-[#0F172A]">{account.nominee.name}</span>
              </div>
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Phone Number</span>
                <span className="font-bold text-[#0F172A]">{account.nominee.phone}</span>
              </div>
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Relationship</span>
                <span className="font-bold text-[#0F172A]">{account.nominee.relation}</span>
              </div>
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Nominee Age</span>
                <span className="font-bold text-[#0F172A]">{account.nominee.age}</span>
              </div>
              <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                <span className="text-[#64748B]">Share Percentage</span>
                <span className="font-bold text-[#1E3A8A]">{account.nominee.share}</span>
              </div>
              {/* Nominee Documents */}
              <div className="pt-3 border-t border-[#F1F5F9] space-y-2">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Nominee Documents</span>
                <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-[#1E3A8A]">
                  <a 
                    href="#view-n-photo" 
                    onClick={(e) => { e.preventDefault(); alert("Opening Nominee Photo..."); }}
                    className="flex items-center justify-center gap-1 p-2 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 border border-[#1E3A8A]/10 rounded-xl transition-all text-center"
                  >
                    <span className="material-symbols-rounded text-sm select-none">account_box</span>
                    Photo
                  </a>
                  <a 
                    href="#view-n-aadhaar-front" 
                    onClick={(e) => { e.preventDefault(); alert("Opening Nominee Aadhaar Front..."); }}
                    className="flex items-center justify-center gap-1 p-2 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 border border-[#1E3A8A]/10 rounded-xl transition-all text-center"
                  >
                    <span className="material-symbols-rounded text-sm select-none">badge</span>
                    Aadhaar F
                  </a>
                  <a 
                    href="#view-n-aadhaar-back" 
                    onClick={(e) => { e.preventDefault(); alert("Opening Nominee Aadhaar Back..."); }}
                    className="flex items-center justify-center gap-1 p-2 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 border border-[#1E3A8A]/10 rounded-xl transition-all text-center"
                  >
                    <span className="material-symbols-rounded text-sm select-none">badge</span>
                    Aadhaar B
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Collection Progress Timeline */}
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">Tenure Progress</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[#64748B]">Progress Days</span>
                <span className="text-[#1E3A8A]">{account.paidDays} / {account.tenureDays} Days</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#1E3A8A] to-[#1E3A8A]/80 rounded-full" 
                  style={{ width: `${(account.paidDays / account.tenureDays) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[9px] text-[#64748B] font-semibold">
                <span>Start: {account.disbursalDate}</span>
                <span>Maturity Completion Target reached: {Math.round((account.paidDays / account.tenureDays) * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Collected vs Remaining Dues Donut Chart */}
          {(() => {
            const collected = account.totalPaid;
            const remaining = account.type === 'Loan' ? account.outstanding : Math.max(0, 36500 - account.totalPaid);
            const total = collected + remaining;
            
            const chartSeries = [collected, remaining];
            const chartOptions = {
              chart: {
                type: 'donut',
                animations: { enabled: true }
              },
              labels: [account.type === 'Loan' ? 'Collected' : 'Deposited', 'Remaining'],
              colors: [
                '#16A34A', // Green for paid/deposited
                '#E11D48' // Red for unpaid/remaining
              ],
              plotOptions: {
                pie: {
                  donut: {
                    size: '65%',
                    labels: {
                      show: true,
                      name: {
                        show: true,
                        fontSize: '9px',
                        fontWeight: 'bold',
                        color: '#64748B',
                        offsetY: -5
                      },
                      value: {
                        show: true,
                        fontSize: '12px',
                        fontWeight: '900',
                        color: '#0F172A',
                        offsetY: 5,
                        formatter: (val) => `₹${Number(val).toLocaleString()}`
                      },
                      total: {
                        show: true,
                        label: 'Total Dues',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        color: '#64748B',
                        formatter: () => `₹${total.toLocaleString()}`
                      }
                    }
                  }
                }
              },
              dataLabels: { enabled: false },
              legend: {
                show: true,
                position: 'bottom',
                horizontalAlign: 'center',
                fontSize: '10px',
                fontWeight: 'bold',
                markers: { radius: 12 },
                itemMargin: { horizontal: 5, vertical: 0 }
              },
              tooltip: {
                y: {
                  formatter: (val) => `₹${val.toLocaleString()}`
                }
              }
            };
            return (
              <div className="py-1 h-[155px] w-full flex items-center justify-center">
                <Chart key={`${collected}-${remaining}`} options={chartOptions} series={chartSeries} type="donut" height={150} width="100%" />
              </div>
            );
          })()}
          
          <div className="pt-4 border-t border-slate-100 space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Account Status Summary</span>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className={`w-2.5 h-2.5 rounded-full ${account.status === 'Active' ? 'bg-[#16A34A]' : 'bg-[#64748B]'}`}></span>
              <span>Account is currently {account.status.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Transaction Ledger (Full Width) */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-sm font-extrabold text-[#0F172A]">Detailed Transaction Ledger</h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* WhatsApp Share Button */}
            <button
              onClick={handleWhatsAppShare}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs select-none"
            >
              <svg className="w-3.5 h-3.5 fill-[#25D366]" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
              </svg>
              WhatsApp Share
            </button>
            {/* Excel Export Button */}
            <button
              onClick={handleExcelExport}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs select-none"
            >
              <span className="material-symbols-rounded text-sm text-[#107C41] select-none font-bold">download</span>
              Excel Export
            </button>
            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs select-none"
            >
              <span className="material-symbols-rounded text-sm text-slate-500 select-none font-bold">print</span>
              Print
            </button>
          </div>
        </div>
        <div className="overflow-x-auto -mx-6">
          <table className="min-w-full divide-y divide-[#E2E8F0]">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Reference No</th>
                <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Payment Type</th>
                <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Amount Paid</th>
                <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Late Fine / Charges</th>
                <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Collected By</th>
                <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-[#0F172A]">
              {(account.ledger || []).map((row) => (
                <tr key={row.id || row.refNo || Math.random()} className="hover:bg-slate-50/50 transition-colors">
                  <td className="whitespace-nowrap px-6 py-3.5 text-[#64748B]">{row.date}</td>
                  <td className="whitespace-nowrap px-6 py-3.5 font-bold">{row.refNo}</td>
                  <td className="whitespace-nowrap px-6 py-3.5">{row.type}</td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-[#16A34A] font-bold">₹{row.amt.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-[#E11D48]">₹{row.fine.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-[#64748B]">{row.collector}</td>
                  <td className="whitespace-nowrap px-6 py-3.5">
                    {(userRole === 'Super Admin' || userRole === 'Admin') && (
                      <button
                        onClick={() => handleResetCollection(row.refNo)}
                        className="text-[#E11D48] hover:text-[#BE123C] font-bold hover:underline cursor-pointer flex items-center gap-1"
                        title="Delete/Reset this collection"
                      >
                        <span className="material-symbols-rounded text-sm">delete</span>
                        Reset
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    {/* Closure Modal Dialog Overlay */}
    {isCloseModalOpen && (
      <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-5 animate-scale-up">
          {/* Modal Header */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-[#0F172A] flex items-center gap-1.5">
              <span className="material-symbols-rounded text-lg text-[#1E3A8A] select-none">
                {account.type === 'Loan' ? 'cancel_presentation' : 'auto_awesome'}
              </span>
              {account.type === 'Loan' ? 'Close Loan Account' : 'Savings Maturity Closure'}
            </h3>
            <button 
              onClick={() => setIsCloseModalOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <span className="material-symbols-rounded text-base">close</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="space-y-4 text-xs text-[#0F172A]">
            <div className="p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl space-y-2">
              <div className="flex justify-between font-bold text-slate-500">
                <span>Account Number</span>
                <span className="text-[#0F172A]">{account.accNo}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-500">
                <span>Customer Name</span>
                <span className="text-[#0F172A]">{account.customer.name}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-500">
                <span>Account Type</span>
                <span className="text-[#1E3A8A]">{account.type}</span>
              </div>
            </div>

            {account.type === 'Loan' ? (
              // Loan Close details
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 block">Principal Outstanding (₹)</label>
                    <input 
                      type="number"
                      value={closePrincipal}
                      onChange={(e) => setClosePrincipal(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 block">Late Fine / Charges (₹)</label>
                    <input 
                      type="number"
                      value={closeInterestFine}
                      onChange={(e) => setCloseInterestFine(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#E11D48] focus:outline-none focus:border-[#1E3A8A]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 block">Waiver / Discount (₹)</label>
                  <input 
                    type="number"
                    value={closeDiscountCharges}
                    onChange={(e) => setCloseDiscountCharges(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#16A34A] focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>

                <div className="flex justify-between items-center p-3 bg-red-50/50 border border-red-100 rounded-xl">
                  <span className="font-bold text-[#0F172A]">Net Settlement Amount:</span>
                  <span className="text-sm font-black text-[#E11D48]">
                    ₹{((Number(closePrincipal) + Number(closeInterestFine)) - Number(closeDiscountCharges)).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1">
                  <Select 
                    label="Payment Settlement Mode"
                    value={closePayMode} 
                    onChange={(val) => setClosePayMode(val)}
                    options={loanPayOptions}
                    searchable={false}
                  />
                </div>
              </div>
            ) : (
              // Savings Maturity details
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 block">Deposited Principal (₹)</label>
                    <input 
                      type="number"
                      value={closePrincipal}
                      onChange={(e) => setClosePrincipal(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 block">Interest Payout (₹)</label>
                    <input 
                      type="number"
                      value={closeInterestFine}
                      onChange={(e) => setCloseInterestFine(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#16A34A] focus:outline-none focus:border-[#1E3A8A]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 block">Penalty / Pre-closure Charges (₹)</label>
                  <input 
                    type="number"
                    value={closeDiscountCharges}
                    onChange={(e) => setCloseDiscountCharges(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#E11D48] focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>

                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex justify-between items-center">
                  <span className="font-bold text-[#0F172A]">Net Payout Amount:</span>
                  <span className="text-sm font-black text-[#16A34A]">
                    ₹{((Number(closePrincipal) + Number(closeInterestFine)) - Number(closeDiscountCharges)).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1">
                  <Select 
                    label="Payout Mode"
                    value={closePayMode} 
                    onChange={(val) => setClosePayMode(val)}
                    options={savingsPayOptions}
                    searchable={false}
                  />
                </div>
              </div>
            )}

            {/* Checkbox confirmation */}
            <label className="flex items-start gap-2.5 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={confirmClosure}
                onChange={(e) => setConfirmClosure(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]" 
              />
              <span className="text-[11px] font-semibold text-slate-600 leading-tight">
                {account.type === 'Loan' 
                  ? "Confirm that the customer has settled all due payments, interest, and late charges, and is eligible for the NOC Certificate." 
                  : "Confirm that the maturity deposit amount with interest has been successfully calculated and processed for payout to the customer/nominee."
                }
              </span>
            </label>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button 
              onClick={() => setIsCloseModalOpen(false)}
              className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center"
            >
              Cancel
            </button>
            <button 
              onClick={handleCloseAccount}
              disabled={!confirmClosure}
              className={`flex-1 py-2.5 text-xs font-bold text-white rounded-xl transition-all text-center shadow-sm ${
                confirmClosure 
                  ? (account.type === 'Loan' ? 'bg-[#E11D48] hover:bg-[#E11D48]/90 cursor-pointer' : 'bg-[#EA580C] hover:bg-[#EA580C]/90 cursor-pointer')
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {account.type === 'Loan' ? 'Settle & Close Loan' : 'Process Payout & Close'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Collection Entry Popup Modal */}
    {isCollectModalOpen && selectedDayObj && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setIsCollectModalOpen(false)}>
        <div 
          className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md p-5 space-y-3 animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex justify-between items-center border-b border-[#F1F5F9] pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-base text-[#1E3A8A] select-none">payments</span>
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Payment Collection Entry
              </h3>
            </div>
            <button 
              onClick={() => setIsCollectModalOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
            >
              <span className="material-symbols-rounded text-sm select-none">close</span>
            </button>
          </div>

          {/* Dues Summary block (Ultra compact) */}
          <div className="bg-slate-50/80 p-3 border border-slate-100 rounded-xl space-y-1 animate-fade-in text-xs">
            <div className="grid grid-cols-2 gap-y-1">
              <div className="flex justify-between pr-2 border-r border-slate-200">
                <span className="text-slate-500">Account No:</span>
                <span className="font-bold text-[#0F172A]">{account.accNo}</span>
              </div>
              <div className="flex justify-between pl-2">
                <span className="text-slate-500">Selected Date:</span>
                <span className="font-bold text-[#0F172A]">
                  {String(selectedDayObj.day).padStart(2, '0')}-
                  {String(selectedMonth + 1).padStart(2, '0')}-
                  {selectedYear}
                </span>
              </div>
              <div className="flex justify-between pr-2 border-r border-slate-200">
                <span className="text-slate-500">Current Status:</span>
                <span className={`font-extrabold uppercase text-[9px] px-1.5 py-0.5 rounded ${
                  selectedDayObj.status === 'Paid' ? 'bg-[#16A34A]/10 text-[#16A34A]' :
                  selectedDayObj.status === 'Unpaid' ? 'bg-[#E11D48]/10 text-[#E11D48]' :
                  selectedDayObj.status === 'Partial' ? 'bg-[#F59E0B]/10 text-[#D97706]' :
                  selectedDayObj.status === 'Advance' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {selectedDayObj.status}
                </span>
              </div>
              <div className="flex justify-between pl-2">
                <span className="text-slate-500">Collector:</span>
                <span className="font-bold text-[#0F172A]">Sandeep Kumar</span>
              </div>
            </div>

            {/* Dues Breakdown section */}
            <div className="border-t border-slate-200/60 pt-1.5 mt-1.5 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Previous Dues:</span>
                <span className={`font-bold ${collectPrevDues > 0 ? 'text-[#E11D48]' : 'text-slate-600'}`}>
                  ₹{collectPrevDues.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Today's Due:</span>
                <span className={`font-bold ${collectTodayDue > 0 ? 'text-[#E11D48]' : 'text-slate-600'}`}>
                  ₹{collectTodayDue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t border-dashed border-slate-200 pt-1 mt-1 text-xs font-black">
                <span className="text-[#0F172A]">Total Outstanding Dues:</span>
                <span className="text-[#1E3A8A]">
                  ₹{collectTotalDue.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Range & Allocation Notice */}
            <div className="border-t border-slate-200/60 pt-2 mt-1.5 space-y-1">
              {collectTotalDue > 0 ? (
                <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-blue-700 font-bold leading-normal">
                  <span className="material-symbols-rounded text-xs align-middle mr-1">calendar_month</span>
                  Collecting for range: <strong className="underline">{earliestUnpaidDate ? new Date(earliestUnpaidDate).toLocaleDateString('en-IN') : 'N/A'}</strong> to <strong className="underline">{`${selectedDayObj.day}/${selectedMonth + 1}/${selectedYear}`}</strong>
                  <br />
                  <span className="text-[9px] text-blue-600/85 font-medium block mt-0.5">
                    Payments will be allocated sequentially (FIFO). Extra payment will cover future dues.
                  </span>
                </div>
              ) : (
                <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg text-[10px] text-amber-700 font-bold leading-normal">
                  <span className="material-symbols-rounded text-xs align-middle mr-1">info</span>
                  No dues pending up to selected date. Payment will be registered as <strong className="underline">Advance Payment</strong>.
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleCollectSubmit} className="space-y-3">
            {/* Side-by-side grid of Collection Amount and Late Charges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-500 text-[10px] block uppercase tracking-wide">Collection Amount (₹)</label>
                <input 
                  type="number"
                  value={collectAmt}
                  onChange={(e) => setCollectAmt(Number(e.target.value))}
                  className="w-full h-11 px-3 bg-white border-2 border-[#1E3A8A] rounded-xl text-sm font-black text-[#16A34A] ring-2 ring-[#1E3A8A]/10 focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500 text-[10px] block uppercase tracking-wide">Late Charges / Fine (₹)</label>
                <input 
                  type="number"
                  value={collectFine}
                  onChange={(e) => setCollectFine(Number(e.target.value))}
                  className="w-full h-11 px-3 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#E11D48] focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Select 
                label="Payment Mode"
                value={collectPayMode} 
                onChange={(val) => setCollectPayMode(val)}
                options={loanPayOptions}
                searchable={false}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setIsCollectModalOpen(false)}
                className="flex-1 h-11 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center flex items-center justify-center"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 h-11 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center"
              >
                Collect Payment
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Account Approval Modal */}
    {isApproveModalOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setIsApproveModalOpen(false)}>
        <div 
          className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md p-5 space-y-4 animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center border-b border-[#F1F5F9] pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-base text-[#16A34A] select-none">check_circle</span>
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Approve & Start Account
              </h3>
            </div>
            <button 
              onClick={() => setIsApproveModalOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
            >
              <span className="material-symbols-rounded text-sm select-none">close</span>
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-[#64748B] leading-relaxed">
              Are you sure you want to approve account <strong>{account.accNo}</strong>? Please select the Account Opening Date and Approved Date.
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
                onClick={() => setIsApproveModalOpen(false)}
                className="flex-1 h-11 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center flex items-center justify-center"
              >
                Cancel
              </button>
              <button 
                onClick={handleApproveAccount}
                className="flex-1 h-11 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1.5"
              >
                Confirm & Approve
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Reset to Processing Confirmation Modal */}
    {isResetModalOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setIsResetModalOpen(false)}>
        <div 
          className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-sm p-6 space-y-4 animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 text-[#E11D48]">
            <div className="w-10 h-10 rounded-full bg-[#E11D48]/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-rounded">warning</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Reset Account Status</h3>
              <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Double Confirmation Required</p>
            </div>
          </div>

          <p className="text-xs text-[#64748B] leading-relaxed">
            Are you absolutely sure you want to reset account <strong className="text-[#0F172A]">{account?.accNo}</strong> back to <strong className="text-[#2563EB]">Processing</strong> state? This will clear all approval dates, mature schedules, and allow re-evaluation.
          </p>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="flex-1 h-11 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center flex items-center justify-center"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                handleResetToProcessing();
                setIsResetModalOpen(false);
              }}
              className="flex-1 h-11 bg-[#E11D48] hover:bg-[#E11D48]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1.5"
            >
              Confirm Reset
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Clear Ledger Modal */}
    {isClearLedgerModalOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setIsClearLedgerModalOpen(false)}>
        <div 
          className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md p-5 space-y-4 animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center border-b border-[#F1F5F9] pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-base text-[#DC2626] select-none">warning</span>
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Clear Payment Ledger
              </h3>
            </div>
            <button 
              onClick={() => setIsClearLedgerModalOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
            >
              <span className="material-symbols-rounded text-sm select-none">close</span>
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-[#64748B] leading-relaxed">
              Are you sure you want to clear the entire payment ledger for this account? <strong className="text-[#DC2626]">This action cannot be undone.</strong> Clearing the ledger will unlock the account status, allowing you to reset it to Processing status.
            </p>

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setIsClearLedgerModalOpen(false)}
                className="flex-1 h-11 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center flex items-center justify-center"
              >
                Cancel
              </button>
              <button 
                onClick={handleClearLedger}
                className="flex-1 h-11 bg-[#DC2626] hover:bg-[#DC2626]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1.5"
              >
                Clear All Payments
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
