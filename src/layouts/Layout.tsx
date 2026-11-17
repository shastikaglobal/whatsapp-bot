import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { 
  Menu, 
  LayoutDashboard, 
  MessageSquareText, 
  Users, 
  Package, 
  Calendar, 
  Workflow, 
  Settings,
  BarChart3,
  Bell,
  UserCheck
} from 'lucide-react';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  
  const pageMeta: Record<string, { title: string, icon: any, color: string, bg: string }> = {
    '/': { title: 'Dashboard Overview', icon: LayoutDashboard, color: 'text-indigo-300', bg: 'bg-indigo-500/20 border-indigo-400/30 shadow-[0_0_15px_rgba(99,102,241,0.25)]' },
    '/inbox': { title: 'WhatsApp Inbox', icon: MessageSquareText, color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-400/30 shadow-[0_0_15px_rgba(16,185,129,0.25)]' },
    '/customers': { title: 'Customers', icon: Users, color: 'text-cyan-300', bg: 'bg-cyan-500/20 border-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]' },
    '/products': { title: 'Product Knowledge', icon: Package, color: 'text-purple-300', bg: 'bg-purple-500/20 border-purple-400/30 shadow-[0_0_15px_rgba(168,85,247,0.25)]' },
    '/holidays': { title: 'Holiday Rules', icon: Calendar, color: 'text-rose-300', bg: 'bg-rose-500/20 border-rose-400/30 shadow-[0_0_15px_rgba(244,63,94,0.25)]' },
    '/rules': { title: 'Auto-Reply Rules', icon: Workflow, color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-400/30 shadow-[0_0_15px_rgba(245,158,11,0.25)]' },
    '/settings': { title: 'AI Settings', icon: Settings, color: 'text-violet-300', bg: 'bg-violet-500/20 border-violet-400/30 shadow-[0_0_15px_rgba(139,92,246,0.25)]' },
    '/whatsapp': { title: 'WhatsApp API', icon: MessageSquareText, color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-400/30 shadow-[0_0_15px_rgba(16,185,129,0.25)]' },
    '/analytics': { title: 'Analytics', icon: BarChart3, color: 'text-sky-300', bg: 'bg-sky-500/20 border-sky-400/30 shadow-[0_0_15px_rgba(14,165,233,0.25)]' },
    '/employees': { title: 'Employees', icon: UserCheck, color: 'text-teal-300', bg: 'bg-teal-500/20 border-teal-400/30 shadow-[0_0_15px_rgba(20,184,166,0.25)]' },
    '/app-settings': { title: 'App Settings', icon: Settings, color: 'text-slate-300', bg: 'bg-slate-500/20 border-slate-400/30 shadow-[0_0_15px_rgba(148,163,184,0.25)]' },
  };

  const currentMeta = pageMeta[location.pathname] || { title: 'Dashboard', icon: LayoutDashboard, color: 'text-slate-300', bg: 'bg-slate-500/20 border-slate-400/30' };
  const Icon = currentMeta.icon;

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
        
        {/* Subtle top ambient nebula glow below main bar */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-indigo-950/20 via-slate-100/40 to-transparent pointer-events-none z-0"></div>

        {/* Galaxy Main Bar Header */}
        <header className="glass-nav-header flex items-center justify-between shrink-0 overflow-hidden">
          {/* Ambient starlight shimmer overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.035] pointer-events-none"></div>
          {/* Bottom cosmic glowing beam */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 via-purple-500/50 to-transparent pointer-events-none"></div>

          <div className="flex items-center gap-4 relative z-10">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg focus:outline-none transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border backdrop-blur-md ${currentMeta.bg} ${currentMeta.color}`}>
                <Icon className="w-5 h-5 drop-shadow-[0_0_8px_currentColor]" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-white tracking-tight leading-none mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">{currentMeta.title}</h1>
                <span className="text-[11px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#22d3ee]"></span>
                  Shastika AI Workspace
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 relative z-10">
             <button 
               className="relative p-2.5 text-slate-300 hover:text-white transition-all rounded-full bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 shadow-[0_0_12px_rgba(0,0,0,0.3)] hover:shadow-[0_0_12px_rgba(139,92,246,0.3)]"
               title="Notifications"
             >
               <Bell className="w-4 h-4" />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-900 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
             </button>
             <div className="h-8 w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent mx-1"></div>
             <div className="flex items-center gap-3 cursor-pointer group">
               <div className="text-right hidden sm:block">
                 <div className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors drop-shadow-sm">
                   {sessionStorage.getItem('shastika_name') || 'User'}
                 </div>
                 <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.2)] inline-block mt-0.5">
                   {sessionStorage.getItem('shastika_role') || 'Role'}
                 </div>
               </div>
               <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 rounded-xl shadow-[0_0_18px_rgba(139,92,246,0.5)] flex items-center justify-center text-white font-extrabold text-sm ring-2 ring-indigo-400/40 group-hover:ring-cyan-400/70 transition-all">
                 {(sessionStorage.getItem('shastika_name') || 'U').charAt(0).toUpperCase()}
               </div>
             </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
