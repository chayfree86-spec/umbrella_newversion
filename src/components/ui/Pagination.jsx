import React from 'react';

export function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);
      
      if (start === 1) {
        end = maxVisible;
      } else if (end === totalPages) {
        start = totalPages - maxVisible + 1;
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between border-t border-slate-100 pt-5 px-4 mt-6">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="relative inline-flex items-center px-4 py-2 border border-border-fin text-sm font-semibold rounded-xl text-primary-text bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-border-fin text-sm font-semibold rounded-xl text-primary-text bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-secondary-text uppercase tracking-wider text-[#64748B]">
            Page <span className="font-bold text-primary-text">{currentPage}</span> of{' '}
            <span className="font-bold text-primary-text">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-xl -space-x-px gap-1.5" aria-label="Pagination">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => onPageChange(1)}
              className="relative inline-flex items-center px-2.5 py-2 rounded-xl border border-border-fin bg-white text-sm font-semibold text-secondary-text hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="First Page"
            >
              <span className="material-symbols-rounded text-base select-none">first_page</span>
            </button>
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="relative inline-flex items-center px-2.5 py-2 rounded-xl border border-border-fin bg-white text-sm font-semibold text-secondary-text hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Previous Page"
            >
              <span className="material-symbols-rounded text-base select-none">chevron_left</span>
            </button>
            
            {getPageNumbers().map((page) => (
              <button
                type="button"
                key={page}
                onClick={() => onPageChange(page)}
                className={`relative inline-flex items-center px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  currentPage === page
                    ? 'z-10 bg-primary border-primary text-white shadow-md shadow-primary/10'
                    : 'bg-white border-border-fin text-primary-text hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="relative inline-flex items-center px-2.5 py-2 rounded-xl border border-border-fin bg-white text-sm font-semibold text-secondary-text hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Next Page"
            >
              <span className="material-symbols-rounded text-base select-none">chevron_right</span>
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(totalPages)}
              className="relative inline-flex items-center px-2.5 py-2 rounded-xl border border-border-fin bg-white text-sm font-semibold text-secondary-text hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Last Page"
            >
              <span className="material-symbols-rounded text-base select-none">last_page</span>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
