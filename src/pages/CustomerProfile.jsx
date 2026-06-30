import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customerApi, branchApi, areaApi, agentApi } from '../services/api';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';

export default function CustomerProfile() {
  const { id } = useParams();

  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('kyc');
  const [loading, setLoading] = useState(true);

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [agents, setAgents] = useState([]);
  const [editForm, setEditForm] = useState({
    full_name: '',
    mobile: '',
    alternate_mobile: '',
    dob: '',
    gender: 'Male',
    father_or_husband_name: '',
    occupation: '',
    monthly_income: '',
    branch_id: '',
    area_id: '',
    agent_id: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    aadhaar_no: '',
    pan_no: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: ''
  });

  const fetchCustomerProfile = () => {
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
        if (!activeTab || activeTab === 'kyc') {
          setActiveTab(tabs[0]?.id || 'kyc');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomerProfile();
  }, [id]);

  useEffect(() => {
    branchApi.list().then(res => setBranches(res.data || [])).catch(() => {});
    areaApi.list().then(res => setAreas(res.data || [])).catch(() => {});
    agentApi.list().then(res => setAgents(res.data || [])).catch(() => {});
  }, []);

  const openEditModal = () => {
    setEditForm({
      full_name: customer.full_name || '',
      mobile: customer.mobile || '',
      alternate_mobile: customer.alternate_mobile || '',
      dob: customer.dob || '',
      gender: customer.gender || 'Male',
      father_or_husband_name: customer.father_or_husband_name || '',
      occupation: customer.occupation || '',
      monthly_income: customer.monthly_income || '',
      branch_id: customer.branch_id || '',
      area_id: customer.area_id || '',
      agent_id: customer.agent_id || '',
      address: customer.addresses?.[0]?.address_line1 || '',
      city: customer.addresses?.[0]?.city || '',
      state: customer.addresses?.[0]?.state || '',
      pincode: customer.addresses?.[0]?.pincode || '',
      aadhaar_no: customer.kyc?.aadhaar_no || '',
      pan_no: customer.kyc?.pan_no || '',
      bank_name: customer.kyc?.bank_name || '',
      bank_account_no: customer.kyc?.bank_account_no || '',
      bank_ifsc: customer.kyc?.bank_ifsc || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    if (!editForm.full_name || !editForm.mobile || !editForm.branch_id || !editForm.area_id || !editForm.agent_id) {
      alert("Please fill in all required fields (Name, Mobile, Branch, Area, Agent).");
      return;
    }
    customerApi.update(customer.id, editForm)
      .then(() => {
        alert("Customer profile updated successfully.");
        setIsEditModalOpen(false);
        fetchCustomerProfile();
      })
      .catch(err => {
        alert(err.message || 'Profile update failed.');
      });
  };

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

  const permAddr = (customer.addresses || []).find(a => a.address_type === 'Permanent') || (customer.addresses || [])[0];
  const fullAddress = permAddr 
    ? `${permAddr.address_line1}${permAddr.address_line2 ? ', ' + permAddr.address_line2 : ''}, ${permAddr.city}, ${permAddr.state} - ${permAddr.pincode}`
    : 'N/A';

  return (
    <div className="space-y-6">
      {/* Customer Hero summary */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="w-20 h-20 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-2xl">
          {initials(customer.full_name)}
        </div>
        <div className="flex-1 text-center md:text-left space-y-1 w-full">
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
            <h2 className="text-xl font-bold text-[#0F172A]">{customer.full_name}</h2>
            <span className="bg-[#1E3A8A]/5 text-[#1E3A8A] text-[10px] font-bold px-2 py-0.5 rounded-full inline-block w-fit mx-auto md:mx-0">
              {customer.status || 'Active Customer'}
            </span>
            <button
              onClick={openEditModal}
              className="md:ml-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#0F172A] hover:text-[#1E3A8A] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-rounded text-sm">edit</span>
              Edit Profile
            </button>
          </div>
          <p className="text-xs text-[#64748B]">{fullAddress}</p>
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
                  <span className="font-bold">{customer.kyc?.aadhaar_no || 'Not Provided'}</span>
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
                  <span className="font-bold">{customer.kyc?.pan_no || 'Not Provided'}</span>
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
                  <span className="font-bold text-[#0F172A]">{customer.kyc?.bank_name || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Account Number:</span>
                  <span className="font-bold text-[#0F172A]">{customer.kyc?.bank_account_no || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">IFSC Code:</span>
                  <span className="font-bold text-[#0F172A]">{customer.kyc?.bank_ifsc || 'Not Provided'}</span>
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
                  <span className="font-bold text-[#0F172A]">{customer.father_or_husband_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Monthly Income:</span>
                  <span className="font-bold text-[#0F172A]">₹{Number(customer.monthly_income || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-0.5">Alternate Mobile:</span>
                  <span className="font-bold text-[#0F172A]">{customer.alternate_mobile || 'N/A'}</span>
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

      {/* Edit Profile Modal */}
      {isEditModalOpen && (() => {
        const branchOptions = branches.map(b => ({ value: b.id, label: b.name }));
        const areaOptions = areas.map(a => ({ value: a.id, label: a.name }));
        const agentOptions = agents.map(ag => ({ value: ag.id, label: ag.name }));
        const genderOptions = [
          { value: 'Male', label: 'Male' },
          { value: 'Female', label: 'Female' },
          { value: 'Other', label: 'Other' }
        ];

        return (
          <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto animate-scale-up">
              <div className="flex justify-between items-center border-b border-[#F1F5F9] pb-4">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="material-symbols-rounded text-lg text-[#1E3A8A] select-none">edit_document</span>
                  Edit Customer Profile
                </h3>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer transition-all"
                >
                  <span className="material-symbols-rounded text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {/* Section 1: Personal Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">Personal Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Full Name *</label>
                      <input 
                        type="text" 
                        required
                        value={editForm.full_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Mobile Number *</label>
                      <input 
                        type="text" 
                        required
                        value={editForm.mobile}
                        onChange={(e) => setEditForm(prev => ({ ...prev, mobile: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Alternate Mobile</label>
                      <input 
                        type="text" 
                        value={editForm.alternate_mobile}
                        onChange={(e) => setEditForm(prev => ({ ...prev, alternate_mobile: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Father's Name</label>
                      <input 
                        type="text" 
                        value={editForm.father_or_husband_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, father_or_husband_name: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                    <div className="sm:col-span-2">
                      <DatePicker 
                        label="Date of Birth"
                        value={editForm.dob}
                        onChange={(val) => setEditForm(prev => ({ ...prev, dob: val }))}
                      />
                    </div>
                    <div>
                      <Select 
                        label="Gender"
                        options={genderOptions}
                        value={editForm.gender}
                        onChange={(val) => setEditForm(prev => ({ ...prev, gender: val }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Occupation</label>
                      <input 
                        type="text" 
                        value={editForm.occupation}
                        onChange={(e) => setEditForm(prev => ({ ...prev, occupation: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Monthly Income (₹)</label>
                      <input 
                        type="number" 
                        value={editForm.monthly_income}
                        onChange={(e) => setEditForm(prev => ({ ...prev, monthly_income: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Branch, Area & Agent */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">Branch & Area Assignment</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Select 
                      label="Branch *"
                      options={branchOptions}
                      value={Number(editForm.branch_id)}
                      onChange={(val) => setEditForm(prev => ({ ...prev, branch_id: val }))}
                    />
                    <Select 
                      label="Area *"
                      options={areaOptions}
                      value={Number(editForm.area_id)}
                      onChange={(val) => setEditForm(prev => ({ ...prev, area_id: val }))}
                    />
                    <Select 
                      label="Agent *"
                      options={agentOptions}
                      value={Number(editForm.agent_id)}
                      onChange={(val) => setEditForm(prev => ({ ...prev, agent_id: val }))}
                    />
                  </div>
                </div>

                {/* Section 3: Address */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">Residential Address</h4>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Address Line 1</label>
                    <input 
                      type="text" 
                      value={editForm.address}
                      onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">City</label>
                      <input 
                        type="text" 
                        value={editForm.city}
                        onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">State</label>
                      <input 
                        type="text" 
                        value={editForm.state}
                        onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Pincode</label>
                      <input 
                        type="text" 
                        value={editForm.pincode}
                        onChange={(e) => setEditForm(prev => ({ ...prev, pincode: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: KYC & Bank */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">KYC & Bank Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Aadhaar Number</label>
                      <input 
                        type="text" 
                        value={editForm.aadhaar_no}
                        onChange={(e) => setEditForm(prev => ({ ...prev, aadhaar_no: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">PAN Number</label>
                      <input 
                        type="text" 
                        value={editForm.pan_no}
                        onChange={(e) => setEditForm(prev => ({ ...prev, pan_no: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Bank Name</label>
                      <input 
                        type="text" 
                        value={editForm.bank_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bank_name: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">Bank Account Number</label>
                      <input 
                        type="text" 
                        value={editForm.bank_account_no}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bank_account_no: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase tracking-wider">IFSC Code</label>
                      <input 
                        type="text" 
                        value={editForm.bank_ifsc}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bank_ifsc: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t border-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center shadow-sm"
                  >
                    Save Profile Details
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
