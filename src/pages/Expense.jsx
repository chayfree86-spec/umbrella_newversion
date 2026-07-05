import React, { useState, useEffect, useRef } from 'react';
import { DatePicker } from '../components/ui/DatePicker';
import { Select } from '../components/ui/Select';
import { expenseApi } from '../services/api';

const inr = (val) => Number(val || 0).toLocaleString('en-IN', { 
  style: 'currency', 
  currency: 'INR', 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
});

function MonthPicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [year, setYear] = useState(() => value ? parseInt(value.split('-')[0]) : new Date().getFullYear());
  const wrapperRef = useRef(null);

  const months = [
    { name: 'Jan', value: '01' },
    { name: 'Feb', value: '02' },
    { name: 'Mar', value: '03' },
    { name: 'Apr', value: '04' },
    { name: 'May', value: '05' },
    { name: 'Jun', value: '06' },
    { name: 'Jul', value: '07' },
    { name: 'Aug', value: '08' },
    { name: 'Sep', value: '09' },
    { name: 'Oct', value: '10' },
    { name: 'Nov', value: '11' },
    { name: 'Dec', value: '12' }
  ];

  useEffect(() => {
    if (value) {
      setYear(parseInt(value.split('-')[0]));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLabel = () => {
    if (!value) return 'Select Month';
    const parts = value.split('-');
    if (parts.length < 2) return 'Select Month';
    const y = parts[0];
    const m = parts[1];
    const monthName = months[parseInt(m, 10) - 1]?.name;
    return `${monthName} ${y}`;
  };

  const handleMonthSelect = (mVal) => {
    const formatted = `${year}-${mVal}`;
    onChange(formatted);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full sm:w-auto" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-w-[150px] px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0F172A] flex items-center justify-between gap-2 transition-all cursor-pointer select-none active:scale-[0.98]"
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-rounded text-slate-400 text-base">calendar_month</span>
          {getLabel()}
        </span>
        <span className="material-symbols-rounded text-slate-400 text-sm">keyboard_arrow_down</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl z-50 p-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setYear(y => y - 1)}
              className="p-1 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <span className="material-symbols-rounded text-base">chevron_left</span>
            </button>
            <span className="text-xs font-extrabold text-[#0F172A]">{year}</span>
            <button
              type="button"
              onClick={() => setYear(y => y + 1)}
              className="p-1 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <span className="material-symbols-rounded text-base">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {months.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => handleMonthSelect(m.value)}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                  value === `${year}-${m.value}`
                    ? 'bg-[#0A3598] text-white'
                    : 'bg-slate-50 hover:bg-slate-100 text-[#0F172A]'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Expense() {
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({
    saving_expense: 0,
    loan_expense: 0,
    individual_expense: 0,
    total_expense: 0
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [detailDay, setDetailDay] = useState(null); // For Calendar day click details

  // Form states
  const [formType, setFormType] = useState('Saving Balance');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(currentDayStr);
  const [formRemarks, setFormRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchExpenses = () => {
    setLoading(true);
    expenseApi.list(selectedMonth)
      .then(res => {
        setExpenses(res.data?.expenses || []);
        setSummary(res.data?.summary || {
          saving_expense: 0,
          loan_expense: 0,
          individual_expense: 0,
          total_expense: 0
        });
      })
      .catch(err => {
        console.error('Error fetching expenses:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedMonth]);

  const isPreviousMonth = (dateStr) => {
    if (!dateStr) return false;
    return dateStr.slice(0, 7) < currentMonthStr;
  };

  const resetForm = () => {
    setFormType('Saving Balance');
    setFormAmount('');
    setFormDate(currentDayStr);
    setFormRemarks('');
    setFormError('');
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formAmount || parseFloat(formAmount) <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a date.');
      return;
    }
    if (isPreviousMonth(formDate)) {
      setFormError('Cannot add expenses to previous months.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    expenseApi.create({
      expense_type: formType,
      amount: parseFloat(formAmount),
      entry_date: formDate,
      remarks: formRemarks
    })
      .then(() => {
        setIsAddOpen(false);
        resetForm();
        fetchExpenses();
      })
      .catch(err => {
        setFormError(err.message || 'Failed to add expense.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!formAmount || parseFloat(formAmount) <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a date.');
      return;
    }
    if (isPreviousMonth(formDate)) {
      setFormError('Cannot set expense date to a previous month.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    expenseApi.update(selectedExpense.id, {
      expense_type: formType,
      amount: parseFloat(formAmount),
      entry_date: formDate,
      remarks: formRemarks
    })
      .then(() => {
        setIsEditOpen(false);
        setSelectedExpense(null);
        resetForm();
        fetchExpenses();
      })
      .catch(err => {
        setFormError(err.message || 'Failed to update expense.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleDeleteSubmit = () => {
    if (!selectedExpense) return;
    setIsSubmitting(true);
    expenseApi.delete(selectedExpense.id)
      .then(() => {
        setIsDeleteOpen(false);
        setSelectedExpense(null);
        fetchExpenses();
      })
      .catch(err => {
        alert(err.message || 'Failed to delete expense.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const openEditModal = (exp) => {
    if (isPreviousMonth(exp.entry_date)) return;
    setSelectedExpense(exp);
    setFormType(exp.expense_type);
    setFormAmount(exp.amount);
    setFormDate(exp.entry_date.slice(0, 10));
    setFormRemarks(exp.remarks || '');
    setIsEditOpen(true);
  };

  const openDeleteModal = (exp) => {
    if (isPreviousMonth(exp.entry_date)) return;
    setSelectedExpense(exp);
    setIsDeleteOpen(true);
  };

  // Build Calendar variables
  const [yearVal, monthVal] = selectedMonth.split('-');
  const selectedYearInt = parseInt(yearVal);
  const selectedMonthInt = parseInt(monthVal) - 1; // 0-indexed

  const daysInMonth = new Date(selectedYearInt, selectedMonthInt + 1, 0).getDate();
  const firstDayIndex = new Date(selectedYearInt, selectedMonthInt, 1).getDay();
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  // Expense Map by date for calendar rendering
  const dateExpenseMap = {};
  expenses.forEach(e => {
    const key = e.entry_date.slice(0, 10);
    if (!dateExpenseMap[key]) {
      dateExpenseMap[key] = {
        total: 0,
        items: [],
        types: new Set()
      };
    }
    dateExpenseMap[key].total += parseFloat(e.amount);
    dateExpenseMap[key].items.push(e);
    dateExpenseMap[key].types.add(e.expense_type);
  });

  const getCalendarDays = () => {
    const tempDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${selectedYearInt}-${String(selectedMonthInt + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const data = dateExpenseMap[dateStr] || { total: 0, items: [], types: new Set() };
      tempDays.push({
        day: i,
        dateStr,
        ...data
      });
    }
    return tempDays;
  };

  const calendarDays = getCalendarDays();

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-lg font-black text-[#0F172A] tracking-tight">Expense Management</h1>
          <p className="text-xs text-[#64748B] font-semibold mt-0.5">
            Track and monitor fund outflows across multiple balances and individual records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Month Filter */}
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />

          {/* View Switcher Toggle */}
          <div className="flex bg-slate-50 border border-slate-200 p-0.5 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-white text-[#0A3598] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-rounded text-base">format_list_bulleted</span>
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'calendar'
                  ? 'bg-white text-[#0A3598] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-rounded text-base">calendar_view_month</span>
              Calendar
            </button>
          </div>

          {/* Add Expense Button */}
          <button
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="px-4 py-2 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-rounded text-sm">add_circle</span>
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Savings Balance Spent */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <span className="material-symbols-rounded text-lg">savings</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Savings Spent</span>
            <strong className="text-base font-black text-[#0F172A] mt-0.5 block">
              {inr(summary.saving_expense)}
            </strong>
          </div>
        </div>

        {/* Loan Balance Spent */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <span className="material-symbols-rounded text-lg">payments</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Loan Pool Spent</span>
            <strong className="text-base font-black text-[#0F172A] mt-0.5 block">
              {inr(summary.loan_expense)}
            </strong>
          </div>
        </div>

        {/* Individual Spent */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <span className="material-symbols-rounded text-lg">person</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Individual Spent</span>
            <strong className="text-base font-black text-[#0F172A] mt-0.5 block">
              {inr(summary.individual_expense)}
            </strong>
          </div>
        </div>

        {/* Total Outflow */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <span className="material-symbols-rounded text-lg">trending_down</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Total Outflow</span>
            <strong className="text-base font-black text-[#E11D48] mt-0.5 block">
              {inr(summary.total_expense)}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center shadow-sm">
          <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-[#0A3598] rounded-full" role="status" aria-label="loading">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="text-xs text-slate-500 font-semibold mt-2">Loading expense records...</p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#E2E8F0]">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Ref ID</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Expense Type</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Remarks</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Entered By</th>
                  <th scope="col" className="px-6 py-3.5 text-right text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-6 py-3.5 text-center text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#E2E8F0]">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-center text-xs font-bold text-slate-400">
                      No expense records found for this month.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => {
                    const disabled = isPreviousMonth(exp.entry_date);
                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-[#0F172A]">
                          {new Date(exp.entry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-500">
                          {exp.expense_no || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {exp.expense_type === 'Saving Balance' && (
                            <span className="px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg text-[10px] font-bold">
                              Savings Balance
                            </span>
                          )}
                          {exp.expense_type === 'Loan Balance' && (
                            <span className="px-2.5 py-1 bg-purple-50 border border-purple-100 text-purple-600 rounded-lg text-[10px] font-bold">
                              Loan Balance
                            </span>
                          )}
                          {exp.expense_type === 'Individual' && (
                            <span className="px-2.5 py-1 bg-amber-50 border border-amber-100 text-amber-600 rounded-lg text-[10px] font-bold">
                              Individual
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-600 max-w-xs truncate" title={exp.remarks}>
                          {exp.remarks || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-500">
                          {exp.entered_by_name || 'System'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-extrabold text-[#E11D48]">
                          {inr(exp.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-bold">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(exp)}
                              disabled={disabled}
                              className={`p-1.5 rounded-lg border transition-all ${
                                disabled 
                                  ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:text-[#0A3598] hover:border-[#0A3598]/20 cursor-pointer shadow-2xs hover:shadow-xs'
                              }`}
                              title={disabled ? "Cannot edit past month's expenses" : "Edit Expense"}
                            >
                              <span className="material-symbols-rounded text-sm block">edit</span>
                            </button>
                            <button
                              onClick={() => openDeleteModal(exp)}
                              disabled={disabled}
                              className={`p-1.5 rounded-lg border transition-all ${
                                disabled 
                                  ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:text-[#E11D48] hover:border-[#E11D48]/20 cursor-pointer shadow-2xs hover:shadow-xs'
                              }`}
                              title={disabled ? "Cannot delete past month's expenses" : "Delete Expense"}
                            >
                              <span className="material-symbols-rounded text-sm block">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
          <div className="w-full space-y-2">
            {/* Grid Calendar Headers */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] sm:text-xs font-extrabold text-[#64748B] uppercase tracking-wider mb-2">
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
                <div key={`empty-${idx}`} className="aspect-square h-auto sm:aspect-[4/3] sm:h-auto bg-slate-50/30 border border-dashed border-slate-100 rounded-xl"></div>
              ))}

              {calendarDays.map((d, index) => {
                const hasExpense = d.total > 0;
                return (
                  <div
                    key={index}
                    onClick={() => {
                      if (hasExpense) {
                        setDetailDay(d);
                      }
                    }}
                    className={`aspect-square h-auto sm:aspect-[4/3] sm:h-auto flex flex-col justify-between p-1 sm:p-2.5 lg:p-3 rounded-xl border relative group transition-all duration-150 shadow-2xs hover:shadow-xs ${
                      hasExpense ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                    } ${
                      hasExpense 
                        ? 'bg-red-50/5 border-red-200/50 text-red-600'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    {/* Top Row: Day Number + Dots indicators */}
                    <div className="flex justify-between items-start w-full min-h-[14px]">
                      <span className="text-[10px] sm:text-xs lg:text-lg xl:text-xl font-black text-[#0F172A]">{d.day}</span>
                      
                      {/* Dots for Expense Types */}
                      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                        {Array.from(d.types).map((type, tIdx) => {
                          let dotColor = 'bg-slate-400';
                          if (type === 'Saving Balance') dotColor = 'bg-blue-500';
                          if (type === 'Loan Balance') dotColor = 'bg-purple-500';
                          if (type === 'Individual') dotColor = 'bg-amber-500';
                          return (
                            <span
                              key={tIdx}
                              className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                              title={type}
                            ></span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Middle/Bottom: Display Amount */}
                    <div className="text-center w-full pb-0.5">
                      {hasExpense && (
                        <span className="text-[8.5px] sm:text-xs lg:text-base xl:text-lg font-black block tracking-tight text-[#E11D48]">
                          ₹{d.total.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Day Details Modal (Calendar Day Click) */}
      {detailDay && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setDetailDay(null)}>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#0F172A]">Expenses for Date</h3>
                <span className="text-xs font-semibold text-slate-500">
                  {new Date(detailDay.dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={() => setDetailDay(null)}
                className="w-8 h-8 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-rounded text-lg">close</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {detailDay.items.map((exp) => {
                const disabled = isPreviousMonth(exp.entry_date);
                return (
                  <div key={exp.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        {exp.expense_type === 'Saving Balance' && (
                          <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-md text-[9px] font-bold">
                            Savings
                          </span>
                        )}
                        {exp.expense_type === 'Loan Balance' && (
                          <span className="px-2 py-0.5 bg-purple-50 border border-purple-100 text-purple-600 rounded-md text-[9px] font-bold">
                            Loan
                          </span>
                        )}
                        {exp.expense_type === 'Individual' && (
                          <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-600 rounded-md text-[9px] font-bold">
                            Individual
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-semibold">By: {exp.entered_by_name || 'System'}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700">{exp.remarks || 'No remarks'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-[#E11D48]">{inr(exp.amount)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setDetailDay(null);
                            openEditModal(exp);
                          }}
                          disabled={disabled}
                          className={`p-1 rounded-lg border transition-all ${
                            disabled
                              ? 'bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                              : 'bg-white border-slate-200 text-slate-600 hover:text-[#0A3598] cursor-pointer'
                          }`}
                        >
                          <span className="material-symbols-rounded text-sm block">edit</span>
                        </button>
                        <button
                          onClick={() => {
                            setDetailDay(null);
                            openDeleteModal(exp);
                          }}
                          disabled={disabled}
                          className={`p-1 rounded-lg border transition-all ${
                            disabled
                              ? 'bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                              : 'bg-white border-slate-200 text-slate-600 hover:text-[#E11D48] cursor-pointer'
                          }`}
                        >
                          <span className="material-symbols-rounded text-sm block">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleAddSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-base font-extrabold text-[#0F172A]">Add New Expense</h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-rounded text-lg">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl">
                  {formError}
                </div>
              )}

              {/* Select Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Expense Type *</label>
                <Select
                  options={[
                    { value: 'Saving Balance', label: 'Saving Balance' },
                    { value: 'Loan Balance', label: 'Loan Balance' },
                    { value: 'Individual', label: 'Individual' }
                  ]}
                  value={formType}
                  onChange={setFormType}
                  searchable={false}
                />
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="E.g., 500.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                />
              </div>

              {/* Date */}
              <div className="space-y-1">
                <DatePicker
                  label="Expense Date *"
                  required={true}
                  value={formDate}
                  onChange={setFormDate}
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Remarks</label>
                <textarea
                  placeholder="Provide brief details about the expense..."
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  rows="3"
                  className="w-full p-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all resize-none"
                ></textarea>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="flex-1 h-10 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-[#E2E8F0] text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-10 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleEditSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-base font-extrabold text-[#0F172A]">Edit Expense</h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-rounded text-lg">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl">
                  {formError}
                </div>
              )}

              {/* Select Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Expense Type *</label>
                <Select
                  options={[
                    { value: 'Saving Balance', label: 'Saving Balance' },
                    { value: 'Loan Balance', label: 'Loan Balance' },
                    { value: 'Individual', label: 'Individual' }
                  ]}
                  value={formType}
                  onChange={setFormType}
                  searchable={false}
                />
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="E.g., 500.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full h-11 px-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all"
                />
              </div>

              {/* Date */}
              <div className="space-y-1">
                <DatePicker
                  label="Expense Date *"
                  required={true}
                  value={formDate}
                  onChange={setFormDate}
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Remarks</label>
                <textarea
                  placeholder="Provide brief details about the expense..."
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  rows="3"
                  className="w-full p-3.5 bg-white border border-[#E2E8F0] hover:border-slate-300 focus:border-[#0A3598] focus:ring-1 focus:ring-[#0A3598] rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all resize-none"
                ></textarea>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="flex-1 h-10 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-[#E2E8F0] text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-10 bg-[#0A3598] hover:bg-[#0A3598]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-rounded text-2xl">delete_forever</span>
              </div>
              <h3 className="text-base font-extrabold text-[#0F172A]">Delete Expense</h3>
              <p className="text-xs text-slate-500 font-semibold mt-1.5 leading-relaxed">
                Are you sure you want to delete this expense of <strong>{inr(selectedExpense?.amount)}</strong>? This action cannot be undone and will revert any cash book transaction.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsDeleteOpen(false)}
                className="flex-1 h-10 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 rounded-xl border border-[#E2E8F0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteSubmit}
                className="flex-1 h-10 bg-[#DC2626] hover:bg-[#DC2626]/90 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
