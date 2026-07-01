import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customerApi, branchApi, areaApi, agentApi, loanApi, savingApi, planApi } from '../services/api';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';

const calculateCustomEmi = (principal, rate, durationVal, durationUnit, frequency, interestType) => {
  if (!principal || !rate || !durationVal) return '';

  let totalDays = 0;
  let totalMonths = 0;
  if (durationUnit === 'Days') {
    totalDays = durationVal;
    totalMonths = durationVal / 30;
  } else if (durationUnit === 'Months') {
    totalDays = durationVal * 30;
    totalMonths = durationVal;
  } else if (durationUnit === 'Years') {
    totalDays = durationVal * 365;
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
    const interest = principal * (rate / 100);
    const totalPayable = principal + interest;
    return Math.round(totalPayable / N);
  } else {
    let R = 0;
    if (frequency === 'Daily') {
      R = (rate / 100) / 365;
    } else if (frequency === 'Weekly') {
      R = (rate / 100) / 52;
    } else if (frequency === 'Monthly') {
      R = (rate / 100) / 12;
    }

    if (R === 0) return Math.round(principal / N);

    const onePlusRToN = Math.pow(1 + R, N);
    const emi = (principal * R * onePlusRToN) / (onePlusRToN - 1);
    return isNaN(emi) || !isFinite(emi) ? Math.round(principal / N) : Math.round(emi);
  }
};

