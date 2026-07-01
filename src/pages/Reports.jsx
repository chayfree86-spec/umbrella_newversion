import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import { reportApi, branchApi, agentApi, collectionApi } from '../services/api';
import { Pagination } from '../components/ui/Pagination';

const inr = (val) => Number(val || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const [todayPage, setTodayPage] = useState(1);
  const [detailPage, setDetailPage] = useState(1);

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
    setTodayPage(1);
  }, [selectedBranch, selectedAgent, startDate, endDate]);

  useEffect(() => {
    setDetailPage(1);
  }, [activeReport, detailMonth, detailStartDate, detailEndDate, detailStatus, searchQuery]);

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
            inr(row.AmountCollected),
            row.AgentName || 'N/A',
            row.PaymentMode || 'N/A'
          ];
        case 'saving':
          return [
            row.LastDepositDate || 'N/A',
            row.CustomerName || 'N/A',
            row.AccountNo || 'N/A',
            row.PlanDetails || (row.PlanName ? `${row.PlanName} (${row.InterestRate || 0}%)` : 'N/A'),
            inr(row.DepositedAmount),
            inr(row.InterestPaid),
            inr(row.NetBalance || row.DepositedAmount)
          ];
        case 'loan':
          return [
            row.DisbursalDate || 'N/A',
            row.AccountNo || 'N/A',
            row.CustomerName || 'N/A',
            row.LoanPlan || 'N/A',
            inr(row.ApprovedAmount),
            inr(row.OutstandingBalance),
            inr(row.InterestCollected),
            inr(row.InterestOverdue),
            row.Status || 'N/A'
          ];
        case 'agent':
          return [
            row.LogDate || new Date().toISOString().slice(0, 10),
            row.AgentName || 'N/A',
            row.AreaName || 'N/A',
            String(row.AssignedCustomers || 0),
            inr(row.TargetCollection),
            inr(row.ActualCollected),
            row.PerformanceRate || '0%'
          ];
        case 'cashbook':
          return [
            row.Date || 'N/A',
            row.RefNo || 'N/A',
            row.Particulars || row.Category || 'N/A',
            (row.Type || '').toLowerCase() === 'credit' ? 'Credit' : 'Debit',
            (row.Type || '').toLowerCase() === 'debit' ? inr(row.Amount) : '-',
            (row.Type || '').toLowerCase() === 'credit' ? inr(row.Amount) : '-'
          ];
        case 'maturity':
          return [
            row.MaturityDate || new Date().toISOString().slice(0, 10),
            row.CustomerName || 'N/A',
            row.AccountNo || 'N/A',
            row.PlanName || 'N/A',
            inr(row.MaturityValue),
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
          { label: "Total Collection", value: inr(total), sub: `From ${rows.length} transactions`, type: "success", filterVal: "all" },
          { label: "Accounts Synced", value: `${rows.length} Accounts`, sub: `Avg ${rows.length ? inr(Math.round(total / rows.length)) : inr(0)} per Acc`, type: "primary", filterVal: "all" },
          { label: "Cash Collections", value: inr(rows.filter(r => r[5] === 'Cash').reduce((sum, r) => sum + parseAmt(r[3]), 0)), sub: "Collected in hand", type: "accent", filterVal: "Cash" }
        ];
      }
      case 'saving': {
        const total = rows.reduce((sum, r) => sum + parseAmt(r[4]), 0);
        return [
          { label: "Total Savings Pool", value: inr(total), sub: "Total customer deposits", type: "success", filterVal: "all" },
          { label: "Active Savings Accs", value: `${rows.length} Accounts`, sub: `Avg ${rows.length ? inr(Math.round(total / rows.length)) : inr(0)} deposit`, type: "primary", filterVal: "all" },
          { label: "Net Balance", value: inr(rows.reduce((sum, r) => sum + parseAmt(r[6]), 0)), sub: "Including interest credit", type: "accent", filterVal: "all" }
        ];
      }
      case 'loan': {
        const disbursed = rows.reduce((sum, r) => sum + parseAmt(r[4]), 0);
        const outstanding = rows.reduce((sum, r) => sum + parseAmt(r[5]), 0);
        return [
          { label: "Total Disbursed Pool", value: inr(disbursed), sub: "Total principal disbursed", type: "primary", filterVal: "all" },
          { label: "Total Outstanding Bal", value: inr(outstanding), sub: "Remaining recovery principal", type: "danger", filterVal: "all" },
          { label: "Active Loan Accounts", value: `${rows.length} Accounts`, sub: `Avg ${rows.length ? inr(Math.round(outstanding / rows.length)) : inr(0)} outstanding`, type: "warning", filterVal: "active" }
        ];
      }
      case 'agent': {
        const totalCollected = rows.reduce((sum, r) => sum + parseAmt(r[5]), 0);
        return [
          { label: "Active Field Agents", value: `${rows.length} Agents`, sub: "Assigned to various branches", type: "primary", filterVal: "all" },
          { label: "Total Collected", value: inr(totalCollected), sub: "Accumulated agent collection", type: "success", filterVal: "all" },
          { label: "Avg Collection/Agent", value: rows.length ? inr(Math.round(totalCollected / rows.length)) : inr(0), sub: "Performance rate calculated", type: "accent", filterVal: "all" }
        ];
      }
      case 'cashbook': {
        const inflows = rows.filter(r => r[3] === 'Credit').reduce((sum, r) => sum + parseAmt(r[5]), 0);
        const outflows = rows.filter(r => r[4] !== '-').reduce((sum, r) => sum + parseAmt(r[4]), 0);
        return [
          { label: "Opening Cash Bal", value: inr(inflows - outflows), sub: "Carry forward balance", type: "primary", filterVal: "all" },
          { label: "Total Cash Inflows", value: inr(inflows), sub: "EMI + Savings Deposit", type: "success", filterVal: "Credit" },
          { label: "Total Cash Outflows", value: inr(outflows), sub: "Withdrawals + Disbursal", type: "danger", filterVal: "Debit" }
        ];
      }
      case 'maturity': {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const maturingTodayRows = rows.filter(r => r[0] === todayStr && r[5] !== 'Processing' && r[5] !== 'Rejected');
        const totalMaturityToday = maturingTodayRows.reduce((sum, r) => sum + parseAmt(r[4]), 0);
        
        const completedMaturity = rows.filter(r => r[5] === 'Completed' || r[5] === 'Closed');
        const totalCompleted = completedMaturity.reduce((sum, r) => sum + parseAmt(r[4]), 0);
        
        const pendingPayout = rows.filter(r => r[5] === 'Pending Pay Out');
        const totalPending = pendingPayout.reduce((sum, r) => sum + parseAmt(r[4]), 0);

        return [
          { label: "Maturing Today", value: `${maturingTodayRows.length} Accounts`, sub: `Total ${inr(totalMaturityToday)}`, type: "warning", filterVal: "all" },
          { label: "Maturity Paid", value: inr(totalCompleted), sub: `${completedMaturity.length} Completed payouts`, type: "success", filterVal: "Completed" },
          { label: "Pending Payout Pool", value: inr(totalPending), sub: `${pendingPayout.length} Payouts pending`, type: "accent", filterVal: "Pending Pay Out" }
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
      case 'saving': apiCall = reportApi.saving(params); break;
      case 'loan': apiCall = reportApi.loan(params); break;
      case 'agent': apiCall = reportApi.agentWise(); break;
      case 'cashbook': apiCall = reportApi.cashBook(params); break;
      case 'maturity': apiCall = reportApi.maturity(params); break;
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

  // Report metadata only (rows + metrics come live from backend via reportRows / getReportMetrics)
  const reportsData = {
    col: {
      title: 'Collection Report',
      desc: 'Real-time daily collection ledger and synced logs',
      statusLabel: 'Payment Mode',
      statusOptions: [
        { value: 'all', label: 'All Modes' },
        { value: 'Cash', label: 'Cash Only' },
        { value: 'UPI', label: 'UPI Only' },
        { value: 'Bank Transfer', label: 'Bank Transfer Only' }
      ],
      columns: ['Date', 'Account No', 'Customer Name', 'Amount Collected', 'Agent Name', 'Payment Mode']
    },
    agent: {
      title: 'Agent Performance Logs',
      desc: 'Agent-wise field performance and collection aggregates',
      statusLabel: 'Performance Tier',
      statusOptions: [
        { value: 'all', label: 'All Performance' },
        { value: 'high', label: 'Above 90% (High)' },
        { value: 'low', label: 'Below 90% (Low)' }
      ],
      columns: ['Log Date', 'Agent Name', 'Branch Area', 'Total Accounts', 'Target Collection', 'Actual Collected', 'Performance Rate']
    },
    loan: {
      title: 'Loan Account Balances & Ledger',
      desc: 'Listing active loans, disbursals, repayment logs, and outstanding balances',
      statusLabel: 'Loan Status',
      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'active', label: 'Active (On Time)' },
        { value: 'defaulter', label: 'Overdue (Defaulters)' }
      ],
      columns: ['Disbursal Date', 'Account No', 'Customer Name', 'Loan Plan', 'Disbursed Amount', 'Outstanding Principal', 'Interest Collected', 'Interest Overdue', 'Status']
    },
    saving: {
      title: 'Savings Account Balance Ledger',
      desc: 'Listing savings accounts balances and interest metrics',
      statusLabel: 'Plan Type',
      statusOptions: [
        { value: 'all', label: 'All Plans' }
      ],
      columns: ['Last Deposit Date', 'Customer Name', 'Account No', 'Plan Details', 'Total Deposit', 'Interest Paid', 'Net Balance']
    },
    cashbook: {
      title: 'Cash Book Summary Ledger',
      desc: 'Cash book transactions logging opening/closing balances',
      statusLabel: 'Transaction Type',
      statusOptions: [
        { value: 'all', label: 'All Ledger Types' },
        { value: 'Credit', label: 'Credit Only' },
        { value: 'Debit', label: 'Debit Only' }
      ],
      columns: ['Transaction Date', 'Txn Ref ID', 'Particulars/Account', 'Ledger Type', 'Debit Amount', 'Credit Amount']
    },
    maturity: {
      title: 'Maturity & Payout Logs',
      desc: 'Maturity schedules for savings and payouts tracking',
      statusLabel: 'Payout Status',
      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'Pending Pay Out', label: 'Pending Payouts' },
        { value: 'Completed', label: 'Completed Payouts' }
      ],
      columns: ['Maturity Date', 'Customer Name', 'Account No', 'Plan Subscribed', 'Maturity Amount', 'Payout Status']
    }
  };

  const handleExport = (format) => {
    let headers = [];
    let rows = [];
    let reportTitle = '';
    let reportDesc = '';

    if (!activeReport) {
      reportTitle = "Today's Collection Ledger Preview";
      reportDesc = `Summary list of collections for ${new Date().toLocaleDateString('en-IN')}`;
      headers = ['Date', 'Account No', 'Customer Name', 'Amount Collected', 'Agent Name', 'Payment Mode'];
      rows = [...todayCollections].sort((a, b) => b[1].localeCompare(a[1]));
    } else {
      reportTitle = activeReportDetails.title;
      reportDesc = activeReportDetails.desc;
      headers = activeReportDetails.columns;
      rows = getFilteredRows(reportRows);
    }

    if (format === 'Excel') {
      let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\r\n';
      rows.forEach(row => {
        const line = row.map(cell => {
          const val = String(cell || '').replace(/₹/g, '').trim();
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',');
        csvContent += line + '\r\n';
      });

      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `${reportTitle.replace(/\s+/g, '_')}_${dateStr}.csv`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (format === 'Print' || format === 'PDF') {
      const printWindow = window.open('', '_blank');
      
      let activeFiltersHtml = '';
      if (!activeReport) {
        activeFiltersHtml = `<strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}`;
      } else {
        const branchName = selectedBranch === 'all' ? 'All Branches' : (branches.find(b => String(b.id) === String(selectedBranch))?.name || 'Selected Branch');
        const agentName = selectedAgent === 'all' ? 'All Agents' : (agents.find(a => String(a.id) === String(selectedAgent))?.name || 'Selected Agent');
        const dateRange = (startDate || endDate) ? `${startDate || 'Start'} to ${endDate || 'End'}` : 'All Dates';
        const monthName = detailMonth === 'all' ? 'All Months' : new Date(2000, parseInt(detailMonth)-1, 1).toLocaleString('en-IN', {month: 'long'});
        
        activeFiltersHtml = `
          <div><strong>Branch:</strong> ${branchName}</div>
          <div><strong>Agent:</strong> ${agentName}</div>
          <div><strong>Date Range:</strong> ${dateRange}</div>
          <div><strong>Filtered Month:</strong> ${monthName}</div>
        `;
      }

      const parseAmt = (val) => {
        if (typeof val !== 'string') return Number(val || 0);
        return Number(val.replace(/[^\d.]/g, ''));
      };

      let summaryHtml = '';
      if (!activeReport) {
        const total = rows.reduce((sum, r) => sum + parseAmt(r[3]), 0);
        const cashTotal = rows.filter(r => r[5] === 'Cash').reduce((sum, r) => sum + parseAmt(r[3]), 0);
        summaryHtml = `
          <div class="summary-card">
            <span class="label">Total Collection</span>
            <span class="value">₹${total.toLocaleString('en-IN')}</span>
          </div>
          <div class="summary-card">
            <span class="label">Total Transactions</span>
            <span class="value">${rows.length}</span>
          </div>
          <div class="summary-card">
            <span class="label">Cash Handover</span>
            <span class="value">₹${cashTotal.toLocaleString('en-IN')}</span>
          </div>
        `;
      } else if (activeReport === 'col') {
        const total = rows.reduce((sum, r) => sum + parseAmt(r[3]), 0);
        const cashTotal = rows.filter(r => r[5] === 'Cash').reduce((sum, r) => sum + parseAmt(r[3]), 0);
        summaryHtml = `
          <div class="summary-card">
            <span class="label">Total Collection</span>
            <span class="value">₹${total.toLocaleString('en-IN')}</span>
          </div>
          <div class="summary-card">
            <span class="label">Accounts Synced</span>
            <span class="value">${rows.length} Accounts</span>
          </div>
          <div class="summary-card">
            <span class="label">Cash Collection</span>
            <span class="value">₹${cashTotal.toLocaleString('en-IN')}</span>
          </div>
        `;
      } else if (activeReport === 'saving') {
        const total = rows.reduce((sum, r) => sum + parseAmt(r[4]), 0);
        const netBal = rows.reduce((sum, r) => sum + parseAmt(r[6]), 0);
        summaryHtml = `
          <div class="summary-card">
            <span class="label">Total Savings Pool</span>
            <span class="value">₹${total.toLocaleString('en-IN')}</span>
          </div>
          <div class="summary-card">
            <span class="label">Active Savings Accounts</span>
            <span class="value">${rows.length} Accounts</span>
          </div>
          <div class="summary-card">
            <span class="label">Net Balance (with Interest)</span>
            <span class="value">₹${netBal.toLocaleString('en-IN')}</span>
          </div>
        `;
      } else if (activeReport === 'loan') {
        const disbursed = rows.reduce((sum, r) => sum + parseAmt(r[4]), 0);
        const outstanding = rows.reduce((sum, r) => sum + parseAmt(r[5]), 0);
        summaryHtml = `
          <div class="summary-card">
            <span class="label">Total Disbursed Pool</span>
            <span class="value">₹${disbursed.toLocaleString('en-IN')}</span>
          </div>
          <div class="summary-card">
            <span class="label">Total Outstanding Balance</span>
            <span class="value">₹${outstanding.toLocaleString('en-IN')}</span>
          </div>
          <div class="summary-card">
            <span class="label">Active Accounts</span>
            <span class="value">${rows.length} Accounts</span>
          </div>
        `;
      }

      const tableRowsHtml = rows.map((row, idx) => `
        <tr>
          <td>${idx + 1}</td>
          ${row.map(cell => `<td>${cell || 'N/A'}</td>`).join('')}
        </tr>
      `).join('');

      const tableHeadersHtml = `
        <th>S.No.</th>
        ${headers.map(h => `<th>${h}</th>`).join('')}
      `;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${reportTitle}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Manrope', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 20px;
              font-size: 11px;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #0a3598;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            .logo-section h1 {
              font-size: 20px;
              font-weight: 900;
              color: #0a3598;
              margin: 0;
              letter-spacing: 0.5px;
              line-height: 1.1;
            }
            .logo-section p {
              font-size: 9px;
              font-weight: 700;
              color: #f59e0b;
              margin: 2px 0 0 0;
              text-transform: uppercase;
              letter-spacing: 1px;
              line-height: 1.1;
            }
            .meta-section {
              text-align: right;
              font-size: 10px;
              line-height: 1.4;
            }
            .report-title-container {
              margin-bottom: 20px;
            }
            .report-title-container h2 {
              font-size: 15px;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
              text-transform: uppercase;
            }
            .report-title-container p {
              font-size: 10px;
              color: #64748b;
              margin: 4px 0 0 0;
              font-weight: 500;
            }
            .filters-summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px;
              margin-bottom: 20px;
              font-size: 9.5px;
            }
            .summary-cards-container {
              display: flex;
              gap: 12px;
              margin-bottom: 20px;
            }
            .summary-card {
              flex: 1;
              background: #fff;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px 12px;
              display: flex;
              flex-direction: column;
              gap: 2px;
            }
            .summary-card .label {
              font-size: 8.5px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .summary-card .value {
              font-size: 14px;
              font-weight: 900;
              color: #0a3598;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #e2e8f0;
              padding: 7px 10px;
              text-align: left;
            }
            th {
              background-color: #f8fafc;
              font-weight: 800;
              color: #475569;
              font-size: 9px;
              text-transform: uppercase;
            }
            tr:nth-child(even) td {
              background-color: #fafbfc;
            }
            .footer {
              margin-top: 40px;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
              text-align: center;
              font-size: 8.5px;
              color: #94a3b8;
              font-weight: 500;
            }
            @media print {
              body {
                padding: 0;
              }
              button {
                display: none;
              }
              @page {
                margin: 1.5cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="logo-section" style="display: flex; align-items: center; gap: 10px;">
              <img src="${window.location.origin}/logo.png" class="logo-img" alt="Logo" style="height: 40px; width: 40px; object-fit: contain;">
              <div>
                <h1>UMBRELLA FINANCE</h1>
                <p>Chhote Kadam, Bade Sapne</p>
              </div>
            </div>
            <div class="meta-section">
              <strong>Printed On:</strong> ${new Date().toLocaleString('en-IN')}<br>
              <strong>System Status:</strong> Live
            </div>
          </div>

          <div class="report-title-container">
            <h2>${reportTitle}</h2>
            <p>${reportDesc}</p>
          </div>

          <div class="filters-summary">
            ${activeFiltersHtml}
          </div>

          ${summaryHtml ? `<div class="summary-cards-container">${summaryHtml}</div>` : ''}

          <table>
            <thead>
              <tr>${tableHeadersHtml}</tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer">
            This is a computer-generated report from Umbrella Finance Live Core Ledger System. Page 1 of 1.
          </div>

          <script>
            function startPrint() {
              Promise.all([
                document.fonts.ready,
                new Promise(resolve => {
                  const img = document.querySelector('.logo-img');
                  if (img.complete) resolve();
                  else img.onload = resolve;
                })
              ]).then(() => {
                setTimeout(() => {
                  window.print();
                  setTimeout(() => { window.close(); }, 500);
                }, 300);
              });
            }
            window.onload = startPrint;
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const activeReportDetails = activeReport ? reportsData[activeReport] : null;

  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
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

    if (selectedMetricLabel) {
      const parseAmt = (val) => typeof val === 'string' ? Number(val.replace(/[^\d.]/g, '')) : Number(val || 0);

      if (activeReport === 'loan') {
        if (selectedMetricLabel === 'Total Disbursed Pool') {
          // Show all
        } else if (selectedMetricLabel === 'Total Outstanding Bal') {
          filtered = filtered.filter(row => parseAmt(row[5]) > 0);
        } else if (selectedMetricLabel === 'Active Loan Accounts') {
          filtered = filtered.filter(row => row[8].includes('Active'));
        } else if (selectedMetricLabel === 'Interest Collected') {
          filtered = filtered.filter(row => parseAmt(row[6]) > 0);
        } else if (selectedMetricLabel === 'Interest Pending') {
          filtered = filtered.filter(row => parseAmt(row[7]) > 0);
        } else if (selectedMetricLabel === 'Interest Loss' || selectedMetricLabel === 'Interest Loss (NPA Defaulters)') {
          filtered = filtered.filter(row => /Defaulter|NPA|Overdue/.test(row[8]));
        }
      } else if (activeReport === 'saving') {
        if (selectedMetricLabel === 'Total Deposit Pool') {
          // Show all
        } else if (selectedMetricLabel === 'Interest Liabilities') {
          filtered = filtered.filter(row => parseAmt(row[5]) > 0);
        } else if (selectedMetricLabel === 'Net Liability') {
          filtered = filtered.filter(row => parseAmt(row[6]) > 0);
        }
      } else if (activeReport === 'col') {
        if (selectedMetricLabel === 'Cash Collections') {
          filtered = filtered.filter(row => row[5] === 'Cash');
        }
      } else if (activeReport === 'maturity') {
        if (selectedMetricLabel === 'Maturity Paid') {
          filtered = filtered.filter(row => row[5] === 'Completed' || row[5] === 'Closed');
        } else if (selectedMetricLabel === 'Pending Payout Pool') {
          filtered = filtered.filter(row => row[5] === 'Pending Pay Out');
        } else if (selectedMetricLabel === 'Maturing Today') {
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          const todayStr = `${yyyy}-${mm}-${dd}`;
          filtered = filtered.filter(row => row[0] === todayStr);
        }
      }
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(row =>
        row.some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    return filtered;
  };

  const handleMetricCardClick = (label, filterVal) => {
    if (!filterVal) return;
    
    // Clear date and month filters to show all matching records for the metric
    setDetailMonth('all');
    setDetailStartDate('');
    setDetailEndDate('');

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
                <p className="text-xs text-secondary-text font-bold">Summary list for current date ({new Date().toLocaleDateString('en-GB').replace(/\//g, '-')})</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('PDF')}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-border-fin hover:border-red-200 hover:text-red-600 hover:bg-red-50/50 text-secondary-text rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-[0.98] hover:-translate-y-[1px] hover:shadow-xs"
                >
                  <span className="material-symbols-rounded text-sm select-none text-red-500">picture_as_pdf</span>
                  PDF
                </button>
                <button
                  onClick={() => handleExport('Excel')}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-border-fin hover:border-emerald-200 hover:text-emerald-600 hover:bg-emerald-50/50 text-secondary-text rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-[0.98] hover:-translate-y-[1px] hover:shadow-xs"
                >
                  <span className="material-symbols-rounded text-sm select-none text-emerald-500">table_chart</span>
                  Excel
                </button>
                <button
                  onClick={() => handleExport('Print')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#FFD54A] to-[#E67E00] hover:brightness-105 text-slate-950 rounded-xl text-xs font-black shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.98] hover:-translate-y-[1px] hover:shadow-md"
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
                    {(() => {
                      const sorted = [...todayCollections].sort((a, b) => b[1].localeCompare(a[1]));
                      const paginated = sorted.slice((todayPage - 1) * 20, todayPage * 20);

                      if (paginated.length === 0) {
                        return (
                          <tr>
                            <td colSpan="6" className="px-6 py-8 text-center text-xs text-secondary-text font-bold">
                              No transactions found for the selected filters today.
                            </td>
                          </tr>
                        );
                      }

                      return paginated.map((row, idx) => (
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
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination 
              currentPage={todayPage}
              totalPages={Math.ceil(todayCollections.length / 20)}
              onPageChange={setTodayPage}
            />
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
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-border-fin hover:border-red-200 hover:text-red-600 hover:bg-red-50/50 text-secondary-text rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-[0.98] hover:-translate-y-[1px] hover:shadow-xs flex-1 sm:flex-initial"
              >
                <span className="material-symbols-rounded text-sm select-none text-red-500">picture_as_pdf</span>
                PDF
              </button>
              <button
                onClick={() => handleExport('Excel')}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-border-fin hover:border-emerald-200 hover:text-emerald-600 hover:bg-emerald-50/50 text-secondary-text rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-[0.98] hover:-translate-y-[1px] hover:shadow-xs flex-1 sm:flex-initial"
              >
                <span className="material-symbols-rounded text-sm select-none text-emerald-500">table_chart</span>
                Excel
              </button>
              <button
                onClick={() => handleExport('Print')}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-[#FFD54A] to-[#E67E00] hover:brightness-105 text-slate-950 rounded-xl text-xs font-black shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.98] hover:-translate-y-[1px] hover:shadow-md flex-1 sm:flex-initial"
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

          {activeReport === 'loan' && (() => {
            const parseAmt = (val) => typeof val === 'string' ? Number(val.replace(/[^\d.]/g, '')) : Number(val || 0);
            const collected = reportRows.reduce((s, r) => s + parseAmt(r[6]), 0);
            const overdue = reportRows.reduce((s, r) => s + parseAmt(r[7]), 0);
            const npaLoss = reportRows
              .filter(r => /Defaulter|NPA|Overdue/.test(String(r[8] || '')))
              .reduce((s, r) => s + parseAmt(r[7]), 0);
            const fmt = (v) => inr(v);
            return (
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
                      <h3 className="text-2xl font-black text-success-fin tracking-tight">{fmt(collected)}</h3>
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
                      <h3 className="text-2xl font-black text-warning-fin tracking-tight">{fmt(overdue)}</h3>
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
                      <h3 className="text-2xl font-black text-danger-fin tracking-tight">{fmt(npaLoss)}</h3>
                      <span className="text-xs font-bold text-secondary-text block">Blocked in high-risk default accounts</span>
                    </div>
                  </button>
                </section>
              </div>
            );
          })()}

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
                    {(() => {
                      const filtered = getFilteredRows(reportRows);
                      const paginated = filtered.slice((detailPage - 1) * 20, detailPage * 20);

                      if (paginated.length === 0) {
                        return (
                          <tr>
                            <td colSpan={activeReportDetails.columns.length} className="px-6 py-10 text-center text-xs text-secondary-text font-bold">
                              No matching records found. Try adjusting filters or search query.
                            </td>
                          </tr>
                        );
                      }

                      return paginated.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-background-fin/50 transition-colors">
                          {row.map((val, colIdx) => {
                            const colHeader = activeReportDetails.columns[colIdx];
                            const isDebitAmt = colHeader === 'Debit Amount' && val !== '-';
                            const isCreditAmt = (
                              colHeader === 'Credit Amount' ||
                              colHeader === 'Amount Collected' ||
                              colHeader === 'Actual Collected' ||
                              colHeader === 'Interest Collected' ||
                              colHeader === 'Total Deposit'
                            ) && val !== '-';
                            return (
                              <td key={colIdx} className="whitespace-nowrap px-6 py-3.5">
                                {isDebitAmt ? (
                                  <span className="text-danger-fin font-black">{val}</span>
                                ) : isCreditAmt ? (
                                  <span className="text-success-fin font-black">{val}</span>
                                ) : val === 'High Risk (NPA)' || val === 'Debit' || val === 'Defaulter' || val === 'Rejected' || (typeof val === 'string' && (val.includes('Defaulter') || val.includes('Overdue') || val.includes('Rejected'))) ? (
                                  <span className="text-danger-fin font-black">{val}</span>
                                ) : val === 'Credit' || val === 'Paid' || val === 'Completed' || val === 'Loan Completed' || (typeof val === 'string' && val.includes('Active')) ? (
                                  <span className="text-success-fin font-black">{val}</span>
                                ) : val === 'Pending Pay Out' || val === 'Processing' || val === 'Medium Risk' || val === 'Warning' ? (
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
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination 
              currentPage={detailPage}
              totalPages={Math.ceil(getFilteredRows(reportRows).length / 20)}
              onPageChange={setDetailPage}
            />
          </section>
        </div>
      )}
    </div>
  );
}
