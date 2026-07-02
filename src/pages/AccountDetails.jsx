import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import Chart from 'react-apexcharts';
import { loanApi, savingApi, customerApi, collectionApi, planApi, settingsApi, fundApi } from '../services/api';

const getDaysInYear = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
};

const getActualDays = (startDateStr, durationVal, durationUnit) => {
  const start = startDateStr ? new Date(startDateStr) : new Date();
  const dur = Number(durationVal) || 0;
  if (isNaN(start.getTime())) {
    if (durationUnit === 'Months') return Math.round(dur * 30.44);
    if (durationUnit === 'Years') return Math.round(dur * 365.24);
    return dur;
  }
  const end = new Date(start);
  if (durationUnit === 'Days') {
    return dur;
  } else if (durationUnit === 'Months') {
    const expectedMonth = (start.getMonth() + dur) % 12;
    end.setMonth(start.getMonth() + dur);
    if (end.getMonth() !== expectedMonth) {
      end.setDate(0);
    }
  } else if (durationUnit === 'Years') {
    end.setFullYear(start.getFullYear() + dur);
  }
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const calculateCustomEmi = (principal, rate, durationVal, durationUnit, frequency, interestType, loanPeriod = 'monthly', startDate) => {
  if (!principal || !rate || !durationVal) return '';

  let totalDays = 0;
  let totalMonths = 0;
  if (durationUnit === 'Days') {
    totalDays = durationVal;
    totalMonths = durationVal / 30.4375;
  } else if (durationUnit === 'Months') {
    totalDays = getActualDays(startDate, durationVal, 'Months');
    totalMonths = durationVal;
  } else if (durationUnit === 'Years') {
    totalDays = getActualDays(startDate, durationVal, 'Years');
    totalMonths = durationVal * 12;
  }

  let N = 0;
  if (frequency === 'Daily') {
    N = Math.round(totalDays);
  } else if (frequency === 'Weekly') {
    N = Math.round(totalDays / 7);
  } else if (frequency === 'Monthly') {
    N = Math.round(totalMonths);
  }
  if (N <= 0) N = 1;

  if (interestType === 'Flat') {
    const timeFactor = loanPeriod === 'yearly' ? (totalMonths / 12) : totalMonths;
    const interest = principal * (rate / 100) * timeFactor;
    const totalPayable = principal + interest;
    return Math.round(totalPayable / N);
  } else {
    let R = 0;
    const daysInYear = getDaysInYear(startDate);
    if (frequency === 'Daily') {
      R = loanPeriod === 'yearly' ? ((rate / 100) / daysInYear) : (((rate / 100) * 12) / daysInYear);
    } else if (frequency === 'Weekly') {
      R = loanPeriod === 'yearly' ? ((rate / 100) / 52) : (((rate / 100) * 12) / 52);
    } else if (frequency === 'Monthly') {
      R = loanPeriod === 'yearly' ? ((rate / 100) / 12) : (rate / 100);
    }

    if (R === 0) return Math.round(principal / N);

    const onePlusRToN = Math.pow(1 + R, N);
    const emi = (principal * R * onePlusRToN) / (onePlusRToN - 1);
    return isNaN(emi) || !isFinite(emi) ? Math.round(principal / N) : Math.round(emi);
  }
};

const calculateCustomMaturity = (depositAmt, rate, durationVal, durationUnit, frequency, startDate) => {
  const dAmt = parseFloat(depositAmt) || 0;
  const rVal = parseFloat(rate) || 0;
  const dur = parseFloat(durationVal) || 0;
  if (!dAmt || !dur) return '';

  let totalDays = 0;
  let totalMonths = 0;
  if (durationUnit === 'Days') {
    totalDays = dur;
    totalMonths = dur / 30.4375;
  } else if (durationUnit === 'Months') {
    totalDays = getActualDays(startDate, dur, 'Months');
    totalMonths = dur;
  } else if (durationUnit === 'Years') {
    totalDays = getActualDays(startDate, dur, 'Years');
    totalMonths = dur * 12;
  }

  let instPerYear = 0;
  if (frequency === 'Daily') {
    instPerYear = getDaysInYear(startDate);
  } else if (frequency === 'Weekly') {
    instPerYear = 52;
  } else if (frequency === 'Monthly') {
    instPerYear = 12;
  }

  let totalInstallments = 0;
  if (frequency === 'Daily') {
    totalInstallments = Math.round(totalDays);
  } else if (frequency === 'Weekly') {
    totalInstallments = Math.round(totalDays / 7);
  } else if (frequency === 'Monthly') {
    totalInstallments = Math.round(totalMonths);
  }
  if (totalInstallments <= 0) totalInstallments = 1;

  const fullYears = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  let balance = 0;
  let remainingInstallments = totalInstallments;

  // Process full years
  for (let i = 0; i < fullYears; i++) {
    const installmentsThisYear = Math.min(instPerYear, remainingInstallments);
    remainingInstallments -= installmentsThisYear;

    const principalAdded = dAmt * installmentsThisYear;
    const interestOnNew = principalAdded * (rVal / 100);
    const interestOnBalance = balance * (rVal / 100);

    balance = balance + interestOnBalance + principalAdded + interestOnNew;
  }

  // Process remaining fractional year
  if (remainingMonths > 0 && remainingInstallments > 0) {
    const fracYear = remainingMonths / 12;
    const principalAdded = dAmt * remainingInstallments;
    const interestOnNew = principalAdded * (rVal / 100) * fracYear;
    const interestOnBalance = balance * (rVal / 100) * fracYear;

    balance = balance + interestOnBalance + principalAdded + interestOnNew;
  }

  return Math.round(balance);
};

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
            const currAddrObj = (custData.addresses || []).find(a => a.address_type === 'Current');
            const currentAddr = currAddrObj
              ? `${currAddrObj.address_line1}${currAddrObj.address_line2 ? ', ' + currAddrObj.address_line2 : ''}, ${currAddrObj.city}, ${currAddrObj.state} - ${currAddrObj.pincode}`
              : null;
            
            accData.customer = {
              name: custData.full_name || 'N/A',
              occupation: custData.occupation || 'Business',
              phone: custData.mobile || 'N/A',
              alternatePhone: custData.alternate_mobile || 'N/A',
              dob: custData.dob ? new Date(custData.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
              gender: custData.gender || 'N/A',
              fatherOrHusbandName: custData.father_or_husband_name || 'N/A',
              aadhaar: custData.kyc?.aadhaar_no || 'N/A',
              pan: custData.kyc?.pan_no || 'N/A',
              monthlyIncome: custData.monthly_income ? `₹${Number(custData.monthly_income).toLocaleString('en-IN')}` : '₹0',
              address: fullAddr,
              currentAddress: currentAddr,
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

            // Build customer accounts list
            const accountsList = [];
            const loans = custData.loans || custData.loan_accounts || [];
            const savings = custData.savings || custData.saving_accounts || [];
            loans.forEach(la => {
              accountsList.push({
                accNo: la.loan_account_no,
                type: 'Loan',
                status: la.account_status || la.status
              });
            });
            savings.forEach(sa => {
              accountsList.push({
                accNo: sa.saving_account_no,
                type: 'Saving',
                status: sa.saving_account_status || sa.status
              });
            });
            setCustomerAccounts(accountsList);
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
  const [expandedInstallments, setExpandedInstallments] = useState({});
  const toggleInstallments = (refNo) => {
    setExpandedInstallments(prev => ({
      ...prev,
      [refNo]: !prev[refNo]
    }));
  };
  

  // Account approval / reset states
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvalStartDate, setApprovalStartDate] = useState('');
  const [approvalDate, setApprovalDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isClearLedgerModalOpen, setIsClearLedgerModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  
  const userRole = localStorage.getItem('userRole') || localStorage.getItem('active_user_role') || '';

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closePayMode, setClosePayMode] = useState('Cash');
  const [confirmClosure, setConfirmClosure] = useState(false);

  // Flexible closure inputs state
  const [closePrincipal, setClosePrincipal] = useState(0);
  const [closeInterestFine, setCloseInterestFine] = useState(0);
  const [closeDiscountCharges, setCloseDiscountCharges] = useState(0);
  const [closeDate, setCloseDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [closeRemarks, setCloseRemarks] = useState('Loan Settlement');
  const [isNocModalOpen, setIsNocModalOpen] = useState(false);
  const [isPassbookModalOpen, setIsPassbookModalOpen] = useState(false);
  const [isBondModalOpen, setIsBondModalOpen] = useState(false);
  const [termsSavings, setTermsSavings] = useState([]);
  const [termsLoan, setTermsLoan] = useState([]);

  // Add Account Switcher and Creator States
  const [customerAccounts, setCustomerAccounts] = useState([]);
  const [isAddLoanModalOpen, setIsAddLoanModalOpen] = useState(false);
  const [isAddSavingModalOpen, setIsAddSavingModalOpen] = useState(false);
  const [loanPlans, setLoanPlans] = useState([]);
  const [savingPlans, setSavingPlans] = useState([]);
  const [availableLoanFund, setAvailableLoanFund] = useState(0);
  const [loanForm, setLoanForm] = useState({
    loan_plan_id: '',
    principal_amount: '',
    interest_rate: '',
    interest_type: 'Flat',
    duration_value: '',
    duration_unit: 'Days',
    collection_frequency: 'Daily',
    emi_amount: '',
    processing_fee: '0',
    penalty_per_day: '0',
    start_date: new Date().toLocaleDateString('sv-SE')
  });
  const [savingForm, setSavingForm] = useState({
    saving_plan_id: '',
    deposit_amount: '',
    interest_rate: '',
    duration_value: '',
    duration_unit: 'Days',
    collection_frequency: 'Daily',
    maturity_amount: '',
    start_date: new Date().toLocaleDateString('sv-SE')
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoTab, setInfoTab] = useState('profile');
  const [liveSettings, setLiveSettings] = useState({});

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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [hoveredReceipt, setHoveredReceipt] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    refNo: '',
    amount: '',
    penalty: '0',
    payment_mode: 'Cash',
    date: '',
    remarks: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);


  // Live calculations for Custom Loan
  useEffect(() => {
    if (loanForm.loan_plan_id === 'custom') {
      const calculatedEmi = calculateCustomEmi(
        Number(loanForm.principal_amount) || 0,
        Number(loanForm.interest_rate) || 0,
        Number(loanForm.duration_value) || 0,
        loanForm.duration_unit,
        loanForm.collection_frequency,
        loanForm.interest_type,
        liveSettings.interest_calculation_period_loan || 'monthly',
        loanForm.start_date
      );
      setLoanForm(prev => ({ ...prev, emi_amount: String(calculatedEmi) }));
    }
  }, [
    loanForm.loan_plan_id,
    loanForm.principal_amount,
    loanForm.interest_rate,
    loanForm.duration_value,
    loanForm.duration_unit,
    loanForm.collection_frequency,
    loanForm.interest_type,
    loanForm.start_date,
    liveSettings
  ]);

  // Live calculations for Custom Savings
  useEffect(() => {
    if (savingForm.saving_plan_id === 'custom') {
      const calculatedMaturity = calculateCustomMaturity(
        Number(savingForm.deposit_amount) || 0,
        Number(savingForm.interest_rate) || 0,
        Number(savingForm.duration_value) || 0,
        savingForm.duration_unit,
        savingForm.collection_frequency,
        savingForm.start_date
      );
      setSavingForm(prev => ({ ...prev, maturity_amount: String(calculatedMaturity) }));
    }
  }, [
    savingForm.saving_plan_id,
    savingForm.deposit_amount,
    savingForm.interest_rate,
    savingForm.duration_value,
    savingForm.duration_unit,
    savingForm.collection_frequency,
    savingForm.start_date
  ]);

  // Derived plan details for review card
  const selectedLoanPlanObj = loanForm.loan_plan_id === 'custom'
    ? {
        name: 'Custom Loan Plan',
        min_amount: Number(loanForm.principal_amount) || 0,
        interest_rate: Number(loanForm.interest_rate) || 0,
        interest_type: loanForm.interest_type || 'Flat',
        duration_value: Number(loanForm.duration_value) || 0,
        duration_unit: loanForm.duration_unit || 'Days',
        collection_frequency: loanForm.collection_frequency || 'Daily',
        emi_amount: Number(loanForm.emi_amount) || 0,
        processing_fee: Number(loanForm.processing_fee) || 0,
        penalty_per_day: Number(loanForm.penalty_per_day) || 0
      }
    : loanPlans.find(p => String(p.id) === String(loanForm.loan_plan_id)) || null;

  const selectedSavingPlanObj = savingForm.saving_plan_id === 'custom'
    ? {
        name: 'Custom Savings Plan',
        deposit_amount: Number(savingForm.deposit_amount) || 0,
        interest_rate: Number(savingForm.interest_rate) || 0,
        duration_value: Number(savingForm.duration_value) || 0,
        duration_unit: savingForm.duration_unit || 'Days',
        collection_frequency: savingForm.collection_frequency || 'Daily',
        maturity_amount: Number(savingForm.maturity_amount) || 0
      }
    : savingPlans.find(p => String(p.id) === String(savingForm.saving_plan_id)) || null;

  useEffect(() => {
    planApi.loanPlans.list().then(res => setLoanPlans(res.data || [])).catch(() => {});
    planApi.savingPlans.list().then(res => setSavingPlans(res.data || [])).catch(() => {});
    settingsApi.get()
      .then(res => {
        setTermsSavings(res.data?.terms_savings || []);
        setTermsLoan(res.data?.terms_loan || []);
        setLiveSettings(res.data || {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAccount();
    fetchStatement();
    setConfirmClosure(false);
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
  }, [accNo, fetchAccount, fetchStatement]);

  useEffect(() => {
    if (account) {
      const normalizedAccNo = account.loan_account_no || account.saving_account_no || accNo;
      const customerName = account.customer?.name || account.customer?.full_name || '';
      window.activePageTitle = customerName ? `${customerName} (${normalizedAccNo})` : `Account: ${normalizedAccNo}`;
      window.dispatchEvent(new Event('titlechange'));
    }
    return () => {
      window.activePageTitle = '';
      window.dispatchEvent(new Event('titlechange'));
    };
  }, [account, accNo]);

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
  account.nextDueDate = account.next_due_date
    ? new Date(account.next_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : (account.account_status === 'Closed' ? 'Closed' : (isLoan ? (account.end_date || 'N/A') : (account.maturity_date || 'N/A')));

  account.disbursalDate = account.start_date || 'N/A';
  const startVal = account.start_date ? new Date(account.start_date) : new Date();
  const todayVal = new Date();
  const diffTimeVal = Math.max(0, todayVal - startVal);
  const diffDaysVal = Math.floor(diffTimeVal / (1000 * 60 * 60 * 24));
  account.paidDays = account.account_status === 'Closed'
    ? (account.tenureDays || 0)
    : Math.min(diffDaysVal, account.tenureDays || 365);

  account.status = account.account_status || account.status || 'Pending';

  // Fallback for customer object to prevent crashes if loading fails or during transitions
  account.customer = account.customer || {
    name: account.customer_name || 'N/A',
    occupation: account.occupation || 'Business',
    phone: account.customer_mobile || 'N/A',
    alternatePhone: 'N/A',
    dob: 'N/A',
    gender: 'N/A',
    fatherOrHusbandName: 'N/A',
    aadhaar: 'N/A',
    pan: 'N/A',
    monthlyIncome: '₹0',
    address: 'N/A',
    currentAddress: null,
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

  const handleAddLoan = (e) => {
    e.preventDefault();
    if (!loanForm.loan_plan_id) {
      alert("Please select a plan.");
      return;
    }
    if (loanForm.loan_plan_id === 'custom') {
      if (!loanForm.principal_amount || !loanForm.interest_rate || !loanForm.duration_value || !loanForm.emi_amount) {
        alert("Please fill in all custom loan details (Amount, Rate, Duration, EMI).");
        return;
      }
    } else {
      if (!loanForm.principal_amount) {
        alert("Please enter a principal amount.");
        return;
      }
    }

    setIsSubmitting(true);
    const payload = {
      customer_id: account.customer_id,
      loan_plan_id: loanForm.loan_plan_id,
      principal_amount: parseFloat(loanForm.principal_amount),
      interest_rate: loanForm.loan_plan_id === 'custom' ? parseFloat(loanForm.interest_rate) : undefined,
      interest_type: loanForm.loan_plan_id === 'custom' ? loanForm.interest_type : undefined,
      duration_value: loanForm.loan_plan_id === 'custom' ? parseInt(loanForm.duration_value) : undefined,
      duration_unit: loanForm.loan_plan_id === 'custom' ? loanForm.duration_unit : undefined,
      collection_frequency: loanForm.loan_plan_id === 'custom' ? loanForm.collection_frequency : undefined,
      emi_amount: loanForm.loan_plan_id === 'custom' ? parseFloat(loanForm.emi_amount) : undefined,
      processing_fee: loanForm.loan_plan_id === 'custom' ? parseFloat(loanForm.processing_fee) : undefined,
      penalty_amount: loanForm.loan_plan_id === 'custom' ? parseFloat(loanForm.penalty_per_day) : undefined,
      start_date: loanForm.start_date
    };

    loanApi.create(payload)
      .then((res) => {
        alert(`Loan application created successfully under Acc No: ${res.data.account_no || res.data.loan_account_no}. Awaiting approval.`);
        setIsAddLoanModalOpen(false);
        setLoanForm({
          loan_plan_id: '',
          principal_amount: '',
          interest_rate: '',
          interest_type: 'Flat',
          duration_value: '',
          duration_unit: 'Days',
          collection_frequency: 'Daily',
          emi_amount: '',
          processing_fee: '0',
          penalty_per_day: '0',
          start_date: new Date().toLocaleDateString('sv-SE')
        });
        fetchAccount();
      })
      .catch(err => {
        alert(err.message || 'Failed to apply for loan.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleAddSaving = (e) => {
    e.preventDefault();
    if (!savingForm.saving_plan_id) {
      alert("Please select a plan.");
      return;
    }
    if (savingForm.saving_plan_id === 'custom') {
      if (!savingForm.deposit_amount || !savingForm.interest_rate || !savingForm.duration_value || !savingForm.maturity_amount) {
        alert("Please fill in all custom savings details (Deposit, Rate, Duration, Maturity).");
        return;
      }
    }

    setIsSubmitting(true);
    const payload = {
      customer_id: account.customer_id,
      saving_plan_id: savingForm.saving_plan_id,
      deposit_amount: parseFloat(savingForm.deposit_amount),
      interest_rate: parseFloat(savingForm.interest_rate),
      duration_value: savingForm.saving_plan_id === 'custom' ? parseInt(savingForm.duration_value) : undefined,
      duration_unit: savingForm.saving_plan_id === 'custom' ? savingForm.duration_unit : undefined,
      collection_frequency: savingForm.saving_plan_id === 'custom' ? savingForm.collection_frequency : undefined,
      maturity_amount: parseFloat(savingForm.maturity_amount),
      start_date: savingForm.start_date
    };

    savingApi.create(payload)
      .then((res) => {
        alert(`Savings account application created successfully under Acc No: ${res.data.account_no || res.data.saving_account_no}. Awaiting approval.`);
        setIsAddSavingModalOpen(false);
        setSavingForm({
          saving_plan_id: '',
          deposit_amount: '',
          interest_rate: '',
          duration_value: '',
          duration_unit: 'Days',
          collection_frequency: 'Daily',
          maturity_amount: '',
          start_date: new Date().toLocaleDateString('sv-SE')
        });
        fetchAccount();
      })
      .catch(err => {
        alert(err.message || 'Failed to apply for savings.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
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

  const handleOpenUpdateModal = (row) => {
    setUpdateForm({
      refNo: row.refNo,
      amount: row.amt.toString(),
      penalty: row.fine.toString(),
      payment_mode: row.paymentMode || 'Cash',
      date: row.date,
      remarks: row.remarks || ''
    });
    setIsUpdateModalOpen(true);
  };

  const handleUpdateCollection = (e) => {
    e.preventDefault();
    if (!updateForm.amount || parseFloat(updateForm.amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    
    setIsUpdating(true);
    collectionApi.updateCollection(updateForm.refNo, {
      amount: parseFloat(updateForm.amount),
      penalty: parseFloat(updateForm.penalty || 0),
      payment_mode: updateForm.payment_mode,
      date: updateForm.date,
      remarks: updateForm.remarks
    })
      .then(() => {
        alert("Collection updated successfully.");
        setIsUpdateModalOpen(false);
        fetchAccount();
        fetchStatement();
      })
      .catch(err => alert(err.message || 'Update failed.'))
      .finally(() => setIsUpdating(false));
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
    setCloseDate(new Date().toLocaleDateString('sv-SE'));
    setCloseRemarks('Loan Settlement');
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
      ? loanApi.close(accNo, {
          close_date: closeDate,
          settlement_amount: Math.max(0, (Number(closePrincipal) + Number(closeInterestFine)) - Number(closeDiscountCharges)),
          waiver_amount: Number(closeDiscountCharges),
          payment_mode: closePayMode,
          remarks: closeRemarks
        })
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
    const accStatus = account.account_status || account.status;
    if (accStatus === 'Closed') {
      alert("This account is Closed. No further payments can be collected.");
      return;
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const clickedDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayObj.day).padStart(2, '0')}`;

    if (clickedDateStr > todayStr) {
      alert("Collections cannot be recorded on a future date. To make an advance payment, record it on the current or past date.");
      return;
    }

    const installments = statementData.installments || [];
    const emiAmt = Number(account.emi_amount || account.emiAmt || account.installment_amount || 0);

    setSelectedDayObj(dayObj);
    
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
    const txList = account.ledger || [];
    const customerName = account.customer?.name || 'N/A';
    const customerPhone = account.customer?.phone || 'N/A';
    const accNumber = account.accNo;
    const accType = account.type;
    const status = account.status;
    const emi = account.emiAmt;
    const totalPaid = account.totalPaid;
    const outstanding = account.outstanding;
    const principal = account.approvedAmt;
    const interest = account.interestRate;
    const tenure = account.tenureDays;

    let text = `*Umbrella Finance - Financial Statement Summary*\n\n`;
    text += `*Customer Details:*\n`;
    text += `Name: ${customerName}\n`;
    text += `Phone: ${customerPhone}\n\n`;
    
    text += `*Account Summary:*\n`;
    text += `Account No: ${accNumber}\n`;
    text += `Type: ${accType}\n`;
    text += `Status: ${status}\n`;
    text += `Plan Rate: ${interest}\n`;
    text += `Tenure: ${tenure} Days\n`;
    text += `Installment / EMI: ₹${emi.toLocaleString('en-IN')}\n`;
    if (isLoan) {
      text += `Principal Amount: ₹${principal.toLocaleString('en-IN')}\n`;
      text += `Total Paid: ₹${totalPaid.toLocaleString('en-IN')}\n`;
      text += `Outstanding Balance: ₹${outstanding.toLocaleString('en-IN')}\n`;
    } else {
      text += `Total Deposited: ₹${totalPaid.toLocaleString('en-IN')}\n`;
    }
    text += `\n*Recent Transactions:*\n`;

    if (txList.length === 0) {
      text += `No transactions recorded yet.\n`;
    } else {
      txList.slice(0, 5).forEach((row, i) => {
        text += `${i + 1}. ${row.date} - ${row.refNo}\n`;
        text += `   Amt: ₹${row.amt.toLocaleString('en-IN')} | Fine: ₹${row.fine.toLocaleString('en-IN')}\n`;
        text += `   Mode: ${row.paymentMode || 'Cash'} | Collector: ${row.collector || 'N/A'}\n`;
      });
    }

    text += `\nThank you for banking with Umbrella Finance!\n`;
    text += `_For any queries, please contact your branch manager._`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleExcelExport = () => {
    const txList = account.ledger || [];
    const customerName = account.customer?.name || 'N/A';
    const customerPhone = account.customer?.phone || 'N/A';
    const accNumber = account.accNo;
    const accType = account.type;
    const status = account.status;
    const emi = account.emiAmt;
    const totalPaid = account.totalPaid;
    const outstanding = account.outstanding;
    const principal = account.approvedAmt;
    const interest = account.interestRate;
    const tenure = account.tenureDays;

    const csvRows = [];
    csvRows.push(['UMBRELLA FINANCE - FINANCIAL STATEMENT']);
    csvRows.push(['Account Statement for: ' + customerName]);
    csvRows.push([]);
    
    csvRows.push(['Customer Name', customerName]);
    csvRows.push(['Phone Number', customerPhone]);
    csvRows.push(['Account Number', accNumber]);
    csvRows.push(['Account Type', accType]);
    csvRows.push(['Account Status', status]);
    csvRows.push(['Interest Rate / Plan', interest]);
    csvRows.push(['Tenure', tenure + ' Days']);
    csvRows.push(['Installment Amount (INR)', emi]);
    if (isLoan) {
      csvRows.push(['Principal Amount (INR)', principal]);
      csvRows.push(['Total Paid (INR)', totalPaid]);
      csvRows.push(['Outstanding Balance (INR)', outstanding]);
    } else {
      csvRows.push(['Total Deposited (INR)', totalPaid]);
    }
    csvRows.push([]);
    csvRows.push([]);

    csvRows.push(['Date', 'Reference No', 'Payment Type', 'Amount Paid (INR)', 'Late Fine / Charges (INR)', 'Payment Mode', 'Collector', 'Remarks']);

    txList.forEach(row => {
      csvRows.push([
        row.date,
        row.refNo,
        row.type,
        row.amt,
        row.fine,
        row.paymentMode || 'Cash',
        row.collector || '',
        row.remarks || ''
      ]);
    });

    const escapeCsvValue = (val) => {
      if (val === null || val === undefined) return '';
      const stringVal = String(val);
      if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
        return '"' + stringVal.replace(/"/g, '""') + '"';
      }
      return stringVal;
    };

    const csvContent = csvRows.map(row => row.map(escapeCsvValue).join(',')).join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Statement_${accNumber}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const customerName = account.customer?.name || 'N/A';
    const customerPhone = account.customer?.phone || 'N/A';
    const accNumber = account.accNo;
    const accType = account.type;
    const status = account.status;
    const emi = account.emiAmt;
    const totalPaid = account.totalPaid;
    const outstanding = account.outstanding;
    const principal = account.approvedAmt;
    const interest = account.interestRate;
    const tenure = account.tenureDays;
    const disbursalDate = account.disbursalDate;
    const txList = account.ledger || [];

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print the statement.");
      return;
    }

    const html = `
      <html>
        <head>
          <title>Account Statement - ${accNumber}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 40px;
              font-size: 12px;
              line-height: 1.5;
            }
            .header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.5px;
            }
            .header p {
              margin: 4px 0 0 0;
              font-size: 10px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }
            .meta-section {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 16px;
            }
            .meta-section h3 {
              margin: 0 0 12px 0;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 6px;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
            }
            .meta-row:last-child {
              margin-bottom: 0;
            }
            .meta-label {
              font-weight: 600;
              color: #64748b;
            }
            .meta-value {
              font-weight: 700;
              color: #0f172a;
            }
            .ledger-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .ledger-table th {
              background: #f8fafc;
              border-bottom: 2px solid #e2e8f0;
              font-weight: 800;
              text-transform: uppercase;
              font-size: 9px;
              color: #475569;
              letter-spacing: 0.5px;
              text-align: left;
              padding: 10px 12px;
            }
            .ledger-table td {
              border-bottom: 1px solid #e2e8f0;
              padding: 10px 12px;
              font-size: 11px;
            }
            .ledger-table tr:hover {
              background: #f8fafc;
            }
            .text-right {
              text-align: right !important;
            }
            .amount-positive {
              color: #16a34a;
              font-weight: 700;
            }
            .amount-negative {
              color: #dc2626;
              font-weight: 700;
            }
            .footer {
              margin-top: 50px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
              text-align: center;
              font-size: 9px;
              color: #94a3b8;
              font-weight: 600;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>UMBRELLA FINANCE</h1>
              <p>Chhote Kadam, Bade Sapne</p>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a;">ACCOUNT STATEMENT</h2>
              <p>Statement Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-section">
              <h3>Customer Details</h3>
              <div class="meta-row">
                <span class="meta-label">Customer Name:</span>
                <span class="meta-value">${customerName}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Phone Number:</span>
                <span class="meta-value">${customerPhone}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Account No:</span>
                <span class="meta-value">${accNumber}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Disbursal Date:</span>
                <span class="meta-value">${disbursalDate !== 'N/A' ? new Date(disbursalDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span>
              </div>
            </div>

            <div class="meta-section">
              <h3>Financial Summary</h3>
              <div class="meta-row">
                <span class="meta-label">Account Status:</span>
                <span class="meta-value" style="color: ${status === 'Active' ? '#16a34a' : '#dc2626'}">${status}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Interest Rate / Plan:</span>
                <span class="meta-value">${interest} (${accType})</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">EMI / Deposit Amount:</span>
                <span class="meta-value">₹${Number(emi).toLocaleString('en-IN')}</span>
              </div>
              ${accType === 'Loan' ? `
                <div class="meta-row">
                  <span class="meta-label">Principal Amount:</span>
                  <span class="meta-value">₹${Number(principal).toLocaleString('en-IN')}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Total Paid to Date:</span>
                  <span class="meta-value" style="color: #16a34a;">₹${Number(totalPaid).toLocaleString('en-IN')}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Outstanding Balance:</span>
                  <span class="meta-value" style="color: #dc2626;">₹${Number(outstanding).toLocaleString('en-IN')}</span>
                </div>
              ` : `
                <div class="meta-row">
                  <span class="meta-label">Total Deposited:</span>
                  <span class="meta-value" style="color: #16a34a;">₹${Number(totalPaid).toLocaleString('en-IN')}</span>
                </div>
              `}
            </div>
          </div>

          <h2 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin: 30px 0 10px 0; border-bottom: 1px solid #0f172a; padding-bottom: 6px;">
            Transaction History
          </h2>
          <table class="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference No</th>
                <th>Payment Type</th>
                <th>Payment Mode</th>
                <th>Collector</th>
                <th class="text-right">Late Fine (₹)</th>
                <th class="text-right">Amount Paid (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${txList.length === 0 ? `
                <tr>
                  <td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">No transaction records found.</td>
                </tr>
              ` : txList.map(row => `
                <tr>
                  <td>${new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td style="font-weight: 700;">${row.refNo}</td>
                  <td>${row.type}</td>
                  <td>${row.paymentMode || 'Cash'}</td>
                  <td>${row.collector || 'N/A'}</td>
                  <td class="text-right amount-negative">${Number(row.fine) > 0 ? '₹' + Number(row.fine).toLocaleString('en-IN') : '₹0'}</td>
                  <td class="text-right amount-positive">₹${Number(row.amt).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            This is a computer-generated account statement and does not require a physical signature.<br>
            Umbrella Finance - Head Office: Umbrella Plaza, New Delhi.
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const installmentsListForClose = statementData.installments || [];
  let totalPrincipalForClose = 0;
  let totalInterestForClose = 0;
  let paidPrincipalForClose = 0;
  let paidInterestForClose = 0;

  installmentsListForClose.forEach(inst => {
    const pComp = Number(inst.principal_component || 0);
    const iComp = Number(inst.interest_component || 0);
    const tot = pComp + iComp;
    const paid = Number(inst.paid_amount || 0);
    
    totalPrincipalForClose += pComp;
    totalInterestForClose += iComp;

    if (tot > 0) {
      const ratio = paid / tot;
      paidPrincipalForClose += pComp * ratio;
      paidInterestForClose += iComp * ratio;
    }
  });

  const remainingPrincipalForClose = Math.max(0, totalPrincipalForClose - paidPrincipalForClose);
  const remainingInterestForClose = Math.max(0, totalInterestForClose - paidInterestForClose);

  const accStatus = account.status;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-bold text-[#0A3598] hover:underline cursor-pointer"
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
              account.type === 'Loan' ? 'bg-[#0A3598]/10 text-[#0A3598]' : 'bg-[#FFC107]/10 text-[#D97706]'
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

          {/* Compact Horizontal Account Lifecycle Stepper */}
          <div className="mt-4 max-w-xl w-full bg-slate-50/50 p-3 rounded-2xl border border-slate-100 select-none">
            {/* Circles & Lines Row */}
            <div className="flex items-center w-full relative px-1">
              {/* Step 1 */}
              <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-[9px] ring-2 ring-blue-100 z-10 shrink-0">
                1
              </div>

              {/* Connector Line 1 */}
              <div className={`h-[2px] flex-1 z-0 -mx-0.5 ${account.status === 'Rejected' ? 'bg-[#DC2626]' : account.approved_at ? 'bg-[#16A34A]' : 'bg-slate-200'}`}></div>

              {/* Step 2 */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] z-10 shrink-0 ${
                account.status === 'Rejected'
                  ? 'bg-[#DC2626] text-white ring-2 ring-rose-100'
                  : account.approved_at 
                    ? 'bg-[#16A34A] text-white ring-2 ring-emerald-100' 
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}>
                2
              </div>

              {account.status !== 'Rejected' && (
                <>
                  {/* Connector Line 2 */}
                  <div className={`h-[2px] flex-1 z-0 -mx-0.5 ${account.approved_at ? 'bg-[#3B82F6]' : 'bg-slate-200'}`}></div>

                  {/* Step 3 */}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] z-10 shrink-0 ${
                    account.approved_at 
                      ? 'bg-[#3B82F6] text-white ring-2 ring-blue-100' 
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}>
                    3
                  </div>

                  {/* Connector Line 3 */}
                  <div className={`h-[2px] flex-1 z-0 -mx-0.5 ${account.status === 'Closed' ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

                  {/* Step 4 */}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] z-10 shrink-0 ${
                    account.status === 'Closed' 
                      ? 'bg-slate-700 text-white ring-2 ring-slate-100' 
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}>
                    4
                  </div>
                </>
              )}
            </div>

            {/* Labels Row */}
            <div className="flex justify-between w-full mt-1.5 text-center text-slate-500 font-bold text-[8px] leading-tight">
              <div className="w-12 -ml-2.5 flex flex-col items-center shrink-0">
                <span className="uppercase text-[7.5px]">Regd</span>
                <span className="text-[#0F172A] font-extrabold mt-0.5">
                  {account.created_at ? new Date(account.created_at).toLocaleDateString('en-IN') : 'N/A'}
                </span>
              </div>
              <div className="w-16 flex flex-col items-center shrink-0">
                <span className="uppercase text-[7.5px]">{account.status === 'Rejected' ? 'Rejected' : 'Approved'}</span>
                <span className="text-[#0F172A] font-extrabold mt-0.5">
                  {account.status === 'Rejected' 
                    ? 'Rejected' 
                    : account.approved_at 
                      ? new Date(account.approved_at).toLocaleDateString('en-IN') 
                      : 'Awaiting'}
                </span>
              </div>
              {account.status !== 'Rejected' && (
                <>
                  <div className="w-16 flex flex-col items-center shrink-0">
                    <span className="uppercase text-[7.5px]">End Date</span>
                    <span className="text-[#0F172A] font-extrabold mt-0.5">
                      {account.approved_at 
                        ? new Date(account.type === 'Loan' ? account.end_date : account.maturity_date).toLocaleDateString('en-IN') 
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="w-12 -mr-2.5 flex flex-col items-center shrink-0">
                    <span className="uppercase text-[7.5px]">Status</span>
                    <span className="text-[#0F172A] font-extrabold mt-0.5">{account.status === 'Closed' ? 'Closed' : 'Active'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {['Approved', 'Active', 'Defaulter', 'NPA'].includes(accStatus) ? (
            <>
              <Link
                to={`/collection?search=${account.accNo}`}
                className="px-4 py-2 bg-[#0A3598] text-white hover:bg-[#0A3598]/90 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
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
                  className="px-4 py-2 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 hover:brightness-95 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #FFD54A 0%, #FBBF24 35%, #F59E0B 70%, #E67E00 100%)' }}
                >
                  <span className="material-symbols-rounded text-sm select-none">workspace_premium</span>
                  Maturity Close
                </button>
              )}
            </>
          ) : (accStatus === 'Closed' || accStatus === 'Account Closed') ? (
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

      {/* Customer Portfolio Switcher & Account Creator (Above Financial Summaries) */}
      <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2 w-full">
          <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider select-none">
            Linked Accounts:
          </span>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
            {customerAccounts.map(acc => {
              const isActive = acc.accNo === account.accNo;
              return (
                <Link
                  key={acc.accNo}
                  to={`/account/${acc.accNo}`}
                  className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold border transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto ${
                    isActive
                      ? 'bg-[#0A3598] border-[#0A3598] text-white shadow-xs'
                      : 'bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-rounded text-sm shrink-0">
                    {acc.type === 'Loan' ? 'payments' : 'savings'}
                  </span>
                  <span className="truncate">{acc.accNo} ({acc.type})</span>
                  {acc.status === 'Closed' && (
                    <span className="text-[8px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-extrabold uppercase shrink-0">Closed</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:items-center shrink-0">
          <button
            onClick={() => setIsAddLoanModalOpen(true)}
            className="px-4 py-2.5 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-rounded text-sm">add_circle</span>
            Add Loan
          </button>
          <button
            onClick={() => setIsAddSavingModalOpen(true)}
            className="px-4 py-2.5 text-white text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 hover:brightness-95 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #FFD54A 0%, #FBBF24 35%, #F59E0B 70%, #E67E00 100%)' }}
          >
            <span className="material-symbols-rounded text-sm">add_circle</span>
            Add Savings
          </button>
        </div>
      </div>

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
              <strong className="text-base font-black text-[#0A3598] mt-1 block">₹{account.disbursedAmt.toLocaleString()}</strong>
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
              <span className="text-[9px] text-[#D97706] font-semibold block mt-0.5">Next: {account.nextDueDate}</span>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Total Deposited</span>
              <strong className="text-base font-black text-[#0A3598] mt-1 block">₹{account.totalPaid.toLocaleString()}</strong>
              <span className="text-[9px] text-[#64748B] block mt-0.5">Goal: ₹{account.emiAmt}/day</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Interest Rate</span>
              <strong className="text-base font-black text-[#16A34A] mt-1 block">{account.interestRate}</strong>
              <span className="text-[9px] text-[#64748B] block mt-0.5">Compound p.a.</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Maturity Target</span>
              <strong className="text-base font-black text-[#D97706] mt-1 block">₹36,500</strong>
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

        const isClosed = account.account_status === 'Closed';
        const dateMap = {};
        installmentsList.forEach(inst => {
          if (!inst.due_date) return;
          const key = inst.due_date.slice(0, 10);
          const totalDue = Number(inst.total_due || 0);
          const paid = Number(inst.paid_amount || 0);
          const isSettledInst = (inst.remarks && (inst.remarks.includes('Waived') || inst.remarks.includes('closure')))
            || (isClosed && inst.status !== 'Paid');
          let status;
          if (isSettledInst) {
            status = 'Settled';
          } else if (inst.status === 'Paid') {
            status = (key > todayStr && !isClosed) ? 'Advance' : 'Paid';
          } else if (paid > 0) {
            status = (key > todayStr && !isClosed) ? 'Advance' : 'Partial';
          } else if (key < todayStr) {
            status = 'Unpaid';
          } else {
            status = 'Schedule';
          }
          const displayAmt = (status === 'Paid' || status === 'Partial' || status === 'Advance' || status === 'Settled') ? paid : totalDue;
          dateMap[key] = { status, amt: displayAmt, total_due: totalDue, paid };
        });
        // Advance payments: transactions on dates that have no installment scheduled
        transactionsList.forEach(t => {
          const td = t.date || t.collection_date || t.deposit_date;
          if (!td) return;
          const key = td.slice(0, 10);
          if (!dateMap[key]) {
            dateMap[key] = { status: isClosed ? 'Paid' : 'Advance', amt: Number(t.amt || t.amount || 0) };
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
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
            <style>{`
              .calendar-icon {
                font-size: 10px !important;
                width: 10px !important;
                height: 10px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              @media (min-width: 640px) {
                .calendar-icon {
                  font-size: 14px !important;
                  width: 14px !important;
                  height: 14px !important;
                }
              }
            `}</style>
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
              <div className="w-full max-w-[240px] mx-auto lg:mx-0 flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200/60 p-1 rounded-xl shadow-xs select-none" onClick={(e) => e.stopPropagation()}>
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
                  className="w-8 h-8 rounded-lg hover:bg-white active:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-[#0A3598] transition-all cursor-pointer border border-transparent hover:border-slate-100 hover:shadow-xs"
                >
                  <span className="material-symbols-rounded text-base font-bold">chevron_left</span>
                </button>
                
                <span className="text-xs font-black text-[#0F172A] uppercase tracking-wide">
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
                  className="w-8 h-8 rounded-lg hover:bg-white active:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-[#0A3598] transition-all cursor-pointer border border-transparent hover:border-slate-100 hover:shadow-xs"
                >
                  <span className="material-symbols-rounded text-base font-bold">chevron_right</span>
                </button>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2.5 text-[9px] sm:text-[10px] font-bold text-[#64748B] flex-wrap w-full lg:w-auto">
                <span className="flex items-center gap-1 bg-[#16A34A]/5 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md border border-[#16A34A]/10">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#16A34A]"></span> Paid
                </span>
                <span className="flex items-center gap-1 bg-[#E11D48]/5 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md border border-[#E11D48]/10">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#E11D48]"></span> Unpaid
                </span>
                <span className="flex items-center gap-1 bg-[#FFC107]/5 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md border border-[#FFC107]/10">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#FFC107]"></span> Partial
                </span>
                <span className="flex items-center gap-1 bg-[#7C3AED]/5 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md border border-[#7C3AED]/10">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#7C3AED]"></span> Advance
                </span>
                <span className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md border border-slate-100">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#3B82F6] animate-pulse"></span> Schedule
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

            <div className="grid grid-cols-7 gap-1 sm:gap-2.5">
              {/* Padding Offset Cells */}
              {Array.from({ length: startOffset }).map((_, idx) => (
                <div key={`empty-${idx}`} className="aspect-square h-auto sm:h-20 bg-slate-50/30 border border-dashed border-slate-100 rounded-xl"></div>
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
                const isClosedDate = account.closed_at && d.dateStr === account.closed_at.slice(0, 10);

                if (d.empty || d.status === null) {
                  return (
                    <div
                      key={index}
                      className="aspect-square h-auto sm:h-20 flex flex-col justify-start p-1 sm:p-2 rounded-xl border border-dashed border-slate-100 bg-slate-50/40"
                    >
                      <span className="text-[10px] sm:text-sm font-black text-slate-300">{d.day}</span>
                    </div>
                  );
                }

                const isSettled = d.status === 'Settled';

                return (
                    <div
                      key={index}
                      onClick={() => handleDayClick(d)}
                      className={`aspect-square h-auto sm:h-20 flex flex-col justify-between p-1 sm:p-2 rounded-xl border relative group transition-all duration-150 shadow-2xs hover:shadow-xs cursor-pointer ${
                        isClosedDate ? 'ring-2 ring-[#DC2626] border-[#DC2626] shadow-md z-10' : isToday ? 'ring-2 ring-amber-500 border-amber-500 shadow-md z-10' : ''
                      } ${
                        isPaid ? 'bg-[#16A34A]/5 border-[#16A34A]/25 text-[#16A34A] hover:bg-[#16A34A]/10' :
                        isSettled ? 'bg-[#6366F1]/5 border-[#6366F1]/25 text-[#6366F1] hover:bg-[#6366F1]/10' :
                        isUnpaid ? 'bg-[#E11D48]/5 border-[#E11D48]/25 text-[#E11D48] hover:bg-[#E11D48]/10' :
                        isPartial ? 'bg-[#FFC107]/5 border-[#FFC107]/25 text-[#D97706] hover:bg-[#FFC107]/10' :
                        isAdvance ? 'bg-[#7C3AED]/5 border-[#7C3AED]/25 text-[#7C3AED] hover:bg-[#7C3AED]/10' :
                        'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {/* Top Row: Date on left, icon indicator on right */}
                      <div className="flex justify-between items-center w-full min-h-[14px]">
                        {/* Left: Day Number */}
                        <span className="text-[10px] sm:text-xs font-black text-[#0F172A]">{d.day}</span>
                        
                        {/* Right: Badges & Status Icons */}
                        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                          {isToday && (
                            <span className="text-[6.5px] sm:text-[8px] bg-amber-500 text-white font-extrabold px-1 py-0.5 rounded select-none leading-none scale-90">
                              <span className="hidden sm:inline">Today</span>
                              <span className="sm:hidden">T</span>
                            </span>
                          )}
                          {isStart && (
                            <span className="text-[6.5px] sm:text-[8px] bg-[#16A34A] text-white font-extrabold px-1 py-0.5 rounded select-none leading-none scale-90">
                              <span className="hidden sm:inline">Start</span>
                              <span className="sm:hidden">S</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="text-[6.5px] sm:text-[8px] bg-[#4F46E5] text-white font-extrabold px-1 py-0.5 rounded select-none leading-none scale-90">
                              <span className="hidden sm:inline">Approved</span>
                              <span className="sm:hidden">A</span>
                            </span>
                          )}
                          {isEnd && (
                            <span className="text-[6.5px] sm:text-[8px] bg-[#E11D48] text-white font-extrabold px-1 py-0.5 rounded select-none leading-none scale-90">
                              <span className="hidden sm:inline">End</span>
                              <span className="sm:hidden">E</span>
                            </span>
                          )}
                          {isClosedDate && (
                            <span className="text-[6.5px] sm:text-[8px] bg-[#DC2626] text-white font-extrabold px-1 py-0.5 rounded select-none leading-none scale-90">
                              <span className="hidden sm:inline">Closed</span>
                              <span className="sm:hidden">C</span>
                            </span>
                          )}

                          {isPaid && (
                            <span className="material-symbols-rounded calendar-icon select-none text-[#16A34A] leading-none shrink-0">check_circle</span>
                          )}
                          {isSettled && (
                            <span className="material-symbols-rounded calendar-icon select-none text-[#6366F1] leading-none shrink-0">handshake</span>
                          )}
                          {isUnpaid && (
                            <span className="material-symbols-rounded calendar-icon select-none text-[#E11D48] leading-none shrink-0">cancel</span>
                          )}
                          {isPartial && (
                            <span className="material-symbols-rounded calendar-icon select-none text-[#D97706] leading-none shrink-0">adjust</span>
                          )}
                          {isAdvance && (
                            <span className="material-symbols-rounded calendar-icon select-none text-[#7C3AED] leading-none shrink-0">verified</span>
                          )}
                          {isSchedule && d.hasRecord && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse shrink-0"></span>
                          )}
                        </div>
                      </div>

                      {/* Middle/Bottom: Display Amount */}
                      <div className="text-center w-full pb-0.5">
                        {isSettled ? (
                          <span className="text-[8px] sm:text-xs font-black block tracking-wider text-[#6366F1] uppercase">
                            Settled
                          </span>
                        ) : isPartial ? (
                          <span className="text-[7.5px] sm:text-xs font-black block tracking-tight leading-none">
                            <span className="text-[#D97706]">₹{(d.amt || 0).toLocaleString()}</span>
                            <span className="text-slate-300 mx-0.5">/</span>
                            <span className="text-[#E11D48]">₹{Math.max(0, account.emiAmt - (d.amt || 0)).toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className={`text-[8.5px] sm:text-xs font-black block tracking-tight ${
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

      {/* Detailed Transaction Ledger (Full Width) */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-sm font-extrabold text-[#0F172A]">Detailed Transaction Ledger</h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* WhatsApp Share Button */}
            <button
              onClick={handleWhatsAppShare}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-[10px] sm:text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs select-none whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 fill-[#25D366] shrink-0" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
              </svg>
              WhatsApp
            </button>
            {/* Excel Export Button */}
            <button
              onClick={handleExcelExport}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-[10px] sm:text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs select-none whitespace-nowrap"
            >
              <span className="material-symbols-rounded text-sm text-[#107C41] select-none font-bold shrink-0">download</span>
              Excel
            </button>
            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-[10px] sm:text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs select-none whitespace-nowrap"
            >
              <span className="material-symbols-rounded text-sm text-slate-500 select-none font-bold shrink-0">print</span>
              Print
            </button>
          </div>
        </div>
        {/* Desktop Table (Hidden on Mobile) */}
        <div className="hidden lg:block overflow-x-auto -mx-6">
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
              {(account.ledger || []).map((row, index) => {
                let allocationText = '';
                let parsedAllocations = [];
                if (row.allocations) {
                  try {
                    const list = typeof row.allocations === 'string' ? JSON.parse(row.allocations) : row.allocations;
                    if (Array.isArray(list) && list.length > 0) {
                      parsedAllocations = list;
                      const regularAllocs = list.filter(a => a.due_date !== 'Advance');
                      const advanceAllocs = list.filter(a => a.due_date === 'Advance');
                      
                      const dates = regularAllocs.map(a => a.due_date).sort();
                      if (dates.length > 0) {
                        const minDate = new Date(dates[0]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        const maxDate = new Date(dates[dates.length - 1]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        
                        if (dates.length === 1) {
                          allocationText = `Covered: ${minDate}`;
                        } else {
                          allocationText = `Covered: ${minDate} - ${maxDate} (${dates.length} Days)`;
                        }
                      } else if (advanceAllocs.length > 0) {
                        allocationText = 'Covered: Advance Payment';
                      }
                    }
                  } catch (e) {
                    console.error("Failed to parse allocations", e);
                  }
                }

                const isAdvancePayment = Number(row.isAdvance) === 1 || 
                  parsedAllocations.some(alloc => alloc.due_date === 'Advance' || (alloc.due_date && alloc.due_date > row.date));

                return (
                  <tr key={row.id || row.refNo || Math.random()} className="hover:bg-slate-50/50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-3.5 text-[#64748B]">{row.date}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 font-bold">{row.refNo}</td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                        {row.type === 'Loan Settlement' ? (
                          <span className="bg-[#6366F1]/10 text-[#6366F1] text-[10px] font-extrabold px-2.5 py-0.5 rounded uppercase select-none tracking-wider">
                            Settlement
                          </span>
                        ) : (
                          row.type
                        )}
                        {isAdvancePayment && (
                          <span className="bg-[#7C3AED]/10 text-[#7C3AED] text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase select-none">
                            Advance
                          </span>
                        )}
                      </div>
                      {allocationText && (
                        <div 
                          className="inline-flex items-center"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltipPos({
                              top: rect.bottom,
                              left: rect.left + rect.width / 2
                            });
                            setHoveredReceipt(row.refNo);
                          }}
                          onMouseLeave={() => setHoveredReceipt(null)}
                        >
                          <div 
                            className="text-[10px] text-[#64748B] mt-0.5 cursor-help hover:text-[#0A3598] transition-colors flex items-center gap-0.5 select-none"
                          >
                            <span className="material-symbols-rounded text-xs select-none">info</span>
                            {allocationText}
                          </div>
                          
                          {/* Custom UI Themed Tooltip (Light Theme - Viewport Fixed to Prevent Clipping) */}
                          {hoveredReceipt === row.refNo && (
                            <div 
                              className="fixed z-[9999] pt-2 w-52 pointer-events-auto"
                              style={{
                                top: `${tooltipPos.top}px`,
                                left: `${tooltipPos.left}px`,
                                transform: 'translateX(-50%)'
                              }}
                            >
                              <div className="bg-white text-slate-800 text-[11px] rounded-xl shadow-xl border border-slate-200 p-3 select-none text-left relative">
                                <div className="font-extrabold text-slate-400 mb-2 border-b border-slate-100 pb-1.5 text-[9px] uppercase tracking-wider">
                                  Due Date Breakdowns
                                </div>
                                <div className="space-y-1.5 font-semibold max-h-48 overflow-y-auto pr-1">
                                  {parsedAllocations.map((a, i) => (
                                    <div key={i} className="flex justify-between items-center gap-3">
                                      <span className="text-slate-600">
                                        {a.due_date === 'Advance' 
                                          ? 'Advance Payment' 
                                          : new Date(a.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </span>
                                      <span className="font-extrabold text-[#0F172A]">
                                        ₹{Number(a.amount).toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {/* Tiny Arrow pointing up */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-white"></div>
                                {/* Tiny Arrow Shadow Border */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-[3px] border-4 border-transparent border-b-slate-200 -z-10"></div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-[#16A34A] font-bold">₹{row.amt.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-[#E11D48]">₹{row.fine.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-[#64748B]">{row.collector}</td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      {(userRole === 'Super Admin' || userRole === 'Admin') && (
                        index === 0 ? (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleOpenUpdateModal(row)}
                              className="text-[#3B82F6] hover:text-[#2563EB] font-bold hover:underline cursor-pointer flex items-center gap-1"
                              title="Update this collection's details"
                            >
                              <span className="material-symbols-rounded text-sm">edit</span>
                              Update
                            </button>
                            <button
                              onClick={() => handleResetCollection(row.refNo)}
                              className="text-[#E11D48] hover:text-[#BE123C] font-bold hover:underline cursor-pointer flex items-center gap-1"
                              title="Delete/Reset this collection"
                            >
                              <span className="material-symbols-rounded text-sm">delete</span>
                              Reset
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              disabled
                              className="text-slate-400 font-bold flex items-center gap-1 cursor-not-allowed select-none opacity-60"
                              title="Only the most recent transaction can be updated to prevent breaking the ledger order."
                            >
                              <span className="material-symbols-rounded text-sm">lock</span>
                              Update
                            </button>
                            <button
                              disabled
                              className="text-slate-400 font-bold flex items-center gap-1 cursor-not-allowed select-none opacity-60"
                              title="Only the most recent transaction can be reset to prevent breaking the ledger order."
                            >
                              <span className="material-symbols-rounded text-sm">lock</span>
                              Reset
                            </button>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Ledger Cards (No Horizontal Scroll, Hidden on Desktop) */}
        <div className="block lg:hidden space-y-3 px-4 -mx-6 mb-4">
          {(account.ledger || []).length === 0 ? (
            <div className="text-center py-8 text-xs text-[#64748B] font-bold">
              No transactions recorded yet.
            </div>
          ) : (account.ledger || []).map((row, index) => {
            let allocationText = '';
            let parsedAllocations = [];
            if (row.allocations) {
              try {
                const list = typeof row.allocations === 'string' ? JSON.parse(row.allocations) : row.allocations;
                if (Array.isArray(list) && list.length > 0) {
                  parsedAllocations = list;
                  const regularAllocs = list.filter(a => a.due_date !== 'Advance');
                  const advanceAllocs = list.filter(a => a.due_date === 'Advance');
                  
                  const dates = regularAllocs.map(a => a.due_date).sort();
                  if (dates.length > 0) {
                    const minDate = new Date(dates[0]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const maxDate = new Date(dates[dates.length - 1]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    
                    if (dates.length === 1) {
                      allocationText = `Covered: ${minDate}`;
                    } else {
                      allocationText = `Covered: ${minDate} - ${maxDate} (${dates.length} Days)`;
                    }
                  } else if (advanceAllocs.length > 0) {
                    allocationText = 'Covered: Advance Payment';
                  }
                }
              } catch (e) {
                console.error("Failed to parse allocations", e);
              }
            }

            const isAdvancePayment = Number(row.isAdvance) === 1 || 
              parsedAllocations.some(alloc => alloc.due_date === 'Advance' || (alloc.due_date && alloc.due_date > row.date));

            return (
              <div key={row.id || row.refNo || Math.random()} className="bg-white border border-[#E2E8F0] rounded-xl p-4.5 space-y-3.5 shadow-sm">
                {/* Header: Ref No & Date */}
                <div className="flex justify-between items-center border-b border-[#E2E8F0]/50 pb-2.5">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-[#0F172A] text-xs">{row.refNo}</span>
                    <span className="text-[10px] text-[#64748B] font-bold">{row.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {row.type === 'Loan Settlement' ? (
                      <span className="bg-[#6366F1]/10 text-[#6366F1] text-[8.5px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                        Settlement
                      </span>
                    ) : (
                      <>
                        <span className={`text-[8.5px] font-black px-2 py-0.5 rounded uppercase ${
                          isAdvancePayment ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isAdvancePayment ? 'Advance' : 'Regular'}
                        </span>
                        <span className="bg-[#0A3598]/10 text-[#0A3598] text-[8.5px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                          {row.payment_mode || 'Cash'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider block">Amount Paid</span>
                    <span className="text-[#16A34A] font-black text-xs">₹{Number(row.amt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider block">Fine / Charges</span>
                    <span className={Number(row.fine) > 0 ? "text-[#DC2626] font-bold text-xs" : "text-[#64748B] font-bold text-xs"}>
                      ₹{Number(row.fine || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider block">Collected By</span>
                    <span className="text-[#0F172A] font-extrabold">{row.collector || 'System'}</span>
                  </div>
                  
                  {parsedAllocations.length > 0 && (
                    <div className="col-span-2 space-y-1.5">
                      <button
                        onClick={() => toggleInstallments(row.refNo)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#F8FAFC] hover:bg-slate-100/80 border border-[#E2E8F0] rounded-lg text-[10px] font-bold text-[#64748B] transition-all cursor-pointer select-none"
                      >
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-rounded text-xs text-[#0A3598]">event_repeat</span>
                          View Installments ({parsedAllocations.length})
                        </span>
                        <span className={`material-symbols-rounded text-xs transition-transform duration-200 ${
                          expandedInstallments[row.refNo] ? 'rotate-180' : ''
                        }`}>
                          expand_more
                        </span>
                      </button>

                      {expandedInstallments[row.refNo] && (
                        <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0] space-y-1 font-bold text-[10px] animate-fade-in">
                          {parsedAllocations.map((a, i) => (
                            <div key={i} className="flex justify-between items-center text-slate-700">
                              <span>
                                {a.due_date === 'Advance' 
                                  ? 'Advance Payment' 
                                  : new Date(a.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              <span className="text-[#0F172A] font-extrabold">
                                ₹{Number(a.amount).toLocaleString('en-IN')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Void/Reset Actions */}
                {(userRole === 'Super Admin' || userRole === 'Admin') && (
                  <div className="border-t border-[#E2E8F0]/50 pt-2.5 flex justify-end gap-2">
                    {index === 0 ? (
                      <>
                        <button
                          onClick={() => handleOpenUpdateModal(row)}
                          className="px-3 py-1.5 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 text-[#2563EB] text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <span className="material-symbols-rounded text-xs select-none">edit</span>
                          Update
                        </button>
                        <button
                          onClick={() => handleResetCollection(row.refNo)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <span className="material-symbols-rounded text-xs select-none">delete</span>
                          Reset
                        </button>
                      </>
                    ) : (
                      <span className="text-[9px] text-[#64748B] font-semibold flex items-center gap-1 select-none opacity-60">
                        <span className="material-symbols-rounded text-xs">lock</span>
                        Locked (Older Txn)
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Official Documents & Passbook Card (Horizontal below Calendar) */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
          <span className="material-symbols-rounded text-lg text-[#0A3598] select-none">verified_user</span>
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Account Documents & Passbook</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Passbook (All Accounts) */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-between space-y-2">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-base text-[#0A3598] select-none">book_5</span>
                  Account Passbook
                </span>
                <span className="bg-[#16A34A]/10 text-[#16A34A] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">Ready</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-1">Contains all transaction logs, interest details, and payment histories.</p>
            </div>
            <div className="flex gap-2 pt-2 flex-wrap sm:flex-nowrap">
              <button 
                onClick={() => setIsPassbookModalOpen(true)}
                className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-rounded text-sm">visibility</span>
                View
              </button>
              <button 
                onClick={() => setIsPassbookModalOpen(true)}
                className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-rounded text-sm">print</span>
                Print
              </button>
              <button 
                onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hello, sharing my Passbook for Account ${account.accNo}`)}`)}
                className="flex-1 py-1.5 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
              >
                <svg className="w-3 h-3 fill-white shrink-0" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                </svg>
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
                    <span className="material-symbols-rounded text-base text-[#0A3598] select-none">assignment_turned_in</span>
                    NOC Certificate
                  </span>
                  {account.account_status === 'Closed' || account.status === 'Closed' ? (
                    <span className="bg-[#16A34A]/10 text-[#16A34A] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">Issued</span>
                  ) : (
                    <span className="bg-[#FFC107]/10 text-[#D97706] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">On Closure</span>
                  )}
                </div>
                <p className="text-[10px] text-[#64748B] mt-1">No Objection Certificate issued by Umbrella Finance upon full clearance.</p>
              </div>
              
              {account.account_status === 'Closed' || account.status === 'Closed' ? (
                <div className="flex gap-2 pt-2 flex-wrap sm:flex-nowrap">
                  <button 
                    onClick={() => setIsNocModalOpen(true)}
                    className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <span className="material-symbols-rounded text-sm">visibility</span>
                    View
                  </button>
                  <button 
                    onClick={() => setIsNocModalOpen(true)}
                    className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <span className="material-symbols-rounded text-sm">print</span>
                    Print
                  </button>
                  <button 
                    onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hello, I am sharing my Loan No Objection Certificate (NOC) for Account No: ${account.accNo} issued by Umbrella Finance. Status: Fully Settled & Closed.`)}`)}
                    className="flex-1 py-1.5 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <svg className="w-3 h-3 fill-white shrink-0" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                    </svg>
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
                    <span className="material-symbols-rounded text-base text-[#0A3598] select-none">workspace_premium</span>
                    Savings Maturity Bond
                  </span>
                  <span className="bg-[#0A3598]/10 text-[#0A3598] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">Active</span>
                </div>
                <p className="text-[10px] text-[#64748B] mt-1">Official bond certificate declaring deposit terms, maturity date, and nominee details.</p>
              </div>
              <div className="flex gap-2 pt-2 flex-wrap sm:flex-nowrap">
                <button 
                  onClick={() => setIsBondModalOpen(true)}
                  className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <span className="material-symbols-rounded text-sm">visibility</span>
                  View
                </button>
                <button 
                  onClick={() => setIsBondModalOpen(true)}
                  className="flex-1 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[10px] font-bold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <span className="material-symbols-rounded text-sm">print</span>
                  Print
                </button>
                <button 
                  onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hello, sharing my Savings Maturity Bond Certificate for Account ${account.accNo}`)}`)}
                  className="flex-1 py-1.5 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <svg className="w-3 h-3 fill-white shrink-0" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                  </svg>
                  WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile, Guarantor/Nominee, and Tenure Progress Grid (Below Calendar & Documents) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tabbed Info Card (Left & Middle spanned across 2/3 width) */}
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm md:col-span-2 flex flex-col space-y-6">
          {/* Tab Navigation header */}
          <div className="flex border-b border-[#E2E8F0] space-x-6 pb-0.5 shrink-0">
            <button
              onClick={() => setInfoTab('profile')}
              className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                infoTab === 'profile'
                  ? 'border-[#0A3598] text-[#0A3598]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <span className="material-symbols-rounded text-sm select-none">person</span>
              Customer Details
            </button>
            <button
              onClick={() => setInfoTab('guarantor_nominee')}
              className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                infoTab === 'guarantor_nominee'
                  ? 'border-[#0A3598] text-[#0A3598]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <span className="material-symbols-rounded text-sm select-none">
                {account.type === 'Loan' ? 'supervisor_account' : 'person_add'}
              </span>
              {account.type === 'Loan' ? 'Loan Guarantor Profile' : 'Savings Nominee Profile'}
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="flex-1">
            {infoTab === 'profile' ? (
              /* Customer Details Tab */
              <div className="space-y-6">
                <div className="flex items-center gap-3.5 border-b border-[#F1F5F9] pb-4">
                  <div className="w-12 h-12 rounded-full bg-[#0A3598] text-white flex items-center justify-center font-black text-sm uppercase select-none">
                    {(account.customer?.name || '').split(' ').filter(Boolean).map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#0F172A]">{account.customer?.name || 'N/A'}</h4>
                    <span className="text-[10px] text-[#64748B] font-bold tracking-wider block uppercase">{account.customer?.occupation || 'Business'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                    <span className="text-[#64748B]">Father / Husband Name</span>
                    <span className="font-bold text-[#0F172A]">{account.customer.fatherOrHusbandName}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                    <span className="text-[#64748B]">Date of Birth</span>
                    <span className="font-bold text-[#0F172A]">{account.customer.dob}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                    <span className="text-[#64748B]">Gender</span>
                    <span className="font-bold text-[#0F172A]">{account.customer.gender}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                    <span className="text-[#64748B]">Mobile Number</span>
                    <span className="font-bold text-[#0F172A]">{account.customer.phone}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                    <span className="text-[#64748B]">Alternate Mobile</span>
                    <span className="font-bold text-[#0F172A]">{account.customer.alternatePhone}</span>
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#F1F5F9]">
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Permanent Address</span>
                    <p className="font-medium text-[#0F172A] leading-relaxed bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-100 text-[11px]">
                      {account.customer.address}
                    </p>
                  </div>
                  {account.customer.currentAddress ? (
                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Current Address</span>
                      <p className="font-medium text-[#0F172A] leading-relaxed bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-100 text-[11px]">
                        {account.customer.currentAddress}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Current Address</span>
                      <p className="font-medium text-[#64748B] leading-relaxed bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-100 text-[11px] italic">
                        Same as Permanent Address
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[#F1F5F9]">
                  {/* Bank details block */}
                  <div className="space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Bank Account Details</span>
                    <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                      <span className="text-[#64748B]">Bank Name</span>
                      <span className="font-bold text-[#0F172A]">{account.customer.bank?.name || 'State Bank of India'}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#F8FAFC] pb-1.5">
                      <span className="text-[#64748B]">Account Number</span>
                      <span className="font-bold text-[#0F172A]">{account.customer.bank?.accountNo || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between pb-1">
                      <span className="text-[#64748B]">IFSC Code</span>
                      <span className="font-bold text-[#0F172A]">{account.customer.bank?.ifsc || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Customer Documents */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Customer Documents</span>
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-[#0A3598]">
                      <a 
                        href="#view-aadhaar" 
                        onClick={(e) => { e.preventDefault(); alert("Opening Customer Aadhaar Card Front & Back..."); }}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[#0A3598]/5 hover:bg-[#0A3598]/10 border border-[#0A3598]/10 rounded-xl transition-all text-center cursor-pointer"
                      >
                        <span className="material-symbols-rounded text-base select-none">badge</span>
                        Aadhaar
                      </a>
                      <a 
                        href="#view-pan" 
                        onClick={(e) => { e.preventDefault(); alert("Opening Customer PAN Card..."); }}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[#0A3598]/5 hover:bg-[#0A3598]/10 border border-[#0A3598]/10 rounded-xl transition-all text-center cursor-pointer"
                      >
                        <span className="material-symbols-rounded text-base select-none">credit_card</span>
                        PAN
                      </a>
                      <a 
                        href="#view-cheque" 
                        onClick={(e) => { e.preventDefault(); alert("Opening Bank Cheque / Passbook..."); }}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[#0A3598]/5 hover:bg-[#0A3598]/10 border border-[#0A3598]/10 rounded-xl transition-all text-center cursor-pointer"
                      >
                        <span className="material-symbols-rounded text-base select-none">payments</span>
                        Cheque
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Guarantor / Nominee Tab */
              account.type === 'Loan' ? (
                /* Guarantor Details */
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-[#F1F5F9] pb-4">
                    <div className="w-10 h-10 rounded-full bg-[#0A3598]/10 text-[#0A3598] flex items-center justify-center font-bold">
                      <span className="material-symbols-rounded">supervisor_account</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A]">{account.guarantor.name || 'N/A'}</h4>
                      <span className="text-[10px] text-[#64748B] font-bold tracking-wider block uppercase">{account.guarantor.relation || 'Relation'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                    {/* Left Column: Details */}
                    <div className="space-y-3">
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
                    </div>

                    {/* Right Column: Address and Documents */}
                    <div className="space-y-4">
                      <div>
                        <span className="text-[#64748B] block mb-1">Guarantor Address</span>
                        <p className="font-medium text-[#0F172A] leading-relaxed bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-100 text-[11px]">
                          {account.guarantor.address}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Guarantor Documents</span>
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-[#0A3598]">
                          <a 
                            href="#view-g-photo" 
                            onClick={(e) => { e.preventDefault(); alert("Opening Guarantor Photo..."); }}
                            className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[#0A3598]/5 hover:bg-[#0A3598]/10 border border-[#0A3598]/10 rounded-xl transition-all text-center cursor-pointer"
                          >
                            <span className="material-symbols-rounded text-base select-none">account_box</span>
                            Photo
                          </a>
                          <a 
                            href="#view-g-aadhaar-front" 
                            onClick={(e) => { e.preventDefault(); alert("Opening Guarantor Aadhaar Front..."); }}
                            className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[#0A3598]/5 hover:bg-[#0A3598]/10 border border-[#0A3598]/10 rounded-xl transition-all text-center cursor-pointer"
                          >
                            <span className="material-symbols-rounded text-base select-none">badge</span>
                            Aadhaar F
                          </a>
                          <a 
                            href="#view-g-aadhaar-back" 
                            onClick={(e) => { e.preventDefault(); alert("Opening Guarantor Aadhaar Back..."); }}
                            className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[#0A3598]/5 hover:bg-[#0A3598]/10 border border-[#0A3598]/10 rounded-xl transition-all text-center cursor-pointer"
                          >
                            <span className="material-symbols-rounded text-base select-none">badge</span>
                            Aadhaar B
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Nominee Details */
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-[#F1F5F9] pb-4">
                    <div className="w-10 h-10 rounded-full bg-[#FFC107]/10 text-[#D97706] flex items-center justify-center font-bold">
                      <span className="material-symbols-rounded">person_add</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A]">{account.nominee.name || 'N/A'}</h4>
                      <span className="text-[10px] text-[#64748B] font-bold tracking-wider block uppercase">{account.nominee.relation || 'Relation'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                    {/* Left Column: Details */}
                    <div className="space-y-3">
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
                        <span className="font-bold text-[#0A3598]">{account.nominee.share}</span>
                      </div>
                    </div>

                    {/* Right Column: Documents */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Nominee Documents</span>
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-[#0A3598]">
                          <a 
                            href="#view-n-photo" 
                            onClick={(e) => { e.preventDefault(); alert("Opening Nominee Photo..."); }}
                            className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[#0A3598]/5 hover:bg-[#0A3598]/10 border border-[#0A3598]/10 rounded-xl transition-all text-center cursor-pointer"
                          >
                            <span className="material-symbols-rounded text-base select-none">account_box</span>
                            Photo
                          </a>
                          <a 
                            href="#view-n-aadhaar-front" 
                            onClick={(e) => { e.preventDefault(); alert("Opening Nominee Aadhaar Front..."); }}
                            className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[#0A3598]/5 hover:bg-[#0A3598]/10 border border-[#0A3598]/10 rounded-xl transition-all text-center cursor-pointer"
                          >
                            <span className="material-symbols-rounded text-base select-none">badge</span>
                            Aadhaar F
                          </a>
                          <a 
                            href="#view-n-aadhaar-back" 
                            onClick={(e) => { e.preventDefault(); alert("Opening Nominee Aadhaar Back..."); }}
                            className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[#0A3598]/5 hover:bg-[#0A3598]/10 border border-[#0A3598]/10 rounded-xl transition-all text-center cursor-pointer"
                          >
                            <span className="material-symbols-rounded text-base select-none">badge</span>
                            Aadhaar B
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Collection Progress Timeline */}
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">Tenure Progress</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[#64748B]">Progress Days</span>
                <span className="text-[#0A3598]">{account.paidDays} / {account.tenureDays} Days</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full" 
                  style={{ width: `${(account.paidDays / account.tenureDays) * 100}%`, background: 'linear-gradient(90deg, #2952E3 0%, #1E3A8A 50%, #0B2A6F 100%)' }}
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

    {/* Closure Modal Dialog Overlay */}
    {isCloseModalOpen && (
      <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
          {/* Modal Header */}
          <div className="flex justify-between items-center border-b border-slate-100 p-5 pb-3 shrink-0">
            <h3 className="text-base font-extrabold text-[#0F172A] flex items-center gap-1.5">
              <span className="material-symbols-rounded text-lg text-[#0A3598] select-none">
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
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-[#0F172A] no-scrollbar">
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
                <span className="text-[#0A3598]">{account.type}</span>
              </div>
            </div>

            {account.type === 'Loan' ? (
              // Loan Close details
              <div className="space-y-3">
                {/* Details Breakdown Grid */}
                <div className="bg-[#F8FAFC] border border-slate-100 p-3 rounded-2xl space-y-2.5">
                  <span className="font-extrabold text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">
                    Principal & Interest Breakdown
                  </span>
                  
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 text-xs">
                    {/* Principal Col */}
                    <div className="bg-white border border-slate-150 p-2.5 rounded-xl space-y-1.5 shadow-2xs">
                      <strong className="text-[10px] font-black text-[#0A3598] uppercase tracking-wider block">Principal</strong>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Disbursed:</span>
                        <span className="font-bold text-[#0F172A]">₹{Math.round(totalPrincipalForClose).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Paid:</span>
                        <span className="font-bold text-emerald-600">₹{Math.round(paidPrincipalForClose).toLocaleString()}</span>
                      </div>
                      <div className="border-t border-dashed border-slate-100 pt-1.5 flex justify-between text-[11px] font-extrabold">
                        <span className="text-slate-600">Outstanding:</span>
                        <span className="text-[#E11D48]">₹{Math.round(remainingPrincipalForClose).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Interest Col */}
                    <div className="bg-white border border-slate-150 p-2.5 rounded-xl space-y-1.5 shadow-2xs">
                      <strong className="text-[10px] font-black text-amber-600 uppercase tracking-wider block">Interest</strong>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Expected:</span>
                        <span className="font-bold text-[#0F172A]">₹{Math.round(totalInterestForClose).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Paid:</span>
                        <span className="font-bold text-emerald-600">₹{Math.round(paidInterestForClose).toLocaleString()}</span>
                      </div>
                      <div className="border-t border-dashed border-slate-100 pt-1.5 flex justify-between text-[11px] font-extrabold">
                        <span className="text-slate-600">Remaining:</span>
                        <span className="text-[#E11D48]">₹{Math.round(remainingInterestForClose).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-[#64748B] block text-[10px] uppercase">Principal Outstanding (₹)</label>
                    <input 
                      type="number"
                      value={closePrincipal}
                      onChange={(e) => setClosePrincipal(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#0A3598]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#64748B] block text-[10px] uppercase">Late Fine / Charges (₹)</label>
                    <input 
                      type="number"
                      value={closeInterestFine}
                      onChange={(e) => setCloseInterestFine(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#E11D48] focus:outline-none focus:border-[#0A3598]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-[#64748B] block text-[10px] uppercase">Waiver / Discount (₹)</label>
                    <input 
                      type="number"
                      value={closeDiscountCharges}
                      onChange={(e) => setCloseDiscountCharges(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#16A34A] focus:outline-none focus:border-[#0A3598]"
                    />
                  </div>
                  <DatePicker
                    label="Settlement Date"
                    value={closeDate}
                    maxDate={new Date().toLocaleDateString('sv-SE')}
                    onChange={(val) => setCloseDate(val)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block text-[10px] uppercase">Remarks / Notes</label>
                  <input 
                    type="text"
                    value={closeRemarks}
                    onChange={(e) => setCloseRemarks(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#0A3598]"
                  />
                </div>

                <div className="flex justify-between items-center p-3 bg-red-50/50 border border-red-100 rounded-xl">
                  <span className="font-bold text-[#0F172A]">Net Settlement Amount:</span>
                  <span className="text-sm font-black text-[#E11D48]">
                    ₹{Math.max(0, ((Number(closePrincipal) + Number(closeInterestFine)) - Number(closeDiscountCharges))).toLocaleString()}
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
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 block">Deposited Principal (₹)</label>
                    <input 
                      type="number"
                      value={closePrincipal}
                      onChange={(e) => setClosePrincipal(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#0A3598]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 block">Interest Payout (₹)</label>
                    <input 
                      type="number"
                      value={closeInterestFine}
                      onChange={(e) => setCloseInterestFine(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#16A34A] focus:outline-none focus:border-[#0A3598]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 block">Penalty / Pre-closure Charges (₹)</label>
                  <input 
                    type="number"
                    value={closeDiscountCharges}
                    onChange={(e) => setCloseDiscountCharges(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#E11D48] focus:outline-none focus:border-[#0A3598]"
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
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#0A3598] focus:ring-[#0A3598]" 
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
          <div className="flex gap-3 p-5 pt-3 border-t border-slate-100 bg-white shrink-0">
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
                  ? (account.type === 'Loan' ? 'bg-[#E11D48] hover:bg-[#E11D48]/90 cursor-pointer' : 'hover:brightness-95 cursor-pointer')
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              style={confirmClosure && account.type !== 'Loan' ? { background: 'linear-gradient(135deg, #FFD54A 0%, #FBBF24 35%, #F59E0B 70%, #E67E00 100%)' } : {}}
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
              <span className="material-symbols-rounded text-base text-[#0A3598] select-none">payments</span>
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
                  selectedDayObj.status === 'Partial' ? 'bg-[#FFC107]/10 text-[#D97706]' :
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
                <span className="text-[#0A3598]">
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
                  className="w-full h-11 px-3 bg-white border-2 border-[#0A3598] rounded-xl text-sm font-black text-[#16A34A] ring-2 ring-[#0A3598]/10 focus:outline-none"
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
                  className="w-full h-11 px-3 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#E11D48] focus:outline-none focus:border-[#0A3598]"
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
                className="flex-1 h-11 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center"
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

    {/* Update Transaction Modal */}
    {isUpdateModalOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setIsUpdateModalOpen(false)}>
        <form 
          onSubmit={handleUpdateCollection}
          className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md p-5 space-y-4 animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center border-b border-[#F1F5F9] pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-base text-[#3B82F6] select-none">edit_document</span>
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Update Transaction Details
              </h3>
            </div>
            <button 
              type="button"
              onClick={() => setIsUpdateModalOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
            >
              <span className="material-symbols-rounded text-sm select-none">close</span>
            </button>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Receipt No</label>
              <input 
                type="text"
                disabled
                value={updateForm.refNo}
                className="w-full h-11 px-3.5 bg-slate-50 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] cursor-not-allowed select-none outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Amount Paid (₹)</label>
                <input 
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={updateForm.amount}
                  onChange={(e) => setUpdateForm({ ...updateForm, amount: e.target.value })}
                  className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                />
              </div>

              {isLoan ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Late Fine (₹)</label>
                  <input 
                    type="number"
                    min="0"
                    step="0.01"
                    value={updateForm.penalty}
                    onChange={(e) => setUpdateForm({ ...updateForm, penalty: e.target.value })}
                    className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Charges (₹)</label>
                  <input 
                    type="number"
                    disabled
                    value="0"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] cursor-not-allowed select-none outline-none"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Payment Mode"
                options={[
                  { value: 'Cash', label: 'Cash' },
                  { value: 'UPI', label: 'UPI' },
                  { value: 'Bank Transfer', label: 'Bank Transfer' },
                  { value: 'Cheque', label: 'Cheque' },
                  { value: 'Online', label: 'Online' }
                ]}
                value={updateForm.payment_mode}
                onChange={(val) => setUpdateForm({ ...updateForm, payment_mode: val })}
                searchable={false}
              />

              <DatePicker
                label="Collection Date"
                required={true}
                value={updateForm.date}
                onChange={(val) => setUpdateForm({ ...updateForm, date: val })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Remarks</label>
              <textarea 
                rows="2"
                value={updateForm.remarks}
                onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}
                className="w-full p-3 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all resize-none"
                placeholder="Add optional remarks..."
              />
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setIsUpdateModalOpen(false)}
                className="flex-1 h-11 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center flex items-center justify-center"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isUpdating}
                className="flex-1 h-11 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    )}

    {/* No Objection Certificate (NOC) Viewer Modal */}
    {isNocModalOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in noc-no-print" onClick={() => setIsNocModalOpen(false)}>
        <div 
          className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-[#F8FAFC] shrink-0">
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-1.5">
              <span className="material-symbols-rounded text-lg text-[#16A34A] select-none">verified</span>
              Official No Objection Certificate (NOC)
            </h3>
            <button 
              onClick={() => setIsNocModalOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-rounded text-lg select-none block">close</span>
            </button>
          </div>

          {/* Modal Body: Scrollable certificate container */}
          <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-50">
            {/* Printable Certificate Board */}
            <div 
              id="noc-print-area"
              className="bg-white p-10 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
              style={{ minHeight: '600px', backgroundImage: 'radial-gradient(#0A359803 1px, transparent 1px)', backgroundSize: '16px 16px' }}
            >
              {/* Border decoration */}
              <div className="absolute inset-2 border-2 border-double border-slate-200 rounded-lg pointer-events-none"></div>
              
              {/* Letterhead Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-5 gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" className="w-12 h-12 object-contain shrink-0" alt="Umbrella Logo" />
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-[#0F172A]">UMBRELLA FINANCE</h2>
                    <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest leading-none mt-0.5">Chhote Kadam, Bade Sapne</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <h3 className="text-xs font-black text-slate-800 tracking-wider">NO OBJECTION CERTIFICATE</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ref: NOC/{account.accNo}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Date: {account.closed_at ? new Date(account.closed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Certificate Watermark Logo */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                <img src="/logo.png" className="w-64 h-64 object-contain opacity-[0.04]" alt="Watermark" />
              </div>

              {/* Certificate Contents */}
              <div className="py-8 space-y-6 text-xs text-slate-700 leading-relaxed relative z-10">
                <p className="font-bold text-slate-900">TO WHOM IT MAY CONCERN</p>
                
                <p className="text-justify font-medium">
                  This is to certify that the borrower <strong className="font-extrabold text-[#0F172A]">{account.customer?.name}</strong>, residing at <strong className="font-bold text-slate-800">{account.customer?.address}</strong>, having Registered Mobile No: <strong className="font-bold text-slate-800">{account.customer?.phone}</strong> and Aadhaar No: <strong className="font-bold text-slate-800">{account.customer?.aadhaar}</strong>, has availed a Loan under Account Number <strong className="font-extrabold text-[#0A3598]">{account.accNo}</strong> from Umbrella Finance.
                </p>

                <p className="text-justify font-medium">
                  We hereby confirm that the borrower has fully paid all due installments, principal, interest, and any applicable charges under this loan account. As of <strong className="font-bold text-slate-800">{account.closed_at ? new Date(account.closed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>, the outstanding dues under the said loan account stand at <strong className="text-green-600 font-extrabold">NIL (₹0.00)</strong>.
                </p>

                <p className="text-justify font-medium">
                  Umbrella Finance has received the complete settlement amount and has **No Objection** whatsoever against the borrower. We declare that the said loan account has been **Fully Closed & Settled** in our books of accounts, and there are no liabilities, claims, or dues outstanding against the borrower under this account.
                </p>
              </div>

              {/* Letterhead Signatures */}
              <div className="flex justify-between items-end pt-8 border-t border-slate-200 mt-auto relative z-10">
                <div className="space-y-2">
                  <div className="w-16 h-16 bg-[#0A3598]/5 border border-dashed border-[#0A3598]/20 rounded-full flex flex-col items-center justify-center text-[7px] font-bold text-[#0A3598]/60 select-none uppercase tracking-widest text-center leading-tight">
                    <span>OFFICIAL</span>
                    <span>SEAL</span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Umbrella Finance Seal</p>
                </div>
                <div className="text-right space-y-1.5">
                  <div className="italic text-xs font-black text-slate-800 h-8 flex items-end justify-end select-none">
                    <span className="font-serif text-[#0A3598] border-b border-slate-300 pb-1.5 w-36 text-center tracking-widest">Sandeep Kumar</span>
                  </div>
                  <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-[#F8FAFC] shrink-0">
            <button 
              onClick={() => setIsNocModalOpen(false)}
              className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center"
            >
              Close Preview
            </button>
            <button 
              onClick={() => window.print()}
              className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-xs font-bold rounded-xl transition-all text-center shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-rounded text-sm">print</span>
              Print Certificate
            </button>
          </div>
        </div>

        {/* Dynamic stylesheet injection for high fidelity printing */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #noc-print-area, #noc-print-area * {
              visibility: visible !important;
            }
            #noc-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              border: none !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 50px !important;
              background: white !important;
              font-family: inherit !important;
            }
            .noc-no-print {
              display: none !important;
            }
          }
        `}} />
      </div>
    )}

    {/* Savings Maturity Bond Viewer Modal */}
    {isBondModalOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in bond-no-print" onClick={() => setIsBondModalOpen(false)}>
        <div 
          className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-[#F8FAFC] shrink-0">
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-1.5">
              <span className="material-symbols-rounded text-lg text-[#0A3598] select-none">workspace_premium</span>
              Official Savings Maturity Bond
            </h3>
            <button 
              onClick={() => setIsBondModalOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-rounded text-lg select-none block">close</span>
            </button>
          </div>

          {/* Modal Body: Scrollable certificate container */}
          <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-50">
            {/* Printable Certificate Board */}
            <div 
              id="bond-print-area"
              className="bg-white p-10 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
              style={{ minHeight: '600px', backgroundImage: 'radial-gradient(#0A359803 1px, transparent 1px)', backgroundSize: '16px 16px' }}
            >
              {/* Border decoration */}
              <div className="absolute inset-2 border-2 border-double border-slate-200 rounded-lg pointer-events-none"></div>
              
              {/* Letterhead Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-5 gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" className="w-12 h-12 object-contain shrink-0" alt="Umbrella Logo" />
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-[#0F172A]">UMBRELLA FINANCE</h2>
                    <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest leading-none mt-0.5">Chhote Kadam, Bade Sapne</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <h3 className="text-xs font-black text-slate-800 tracking-wider">SAVINGS MATURITY BOND</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ref: SMB/{account.accNo}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Certificate Watermark Logo */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                <img src="/logo.png" className="w-64 h-64 object-contain opacity-[0.04]" alt="Watermark" />
              </div>

              {/* Certificate Contents */}
              <div className="py-8 space-y-6 text-xs text-slate-700 leading-relaxed relative z-10">
                <p className="font-bold text-slate-900">CERTIFICATE OF SAVINGS DEPOSIT</p>
                
                <p className="text-justify font-medium">
                  This is to certify that the depositor <strong className="font-extrabold text-[#0F172A]">{account.customer?.name}</strong>, residing at <strong className="font-bold text-slate-800">{account.customer?.address}</strong>, having Registered Mobile No: <strong className="font-bold text-slate-800">{account.customer?.phone}</strong> and Aadhaar No: <strong className="font-bold text-slate-800">{account.customer?.aadhaar}</strong>, has opened a Savings Account under Account Number <strong className="font-extrabold text-[#0A3598]">{account.accNo}</strong> with Umbrella Finance.
                </p>

                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-y-2 gap-x-4 font-semibold text-slate-700">
                  <div>Deposit Frequency: <span className="text-[#0F172A] font-extrabold">{account.deposit_frequency || 'Daily'}</span></div>
                  <div>Interest Rate: <span className="text-[#0F172A] font-extrabold">{account.interestRate || '6%'}</span></div>
                  <div>EMI / Regular Deposit: <span className="text-[#0F172A] font-extrabold">₹{account.emiAmt?.toLocaleString('en-IN') || 0}</span></div>
                  <div>Maturity Amount: <span className="text-green-600 font-extrabold">₹{(account.maturity_amount || 36500).toLocaleString('en-IN')}</span></div>
                  <div>Start Date: <span className="text-[#0F172A] font-extrabold">{account.disbursalDate}</span></div>
                  <div>Maturity Date: <span className="text-[#0F172A] font-extrabold">{account.maturity_date ? new Date(account.maturity_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></div>
                  <div className="col-span-2">Nominee Details: <span className="text-[#0F172A] font-extrabold">{account.nominee?.name || 'N/A'} ({account.nominee?.relation || 'N/A'})</span></div>
                </div>

                <p className="text-justify font-medium">
                  We hereby confirm that this certificate serves as the official bond of the savings deposit terms. Umbrella Finance guarantees the payment of the maturity amount upon completion of the tenure and fulfillment of deposit terms.
                </p>

                {termsSavings && termsSavings.length > 0 && (
                  <div className="border-t border-slate-200 pt-3.5 mt-1.5 relative z-10 text-[9px] font-semibold text-slate-500">
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-1">Terms & Conditions</h4>
                    <ul className="list-disc pl-4 space-y-0.5 leading-relaxed text-justify">
                      {termsSavings.map((term, idx) => (
                        <li key={idx}>{term}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Letterhead Signatures */}
              <div className="flex justify-between items-end pt-8 border-t border-slate-200 mt-auto relative z-10">
                <div className="space-y-2">
                  <div className="w-16 h-16 bg-[#0A3598]/5 border border-dashed border-[#0A3598]/20 rounded-full flex flex-col items-center justify-center text-[7px] font-bold text-[#0A3598]/60 select-none uppercase tracking-widest text-center leading-tight">
                    <span>OFFICIAL</span>
                    <span>SEAL</span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Umbrella Finance Seal</p>
                </div>
                <div className="text-right space-y-1.5">
                  <div className="italic text-xs font-black text-slate-800 h-8 flex items-end justify-end select-none">
                    <span className="font-serif text-[#0A3598] border-b border-slate-300 pb-1.5 w-36 text-center tracking-widest">Sandeep Kumar</span>
                  </div>
                  <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-[#F8FAFC] shrink-0">
            <button 
              onClick={() => setIsBondModalOpen(false)}
              className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center"
            >
              Close Preview
            </button>
            <button 
              onClick={() => window.print()}
              className="flex-1 py-2.5 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-bold rounded-xl transition-all text-center shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-rounded text-sm">print</span>
              Print Bond
            </button>
          </div>
        </div>

        {/* Dynamic stylesheet injection for high fidelity printing */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #bond-print-area, #bond-print-area * {
              visibility: visible !important;
            }
            #bond-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              border: none !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 50px !important;
              background: white !important;
              font-family: inherit !important;
            }
            .bond-no-print {
              display: none !important;
            }
          }
        `}} />
      </div>
    )}

    {/* Account Passbook Viewer Modal */}
    {isPassbookModalOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in passbook-no-print" onClick={() => setIsPassbookModalOpen(false)}>
        <div 
          className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-4xl flex flex-col h-[92vh] overflow-hidden animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-[#F8FAFC] shrink-0">
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-1.5">
              <span className="material-symbols-rounded text-lg text-[#0A3598] select-none">book_5</span>
              Official Account Passbook & Statement
            </h3>
            <button 
              onClick={() => setIsPassbookModalOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-rounded text-lg select-none block">close</span>
            </button>
          </div>

          {/* Modal Body: Scrollable statement container */}
          <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-50">
            {/* Printable Passbook Board */}
            <div 
              id="passbook-print-area"
              className="bg-white p-10 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col gap-6"
              style={{ minHeight: '100%', backgroundImage: 'radial-gradient(#0A359803 1px, transparent 1px)', backgroundSize: '16px 16px' }}
            >
              {/* Border decoration */}
              <div className="absolute inset-2 border-2 border-double border-slate-200 rounded-lg pointer-events-none"></div>

              {/* Certificate Watermark Logo */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                <img src="/logo.png" className="w-64 h-64 object-contain opacity-[0.04]" alt="Watermark" />
              </div>
              
              {/* Letterhead Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-5 gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" className="w-12 h-12 object-contain shrink-0" alt="Umbrella Logo" />
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-[#0F172A]">UMBRELLA FINANCE</h2>
                    <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest leading-none mt-0.5">Chhote Kadam, Bade Sapne</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <h3 className="text-xs font-black text-slate-800 tracking-wider">ACCOUNT PASSBOOK STATEMENT</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Acc No: {account.accNo}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Statement Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Customer and Account details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200/60 relative z-10 text-[11px]">
                {/* Column 1: Customer Details */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 text-[10px]">Customer Information</h4>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">Name:</span>
                    <span className="col-span-2 text-slate-800 font-extrabold">{account.customer?.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">Aadhaar:</span>
                    <span className="col-span-2 text-slate-800 font-extrabold">{account.customer?.aadhaar}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">PAN:</span>
                    <span className="col-span-2 text-slate-800 font-extrabold">{account.customer?.pan || 'N/A'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">Phone:</span>
                    <span className="col-span-2 text-slate-800 font-extrabold">{account.customer?.phone}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">Address:</span>
                    <span className="col-span-2 text-slate-800 font-medium leading-tight">{account.customer?.address}</span>
                  </div>
                </div>

                {/* Column 2: Account Details */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 text-[10px]">Account Summary</h4>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">Account Type:</span>
                    <span className="col-span-2 text-slate-800 font-extrabold uppercase">{account.type} Account</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">Approved Amt:</span>
                    <span className="col-span-2 text-slate-800 font-extrabold">₹{(account.approvedAmt || 0).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">ROI Rate:</span>
                    <span className="col-span-2 text-slate-800 font-extrabold">{account.roi}% p.a.</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">Tenure Days:</span>
                    <span className="col-span-2 text-slate-800 font-extrabold">{account.tenure} Days</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">Start Date:</span>
                    <span className="col-span-2 text-slate-800 font-extrabold">{account.start_date}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 font-bold">Status:</span>
                    <span className={`col-span-2 font-extrabold uppercase ${account.account_status === 'Closed' ? 'text-rose-600' : 'text-[#16A34A]'}`}>
                      {account.account_status || account.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="relative z-10 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-500 text-left border-b border-slate-200">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Reference No</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Mode</th>
                      <th className="px-3 py-2 text-right">Penalty</th>
                      <th className="px-3 py-2 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {(statementData.transactions || []).length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-3 py-4 text-center text-slate-400 font-bold">No transactions logged on this account.</td>
                      </tr>
                    ) : (
                      (statementData.transactions || []).map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 whitespace-nowrap">{t.date}</td>
                          <td className="px-3 py-2.5 font-bold whitespace-nowrap">{t.refNo}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{t.type}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{t.paymentMode || 'Cash'}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap text-rose-500">₹{Number(t.fine || 0).toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-extrabold whitespace-nowrap text-[#16A34A]">₹{Number(t.amt || 0).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Terms and Conditions Section */}
              {((account.type === 'Loan' ? termsLoan : termsSavings)) && ((account.type === 'Loan' ? termsLoan : termsSavings)).length > 0 && (
                <div className="border-t border-slate-200 pt-3.5 pb-2 mt-auto relative z-10 text-[9px] font-semibold text-slate-500">
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-1">Terms & Conditions</h4>
                  <ul className="list-disc pl-4 space-y-0.5 leading-relaxed text-justify">
                    {(account.type === 'Loan' ? termsLoan : termsSavings).map((term, idx) => (
                      <li key={idx}>{term}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stamp and Signatures Footer */}
              <div className="flex justify-between items-end pt-8 border-t border-slate-200 mt-4 relative z-10">
                <div className="space-y-2">
                  <div className="w-16 h-16 bg-[#0A3598]/5 border border-dashed border-[#0A3598]/20 rounded-full flex flex-col items-center justify-center text-[7px] font-bold text-[#0A3598]/60 select-none uppercase tracking-widest text-center leading-tight">
                    <span>OFFICIAL</span>
                    <span>SEAL</span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Umbrella Finance Seal</p>
                </div>
                <div className="text-right space-y-1.5">
                  <div className="italic text-xs font-black text-slate-800 h-8 flex items-end justify-end select-none">
                    <span className="font-serif text-[#0A3598] border-b border-slate-300 pb-1.5 w-36 text-center tracking-widest">Sandeep Kumar</span>
                  </div>
                  <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-[#F8FAFC] shrink-0">
            <button 
              onClick={() => setIsPassbookModalOpen(false)}
              className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-100 text-center"
            >
              Close Preview
            </button>
            <button 
              onClick={() => window.print()}
              className="flex-1 py-2.5 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-bold rounded-xl transition-all text-center shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-rounded text-sm">print</span>
              Print Statement
            </button>
          </div>
        </div>

        {/* Dynamic stylesheet injection for high fidelity printing */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #passbook-print-area, #passbook-print-area * {
              visibility: visible !important;
            }
            #passbook-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              border: none !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 50px !important;
              background: white !important;
              font-family: inherit !important;
            }
            .passbook-no-print {
              display: none !important;
            }
          }
        `}} />
      </div>
    )}

    {/* Add Loan Modal */}
    {isAddLoanModalOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setIsAddLoanModalOpen(false)}>
        <div 
          className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-4xl overflow-hidden animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center border-b border-[#F1F5F9] px-6 py-4 bg-[#F8FAFC]">
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-1.5">
              <span className="material-symbols-rounded text-base text-[#0A3598] select-none">credit_score</span>
              Apply for New Loan
            </h3>
            <button 
              onClick={() => setIsAddLoanModalOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-rounded text-lg select-none block">close</span>
            </button>
          </div>

          <form onSubmit={handleAddLoan} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[80vh] overflow-y-auto">
            {/* Form Inputs (Left) */}
            <div className="md:col-span-2 space-y-4">
              <div className="space-y-1">
                <Select
                  label="Select Loan Plan"
                  required={true}
                  options={[
                    { value: "", label: "-- Choose Plan --" },
                    ...loanPlans.map(p => ({
                      value: String(p.id),
                      label: `${p.name} (₹${Number(p.min_amount || 0).toLocaleString()} - ${p.interest_rate}% ${p.interest_type} / ${p.duration_value} ${p.duration_unit})`
                    })),
                    { value: "custom", label: "Custom Loan Plan (Enter Manually)" }
                  ]}
                  value={loanForm.loan_plan_id}
                  onChange={(val) => {
                    const planId = val;
                    if (planId === 'custom') {
                      setLoanForm(prev => ({
                        ...prev,
                        loan_plan_id: planId,
                        principal_amount: '',
                        interest_rate: '12',
                        interest_type: 'Flat',
                        duration_value: '100',
                        duration_unit: 'Days',
                        collection_frequency: 'Daily',
                        emi_amount: ''
                      }));
                    } else {
                      const p = loanPlans.find(lp => String(lp.id) === String(planId));
                      if (p) {
                        setLoanForm(prev => ({
                          ...prev,
                          loan_plan_id: planId,
                          principal_amount: p.min_amount,
                          interest_rate: p.interest_rate,
                          interest_type: p.interest_type,
                          duration_value: p.duration_value,
                          duration_unit: p.duration_unit,
                          collection_frequency: p.collection_frequency,
                          emi_amount: p.emi_amount
                        }));
                      }
                    }
                  }}
                  searchable={true}
                />
              </div>

              {loanForm.loan_plan_id === 'custom' && (
                <div className="border-t border-[#F1F5F9] pt-4 mt-2 space-y-4">
                  <h4 className="text-[11px] font-bold text-[#0A3598] uppercase tracking-wider">Custom Loan Details</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Principal Amount (₹) <span className="text-danger-fin">*</span></label>
                      <input 
                        type="number"
                        required
                        min="1"
                        value={loanForm.principal_amount}
                        onChange={(e) => setLoanForm({ ...loanForm, principal_amount: e.target.value })}
                        className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                        placeholder="E.g., 10000"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Interest Rate (%) <span className="text-danger-fin">*</span></label>
                      <input 
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={loanForm.interest_rate}
                        onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })}
                        className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                        placeholder="E.g., 12"
                      />
                    </div>

                    <Select
                      label="Interest Type"
                      required={true}
                      options={[
                        { value: 'Flat', label: 'Flat Interest' },
                        { value: 'Reducing', label: 'Reducing Interest' }
                      ]}
                      value={loanForm.interest_type}
                      onChange={(val) => setLoanForm({ ...loanForm, interest_type: val })}
                      searchable={false}
                    />

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Duration <span className="text-danger-fin">*</span></label>
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          required
                          min="1"
                          value={loanForm.duration_value}
                          onChange={(e) => setLoanForm({ ...loanForm, duration_value: e.target.value })}
                          className="flex-1 h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                          placeholder="E.g., 100"
                        />
                        <Select
                          options={[
                            { value: 'Days', label: 'Days' },
                            { value: 'Months', label: 'Months' },
                            { value: 'Years', label: 'Years' }
                          ]}
                          value={loanForm.duration_unit}
                          onChange={(val) => setLoanForm({ ...loanForm, duration_unit: val })}
                          searchable={false}
                          compact={true}
                        />
                      </div>
                    </div>

                    <Select
                      label="Collection Frequency"
                      required={true}
                      options={[
                        { value: 'Daily', label: 'Daily' },
                        { value: 'Weekly', label: 'Weekly' },
                        { value: 'Monthly', label: 'Monthly' }
                      ]}
                      value={loanForm.collection_frequency}
                      onChange={(val) => setLoanForm({ ...loanForm, collection_frequency: val })}
                      searchable={false}
                    />

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Installment / EMI (₹) <span className="text-danger-fin">*</span></label>
                      <input 
                        type="number"
                        required
                        min="1"
                        value={loanForm.emi_amount}
                        onChange={(e) => setLoanForm({ ...loanForm, emi_amount: e.target.value })}
                        className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                        placeholder="Calculated automatically..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Processing Fee (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={loanForm.processing_fee}
                        onChange={(e) => setLoanForm({ ...loanForm, processing_fee: e.target.value })}
                        className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                        placeholder="E.g., 200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Penalty per Day (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={loanForm.penalty_per_day}
                        onChange={(e) => setLoanForm({ ...loanForm, penalty_per_day: e.target.value })}
                        className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                        placeholder="E.g., 10"
                      />
                    </div>
                  </div>
                </div>
              )}

              {loanForm.loan_plan_id && loanForm.loan_plan_id !== 'custom' && (
                <div className="space-y-1 pt-2">
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Principal Amount (₹) <span className="text-danger-fin">*</span></label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={loanForm.principal_amount}
                    onChange={(e) => setLoanForm({ ...loanForm, principal_amount: e.target.value })}
                    className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                    placeholder="Enter principal amount"
                  />
                </div>
              )}

              {loanForm.loan_plan_id && (
                <DatePicker
                  label="Account Opening Date *"
                  required={true}
                  value={loanForm.start_date}
                  onChange={(val) => setLoanForm({ ...loanForm, start_date: val })}
                />
              )}
            </div>

            {/* Calculations Card (Right) */}
            <div className="md:col-span-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex flex-col justify-between min-h-[300px]">
              <div>
                <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0] pb-2 mb-3">
                  Calculation Summary
                </h4>
                
                {selectedLoanPlanObj ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#64748B] font-semibold">Plan Name</span>
                      <strong className="text-[#0F172A] font-extrabold">{selectedLoanPlanObj.name}</strong>
                    </div>

                    {(() => {
                      const principal = loanForm.loan_plan_id === 'custom' ? (Number(loanForm.principal_amount) || 0) : (Number(loanForm.principal_amount) || 0);
                      const rate = loanForm.loan_plan_id === 'custom' ? (Number(loanForm.interest_rate) || 0) : (Number(selectedLoanPlanObj.interest_rate) || 0);
                      const type = loanForm.loan_plan_id === 'custom' ? loanForm.interest_type : selectedLoanPlanObj.interest_type;
                      const duration = loanForm.loan_plan_id === 'custom' ? (Number(loanForm.duration_value) || 0) : (Number(selectedLoanPlanObj.duration_value) || 0);
                      const durationUnit = loanForm.loan_plan_id === 'custom' ? loanForm.duration_unit : selectedLoanPlanObj.duration_unit;
                      const frequency = loanForm.loan_plan_id === 'custom' ? loanForm.collection_frequency : selectedLoanPlanObj.collection_frequency;
                      let durationInMonths = 0;
                      if (durationUnit === 'Days') durationInMonths = duration / 30.4375;
                      else if (durationUnit === 'Months') durationInMonths = duration;
                      else if (durationUnit === 'Years') durationInMonths = duration * 12;

                      const loanPeriod = liveSettings.interest_calculation_period_loan || 'monthly';
                      const timeFactor = loanPeriod === 'yearly' ? (durationInMonths / 12) : durationInMonths;

                      const totalInterest = type === 'Flat'
                        ? (principal * (rate / 100) * timeFactor)
                        : (principal * (rate / 100) * timeFactor * 0.7);
                      const totalPayable = principal + totalInterest;

                      // Calculate N
                      let N = 0;
                      if (frequency === 'Daily') {
                        N = durationUnit === 'Days' ? duration : getActualDays(loanForm.start_date, duration, durationUnit);
                      } else if (frequency === 'Weekly') {
                        N = durationUnit === 'Days' ? Math.round(duration / 7) : Math.round(getActualDays(loanForm.start_date, duration, durationUnit) / 7);
                      } else if (frequency === 'Monthly') {
                        N = durationUnit === 'Days' ? Math.round(duration / 30.4375) : (durationUnit === 'Months' ? duration : duration * 12);
                      }
                      if (N <= 0) N = 1;

                      const emi = loanForm.loan_plan_id === 'custom' ? (Number(loanForm.emi_amount) || 0) : Math.round(totalPayable / N);

                      return (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#64748B] font-semibold">Principal</span>
                            <strong className="text-[#0F172A] font-extrabold">₹{principal.toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#64748B] font-semibold">Rate ({type})</span>
                            <strong className="text-[#0F172A] font-extrabold">{rate}%</strong>
                          </div>

                          <div className="flex justify-between items-center text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                            <span className="text-[#0A3598] font-bold">Duration</span>
                            <span className="font-extrabold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                              {duration} {durationUnit}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs bg-[#0A3598]/5 border border-[#0A3598]/10 px-3 py-2 rounded-xl">
                            <span className="text-[#0A3598] font-bold">Installment (EMI)</span>
                            <span className="font-extrabold text-[#0A3598] bg-white px-2 py-0.5 rounded border border-[#0A3598]/10">
                              ₹{emi.toLocaleString()} ({frequency})
                            </span>
                          </div>

                          <div className="border-t border-dashed border-slate-300 pt-3 mt-2 space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-[#64748B] font-semibold">Total Interest</span>
                              <strong className="text-[#0F172A] font-extrabold">₹{Math.round(totalInterest).toLocaleString()}</strong>
                            </div>
                            <div className="flex justify-between text-xs text-[#16A34A] pt-1">
                              <span className="font-bold">Total Payable</span>
                              <strong className="font-black text-[13px]">₹{Math.round(totalPayable).toLocaleString()}</strong>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#64748B] text-center pt-8">Select a loan plan to view calculation details.</p>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsAddLoanModalOpen(false)}
                  className="flex-1 h-10 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-[#E2E8F0] text-center"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-10 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Apply Loan'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Add Savings Modal */}
    {isAddSavingModalOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setIsAddSavingModalOpen(false)}>
        <div 
          className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-4xl overflow-hidden animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center border-b border-[#F1F5F9] px-6 py-4 bg-[#F8FAFC]">
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-1.5">
              <span className="material-symbols-rounded text-base text-[#FFC107] select-none">savings</span>
              Open New Savings Account
            </h3>
            <button 
              onClick={() => setIsAddSavingModalOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-rounded text-lg select-none block">close</span>
            </button>
          </div>

          <form onSubmit={handleAddSaving} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[80vh] overflow-y-auto">
            {/* Form Inputs (Left) */}
            <div className="md:col-span-2 space-y-4">
              <Select
                label="Select Savings Plan"
                required={true}
                options={[
                  { value: "", label: "-- Choose a Plan --" },
                  ...savingPlans.map(p => ({
                    value: String(p.id),
                    label: `${p.name} (Deposit: ₹${p.deposit_amount} / Rate: ${p.interest_rate}% / ${p.duration_value} ${p.duration_unit})`
                  })),
                  { value: "custom", label: "Custom Savings Plan (Enter Manually)" }
                ]}
                value={savingForm.saving_plan_id}
                onChange={(val) => {
                  const planId = val;
                  if (planId === 'custom') {
                    setSavingForm(prev => ({
                      ...prev,
                      saving_plan_id: planId,
                      deposit_amount: '',
                      interest_rate: '6.5',
                      duration_value: '365',
                      duration_unit: 'Days',
                      collection_frequency: 'Daily',
                      maturity_amount: ''
                    }));
                  } else {
                    const selected = savingPlans.find(p => String(p.id) === planId);
                    setSavingForm(prev => ({
                      ...prev,
                      saving_plan_id: planId,
                      deposit_amount: selected ? String(selected.deposit_amount) : '',
                      interest_rate: selected ? String(selected.interest_rate) : '',
                      duration_value: selected ? String(selected.duration_value) : '',
                      duration_unit: selected ? String(selected.duration_unit) : 'Days',
                      collection_frequency: selected ? String(selected.collection_frequency) : 'Daily',
                      maturity_amount: selected ? String(selected.maturity_amount) : ''
                    }));
                  }
                }}
                searchable={true}
              />

              {savingForm.saving_plan_id && (
                <div className="border-t border-[#F1F5F9] pt-4 mt-2 space-y-4">
                  <h4 className="text-[11px] font-bold text-[#FFC107] uppercase tracking-wider">
                    {savingForm.saving_plan_id === 'custom' ? 'Custom Savings Details' : 'Savings Plan Parameters'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Deposit Amount (₹) <span className="text-danger-fin">*</span></label>
                      <input 
                        type="number"
                        required
                        min="1"
                        value={savingForm.deposit_amount}
                        onChange={(e) => setSavingForm({ ...savingForm, deposit_amount: e.target.value })}
                        className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                        placeholder="E.g., 100"
                        readOnly={savingForm.saving_plan_id !== 'custom' && selectedSavingPlanObj?.deposit_amount > 0}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Interest Rate (%) <span className="text-danger-fin">*</span></label>
                      <input 
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={savingForm.interest_rate}
                        onChange={(e) => setSavingForm({ ...savingForm, interest_rate: e.target.value })}
                        className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                        placeholder="E.g., 6.5"
                        readOnly={savingForm.saving_plan_id !== 'custom'}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Duration <span className="text-danger-fin">*</span></label>
                      {savingForm.saving_plan_id === 'custom' ? (
                        <div className="flex gap-2">
                          <input 
                            type="number"
                            required
                            min="1"
                            value={savingForm.duration_value}
                            onChange={(e) => setSavingForm({ ...savingForm, duration_value: e.target.value })}
                            className="flex-1 h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                            placeholder="E.g., 365"
                          />
                          <Select
                            options={[
                              { value: 'Days', label: 'Days' },
                              { value: 'Months', label: 'Months' },
                              { value: 'Years', label: 'Years' }
                            ]}
                            value={savingForm.duration_unit}
                            onChange={(val) => setSavingForm({ ...savingForm, duration_unit: val })}
                            searchable={false}
                            compact={true}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-11 px-3.5 bg-slate-50 border border-[#E2E8F0] rounded-xl text-xs font-bold text-slate-500 flex items-center select-none cursor-not-allowed">
                          {savingForm.duration_value} {savingForm.duration_unit}
                        </div>
                      )}
                    </div>

                    {savingForm.saving_plan_id === 'custom' ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Frequency <span className="text-danger-fin">*</span></label>
                          <Select
                            label="Frequency"
                            required={true}
                            options={[
                              { value: 'Daily', label: 'Daily' },
                              { value: 'Weekly', label: 'Weekly' },
                              { value: 'Monthly', label: 'Monthly' }
                            ]}
                            value={savingForm.collection_frequency}
                            onChange={(val) => setSavingForm({ ...savingForm, collection_frequency: val })}
                            searchable={false}
                          />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Frequency</label>
                        <div className="w-full h-11 px-3.5 bg-slate-50 border border-[#E2E8F0] rounded-xl text-xs font-bold text-slate-500 flex items-center select-none cursor-not-allowed">
                          {savingForm.collection_frequency}
                        </div>
                      </div>
                    )}

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Estimated Maturity Amount (₹)</label>
                      <input 
                        type="number"
                        placeholder="Calculated automatically..."
                        value={savingForm.maturity_amount}
                        readOnly
                        className="w-full h-11 px-3.5 bg-slate-50 border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#16A34A] focus:outline-none select-none cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {savingForm.saving_plan_id && (
                <DatePicker
                  label="Account Opening Date *"
                  required={true}
                  value={savingForm.start_date}
                  onChange={(val) => setSavingForm({ ...savingForm, start_date: val })}
                />
              )}
            </div>

            {/* Calculations Card (Right) */}
            <div className="md:col-span-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex flex-col justify-between min-h-[300px]">
              <div>
                <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0] pb-2 mb-3">
                  Calculation Summary
                </h4>
                
                {selectedSavingPlanObj ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#64748B] font-semibold">Plan Name</span>
                      <strong className="text-[#0F172A] font-extrabold">{selectedSavingPlanObj.name}</strong>
                    </div>

                    {(() => {
                      const deposit = savingForm.saving_plan_id === 'custom' ? (Number(savingForm.deposit_amount) || 0) : (Number(savingForm.deposit_amount) || 0);
                      const rate = savingForm.saving_plan_id === 'custom' ? (Number(savingForm.interest_rate) || 0) : (Number(selectedSavingPlanObj.interest_rate) || 0);
                      const duration = savingForm.saving_plan_id === 'custom' ? (Number(savingForm.duration_value) || 0) : (Number(selectedSavingPlanObj.duration_value) || 0);
                      const durationUnit = savingForm.saving_plan_id === 'custom' ? savingForm.duration_unit : selectedSavingPlanObj.duration_unit;
                      const frequency = savingForm.saving_plan_id === 'custom' ? savingForm.collection_frequency : selectedSavingPlanObj.collection_frequency;
                      const maturity = savingForm.saving_plan_id === 'custom' ? (Number(savingForm.maturity_amount) || 0) : (Number(savingForm.maturity_amount) || 0);

                      return (
                        <>
                          <div className="flex justify-between items-center text-xs bg-[#FFC107]/5 border border-[#FFC107]/10 px-3 py-2 rounded-xl">
                            <span className="text-[#FFC107] font-bold">Deposit ({frequency})</span>
                            <span className="font-extrabold text-[#FFC107] bg-white px-2 py-0.5 rounded border border-[#FFC107]/10">
                              ₹{deposit.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex justify-between text-xs">
                            <span className="text-[#64748B] font-semibold">Interest Rate</span>
                            <strong className="text-[#0F172A] font-extrabold">{rate}%</strong>
                          </div>

                          <div className="flex justify-between items-center text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                            <span className="text-[#FFC107] font-bold">Duration</span>
                            <span className="font-extrabold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                              {duration} {durationUnit}
                            </span>
                          </div>

                          <div className="border-t border-dashed border-slate-300 pt-3 mt-2 space-y-2">
                            <div className="flex justify-between text-xs text-[#16A34A] pt-1">
                              <span className="font-bold">Est. Maturity Amount</span>
                              <strong className="font-black text-[13px]">₹{Math.round(maturity).toLocaleString()}</strong>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#64748B] text-center pt-8">Select a savings plan to view calculation details.</p>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsAddSavingModalOpen(false)}
                  className="flex-1 h-10 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-[#E2E8F0] text-center"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-10 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95"
                  style={{ background: 'linear-gradient(135deg, #FFD54A 0%, #FBBF24 35%, #F59E0B 70%, #E67E00 100%)' }}
                >
                  {isSubmitting ? 'Opening...' : 'Open Account'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    )}
    </div>
  );
}
