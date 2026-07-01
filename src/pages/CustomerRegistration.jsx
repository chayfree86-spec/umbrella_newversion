import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import { branchApi, areaApi, agentApi, planApi, customerApi, settingsApi } from '../services/api';

const getTodayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

const calculateCustomEmi = (principal, rate, durationVal, durationUnit, frequency, interestType, loanPeriod = 'monthly') => {
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
    const timeFactor = loanPeriod === 'yearly' ? (totalMonths / 12) : totalMonths;
    const interest = principal * (rate / 100) * timeFactor;
    const totalPayable = principal + interest;
    return Math.round(totalPayable / N);
  } else {
    let R = 0;
    if (frequency === 'Daily') {
      R = loanPeriod === 'yearly' ? ((rate / 100) / 365) : (((rate / 100) * 12) / 365);
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

const defaultAccounts = {
  'LN-9082': {
    accNo: 'LN-9082',
    type: 'Loan',
    accountStatus: 'Approved',
    approvedDate: '15-04-2026',
    todayStatus: 'Pending',
    planName: 'Durga Shakti Personal Loan',
    approvedAmt: 10000,
    disbursedAmt: 9800,
    processingFee: 200,
    interestRate: '12% Flat p.a.',
    disbursalDate: '15-04-2026',
    totalPaid: 6500,
    outstanding: 3500,
    emiAmt: 112,
    paymentCycle: 'Daily',
    tenureDays: 100,
    paidDays: 58,
    nextDueDate: '29-06-2026',
    pendingDue: 224,
    fine: 0,
    customer: {
      id: 'c1',
      name: 'Sumit Kumar',
      phone: '9876543210',
      aadhaar: '1234 5678 9012',
      pan: 'ABCDE1234F',
      address: 'H.No 12, Gandhi Marg, Hazratganj, Lucknow, UP - 226001',
      occupation: 'Retail Shopkeeper',
      monthlyIncome: '₹22,000',
      bank: {
        name: 'State Bank of India',
        accountNo: '30291049281',
        ifsc: 'SBIN0001234',
        cheque: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150'
      }
    },
    guarantor: {
      name: 'Satish Sharma',
      phone: '9876543212',
      relation: 'Friend',
      aadhaar: '1234 5678 9013',
      address: 'Gomti Nagar, Lucknow, UP',
      income: '₹25,000 / month',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      aadhaarFront: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150',
      aadhaarBack: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150'
    },
    ledger: [
      { id: '101', date: '28-06-2026', refNo: 'RC-2026-8902', type: 'EMI Payment', amt: 112, fine: 0, collector: 'Rahul Singh' },
      { id: '102', date: '27-06-2026', refNo: 'RC-2026-8791', type: 'EMI Payment', amt: 112, fine: 0, collector: 'Rahul Singh' },
      { id: '103', date: '26-06-2026', refNo: 'RC-2026-8604', type: 'EMI Payment', amt: 112, fine: 10, collector: 'Rahul Singh' },
      { id: '104', date: '25-06-2026', refNo: 'RC-2026-8511', type: 'EMI Payment', amt: 112, fine: 0, collector: 'Rahul Singh' },
      { id: '105', date: '24-06-2026', refNo: 'RC-2026-8409', type: 'EMI Payment', amt: 112, fine: 0, collector: 'Vikas Kumar' }
    ]
  },
  'SV-4109': {
    accNo: 'SV-4109',
    type: 'Saving',
    accountStatus: 'Approved',
    approvedDate: '20-04-2026',
    todayStatus: 'Paid',
    planName: 'Daily Pragati Savings',
    approvedAmt: 0,
    disbursedAmt: 0,
    processingFee: 0,
    interestRate: '6.5%',
    disbursalDate: '20-04-2026',
    totalPaid: 12500,
    outstanding: 0,
    emiAmt: 100,
    paymentCycle: 'Daily',
    tenureDays: 365,
    paidDays: 125,
    nextDueDate: '29-06-2026',
    pendingDue: 0,
    fine: 0,
    customer: {
      id: 'c1',
      name: 'Sumit Kumar',
      phone: '9876543210',
      aadhaar: '1234 5678 9012',
      pan: 'ABCDE1234F',
      address: 'H.No 12, Gandhi Marg, Hazratganj, Lucknow, UP - 226001',
      occupation: 'Retail Shopkeeper',
      monthlyIncome: '₹22,000',
      bank: {
        name: 'State Bank of India',
        accountNo: '30291049281',
        ifsc: 'SBIN0001234',
        cheque: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150'
      }
    },
    nominee: {
      name: 'Kusum Devi',
      phone: '9876543219',
      relation: 'Mother',
      age: '52 Years',
      share: '100%',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      aadhaarFront: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150',
      aadhaarBack: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150'
    },
    ledger: [
      { id: '201', date: '28-06-2026', refNo: 'RC-2026-8903', type: 'Savings Deposit', amt: 100, fine: 0, collector: 'Amit Verma' },
      { id: '202', date: '27-06-2026', refNo: 'RC-2026-8800', type: 'Savings Deposit', amt: 100, fine: 0, collector: 'Amit Verma' },
      { id: '203', date: '25-06-2026', refNo: 'RC-2026-8591', type: 'Savings Deposit', amt: 100, fine: 0, collector: 'Amit Verma' },
      { id: '204', date: '24-06-2026', refNo: 'RC-2026-8488', type: 'Savings Deposit', amt: 100, fine: 0, collector: 'Amit Verma' }
    ]
  },
  'LN-8830': {
    accNo: 'LN-8830',
    type: 'Loan',
    accountStatus: 'Defaulter',
    approvedDate: '10-05-2026',
    todayStatus: 'Overdue',
    planName: 'Vyapar Vriddhi Loan',
    approvedAmt: 50000,
    disbursedAmt: 49000,
    processingFee: 1000,
    interestRate: '14% Flat p.a.',
    disbursalDate: '10-05-2026',
    totalPaid: 5000,
    outstanding: 45000,
    emiAmt: 4512,
    paymentCycle: 'Daily',
    tenureDays: 120,
    paidDays: 42,
    nextDueDate: '29-06-2026',
    pendingDue: 4512,
    fine: 50,
    customer: {
      id: 'c1',
      name: 'Sumit Kumar',
      phone: '9876543210',
      aadhaar: '1234 5678 9012',
      pan: 'ABCDE1234F',
      address: 'H.No 12, Gandhi Marg, Hazratganj, Lucknow, UP - 226001',
      occupation: 'Retail Shopkeeper',
      monthlyIncome: '₹22,000',
      bank: {
        name: 'State Bank of India',
        accountNo: '30291049281',
        ifsc: 'SBIN0001234',
        cheque: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150'
      }
    },
    guarantor: {
      name: 'Satish Sharma',
      phone: '9876543212',
      relation: 'Friend',
      aadhaar: '1234 5678 9013',
      address: 'Gomti Nagar, Lucknow, UP',
      income: '₹25,000 / month',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      aadhaarFront: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150',
      aadhaarBack: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150'
    },
    ledger: [
      { id: '301', date: '28-06-2026', refNo: 'RC-2026-8904', type: 'EMI Payment', amt: 4512, fine: 0, collector: 'Rahul Singh' },
      { id: '302', date: '27-06-2026', refNo: 'RC-2026-8801', type: 'EMI Payment', amt: 4512, fine: 0, collector: 'Rahul Singh' }
    ]
  },
  'SV-1049': {
    accNo: 'SV-1049',
    type: 'Saving',
    accountStatus: 'Processing',
    approvedDate: null,
    todayStatus: 'Pending',
    planName: 'Daily Pragati Savings',
    approvedAmt: 0,
    disbursedAmt: 0,
    processingFee: 0,
    interestRate: '6.5%',
    disbursalDate: null,
    totalPaid: 0,
    outstanding: 25000,
    emiAmt: 200,
    paymentCycle: 'Daily',
    tenureDays: 365,
    paidDays: 0,
    nextDueDate: 'Awaiting Approval',
    pendingDue: 200,
    fine: 0,
    customer: {
      id: 'c4',
      name: 'Sunita Sharma',
      phone: '9876543220',
      aadhaar: '1234 5678 9016',
      pan: 'PQRST1234Q',
      address: 'Kalyanpur, Kanpur, Uttar Pradesh - 208017',
      occupation: 'School Teacher',
      monthlyIncome: '₹25,000',
      bank: {
        name: 'ICICI Bank',
        accountNo: '60292049284',
        ifsc: 'ICIC0005678',
        cheque: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150'
      }
    },
    nominee: {
      name: 'Satish Sharma',
      phone: '9876543212',
      relation: 'Friend',
      age: '32 Years',
      share: '100%',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      aadhaarFront: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150',
      aadhaarBack: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150'
    },
    ledger: []
  },
  'LN-8722': {
    accNo: 'LN-8722',
    type: 'Loan',
    accountStatus: 'Account Closed',
    approvedDate: '01-01-2026',
    todayStatus: 'Closed',
    planName: 'Durga Shakti Personal Loan',
    approvedAmt: 15000,
    disbursedAmt: 14700,
    processingFee: 300,
    interestRate: '12% Flat p.a.',
    disbursalDate: '01-01-2026',
    totalPaid: 15000,
    outstanding: 0,
    emiAmt: 112,
    paymentCycle: 'Daily',
    tenureDays: 100,
    paidDays: 100,
    nextDueDate: 'Completed',
    pendingDue: 0,
    fine: 0,
    customer: {
      id: 'c5',
      name: 'Ramesh Chandra',
      phone: '9876543221',
      aadhaar: '1234 5678 9017',
      pan: 'UVWXY1234R',
      address: 'Alambagh, Lucknow, Uttar Pradesh - 226005',
      occupation: 'Retail Shopkeeper',
      monthlyIncome: '₹40,000',
      bank: {
        name: 'Bank of Baroda',
        accountNo: '70292049285',
        ifsc: 'BARB0ALAMBA',
        cheque: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150'
      }
    },
    guarantor: {
      name: 'Satish Sharma',
      phone: '9876543212',
      relation: 'Friend',
      aadhaar: '1234 5678 9013',
      address: 'Gomti Nagar, Lucknow, UP',
      income: '₹25,000 / month',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      aadhaarFront: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150',
      aadhaarBack: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150'
    },
    ledger: [
      { id: '401', date: '10-04-2026', refNo: 'RC-2026-1102', type: 'Final Clearance', amt: 150, fine: 0, collector: 'Rahul Singh' },
      { id: '402', date: '09-04-2026', refNo: 'RC-2026-1099', type: 'EMI Payment', amt: 150, fine: 0, collector: 'Rahul Singh' }
    ]
  }
};

export default function CustomerRegistration() {
  const [branches, setBranches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [agents, setAgents] = useState([]);
  const [dbLoanPlans, setDbLoanPlans] = useState([]);
  const [dbSavingPlans, setDbSavingPlans] = useState([]);
  const [liveSettings, setLiveSettings] = useState({});

  // Load initial form data from localStorage or default
  const getInitialFormData = () => {
    const saved = localStorage.getItem('customer_registration_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.startDate) parsed.startDate = getTodayDateString();
        return parsed;
      } catch (e) {
        // Fallback
      }
    }
    return {
      accountType: 'Loan',
      planId: '',
      startDate: getTodayDateString(),
      customAmount: '',
      customRate: localStorage.getItem('custom_interest_rate') || '',
      customDuration: '',
      customDurationUnit: 'Days',
      customFrequency: 'Daily',
      customType: 'Flat',
      customEmi: '',
      customProcessingFee: '0',
      customPenalty: '0',
      customDailyDeposit: '',
      customMaturity: '',
      fullName: '',
      mobile: '',
      altMobile: '',
      dob: '',
      gender: 'Male',
      fatherHusbandName: '',
      occupation: '',
      monthlyIncome: '',
      branch: '',
      area: '',
      agent: '',
      photo: null,
      houseNumber: '',
      street: '',
      villageCity: '',
      landmark: '',
      district: '',
      state: 'Uttar Pradesh',
      pinCode: '',
      aadhaarNumber: '',
      panNumber: '',
      bankName: '',
      bankAccountNo: '',
      bankIfsc: '',
      chequeUpload: null,
      aadhaarFront: null,
      aadhaarBack: null,
      panUpload: null,
      signature: null,
      guarantorPhoto: null,
      guarantorName: '',
      guarantorMobile: '',
      guarantorRelation: '',
      guarantorAddress: '',
      guarantorAadhaar: '',
      guarantorAadhaarFront: null,
      guarantorAadhaarBack: null
    };
  };

  const location = useLocation();
  const [formData, setFormData] = useState(getInitialFormData);

  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem('customer_registration_step');
    return saved ? Number(saved) : 1;
  });

  // Load draft from accounts_database_v2 if draftId query param is present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const draftId = params.get('draftId');
    if (draftId) {
      const dbSaved = localStorage.getItem('accounts_database_v2');
      if (dbSaved) {
        const db = JSON.parse(dbSaved);
        const draftAccount = db[draftId];
        if (draftAccount && draftAccount.accountStatus === 'Pending') {
          const cust = draftAccount.customer || {};
          const guar = draftAccount.guarantor || {};
          const nom = draftAccount.nominee || {};
          
          setFormData({
            accountType: draftAccount.type || 'Loan',
            planId: draftAccount.planId || '',
            startDate: draftAccount.approvedDate || getTodayDateString(),
            customAmount: draftAccount.approvedAmt || '',
            customRate: draftAccount.interestRate || '',
            customDuration: draftAccount.tenureDays || '',
            customDurationUnit: 'Days',
            customFrequency: draftAccount.paymentCycle || 'Daily',
            customType: 'Flat',
            customEmi: draftAccount.emiAmt || '',
            customProcessingFee: draftAccount.processingFee || '0',
            customPenalty: '0',
            customDailyDeposit: draftAccount.emiAmt || '',
            customMaturity: '',
            fullName: cust.name || '',
            mobile: cust.phone || '',
            altMobile: cust.altPhone || '',
            dob: cust.dob || '',
            gender: cust.gender || 'Male',
            fatherHusbandName: cust.fatherName || '',
            occupation: cust.occupation || '',
            monthlyIncome: cust.monthlyIncome || '',
            branch: cust.branch || '',
            area: cust.area || '',
            agent: cust.agent || '',
            photo: cust.photo || null,
            houseNumber: cust.houseNumber || '',
            street: cust.street || '',
            villageCity: cust.villageCity || '',
            landmark: cust.landmark || '',
            district: cust.district || '',
            state: cust.state || 'Uttar Pradesh',
            pinCode: cust.pinCode || '',
            aadhaarNumber: cust.aadhaarNo || '',
            panNumber: cust.panNo || '',
            bankName: cust.bank?.name || '',
            bankAccountNo: cust.bank?.accountNo || '',
            bankIfsc: cust.bank?.ifsc || '',
            chequeUpload: cust.bank?.cheque || null,
            aadhaarFront: cust.aadhaarFront || null,
            aadhaarBack: cust.aadhaarBack || null,
            panUpload: cust.panUpload || null,
            signature: cust.signature || null,
            guarantorPhoto: guar.photo || null,
            guarantorName: guar.name || '',
            guarantorMobile: guar.phone || '',
            guarantorRelation: guar.relation || '',
            guarantorAddress: guar.address || '',
            guarantorAadhaar: guar.aadhaar || '',
            guarantorAadhaarFront: guar.aadhaarFront || null,
            guarantorAadhaarBack: guar.aadhaarBack || null,
            nomineeName: nom.name || '',
            nomineeMobile: nom.phone || '',
            nomineeRelation: nom.relation || '',
            nomineeAge: nom.age || '',
            nomineeShare: nom.share || '100%',
            nomineePhoto: nom.photo || null,
            nomineeAadhaarFront: nom.aadhaarFront || null,
            nomineeAadhaarBack: nom.aadhaarBack || null
          });
          if (draftAccount.draftStep) {
            setCurrentStep(Number(draftAccount.draftStep));
          }
        }
      }
    }
  }, [location.search]);

  // Auto-save draft state to accounts_database_v2 as a Pending draft
  useEffect(() => {
    let draftId = new URLSearchParams(location.search).get('draftId');
    if (!draftId) {
      draftId = localStorage.getItem('current_registration_draft_id');
      if (!draftId) {
        draftId = `DFT-${Math.floor(1000 + Math.random() * 9000)}`;
        localStorage.setItem('current_registration_draft_id', draftId);
      }
    }

    const dbSaved = localStorage.getItem('accounts_database_v2');
    let db = {};
    if (dbSaved) {
      db = JSON.parse(dbSaved);
    } else {
      db = defaultAccounts;
    }

    // Skip saving empty form
    if (!formData.fullName && !formData.mobile && currentStep === 1) {
      return;
    }

    db[draftId] = {
      accNo: draftId,
      type: formData.accountType,
      accountStatus: 'Pending',
      approvedDate: null,
      todayStatus: 'Pending',
      planName: formData.accountType === 'Saving' ? 'Daily Pragati Savings' : 'Vyapar Vriddhi Loan',
      planId: formData.planId,
      approvedAmt: parseFloat(formData.customAmount) || 0,
      disbursedAmt: parseFloat(formData.customAmount) * 0.98 || 0,
      processingFee: parseFloat(formData.customProcessingFee) || 0,
      interestRate: formData.customRate || '12%',
      disbursalDate: null,
      totalPaid: 0,
      outstanding: parseFloat(formData.customAmount) || 0,
      emiAmt: parseFloat(formData.accountType === 'Saving' ? formData.customDailyDeposit : formData.customEmi) || 0,
      paymentCycle: formData.customFrequency || 'Daily',
      tenureDays: parseInt(formData.customDuration) || 0,
      paidDays: 0,
      nextDueDate: 'Draft Form',
      pendingDue: 0,
      fine: 0,
      draftStep: currentStep,
      customer: {
        id: `c_${draftId}`,
        name: formData.fullName || 'Draft Customer',
        phone: formData.mobile || '',
        altPhone: formData.altMobile || '',
        dob: formData.dob || '',
        gender: formData.gender || 'Male',
        fatherName: formData.fatherHusbandName || '',
        occupation: formData.occupation || '',
        monthlyIncome: formData.monthlyIncome || '',
        branch: formData.branch || 'Main Branch - Lucknow',
        area: formData.area || '',
        agent: formData.agent || '',
        photo: formData.photo || null,
        houseNumber: formData.houseNumber,
        street: formData.street,
        villageCity: formData.villageCity,
        landmark: formData.landmark,
        district: formData.district,
        state: formData.state || 'Uttar Pradesh',
        pinCode: formData.pinCode,
        aadhaarNo: formData.aadhaarNumber || '',
        panNo: formData.panNumber || '',
        bank: {
          name: formData.bankName,
          accountNo: formData.bankAccountNo,
          ifsc: formData.bankIfsc,
          cheque: formData.chequeUpload
        },
        aadhaarFront: formData.aadhaarFront,
        aadhaarBack: formData.aadhaarBack,
        panUpload: formData.panUpload,
        signature: formData.signature
      },
      guarantor: {
        name: formData.guarantorName,
        phone: formData.guarantorMobile,
        relation: formData.guarantorRelation,
        address: formData.guarantorAddress,
        aadhaar: formData.guarantorAadhaar,
        photo: formData.guarantorPhoto,
        aadhaarFront: formData.guarantorAadhaarFront,
        aadhaarBack: formData.guarantorAadhaarBack
      },
      nominee: {
        name: formData.nomineeName,
        phone: formData.nomineeMobile,
        relation: formData.nomineeRelation,
        age: formData.nomineeAge,
        share: formData.nomineeShare || '100%',
        photo: formData.nomineePhoto,
        aadhaarFront: formData.nomineeAadhaarFront,
        aadhaarBack: formData.nomineeAadhaarBack
      },
      ledger: []
    };

    localStorage.setItem('accounts_database_v2', JSON.stringify(db));
    localStorage.setItem('customer_registration_draft', JSON.stringify(formData));
  }, [formData, currentStep, location.search]);

  useEffect(() => {
    localStorage.setItem('customer_registration_step', String(currentStep));
  }, [currentStep]);

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

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
      .then(res => setAgents(res.data || []))
      .catch(() => {});

    // Load Plans
    planApi.loanPlans.list()
      .then(res => setDbLoanPlans(res.data || []))
      .catch(() => {});

    planApi.savingPlans.list()
      .then(res => setDbSavingPlans(res.data || []))
      .catch(() => {});

    settingsApi.get()
      .then(res => setLiveSettings(res.data || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        const textInputTypes = ['text', 'number', 'tel', 'email', 'password', 'search', 'url'];
        const firstInput = Array.from(form.elements).find(
          el => el.tagName === 'INPUT' && 
                !el.disabled && 
                el.type !== 'hidden' && 
                textInputTypes.includes(el.type) &&
                el.placeholder !== 'DD-MM-YYYY' // Do not auto-focus date picker inputs
        );
        if (firstInput) {
          firstInput.focus();
          firstInput.select();
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStep, formData.planId]);

  // Custom Themed Modal States
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const [successDialog, setSuccessDialog] = useState({
    isOpen: false,
    title: '',
    message: ''
  });

  const [warningDialog, setWarningDialog] = useState({
    isOpen: false,
    title: '',
    message: ''
  });

  const [pendingFocusField, setPendingFocusField] = useState(null);

  const triggerConfirm = (title, message, callback) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        callback();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  const showSuccess = (title, message) => {
    setSuccessDialog({
      isOpen: true,
      title,
      message
    });
  };

  const showWarning = (title, message) => {
    setWarningDialog({
      isOpen: true,
      title,
      message
    });
  };

  // Step & Form Reset Handlers
  const resetStep1 = () => {
    triggerConfirm(
      'Reset Account Setup',
      'Are you sure you want to clear all account and plan details in Step 1?',
      () => {
        setFormData(prev => ({
          ...prev,
          accountType: 'Loan',
          planId: '',
          startDate: getTodayDateString(),
          customAmount: '',
          customRate: localStorage.getItem('custom_interest_rate') || '',
          customDuration: '',
          customDurationUnit: 'Days',
          customFrequency: 'Daily',
          customType: 'Flat',
          customEmi: '',
          customProcessingFee: '0',
          customPenalty: '0',
          customDailyDeposit: '',
          customMaturity: ''
        }));
      }
    );
  };

  const resetStep2 = () => {
    triggerConfirm(
      'Reset Customer Details',
      'Are you sure you want to clear all personal profile details in Step 2?',
      () => {
        setFormData(prev => ({
          ...prev,
          fullName: '',
          mobile: '',
          altMobile: '',
          dob: '',
          gender: 'Male',
          fatherHusbandName: '',
          occupation: '',
          monthlyIncome: '',
          branch: '',
          area: '',
          agent: '',
          photo: null
        }));
      }
    );
  };

  const resetStep3 = () => {
    triggerConfirm(
      'Reset Address Details',
      'Are you sure you want to clear all address fields in Step 3?',
      () => {
        setFormData(prev => ({
          ...prev,
          houseNumber: '',
          street: '',
          villageCity: '',
          landmark: '',
          district: '',
          state: 'Uttar Pradesh',
          pinCode: ''
        }));
      }
    );
  };

  const resetStep4 = () => {
    triggerConfirm(
      'Reset KYC Details',
      'Are you sure you want to clear all KYC inputs and uploads in Step 4?',
      () => {
        setFormData(prev => ({
          ...prev,
          aadhaarNumber: '',
          panNumber: '',
          bankName: '',
          bankAccountNo: '',
          bankIfsc: '',
          chequeUpload: null,
          aadhaarFront: null,
          aadhaarBack: null,
          panUpload: null,
          signature: null
        }));
      }
    );
  };

  const resetStep5 = () => {
    triggerConfirm(
      'Reset Guarantor Details',
      'Are you sure you want to clear all guarantor information in Step 5?',
      () => {
        setFormData(prev => ({
          ...prev,
          guarantorPhoto: null,
          guarantorName: '',
          guarantorMobile: '',
          guarantorRelation: '',
          guarantorAddress: '',
          guarantorAadhaar: '',
          guarantorAadhaarFront: null,
          guarantorAadhaarBack: null
        }));
      }
    );
  };

  const resetEntireForm = () => {
    triggerConfirm(
      'Reset Entire Form',
      'Are you sure you want to clear the entire registration? This will permanently delete all entered data.',
      () => {
        setFormData({
          accountType: 'Loan', planId: '', startDate: getTodayDateString(),
          customAmount: '', customRate: localStorage.getItem('custom_interest_rate') || '', customDuration: '', customDurationUnit: 'Days', customFrequency: 'Daily', customType: 'Flat', customEmi: '', customProcessingFee: '0', customPenalty: '0', customDailyDeposit: '', customMaturity: '',
          fullName: '', mobile: '', altMobile: '', dob: '', gender: 'Male',
          fatherHusbandName: '', occupation: '', monthlyIncome: '', branch: '', area: '', agent: '', photo: null,
          houseNumber: '', street: '', villageCity: '', landmark: '', district: '', state: 'Uttar Pradesh', pinCode: '',
          aadhaarNumber: '', panNumber: '', bankName: '', bankAccountNo: '', bankIfsc: '', chequeUpload: null, aadhaarFront: null, aadhaarBack: null, panUpload: null, signature: null,
          guarantorPhoto: null, guarantorName: '', guarantorMobile: '', guarantorRelation: '', guarantorAddress: '', guarantorAadhaar: '', guarantorAadhaarFront: null, guarantorAadhaarBack: null
        });
        setCurrentStep(1);
        localStorage.removeItem('customer_registration_draft');
        localStorage.removeItem('customer_registration_step');
      }
    );
  };

  const loanPlans = dbLoanPlans.map(p => {
    const durVal = Number(p.duration_value);
    const durUnit = p.duration_unit || 'Days';
    let durationInMonths = 0;
    if (durUnit === 'Days') durationInMonths = durVal / 30;
    else if (durUnit === 'Months') durationInMonths = durVal;
    else if (durUnit === 'Years') durationInMonths = durVal * 12;

    const principal = Number(p.min_amount);
    const rate = Number(p.interest_rate);
    
    const loanPeriod = liveSettings.interest_calculation_period_loan || 'monthly';
    const timeFactor = loanPeriod === 'yearly' ? (durationInMonths / 12) : durationInMonths;
    
    const interest = p.interest_type === 'Flat' 
      ? (principal * (rate / 100) * timeFactor)
      : (principal * (rate / 100) * timeFactor * 0.7);
    const totalPayable = principal + interest;

    let N = 0;
    const freq = p.collection_frequency;
    if (freq === 'Daily') {
      N = durUnit === 'Days' ? durVal : (durUnit === 'Months' ? durVal * 30 : durVal * 365);
    } else if (freq === 'Weekly') {
      N = durUnit === 'Days' ? Math.round(durVal / 7) : (durUnit === 'Months' ? Math.round((durVal * 30) / 7) : durVal * 52);
    } else if (freq === 'Monthly') {
      N = durUnit === 'Days' ? Math.round(durVal / 30) : (durUnit === 'Months' ? durVal : durVal * 12);
    }
    if (N <= 0) N = 1;

    return {
      value: String(p.id),
      label: `${p.name} - ${p.interest_rate}% (${p.duration_value} ${p.duration_unit})`,
      amount: principal,
      rate: rate,
      type: p.interest_type,
      duration: durVal,
      durationUnit: durUnit,
      frequency: freq,
      emi: Math.round(totalPayable / N),
      processingFee: Number(p.processing_fee),
      penalty: Number(p.penalty_per_day)
    };
  });

  const savingPlans = dbSavingPlans.map(p => ({
    value: String(p.id),
    label: `${p.name} - ${p.interest_rate}% (${p.duration_value} ${p.duration_unit})`,
    dailyDeposit: Number(p.deposit_amount),
    rate: Number(p.interest_rate),
    duration: Number(p.duration_value),
    durationUnit: p.duration_unit || 'Days',
    frequency: p.collection_frequency,
    maturity: Number(p.maturity_amount)
  }));

  // Helper calculations for Step 1
  const selectedPlan = formData.planId === 'custom'
    ? (formData.accountType === 'Loan'
      ? {
          value: 'custom',
          label: 'Custom Loan Plan',
          amount: Number(formData.customAmount) || 0,
          rate: Number(formData.customRate) || 0,
          type: formData.customType || 'Flat',
          duration: Number(formData.customDuration) || 0,
          durationUnit: formData.customDurationUnit || 'Days',
          frequency: formData.customFrequency || 'Daily',
          emi: Number(formData.customEmi) || 0,
          processingFee: Number(formData.customProcessingFee) || 0,
          penalty: Number(formData.customPenalty) || 0
        }
      : {
          value: 'custom',
          label: 'Custom Savings Plan',
          dailyDeposit: Number(formData.customDailyDeposit) || 0,
          rate: Number(formData.customRate) || 0,
          duration: Number(formData.customDuration) || 0,
          frequency: formData.customFrequency || 'Daily',
          maturity: Number(formData.customMaturity) || 0
        })
    : (formData.accountType === 'Loan' 
      ? loanPlans.find(p => p.value === formData.planId)
      : formData.accountType === 'Saving'
      ? (() => {
          const plan = savingPlans.find(p => p.value === formData.planId);
          if (!plan) return null;
          return {
            ...plan,
            dailyDeposit: formData.customDailyDeposit !== '' ? Number(formData.customDailyDeposit) : plan.dailyDeposit,
            rate: formData.customRate !== '' ? Number(formData.customRate) : plan.rate,
            duration: formData.customDuration !== '' ? Number(formData.customDuration) : plan.duration,
            maturity: formData.customMaturity !== '' ? Number(formData.customMaturity) : plan.maturity
          };
        })()
      : null);

  const calculateEndDate = (start, duration, freq, durationUnit = null) => {
    if (!start) return '';
    const date = new Date(start);
    if (durationUnit) {
      if (durationUnit === 'Days') {
        date.setDate(date.getDate() + duration);
      } else if (durationUnit === 'Months') {
        date.setMonth(date.getMonth() + duration);
      } else if (durationUnit === 'Years') {
        date.setFullYear(date.getFullYear() + duration);
      }
      return date.toISOString().split('T')[0];
    }
    if (freq === 'Daily') {
      date.setDate(date.getDate() + duration);
    } else if (freq === 'Weekly') {
      date.setDate(date.getDate() + (duration * 7));
    } else if (freq === 'Monthly') {
      date.setMonth(date.getMonth() + duration);
    }
    return date.toISOString().split('T')[0];
  };

  const planEndDate = selectedPlan && formData.startDate
    ? calculateEndDate(
        formData.startDate, 
        selectedPlan.duration, 
        selectedPlan.frequency,
        formData.planId === 'custom' ? formData.customDurationUnit : null
      )
    : '';

  useEffect(() => {
    if (formData.planId === 'custom' && formData.accountType === 'Loan') {
      const calculatedEmi = calculateCustomEmi(
        Number(formData.customAmount) || 0,
        Number(formData.customRate) || 0,
        Number(formData.customDuration) || 0,
        formData.customDurationUnit || 'Days',
        formData.customFrequency || 'Daily',
        formData.customType || 'Flat',
        liveSettings.interest_calculation_period_loan || 'monthly'
      );
      setFormData(prev => {
        if (prev.customEmi !== String(calculatedEmi)) {
          return { ...prev, customEmi: String(calculatedEmi) };
        }
        return prev;
      });
    } else if (formData.accountType === 'Saving' && formData.planId) {
      let durUnit = formData.customDurationUnit || 'Days';
      let freq = formData.customFrequency || 'Daily';
      let rate = Number(formData.customRate) || 0;
      let duration = Number(formData.customDuration) || 0;
      let deposit = Number(formData.customDailyDeposit) || 0;

      if (formData.planId !== 'custom') {
        const plan = dbSavingPlans.find(p => String(p.id) === formData.planId);
        if (plan) {
          durUnit = plan.duration_unit;
          freq = plan.collection_frequency;
          if (formData.customDailyDeposit === '' && formData.customRate === '' && formData.customDuration === '') {
            deposit = Number(plan.deposit_amount);
            rate = Number(plan.interest_rate);
            duration = Number(plan.duration_value);
            
            setFormData(prev => ({
              ...prev,
              customDailyDeposit: String(plan.deposit_amount),
              customRate: String(plan.interest_rate),
              customDuration: String(plan.duration_value),
              customDurationUnit: plan.duration_unit,
              customFrequency: plan.collection_frequency
            }));
            return;
          }
        }
      }

      const calculatedMaturity = calculateCustomMaturity(
        deposit,
        rate,
        duration,
        durUnit,
        freq
      );

      setFormData(prev => {
        if (prev.customMaturity !== String(calculatedMaturity)) {
          return { ...prev, customMaturity: String(calculatedMaturity) };
        }
        return prev;
      });
    }
  }, [
    formData.planId,
    formData.accountType,
    formData.customAmount,
    formData.customRate,
    formData.customDuration,
    formData.customDurationUnit,
    formData.customFrequency,
    formData.customType,
    formData.customDailyDeposit,
    dbSavingPlans,
    liveSettings
  ]);

  const durationInMonths = (() => {
    if (!selectedPlan) return 0;
    const durVal = selectedPlan.duration;
    const durUnit = selectedPlan.durationUnit || (formData.planId === 'custom' ? formData.customDurationUnit : 'Days');
    if (durUnit === 'Days') return durVal / 30;
    if (durUnit === 'Months') return durVal;
    if (durUnit === 'Years') return durVal * 12;
    return 0;
  })();

  const loanPeriod = liveSettings.interest_calculation_period_loan || 'monthly';
  const timeFactor = loanPeriod === 'yearly' ? (durationInMonths / 12) : durationInMonths;

  const totalInterest = selectedPlan && formData.accountType === 'Loan'
    ? (selectedPlan.type === 'Flat'
        ? (selectedPlan.amount * (selectedPlan.rate / 100) * timeFactor)
        : (selectedPlan.amount * (selectedPlan.rate / 100) * timeFactor * 0.7))
    : 0;

  const totalPayable = selectedPlan && formData.accountType === 'Loan'
    ? selectedPlan.amount + totalInterest
    : 0;

  const userRole = localStorage.getItem('userRole') || localStorage.getItem('active_user_role') || '';
  const isKycFieldRequired = userRole !== 'Super Admin' && localStorage.getItem('mandatory_kyc') !== 'false';

  const isStep1Valid = () => {
    if (!formData.accountType || !formData.planId || !formData.startDate) return false;
    if (formData.accountType === 'Saving') {
      return formData.customDailyDeposit && formData.customRate && formData.customDuration && formData.customMaturity;
    }
    if (formData.planId === 'custom' && formData.accountType === 'Loan') {
      return formData.customAmount && formData.customRate && formData.customDuration && formData.customEmi;
    }
    return true;
  };

  const isStep2Valid = () => {
    const selectedBranchObj = branches.find(b => b.name === formData.branch);
    const isBranchRegSuspended = selectedBranchObj && selectedBranchObj.allowRegistrations === false;
    if (isBranchRegSuspended) return false;
    return formData.fullName && formData.mobile && formData.dob && formData.gender && formData.branch && formData.area && formData.agent;
  };

  const isStep3Valid = () => {
    return formData.houseNumber && formData.street && formData.villageCity && formData.district && formData.state && formData.pinCode;
  };

  const isStep4Valid = () => {
    const userRole = localStorage.getItem('userRole') || localStorage.getItem('active_user_role') || '';
    if (userRole === 'Super Admin') return true;
    const isKycMandatory = localStorage.getItem('mandatory_kyc') !== 'false';
    if (!isKycMandatory) return true;
    return formData.aadhaarNumber && formData.panNumber && formData.bankName && formData.bankAccountNo && formData.bankIfsc;
  };

  const isStep5Valid = () => {
    const userRole = localStorage.getItem('userRole') || localStorage.getItem('active_user_role') || '';
    if (userRole === 'Super Admin') return true;
    if (formData.accountType === 'Saving') return true;
    return formData.guarantorName && formData.guarantorMobile && formData.guarantorRelation && formData.guarantorAadhaar;
  };

  const focusField = (fieldKey) => {
    const keyToLabelMap = {
      planId: 'PLAN',
      startDate: 'ACCOUNT OPENING DATE',
      customAmount: 'AMOUNT',
      customRate: 'RATE',
      customDuration: 'DURATION',
      customEmi: 'EMI',
      customDailyDeposit: 'DAILY DEPOSIT',
      customMaturity: 'MATURITY',
      
      fullName: 'FULL NAME',
      mobile: 'MOBILE NUMBER',
      dob: 'DATE OF BIRTH',
      gender: 'GENDER',
      branch: 'BRANCH',
      area: 'AREA',
      agent: 'ASSIGNED AGENT',
      
      houseNumber: 'HOUSE NUMBER',
      street: 'STREET / ROAD',
      villageCity: 'VILLAGE / CITY',
      district: 'DISTRICT',
      state: 'STATE',
      pinCode: 'PIN CODE',
      
      aadhaarNumber: 'AADHAAR NUMBER',
      panNumber: 'PAN NUMBER',
      bankName: 'BANK NAME',
      bankAccountNo: 'BANK ACCOUNT NUMBER',
      bankIfsc: 'BANK IFSC CODE',
      
      guarantorName: 'GUARANTOR NAME',
      guarantorMobile: 'GUARANTOR MOBILE',
      guarantorRelation: 'GUARANTOR RELATION',
      guarantorAadhaar: 'GUARANTOR AADHAAR'
    };

    const labelText = keyToLabelMap[fieldKey];
    if (!labelText) return;

    // Find label elements
    const labels = Array.from(document.querySelectorAll('label'));
    const targetLabel = labels.find(l => {
      const text = l.textContent.toUpperCase();
      return text.includes(labelText);
    });

    if (targetLabel) {
      const parent = targetLabel.parentElement;
      const input = parent.querySelector('input, select, button');
      if (input) {
        input.focus();
        if (input.select && input.tagName === 'INPUT') {
          input.select();
        }
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    // Fallback: search by placeholder mappings
    const fallbackPlaceholders = {
      fullName: 'Enter Full Name',
      mobile: 'Enter Mobile Number',
      dob: 'DD-MM-YYYY',
      houseNumber: 'Enter House Number',
      street: 'Enter Street',
      villageCity: 'Enter Village',
      district: 'Enter District',
      pinCode: 'Enter PIN',
      aadhaarNumber: 'Aadhaar',
      panNumber: 'PAN',
      bankName: 'Enter Bank Name',
      bankAccountNo: 'Enter Account Number',
      bankIfsc: 'Enter IFSC Code',
      guarantorName: 'Guarantor Name',
      guarantorMobile: 'Guarantor Mobile'
    };

    const ph = fallbackPlaceholders[fieldKey];
    if (ph) {
      const input = Array.from(document.querySelectorAll('input, textarea')).find(i => 
        i.placeholder && i.placeholder.toLowerCase().includes(ph.toLowerCase())
      );
      if (input) {
        input.focus();
        if (input.select) input.select();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const canGoNext = () => {
    if (currentStep === 1) return isStep1Valid();
    if (currentStep === 2) return isStep2Valid();
    if (currentStep === 3) return isStep3Valid();
    if (currentStep === 4) return isStep4Valid();
    if (currentStep === 5) return isStep5Valid();
    return true;
  };

  const handleNext = () => {
    let missingField = null;
    let missingLabel = '';

    if (currentStep === 1) {
      if (!formData.accountType) { missingField = 'accountType'; missingLabel = 'Account Type'; }
      else if (!formData.planId) { missingField = 'planId'; missingLabel = 'Plan'; }
      else if (!formData.startDate) { missingField = 'startDate'; missingLabel = 'Account Opening Date'; }
      else if (formData.accountType === 'Saving') {
        if (!formData.customDailyDeposit) { missingField = 'customDailyDeposit'; missingLabel = 'Deposit Amount'; }
        else if (!formData.customRate) { missingField = 'customRate'; missingLabel = 'Interest Rate'; }
        else if (!formData.customDuration) { missingField = 'customDuration'; missingLabel = 'Duration'; }
        else if (!formData.customMaturity) { missingField = 'customMaturity'; missingLabel = 'Custom Maturity'; }
      }
      else if (formData.planId === 'custom' && formData.accountType === 'Loan') {
        if (!formData.customAmount) { missingField = 'customAmount'; missingLabel = 'Principal Amount'; }
        else if (!formData.customRate) { missingField = 'customRate'; missingLabel = 'Interest Rate'; }
        else if (!formData.customDuration) { missingField = 'customDuration'; missingLabel = 'Duration'; }
        else if (!formData.customEmi) { missingField = 'customEmi'; missingLabel = 'Custom EMI'; }
      }
    } else if (currentStep === 2) {
      const selectedBranchObj = branches.find(b => b.name === formData.branch);
      const isBranchRegSuspended = selectedBranchObj && selectedBranchObj.allowRegistrations === false;
      if (isBranchRegSuspended) {
        showWarning('Registration Suspended', 'Registrations are currently suspended for this branch.');
        return;
      }
      if (!formData.fullName) { missingField = 'fullName'; missingLabel = 'Full Name'; }
      else if (!formData.mobile) { missingField = 'mobile'; missingLabel = 'Mobile Number'; }
      else if (!formData.dob) { missingField = 'dob'; missingLabel = 'Date of Birth'; }
      else if (!formData.gender) { missingField = 'gender'; missingLabel = 'Gender'; }
      else if (!formData.branch) { missingField = 'branch'; missingLabel = 'Branch'; }
      else if (!formData.area) { missingField = 'area'; missingLabel = 'Area'; }
      else if (!formData.agent) { missingField = 'agent'; missingLabel = 'Assigned Agent'; }
    } else if (currentStep === 3) {
      if (!formData.houseNumber) { missingField = 'houseNumber'; missingLabel = 'House Number'; }
      else if (!formData.street) { missingField = 'street'; missingLabel = 'Street / Road'; }
      else if (!formData.villageCity) { missingField = 'villageCity'; missingLabel = 'Village / City'; }
      else if (!formData.district) { missingField = 'district'; missingLabel = 'District'; }
      else if (!formData.state) { missingField = 'state'; missingLabel = 'State'; }
      else if (!formData.pinCode) { missingField = 'pinCode'; missingLabel = 'PIN Code'; }
    } else if (currentStep === 4) {
      const isKycMandatory = localStorage.getItem('mandatory_kyc') !== 'false';
      const userRole = localStorage.getItem('userRole') || localStorage.getItem('active_user_role') || '';
      if (userRole !== 'Super Admin' && isKycMandatory) {
        if (!formData.aadhaarNumber) { missingField = 'aadhaarNumber'; missingLabel = 'Aadhaar Number'; }
        else if (!formData.panNumber) { missingField = 'panNumber'; missingLabel = 'PAN Number'; }
        else if (!formData.bankName) { missingField = 'bankName'; missingLabel = 'Bank Name'; }
        else if (!formData.bankAccountNo) { missingField = 'bankAccountNo'; missingLabel = 'Bank Account Number'; }
        else if (!formData.bankIfsc) { missingField = 'bankIfsc'; missingLabel = 'Bank IFSC Code'; }
      }
    } else if (currentStep === 5) {
      const userRole = localStorage.getItem('userRole') || localStorage.getItem('active_user_role') || '';
      if (userRole !== 'Super Admin' && formData.accountType === 'Loan') {
        if (!formData.guarantorName) { missingField = 'guarantorName'; missingLabel = 'Guarantor Name'; }
        else if (!formData.guarantorMobile) { missingField = 'guarantorMobile'; missingLabel = 'Guarantor Mobile'; }
        else if (!formData.guarantorRelation) { missingField = 'guarantorRelation'; missingLabel = 'Guarantor Relation'; }
        else if (!formData.guarantorAadhaar) { missingField = 'guarantorAadhaar'; missingLabel = 'Guarantor Aadhaar'; }
      }
    }

    if (missingField) {
      setPendingFocusField(missingField);
      // Browser Alert message as requested
      alert(`Validation Alert:\n"${missingLabel}" field is mandatory! Please fill in this field.`);
      focusField(missingField);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = (e, print = false) => {
    e.preventDefault();

    let missingField = null;
    let missingLabel = '';

    const userRole = localStorage.getItem('userRole') || localStorage.getItem('active_user_role') || '';
    if (userRole !== 'Super Admin' && formData.accountType === 'Loan') {
      if (!formData.guarantorName) { missingField = 'guarantorName'; missingLabel = 'Guarantor Name'; }
      else if (!formData.guarantorMobile) { missingField = 'guarantorMobile'; missingLabel = 'Guarantor Mobile'; }
      else if (!formData.guarantorRelation) { missingField = 'guarantorRelation'; missingLabel = 'Guarantor Relation'; }
      else if (!formData.guarantorAadhaar) { missingField = 'guarantorAadhaar'; missingLabel = 'Guarantor Aadhaar'; }
    }

    if (missingField) {
      setPendingFocusField(missingField);
      showWarning(
        'Required Field Missing', 
        `Please enter or select a valid "${missingLabel}" before saving.`
      );
      return;
    }
    const payload = {
      full_name: formData.fullName,
      mobile: formData.mobile,
      alternate_mobile: formData.altMobile,
      dob: formData.dob,
      gender: formData.gender,
      father_or_husband_name: formData.fatherHusbandName,
      occupation: formData.occupation,
      monthly_income: parseFloat(formData.monthlyIncome) || 0,
      branch_id: parseInt(formData.branch),
      area_id: parseInt(formData.area),
      agent_id: parseInt(formData.agent),
      address: [formData.houseNumber, formData.street, formData.villageCity, formData.landmark, formData.district].filter(Boolean).join(', '),
      city: formData.villageCity,
      state: formData.state,
      pincode: formData.pinCode,
      aadhaar_no: formData.aadhaarNumber,
      pan_no: formData.panNumber,
      bank_name: formData.bankName,
      bank_account_no: formData.bankAccountNo,
      bank_ifsc: formData.bankIfsc,
      guarantor_name: formData.guarantorName,
      guarantor_mobile: formData.guarantorMobile,
      guarantor_relation: formData.guarantorRelation,
      guarantor_aadhaar: formData.guarantorAadhaar,
      guarantor_address: formData.guarantorAddress,
      plan_id: formData.planId === 'custom' ? null : parseInt(formData.planId),
      plan_type: formData.accountType,
      start_date: formData.startDate,
      principal_amount: parseFloat(formData.customAmount) || (selectedPlan?.amount ?? 0),
      interest_rate: parseFloat(formData.customRate) || (selectedPlan?.rate ?? 0),
      emi_amount: parseFloat(formData.accountType === 'Saving' ? formData.customDailyDeposit : formData.customEmi) || (selectedPlan?.emi ?? 0),
      deposit_amount: formData.accountType === 'Saving'
        ? (parseFloat(formData.customDailyDeposit) || selectedPlan?.dailyDeposit || 0)
        : 0,
      maturity_amount: formData.accountType === 'Saving'
        ? (parseFloat(formData.customMaturity) || selectedPlan?.maturity || 0)
        : 0
    };

    customerApi.register(payload)
      .then(res => {
        showSuccess(
          print ? 'Registration Saved & Print Sent' : 'Registration Completed',
          print 
            ? 'New customer registration has been successfully saved and the print command has been sent.'
            : `The new customer profile has been successfully onboarded with Account No: ${res.data.account_no}.`
        );
        // Reset form but remember branch, area, agent for next registration
        const lastBranch = formData.branch;
        const lastArea = formData.area;
        const lastAgent = formData.agent;
        
        setCurrentStep(1);
        setFormData({
          accountType: 'Loan', planId: '', startDate: getTodayDateString(),
          customAmount: '', customRate: localStorage.getItem('custom_interest_rate') || '', customDuration: '', customDurationUnit: 'Days', customFrequency: 'Daily', customType: 'Flat', customEmi: '', customProcessingFee: '0', customPenalty: '0', customDailyDeposit: '', customMaturity: '',
          fullName: '', mobile: '', altMobile: '', dob: '', gender: 'Male',
          fatherHusbandName: '', occupation: '', monthlyIncome: '', 
          branch: lastBranch, 
          area: lastArea, 
          agent: lastAgent, 
          photo: null,
          houseNumber: '', street: '', villageCity: '', landmark: '', district: '', state: 'Uttar Pradesh', pinCode: '',
          aadhaarNumber: '', panNumber: '', bankName: '', bankAccountNo: '', bankIfsc: '', chequeUpload: null, aadhaarFront: null, aadhaarBack: null, panUpload: null, signature: null,
          guarantorPhoto: null, guarantorName: '', guarantorMobile: '', guarantorRelation: '', guarantorAddress: '',
          guarantorAadhaar: '', guarantorAadhaarFront: null, guarantorAadhaarBack: null
        });
        localStorage.removeItem('customer_registration_draft');
        localStorage.removeItem('customer_registration_step');
      })
      .catch(err => {
        showWarning('Registration Failed', err.message || 'Server error occurred during customer onboarding.');
      });
  };

  const stepsList = [
    { num: 1, name: 'Account Setup' },
    { num: 2, name: 'Customer Details' },
    { num: 3, name: 'Address' },
    { num: 4, name: 'KYC Details' },
    { num: 5, name: formData.accountType === 'Saving' ? 'Nominee' : 'Guarantor' },
    { num: 6, name: 'Review & Save' }
  ];

  const isRegistrationAllowed = localStorage.getItem('allow_registrations') !== 'false';

  if (!isRegistrationAllowed) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white p-8 rounded-2xl border border-border-fin shadow-sm text-center space-y-4 max-w-lg mx-auto mt-12 animate-scale-up">
          <div className="w-16 h-16 bg-danger-fin/10 text-danger-fin rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-rounded text-3xl select-none">app_blocking</span>
          </div>
          <div>
            <h3 className="text-lg font-black text-primary-text">Registrations Suspended</h3>
            <p className="text-xs text-secondary-text mt-1.5 leading-relaxed">
              New customer onboarding and registration has been temporarily suspended by the system administrator. Please enable it in the <strong>System Policies</strong> settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Visual Stepper Progress Bar */}
      <div className="bg-white p-5 rounded-2xl border border-border-fin shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between min-w-[650px] px-2">
          {stepsList.map((step, idx) => (
            <React.Fragment key={step.num}>
              <div 
                onClick={() => {
                  if (step.num < currentStep) {
                    setCurrentStep(step.num);
                  } else if (step.num > currentStep) {
                    handleNext();
                  }
                }}
                className="flex flex-col items-center gap-2 relative z-10 flex-1 cursor-pointer group"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 group-hover:scale-105 ${
                  currentStep === step.num
                    ? 'bg-primary text-white ring-4 ring-primary/10 scale-105'
                    : currentStep > step.num
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-background-fin border border-[#CBD5E1] text-[#64748B] group-hover:border-primary/50'
                }`}>
                  {currentStep > step.num ? (
                    <span className="material-symbols-rounded text-xs select-none">check</span>
                  ) : (
                    step.num
                  )}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider text-center transition-colors ${
                  currentStep === step.num ? 'text-primary' : 'text-[#64748B] group-hover:text-primary-text'
                }`}>
                  {step.name}
                </span>
              </div>
              {idx < stepsList.length - 1 && (
                <div className="flex-1 h-[2px] bg-[#E2E8F0] relative -top-3">
                  <div className="absolute top-0 left-0 bottom-0 bg-[#16A34A] transition-all duration-500" style={{
                    width: currentStep > step.num ? '100%' : '0%'
                  }}></div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <form 
        onSubmit={(e) => e.preventDefault()} 
        className="space-y-6"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            e.preventDefault();
            const form = e.currentTarget;
            const elements = Array.from(form.elements).filter(
              el => (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'BUTTON') && !el.disabled && el.type !== 'hidden'
            );
            const index = elements.indexOf(e.target);
            if (index > -1 && index < elements.length - 1) {
              const nextEl = elements[index + 1];
              nextEl.focus();
              const textInputTypes = ['text', 'number', 'tel', 'email', 'password', 'search', 'url'];
              if (nextEl.tagName === 'INPUT' && textInputTypes.includes(nextEl.type)) {
                nextEl.select();
              }
            }
          }
        }}
        onFocus={(e) => {
          const textInputTypes = ['text', 'number', 'tel', 'email', 'password', 'search', 'url'];
          if (e.target.tagName === 'INPUT' && textInputTypes.includes(e.target.type)) {
            e.target.select();
          }
        }}
      >
        {/* Step 1: Account Setup */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-[#F8FAFC]/80 p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
              <div className="bg-white p-6 rounded-[calc(2rem-0.625rem)] space-y-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                <div className="flex justify-between items-center border-b border-border-fin pb-3 mb-3">
                  <h3 className="text-base font-bold text-primary-text">Account Setup</h3>
                  <button
                    type="button"
                    onClick={resetStep1}
                    className="flex items-center gap-1 text-[10px] font-extrabold text-danger-fin hover:underline cursor-pointer focus:outline-none transition-all active:scale-95 bg-transparent border-none p-0"
                  >
                    <span className="material-symbols-rounded text-xs select-none">restart_alt</span>
                    Reset Step
                  </button>
                </div>
                
                <Select
                  label="Account Type"
                  required={true}
                  options={[
                    { value: 'Loan', label: 'Loan Account' },
                    { value: 'Saving', label: 'Savings Account' }
                  ]}
                  value={formData.accountType}
                  onChange={(val) => setFormData(prev => ({ ...prev, accountType: val, planId: '' }))}
                />

                {formData.accountType && (
                  <Select
                    label="Select Plan"
                    required={true}
                    options={[
                      ...(formData.accountType === 'Loan' ? loanPlans : savingPlans),
                      { value: 'custom', label: 'Custom Plan (Enter Manually)' }
                    ]}
                    onChange={(val) => {
                      if (val === 'custom') {
                        setFormData(prev => ({ 
                          ...prev, 
                          planId: val,
                          customAmount: '',
                          customRate: localStorage.getItem('custom_interest_rate') || '',
                          customDuration: '',
                          customDurationUnit: 'Days',
                          customFrequency: 'Daily',
                          customType: 'Flat',
                          customEmi: '',
                          customProcessingFee: '0',
                          customPenalty: '0',
                          customDailyDeposit: '',
                          customMaturity: ''
                        }));
                      } else {
                        if (formData.accountType === 'Loan') {
                          const plan = loanPlans.find(p => p.value === val);
                          setFormData(prev => ({
                            ...prev,
                            planId: val,
                            customAmount: plan ? String(plan.amount) : '',
                            customRate: plan ? String(plan.rate) : '',
                            customDuration: plan ? String(plan.duration) : '',
                            customDurationUnit: plan ? (plan.durationUnit || 'Days') : 'Days',
                            customFrequency: plan ? plan.frequency : 'Daily',
                            customType: plan ? plan.type : 'Flat',
                            customEmi: '', 
                            customProcessingFee: plan ? String(plan.processingFee) : '0',
                            customPenalty: plan ? String(plan.penalty) : '0',
                            customDailyDeposit: '',
                            customMaturity: ''
                          }));
                        } else {
                          const plan = savingPlans.find(p => p.value === val);
                          setFormData(prev => ({
                            ...prev,
                            planId: val,
                            customAmount: '',
                            customRate: plan ? String(plan.rate) : '',
                            customDuration: plan ? String(plan.duration) : '',
                            customDurationUnit: plan ? (plan.durationUnit || 'Days') : 'Days',
                            customFrequency: plan ? plan.frequency : 'Daily',
                            customType: 'Flat',
                            customEmi: '',
                            customProcessingFee: '0',
                            customPenalty: '0',
                            customDailyDeposit: plan ? String(plan.dailyDeposit) : '',
                            customMaturity: '' 
                          }));
                        }
                      }
                    }}
                  />
                )}

                {formData.planId && formData.planId !== '' && formData.accountType === 'Loan' && (
                  <div className="border-t border-[#E2E8F0] pt-4 mt-2 space-y-4">
                    <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider">{formData.planId === 'custom' ? 'Custom Loan Details' : 'Loan Plan Parameters'}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Principal Amount *</label>
                        <input
                          type="number"
                          placeholder="E.g., 10000"
                          value={formData.customAmount}
                          onChange={(e) => setFormData(prev => ({ ...prev, customAmount: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Interest Rate (%) *</label>
                        <input
                          type="number"
                          placeholder="E.g., 12"
                          value={formData.customRate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, customRate: val }));
                            localStorage.setItem('custom_interest_rate', val);
                          }}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                      <Select
                        label="Interest Type *"
                        required={true}
                        options={[
                          { value: 'Flat', label: 'Flat Interest' },
                          { value: 'Reducing', label: 'Reducing Interest' }
                        ]}
                        value={formData.customType}
                        onChange={(val) => setFormData(prev => ({ ...prev, customType: val }))}
                      />
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Duration *</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="E.g., 100"
                            value={formData.customDuration}
                            onChange={(e) => setFormData(prev => ({ ...prev, customDuration: e.target.value }))}
                            className="flex-1 min-w-0 px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                          />
                          <div className="w-32">
                            <Select
                              options={[
                                { value: 'Days', label: 'Days' },
                                { value: 'Months', label: 'Months' },
                                { value: 'Years', label: 'Years' }
                              ]}
                              value={formData.customDurationUnit || 'Days'}
                              onChange={(val) => setFormData(prev => ({ ...prev, customDurationUnit: val }))}
                            />
                          </div>
                        </div>
                      </div>
                      <Select
                        label="Frequency *"
                        required={true}
                        options={[
                          { value: 'Daily', label: 'Daily' },
                          { value: 'Weekly', label: 'Weekly' },
                          { value: 'Monthly', label: 'Monthly' }
                        ]}
                        value={formData.customFrequency}
                        onChange={(val) => setFormData(prev => ({ ...prev, customFrequency: val }))}
                      />
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Installment / EMI *</label>
                        <input
                          type="number"
                          placeholder="E.g., 112"
                          value={formData.customEmi}
                          onChange={(e) => setFormData(prev => ({ ...prev, customEmi: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Processing Fee</label>
                        <input
                          type="number"
                          placeholder="E.g., 200"
                          value={formData.customProcessingFee}
                          onChange={(e) => setFormData(prev => ({ ...prev, customProcessingFee: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Penalty</label>
                        <input
                          type="number"
                          placeholder="E.g., 10"
                          value={formData.customPenalty}
                          onChange={(e) => setFormData(prev => ({ ...prev, customPenalty: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.planId && formData.accountType === 'Saving' && (
                  <div className="border-t border-[#E2E8F0] pt-4 mt-2 space-y-4">
                    <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider">
                      {formData.planId === 'custom' ? 'Custom Savings Details' : 'Savings Plan Parameters'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Deposit Amount *</label>
                        <input
                          type="number"
                          placeholder="E.g., 100"
                          value={formData.customDailyDeposit}
                          onChange={(e) => setFormData(prev => ({ ...prev, customDailyDeposit: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Interest Rate (%) *</label>
                        <input
                          type="number"
                          placeholder="E.g., 6"
                          value={formData.customRate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, customRate: val }));
                            if (formData.planId === 'custom') {
                              localStorage.setItem('custom_interest_rate', val);
                            }
                          }}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Duration *</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="E.g., 365"
                            value={formData.customDuration}
                            onChange={(e) => setFormData(prev => ({ ...prev, customDuration: e.target.value }))}
                            className="flex-1 min-w-0 px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                          />
                            <div className="w-32">
                              <Select
                                options={[
                                  { value: 'Days', label: 'Days' },
                                  { value: 'Months', label: 'Months' },
                                  { value: 'Years', label: 'Years' }
                                ]}
                                value={formData.customDurationUnit || 'Days'}
                                onChange={(val) => setFormData(prev => ({ ...prev, customDurationUnit: val }))}
                              />
                            </div>
                        </div>
                      </div>

                      <Select
                        label="Frequency *"
                        required={true}
                        options={[
                          { value: 'Daily', label: 'Daily' },
                          { value: 'Weekly', label: 'Weekly' },
                          { value: 'Monthly', label: 'Monthly' }
                        ]}
                        value={formData.customFrequency}
                        onChange={(val) => setFormData(prev => ({ ...prev, customFrequency: val }))}
                      />

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Estimated Maturity Amount</label>
                        <input
                          type="number"
                          placeholder="Calculated automatically..."
                          value={formData.customMaturity}
                          readOnly
                          className="w-full px-4 py-3 bg-slate-100 border border-border-fin rounded-xl text-sm font-bold text-success-fin focus:outline-none select-none cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <DatePicker
                  label="Account Opening Date"
                  required={true}
                  value={formData.startDate}
                  onChange={(val) => setFormData(prev => ({ ...prev, startDate: val }))}
                />
              </div>
            </div>

            {/* Calculations Card */}
            <div className="bg-[#F8FAFC]/80 p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm md:sticky md:top-6 z-20 flex flex-col">
              <div className="bg-white p-5 rounded-[calc(2rem-0.625rem)] space-y-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] flex-1 flex flex-col justify-between min-h-[350px]">
                <div className="flex-1 flex flex-col">
                  <h4 className="text-xs font-bold text-secondary-text uppercase tracking-wider border-b border-[#E2E8F0] pb-2 mb-1">Calculation Summary</h4>
                  
                  {selectedPlan ? (
                    <div className="space-y-3.5 pt-2 flex-1 flex flex-col justify-between">
                      <div className="space-y-3.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-[#64748B]">Plan Name</span>
                          <span className="font-bold text-primary-text">{selectedPlan.label.split(' - ')[0]}</span>
                        </div>
                        {formData.accountType === 'Loan' ? (
                          <>
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-[#64748B]">Principal</span>
                              <span className="font-bold text-primary-text">₹{selectedPlan.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-[#64748B]">Rate ({selectedPlan.type})</span>
                              <span className="font-bold text-primary-text">{selectedPlan.rate}%</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-semibold bg-primary/5 border border-primary/10 px-3 py-2 rounded-xl transition-all duration-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                              <span className="text-primary font-bold">Duration</span>
                              <span className="font-black text-primary-text bg-white px-2 py-0.5 rounded-md border border-[#E2E8F0] shadow-sm">
                                {selectedPlan.duration} {formData.planId === 'custom' ? formData.customDurationUnit : (selectedPlan.frequency === 'Daily' ? 'Days' : 'Months')}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-semibold bg-primary/5 border border-primary/10 px-3 py-2 rounded-xl transition-all duration-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                              <span className="text-primary font-bold">Installment (EMI)</span>
                              <span className="font-black text-primary bg-white px-2 py-0.5 rounded-md border border-primary/20 shadow-sm">
                                ₹{selectedPlan.emi.toLocaleString()} ({selectedPlan.frequency})
                              </span>
                            </div>
                            <div className="border-t border-dashed border-[#CBD5E1] pt-3 mt-2 space-y-2">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-[#0F172A]">Total Interest</span>
                                <span className="text-[#0F172A]">₹{totalInterest.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs font-bold text-[#16A34A] pt-1">
                                <span>Total Payable</span>
                                <span>₹{totalPayable.toLocaleString()}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-xs font-semibold bg-primary/5 border border-primary/10 px-3 py-2 rounded-xl transition-all duration-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                              <span className="text-primary font-bold">Deposit ({selectedPlan.frequency})</span>
                              <span className="font-black text-primary-text bg-white px-2 py-0.5 rounded-md border border-[#E2E8F0] shadow-sm">
                                ₹{selectedPlan.dailyDeposit.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-[#64748B]">Rate</span>
                              <span className="font-bold text-primary-text">{selectedPlan.rate}%</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-semibold bg-primary/5 border border-primary/10 px-3 py-2 rounded-xl transition-all duration-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                              <span className="text-primary font-bold">Duration</span>
                              <span className="font-black text-primary bg-white px-2 py-0.5 rounded-md border border-primary/20 shadow-sm">
                                {selectedPlan.duration} {formData.planId === 'custom' ? formData.customDurationUnit : (selectedPlan.frequency === 'Daily' ? 'Days' : 'Months')}
                              </span>
                            </div>
                            <div className="border-t border-dashed border-[#CBD5E1] pt-3 mt-2">
                              <div className="flex justify-between text-xs font-bold text-[#16A34A]">
                                <span>Maturity Amount</span>
                                <span>₹{selectedPlan.maturity.toLocaleString()}</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {formData.startDate && (
                        <div className="border-t border-[#E2E8F0] pt-3 mt-2 space-y-2">
                          <div className="flex justify-between text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                            <span>First Collection</span>
                            <span className="font-bold text-[#0F172A]">{formData.startDate}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                            <span>{formData.accountType === 'Loan' ? 'Close Date' : 'Maturity Date'}</span>
                            <span className="font-bold text-[#0F172A]">{planEndDate}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-4 animate-fade-in">
                      <div className="w-14 h-14 bg-primary/5 text-primary rounded-full flex items-center justify-center shadow-inner">
                        <span className="material-symbols-rounded text-3xl select-none">analytics</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-primary-text">No Plan Selected</p>
                        <p className="text-[10px] text-secondary-text mt-1.5 max-w-[200px] mx-auto leading-relaxed font-medium">
                          Choose a predefined or custom plan to view live calculations and schedule.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Customer Details */}
        {currentStep === 2 && (
          <div className="bg-[#F8FAFC]/80 p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
            <div className="bg-white p-6 rounded-[calc(2rem-0.625rem)] space-y-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
              <div className="flex justify-between items-center border-b border-border-fin pb-3 mb-3">
                <h3 className="text-base font-bold text-primary-text">Customer Details</h3>
                <button
                  type="button"
                  onClick={resetStep2}
                  className="flex items-center gap-1 text-[10px] font-extrabold text-danger-fin hover:underline cursor-pointer focus:outline-none transition-all active:scale-95 bg-transparent border-none p-0"
                >
                  <span className="material-symbols-rounded text-xs select-none">restart_alt</span>
                  Reset Step
                </button>
              </div>
              
              {/* Photo Upload Box */}
              <div className="flex flex-col sm:flex-row items-center gap-4 py-2">
                <div 
                  onClick={() => document.getElementById('customer-photo-upload').click()}
                  className="w-24 h-24 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-primary flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all relative overflow-hidden group"
                >
                  {formData.photo ? (
                    <img src={formData.photo} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <span className="material-symbols-rounded text-2xl text-secondary-text group-hover:text-primary transition-colors select-none">add_a_photo</span>
                      <span className="text-[10px] text-secondary-text group-hover:text-primary/80 transition-colors mt-1 font-bold">Upload Photo</span>
                    </>
                  )}
                  <input
                    id="customer-photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData(prev => ({ ...prev, photo: reader.result }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-xs font-bold text-primary-text block mb-0.5">Customer Profile Photo</span>
                  <span className="text-[10px] text-secondary-text block font-medium">
                    {formData.photo ? (
                      <button 
                        type="button" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, photo: null }));
                        }}
                        className="text-danger-fin font-bold hover:underline"
                      >
                        Remove Photo
                      </button>
                    ) : (
                      'JPG or PNG, max 2MB'
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Full Name *</label>
                  <input
                    type="text"
                    placeholder="Enter Full Name"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Mobile Number *</label>
                  <input
                    type="tel"
                    placeholder="Enter Mobile Number"
                    value={formData.mobile}
                    onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Alternate Mobile</label>
                  <input
                    type="tel"
                    placeholder="Enter Alternate Mobile"
                    value={formData.altMobile}
                    onChange={(e) => setFormData(prev => ({ ...prev, altMobile: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <DatePicker
                  label="Date Of Birth"
                  required={true}
                  value={formData.dob}
                  onChange={(val) => setFormData(prev => ({ ...prev, dob: val }))}
                />

                <Select
                  label="Gender"
                  required={true}
                  options={[
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                    { value: 'Other', label: 'Other' }
                  ]}
                  value={formData.gender}
                  onChange={(val) => setFormData(prev => ({ ...prev, gender: val }))}
                />

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Father / Husband Name</label>
                  <input
                    type="text"
                    placeholder="Enter Father / Husband Name"
                    value={formData.fatherHusbandName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fatherHusbandName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Occupation</label>
                  <input
                    type="text"
                    placeholder="E.g., Business, Retail, Agriculture"
                    value={formData.occupation}
                    onChange={(e) => setFormData(prev => ({ ...prev, occupation: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Monthly Income</label>
                  <input
                    type="number"
                    placeholder="Enter Income Amount"
                    value={formData.monthlyIncome}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthlyIncome: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <Select
                    label="Branch"
                    required={true}
                    options={branches.map(b => ({ value: String(b.id), label: `${b.name} (${b.code})` }))}
                    value={formData.branch}
                    onChange={(val) => setFormData(prev => ({ ...prev, branch: val, area: '', agent: '' }))}
                  />
                  {(() => {
                    const selBranch = branches.find(b => String(b.id) === String(formData.branch));
                    if (selBranch && selBranch.allow_registrations === false) {
                      return (
                        <span className="text-danger-fin text-[10px] font-bold mt-1.5 block leading-snug">
                          ⚠️ Onboarding is temporarily suspended for {selBranch.name} by administrator.
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>

                <Select
                  label="Area"
                  required={true}
                  options={areas
                    .filter(a => !formData.branch || String(a.branch_id) === String(formData.branch))
                    .map(a => ({ value: String(a.id), label: `${a.name} (${a.code})` }))}
                  value={formData.area}
                  onChange={(val) => setFormData(prev => ({ ...prev, area: val, agent: '' }))}
                />

                <Select
                  label="Assigned Agent"
                  required={true}
                  options={agents
                    .filter(ag => (!formData.branch || String(ag.branch_id) === String(formData.branch)) && (!formData.area || String(ag.area_id) === String(formData.area)))
                    .map(ag => ({ value: String(ag.id), label: `${ag.name} (${ag.code})` }))}
                  value={formData.agent}
                  onChange={(val) => setFormData(prev => ({ ...prev, agent: val }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Address */}
        {currentStep === 3 && (
          <div className="bg-[#F8FAFC]/80 p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
            <div className="bg-white p-6 rounded-[calc(2rem-0.625rem)] space-y-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
              <div className="flex justify-between items-center border-b border-border-fin pb-3 mb-3">
                <h3 className="text-base font-bold text-primary-text">Address</h3>
                <button
                  type="button"
                  onClick={resetStep3}
                  className="flex items-center gap-1 text-[10px] font-extrabold text-danger-fin hover:underline cursor-pointer focus:outline-none transition-all active:scale-95 bg-transparent border-none p-0"
                >
                  <span className="material-symbols-rounded text-xs select-none">restart_alt</span>
                  Reset Step
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">House Number *</label>
                  <input
                    type="text"
                    placeholder="Enter House Number"
                    value={formData.houseNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, houseNumber: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Street / Road *</label>
                  <input
                    type="text"
                    placeholder="Enter Street / Road Name"
                    value={formData.street}
                    onChange={(e) => setFormData(prev => ({ ...prev, street: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Village / City *</label>
                  <input
                    type="text"
                    placeholder="Enter Village / City Name"
                    value={formData.villageCity}
                    onChange={(e) => setFormData(prev => ({ ...prev, villageCity: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Landmark</label>
                  <input
                    type="text"
                    placeholder="Enter Landmark"
                    value={formData.landmark}
                    onChange={(e) => setFormData(prev => ({ ...prev, landmark: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">District *</label>
                  <input
                    type="text"
                    placeholder="Enter District Name"
                    value={formData.district}
                    onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <Select
                  label="State *"
                  required={true}
                  options={[
                    { value: 'UP', label: 'Uttar Pradesh' },
                    { value: 'MP', label: 'Madhya Pradesh' },
                    { value: 'BI', label: 'Bihar' }
                  ]}
                  value={formData.state}
                  onChange={(val) => setFormData(prev => ({ ...prev, state: val }))}
                />

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">PIN Code *</label>
                  <input
                    type="text"
                    placeholder="Enter PIN Code"
                    maxLength="6"
                    value={formData.pinCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, pinCode: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                {/* GPS Placeholder */}
                <div className="flex items-end pb-1">
                  <button
                    type="button"
                    onClick={() => alert('GPS location mocked (lat: 26.8467, lng: 80.9462)')}
                    className="flex items-center gap-2 px-4 py-3 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all w-full cursor-pointer justify-center h-[46px]"
                  >
                    <span className="material-symbols-rounded text-sm select-none">my_location</span>
                    Fetch GPS Location (Future)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: KYC */}
        {currentStep === 4 && (
          <div className="bg-[#F8FAFC]/80 p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
            <div className="bg-white p-6 rounded-[calc(2rem-0.625rem)] space-y-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
              <div className="flex justify-between items-center border-b border-border-fin pb-3 mb-3">
                <h3 className="text-base font-bold text-primary-text">KYC Verification</h3>
                <button
                  type="button"
                  onClick={resetStep4}
                  className="flex items-center gap-1 text-[10px] font-extrabold text-danger-fin hover:underline cursor-pointer focus:outline-none transition-all active:scale-95 bg-transparent border-none p-0"
                >
                  <span className="material-symbols-rounded text-xs select-none">restart_alt</span>
                  Reset Step
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Aadhaar Number {isKycFieldRequired && '*'}</label>
                  <input
                    type="text"
                    placeholder="1234 5678 9012"
                    maxLength="14"
                    value={formData.aadhaarNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, aadhaarNumber: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">PAN Number {isKycFieldRequired && '*'}</label>
                  <input
                    type="text"
                    placeholder="ABCDE1234F"
                    maxLength="10"
                    value={formData.panNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-4">
                <h4 className="text-xs font-black text-primary-text mb-4 uppercase tracking-wider">Bank Account Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">
                      Bank Name {isKycFieldRequired && <span className="text-danger-fin">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Bank Name"
                      value={formData.bankName}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">
                      Bank Account Number {isKycFieldRequired && <span className="text-danger-fin">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Account Number"
                      value={formData.bankAccountNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankAccountNo: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">
                      Bank IFSC Code {isKycFieldRequired && <span className="text-danger-fin">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="Enter IFSC Code"
                      maxLength="11"
                      value={formData.bankIfsc}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankIfsc: e.target.value.toUpperCase() }))}
                      className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Document Preview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
                {[
                  { name: 'Aadhaar Front', key: 'aadhaarFront', icon: 'badge' },
                  { name: 'Aadhaar Back', key: 'aadhaarBack', icon: 'badge' },
                  { name: 'PAN Card', key: 'panUpload', icon: 'credit_card' },
                  { name: 'Signature', key: 'signature', icon: 'draw' },
                  { name: 'Cheque / Passbook', key: 'chequeUpload', icon: 'payments' }
                ].map((doc) => (
                  <div 
                    key={doc.key} 
                    onClick={() => document.getElementById(`file-upload-${doc.key}`).click()}
                    className="border border-border-fin rounded-xl p-4 bg-background-fin flex flex-col items-center text-center cursor-pointer hover:border-primary hover:bg-slate-50/50 hover:shadow-sm transition-all relative overflow-hidden group min-h-[120px] justify-center"
                  >
                    {formData[doc.key] ? (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <img src={formData[doc.key]} alt={doc.name} className="max-h-[60px] object-contain mb-1.5" />
                        <span className="text-[9px] text-danger-fin font-bold hover:underline" onClick={(e) => {
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, [doc.key]: null }));
                        }}>Remove</span>
                      </div>
                    ) : (
                      <>
                        <span className="material-symbols-rounded text-2xl text-secondary-text group-hover:text-primary transition-colors mb-2 select-none">{doc.icon}</span>
                        <span className="text-[10px] font-bold text-primary-text block">{doc.name}</span>
                        <span className="text-[9px] text-[#64748B] block mt-1 font-semibold group-hover:text-primary/80 transition-colors">Click to Upload</span>
                      </>
                    )}
                    <input
                      id={`file-upload-${doc.key}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData(prev => ({ ...prev, [doc.key]: reader.result }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Guarantor/Nominee */}
        {currentStep === 5 && (
          <div className="bg-[#F8FAFC]/80 p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
            <div className="bg-white p-6 rounded-[calc(2rem-0.625rem)] space-y-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
              <div className="flex justify-between items-center border-b border-border-fin pb-3 mb-3">
                <h3 className="text-base font-bold text-primary-text">
                  {formData.accountType === 'Saving' ? 'Nominee Details' : 'Guarantor Details'}
                </h3>
                <button
                  type="button"
                  onClick={resetStep5}
                  className="flex items-center gap-1 text-[10px] font-extrabold text-danger-fin hover:underline cursor-pointer focus:outline-none transition-all active:scale-95 bg-transparent border-none p-0"
                >
                  <span className="material-symbols-rounded text-xs select-none">restart_alt</span>
                  Reset Step
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 py-2">
                <div 
                  onClick={() => document.getElementById('guarantor-photo-upload').click()}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-primary flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all relative overflow-hidden group"
                >
                  {formData.guarantorPhoto ? (
                    <img src={formData.guarantorPhoto} alt="Guarantor" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <span className="material-symbols-rounded text-xl text-secondary-text group-hover:text-primary select-none">add_a_photo</span>
                      <span className="text-[9px] text-secondary-text group-hover:text-primary/80 mt-0.5 font-bold">Photo</span>
                    </>
                  )}
                  <input
                    id="guarantor-photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData(prev => ({ ...prev, guarantorPhoto: reader.result }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-xs font-bold text-primary-text block mb-0.5">
                    {formData.accountType === 'Saving' ? 'Nominee Photo' : 'Guarantor Photo'}
                  </span>
                  <span className="text-[10px] text-secondary-text block font-medium">
                    {formData.guarantorPhoto ? (
                      <button 
                        type="button" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, guarantorPhoto: null }));
                        }}
                        className="text-danger-fin font-bold hover:underline"
                      >
                        Remove Photo
                      </button>
                    ) : (
                      'Max 2MB'
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">
                    {formData.accountType === 'Saving' ? 'Nominee Name' : 'Guarantor Name'}
                    {formData.accountType !== 'Saving' && userRole !== 'Super Admin' && <span className="text-danger-fin"> *</span>}
                  </label>
                  <input
                    type="text"
                    placeholder={formData.accountType === 'Saving' ? 'Enter Nominee Name' : 'Enter Guarantor Name'}
                    value={formData.guarantorName}
                    onChange={(e) => setFormData(prev => ({ ...prev, guarantorName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">
                    Mobile Number
                    {formData.accountType !== 'Saving' && userRole !== 'Super Admin' && <span className="text-danger-fin"> *</span>}
                  </label>
                  <input
                    type="tel"
                    placeholder="Enter Mobile Number"
                    value={formData.guarantorMobile}
                    onChange={(e) => setFormData(prev => ({ ...prev, guarantorMobile: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <Select
                  label={formData.accountType === 'Saving' ? 'Relation' : `Relation${userRole !== 'Super Admin' ? ' *' : ''}`}
                  required={formData.accountType !== 'Saving' && userRole !== 'Super Admin'}
                  options={[
                    { value: 'Spouse', label: 'Spouse' },
                    { value: 'Mother', label: 'Mother' },
                    { value: 'Father', label: 'Father' },
                    { value: 'Brother', label: 'Brother' },
                    { value: 'Sister', label: 'Sister' },
                    { value: 'Son', label: 'Son' },
                    { value: 'Daughter', label: 'Daughter' },
                    { value: 'Friend', label: 'Friend' },
                    { value: 'Other', label: 'Other' }
                  ]}
                  value={formData.guarantorRelation}
                  onChange={(val) => setFormData(prev => ({ ...prev, guarantorRelation: val }))}
                />

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">
                    Aadhaar Number
                    {formData.accountType !== 'Saving' && userRole !== 'Super Admin' && <span className="text-danger-fin"> *</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="1234 5678 9013"
                    maxLength="12"
                    value={formData.guarantorAadhaar}
                    onChange={(e) => setFormData(prev => ({ ...prev, guarantorAadhaar: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">
                    {formData.accountType === 'Saving' ? 'Nominee Address' : 'Guarantor Address'}
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Complete Address"
                    value={formData.guarantorAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, guarantorAddress: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div className="md:col-span-2 border-t border-[#E2E8F0] pt-4 mt-2">
                  <span className="block text-[10px] font-bold text-secondary-text mb-2 uppercase tracking-wider">
                    {formData.accountType === 'Saving' ? 'Nominee Aadhaar Card Upload' : 'Guarantor Aadhaar Card Upload'}
                  </span>
                  <div className="flex flex-wrap gap-4">
                    {/* Aadhaar Front */}
                    <div 
                      onClick={() => document.getElementById('guarantor-aadhaar-front-input').click()}
                      className="border border-border-fin rounded-xl p-4 bg-background-fin flex flex-col items-center text-center cursor-pointer hover:border-primary hover:bg-slate-50/50 hover:shadow-sm transition-all relative overflow-hidden group min-h-[100px] justify-center w-48"
                    >
                      {formData.guarantorAadhaarFront ? (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                          <img src={formData.guarantorAadhaarFront} alt="Guarantor Aadhaar Front" className="max-h-[50px] object-contain mb-1.5" />
                          <span className="text-[9px] text-danger-fin font-bold hover:underline" onClick={(e) => {
                            e.stopPropagation();
                            setFormData(prev => ({ ...prev, guarantorAadhaarFront: null }));
                          }}>Remove</span>
                        </div>
                      ) : (
                        <>
                          <span className="material-symbols-rounded text-xl text-secondary-text group-hover:text-primary transition-colors mb-1 select-none">badge</span>
                          <span className="text-[10px] font-bold text-primary-text block">Aadhaar Front</span>
                          <span className="text-[9px] text-[#64748B] block mt-0.5 font-semibold group-hover:text-primary/80 transition-colors">Click to Upload</span>
                        </>
                      )}
                      <input
                        id="guarantor-aadhaar-front-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData(prev => ({ ...prev, guarantorAadhaarFront: reader.result }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>

                    {/* Aadhaar Back */}
                    <div 
                      onClick={() => document.getElementById('guarantor-aadhaar-back-input').click()}
                      className="border border-border-fin rounded-xl p-4 bg-background-fin flex flex-col items-center text-center cursor-pointer hover:border-primary hover:bg-slate-50/50 hover:shadow-sm transition-all relative overflow-hidden group min-h-[100px] justify-center w-48"
                    >
                      {formData.guarantorAadhaarBack ? (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                          <img src={formData.guarantorAadhaarBack} alt="Guarantor Aadhaar Back" className="max-h-[50px] object-contain mb-1.5" />
                          <span className="text-[9px] text-danger-fin font-bold hover:underline" onClick={(e) => {
                            e.stopPropagation();
                            setFormData(prev => ({ ...prev, guarantorAadhaarBack: null }));
                          }}>Remove</span>
                        </div>
                      ) : (
                        <>
                          <span className="material-symbols-rounded text-xl text-secondary-text group-hover:text-primary transition-colors mb-1 select-none">badge</span>
                          <span className="text-[10px] font-bold text-primary-text block">Aadhaar Back</span>
                          <span className="text-[9px] text-[#64748B] block mt-0.5 font-semibold group-hover:text-primary/80 transition-colors">Click to Upload</span>
                        </>
                      )}
                      <input
                        id="guarantor-aadhaar-back-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData(prev => ({ ...prev, guarantorAadhaarBack: reader.result }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Review */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="bg-[#F8FAFC]/80 p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
              <div className="bg-white p-6 rounded-[calc(2rem-0.625rem)] space-y-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                <h3 className="text-base font-bold text-primary-text border-b border-border-fin pb-3 mb-2">Account & Plan Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-secondary-text block mb-1">Account Type</span>
                    <span className="font-bold text-primary-text">{formData.accountType === 'Loan' ? 'Loan Account' : 'Savings Account'}</span>
                  </div>
                  <div>
                    <span className="text-secondary-text block mb-1">Plan Name</span>
                    <span className="font-bold text-primary-text">{selectedPlan?.label.split(' - ')[0]}</span>
                  </div>
                  <div>
                    <span className="text-secondary-text block mb-1">Account Opening Date</span>
                    <span className="font-bold text-primary-text">{formData.startDate}</span>
                  </div>
                  {formData.accountType === 'Loan' ? (
                    <>
                      <div>
                        <span className="text-secondary-text block mb-1">Principal</span>
                        <span className="font-bold text-primary">₹{selectedPlan?.amount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-secondary-text block mb-1">Interest</span>
                        <span className="font-bold text-primary-text">₹{totalInterest.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-secondary-text block mb-1">Total Payable</span>
                        <span className="font-bold text-success-fin">₹{totalPayable.toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div>
                      <span className="text-secondary-text block mb-1">Maturity Amount</span>
                      <span className="font-bold text-success-fin">₹{selectedPlan?.maturity.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-[#F8FAFC]/80 p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
              <div className="bg-white p-6 rounded-[calc(2rem-0.625rem)] space-y-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                <h3 className="text-base font-bold text-primary-text border-b border-border-fin pb-3 mb-2">Customer Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-secondary-text block mb-1">Name</span>
                    <span className="font-bold text-primary-text">{formData.fullName}</span>
                  </div>
                  <div>
                    <span className="text-secondary-text block mb-1">Mobile</span>
                    <span className="font-bold text-primary-text">{formData.mobile}</span>
                  </div>
                  <div>
                    <span className="text-secondary-text block mb-1">Aadhaar</span>
                    <span className="font-bold text-primary-text">{formData.aadhaarNumber || 'Not Provided'}</span>
                  </div>
                  <div>
                    <span className="text-secondary-text block mb-1">PAN</span>
                    <span className="font-bold text-primary-text">{formData.panNumber || 'Not Provided'}</span>
                  </div>
                </div>

                <div className="border-t border-[#E2E8F0] pt-4 mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-secondary-text block mb-1">Bank Name</span>
                    <span className="font-bold text-primary-text">{formData.bankName || 'Not Provided'}</span>
                  </div>
                  <div>
                    <span className="text-secondary-text block mb-1">Account Number</span>
                    <span className="font-bold text-primary-text">{formData.bankAccountNo || 'Not Provided'}</span>
                  </div>
                  <div>
                    <span className="text-secondary-text block mb-1">IFSC Code</span>
                    <span className="font-bold text-primary-text">{formData.bankIfsc || 'Not Provided'}</span>
                  </div>
                </div>

                {(formData.photo || formData.aadhaarFront || formData.aadhaarBack || formData.panUpload || formData.signature || formData.chequeUpload || formData.guarantorPhoto || formData.guarantorAadhaarFront || formData.guarantorAadhaarBack) && (
                  <div className="border-t border-[#E2E8F0] pt-4 mt-2 space-y-2">
                    <span className="text-secondary-text block text-[10px] font-bold uppercase tracking-wider mb-2">Uploaded Documents & Photos</span>
                    <div className="flex flex-wrap gap-4">
                      {formData.photo && (
                        <div className="flex flex-col items-center border border-border-fin rounded-lg p-2 bg-background-fin w-20 text-center">
                          <img src={formData.photo} alt="Photo" className="w-12 h-12 object-cover rounded-md" />
                          <span className="text-[8px] font-bold text-secondary-text mt-1 truncate w-full">Photo</span>
                        </div>
                      )}
                      {formData.aadhaarFront && (
                        <div className="flex flex-col items-center border border-border-fin rounded-lg p-2 bg-background-fin w-20 text-center">
                          <img src={formData.aadhaarFront} alt="Aadhaar Front" className="w-12 h-12 object-contain" />
                          <span className="text-[8px] font-bold text-secondary-text mt-1 truncate w-full">Aadhaar F</span>
                        </div>
                      )}
                      {formData.aadhaarBack && (
                        <div className="flex flex-col items-center border border-border-fin rounded-lg p-2 bg-background-fin w-20 text-center">
                          <img src={formData.aadhaarBack} alt="Aadhaar Back" className="w-12 h-12 object-contain" />
                          <span className="text-[8px] font-bold text-secondary-text mt-1 truncate w-full">Aadhaar B</span>
                        </div>
                      )}
                      {formData.panUpload && (
                        <div className="flex flex-col items-center border border-border-fin rounded-lg p-2 bg-background-fin w-20 text-center">
                          <img src={formData.panUpload} alt="PAN Upload" className="w-12 h-12 object-contain" />
                          <span className="text-[8px] font-bold text-secondary-text mt-1 truncate w-full">PAN Card</span>
                        </div>
                      )}
                      {formData.signature && (
                        <div className="flex flex-col items-center border border-border-fin rounded-lg p-2 bg-background-fin w-20 text-center">
                          <img src={formData.signature} alt="Signature" className="w-12 h-12 object-contain" />
                          <span className="text-[8px] font-bold text-secondary-text mt-1 truncate w-full">Signature</span>
                        </div>
                      )}
                      {formData.chequeUpload && (
                        <div className="flex flex-col items-center border border-border-fin rounded-lg p-2 bg-background-fin w-20 text-center">
                          <img src={formData.chequeUpload} alt="Cheque" className="w-12 h-12 object-contain" />
                          <span className="text-[8px] font-bold text-secondary-text mt-1 truncate w-full">Cheque</span>
                        </div>
                      )}
                      {formData.guarantorPhoto && (
                        <div className="flex flex-col items-center border border-border-fin rounded-lg p-2 bg-background-fin w-20 text-center">
                          <img src={formData.guarantorPhoto} alt="Guarantor Photo" className="w-12 h-12 object-cover rounded-md" />
                          <span className="text-[8px] font-bold text-secondary-text mt-1 truncate w-full">
                            {formData.accountType === 'Saving' ? 'N. Photo' : 'G. Photo'}
                          </span>
                        </div>
                      )}
                      {formData.guarantorAadhaarFront && (
                        <div className="flex flex-col items-center border border-border-fin rounded-lg p-2 bg-background-fin w-20 text-center">
                          <img src={formData.guarantorAadhaarFront} alt="Guarantor Aadhaar Front" className="w-12 h-12 object-contain" />
                          <span className="text-[8px] font-bold text-secondary-text mt-1 truncate w-full">
                            {formData.accountType === 'Saving' ? 'N. Aadhaar F' : 'G. Aadhaar F'}
                          </span>
                        </div>
                      )}
                      {formData.guarantorAadhaarBack && (
                        <div className="flex flex-col items-center border border-border-fin rounded-lg p-2 bg-background-fin w-20 text-center">
                          <img src={formData.guarantorAadhaarBack} alt="Guarantor Aadhaar Back" className="w-12 h-12 object-contain" />
                          <span className="text-[8px] font-bold text-secondary-text mt-1 truncate w-full">
                            {formData.accountType === 'Saving' ? 'N. Aadhaar B' : 'G. Aadhaar B'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stepper Wizard Controls */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-border-fin shadow-sm">
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-5 py-3 border border-border-fin hover:bg-background-fin text-secondary-text rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-rounded text-sm select-none">arrow_back</span>
                Back
              </button>
            )}

            <button
              type="button"
              onClick={resetEntireForm}
              className="flex items-center gap-2 px-4 py-3 border border-danger-fin/20 text-danger-fin hover:bg-danger-fin/5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-rounded text-sm select-none">restart_alt</span>
              Reset Entire Form
            </button>
          </div>

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white hover:bg-primary/95 shadow-sm active:scale-[0.98] rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
            >
              Next
              <span className="material-symbols-rounded text-sm select-none">arrow_forward</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => handleSubmit(e, false)}
                className="px-6 py-3 bg-[#0A3598] text-white rounded-xl text-xs font-bold hover:bg-[#0A3598]/90 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
              >
                Save
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="flex items-center gap-2 px-6 py-3 bg-[#FFC107] text-white rounded-xl text-xs font-bold hover:bg-[#FFC107]/90 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
              >
                <span className="material-symbols-rounded text-sm select-none">print</span>
                Save & Print
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Custom themed confirm modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-200 animate-fade-in">
          <div className="bg-white rounded-[2rem] border border-border-fin max-w-sm w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center gap-3.5 pb-2 border-b border-border-fin">
              <div className="w-10 h-10 bg-danger-fin/10 text-danger-fin rounded-full flex items-center justify-center">
                <span className="material-symbols-rounded text-xl select-none">restart_alt</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-primary-text leading-none">{confirmDialog.title}</h4>
                <span className="text-[10px] text-secondary-text font-bold uppercase mt-1.5 block tracking-wider">Confirmation Needed</span>
              </div>
            </div>
            <p className="text-xs text-secondary-text leading-relaxed font-semibold">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={closeConfirm}
                className="px-4 py-2.5 border border-border-fin rounded-xl text-xs font-bold text-secondary-text hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-5 py-2.5 bg-danger-fin hover:bg-danger-fin/95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom themed success modal */}
      {successDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-200 animate-fade-in">
          <div className="bg-white rounded-[2rem] border border-border-fin max-w-sm w-full p-6 shadow-2xl text-center space-y-5 animate-scale-up">
            <div className="w-14 h-14 bg-success-fin/10 text-success-fin rounded-full flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-rounded text-3xl select-none">check_circle</span>
            </div>
            <div>
              <h4 className="text-base font-black text-primary-text">{successDialog.title}</h4>
              <p className="text-xs text-secondary-text mt-2 leading-relaxed font-medium">
                {successDialog.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSuccessDialog(prev => ({ ...prev, isOpen: false }))}
              className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/95 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              Okay, Done
            </button>
          </div>
        </div>
      )}

      {/* Custom themed warning/validation modal */}
      {warningDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-200 animate-fade-in">
          <div className="bg-white rounded-[2rem] border border-border-fin max-w-sm w-full p-6 shadow-2xl text-center space-y-5 animate-scale-up">
            <div className="w-14 h-14 bg-[#FEF3C7] text-[#D97706] rounded-full flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-rounded text-3xl select-none">warning</span>
            </div>
            <div>
              <h4 className="text-base font-black text-primary-text">{warningDialog.title}</h4>
              <p className="text-xs text-secondary-text mt-2 leading-relaxed font-medium">
                {warningDialog.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setWarningDialog(prev => ({ ...prev, isOpen: false }));
                if (pendingFocusField) {
                  focusField(pendingFocusField);
                  setPendingFocusField(null);
                }
              }}
              className="w-full py-3 bg-[#D97706] text-white rounded-xl text-xs font-bold hover:bg-[#D97706]/95 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
