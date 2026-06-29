import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import { reportApi, branchApi, agentApi, collectionApi } from '../services/api';

export default function Reports() {
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reportRows, setReportRows] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [agents, setAgents] = useState([]);

  // In-report detail page filters state
  const [detailMonth, setDetailMonth] = useState(() => {
    const month = new Date().getMonth() + 1;
    return String(month).padStart(2, '0');
  });
  const [detailStartDate, setDetailStartDate] = useState('');
  const [detailEndDate, setDetailEndDate] = useState('');
  const [detailStatus, setDetailStatus] = useState('all');
  const [selectedMetricLabel, setSelectedMetricLabel] = useState(null);
  const [todayCollections, setTodayCollections] = useState([]);

  useEffect(() => {
    branchApi.list().then(res => setBranches(res.data || [])).catch(() => {});
    agentApi.list().then(res => setAgents(res.data || [])).catch(() => {});
  }, []);

  const mapReportRows = (rawRows, reportType) => {
    if (!Array.isArray(rawRows)) return [];
    return rawRows.map(row => {
      switch (reportType) {
        case 'col':
          return [
            row.Date || 'N/A',
            row.AccountNo || 'N/A',
            row.CustomerName || 'N/A',
            '₹' + Number(row.AmountCollected || 0).toLocaleString('en-IN'),
            row.AgentName || 'N/A',
            row.PaymentMode || 'N/A'
          ];
        case 'saving':
          return [
            row.MaturityDate || 'N/A',
            row.CustomerName || 'N/A',
            row.AccountNo || 'N/A',
            row.PlanDetails || ('Daily Pragati (' + (row.InterestRate || '6') + '%)'),
            '₹' + Number(row.DepositedAmount || 0).toLocaleString('en-IN'),
            '₹0',
            '₹' + Number(row.DepositedAmount || 0).toLocaleString('en-IN')
          ];
        case 'loan':
          return [
            row.DisbursalDate || 'N/A',
            row.AccountNo || 'N/A',
            row.CustomerName || 'N/A',
            row.LoanPlan || 'Personal Loan',
            '₹' + Number(row.ApprovedAmount || 0).toLocaleString('en-IN'),
            '₹' + Number(row.OutstandingBalance || 0).toLocaleString('en-IN'),
            '₹' + Number(row.PaidPrincipal || 0).toLocaleString('en-IN'),
            '₹0',
            row.Status || 'N/A'
          ];
        case 'agent':
          return [
            row.LogDate || new Date().toISOString().slice(0, 10),
            row.AgentName || 'N/A',
            row.AreaName || 'N/A',
            String(row.AssignedCustomers || 0),
            '₹' + Number((row.ActualCollected || 0) * 1.05).toLocaleString('en-IN'),
            '₹' + Number(row.ActualCollected || 0).toLocaleString('en-IN'),
            row.PerformanceRate || '95%'
          ];
        case 'cashbook':
          return [
            row.Date || 'N/A',
            row.RefNo || 'N/A',
            row.Particulars || row.Category || 'N/A',
            (row.Type || '').toLowerCase() === 'credit' ? 'Credit' : 'Debit',
            (row.Type || '').toLowerCase() === 'debit' ? '₹' + Number(row.Amount || 0).toLocaleString('en-IN') : '-',
            (row.Type || '').toLowerCase() === 'credit' ? '₹' + Number(row.Amount || 0).toLocaleString('en-IN') : '-'
          ];
        case 'maturity':
          return [
            row.MaturityDate || new Date().toISOString().slice(0, 10),
            row.CustomerName || 'N/A',
            row.AccountNo || 'N/A',
            row.PlanName || 'N/A',
            '₹' + Number(row.MaturityValue || 0).toLocaleString('en-IN'),
            row.Status || 'N/A'
          ];
        default:
          return [];
      }
    });
  };

  const getReportMetrics = (reportType, rows) => {
    if (!reportType || !Array.isArray(rows)) return [];
    const parseAmt = (val) => {
      if (typeof val !== 'string') return Number(val || 0);
      return Number(val.replace(/[^\d.]/g, ''));
    };

    switch (reportType) {
      case 'col': {
        const total = rows.reduce((sum, r) => sum + parseAmt(r[3]), 0);
        return [
          { label: "Total Collection", value: "₹" + total.toLocaleString('en-IN'), sub: `From ${rows.length} transactions`, type: "success", filterVal: "all" },
          { label: "Accounts Synced", value: `${rows.length} Accounts`, sub: `Avg ₹${rows.length ? Math.round(total / rows.length).toLocaleString('en-IN') : 0} per Acc`, type: "primary", filterVal: "all" },
          { label: "Cash Collections", value: "₹" + rows.filter(r => r[5] === 'Cash').reduce((sum, r) => sum + parseAmt(r[3]), 0).toLocaleString('en-IN'), sub: "Collected in hand", type: "accent", filterVal: "Cash" }
        ];
      }
      case 'saving': {
        const total = rows.reduce((sum, r) => sum + parseAmt(r[4]), 0);
        return [
          { label: "Total Savings Pool", value: "₹" + total.toLocaleString('en-IN'), sub: "Total customer deposits", type: "success", filterVal: "all" },
          { label: "Active Savings Accs", value: `${rows.length} Accounts`, sub: `Avg ₹${rows.length ? Math.round(total / rows.length).toLocaleString('en-IN') : 0} deposit`, type: "primary", filterVal: "all" },
          { label: "Net Balance", value: "₹" + rows.reduce((sum, r) => sum + parseAmt(r[6]), 0).toLocaleString('en-IN'), sub: "Including interest credit", type: "accent", filterVal: "all" }
        ];
      }
      case 'loan': {
        const disbursed = rows.reduce((sum, r) => sum + parseAmt(r[4]), 0);
        const outstanding = rows.reduce((sum, r) => sum + parseAmt(r[5]), 0);
        return [
          { label: "Total Disbursed Pool", value: "₹" + disbursed.toLocaleString('en-IN'), sub: "Total principal disbursed", type: "primary", filterVal: "all" },
          { label: "Total Outstanding Bal", value: "₹" + outstanding.toLocaleString('en-IN'), sub: "Remaining recovery principal", type: "danger", filterVal: "all" },
          { label: "Active Loan Accounts", value: `${rows.length} Accounts`, sub: `Avg ₹${rows.length ? Math.round(outstanding / rows.length).toLocaleString('en-IN') : 0} outstanding`, type: "warning", filterVal: "active" }
        ];
      }
      case 'agent': {
        const totalCollected = rows.reduce((sum, r) => sum + parseAmt(r[5]), 0);
        return [
          { label: "Active Field Agents", value: `${rows.length} Agents`, sub: "Assigned to various branches", type: "primary", filterVal: "all" },
          { label: "Total Collected", value: "₹" + totalCollected.toLocaleString('en-IN'), sub: "Accumulated agent collection", type: "success", filterVal: "all" },
          { label: "Avg Collection/Agent", value: "₹" + (rows.length ? Math.round(totalCollected / rows.length).toLocaleString('en-IN') : 0), sub: "Performance rate calculated", type: "accent", filterVal: "all" }
        ];
      }
      case 'cashbook': {
        const inflows = rows.filter(r => r[3] === 'Credit').reduce((sum, r) => sum + parseAmt(r[5]), 0);
        const outflows = rows.filter(r => r[4] !== '-').reduce((sum, r) => sum + parseAmt(r[4]), 0);
        return [
          { label: "Opening Cash Bal", value: "₹" + (inflows - outflows).toLocaleString('en-IN'), sub: "Carry forward balance", type: "primary", filterVal: "all" },
          { label: "Total Cash Inflows", value: "₹" + inflows.toLocaleString('en-IN'), sub: "EMI + Savings Deposit", type: "success", filterVal: "Credit" },
          { label: "Total Cash Outflows", value: "₹" + outflows.toLocaleString('en-IN'), sub: "Withdrawals + Disbursal", type: "danger", filterVal: "Debit" }
        ];
      }
      case 'maturity': {
        const totalMaturity = rows.reduce((sum, r) => sum + parseAmt(r[4]), 0);
        return [
          { label: "Maturing Today", value: `${rows.length} Accounts`, sub: `Total ₹${totalMaturity.toLocaleString('en-IN')}`, type: "warning", filterVal: "all" },
          { label: "Maturity Paid", value: "₹" + rows.filter(r => r[5] === 'Completed' || r[5] === 'Loan Completed').reduce((sum, r) => sum + parseAmt(r[4]), 0).toLocaleString('en-IN'), sub: "Completed payouts", type: "success", filterVal: "Completed" },
          { label: "Pending Payout Pool", value: "₹" + rows.filter(r => r[5] === 'Pending Pay Out').reduce((sum, r) => sum + parseAmt(r[4]), 0).toLocaleString('en-IN'), sub: "Payout verification due", type: "accent", filterVal: "Pending Pay Out" }
        ];
      }
      default:
        return [];
    }
  };

  useEffect(() => {
    setReportLoading(true);
    const params = {};
    if (selectedBranch !== 'all') params.branch_id = selectedBranch;
    if (selectedAgent !== 'all') params.agent_id = selectedAgent;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    if (!activeReport) {
      collectionApi.today(params)
        .then(res => {
          const mapped = (res.data || []).map(row => [
            row.date,
            row.account_no,
            row.customer_name,
            '₹' + Number(row.amount || 0).toLocaleString('en-IN'),
            row.collector,
            row.payment_mode
          ]);
          setTodayCollections(mapped);
          setReportLoading(false);
        })
        .catch(() => {
          setTodayCollections([]);
          setReportLoading(false);
        });
      return;
    }

    let apiCall;
    switch (activeReport) {
      case 'col': apiCall = reportApi.dailyCollection(params); break;
      case 'saving': apiCall = reportApi.saving(); break;
      case 'loan': apiCall = reportApi.loan(); break;
      case 'agent': apiCall = reportApi.agentWise(); break;
      case 'cashbook': apiCall = reportApi.cashBook(params); break;
      case 'maturity': apiCall = reportApi.maturity(); break;
      default: apiCall = Promise.resolve({ data: [] });
    }

    apiCall
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.rows || []);
        setReportRows(mapReportRows(raw, activeReport));
        setReportLoading(false);
      })
      .catch(() => {
        setReportRows([]);
        setReportLoading(false);
      });
  }, [activeReport, selectedBranch, selectedAgent, startDate, endDate]);


  // Mock Report Types
  const reportTypes = [
    { id: 'col', name: 'Collection Report', icon: 'payments', desc: 'Daily & monthly collections aggregation' },
    { id: 'saving', name: 'Savings Report', icon: 'savings', desc: 'Active savings account deposit balances' },
    { id: 'loan', name: 'Loan Report', icon: 'credit_score', desc: 'Active loans outstanding balances ledger' },
    { id: 'agent', name: 'Agent Performance', icon: 'support_agent', desc: 'Agent-wise collection data and logs' },
    { id: 'cashbook', name: 'Cash Book Summary', icon: 'menu_book', desc: 'Branch-level cash in/out records' },
    { id: 'maturity', name: 'Maturity Report', icon: 'workspace_premium', desc: 'Listing of maturing savings/loan accounts' }
  ];

  // Mock Reports Datasets
  const reportsData = {
    col: {
      title: 'Collection Report',
      desc: 'Real-time daily collection ledger and synced logs',
      metrics: [
        { label: "Today's Collection", value: "₹2,45,800", sub: "Target ₹3,00,000", type: "success", filterVal: "all" },
        { label: "Accounts Synced", value: "32 Accounts", sub: "Avg ₹7,680 per Acc", type: "primary", filterVal: "all" },
        { label: "Defaulters Resolved", value: "12 Accounts", sub: "92% Efficiency", type: "accent", filterVal: "all" }
      ],
      statusLabel: 'Payment Mode',
      statusOptions: [
        { value: 'all', label: 'All Modes' },
        { value: 'Cash', label: 'Cash Only' },
        { value: 'UPI', label: 'UPI Only' },
        { value: 'Bank Transfer', label: 'Bank Transfer Only' }
      ],
      columns: ['Date', 'Account No', 'Customer Name', 'Amount Collected', 'Agent Name', 'Payment Mode'],
      rows: [
        ['28-06-2026', 'LN-9082', 'Rajesh Kumar', '₹12,450', 'Rahul Singh', 'Cash'],
        ['28-06-2026', 'SV-4109', 'Sunita Sharma', '₹2,500', 'Amit Verma', 'UPI'],
        ['28-06-2026', 'LN-8830', 'Ramesh Chandra', '₹4,512', 'Rahul Singh', 'Cash'],
        ['28-06-2026', 'SV-1049', 'Preeti Patel', '₹100', 'Vikas Kumar', 'Cash'],
        ['27-06-2026', 'LN-4102', 'Amit Verma', '₹2,000', 'Amit Verma', 'Bank Transfer'],
        ['15-05-2026', 'LN-8722', 'Sumit Kumar', '₹15,000', 'Rahul Singh', 'Cash'],
        ['10-04-2026', 'SV-2091', 'Geeta Devi', '₹1,500', 'Vikas Kumar', 'UPI']
      ]
    },
    agent: {
      title: 'Agent Performance Logs',
      desc: 'Agent-wise field performance and collection aggregates',
      metrics: [
        { label: "Active Field Agents", value: "4 Agents", sub: "100% attendance today", type: "primary", filterVal: "all" },
        { label: "Top Collector", value: "Rahul Singh", sub: "₹1,42,800 collected", type: "success", filterVal: "all" },
        { label: "Avg Collection/Agent", value: "₹1,30,900", sub: "91% target hit", type: "accent", filterVal: "all" }
      ],
      statusLabel: 'Performance Tier',
      statusOptions: [
        { value: 'all', label: 'All Performance' },
        { value: 'high', label: 'Above 90% (High)' },
        { value: 'low', label: 'Below 90% (Low)' }
      ],
      columns: ['Log Date', 'Agent Name', 'Branch Area', 'Total Accounts', 'Target Collection', 'Actual Collected', 'Performance Rate'],
      rows: [
        ['28-06-2026', 'Rahul Singh', 'Hazratganj, Lucknow', '45', '₹1,50,000', '₹1,42,800', '95.2%'],
        ['28-06-2026', 'Amit Verma', 'Gomti Nagar, Lucknow', '38', '₹1,20,000', '₹1,02,500', '85.4%'],
        ['27-06-2026', 'Vikas Kumar', 'Alambagh, Lucknow', '30', '₹1,00,000', '₹92,400', '92.4%'],
        ['15-05-2026', 'Sandeep Kumar', 'Kalyanpur, Kanpur', '50', '₹2,00,000', '₹1,85,900', '92.9%']
      ]
    },
    loan: {
      title: 'Loan Account Balances & Ledger',
      desc: 'Listing active loans, disbursals, repayment logs, and outstanding balances',
      metrics: [
        { label: "Total Disbursed Pool", value: "₹5,80,000", sub: "Total principal disbursed", type: "primary", filterVal: "all" },
        { label: "Total Outstanding Bal", value: "₹2,09,600", sub: "Remaining recovery principal", type: "danger", filterVal: "all" },
        { label: "Active Loan Accounts", value: "48 Accounts", sub: "Avg ₹4,360 outstanding", type: "warning", filterVal: "active" }
      ],
      statusLabel: 'Loan Status',
      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'active', label: 'Active (On Time)' },
        { value: 'defaulter', label: 'Overdue (Defaulters)' }
      ],
      columns: ['Disbursal Date', 'Account No', 'Customer Name', 'Loan Plan', 'Disbursed Amount', 'Outstanding Principal', 'Interest Collected', 'Interest Overdue', 'Status'],
      rows: [
        ['28-06-2026', 'LN-9082', 'Rajesh Kumar', 'Personal Loan (12%)', '₹50,000', '₹15,000', '₹4,200', '₹0', 'Active (On Time)'],
        ['28-06-2026', 'LN-8830', 'Ramesh Chandra', 'Business Loan (15%)', '₹1,20,000', '₹80,000', '₹8,500', '₹1,500', 'Overdue (15 Days)'],
        ['27-06-2026', 'LN-4102', 'Amit Verma', 'Agri Loan (10%)', '₹80,000', '₹50,000', '₹6,800', '₹0', 'Active (On Time)'],
        ['15-05-2026', 'LN-8722', 'Sumit Kumar', 'Personal Loan (12%)', '₹30,000', '₹5,000', '₹2,600', '₹0', 'Active (On Time)'],
        ['10-04-2026', 'LN-2918', 'Sanjay Dutt', 'Business Loan (15%)', '₹3,00,000', '₹59,600', '₹12,700', '₹15,400', 'Defaulter (NPA)']
      ]
    },
    saving: {
      title: 'Savings Account Balance Ledger',
      desc: 'Listing savings accounts balances and interest metrics',
      metrics: [
        { label: "Total Savings Pool", value: "₹2,31,035", sub: "Total customer deposits", type: "success", filterVal: "all" },
        { label: "Active Savings Accs", value: "115 Accounts", sub: "Avg ₹2,008 deposit", type: "primary", filterVal: "all" },
        { label: "Net Interest Paid", value: "₹6,685", sub: "6% flat yearly rate", type: "accent", filterVal: "all" }
      ],
      statusLabel: 'Plan Type',
      statusOptions: [
        { value: 'all', label: 'All Plans' },
        { value: 'Daily Pragati', label: 'Daily Pragati Plan' },
        { value: 'Monthly Suraksha', label: 'Monthly Suraksha Plan' }
      ],
      columns: ['Last Deposit Date', 'Customer Name', 'Account No', 'Plan Details', 'Total Deposit', 'Interest Paid', 'Net Balance'],
      rows: [
        ['28-06-2026', 'Amit Kumar', 'SV-4109', 'Daily Pragati (6%)', '₹12,500', '₹375', '₹12,875'],
        ['28-06-2026', 'Sunita Sharma', 'SV-1049', 'Daily Pragati (6%)', '₹25,000', '₹750', '₹25,750'],
        ['27-06-2026', 'Preeti Patel', 'SV-2091', 'Monthly Suraksha (8%)', '₹8,000', '₹160', '₹8,160'],
        ['12-05-2026', 'Vikas Kumar', 'SV-9081', 'Daily Pragati (6%)', '₹1,80,000', '₹5,400', '₹1,85,400']
      ]
    },
    cashbook: {
      title: 'Cash Book Summary Ledger',
      desc: 'Cash book transactions logging opening/closing balances',
      metrics: [
        { label: "Opening Cash Bal", value: "₹3,98,050", sub: "Carry forward balance", type: "primary", filterVal: "all" },
        { label: "Total Cash Inflows", value: "₹1,14,950", sub: "EMI + Savings Deposit", type: "success", filterVal: "Credit" },
        { label: "Total Cash Outflows", value: "₹20,000", sub: "Withdrawals + Disbursal", type: "danger", filterVal: "Debit" }
      ],
      statusLabel: 'Transaction Type',
      statusOptions: [
        { value: 'all', label: 'All Ledger Types' },
        { value: 'Credit', label: 'Credit Only' },
        { value: 'Debit', label: 'Debit Only' }
      ],
      columns: ['Transaction Date', 'Txn Ref ID', 'Particulars/Account', 'Ledger Type', 'Debit Amount', 'Credit Amount'],
      rows: [
        ['28-06-2026', 'TXN-9028', 'Owner Capital Injection', 'Credit', '-', '₹1,00,000'],
        ['28-06-2026', 'TXN-9029', 'Agent Collection In-flow', 'Credit', '-', '₹12,450'],
        ['28-06-2026', 'TXN-9030', 'Savings Deposit Sync', 'Credit', '-', '₹2,500'],
        ['27-06-2026', 'TXN-8822', 'New Loan Disbursal (LN-8722)', 'Debit', '₹15,000', '-'],
        ['27-06-2026', 'TXN-8823', 'Savings Cash Payout (SV-1049)', 'Debit', '₹5,000', '-']
      ]
    },
    maturity: {
      title: 'Maturity & Payout Logs',
      desc: 'Maturity schedules for savings and payouts tracking',
      metrics: [
        { label: "Maturing Today", value: "2 Accounts", sub: "Total ₹1,91,200", type: "warning", filterVal: "all" },
        { label: "Maturity Paid", value: "₹11,200", sub: "Durga Shakti plan paid", type: "success", filterVal: "Completed" },
        { label: "Pending Payout Pool", value: "₹1,80,000", sub: "Payout verification due", type: "accent", filterVal: "Pending Pay Out" }
      ],
      statusLabel: 'Payout Status',
      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'Pending Pay Out', label: 'Pending Payouts' },
        { value: 'Completed', label: 'Completed Payouts' }
      ],
      columns: ['Maturity Date', 'Customer Name', 'Account No', 'Plan Subscribed', 'Maturity Amount', 'Payout Status'],
      rows: [
        ['28-06-2026', 'Vikas Kumar', 'SV-9081', 'Daily Pragati (6%)', '₹1,80,000', 'Pending Pay Out'],
        ['28-06-2026', 'Anil Mishra', 'LN-9082', 'Durga Shakti (12%)', '₹11,200', 'Loan Completed'],
        ['30-06-2026', 'Rakesh Pandey', 'SV-1049', 'Daily Pragati (6%)', '₹26,000', 'Pending Pay Out'],
        ['05-07-2026', 'Seema Devi', 'SV-2091', 'Monthly Suraksha (8%)', '₹10,500', 'Active Account']
      ]
    }
  };

  const handleExport = (format) => {
    alert(`Exporting report in ${format} format...`);
  };

  const activeReportDetails = activeReport ? reportsData[activeReport] : null;

  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  };

  const getFilteredRows = (rows) => {
    let filtered = rows;

    if (detailMonth !== 'all') {
      filtered = filtered.filter(row => {
        const parts = row[0].split('-');
        return parts.length === 3 && parts[1] === detailMonth;
      });
    }

    if (detailStartDate || detailEndDate) {
      filtered = filtered.filter(row => {
        const rowDate = parseDateString(row[0]);
        if (!rowDate) return true;

        if (detailStartDate) {
          const start = new Date(detailStartDate);
          start.setHours(0, 0, 0, 0);
          if (rowDate < start) return false;
        }

        if (detailEndDate) {
          const end = new Date(detailEndDate);
          end.setHours(23, 59, 59, 999);
          if (rowDate > end) return false;
        }

        return true;
      });
    }

    if (detailStatus !== 'all') {
      if (activeReport === 'loan') {
        filtered = filtered.filter(row => {
          const rowStatus = row[8] || row[7] || '';
          if (detailStatus === 'active') {
            return rowStatus.includes('Active');
          } else if (detailStatus === 'defaulter') {
            return rowStatus.includes('Overdue') || rowStatus.includes('Defaulter');
          }
          return true;
        });
      } else if (activeReport === 'col') {
        filtered = filtered.filter(row => row[5] === detailStatus);
      } else if (activeReport === 'agent') {
        filtered = filtered.filter(row => {
          const rateVal = parseFloat((row[6] || '').replace('%', ''));
          if (detailStatus === 'high') return rateVal >= 90;
          if (detailStatus === 'low') return rateVal < 90;
          return true;
        });
      } else if (activeReport === 'saving') {
        filtered = filtered.filter(row => (row[3] || '').includes(detailStatus));
      } else if (activeReport === 'cashbook') {
        filtered = filtered.filter(row => row[3] === detailStatus);
      } else if (activeReport === 'maturity') {
        filtered = filtered.filter(row => {
          if (detailStatus === 'Pending Pay Out') return row[5] === 'Pending Pay Out';
          if (detailStatus === 'Completed') return row[5] === 'Loan Completed' || row[5] === 'Active Account';
          return true;
        });
      }
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(row =>
        row.some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    return filtered;
  };

  const getFilteredTodayRows = () => {
    let rows = reportsData.col.rows.filter(row => row[0] === '28-06-2026');
    if (selectedAgent !== 'all') {
      const agentMap = { ag1: 'Rahul Singh', ag2: 'Amit Verma' };
      const agentName = agentMap[selectedAgent];
      if (agentName) {
        rows = rows.filter(row => row[4] === agentName);
      }
    }
    if (selectedBranch !== 'all') {
      if (selectedBranch === 'b1') {
        rows = rows.filter(row => ['Rahul Singh', 'Amit Verma', 'Vikas Kumar'].includes(row[4]));
      } else if (selectedBranch === 'b2') {
        rows = rows.filter(row => row[4] === 'Sandeep Kumar');
      }
    }
    return rows;
  };

  const handleMetricCardClick = (label, filterVal) => {
    if (!filterVal) return;
    if (selectedMetricLabel === label) {
      setSelectedMetricLabel(null);
      setDetailStatus('all');
    } else {
      setSelectedMetricLabel(label);
      setDetailStatus(filterVal);
    }
  };

  const handleSelectReport = (reportId) => {
    setActiveReport(reportId);
    setSearchQuery('');
    const curMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    setDetailMonth(curMonth);
    setDetailStartDate('');
    setDetailEndDate('');
    setDetailStatus('all');
    setSelectedMetricLabel(null);
  };

  return (
    <div className="space-y-6">
      {!activeReport && (
        <>
          <section className="bg-surface p-5 rounded-2xl border border-border-fin shadow-sm sticky top-0 z-10 space-y-4">
            <h3 className="text-xs font-bold text-primary-text uppercase tracking-wider">Advanced Filters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Select
                label="Select Branch"
                options={[
                  { value: 'all', label: 'All Branches' },
                  ...branches.map(b => ({ value: String(b.id), label: b.name }))
                ]}
                value={selectedBranch}
                onChange={(val) => setSelectedBranch(val)}
              />
              <Select
                label="Collection Agent"
                options={[
                  { value: 'all', label: 'All Agents' },
                  ...agents.map(a => ({ value: String(a.id), label: a.name }))
                ]}
                value={selectedAgent}
                onChange={(val) => setSelectedAgent(val)}
              />

              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(val) => setStartDate(val)}
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(val) => setEndDate(val)}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportTypes.map((rep) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => handleSelectReport(rep.id)}
                className="bg-surface p-5 rounded-2xl border border-border-fin shadow-sm hover:shadow-md transition-all flex items-start gap-4 hover:border-primary/20 w-full text-left cursor-pointer active:scale-[0.98] group"
              >
                <div className="p-3 rounded-xl bg-primary/5 text-primary">
                  <span className="material-symbols-rounded text-xl select-none">{rep.icon}</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-primary-text">{rep.name}</h4>
                  <p className="text-[10px] text-secondary-text leading-relaxed font-semibold">{rep.desc}</p>
                  <span className="text-[10px] text-primary font-bold block pt-2 group-hover:underline">
                    Open Report →
                  </span>
                </div>
              </button>
            ))}
          </section>

          <section className="bg-surface p-6 rounded-2xl border border-border-fin shadow-sm overflow-hidden space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-bold text-primary-text">Today's Collection Ledger Preview</h3>
                <p className="text-xs text-secondary-text font-bold">Summary list for current date (28-06-2026)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('PDF')}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-border-fin hover:bg-background-fin text-secondary-text rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98]"
                >
                  <span className="material-symbols-rounded text-sm select-none">picture_as_pdf</span>
                  PDF
                </button>
                <button
                  onClick={() => handleExport('Excel')}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-border-fin hover:bg-background-fin text-secondary-text rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98]"
                >
                  <span className="material-symbols-rounded text-sm select-none">table_chart</span>
                  Excel
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <span className="material-symbols-rounded text-sm select-none">print</span>
                  Print
                </button>
              </div>
            </div>

            <div className="overflow-x-auto -mx-6">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-border-fin">
                  <thead className="bg-background-fin">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-[11px] font-extrabold text-secondary-text uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-[11px] font-extrabold text-secondary-text uppercase tracking-wider">Account No</th>
                      <th scope="col" className="px-6 py-3 text-left text-[11px] font-extrabold text-secondary-text uppercase tracking-wider">Customer Name</th>
                      <th scope="col" className="px-6 py-3 text-left text-[11px] font-extrabold text-secondary-text uppercase tracking-wider">Amount Collected</th>
                      <th scope="col" className="px-6 py-3 text-left text-[11px] font-extrabold text-secondary-text uppercase tracking-wider">Agent Name</th>
                      <th scope="col" className="px-6 py-3 text-left text-[11px] font-extrabold text-secondary-text uppercase tracking-wider">Payment Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-fin bg-surface text-xs font-bold text-primary-text">
                    {todayCollections.length > 0 ? (
                      todayCollections.map((row, idx) => (
                        <tr key={idx} className="hover:bg-background-fin/50 transition-colors">
                          <td className="whitespace-nowrap px-6 py-3.5 text-secondary-text font-medium">{row[0]}</td>
                          <td className="whitespace-nowrap px-6 py-3.5">
                            <Link to={`/account/${row[1]}`} className="text-primary font-black hover:underline">
                              {row[1]}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5">{row[2]}</td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-success-fin font-black">{row[3]}</td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-secondary-text font-medium">{row[4]}</td>
                          <td className="whitespace-nowrap px-6 py-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[9px] bg-primary/10 text-primary">
                              {row[5]}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-xs text-secondary-text font-bold">
                          No transactions found for the selected filters today.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      {activeReport && activeReportDetails && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface p-5 rounded-2xl border border-border-fin shadow-sm gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setActiveReport(null);
                  setSearchQuery('');
                }}
                className="flex items-center justify-center w-10 h-10 border border-border-fin rounded-xl hover:bg-background-fin text-secondary-text hover:text-primary-text cursor-pointer active:scale-[0.95]"
              >
                <span className="material-symbols-rounded select-none text-base">arrow_back</span>
              </button>
              <div>
                <h2 className="text-lg font-black text-primary-text leading-none">{activeReportDetails.title}</h2>
                <p className="text-xs text-secondary-text font-semibold mt-1">{activeReportDetails.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleExport('PDF')}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-border-fin hover:bg-background-fin text-secondary-text rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] flex-1 sm:flex-initial"
              >
                <span className="material-symbols-rounded text-sm select-none">picture_as_pdf</span>
                PDF
              </button>
              <button
                onClick={() => handleExport('Excel')}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-border-fin hover:bg-background-fin text-secondary-text rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] flex-1 sm:flex-initial"
              >
                <span className="material-symbols-rounded text-sm select-none">table_chart</span>
                Excel
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-surface rounded-xl text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer active:scale-[0.98] flex-1 sm:flex-initial"
              >
                <span className="material-symbols-rounded text-sm select-none">print</span>
                Print
              </button>
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {getReportMetrics(activeReport, reportRows).map((met, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleMetricCardClick(met.label, met.filterVal)}
                className={`text-left bg-surface border rounded-2xl p-5 shadow-sm space-y-3 transition-all cursor-pointer active:scale-[0.98] ${
                  selectedMetricLabel === met.label
                    ? 'ring-2 ring-primary border-primary bg-primary/[0.01]'
                    : 'border-border-fin hover:border-primary/30'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-secondary-text uppercase tracking-wide">
                    {met.label}
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    met.type === 'success' ? 'bg-success-fin' :
                    met.type === 'danger' ? 'bg-danger-fin' :
                    met.type === 'warning' ? 'bg-warning-fin' :
                    met.type === 'accent' ? 'bg-accent' : 'bg-primary'
                  }`}></span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-primary-text tracking-tight">
                    {met.value}
                  </h3>
                  <span className="text-xs font-bold text-secondary-text block">
                    {met.sub}
                  </span>
                </div>
              </button>
            ))}
          </section>

          {activeReport === 'loan' && (
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-primary-text uppercase tracking-wider pl-1">Interest Analysis</h4>
              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                  type="button"
                  onClick={() => handleMetricCardClick('Interest Collected', 'active')}
                  className={`text-left bg-surface border rounded-2xl p-5 shadow-sm space-y-3 transition-all cursor-pointer active:scale-[0.98] ${
                    selectedMetricLabel === 'Interest Collected'
                      ? 'ring-2 ring-primary border-primary bg-primary/[0.01]'
                      : 'border-border-fin hover:border-primary/30'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-secondary-text uppercase tracking-wide">Interest Collected</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-success-fin"></span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-success-fin tracking-tight">₹34,800</h3>
                    <span className="text-xs font-bold text-secondary-text block">Total interest earned & recovered</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleMetricCardClick('Interest Pending', 'defaulter')}
                  className={`text-left bg-surface border rounded-2xl p-5 shadow-sm space-y-3 transition-all cursor-pointer active:scale-[0.98] ${
                    selectedMetricLabel === 'Interest Pending'
                      ? 'ring-2 ring-primary border-primary bg-primary/[0.01]'
                      : 'border-border-fin hover:border-primary/30'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-secondary-text uppercase tracking-wide">Interest Pending</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-warning-fin"></span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-warning-fin tracking-tight">₹1,500</h3>
                    <span className="text-xs font-bold text-secondary-text block">Overdue from active accounts</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleMetricCardClick('Interest Loss', 'defaulter')}
                  className={`text-left bg-surface border rounded-2xl p-5 shadow-sm space-y-3 transition-all cursor-pointer active:scale-[0.98] ${
                    selectedMetricLabel === 'Interest Loss'
                      ? 'ring-2 ring-primary border-primary bg-primary/[0.01]'
                      : 'border-border-fin hover:border-primary/30'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-secondary-text uppercase tracking-wide">Interest Loss (NPA Defaulters)</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-danger-fin"></span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-danger-fin tracking-tight">₹15,400</h3>
                    <span className="text-xs font-bold text-secondary-text block">Blocked in high-risk default accounts</span>
                  </div>
                </button>
              </section>
            </div>
          )}

          <section className="bg-surface p-6 rounded-2xl border border-border-fin shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-primary-text">Detailed Report Logs</h3>
                <p className="text-xs text-secondary-text font-bold">Total {getFilteredRows(reportRows).length} records found</p>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary-text select-none">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background-fin border border-border-fin rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 p-4 bg-background-fin/50 rounded-2xl border border-border-fin">
              <Select
                label="Filter by Month"
                options={[
                  { value: 'all', label: 'All Months' },
                  { value: '01', label: 'January' },
                  { value: '02', label: 'February' },
                  { value: '03', label: 'March' },
                  { value: '04', label: 'April' },
                  { value: '05', label: 'May' },
                  { value: '06', label: 'June' },
                  { value: '07', label: 'July' },
                  { value: '08', label: 'August' },
                  { value: '09', label: 'September' },
                  { value: '10', label: 'October' },
                  { value: '11', label: 'November' },
                  { value: '12', label: 'December' }
                ]}
                value={detailMonth}
                onChange={(val) => setDetailMonth(val)}
              />
              <Select
                label={activeReportDetails.statusLabel || "Filter by Status"}
                options={activeReportDetails.statusOptions || [{ value: 'all', label: 'All' }]}
                value={detailStatus}
                onChange={(val) => {
                  setDetailStatus(val);
                  setSelectedMetricLabel(null);
                }}
              />
              <DatePicker
                label="Start Date"
                value={detailStartDate}
                onChange={(val) => setDetailStartDate(val)}
              />
              <DatePicker
                label="End Date"
                value={detailEndDate}
                onChange={(val) => setDetailEndDate(val)}
              />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    const curMonth = String(new Date().getMonth() + 1).padStart(2, '0');
                    setDetailMonth(curMonth);
                    setDetailStartDate('');
                    setDetailEndDate('');
                    setDetailStatus('all');
                    setSelectedMetricLabel(null);
                    setSearchQuery('');
                  }}
                  className="w-full h-[38px] border border-border-fin hover:bg-background-fin text-secondary-text hover:text-primary-text rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5 bg-surface"
                >
                  <span className="material-symbols-rounded text-sm select-none">filter_list_off</span>
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="overflow-x-auto -mx-6">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-border-fin">
                  <thead className="bg-background-fin">
                    <tr>
                      {activeReportDetails.columns.map((col, idx) => (
                        <th
                          key={idx}
                          scope="col"
                          className="px-6 py-3 text-left text-[11px] font-extrabold text-secondary-text uppercase tracking-wider"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-fin bg-surface text-xs font-bold text-primary-text">
                    {getFilteredRows(reportRows).length > 0 ? (
                      getFilteredRows(reportRows).map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-background-fin/50 transition-colors">
                          {row.map((val, colIdx) => {
                            const colHeader = activeReportDetails.columns[colIdx];
                            const isDebitAmt = colHeader === 'Debit Amount' && val !== '-';
                            const isCreditAmt = colHeader === 'Credit Amount' && val !== '-';
                            return (
                              <td key={colIdx} className="whitespace-nowrap px-6 py-3.5">
                                {isDebitAmt ? (
                                  <span className="text-danger-fin font-black">{val}</span>
                                ) : isCreditAmt ? (
                                  <span className="text-success-fin font-black">{val}</span>
                                ) : val === 'High Risk (NPA)' || val === 'Debit' || val === 'Defaulter' || (typeof val === 'string' && (val.includes('Defaulter') || val.includes('Overdue'))) ? (
                                  <span className="text-danger-fin font-black">{val}</span>
                                ) : val === 'Credit' || val === 'Paid' || val === 'Completed' || val === 'Loan Completed' || (typeof val === 'string' && val.includes('Active')) ? (
                                  <span className="text-success-fin font-black">{val}</span>
                                ) : val === 'Pending Pay Out' || val === 'Medium Risk' || val === 'Warning' ? (
                                  <span className="text-warning-fin font-black">{val}</span>
                                ) : (typeof val === 'string' && (val.startsWith('LN-') || val.startsWith('SV-') || val.startsWith('UF-LN-') || val.startsWith('UF-SV-'))) ? (
                                  <Link to={`/account/${val}`} className="text-primary font-black hover:underline">
                                    {val}
                                  </Link>
                                ) : (
                                  val
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={activeReportDetails.columns.length} className="px-6 py-10 text-center text-xs text-secondary-text font-bold">
                          No matching records found. Try adjusting filters or search query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
