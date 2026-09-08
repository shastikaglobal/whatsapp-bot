import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Menu } from 'lucide-react';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const titleMap: Record<string, string> = {
    '/': 'Dashboard Overview',
    '/inbox': 'WhatsApp Inbox',
    '/customers': 'Customers',
    '/products': 'Product Knowledge',
    '/holidays': 'Holiday Rules',
    '/rules': 'Auto-Reply Rules',
    '/settings': 'Bot Settings',
  };

  const currentTitle = titleMap[location.pathname] || 'Dashboard';

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <header className="glass-nav-header flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 focus:outline-none"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{currentTitle}</h1>
          </div>
          {/* User profile / actions can go here */}
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 bg-slate-200 rounded-full border border-slate-300"></div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
