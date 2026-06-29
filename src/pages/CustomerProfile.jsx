import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customerApi } from '../services/api';

export default function CustomerProfile() {
  const { id } = useParams();

  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('kyc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    customerApi.profile(id)
      .then(res => {
        const data = res.data;
        // Build tabs dynamically from accounts
        const tabs = [];
        (data.loan_accounts || []).forEach(la => {
          tabs.push({ id: `loan_${la.loan_account_no}`, name: `Loan (${la.loan_account_no})`, icon: 'credit_score', accountNo: la.loan_account_no, accountType: 'Loan', account: la });
        });
        (data.saving_accounts || []).forEach(sa => {
          tabs.push({ id: `saving_${sa.saving_account_no}`, name: `Saving (${sa.saving_account_no})`, icon: 'savings', accountNo: sa.saving_account_no, accountType: 'Saving', account: sa });
        });
        tabs.push({ id: 'kyc', name: 'KYC & Documents', icon: 'badge' });
        if ((data.loan_accounts || []).length > 0) {
          tabs.push({ id: 'guarantor', name: 'Guarantor Details', icon: 'group' });
        }
        data.tabs = tabs;
        setCustomer(data);
        setActiveTab(tabs[0]?.id || 'kyc');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-secondary-text text-sm">
      <span className="material-symbols-rounded animate-spin mr-2 select-none">progress_activity</span>
      Loading customer profile...
    </div>
  );

  if (!customer) return (
    <div className="flex items-center justify-center py-20 text-danger-fin text-sm">Customer not found.</div>
  );

  const tabs = customer.tabs || [];
  const hasLoanAccount = (customer.loan_accounts || []).length > 0;
  const activeTabData = tabs.find(t => t.id === activeTab);

  // Helper: Initials from name
  const initials = (name = '') => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Customer Hero summary */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="w-20 h-20 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-2xl">
          {initials(customer.full_name)}
        </div>
        <div className="flex-1 text-center md:text-left space-y-1">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <h2 className="text-xl font-bold text-[#0F172A]">{customer.full_name}</h2>
            <span className="bg-[#1E3A8A]/5 text-[#1E3A8A] text-[10px] font-bold px-2 py-0.5 rounded-full inline-block w-fit mx-auto md:mx-0">
              {customer.status || 'Active Customer'}
            </span>
          </div>
          <p className="text-xs text-[#64748B]">{customer.address}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 text-xs text-[#64748B] pt-1">
            <span className="flex items-center gap-1">
              <span className="material-symbols-rounded text-sm select-none">phone</span> {customer.mobile}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-rounded text-sm select-none">domain</span> {customer.branch_name}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-rounded text-sm select-none">support_agent</span> {customer.agent_name}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-[#64748B] space-y-1">
          <p className="font-bold text-[#0F172A] text-sm">{customer.customer_no}</p>
          <p>ID: #{customer.id}</p>
          <p className="capitalize">{customer.occupation}</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[#E2E8F0] overflow-x-auto space-x-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#1E3A8A] text-[#1E3A8A]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <span className="material-symbols-rounded text-sm select-none">{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm">

        {/* Loan / Saving Account Tab */}
        {activeTabData && (activeTabData.accountType === 'Loan' || activeTabData.accountType === 'Saving') && (() => {
          const acc = activeTabData.account;
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-[#E2E8F0]">
                <div className="p-3 bg-[#F8FAFC] rounded-xl">
                  <span className="text-[10px] text-[#64748B] block mb-0.5">{activeTabData.accountType === 'Loan' ? 'Loan Plan' : 'Savings Plan'}</span>
                  <span className="text-xs font-bold text-[#0F172A]">{acc.plan_name}</span>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-xl">
                  <span className="text-[10px] text-[#64748B] block mb-0.5">{activeTabData.accountType === 'Loan' ? 'Principal Amount' : 'Total Deposited'}</span>
                  <span className="text-xs font-bold text-[#1E3A8A]">₹{Number(acc.principal_amount || acc.total_deposited || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-xl">
                  <span className="text-[10px] text-[#64748B] block mb-0.5">{activeTabData.accountType === 'Loan' ? 'Total Paid' : 'Interest Earned'}</span>
                  <span className="text-xs font-bold text-[#16A34A]">₹{Number(acc.total_paid || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-xl">
                  <span className="text-[10px] text-[#64748B] block mb-0.5">{activeTabData.accountType === 'Loan' ? 'Outstanding Balance' : 'Maturity Date'}</span>
                  <span className="text-xs font-bold text-[#E11D48]">
                    {activeTabData.accountType === 'Loan'
                      ? `₹${Number(acc.outstanding_amount || 0).toLocaleString('en-IN')}`
                      : acc.maturity_date || 'N/A'
                    }
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-4 border-t border-[#E2E8F0] mt-2">
                <p className="text-xs text-[#64748B]">
                  Account Status: <span className="font-bold text-[#0F172A]">{acc.account_status}</span>
                  &nbsp;|&nbsp; Collection Frequency: <span className="font-bold text-[#0F172A] capitalize">{acc.collection_frequency}</span>
                </p>
                <Link
                  to={`/account/${activeTabData.accountNo}`}
                  className="text-xs text-[#1E3A8A] font-bold hover:underline"
                >
                  View Full Ledger &amp; Calendar →
                </Link>
              </div>
            </div>
          );
        })()}

        {/* KYC Tab */}
        {activeTab === 'kyc' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[#E2E8F0] p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Aadhaar Details</span>
                <div className="flex justify-between text-xs">
                  <span>Aadhaar Number:</span>
                  <span className="font-bold">{customer.aadhaar_no || 'Not Provided'}</span>
                </div>
                {customer.aadhaar_front_url && (
                  <div className="flex gap-2 pt-2">
                    <a href={customer.aadhaar_front_url} target="_blank" rel="noreferrer" className="flex-1 border border-[#E2E8F0] p-2 bg-[#F8FAFC] rounded-lg text-center text-[10px] text-[#1E3A8A] font-semibold cursor-pointer hover:bg-[#1E3A8A]/5 transition-all">
                      Download Aadhaar Front
                    </a>
                    {customer.aadhaar_back_url && (
                      <a href={customer.aadhaar_back_url} target="_blank" rel="noreferrer" className="flex-1 border border-[#E2E8F0] p-2 bg-[#F8FAFC] rounded-lg text-center text-[10px] text-[#1E3A8A] font-semibold cursor-pointer hover:bg-[#1E3A8A]/5 transition-all">
                        Download Aadhaar Back
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="border border-[#E2E8F0] p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">PAN Details</span>
                <div className="flex justify-between text-xs">
                  <span>PAN Number:</span>
                  <span className="font-bold">{customer.pan_no || 'Not Provided'}</span>
                </div>
                {customer.pan_url && (
                  <div className="pt-2">
                    <a href={customer.pan_url} target="_blank" rel="noreferrer" className="block border border-[#E2E8F0] p-2 bg-[#F8FAFC] rounded-lg text-center text-[10px] text-[#1E3A8A] font-semibold cursor-pointer hover:bg-[#1E3A8A]/5 transition-all">
                      Download PAN Image
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-[#E2E8F0] p-4 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">Bank Account Details</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                <div>
                  <span className="text-[#64748B] block mb-0.5">Bank Name:</span>
                  <span className="font-bold text-[#0F172A]">{customer.bank_name || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Account Number:</span>
                  <span className="font-bold text-[#0F172A]">{customer.bank_account_no || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">IFSC Code:</span>
                  <span className="font-bold text-[#0F172A]">{customer.bank_ifsc || 'Not Provided'}</span>
                </div>
              </div>
            </div>

            <div className="border border-[#E2E8F0] p-4 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">Personal Information</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                <div>
                  <span className="text-[#64748B] block mb-0.5">Date of Birth:</span>
                  <span className="font-bold text-[#0F172A]">{customer.dob || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Gender:</span>
                  <span className="font-bold text-[#0F172A]">{customer.gender || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Occupation:</span>
                  <span className="font-bold text-[#0F172A]">{customer.occupation || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Father's Name:</span>
                  <span className="font-bold text-[#0F172A]">{customer.father_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Monthly Income:</span>
                  <span className="font-bold text-[#0F172A]">₹{Number(customer.monthly_income || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Alternate Mobile:</span>
                  <span className="font-bold text-[#0F172A]">{customer.alt_mobile || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Guarantor Tab */}
        {activeTab === 'guarantor' && (
          <div className="space-y-6">
            {customer.guarantors && customer.guarantors.length > 0 ? (
              customer.guarantors.map((g, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[#64748B]">Guarantor Name:</span>
                      <span className="font-bold text-[#0F172A]">{g.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[#64748B]">Mobile Number:</span>
                      <span className="font-bold text-[#0F172A]">{g.mobile}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[#64748B]">Relation:</span>
                      <span className="font-bold text-[#0F172A]">{g.relation}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[#64748B]">Aadhaar Number:</span>
                      <span className="font-bold text-[#0F172A]">{g.aadhaar_no || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[#64748B]">Address:</span>
                      <span className="font-bold text-[#0F172A]">{g.address || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-secondary-text text-sm">No guarantor information recorded.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
