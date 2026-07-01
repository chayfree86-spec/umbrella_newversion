import React, { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import { Pagination } from '../components/ui/Pagination';

const inr = (val) => Number(val || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (val) => Number(val || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

const formatCrore = (val) => {
  const v = Number(val || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return inr(v);
};

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState("Today's Collection");
  const [dataSummary, setDataSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const username = localStorage.getItem('username') || localStorage.getItem('active_user_name') || 'User';

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = () => {
    dashboardApi.summary()
      .then(res => {
        setDataSummary(res.data);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load dashboard');
        setLoading(false);
      });
  };

  const d = dataSummary;
  const placeholder = loading ? '...' : '—';

  // Statistics Data — purely backend-driven
  const stats = [
    { name: 'Total Customers',     value: d ? num(d.total_customers) : placeholder, icon: 'groups',                 change: 'Registered active',         type: 'primary' },
    { name: 'Active Loans',        value: d ? `${num(d.active_loans)} (${inr(d.loan_value)})` : placeholder,         icon: 'credit_score',           change: 'Loan accounts active',      type: 'primary' },
    { name: 'Active Savings',      value: d ? `${num(d.active_savings)} (${inr(d.saving_value)})` : placeholder,     icon: 'savings',                change: 'Savings accounts active',   type: 'primary' },
    { name: "Today's Collection",  value: d ? inr(d.today_collection) : placeholder,                                 icon: 'payments',               change: `Monthly: ${d ? inr(d.monthly_collection) : placeholder}`, type: 'success' },
    { name: "Today's Due",         value: d ? inr(d.today_due) : placeholder,                                        icon: 'schedule',               change: 'Pending EMI payments',      type: 'warning' },
    { name: "Today's Maturity",    value: d ? `${num(d.today_maturity)} Accounts` : placeholder,                     icon: 'workspace_premium',      change: 'Savings maturities today',  type: 'accent' },
    { name: 'Outstanding Amount',  value: d ? inr(d.outstanding_amount) : placeholder,                               icon: 'pending_actions',        change: 'Outstanding loan portfolio',type: 'danger' },
    { name: 'Available Loan Fund', value: d ? inr(d.available_loan_fund) : placeholder,                              icon: 'account_balance_wallet', change: 'Ready for disbursal',       type: 'primary' },
    { name: 'Earned Interest',     value: d ? inr(d.earned_interest) : placeholder,                                  icon: 'trending_up',            change: 'Collected interest income', type: 'success' },
    { name: 'Pending Interest',    value: d ? inr(d.pending_interest) : placeholder,                                 icon: 'hourglass_empty',        change: 'Overdue & due interest',    type: 'warning' }
  ];

  // Drill-down table data — all rows come from API
  const filterData = {
    'Total Customers': {
      title: 'Recent Registered Customers',
      desc: 'Listing last registered customers from DB',
      columns: ['Code', 'Name', 'Mobile', 'Branch', 'Register Date'],
      rows: (d?.recent_registrations || []).map(r => [
        r.customer_code, r.full_name, r.mobile, r.branch_name, fmtDate(r.created_at)
      ])
    },
    'Active Loans': {
      title: 'Active Loan Accounts Summary',
      desc: 'Total active credit exposures',
      columns: ['Customer', 'Account No', 'Approved Amount', 'Paid', 'Outstanding'],
      rows: (d?.active_loan_rows || []).map(r => [
        r.full_name, r.loan_account_no, inr(r.principal_amount), inr(r.total_paid), inr(r.outstanding_amount)
      ])
    },
    'Active Savings': {
      title: 'Active Savings Accounts Summary',
      desc: 'Active deposit accounts',
      columns: ['Customer', 'Account No', 'Deposited', 'Interest Rate', 'Maturity Date'],
      rows: (d?.active_saving_rows || []).map(r => [
        r.full_name, r.saving_account_no, inr(r.total_deposited), `${Number(r.interest_rate).toFixed(2)}%`, fmtDate(r.maturity_date)
      ])
    },
    "Today's Collection": {
      title: 'Real-time Collections Feed',
      desc: 'Synced cash receipts from the field',
      columns: ['Customer', 'Receipt No', 'Amount Received', 'Field Collector', 'Time Sync'],
      rows: (d?.recent_collections || []).map(c => [
        c.customer_name, c.receipt_no, inr(c.amount), c.agent_name, fmtTime(c.created_at), c.account_no
      ])
    },
    "Today's Due": {
      title: "Today's Pending Dues",
      desc: 'Loan EMIs due today and not yet collected',
      columns: ['Customer', 'Account No', 'Due Amount', 'Mobile', 'Assigned Agent'],
      rows: (d?.today_due_rows || []).map(r => [
        r.full_name, r.loan_account_no, inr(r.due_amount), r.mobile, r.agent_name
      ])
    },
    "Today's Maturity": {
      title: "Today's Maturing Accounts",
      desc: 'Savings accounts maturing today',
      columns: ['Customer', 'Account No', 'Maturity Value', 'Plan Name', 'Status'],
      rows: (d?.today_maturity_rows || []).map(r => [
        r.full_name, r.saving_account_no, inr(r.maturity_amount), r.plan_name || '—', r.account_status
      ])
    },
    'Outstanding Amount': {
      title: 'Total Outstanding Portfolio',
      desc: 'Outstanding loan dues with overdue insight',
      columns: ['Customer', 'Account No', 'Outstanding', 'Overdue Days', 'Risk Tier'],
      rows: (d?.outstanding_rows || []).map(r => {
        const days = Number(r.overdue_days || 0);
        const tier = days > 30 ? 'High Risk (NPA)' : days > 7 ? 'Medium Risk' : days > 0 ? 'Low Risk' : 'On Track';
        return [r.full_name, r.loan_account_no, inr(r.outstanding_amount), days > 0 ? `${days} Days Overdue` : '—', tier];
      })
    },
    'Overall Cash Balance': {
      title: 'Cash Book Ledger In/Out Summary',
      desc: 'High-level cash in hand ledger summary',
      columns: ['Date', 'Type', 'Particulars', 'Ref No', 'Amount'],
      rows: (d?.cash_book_rows || []).map(r => [
        fmtDate(r.entry_date),
        r.entry_type === 'credit' ? 'Credit' : 'Debit',
        r.description || '—',
        r.reference_no || '—',
        inr(r.amount)
      ])
    },
    'Available Loan Fund': {
      title: 'Loan Disbursal Capital Pool Logs',
      desc: 'Audit trail of capital injections',
      columns: ['Date', 'Type', 'Source / Particulars', 'Ref No', 'Amount'],
      rows: (d?.fund_entry_rows || []).map(r => [
        fmtDate(r.entry_date),
        r.entry_type === 'credit' ? 'Capital Injection' : 'Allocation',
        r.source_name || r.description || '—',
        r.transaction_no || '—',
        inr(r.amount)
      ])
    },
    'Earned Interest': {
      title: 'Collected Interest Income Ledger',
      desc: 'Real-time list of collected interest from loan repayments',
      columns: ['Customer', 'Account No', 'Receipt No', 'Interest Amount', 'Collection Date', 'Payment Mode'],
      rows: (d?.earned_interest_rows || []).map(r => [
        r.full_name, r.loan_account_no, r.receipt_no, inr(r.interest_amount), fmtDate(r.collection_date), r.payment_mode
      ])
    },
    'Pending Interest': {
      title: 'Pending / Overdue Interest Receivables',
      desc: 'Outstanding interest components from due and overdue installments',
      columns: ['Customer', 'Account No', 'Due Date', 'Pending Interest', 'Assigned Agent'],
      rows: (d?.pending_interest_rows || []).map(r => [
        r.full_name, r.loan_account_no, fmtDate(r.due_date), inr(r.pending_interest), r.agent_name || '—'
      ])
    }
  };

  const activeFilterData = filterData[activeFilter] || filterData["Today's Collection"];

  // Chart 1: Collection Trend — backend driven
  const trendPoints = d?.collection_trend || [];
  const collectionTrendSeries = [{
    name: 'Daily Collection (₹)',
    data: trendPoints.map(t => Number(t.total || 0))
  }];

  const collectionTrendOptions = {
    chart: { type: 'area', height: 300, toolbar: { show: false }, fontFamily: 'Manrope, sans-serif' },
    colors: ['#0A3598'],
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] }
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    xaxis: {
      categories: trendPoints.map(t => {
        const dt = new Date(t.day);
        return dt.toLocaleDateString('en-IN', { weekday: 'short' });
      }),
      labels: { style: { colors: '#64748B', fontWeight: 500 } }
    },
    yaxis: {
      labels: {
        formatter: (val) => val >= 1000 ? `₹${Math.round(val / 1000)}k` : `₹${val}`,
        style: { colors: '#64748B', fontWeight: 500 }
      }
    },
    grid: { borderColor: '#E2E8F0', strokeDashArray: 4 },
    noData: { text: loading ? 'Loading...' : 'No collections yet', style: { color: '#64748B', fontSize: '12px' } }
  };

  // Chart 2: Loan vs Saving Portfolio — backend driven
  const portfolioLoan = Number(d?.portfolio_loan || 0);
  const portfolioSaving = Number(d?.portfolio_saving || 0);
  const totalPortfolio = portfolioLoan + portfolioSaving;
  const loanVsSavingSeries = totalPortfolio > 0 ? [portfolioLoan, portfolioSaving] : [];
  const loanVsSavingOptions = {
    chart: { type: 'donut', height: 280, fontFamily: 'Manrope, sans-serif' },
    labels: ['Loan Portfolio', 'Savings Portfolio'],
    colors: ['#0A3598', '#FFC107'],
    dataLabels: { enabled: false },
    legend: { position: 'bottom', horizontalAlign: 'center', labels: { colors: '#64748B' } },
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total Portfolio',
              formatter: () => formatCrore(totalPortfolio),
              color: '#0F172A',
              fontSize: '16px',
              fontWeight: 600
            }
          }
        }
      }
    },
    noData: { text: loading ? 'Loading...' : 'No portfolio data', style: { color: '#64748B', fontSize: '12px' } }
  };

  return (
    <div className="space-y-8">
      {/* Page Header (Fintech Style Banner) */}
      <div className="relative overflow-hidden bg-primary rounded-3xl p-6 md:p-8 text-surface shadow-lg shadow-primary/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 bg-radial-gradient from-accent to-transparent pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="bg-surface/10 text-accent px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-1.5 inline-block">
            Daily Insights
          </span>
          <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-surface mb-1">
            Welcome, {username}!
          </h2>
          <p className="text-sm text-surface/80 max-w-[60ch] leading-relaxed font-semibold">
            {d ? (
              <>Umbrella Finance collection today is <strong className="text-accent font-black">{inr(d.today_collection)}</strong>.</>
            ) : (
              <>{error ? <span className="text-accent">{error}</span> : 'Loading live collection data…'}</>
            )}
          </p>
        </div>

        {/* Highlighted Cash Balance */}
        <div 
          onClick={() => setActiveFilter('Overall Cash Balance')}
          className={`relative z-10 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-5 min-w-[240px] shadow-inner flex flex-col items-start md:items-end self-stretch md:self-auto cursor-pointer select-none transition-all active:scale-[0.98] ${
            activeFilter === 'Overall Cash Balance' ? 'ring-2 ring-accent bg-white/20' : ''
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-rounded text-accent text-lg">wallet</span>
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">Overall Cash Balance</span>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {d ? inr(d.overall_cash_balance) : placeholder}
          </h3>
          <span className="text-[10px] font-bold text-accent uppercase tracking-widest mt-1">Cash in hand balance</span>
        </div>
      </div>

      {/* Stats Grid - Clickable Filters (Bento Layout Style) */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const isSelected = activeFilter === stat.name;
          return (
            <div
              key={i}
              onClick={() => setActiveFilter(stat.name)}
              className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 select-none active:scale-[0.98] ${
                isSelected
                  ? 'bg-primary/5 border-primary shadow-md shadow-primary/5 ring-2 ring-primary/10 scale-[1.01]'
                  : 'bg-surface border-border-fin shadow-sm hover:shadow-md hover:border-primary/20'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-secondary-text uppercase tracking-wide truncate max-w-[120px]">
                  {stat.name}
                </span>
                <div className={`p-2 rounded-xl flex items-center justify-center transition-all ${
                  isSelected ? 'bg-primary text-surface' :
                  stat.type === 'success' ? 'bg-success-fin/10 text-success-fin' :
                  stat.type === 'danger' ? 'bg-danger-fin/10 text-danger-fin' :
                  stat.type === 'warning' ? 'bg-warning-fin/10 text-warning-fin' :
                  stat.type === 'accent' ? 'bg-accent/10 text-[#D97706]' : 'bg-primary/10 text-primary'
                }`}>
                  <span className="material-symbols-rounded text-lg select-none">{stat.icon}</span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg md:text-xl font-extrabold text-primary-text tracking-tight">
                  {stat.value}
                </h3>
                <span className="text-[10px] font-bold text-secondary-text block">
                  {stat.change}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Dynamic Drill-down Table Section */}
      <section className="bg-surface p-6 rounded-2xl border border-border-fin shadow-sm overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
              <h3 className="text-base font-bold text-primary-text">{activeFilterData.title}</h3>
            </div>
            <p className="text-xs text-secondary-text mt-0.5 font-bold">{activeFilterData.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-primary/5 text-primary font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Filter Active: {activeFilter}
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto -mx-6">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-border-fin">
              <thead className="bg-background-fin">
                <tr>
                  {activeFilterData.columns.map((col, idx) => (
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
                  const paginatedRows = activeFilterData.rows.slice((currentPage - 1) * 20, currentPage * 20);
                  
                  if (paginatedRows.length === 0) {
                    return (
                      <tr>
                        <td colSpan={activeFilterData.columns.length} className="px-6 py-10 text-center text-secondary-text font-bold">
                          {loading ? 'Loading…' : error ? error : 'No records available'}
                        </td>
                      </tr>
                    );
                  }

                  return paginatedRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                      {row.slice(0, activeFilterData.columns.length).map((val, colIdx) => {
                        const s = String(val ?? '');
                        const colHeader = activeFilterData.columns[colIdx];
                        return (
                          <td key={colIdx} className="whitespace-nowrap px-6 py-3.5">
                            {colHeader === 'Amount' ? (
                              (row[1] === 'Credit' || row[1] === 'Capital Injection') ? (
                                <span className="text-success-fin font-black">{s}</span>
                              ) : (
                                <span className="text-danger-fin font-black">{s}</span>
                              )
                            ) : (colHeader === 'Amount Received' || colHeader === 'Deposited') ? (
                              <span className="text-success-fin font-black">{s}</span>
                            ) : colHeader === 'Receipt No' ? (
                              (() => {
                                const accNo = row[5] || (row[1] && String(row[1]).match(/^(LN-|SV-)/) ? row[1] : null);
                                return accNo ? (
                                  <Link to={`/account/${accNo}`} className="text-primary font-black hover:underline">
                                    {s}
                                  </Link>
                                ) : s;
                              })()
                            ) : s.includes('High Risk') || s.includes('Debit') ? (
                              <span className="text-danger-fin font-bold">{s}</span>
                            ) : s.includes('Credit') || s.includes('Paid') ? (
                              <span className="text-success-fin font-bold">{s}</span>
                            ) : /^(LN-|SV-)/.test(s) ? (
                              <Link to={`/account/${s}`} className="text-primary font-extrabold hover:underline">
                                {s}
                              </Link>
                            ) : (
                              s
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
          currentPage={currentPage}
          totalPages={Math.ceil(activeFilterData.rows.length / 20)}
          onPageChange={setCurrentPage}
        />
      </section>

      {/* Charts Bento Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <div className="bg-surface p-6 rounded-2xl border border-border-fin lg:col-span-2 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold text-primary-text">Collection Trend (Weekly)</h3>
              <p className="text-xs text-secondary-text font-bold">Performance of daily cumulative collections</p>
            </div>
            <span className="text-xs font-bold text-primary flex items-center gap-1">
              Live <span className="w-2 h-2 rounded-full bg-success-fin inline-block animate-pulse"></span>
            </span>
          </div>
          <Chart options={collectionTrendOptions} series={collectionTrendSeries} type="area" height={280} />
        </div>

        {/* Portfolio Donut Chart */}
        <div className="bg-surface p-6 rounded-2xl border border-border-fin shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-primary-text">Total Portfolio</h3>
            <p className="text-xs text-secondary-text font-bold">Distribution of loans vs savings balance</p>
          </div>
          <div className="my-6 flex justify-center">
            <Chart options={loanVsSavingOptions} series={loanVsSavingSeries} type="donut" height={260} width="100%" />
          </div>
        </div>
      </section>
    </div>
  );
}
