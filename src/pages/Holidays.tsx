import React from 'react';
import { Plus, Calendar } from 'lucide-react';

export default function Holidays() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Holiday Rules</h2>
          <p className="text-sm text-slate-500 mt-1">Manage dates when your business is closed to trigger out-of-office auto-replies.</p>
        </div>
        <button className="btn-save-primary whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add Holiday
        </button>
      </div>

      <div className="panel-card">
        <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No holidays configured</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            You haven't set up any holiday rules yet. Add a holiday to automatically notify customers when you're away.
          </p>
          <button className="pill-button bg-white shadow-sm hover:shadow-md px-6 py-2.5">
            <Plus className="w-4 h-4 text-brand-600" /> Create First Holiday
          </button>
        </div>
      </div>
    </div>
  );
}
