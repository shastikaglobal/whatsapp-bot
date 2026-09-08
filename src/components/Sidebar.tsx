import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquareText, 
  Users, 
  Package, 
  Calendar, 
  Workflow, 
  Settings, 
  Sliders, 
  BarChart3
} from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
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

        {/* Footer Meta Cloud API Widget */}
        <div className="p-4 border-t border-slate-800/50">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between hover:bg-slate-800/60 transition-colors cursor-pointer">
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
