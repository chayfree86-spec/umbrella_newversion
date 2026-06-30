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
            row.MaturityDate || row.StartDate || 'N/A',
            row.CustomerName || 'N/A',
            row.AccountNo || 'N/A',
            row.PlanDetails || (row.PlanName ? `${row.PlanName} (${row.InterestRate || 0}%)` : 'N/A'),
            '₹' + Number(row.DepositedAmount || 0).toLocaleString('en-IN'),
            '₹' + Number(row.InterestPaid || 0).toLocaleString('en-IN'),
            '₹' + Number(row.NetBalance || row.DepositedAmount || 0).toLocaleString('en-IN')
          ];
        case 'loan':
          return [
            row.DisbursalDate || 'N/A',
            row.AccountNo || 'N/A',
            row.CustomerName || 'N/A',
            row.LoanPlan || 'N/A',
            '₹' + Number(row.ApprovedAmount || 0).toLocaleString('en-IN'),
            '₹' + Number(row.OutstandingBalance || 0).toLocaleString('en-IN'),
            '₹' + Number(row.InterestCollected || 0).toLocaleString('en-IN'),
            '₹' + Number(row.InterestOverdue || 0).toLocaleString('en-IN'),
            row.Status || 'N/A'
          ];
        case 'agent':
          return [
            row.LogDate || new Date().toISOString().slice(0, 10),
            row.AgentName || 'N/A',
            row.AreaName || 'N/A',
            String(row.AssignedCustomers || 0),
            '₹' + Number(row.TargetCollection || 0).toLocaleString('en-IN'),
            '₹' + Number(row.ActualCollected || 0).toLocaleString('en-IN'),
            row.PerformanceRate || '0%'
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
                <p className="text-xs text-secondary-text font-bold">Summary list for current date ({new Date().toLocaleDateString('en-GB').replace(/\//g, '-')})</p>
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

          {activeReport === 'loan' && (() => {
            const parseAmt = (val) => typeof val === 'string' ? Number(val.replace(/[^\d.]/g, '')) : Number(val || 0);
            const collected = reportRows.reduce((s, r) => s + parseAmt(r[6]), 0);
            const overdue = reportRows.reduce((s, r) => s + parseAmt(r[7]), 0);
            const npaLoss = reportRows
              .filter(r => /Defaulter|NPA|Overdue/.test(String(r[8] || '')))
              .reduce((s, r) => s + parseAmt(r[7]), 0);
            const fmt = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');
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
