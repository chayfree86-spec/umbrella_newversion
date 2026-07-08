import React, { useState, useEffect, useRef } from 'react';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import { branchApi, areaApi, agentApi, planApi, customerApi, settingsApi, fundApi } from '../services/api';

const inr = (val) => Number(val || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });



const getTodayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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

const getFinanceDurationDays = (durationVal, durationUnit) => {
  const dur = Number(durationVal) || 0;
  if (durationUnit === 'Months') return dur * 30;
  if (durationUnit === 'Years') return dur * 360;
  return dur;
};

const getFinanceDurationMonths = (durationVal, durationUnit) => {
  return getFinanceDurationDays(durationVal, durationUnit) / 30;
};

const calculateCustomMaturity = (depositAmt, rate, durationVal, durationUnit, frequency, startDate) => {
  const dAmt = parseFloat(depositAmt) || 0;
  const rVal = parseFloat(rate) || 0;
  const dur = parseFloat(durationVal) || 0;
  if (!dAmt || !dur) return '';

  const totalDays = getFinanceDurationDays(dur, durationUnit);
  const totalMonths = getFinanceDurationMonths(dur, durationUnit);

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

const calculateCustomEmi = (principal, rate, durationVal, durationUnit, frequency, interestType, loanPeriod = 'monthly', startDate) => {
  if (!principal || !rate || !durationVal) return '';

  const totalDays = getFinanceDurationDays(durationVal, durationUnit);
  const totalMonths = getFinanceDurationMonths(durationVal, durationUnit);

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

export default function CustomerRegistration() {
  const [branches, setBranches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [agents, setAgents] = useState([]);
  const [areaAgents, setAreaAgents] = useState([]);
  const [dbLoanPlans, setDbLoanPlans] = useState([]);
  const [dbSavingPlans, setDbSavingPlans] = useState([]);
  const [liveSettings, setLiveSettings] = useState({});
  const [availableLoanFund, setAvailableLoanFund] = useState(0);

  // Fresh form state — nothing persists in localStorage, everything stays live
  const getInitialFormData = () => {
    return {
      accountType: 'Loan',
      planId: '',
      startDate: getTodayDateString(),
      customAmount: '',
      customRate: '',
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

  const [formData, setFormData] = useState(getInitialFormData);

  const [currentStep, setCurrentStep] = useState(1);

  const getAgentsFor = (branchId, areaId) =>
    agents.filter(ag =>
      (!branchId || String(ag.branch_id) === String(branchId)) &&
      (!areaId || String(ag.area_id) === String(areaId)) &&
      (!ag.status || ag.status === 'Active')
    );

  const pickAreaAndAgentForBranch = (branchId) => {
    const branchAreas = areas.filter(a => String(a.branch_id) === String(branchId));
    const areaWithAgents = branchAreas.find(area => getAgentsFor(branchId, area.id).length > 0);
    const selectedArea = areaWithAgents || branchAreas[0];
    const areaId = selectedArea ? String(selectedArea.id) : '';
    const areaAgents = areaId ? getAgentsFor(branchId, areaId) : [];
    const sortedAgents = [...areaAgents].sort((a, b) => (Number(b.customers_count) || 0) - (Number(a.customers_count) || 0));

    return {
      area: areaId,
      agent: sortedAgents[0] ? String(sortedAgents[0].id) : ''
    };
  };

  // Draft restore from localStorage removed — registrations are live-only.

  // Draft auto-save to localStorage (accounts_database_v2) removed —
  // no app data is kept in localStorage; everything lives on the server.

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

    fundApi.summary()
      .then(res => setAvailableLoanFund(Number(res.data?.available_loan_fund || 0)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!formData.area) {
      setAreaAgents([]);
      return;
    }

    const fallbackAgents = getAgentsFor(formData.branch, formData.area);
    setAreaAgents(fallbackAgents);

    let cancelled = false;
    areaApi.agents(formData.area)
      .then(res => {
        if (cancelled) return;
        const activeAgents = (res.data || []).filter(ag => !ag.status || ag.status === 'Active');
        const sortedAgents = [...activeAgents].sort((a, b) => (Number(b.customers_count) || 0) - (Number(a.customers_count) || 0));
        setAreaAgents(sortedAgents);
        setFormData(prev => {
          if (String(prev.area) !== String(formData.area)) return prev;
          if (prev.agent && sortedAgents.some(ag => String(ag.id) === String(prev.agent))) return prev;
          return { ...prev, agent: sortedAgents[0] ? String(sortedAgents[0].id) : '' };
        });
      })
      .catch(() => setAreaAgents(fallbackAgents));

    return () => {
      cancelled = true;
    };
  }, [formData.branch, formData.area, agents]);

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
          customRate: '',
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
          customAmount: '', customRate: '', customDuration: '', customDurationUnit: 'Days', customFrequency: 'Daily', customType: 'Flat', customEmi: '', customProcessingFee: '0', customPenalty: '0', customDailyDeposit: '', customMaturity: '',
          fullName: '', mobile: '', altMobile: '', dob: '', gender: 'Male',
          fatherHusbandName: '', occupation: '', monthlyIncome: '',
          branch: '', area: '', agent: '', photo: null,
          houseNumber: '', street: '', villageCity: '', landmark: '', district: '', state: 'Uttar Pradesh', pinCode: '',
          aadhaarNumber: '', panNumber: '', bankName: '', bankAccountNo: '', bankIfsc: '', chequeUpload: null, aadhaarFront: null, aadhaarBack: null, panUpload: null, signature: null,
          guarantorPhoto: null, guarantorName: '', guarantorMobile: '', guarantorRelation: '', guarantorAddress: '', guarantorAadhaar: '', guarantorAadhaarFront: null, guarantorAadhaarBack: null
        });
        setCurrentStep(1);
      }
    );
  };

  const loanPlans = dbLoanPlans.map(p => {
    const durVal = Number(p.duration_value);
    const durUnit = p.duration_unit || 'Days';
    const durationInMonths = getFinanceDurationMonths(durVal, durUnit);

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
      N = getFinanceDurationDays(durVal, durUnit);
    } else if (freq === 'Weekly') {
      N = Math.round(getFinanceDurationDays(durVal, durUnit) / 7);
    } else if (freq === 'Monthly') {
      N = Math.round(getFinanceDurationMonths(durVal, durUnit));
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
          durationUnit: formData.customDurationUnit || 'Days',
          frequency: formData.customFrequency || 'Daily',
          maturity: Number(formData.customMaturity) || 0
        })
    : (formData.accountType === 'Loan' 
      ? (() => {
          const plan = loanPlans.find(p => p.value === formData.planId);
          if (!plan) return null;
          return {
            ...plan,
            amount: formData.customAmount !== '' ? Number(formData.customAmount) : plan.amount,
            rate: formData.customRate !== '' ? Number(formData.customRate) : plan.rate,
            duration: formData.customDuration !== '' ? Number(formData.customDuration) : plan.duration,
            durationUnit: formData.customDurationUnit !== '' ? formData.customDurationUnit : plan.durationUnit,
            frequency: formData.customFrequency !== '' ? formData.customFrequency : plan.frequency,
            type: formData.customType !== '' ? formData.customType : plan.type,
            emi: formData.customEmi !== '' ? Number(formData.customEmi) : plan.emi,
            processingFee: formData.customProcessingFee !== '' ? Number(formData.customProcessingFee) : plan.processingFee,
            penalty: formData.customPenalty !== '' ? Number(formData.customPenalty) : plan.penalty
          };
        })()
      : formData.accountType === 'Saving'
      ? (() => {
          const plan = savingPlans.find(p => p.value === formData.planId);
          if (!plan) return null;
          return {
            ...plan,
            dailyDeposit: formData.customDailyDeposit !== '' ? Number(formData.customDailyDeposit) : plan.dailyDeposit,
            rate: formData.customRate !== '' ? Number(formData.customRate) : plan.rate,
            duration: formData.customDuration !== '' ? Number(formData.customDuration) : plan.duration,
            durationUnit: formData.customDurationUnit !== '' ? formData.customDurationUnit : plan.durationUnit,
            frequency: formData.customFrequency !== '' ? formData.customFrequency : plan.frequency,
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
        date.setDate(date.getDate() + (duration * 30));
      } else if (durationUnit === 'Years') {
        date.setDate(date.getDate() + (duration * 360));
      }
      return date.toLocaleDateString('sv-SE');
    }
    if (freq === 'Daily') {
      date.setDate(date.getDate() + duration);
    } else if (freq === 'Weekly') {
      date.setDate(date.getDate() + (duration * 7));
    } else if (freq === 'Monthly') {
      const expectedMonth = (date.getMonth() + duration) % 12;
      date.setMonth(date.getMonth() + duration);
      if (date.getMonth() !== expectedMonth) {
        date.setDate(0);
      }
    }
    return date.toLocaleDateString('sv-SE');
  };

  const planEndDate = selectedPlan && formData.startDate
    ? calculateEndDate(
        formData.startDate, 
        selectedPlan.duration, 
        selectedPlan.frequency,
        selectedPlan.durationUnit
      )
    : '';

  useEffect(() => {
    if (formData.accountType === 'Loan' && formData.planId) {
      const calculatedEmi = calculateCustomEmi(
        Number(formData.customAmount) || 0,
        Number(formData.customRate) || 0,
        Number(formData.customDuration) || 0,
        formData.customDurationUnit || 'Days',
        formData.customFrequency || 'Daily',
        formData.customType || 'Flat',
        liveSettings.interest_calculation_period_loan || 'monthly',
        formData.startDate
      );
      setFormData(prev => {
        if (calculatedEmi === '') return prev;
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
          durUnit = formData.customDurationUnit !== '' ? formData.customDurationUnit : plan.duration_unit;
          freq = formData.customFrequency !== '' ? formData.customFrequency : plan.collection_frequency;
          if (formData.customDailyDeposit === '' && formData.customRate === '' && formData.customDuration === '') {
            deposit = Number(plan.deposit_amount);
            rate = Number(plan.interest_rate);
            duration = Number(plan.duration_value);
            durUnit = plan.duration_unit;
            freq = plan.collection_frequency;
            
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
        freq,
        formData.startDate
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
    formData.startDate,
    dbSavingPlans,
    liveSettings
  ]);

  const durationInMonths = (() => {
    if (!selectedPlan) return 0;
    const durVal = selectedPlan.duration;
    const durUnit = selectedPlan.durationUnit || (formData.planId === 'custom' ? formData.customDurationUnit : 'Days');
    return getFinanceDurationMonths(durVal, durUnit);
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
  const isAgentUser = userRole === 'Agent / Collection Executive';
  // Agent ke liye KYC hamesha mandatory — setting off ho tab bhi.
  const kycMandatory = isAgentUser || liveSettings.mandatory_kyc !== false;
  const isKycFieldRequired = userRole !== 'Super Admin' && kycMandatory;

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
    const selectedBranchObj = branches.find(b => String(b.id) === String(formData.branch));
    const isBranchRegSuspended = selectedBranchObj && selectedBranchObj.allow_registrations === false;
    if (isBranchRegSuspended) return false;
    return formData.fullName && formData.mobile && formData.dob && formData.gender && formData.branch && formData.area && formData.agent;
  };

  const isStep3Valid = () => {
    return formData.houseNumber && formData.street && formData.villageCity && formData.district && formData.state && formData.pinCode;
  };

  const isStep4Valid = () => {
    if (userRole === 'Super Admin') return true;
    if (!kycMandatory) return true;
    return formData.aadhaarNumber && formData.panNumber && formData.bankName && formData.bankAccountNo && formData.bankIfsc;
  };

  const isStep5Valid = () => {
    if (userRole === 'Super Admin') return true;
    // Agent ke liye guarantor (loan) / nominee (saving) hamesha mandatory
    if (formData.accountType === 'Saving') {
      if (isAgentUser) {
        return formData.guarantorName && formData.guarantorMobile && formData.guarantorRelation && formData.guarantorAadhaar;
      }
      return true;
    }
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
      const selectedBranchObj = branches.find(b => String(b.id) === String(formData.branch));
      const isBranchRegSuspended = selectedBranchObj && selectedBranchObj.allow_registrations === false;
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
      // Agent ke liye KYC hamesha mandatory (setting bypass nahi)
      if (userRole !== 'Super Admin' && kycMandatory) {
        if (!formData.aadhaarNumber) { missingField = 'aadhaarNumber'; missingLabel = 'Aadhaar Number'; }
        else if (!formData.panNumber) { missingField = 'panNumber'; missingLabel = 'PAN Number'; }
        else if (!formData.bankName) { missingField = 'bankName'; missingLabel = 'Bank Name'; }
        else if (!formData.bankAccountNo) { missingField = 'bankAccountNo'; missingLabel = 'Bank Account Number'; }
        else if (!formData.bankIfsc) { missingField = 'bankIfsc'; missingLabel = 'Bank IFSC Code'; }
      }
    } else if (currentStep === 5) {
      // Loan par guarantor; Saving par nominee — agent ke liye dono mandatory
      const needGuarantor = userRole !== 'Super Admin' &&
        (formData.accountType === 'Loan' || isAgentUser);
      if (needGuarantor) {
        const label = formData.accountType === 'Saving' ? 'Nominee' : 'Guarantor';
        if (!formData.guarantorName) { missingField = 'guarantorName'; missingLabel = `${label} Name`; }
        else if (!formData.guarantorMobile) { missingField = 'guarantorMobile'; missingLabel = `${label} Mobile`; }
        else if (!formData.guarantorRelation) { missingField = 'guarantorRelation'; missingLabel = `${label} Relation`; }
        else if (!formData.guarantorAadhaar) { missingField = 'guarantorAadhaar'; missingLabel = `${label} Aadhaar`; }
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

  // Uploads captured KYC images (base64 data URLs) to the server after
  // registration so documents live in the backend, not the browser.
  const uploadKycDocuments = (customerId, data) => {
    const dataUrlToBlob = (dataUrl) => {
      try {
        const [head, body] = dataUrl.split(',');
        const mime = (head.match(/data:(.*?);base64/) || [])[1] || 'image/jpeg';
        const bin = atob(body);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
      } catch {
        return null;
      }
    };

    // Keys aadhaar_front / aadhaar_back / pan / cheque update customer_kyc
    // paths on the backend; the rest are stored in customer_documents.
    const docs = {
      aadhaar_front: data.aadhaarFront,
      aadhaar_back: data.aadhaarBack,
      pan: data.panUpload,
      cheque: data.chequeUpload,
      photo: data.photo,
      signature: data.signature,
      guarantor_photo: data.guarantorPhoto,
      guarantor_aadhaar_front: data.guarantorAadhaarFront,
      guarantor_aadhaar_back: data.guarantorAadhaarBack
    };

    const fd = new FormData();
    let count = 0;
    Object.entries(docs).forEach(([key, val]) => {
      if (val && typeof val === 'string' && val.startsWith('data:')) {
        const blob = dataUrlToBlob(val);
        if (blob) {
          const ext = blob.type === 'image/png' ? 'png' : 'jpg';
          fd.append(key, blob, `${key}.${ext}`);
          count++;
        }
      }
    });

    if (count === 0) return Promise.resolve();
    return customerApi.uploadDocs(customerId, fd);
  };

  const handleSubmit = (e, print = false) => {
    e.preventDefault();

    // Enforce full step-by-step validations before submitting
    if (!isStep1Valid()) {
      setCurrentStep(1);
      showWarning('Required Field Missing', 'Please complete Step 1 (Account Setup) details before saving.');
      return;
    }
    if (!isStep2Valid()) {
      setCurrentStep(2);
      showWarning('Required Field Missing', 'Please complete Step 2 (Customer Profile) details before saving.');
      return;
    }
    if (!isStep3Valid()) {
      setCurrentStep(3);
      showWarning('Required Field Missing', 'Please complete Step 3 (Address Details) details before saving.');
      return;
    }
    if (!isStep4Valid()) {
      setCurrentStep(4);
      showWarning('Required Field Missing', 'Please complete Step 4 (KYC Details) details before saving.');
      return;
    }
    if (!isStep5Valid()) {
      setCurrentStep(5);
      showWarning('Required Field Missing', 'Please complete Step 5 (Guarantor Details) details before saving.');
      return;
    }

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
      interest_type: formData.accountType === 'Saving' ? 'Flat' : (formData.planId === 'custom' ? formData.customType : (selectedPlan?.type ?? 'Flat')),
      duration_value: formData.planId === 'custom'
        ? (parseInt(formData.customDuration) || 0)
        : (selectedPlan?.duration ?? 0),
      duration_unit: formData.planId === 'custom'
        ? formData.customDurationUnit
        : (selectedPlan?.durationUnit ?? (selectedPlan?.frequency === 'Daily' ? 'Days' : 'Months')),
      collection_frequency: formData.planId === 'custom'
        ? formData.customFrequency
        : (selectedPlan?.frequency ?? 'Daily'),
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
        // Push captured KYC documents to the server (non-blocking)
        const newCustomerId = res.data?.customer_id;
        if (newCustomerId) {
          uploadKycDocuments(newCustomerId, formData)
            .catch(() => {
              showWarning(
                'Document Upload Failed',
                'Customer was registered, but KYC documents could not be uploaded. Please re-upload them from the customer profile.'
              );
            });
        }
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
          customAmount: '', customRate: '', customDuration: '', customDurationUnit: 'Days', customFrequency: 'Daily', customType: 'Flat', customEmi: '', customProcessingFee: '0', customPenalty: '0', customDailyDeposit: '', customMaturity: '',
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
      })
      .catch(err => {
        showWarning('Registration Failed', err.message || 'Server error occurred during customer onboarding.');
      });
  };

  const [activeUploadDoc, setActiveUploadDoc] = useState(null); // { name, key, fileInputId }
  const [cameraTargetKey, setCameraTargetKey] = useState(null);
  const [videoStream, setVideoStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);

  const startCamera = async (key) => {
    setCameraTargetKey(key);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setVideoStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 300);
    } catch (err) {
      alert("Camera access denied or not available: " + err.message);
      setCameraTargetKey(null);
    }
  };

  const stopCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setCameraTargetKey(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && cameraTargetKey) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      setFormData(prev => ({ ...prev, [cameraTargetKey]: dataUrl }));
      stopCamera();
    }
  };

  const toggleCameraFacing = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode }
      });
      setVideoStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error toggling camera: ", err);
    }
  };

  const stepsList = [
    { num: 1, name: 'Account Setup' },
    { num: 2, name: 'Customer Details' },
    { num: 3, name: 'Address' },
    { num: 4, name: 'KYC Details' },
    { num: 5, name: formData.accountType === 'Saving' ? 'Nominee' : 'Guarantor' },
    { num: 6, name: 'Review & Save' }
  ];

  const isRegistrationAllowed = liveSettings.allow_registrations !== false;

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
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-border-fin shadow-sm overflow-hidden md:overflow-visible">
        <div className="flex items-center justify-between w-full md:min-w-[650px] px-2">
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
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 group-hover:scale-105 ${
                    currentStep === step.num
                      ? (formData.accountType === 'Saving'
                          ? 'text-slate-950 ring-4 ring-[#FBBF24]/30 scale-105 border border-[#F59E0B]/30'
                          : 'bg-primary text-white ring-4 ring-primary/10 scale-105')
                      : currentStep > step.num
                      ? 'bg-[#16A34A] text-white'
                      : 'bg-background-fin border border-[#CBD5E1] text-[#64748B] group-hover:border-primary/50'
                  }`}
                  style={currentStep === step.num && formData.accountType === 'Saving' ? { background: 'linear-gradient(135deg, #FFD54A 0%, #FBBF24 35%, #F59E0B 70%, #E67E00 100%)' } : {}}
                >
                  {currentStep > step.num ? (
                    <span className="material-symbols-rounded text-xs select-none">check</span>
                  ) : (
                    step.num
                  )}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider text-center transition-colors hidden md:block ${
                  currentStep === step.num
                    ? (formData.accountType === 'Saving' ? 'text-[#B45309]' : 'text-primary')
                    : 'text-[#64748B] group-hover:text-primary-text'
                }`}>
                  {step.name}
                </span>
              </div>
              {idx < stepsList.length - 1 && (
                <div className="flex-1 h-[2px] bg-[#E2E8F0] relative top-0 md:-top-3">
                  <div className="absolute top-0 left-0 bottom-0 bg-[#16A34A] transition-all duration-500" style={{
                    width: currentStep > step.num ? '100%' : '0%'
                  }}></div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="text-center mt-3.5 md:hidden">
          <span className="text-[10px] font-black uppercase tracking-wider text-primary">
            Step {currentStep} of 6: {stepsList[currentStep - 1].name}
          </span>
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
            <div className="md:col-span-2 bg-[#F8FAFC]/80 p-1 sm:p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
              <div className="bg-white p-4 sm:p-6 rounded-[calc(2rem-0.625rem)] space-y-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
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
                  <>
                    <Select
                      label="Select Plan"
                      required={true}
                      value={formData.planId}
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
                            customRate: '',
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
                              customEmi: plan ? String(plan.emi) : '', 
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

                    {formData.accountType === 'Loan' && (
                      <div className="mt-4 flex items-center justify-between p-3.5 bg-emerald-50/50 border border-emerald-100/80 rounded-xl animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-rounded text-emerald-600 text-lg">account_balance_wallet</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Available Loan Fund</span>
                        </div>
                        <span className="text-sm font-extrabold text-emerald-600">{inr(availableLoanFund)}</span>
                      </div>
                    )}
                  </>
                )}

                {formData.planId && formData.planId !== '' && formData.accountType === 'Loan' && (
                  <div className="border-t border-[#E2E8F0] pt-4 mt-2 space-y-4">
                    <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider">{formData.planId === 'custom' ? 'Custom Loan Details' : 'Loan Plan Parameters'}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Principal Amount <span className="text-danger-fin">*</span></label>
                        <input
                          type="number"
                          placeholder="E.g., 10000"
                          value={formData.customAmount}
                          onChange={(e) => setFormData(prev => ({ ...prev, customAmount: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Interest Rate (%) <span className="text-danger-fin">*</span></label>
                        <input
                          type="number"
                          placeholder="E.g., 12"
                          value={formData.customRate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, customRate: val }));
                          }}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                      <Select
                        label="Interest Type"
                        required={true}
                        options={[
                          { value: 'Flat', label: 'Flat Interest' },
                          { value: 'Reducing', label: 'Reducing Interest' }
                        ]}
                        value={formData.customType}
                        onChange={(val) => setFormData(prev => ({ ...prev, customType: val }))}
                      />
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Duration <span className="text-danger-fin">*</span></label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="E.g., 100"
                            value={formData.customDuration}
                            onChange={(e) => setFormData(prev => ({ ...prev, customDuration: e.target.value }))}
                            className="flex-1 min-w-0 px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                          />
                          <div className="w-36 flex-shrink-0">
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
                        label="Frequency"
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
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Installment / EMI <span className="text-danger-fin">*</span></label>
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
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Deposit Amount <span className="text-danger-fin">*</span></label>
                        <input
                          type="number"
                          placeholder="E.g., 100"
                          value={formData.customDailyDeposit}
                          onChange={(e) => setFormData(prev => ({ ...prev, customDailyDeposit: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Interest Rate (%) <span className="text-danger-fin">*</span></label>
                        <input
                          type="number"
                          placeholder="E.g., 6"
                          value={formData.customRate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, customRate: val }));
                          }}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Duration <span className="text-danger-fin">*</span></label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="E.g., 365"
                            value={formData.customDuration}
                            onChange={(e) => setFormData(prev => ({ ...prev, customDuration: e.target.value }))}
                            className="flex-1 min-w-0 px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                          />
                            <div className="w-36 flex-shrink-0">
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
                        label="Frequency"
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
            <div className="bg-[#F8FAFC]/80 p-1 sm:p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm md:sticky md:top-6 z-20 flex flex-col">
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
                                {selectedPlan.duration} {selectedPlan.durationUnit}
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
                                {selectedPlan.duration} {selectedPlan.durationUnit}
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
          <div className="bg-[#F8FAFC]/80 p-1 sm:p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
            <div className="bg-white p-4 sm:p-6 rounded-[calc(2rem-0.625rem)] space-y-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
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
                  onClick={() => setActiveUploadDoc({ name: 'Customer Profile Photo', key: 'photo', fileInputId: 'customer-photo-upload' })}
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
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Full Name <span className="text-danger-fin">*</span></label>
                  <input
                    type="text"
                    placeholder="Enter Full Name"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Mobile Number <span className="text-danger-fin">*</span></label>
                  <input
                    type="tel"
                    placeholder="Enter Mobile Number"
                    value={formData.mobile}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData(prev => ({ ...prev, mobile: val }));
                      if (val.length === 10) {
                        customerApi.checkMobile(val)
                          .then(res => {
                            if (res.data && res.data.registered) {
                              showWarning(
                                'Mobile Number Registered',
                                `Mobile number is already registered with ${res.data.customer.full_name} (${res.data.customer.customer_code}).`
                              );
                            }
                          })
                          .catch(() => {});
                      }
                    }}
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
                    onChange={(val) => {
                      const nextAssignment = pickAreaAndAgentForBranch(val);
                      setAreaAgents(nextAssignment.area ? getAgentsFor(val, nextAssignment.area) : []);

                      setFormData(prev => ({
                        ...prev,
                        branch: val,
                        area: nextAssignment.area,
                        agent: nextAssignment.agent
                      }));
                    }}
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
                  onChange={(val) => {
                    const filteredAgents = getAgentsFor(formData.branch, val);
                    setAreaAgents(filteredAgents);
                    let bestAgentId = '';
                    if (filteredAgents.length > 0) {
                      const sortedAgents = [...filteredAgents].sort((a, b) => (Number(b.customers_count) || 0) - (Number(a.customers_count) || 0));
                      bestAgentId = String(sortedAgents[0].id);
                    }

                    setFormData(prev => ({
                      ...prev,
                      area: val,
                      agent: bestAgentId
                    }));
                  }}
                />

                <Select
                  label="Assigned Agent"
                  required={true}
                  options={areaAgents
                    .map(ag => ({ value: String(ag.id), label: `${ag.name} (${ag.code})` }))}
                  value={formData.agent}
                  onChange={(val) => {
                    setFormData(prev => ({ ...prev, agent: val }));
                  }}
                  emptyMessage={formData.area ? 'No active agents assigned to this area' : 'Select area first'}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Address */}
        {currentStep === 3 && (
          <div className="bg-[#F8FAFC]/80 p-1 sm:p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
            <div className="bg-white p-4 sm:p-6 rounded-[calc(2rem-0.625rem)] space-y-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
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
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">House Number <span className="text-danger-fin">*</span></label>
                  <input
                    type="text"
                    placeholder="Enter House Number"
                    value={formData.houseNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, houseNumber: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Street / Road <span className="text-danger-fin">*</span></label>
                  <input
                    type="text"
                    placeholder="Enter Street / Road Name"
                    value={formData.street}
                    onChange={(e) => setFormData(prev => ({ ...prev, street: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Village / City <span className="text-danger-fin">*</span></label>
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
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">District <span className="text-danger-fin">*</span></label>
                  <input
                    type="text"
                    placeholder="Enter District Name"
                    value={formData.district}
                    onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/60 focus:outline-none focus:bg-white focus:border-primary/45 focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>

                <Select
                  label="State"
                  required={true}
                  options={[
                    { value: 'Uttar Pradesh', label: 'Uttar Pradesh' },
                    { value: 'Madhya Pradesh', label: 'Madhya Pradesh' },
                    { value: 'Bihar', label: 'Bihar' }
                  ]}
                  value={formData.state}
                  onChange={(val) => setFormData(prev => ({ ...prev, state: val }))}
                />

                <div>
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">PIN Code <span className="text-danger-fin">*</span></label>
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
          <div className="bg-[#F8FAFC]/80 p-1 sm:p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
            <div className="bg-white p-4 sm:p-6 rounded-[calc(2rem-0.625rem)] space-y-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
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
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">Aadhaar Number {isKycFieldRequired && <span className="text-danger-fin">*</span>}</label>
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
                  <label className="block text-[10px] font-bold text-secondary-text mb-1.5 uppercase tracking-wider">PAN Number {isKycFieldRequired && <span className="text-danger-fin">*</span>}</label>
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
                    onClick={() => setActiveUploadDoc({ name: doc.name, key: doc.key, fileInputId: `file-upload-${doc.key}` })}
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
          <div className="bg-[#F8FAFC]/80 p-1 sm:p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
            <div className="bg-white p-4 sm:p-6 rounded-[calc(2rem-0.625rem)] space-y-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
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
                  onClick={() => setActiveUploadDoc({ name: formData.accountType === 'Saving' ? 'Nominee Photo' : 'Guarantor Photo', key: 'guarantorPhoto', fileInputId: 'guarantor-photo-upload' })}
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
                      onClick={() => setActiveUploadDoc({ name: formData.accountType === 'Saving' ? 'Nominee Aadhaar Front' : 'Guarantor Aadhaar Front', key: 'guarantorAadhaarFront', fileInputId: 'guarantor-aadhaar-front-input' })}
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
                      onClick={() => setActiveUploadDoc({ name: formData.accountType === 'Saving' ? 'Nominee Aadhaar Back' : 'Guarantor Aadhaar Back', key: 'guarantorAadhaarBack', fileInputId: 'guarantor-aadhaar-back-input' })}
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
            <div className="bg-[#F8FAFC]/80 p-1 sm:p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
              <div className="bg-white p-4 sm:p-6 rounded-[calc(2rem-0.625rem)] space-y-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                <h3 className="text-base font-bold text-primary-text border-b border-border-fin pb-3 mb-2">Account & Plan Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-xs font-semibold">
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
                        <span className="text-secondary-text block mb-1">Interest Rate</span>
                        <span className="font-bold text-primary-text">{selectedPlan?.rate}% ({selectedPlan?.type})</span>
                      </div>
                      <div>
                        <span className="text-secondary-text block mb-1">Duration</span>
                        <span className="font-bold text-primary-text">
                          {selectedPlan?.duration} {selectedPlan?.durationUnit}
                        </span>
                      </div>
                      <div>
                        <span className="text-secondary-text block mb-1">Installment (EMI)</span>
                        <span className="font-bold text-primary-text">₹{selectedPlan?.emi.toLocaleString()} ({selectedPlan?.frequency})</span>
                      </div>
                      <div>
                        <span className="text-secondary-text block mb-1">Total Interest</span>
                        <span className="font-bold text-primary-text">₹{totalInterest.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-secondary-text block mb-1">Total Payable</span>
                        <span className="font-bold text-success-fin">₹{totalPayable.toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-secondary-text block mb-1">Deposit Amount</span>
                        <span className="font-bold text-primary">₹{selectedPlan?.dailyDeposit.toLocaleString()} ({selectedPlan?.frequency})</span>
                      </div>
                      <div>
                        <span className="text-secondary-text block mb-1">Interest Rate</span>
                        <span className="font-bold text-primary-text">{selectedPlan?.rate}%</span>
                      </div>
                      <div>
                        <span className="text-secondary-text block mb-1">Duration</span>
                        <span className="font-bold text-primary-text">
                          {selectedPlan?.duration} {selectedPlan?.durationUnit}
                        </span>
                      </div>
                      <div>
                        <span className="text-secondary-text block mb-1">Maturity Amount</span>
                        <span className="font-bold text-success-fin">₹{selectedPlan?.maturity.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-[#F8FAFC]/80 p-1 sm:p-2.5 rounded-[2rem] border border-[#E2E8F0] shadow-sm">
              <div className="bg-white p-4 sm:p-6 rounded-[calc(2rem-0.625rem)] space-y-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
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
          <div className="flex items-center gap-1.5">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1 px-3 py-2.5 sm:px-5 sm:py-3 border border-border-fin hover:bg-background-fin text-secondary-text rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-rounded text-sm select-none">arrow_back</span>
                Back
              </button>
            )}

            <button
              type="button"
              onClick={resetEntireForm}
              className="flex items-center gap-1 px-3 py-2.5 sm:px-4 sm:py-3 border border-danger-fin/20 text-danger-fin hover:bg-danger-fin/5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-rounded text-sm select-none">restart_alt</span>
              <span className="hidden sm:inline">Reset Entire Form</span>
              <span className="sm:hidden">Reset</span>
            </button>
          </div>

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-2.5 sm:px-6 sm:py-3 bg-primary text-white hover:bg-primary/95 shadow-sm active:scale-[0.98] rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
            >
              Next
              <span className="material-symbols-rounded text-sm select-none">arrow_forward</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => handleSubmit(e, false)}
                className={`px-6 py-3 rounded-xl text-xs font-bold active:scale-[0.98] transition-all cursor-pointer shadow-sm ${
                  formData.accountType === 'Saving'
                    ? 'text-slate-950 hover:opacity-95'
                    : 'bg-[#0A3598] hover:bg-[#0A3598]/90 text-white'
                }`}
                style={formData.accountType === 'Saving' ? { background: 'linear-gradient(135deg, #FFD54A 0%, #FBBF24 35%, #F59E0B 70%, #E67E00 100%)' } : {}}
              >
                Save
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold active:scale-[0.98] transition-all cursor-pointer shadow-sm ${
                  formData.accountType === 'Saving'
                    ? 'text-slate-950 hover:opacity-95'
                    : 'bg-[#0A3598] hover:bg-[#0A3598]/90 text-white'
                }`}
                style={formData.accountType === 'Saving' ? { background: 'linear-gradient(135deg, #FFD54A 0%, #FBBF24 35%, #F59E0B 70%, #E67E00 100%)' } : {}}
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

      {/* Choice Modal (Camera vs File) */}
      {activeUploadDoc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-200 animate-fade-in">
          <div className="bg-white rounded-[2rem] border border-border-fin max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-border-fin pb-2">
              <h4 className="text-sm font-black text-primary-text">{activeUploadDoc.name}</h4>
              <button 
                type="button" 
                onClick={() => setActiveUploadDoc(null)} 
                className="text-secondary-text hover:text-primary-text cursor-pointer"
              >
                <span className="material-symbols-rounded text-lg select-none">close</span>
              </button>
            </div>
            <p className="text-[11px] font-bold text-secondary-text">Select how you want to upload this document:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  const key = activeUploadDoc.key;
                  setActiveUploadDoc(null);
                  startCamera(key);
                }}
                className="flex flex-col items-center justify-center p-4 border border-border-fin hover:border-primary bg-background-fin hover:bg-slate-50/50 rounded-xl gap-2 font-bold text-xs text-primary-text cursor-pointer transition-all active:scale-[0.97]"
              >
                <span className="material-symbols-rounded text-2xl text-primary">photo_camera</span>
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => {
                  const inputId = activeUploadDoc.fileInputId;
                  setActiveUploadDoc(null);
                  setTimeout(() => {
                    document.getElementById(inputId).click();
                  }, 100);
                }}
                className="flex flex-col items-center justify-center p-4 border border-border-fin hover:border-primary bg-background-fin hover:bg-slate-50/50 rounded-xl gap-2 font-bold text-xs text-primary-text cursor-pointer transition-all active:scale-[0.97]"
              >
                <span className="material-symbols-rounded text-2xl text-success-fin">upload_file</span>
                Upload File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTML5 Camera Overlay Modal */}
      {cameraTargetKey && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4 transition-all duration-200">
          <div className="bg-slate-950 rounded-2xl overflow-hidden max-w-md w-full relative flex flex-col shadow-2xl border border-slate-800 animate-scale-up">
            {/* Video stream container */}
            <div className="relative aspect-[3/4] bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {/* Helper overlay box for framing the ID card */}
              <div className="absolute inset-8 border-2 border-dashed border-white/50 rounded-lg pointer-events-none flex items-center justify-center">
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest bg-black/40 px-2.5 py-1 rounded-full">Frame Document Here</span>
              </div>
            </div>
            
            {/* Camera Controls */}
            <div className="p-5 bg-slate-900 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              
              {/* Capture circle button */}
              <button
                type="button"
                onClick={capturePhoto}
                className="w-14 h-14 bg-white hover:bg-slate-100 rounded-full flex items-center justify-center shadow-lg border-4 border-slate-800 active:scale-90 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full border border-slate-950 bg-white" />
              </button>
              
              {/* Switch camera toggle button */}
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center justify-center text-white cursor-pointer active:scale-95 transition-all"
                title="Switch Camera"
              >
                <span className="material-symbols-rounded text-lg select-none">flip_camera_ios</span>
              </button>
            </div>
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
