import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Edit2, Trash2, X } from 'lucide-react';
import api from '../api/axios';
import ConfirmModal from '../components/ConfirmModal';

interface Holiday {
  id: string;
  name: string;
  date: string;
  enabled: boolean;
}

export default function Holidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [enabled, setEnabled] = useState(true);

  const fetchHolidays = async () => {
    try {
      const res = await api.get('/holidays');
      setHolidays(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    setName('');
    setDate('');
    setEnabled(true);
    setShowModal(true);
  };

  const handleEdit = (h: Holiday) => {
    setEditingId(h.id);
    setName(h.name);
    // Format date for <input type="date"> (YYYY-MM-DD)
    setDate(new Date(h.date).toISOString().split('T')[0]);
    setEnabled(h.enabled);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingId) {
        await api.put(`/holidays/${editingId}`, {
          name,
          date,
          enabled: enabled ? 1 : 0
        });
      } else {
        await api.post('/holidays', {
          id: Date.now().toString(),
          name,
          date,
          enabled: enabled ? 1 : 0
        });
      }
      setShowModal(false);
      setName('');
      setDate('');
      setEnabled(true);
      setEditingId(null);
      fetchHolidays();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Holiday Rules</h2>
          <p className="text-sm text-slate-500 mt-1">Manage dates when your business is closed to trigger out-of-office auto-replies.</p>
        </div>
        <button 
          onClick={handleAdd}
          className="btn-save-primary whitespace-nowrap bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
        >
          <Plus className="w-4 h-4" /> Add Holiday
        </button>
      </div>

      {holidays.length === 0 ? (
        <div className="panel-card bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 m-6">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">No holidays configured</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
              You haven't set up any holiday rules yet. Add a holiday to automatically notify customers when you're away.
            </p>
            <button 
              onClick={handleAdd}
              className="pill-button bg-white shadow-sm hover:shadow-md px-6 py-2.5 border border-slate-200 rounded-full text-emerald-600 font-medium flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" /> Create First Holiday
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase">Holiday Name</th>
                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase">Date</th>
                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.map(h => (
                <tr key={h.id} className="hover:bg-slate-50/50">
                  <td className="py-4 px-6 font-medium text-slate-900">{h.name}</td>
                  <td className="py-4 px-6 text-slate-600">{new Date(h.date).toLocaleDateString()}</td>
                  <td className="py-4 px-6">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${h.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {h.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button 
                      onClick={() => handleEdit(h)}
                      className="text-slate-400 hover:text-blue-600 mr-3 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setConfirmConfig({
                          title: 'Delete Holiday',
                          message: `Are you sure you want to delete ${h.name}?`,
                          onConfirm: () => {
                            setHolidays(prev => prev.filter(item => item.id !== h.id));
                          }
                        });
                      }}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Holiday Rule' : 'Add Holiday Rule'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Holiday Name</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Christmas Day"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input 
                  type="date" 
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="enabled"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                  Enable Auto-Reply for this holiday
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : (editingId ? 'Save Changes' : 'Save Holiday')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmConfig}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
        confirmText="Delete"
      />
    </div>
  );
}
