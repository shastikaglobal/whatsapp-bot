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
    '/': { title: 'Dashboard Overview', icon: LayoutDashboard, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    '/inbox': { title: 'WhatsApp Inbox', icon: MessageSquareText, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    '/customers': { title: 'Customers', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    '/products': { title: 'Product Knowledge', icon: Package, color: 'text-purple-600', bg: 'bg-purple-100' },
    '/holidays': { title: 'Holiday Rules', icon: Calendar, color: 'text-rose-600', bg: 'bg-rose-100' },
    '/rules': { title: 'Auto-Reply Rules', icon: Workflow, color: 'text-amber-600', bg: 'bg-amber-100' },
    '/settings': { title: 'AI Settings', icon: Settings, color: 'text-slate-600', bg: 'bg-slate-200' },
    '/whatsapp': { title: 'WhatsApp API', icon: MessageSquareText, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    '/analytics': { title: 'Analytics', icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    '/employees': { title: 'Employees', icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-100' },
    '/app-settings': { title: 'App Settings', icon: Settings, color: 'text-slate-600', bg: 'bg-slate-200' },
  };

  const currentMeta = pageMeta[location.pathname] || { title: 'Dashboard', icon: LayoutDashboard, color: 'text-slate-600', bg: 'bg-slate-100' };
  const Icon = currentMeta.icon;

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
        
        {/* Subtle top decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-slate-200/50 to-transparent pointer-events-none z-0"></div>

        <header className="glass-nav-header flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 focus:outline-none transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${currentMeta.bg} ${currentMeta.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none mb-1">{currentMeta.title}</h1>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Shastika AI Workspace</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100">
               <Bell className="w-5 h-5" />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
             </button>
             <div className="h-8 w-px bg-slate-200 mx-1"></div>
             <div className="flex items-center gap-3 cursor-pointer group">
               <div className="text-right hidden sm:block">
                 <div className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{sessionStorage.getItem('shastika_name') || 'User'}</div>
                 <div className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">{sessionStorage.getItem('shastika_role') || 'Role'}</div>
               </div>
               <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-md flex items-center justify-center text-white font-bold text-sm ring-2 ring-white">
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
