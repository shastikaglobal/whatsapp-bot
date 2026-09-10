import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquareText, 
  Users, 
  Package, 
  Calendar, 
  Workflow, 
  Settings, 
  Sliders, 
  BarChart3,
  Power
} from 'lucide-react';
import clsx from 'clsx';
import api from '../api/axios';

export default function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/system/sidebar-stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch sidebar stats', err);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const toggleGlobalBot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!stats) return;
    const newState = !stats.botActive;
    try {
      await api.put('/settings', { auto_reply_enabled: newState ? 'true' : 'false' });
      setStats({ ...stats, botActive: newState, aiRepliesOn: newState });
    } catch (err) {
      console.error('Failed to toggle bot', err);
    }
  };

  const coreSuite = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'WhatsApp Inbox', path: '/inbox', icon: MessageSquareText, badge: 'Live' },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Products', path: '/products', icon: Package },
  ];

  const automationEngine = [
    { name: 'Auto Reply', path: '/rules', icon: Workflow },
    { name: 'Holidays', path: '/holidays', icon: Calendar },
    { name: 'AI Settings', path: '/settings', icon: Sliders },
    { name: 'WhatsApp API', path: '/whatsapp', icon: MessageSquareText },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Settings', path: '/app-settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <aside className={clsx(
        "bg-dark-sidebar border-r border-slate-800/80 text-slate-300 flex flex-col shrink-0 select-none z-50",
        "fixed inset-y-0 left-0 w-64 transform transition-transform duration-300 md:relative md:translate-x-0 shadow-2xl",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-tight">Shastika AI</span>
              <span className="text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">PRO</span>
            </div>
            <span className="text-xs text-slate-400 font-medium truncate w-40">WhatsApp Global Impex</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
          {/* Core Suite */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3 px-1">Core Suite</div>
            {coreSuite.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) => clsx('nav-link-item', isActive ? 'nav-link-active' : 'nav-link-inactive')}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{item.name}</span>
                  {item.badge && (
                    <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Automation & Engine */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-3 px-1">Automation & Engine</div>
            {automationEngine.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) => clsx('nav-link-item', isActive ? 'nav-link-active' : 'nav-link-inactive')}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Bot Overview Panel */}
        {stats && (
          <div className="px-4 pb-4">
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col gap-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Bot Overview</span>
                <button 
                  onClick={toggleGlobalBot}
                  className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${stats.botActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400 hover:text-emerald-400'}`}
                  title={stats.botActive ? "Disable AI Bot globally" : "Enable AI Bot globally"}
                >
                  <Power className="w-3 h-3" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stats.botActive ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                  <span className="text-slate-300">AI Bot <span className="text-slate-500">—</span> <span className={stats.botActive ? 'text-emerald-400 font-medium' : 'text-slate-400'}>{stats.botActive ? 'Active' : 'Disabled'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stats.whatsappConnected ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                  <span className="text-slate-300">WhatsApp <span className="text-slate-500">—</span> <span className={stats.whatsappConnected ? 'text-emerald-400 font-medium' : 'text-rose-400'}>{stats.whatsappConnected ? 'Connected' : 'Not Setup'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">🤖</span>
                  <span className="text-slate-300">AI Replies <span className="text-slate-500">—</span> <span className={stats.aiRepliesOn ? 'text-blue-400 font-medium' : 'text-slate-400'}>{stats.aiRepliesOn ? 'ON' : 'OFF'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">💬</span>
                  <span className="text-slate-300">Auto Reply Rules <span className="text-slate-500">—</span> <span className={stats.autoReplyRulesOn ? 'text-blue-400 font-medium' : 'text-slate-400'}>{stats.autoReplyRulesOn ? 'ON' : 'OFF'}</span></span>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-slate-700/50">
                <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2 block">Today</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center p-1.5 bg-slate-800/60 rounded">
                    <span className="text-sm font-bold text-slate-200">{stats.today.messages}</span>
                    <span className="text-[9px] text-slate-400">Msgs</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-slate-800/60 rounded">
                    <span className="text-sm font-bold text-blue-400">{stats.today.aiReplies}</span>
                    <span className="text-[9px] text-slate-400">AI</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-slate-800/60 rounded">
                    <span className="text-sm font-bold text-emerald-400">{stats.today.newCustomers}</span>
                    <span className="text-[9px] text-slate-400">Cust</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Meta Cloud API Widget */}
        <div className="p-4 border-t border-slate-800/50 mt-auto">
          <div 
            onClick={() => {
              setIsOpen(false);
              navigate('/whatsapp');
            }}
            className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="flex flex-col">
                 <span className="text-xs font-semibold text-slate-200">Meta Cloud API</span>
                 <span className="text-[10px] text-emerald-400 font-medium">Webhook Connected</span>
              </div>
            </div>
            <Settings className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </aside>
    </>
  );
}
