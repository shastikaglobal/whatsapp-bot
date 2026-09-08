import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Users, Box, MessageSquareText } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ customers: 0, products: 0, messages: 0 });

  useEffect(() => {
    async function fetchData() {
      try {
        const [custRes, prodRes, convRes] = await Promise.all([
          api.get('/customers'),
          api.get('/products'),
          api.get('/conversations')
        ]);
        setStats({
          customers: custRes.data.length || 0,
          products: prodRes.data.length || 0,
          messages: convRes.data.length || 0,
        });
      } catch (err) {
        console.error('Error fetching dashboard stats', err);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="card-pro stat-hover p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Customers</div>
            <div className="text-2xl font-bold text-slate-900">{stats.customers}</div>
          </div>
        </div>

        <div className="card-pro stat-hover p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Products</div>
            <div className="text-2xl font-bold text-slate-900">{stats.products}</div>
          </div>
        </div>

        <div className="card-pro stat-hover p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <MessageSquareText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Conversations</div>
            <div className="text-2xl font-bold text-slate-900">{stats.messages}</div>
          </div>
        </div>

      </div>
    </div>
  );
}
