import React, { useState, useRef, useEffect } from 'react';

export function Select({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select...',
  label = '',
  searchable = true,
  required = false,
  compact = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openUp, setOpenUp] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 260 && spaceAbove > spaceBelow) {
        setOpenUp(true);
      } else {
        setOpenUp(false);
      }

      setTimeout(() => {
        wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = searchable
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const handleSelect = (val) => {
    if (onChange) onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative ${compact ? 'w-auto min-w-[140px] shrink-0' : 'w-full'} text-left`} ref={wrapperRef}>
      {label && (
        <label className="block text-xs font-bold text-secondary-text mb-1.5 uppercase tracking-wider">
          {label} {required && <span className="text-danger-fin">*</span>}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-surface border border-border-fin hover:border-[#1E3A8A]/30 rounded-xl text-primary-text focus:outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/10 transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98] ${
          compact ? 'px-3.5 py-2 text-xs font-bold' : 'px-4 py-3 text-sm font-medium'
        }`}
      >
        <span className={selectedOption ? 'text-primary-text font-bold' : 'text-secondary-text'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="material-symbols-rounded text-sm text-secondary-text select-none ml-2">
          {isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        </span>
      </button>

      {isOpen && (
        <div className={`absolute z-50 w-full bg-surface border border-border-fin rounded-xl shadow-xl max-h-60 overflow-y-auto transition-all duration-200 ${
          openUp ? 'bottom-full mb-1.5 origin-bottom animate-scale-up' : 'top-full mt-1.5 origin-top animate-[scaleIn_0.2s_ease-out]'
        }`}>
          {searchable && (
            <div className="p-2 border-b border-border-fin sticky top-0 bg-surface z-10">
              <div className="relative flex items-center">
                <span className="material-symbols-rounded absolute left-3 text-sm text-secondary-text pointer-events-none select-none">
                  search
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 bg-background-fin border border-border-fin rounded-lg text-xs font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-4 py-2.5 text-xs transition-colors duration-150 flex items-center justify-between font-bold cursor-pointer ${
                    opt.value === value
                      ? 'bg-primary text-surface'
                      : 'text-primary-text hover:bg-background-fin'
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && (
                    <span className="material-symbols-rounded text-sm text-accent select-none">
                      check_circle
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-xs text-secondary-text text-center font-bold">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

