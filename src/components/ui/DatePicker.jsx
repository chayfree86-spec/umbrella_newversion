import React, { useState, useRef, useEffect } from 'react';

const formatDateString = (year, month, day) => {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

export function DatePicker({
  value = '',
  onChange,
  label = '',
  required = false,
  placeholder = 'Select Date',
  isDob = false,
  ...props
}) {
  const isDobPicker = isDob || (label && (label.toLowerCase().includes('birth') || label.toLowerCase().includes('dob')));
  const currentFullYear = new Date().getFullYear();

  // Parse current value or use today
  const initialDate = value ? new Date(value) : new Date();
  
  const getDayFromValue = () => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d.getDate();
      }
    }
    return 1;
  };

  // Cap initial year for DOB picker between (currentFullYear - 70) and (currentFullYear - 15)
  const getInitialYear = () => {
    const yr = initialDate.getFullYear();
    if (isDobPicker) {
      if (yr > currentFullYear - 15) return currentFullYear - 15;
      if (yr < currentFullYear - 70) return currentFullYear - 70;
    }
    return yr;
  };

  const getInputValueString = (val) => {
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
    }
    return val;
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [yearSearch, setYearSearch] = useState('');
  
  const [currentYear, setCurrentYear] = useState(getInitialYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState(getDayFromValue());
  const [inputValue, setInputValue] = useState('');

  const wrapperRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  // Sync input value with external value prop
  useEffect(() => {
    if (value) {
      setInputValue(getInputValueString(value));
    } else {
      setInputValue('');
    }
  }, [value]);

  // Auto-open month list when calendar is opened (only for DOB picker)
  useEffect(() => {
    if (isOpen) {
      if (isDobPicker) {
        setIsMonthOpen(true);
        setIsYearOpen(false);
      } else {
        setIsMonthOpen(false);
        setIsYearOpen(false);
      }
      setSelectedDay(getDayFromValue());
    } else {
      setIsMonthOpen(false);
      setIsYearOpen(false);
      setYearSearch('');
    }
  }, [isOpen, isDobPicker]);

  const handleInputChange = (e) => {
    let raw = e.target.value.replace(/[^0-9]/g, ''); // Keep only digits
    if (raw.length > 8) {
      raw = raw.substring(0, 8); // Cap at 8 digits (DDMMYYYY)
    }

    // Auto format as DD-MM-YYYY
    let formatted = '';
    if (raw.length > 0) {
      formatted += raw.substring(0, 2);
    }
    if (raw.length > 2) {
      formatted += '-' + raw.substring(2, 4);
    }
    if (raw.length > 4) {
      formatted += '-' + raw.substring(4, 8);
    }

    setInputValue(formatted);

    // If fully typed (10 characters, e.g. DD-MM-YYYY)
    if (formatted.length === 10) {
      const parts = formatted.split('-');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-11
      const year = parseInt(parts[2], 10);

      // Simple validation
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        // Year cap validation for DOB
        const maxYear = isDobPicker ? currentFullYear - 15 : currentFullYear + 5;
        const minYear = isDobPicker ? currentFullYear - 70 : currentFullYear - 15;
        
        if (year >= minYear && year <= maxYear) {
          const dateStr = formatDateString(year, month, day);
          if (onChange) onChange(dateStr);
          setCurrentYear(year);
          setCurrentMonth(month);
          setSelectedDay(day);
        }
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsOpen(false);
      
      const focusableSelector = 'input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [contenteditable]';
      const focusables = Array.from(document.querySelectorAll(focusableSelector));
      const myIndex = focusables.indexOf(e.target);
      if (myIndex > -1) {
        let nextEl = null;
        for (let i = myIndex + 1; i < focusables.length; i++) {
          const el = focusables[i];
          if (wrapperRef.current && !wrapperRef.current.contains(el)) {
            nextEl = el;
            break;
          }
        }
        if (nextEl) {
          nextEl.focus();
          if (nextEl.select) nextEl.select();
        }
      }
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsMonthOpen(false);
        setIsYearOpen(false);
        setYearSearch('');
      }
      if (monthRef.current && !monthRef.current.contains(event.target)) {
        setIsMonthOpen(false);
      }
      if (yearRef.current && !yearRef.current.contains(event.target)) {
        setIsYearOpen(false);
        setYearSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      setTimeout(() => {
        wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isOpen]);

  // Sync state if value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const yr = d.getFullYear();
        if (isDobPicker) {
          if (yr > currentFullYear - 15) {
            setCurrentYear(currentFullYear - 15);
          } else if (yr < currentFullYear - 70) {
            setCurrentYear(currentFullYear - 70);
          } else {
            setCurrentYear(yr);
          }
        } else {
          setCurrentYear(yr);
        }
        setCurrentMonth(d.getMonth());
      }
    }
  }, [value, isDobPicker, currentFullYear]);

  // If DOB picker and currentYear is somehow in restricted range, cap it
  useEffect(() => {
    if (isDobPicker) {
      if (currentYear > currentFullYear - 15) {
        setCurrentYear(currentFullYear - 15);
      } else if (currentYear < currentFullYear - 70) {
        setCurrentYear(currentFullYear - 70);
      }
    }
  }, [isDobPicker, currentYear, currentFullYear]);

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleDayClick = (day) => {
    setSelectedDay(day);
    if (isDobPicker) {
      setIsYearOpen(true);
      setIsMonthOpen(false);
    } else {
      const dateStr = formatDateString(currentYear, currentMonth, day);
      if (onChange) onChange(dateStr);
      setIsOpen(false);
    }
  };

  // Helper to get days in month
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper to get start day of week (0 = Sunday)
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const startDayOfWeek = getFirstDayOfMonth(currentYear, currentMonth);

  // Generate days grid array
  const daysArray = [];
  // Previous month padding
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    daysArray.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      year: prevYear,
      month: prevMonth
    });
  }
  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    daysArray.push({
      day: i,
      isCurrentMonth: true,
      year: currentYear,
      month: currentMonth
    });
  }
  // Next month padding to keep 6 rows grid (42 items)
  const totalGridCells = 42;
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  const nextPadding = totalGridCells - daysArray.length;
  for (let i = 1; i <= nextPadding; i++) {
    daysArray.push({
      day: i,
      isCurrentMonth: false,
      year: nextYear,
      month: nextMonth
    });
  }

  // Prev/Next month handlers
  const handlePrevMonth = () => {
    const minAllowedYear = isDobPicker ? currentFullYear - 70 : currentFullYear - 15;
    if (currentMonth === 0) {
      if (currentYear - 1 >= minAllowedYear) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      }
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    const maxAllowedYear = isDobPicker ? currentFullYear - 15 : currentFullYear + 5;
    if (currentMonth === 11) {
      if (currentYear + 1 <= maxAllowedYear) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      }
    } else {
      if (currentYear < maxAllowedYear || (currentYear === maxAllowedYear && currentMonth < 11)) {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  // Formatted date string for input display (e.g. 28 Jun 2026)
  const getDisplayValue = () => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const day = String(d.getDate()).padStart(2, '0');
    const monthName = monthsList[d.getMonth()].substring(0, 3);
    const year = d.getFullYear();
    return `${day} ${monthName} ${year}`;
  };

  const todayStr = formatDateString(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  // Generate Year Range
  const yearsRange = [];
  if (isDobPicker) {
    const maxYear = currentFullYear - 15;
    const minYear = currentFullYear - 70;
    for (let yr = maxYear; yr >= minYear; yr--) {
      yearsRange.push(yr);
    }
  } else {
    const maxYear = currentFullYear + 5;
    const minYear = currentFullYear - 15;
    for (let yr = maxYear; yr >= minYear; yr--) {
      yearsRange.push(yr);
    }
  }

  const filteredYears = yearsRange.filter(yr =>
    String(yr).includes(yearSearch)
  );

  // Check if date is disabled (future or >15 years for DOB)
  const isDateDisabled = (year, month, day) => {
    if (isDobPicker) {
      const maxAllowedYear = currentFullYear - 15;
      const minAllowedYear = currentFullYear - 70;
      if (year > maxAllowedYear || year < minAllowedYear) return true;
    }
    return false;
  };

  return (
    <div className="relative w-full text-left" ref={wrapperRef}>
      {label && (
        <label className="block text-xs font-bold text-secondary-text mb-1.5 uppercase tracking-wider">
          {label} {required && <span className="text-danger-fin">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <span className="material-symbols-rounded absolute left-4 text-sm text-secondary-text pointer-events-none select-none z-10">
          calendar_today
        </span>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder="DD-MM-YYYY"
          maxLength={10}
          className="w-full pl-11 pr-4 py-3 bg-surface border border-border-fin rounded-xl text-sm font-semibold text-primary-text placeholder-secondary-text/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 shadow-sm"
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 bg-surface border border-border-fin rounded-2xl shadow-xl p-4 w-80 transform origin-top transition-all duration-200 left-0 md:left-auto">
          {/* Calendar Header */}
          <div className="flex justify-between items-center mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-lg hover:bg-background-fin flex items-center justify-center text-secondary-text hover:text-primary-text cursor-pointer border border-border-fin/50"
            >
              <span className="material-symbols-rounded text-base">chevron_left</span>
            </button>

            <div className="flex items-center gap-1.5 relative">
              {/* Custom Month Dropdown */}
              <div className="relative" ref={monthRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsMonthOpen(!isMonthOpen);
                    setIsYearOpen(false);
                  }}
                  className="bg-slate-50 hover:bg-slate-100 border border-border-fin/80 px-2.5 py-1.5 rounded-lg text-primary-text font-bold text-xs flex items-center gap-0.5 transition-all duration-150 active:scale-95 cursor-pointer"
                >
                  {monthsList[currentMonth]}
                  <span className="material-symbols-rounded text-base select-none leading-none text-secondary-text">arrow_drop_down</span>
                </button>
                
                {isMonthOpen && (
                  <div className="absolute top-full left-0 mt-1 z-[60] bg-white border border-border-fin rounded-xl shadow-lg max-h-48 overflow-y-auto w-32 py-1 scrollbar-thin">
                    {monthsList.map((m, idx) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setCurrentMonth(idx);
                          setIsMonthOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                          idx === currentMonth
                            ? 'bg-primary text-white'
                            : 'text-primary-text hover:bg-slate-50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Year Dropdown */}
              <div className="relative" ref={yearRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsYearOpen(!isYearOpen);
                    setIsMonthOpen(false);
                  }}
                  className="bg-slate-50 hover:bg-slate-100 border border-border-fin/80 px-2.5 py-1.5 rounded-lg text-primary-text font-bold text-xs flex items-center gap-0.5 transition-all duration-150 active:scale-95 cursor-pointer"
                >
                  {currentYear}
                  <span className="material-symbols-rounded text-base select-none leading-none text-secondary-text">arrow_drop_down</span>
                </button>
                
                {isYearOpen && (
                  <div className="absolute top-full left-0 mt-1 z-[60] bg-white border border-border-fin rounded-xl shadow-lg w-32 flex flex-col overflow-hidden max-h-56">
                    <div className="p-1.5 border-b border-border-fin sticky top-0 bg-white z-10">
                      <input
                        type="text"
                        value={yearSearch}
                        onChange={(e) => setYearSearch(e.target.value)}
                        placeholder="Search Year..."
                        className="w-full px-2 py-1 bg-slate-50 border border-border-fin rounded-md text-[10px] font-bold focus:outline-none focus:border-primary/50"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto py-1 max-h-40 scrollbar-thin">
                      {filteredYears.map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            setCurrentYear(yr);
                            setIsYearOpen(false);
                            setYearSearch('');
                            const dayToUse = selectedDay || getDayFromValue();
                            const dateStr = formatDateString(yr, currentMonth, dayToUse);
                            if (onChange) onChange(dateStr);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                            yr === currentYear
                              ? 'bg-primary text-white'
                              : 'text-primary-text hover:bg-slate-50'
                          }`}
                        >
                          {yr}
                        </button>
                      ))}
                      {filteredYears.length === 0 && (
                        <span className="text-[10px] font-bold text-secondary-text block text-center py-2">No years</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-lg hover:bg-background-fin flex items-center justify-center text-secondary-text hover:text-primary-text cursor-pointer border border-[#E2E8F0]"
            >
              <span className="material-symbols-rounded text-base">chevron_right</span>
            </button>
          </div>

          {/* Calendar Grid Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[10px] font-extrabold text-secondary-text/60 uppercase">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-1">
            {daysArray.map((cell, idx) => {
              const cellDateStr = formatDateString(cell.year, cell.month, cell.day);
              const isSelected = value === cellDateStr;
              const isSelectedDay = selectedDay === cell.day && cell.isCurrentMonth;
              const isToday = todayStr === cellDateStr;
              const isDisabled = isDateDisabled(cell.year, cell.month, cell.day);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => !isDisabled && handleDayClick(cell.day)}
                  disabled={isDisabled}
                  className={`aspect-square rounded-lg text-[11px] font-bold transition-all flex items-center justify-center cursor-pointer relative ${
                    cell.isCurrentMonth
                      ? isSelected || isSelectedDay
                        ? 'bg-primary text-surface shadow-sm font-black ring-2 ring-primary/20 scale-105'
                        : isDisabled
                        ? 'text-secondary-text/30 cursor-not-allowed bg-slate-50/50'
                        : 'text-primary-text hover:bg-background-fin'
                      : isDisabled
                      ? 'text-secondary-text/20 cursor-not-allowed bg-slate-50/30'
                      : 'text-secondary-text/40 hover:bg-background-fin/50'
                  } ${isToday && !(isSelected || isSelectedDay) ? 'border border-accent text-accent font-extrabold' : ''}`}
                >
                  {cell.day}
                  {isToday && !(isSelected || isSelectedDay) && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-accent"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