const calculateCustomMaturity = (depositAmt, rate, durationVal, durationUnit, frequency) => {
  const dAmt = parseFloat(depositAmt) || 0;
  const rVal = parseFloat(rate) || 0;
  const dur = parseFloat(durationVal) || 0;
  if (!dAmt || !dur) return '';

  let totalDays = 0;
  let totalMonths = 0;
  if (durationUnit === 'Days') {
    totalDays = dur;
    totalMonths = dur / 30;
  } else if (durationUnit === 'Months') {
    totalDays = dur * 30;
    totalMonths = dur;
  } else if (durationUnit === 'Years') {
    totalDays = dur * 360;
    totalMonths = dur * 12;
  }

  let instPerYear = 0;
  if (frequency === 'Daily') {
    instPerYear = 360;
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

export default function CustomerProfile() {
  const { id } = useParams();

  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('kyc');
  const [loading, setLoading] = useState(true);

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [agents, setAgents] = useState([]);

  // Add Loan/Saving Modal States
  const [isAddLoanModalOpen, setIsAddLoanModalOpen] = useState(false);
  const [isAddSavingModalOpen, setIsAddSavingModalOpen] = useState(false);
  const [loanPlans, setLoanPlans] = useState([]);
  const [savingPlans, setSavingPlans] = useState([]);
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

  const [editForm, setEditForm] = useState({
    full_name: '',
    mobile: '',
    alternate_mobile: '',
    dob: '',
    gender: 'Male',
    father_or_husband_name: '',
    occupation: '',
    monthly_income: '',
    branch_id: '',
    area_id: '',
    agent_id: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    aadhaar_no: '',
    pan_no: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: ''
  });

  const fetchCustomerProfile = () => {
    setLoading(true);
    customerApi.profile(id)
      .then(res => {
        const data = res.data;
        // Build tabs dynamically from accounts
        const tabs = [];
        const loans = data.loans || data.loan_accounts || [];
        const savings = data.savings || data.saving_accounts || [];
        loans.forEach(la => {
          tabs.push({ id: `loan_${la.loan_account_no}`, name: `Loan (${la.loan_account_no})`, icon: 'credit_score', accountNo: la.loan_account_no, accountType: 'Loan', account: la });
        });
        savings.forEach(sa => {
          tabs.push({ id: `saving_${sa.saving_account_no}`, name: `Saving (${sa.saving_account_no})`, icon: 'savings', accountNo: sa.saving_account_no, accountType: 'Saving', account: sa });
        });
        tabs.push({ id: 'kyc', name: 'KYC & Documents', icon: 'badge' });
        if (loans.length > 0) {
          tabs.push({ id: 'guarantor', name: 'Guarantor Details', icon: 'group' });
        }
        data.tabs = tabs;
        setCustomer(data);
        if (!activeTab || activeTab === 'kyc') {
          setActiveTab(tabs[0]?.id || 'kyc');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomerProfile();
  }, [id]);

  // Live calculations for Custom Loan
  useEffect(() => {
    if (loanForm.loan_plan_id === 'custom') {
      const calculatedEmi = calculateCustomEmi(
        Number(loanForm.principal_amount) || 0,
        Number(loanForm.interest_rate) || 0,
        Number(loanForm.duration_value) || 0,
        loanForm.duration_unit,
        loanForm.collection_frequency,
        loanForm.interest_type
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
    loanForm.interest_type
  ]);

  // Live calculations for Custom Savings
  useEffect(() => {
    if (savingForm.saving_plan_id === 'custom') {
      const calculatedMaturity = calculateCustomMaturity(
        Number(savingForm.deposit_amount) || 0,
        Number(savingForm.interest_rate) || 0,
        Number(savingForm.duration_value) || 0,
        savingForm.duration_unit,
        savingForm.collection_frequency
      );
      setSavingForm(prev => ({ ...prev, maturity_amount: String(calculatedMaturity) }));
    }
  }, [
    savingForm.saving_plan_id,
    savingForm.deposit_amount,
    savingForm.interest_rate,
    savingForm.duration_value,
    savingForm.duration_unit,
    savingForm.collection_frequency
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
    branchApi.list().then(res => setBranches(res.data || [])).catch(() => {});
    areaApi.list().then(res => setAreas(res.data || [])).catch(() => {});
    agentApi.list().then(res => setAgents(res.data || [])).catch(() => {});
    planApi.loanPlans.list().then(res => setLoanPlans(res.data || [])).catch(() => {});
    planApi.savingPlans.list().then(res => setSavingPlans(res.data || [])).catch(() => {});
  }, []);

  const openEditModal = () => {
    setEditForm({
      full_name: customer.full_name || '',
      mobile: customer.mobile || '',
      alternate_mobile: customer.alternate_mobile || '',
      dob: customer.dob || '',
      gender: customer.gender || 'Male',
      father_or_husband_name: customer.father_or_husband_name || '',
      occupation: customer.occupation || '',
      monthly_income: customer.monthly_income || '',
      branch_id: customer.branch_id || '',
      area_id: customer.area_id || '',
      agent_id: customer.agent_id || '',
      address: customer.addresses?.[0]?.address_line1 || '',
      city: customer.addresses?.[0]?.city || '',
      state: customer.addresses?.[0]?.state || '',
      pincode: customer.addresses?.[0]?.pincode || '',
      aadhaar_no: customer.kyc?.aadhaar_no || '',
      pan_no: customer.kyc?.pan_no || '',
      bank_name: customer.kyc?.bank_name || '',
      bank_account_no: customer.kyc?.bank_account_no || '',
      bank_ifsc: customer.kyc?.bank_ifsc || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    if (!editForm.full_name || !editForm.mobile || !editForm.branch_id || !editForm.area_id || !editForm.agent_id) {
      alert("Please fill in all required fields (Name, Mobile, Branch, Area, Agent).");
      return;
    }
    customerApi.update(customer.id, editForm)
      .then(() => {
        alert("Customer profile updated successfully.");
        setIsEditModalOpen(false);
        fetchCustomerProfile();
      })
      .catch(err => {
        alert(err.message || 'Profile update failed.');
      });
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
      customer_id: customer.id,
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
        fetchCustomerProfile();
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
      customer_id: customer.id,
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
        fetchCustomerProfile();
      })
      .catch(err => {
        alert(err.message || 'Failed to apply for savings.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-secondary-text text-sm">
      <span className="material-symbols-rounded animate-spin mr-2 select-none">progress_activity</span>
      Loading customer profile...
    </div>
  );

  if (!customer) return (
    <div className="flex items-center justify-center py-20 text-danger-fin text-sm">Customer not found.</div>
  );

  const tabs = customer.tabs || [];
  const hasLoanAccount = (customer.loan_accounts || []).length > 0;
  const activeTabData = tabs.find(t => t.id === activeTab);

  // Helper: Initials from name
  const initials = (name = '') => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const permAddr = (customer.addresses || []).find(a => a.address_type === 'Permanent') || (customer.addresses || [])[0];
  const fullAddress = permAddr 
    ? `${permAddr.address_line1}${permAddr.address_line2 ? ', ' + permAddr.address_line2 : ''}, ${permAddr.city}, ${permAddr.state} - ${permAddr.pincode}`
    : 'N/A';
  const currAddrObj = (customer.addresses || []).find(a => a.address_type === 'Current');
  const currentAddress = currAddrObj
    ? `${currAddrObj.address_line1}${currAddrObj.address_line2 ? ', ' + currAddrObj.address_line2 : ''}, ${currAddrObj.city}, ${currAddrObj.state} - ${currAddrObj.pincode}`
    : null;

  return (
    <div className="space-y-6">
      {/* Customer Hero summary */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="w-20 h-20 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-2xl">
          {initials(customer.full_name)}
        </div>
        <div className="flex-1 text-center md:text-left space-y-1 w-full">
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
            <h2 className="text-xl font-bold text-[#0F172A]">{customer.full_name}</h2>
            <span className="bg-[#1E3A8A]/5 text-[#1E3A8A] text-[10px] font-bold px-2 py-0.5 rounded-full inline-block w-fit mx-auto md:mx-0">
              {customer.status || 'Active Customer'}
            </span>
            <div className="md:ml-auto flex flex-wrap items-center gap-2 justify-center">
              <button
                onClick={openEditModal}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#0F172A] hover:text-[#1E3A8A] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-rounded text-sm">edit</span>
                Edit Profile
              </button>
              <button
                onClick={() => setIsAddLoanModalOpen(true)}
                className="px-4 py-2 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-rounded text-sm">add_circle</span>
                Add Loan
              </button>
              <button
                onClick={() => setIsAddSavingModalOpen(true)}
                className="px-4 py-2 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-rounded text-sm">add_circle</span>
                Add Savings
              </button>
            </div>
          </div>
          <p className="text-xs text-[#64748B]">{fullAddress}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 text-xs text-[#64748B] pt-1">
            <span className="flex items-center gap-1">
              <span className="material-symbols-rounded text-sm select-none">phone</span> {customer.mobile}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-rounded text-sm select-none">domain</span> {customer.branch_name}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-rounded text-sm select-none">support_agent</span> {customer.agent_name}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-[#64748B] space-y-1">
          <p className="font-bold text-[#0F172A] text-sm">{customer.customer_no}</p>
          <p>ID: #{customer.id}</p>
          <p className="capitalize">{customer.occupation}</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[#E2E8F0] overflow-x-auto space-x-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#1E3A8A] text-[#1E3A8A]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <span className="material-symbols-rounded text-sm select-none">{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm">

        {/* Loan / Saving Account Tab */}
        {activeTabData && (activeTabData.accountType === 'Loan' || activeTabData.accountType === 'Saving') && (() => {
          const acc = activeTabData.account;
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-[#E2E8F0]">
                <div className="p-3 bg-[#F8FAFC] rounded-xl">
                  <span className="text-[10px] text-[#64748B] block mb-0.5">{activeTabData.accountType === 'Loan' ? 'Loan Plan' : 'Savings Plan'}</span>
                  <span className="text-xs font-bold text-[#0F172A]">{acc.plan_name}</span>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-xl">
                  <span className="text-[10px] text-[#64748B] block mb-0.5">{activeTabData.accountType === 'Loan' ? 'Principal Amount' : 'Total Deposited'}</span>
                  <span className="text-xs font-bold text-[#1E3A8A]">₹{Number(acc.principal_amount || acc.total_deposited || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-xl">
                  <span className="text-[10px] text-[#64748B] block mb-0.5">{activeTabData.accountType === 'Loan' ? 'Total Paid' : 'Interest Earned'}</span>
                  <span className="text-xs font-bold text-[#16A34A]">₹{Number(acc.total_paid || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-xl">
                  <span className="text-[10px] text-[#64748B] block mb-0.5">{activeTabData.accountType === 'Loan' ? 'Outstanding Balance' : 'Maturity Date'}</span>
                  <span className="text-xs font-bold text-[#E11D48]">
                    {activeTabData.accountType === 'Loan'
                      ? `₹${Number(acc.outstanding_amount || 0).toLocaleString('en-IN')}`
                      : acc.maturity_date || 'N/A'
                    }
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-4 border-t border-[#E2E8F0] mt-2">
                <p className="text-xs text-[#64748B]">
                  Account Status: <span className="font-bold text-[#0F172A]">{acc.account_status}</span>
                  &nbsp;|&nbsp; Collection Frequency: <span className="font-bold text-[#0F172A] capitalize">{acc.collection_frequency}</span>
                </p>
                <Link
                  to={`/account/${activeTabData.accountNo}`}
                  className="text-xs text-[#1E3A8A] font-bold hover:underline"
                >
                  View Full Ledger &amp; Calendar →
                </Link>
              </div>
            </div>
          );
        })()}

        {/* KYC Tab */}
        {activeTab === 'kyc' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[#E2E8F0] p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Aadhaar Details</span>
                <div className="flex justify-between text-xs">
                  <span>Aadhaar Number:</span>
                  <span className="font-bold">{customer.kyc?.aadhaar_no || 'Not Provided'}</span>
                </div>
                {customer.aadhaar_front_url && (
                  <div className="flex gap-2 pt-2">
                    <a href={customer.aadhaar_front_url} target="_blank" rel="noreferrer" className="flex-1 border border-[#E2E8F0] p-2 bg-[#F8FAFC] rounded-lg text-center text-[10px] text-[#1E3A8A] font-semibold cursor-pointer hover:bg-[#1E3A8A]/5 transition-all">
                      Download Aadhaar Front
                    </a>
                    {customer.aadhaar_back_url && (
                      <a href={customer.aadhaar_back_url} target="_blank" rel="noreferrer" className="flex-1 border border-[#E2E8F0] p-2 bg-[#F8FAFC] rounded-lg text-center text-[10px] text-[#1E3A8A] font-semibold cursor-pointer hover:bg-[#1E3A8A]/5 transition-all">
                        Download Aadhaar Back
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="border border-[#E2E8F0] p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">PAN Details</span>
                <div className="flex justify-between text-xs">
                  <span>PAN Number:</span>
                  <span className="font-bold">{customer.kyc?.pan_no || 'Not Provided'}</span>
                </div>
                {customer.pan_url && (
                  <div className="pt-2">
                    <a href={customer.pan_url} target="_blank" rel="noreferrer" className="block border border-[#E2E8F0] p-2 bg-[#F8FAFC] rounded-lg text-center text-[10px] text-[#1E3A8A] font-semibold cursor-pointer hover:bg-[#1E3A8A]/5 transition-all">
                      Download PAN Image
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-[#E2E8F0] p-4 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">Bank Account Details</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                <div>
                  <span className="text-[#64748B] block mb-0.5">Bank Name:</span>
                  <span className="font-bold text-[#0F172A]">{customer.kyc?.bank_name || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Account Number:</span>
                  <span className="font-bold text-[#0F172A]">{customer.kyc?.bank_account_no || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">IFSC Code:</span>
                  <span className="font-bold text-[#0F172A]">{customer.kyc?.bank_ifsc || 'Not Provided'}</span>
                </div>
              </div>
            </div>

            <div className="border border-[#E2E8F0] p-4 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">Personal Information</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                <div>
                  <span className="text-[#64748B] block mb-0.5">Date of Birth:</span>
                  <span className="font-bold text-[#0F172A]">{customer.dob || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Gender:</span>
                  <span className="font-bold text-[#0F172A]">{customer.gender || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Occupation:</span>
                  <span className="font-bold text-[#0F172A]">{customer.occupation || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Father's Name:</span>
                  <span className="font-bold text-[#0F172A]">{customer.father_or_husband_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Monthly Income:</span>
                  <span className="font-bold text-[#0F172A]">₹{Number(customer.monthly_income || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Alternate Mobile:</span>
                  <span className="font-bold text-[#0F172A]">{customer.alternate_mobile || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="border border-[#E2E8F0] p-4 rounded-xl space-y-3">
              <span className="text-[10px] font-bold text-[#64748B] uppercase block border-b border-[#F1F5F9] pb-1.5">Addresses Details</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1 bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                  <span className="text-[#64748B] font-bold block mb-0.5">Permanent Address:</span>
                  <span className="font-medium text-[#0F172A] leading-relaxed">{fullAddress}</span>
                </div>
                {currentAddress && (
                  <div className="space-y-1 bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                    <span className="text-[#64748B] font-bold block mb-0.5">Current Address:</span>
                    <span className="font-medium text-[#0F172A] leading-relaxed">{currentAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Guarantor Tab */}
        {activeTab === 'guarantor' && (
          <div className="space-y-6">
            {customer.guarantors && customer.guarantors.length > 0 ? (
              customer.guarantors.map((g, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[#64748B]">Guarantor Name:</span>
                      <span className="font-bold text-[#0F172A]">{g.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[#64748B]">Mobile Number:</span>
                      <span className="font-bold text-[#0F172A]">{g.mobile}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[#64748B]">Relation:</span>
                      <span className="font-bold text-[#0F172A]">{g.relation}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[#64748B]">Aadhaar Number:</span>
                      <span className="font-bold text-[#0F172A]">{g.aadhaar_no || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[#64748B]">Address:</span>
                      <span className="font-bold text-[#0F172A]">{g.address || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-secondary-text text-sm">No guarantor information recorded.</div>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (() => {
        const branchOptions = branches.map(b => ({ value: b.id, label: b.name }));
        const areaOptions = areas.map(a => ({ value: a.id, label: a.name }));
        const agentOptions = agents.map(ag => ({ value: ag.id, label: ag.name }));
        const genderOptions = [
          { value: 'Male', label: 'Male' },
          { value: 'Female', label: 'Female' },
          { value: 'Other', label: 'Other' }
        ];

        return (
          <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto animate-scale-up">
              <div className="flex justify-between items-center border-b border-[#F1F5F9] pb-4">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="material-symbols-rounded text-lg text-[#1E3A8A] select-none">edit_document</span>
                  Edit Customer Profile
                </h3>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer transition-all"
                >
                  <span className="material-symbols-rounded text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {/* Section 1: Personal Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">Personal Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Full Name *</label>
                      <input 
                        type="text" 
                        required
                        value={editForm.full_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Mobile Number *</label>
                      <input 
                        type="text" 
                        required
                        value={editForm.mobile}
                        onChange={(e) => setEditForm(prev => ({ ...prev, mobile: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Alternate Mobile</label>
                      <input 
                        type="text" 
                        value={editForm.alternate_mobile}
                        onChange={(e) => setEditForm(prev => ({ ...prev, alternate_mobile: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Father's Name</label>
                      <input 
                        type="text" 
                        value={editForm.father_or_husband_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, father_or_husband_name: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                    <div className="sm:col-span-2">
                      <DatePicker 
                        label="Date of Birth"
                        value={editForm.dob}
                        onChange={(val) => setEditForm(prev => ({ ...prev, dob: val }))}
                      />
                    </div>
                    <div>
                      <Select 
                        label="Gender"
                        options={genderOptions}
                        value={editForm.gender}
                        onChange={(val) => setEditForm(prev => ({ ...prev, gender: val }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Occupation</label>
                      <input 
                        type="text" 
                        value={editForm.occupation}
                        onChange={(e) => setEditForm(prev => ({ ...prev, occupation: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Monthly Income (₹)</label>
                      <input 
                        type="number" 
                        value={editForm.monthly_income}
                        onChange={(e) => setEditForm(prev => ({ ...prev, monthly_income: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Branch, Area & Agent */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">Branch & Area Assignment</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Select 
                      label="Branch *"
                      options={branchOptions}
                      value={Number(editForm.branch_id)}
                      onChange={(val) => setEditForm(prev => ({ ...prev, branch_id: val }))}
                    />
                    <Select 
                      label="Area *"
                      options={areaOptions}
                      value={Number(editForm.area_id)}
                      onChange={(val) => setEditForm(prev => ({ ...prev, area_id: val }))}
                    />
                    <Select 
                      label="Agent *"
                      options={agentOptions}
                      value={Number(editForm.agent_id)}
                      onChange={(val) => setEditForm(prev => ({ ...prev, agent_id: val }))}
                    />
                  </div>
                </div>

                {/* Section 3: Address */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">Residential Address</h4>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Address Line 1</label>
                    <input 
                      type="text" 
                      value={editForm.address}
                      onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">City</label>
                      <input 
                        type="text" 
                        value={editForm.city}
                        onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">State</label>
                      <input 
                        type="text" 
                        value={editForm.state}
                        onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Pincode</label>
                      <input 
                        type="text" 
                        value={editForm.pincode}
                        onChange={(e) => setEditForm(prev => ({ ...prev, pincode: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: KYC & Bank */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">KYC & Bank Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Aadhaar Number</label>
                      <input 
                        type="text" 
                        value={editForm.aadhaar_no}
                        onChange={(e) => setEditForm(prev => ({ ...prev, aadhaar_no: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">PAN Number</label>
                      <input 
                        type="text" 
                        value={editForm.pan_no}
                        onChange={(e) => setEditForm(prev => ({ ...prev, pan_no: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Bank Name</label>
                      <input 
                        type="text" 
                        value={editForm.bank_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bank_name: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Bank Account Number</label>
                      <input 
                        type="text" 
                        value={editForm.bank_account_no}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bank_account_no: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">IFSC Code</label>
                      <input 
                        type="text" 
                        value={editForm.bank_ifsc}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bank_ifsc: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t border-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center shadow-sm"
                  >
                    Save Profile Details
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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
                <span className="material-symbols-rounded text-base text-[#1E3A8A] select-none">credit_score</span>
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
                <Select
                  label="Select Loan Plan"
                  required={true}
                  options={[
                    { value: "", label: "-- Choose a Plan --" },
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
                        emi_amount: '',
                        processing_fee: '0',
                        penalty_per_day: '0'
                      }));
                    } else {
                      const selected = loanPlans.find(p => String(p.id) === planId);
                      setLoanForm(prev => ({
                        ...prev,
                        loan_plan_id: planId,
                        principal_amount: selected ? String(selected.min_amount) : ''
                      }));
                    }
                  }}
                  searchable={true}
                />

                {loanForm.loan_plan_id === 'custom' && (
                  <div className="border-t border-[#F1F5F9] pt-4 mt-2 space-y-4">
                    <h4 className="text-[11px] font-bold text-[#1E3A8A] uppercase tracking-wider">Custom Loan Details</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Principal Amount (₹) *</label>
                        <input 
                          type="number"
                          required
                          min="1"
                          value={loanForm.principal_amount}
                          onChange={(e) => setLoanForm({ ...loanForm, principal_amount: e.target.value })}
                          className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                          placeholder="E.g., 10000"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Interest Rate (%) *</label>
                        <input 
                          type="number"
                          required
                          step="0.01"
                          min="0"
                          value={loanForm.interest_rate}
                          onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })}
                          className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
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
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Duration *</label>
                        <div className="flex gap-2">
                          <input 
                            type="number"
                            required
                            min="1"
                            value={loanForm.duration_value}
                            onChange={(e) => setLoanForm({ ...loanForm, duration_value: e.target.value })}
                            className="flex-1 h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
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
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Installment / EMI (₹) *</label>
                        <input 
                          type="number"
                          required
                          min="1"
                          value={loanForm.emi_amount}
                          onChange={(e) => setLoanForm({ ...loanForm, emi_amount: e.target.value })}
                          className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
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
                          className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
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
                          className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                          placeholder="E.g., 10"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {loanForm.loan_plan_id && loanForm.loan_plan_id !== 'custom' && (
                  <div className="space-y-1 pt-2">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Principal Amount (₹) *</label>
                    <input 
                      type="number"
                      required
                      min="1"
                      value={loanForm.principal_amount}
                      onChange={(e) => setLoanForm({ ...loanForm, principal_amount: e.target.value })}
                      className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
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
                        const emi = loanForm.loan_plan_id === 'custom' ? (Number(loanForm.emi_amount) || 0) : Math.round((principal + (type === 'Flat' ? (principal * (rate / 100)) : (principal * (rate / 100) * 0.7))) / (duration || 1));
                        const totalInterest = type === 'Flat' ? (principal * (rate / 100)) : (principal * (rate / 100) * 0.7);
                        const totalPayable = principal + totalInterest;

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
                              <span className="text-[#1E3A8A] font-bold">Duration</span>
                              <span className="font-extrabold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                                {duration} {durationUnit}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-xs bg-[#1E3A8A]/5 border border-[#1E3A8A]/10 px-3 py-2 rounded-xl">
                              <span className="text-[#1E3A8A] font-bold">Installment (EMI)</span>
                              <span className="font-extrabold text-[#1E3A8A] bg-white px-2 py-0.5 rounded border border-[#1E3A8A]/10">
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
                    className="flex-1 h-10 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
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
                <span className="material-symbols-rounded text-base text-[#F59E0B] select-none">savings</span>
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
                    <h4 className="text-[11px] font-bold text-[#F59E0B] uppercase tracking-wider">
                      {savingForm.saving_plan_id === 'custom' ? 'Custom Savings Details' : 'Savings Plan Parameters'}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Deposit Amount (₹) *</label>
                        <input 
                          type="number"
                          required
                          min="1"
                          value={savingForm.deposit_amount}
                          onChange={(e) => setSavingForm({ ...savingForm, deposit_amount: e.target.value })}
                          className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                          placeholder="E.g., 100"
                          readOnly={savingForm.saving_plan_id !== 'custom' && selectedSavingPlanObj?.deposit_amount > 0}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Interest Rate (%) *</label>
                        <input 
                          type="number"
                          required
                          step="0.01"
                          min="0"
                          value={savingForm.interest_rate}
                          onChange={(e) => setSavingForm({ ...savingForm, interest_rate: e.target.value })}
                          className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                          placeholder="E.g., 6.5"
                          readOnly={savingForm.saving_plan_id !== 'custom'}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Duration *</label>
                        {savingForm.saving_plan_id === 'custom' ? (
                          <div className="flex gap-2">
                            <input 
                              type="number"
                              required
                              min="1"
                              value={savingForm.duration_value}
                              onChange={(e) => setSavingForm({ ...savingForm, duration_value: e.target.value })}
                              className="flex-1 h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
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
                          <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Frequency *</label>
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
                            <div className="flex justify-between items-center text-xs bg-[#F59E0B]/5 border border-[#F59E0B]/10 px-3 py-2 rounded-xl">
                              <span className="text-[#F59E0B] font-bold">Deposit ({frequency})</span>
                              <span className="font-extrabold text-[#F59E0B] bg-white px-2 py-0.5 rounded border border-[#F59E0B]/10">
                                ₹{deposit.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex justify-between text-xs">
                              <span className="text-[#64748B] font-semibold">Interest Rate</span>
                              <strong className="text-[#0F172A] font-extrabold">{rate}%</strong>
                            </div>

                            <div className="flex justify-between items-center text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                              <span className="text-[#F59E0B] font-bold">Duration</span>
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
                    className="flex-1 h-10 bg-[#EA580C] hover:bg-[#EA580C]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
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
