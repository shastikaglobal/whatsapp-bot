import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { 
  Users, 
  Box, 
  MessageSquareText, 
  Sparkles, 
  ArrowRight, 
  Radio, 
  Bot, 
  Calendar, 
  Workflow, 
  ShieldCheck,
  CheckCircle2,
  PhoneCall
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ customers: 0, products: 0, messages: 0 });
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        setRecentCustomers(Array.isArray(custRes.data) ? custRes.data.slice(0, 5) : []);
      } catch (err) {
        console.error('Error fetching dashboard stats', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* Top Galaxy Hero Banner */}
      <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden border border-indigo-500/25 bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-slate-900/90 shadow-[0_12px_40px_rgba(3,7,18,0.7)] backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 rounded-full bg-purple-500/15 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wider uppercase shadow-[0_0_12px_rgba(99,102,241,0.2)]">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
              Shastika AI Agro Export Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-300 to-teal-200">{sessionStorage.getItem('shastika_name') || 'Administrator'}</span>
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Your autonomous WhatsApp sales & fresh produce export assistant is actively monitoring buyer enquiries, classifying RFQs, and executing smart BDE handovers.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            <button
              onClick={() => navigate('/inbox')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all flex items-center gap-2"
            >
              <MessageSquareText className="w-4 h-4" /> Open WhatsApp Inbox
            </button>
            <button
              onClick={() => navigate('/customers')}
              className="px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 font-semibold text-sm transition-all flex items-center gap-2"
            >
              <Users className="w-4 h-4" /> View Customers
            </button>
          </div>
        </div>

        {/* Live Engine Status Strip */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
            <span>Meta WhatsApp API: <strong className="text-white font-semibold">Connected</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
            <span>Gemini AI Engine: <strong className="text-white font-semibold">Active</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]"></span>
            <span>BDE Auto-Assign: <strong className="text-white font-semibold">Round-Robin</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-[0_0_8px_#2dd4bf]"></span>
            <span>Database Status: <strong className="text-white font-semibold">Healthy</strong></span>
          </div>
        </div>
      </div>

      {/* 3 Galaxy Hero Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Customers */}
        <div 
          onClick={() => navigate('/customers')}
          className="card-pro stat-hover p-6 flex flex-col justify-between cursor-pointer group"
        >
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/15 rounded-full blur-2xl group-hover:scale-150 transition-transform pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] group-hover:scale-105 transition-transform">
              <Users className="w-7 h-7" />
            </div>
            <span className="text-xs text-slate-400 group-hover:text-emerald-400 flex items-center gap-1 transition-colors">
              Explore <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
          
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Total Customers</div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              {stats.customers}
            </div>
            <div className="text-xs text-emerald-400/90 font-medium flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Global buyers & enquiries captured
            </div>
          </div>
        </div>

        {/* Total Products */}
        <div 
          onClick={() => navigate('/products')}
          className="card-pro stat-hover p-6 flex flex-col justify-between cursor-pointer group"
        >
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-500/15 rounded-full blur-2xl group-hover:scale-150 transition-transform pointer-events-none"></div>

          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)] group-hover:scale-105 transition-transform">
              <Box className="w-7 h-7" />
            </div>
            <span className="text-xs text-slate-400 group-hover:text-cyan-400 flex items-center gap-1 transition-colors">
              Catalog <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Total Products</div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              {stats.products}
            </div>
            <div className="text-xs text-cyan-400/90 font-medium flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5">
              <Sparkles className="w-3.5 h-3.5" /> Agro export knowledge base active
            </div>
          </div>
        </div>

        {/* Total Conversations */}
        <div 
          onClick={() => navigate('/inbox')}
          className="card-pro stat-hover p-6 flex flex-col justify-between cursor-pointer group"
        >
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-purple-500/15 rounded-full blur-2xl group-hover:scale-150 transition-transform pointer-events-none"></div>

          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.25)] group-hover:scale-105 transition-transform">
              <MessageSquareText className="w-7 h-7" />
            </div>
            <span className="text-xs text-slate-400 group-hover:text-purple-400 flex items-center gap-1 transition-colors">
              Open Chats <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Total Conversations</div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              {stats.messages}
            </div>
            <div className="text-xs text-purple-400/90 font-medium flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5">
              <Radio className="w-3.5 h-3.5" /> Live automated WhatsApp sessions
            </div>
          </div>
        </div>

      </div>

      {/* Cosmic Quick Command Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Launchpad */}
        <div className="card-pro p-6 flex flex-col justify-between lg:col-span-1 space-y-4">
          <div>
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" /> Command Shortcuts
            </h3>
            <p className="text-xs text-slate-400">Quickly jump to core export management tools.</p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => navigate('/inbox')}
              className="w-full p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 flex items-center justify-between text-left group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <MessageSquareText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-200 group-hover:text-white">WhatsApp Inbox</div>
                  <div className="text-[11px] text-slate-400">Live replies & human handover</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => navigate('/customers')}
              className="w-full p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 flex items-center justify-between text-left group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-200 group-hover:text-white">Customer CRM</div>
                  <div className="text-[11px] text-slate-400">Buyer leads & assigned BDEs</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => navigate('/products')}
              className="w-full p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 flex items-center justify-between text-left group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Box className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-200 group-hover:text-white">Product Catalog</div>
                  <div className="text-[11px] text-slate-400">Export pricing, MOQ, produce facts</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => navigate('/holidays')}
              className="w-full p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 flex items-center justify-between text-left group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-200 group-hover:text-white">Holiday Rules</div>
                  <div className="text-[11px] text-slate-400">Out-of-office automated replies</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>

        {/* Recent Customer Enquiries Preview */}
        <div className="card-pro p-6 flex flex-col justify-between lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> Recent Buyer Connections
              </h3>
              <p className="text-xs text-slate-400">Latest active leads captured by the WhatsApp engine.</p>
            </div>
            <button
              onClick={() => navigate('/customers')}
              className="text-xs text-cyan-400 hover:underline font-semibold flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">Phone</th>
                  <th className="pb-3 font-semibold">Intent</th>
                  <th className="pb-3 font-semibold">Assigned BDE</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No recent customers recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-semibold text-slate-200">
                        {cust.name || 'Anonymous Buyer'}
                      </td>
                      <td className="py-3 text-slate-400 font-mono">
                        {cust.phone}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          cust.intent === 'Human Request' 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {cust.intent || 'General'}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300">
                        {cust.assigned_bde_name ? (
                          <span className="text-emerald-400 font-medium">{cust.assigned_bde_name}</span>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => navigate('/inbox')}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-medium transition-colors"
                        >
                          Chat
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
