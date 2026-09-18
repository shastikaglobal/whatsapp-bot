import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Edit, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';

export default function Employees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', username: '', password: '', role: 'BDE', status: 'Active' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        showToast('You do not have permission to view employees', 'error');
      }
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.put(`/employees/${formData.id}`, formData);
        showToast('Employee updated', 'success');
      } else {
        await api.post('/employees', formData);
        showToast('Employee added', 'success');
      }
      setIsModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save employee', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      showToast('Employee deleted', 'success');
      fetchEmployees();
    } catch (err) {
      showToast('Failed to delete employee', 'error');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.put(`/employees/${id}/status`, { status });
      showToast('Status updated', 'success');
      fetchEmployees();
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const openModal = (emp?: any) => {
    if (emp) {
      setFormData({ ...emp, password: '' });
    } else {
      setFormData({ id: '', name: '', username: '', password: '', role: 'BDE', status: 'Active' });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {toast && (
        <div className={`toast-banner ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employee Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage Admins and Business Development Executives (BDEs).</p>
        </div>
        <button onClick={() => openModal()} className="btn-save-primary flex items-center gap-2">
          <Plus className="w-5 h-5" /> Add Employee
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Name</th>
              <th className="p-4 font-bold">Username</th>
              <th className="p-4 font-bold">Role</th>
              <th className="p-4 font-bold">Status</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-slate-800">{emp.name}</div>
                </td>
                <td className="p-4 text-slate-600">{emp.username}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-max ${
                    emp.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    <Shield className="w-3 h-3" /> {emp.role}
                  </span>
                </td>
                <td className="p-4">
                  <select
                    value={emp.status}
                    onChange={(e) => handleStatusChange(emp.id, e.target.value)}
                    className={`border-0 rounded-lg font-bold text-xs p-1 cursor-pointer focus:ring-0 ${
                      emp.status === 'Active' ? 'text-emerald-700 bg-emerald-100' :
                      emp.status === 'On Leave' ? 'text-amber-700 bg-amber-100' : 'text-rose-700 bg-rose-100'
                    }`}
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </td>
                <td className="p-4 flex items-center justify-end gap-2">
                  <button onClick={() => openModal(emp)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(emp.id)} disabled={emp.username === 'admin'} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">No employees found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg">{formData.id ? 'Edit Employee' : 'Add Employee'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <AlertCircle className="w-5 h-5 opacity-0" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Username</label>
                <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Password {formData.id && '(Leave blank to keep current)'}</label>
                <input required={!formData.id} type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Role</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="BDE">BDE</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
