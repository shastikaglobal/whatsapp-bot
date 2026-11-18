import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  BellRing, 
  Volume2, 
  VolumeX, 
  Phone, 
  UserCheck, 
  MessageSquare, 
  ExternalLink, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  Edit2, 
  Save, 
  X,
  Sparkles
} from 'lucide-react';
import api from '../api/axios';

interface HandoverNotification {
  conversation_id: string;
  customer_id: string;
  conversation_status: string;
  requires_admin_attention: boolean;
  updated_at: string;
  customer_name: string;
  customer_phone: string;
  intent?: string;
  is_important?: boolean;
  assigned_bde_id?: string;
  assigned_bde_name?: string;
  last_message?: string;
  last_message_time?: string;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HandoverNotification[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [alertNumbers, setAlertNumbers] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  
  // Audio state (stored in localStorage)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('shastika_handover_sound');
    return saved !== null ? saved === 'true' : true;
  });

  // Browser desktop notification permission
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const knownCustomerIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const navigate = useNavigate();

  // Play synthesized dual-tone chime (Web Audio API - no external file dependency)
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Cosmic chime: 880Hz (A5) then 1320Hz (E6)
      playTone(880, 0, 0.16);
      playTone(1320, 0.12, 0.32);
    } catch (e) {
      console.warn('[Sound] Web Audio alert failed:', e);
    }
  };

  // Request browser desktop notification permission
  const handleRequestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        setDesktopPermission(res);
        if (res === 'granted') {
          new Notification('🔔 Notifications Enabled', {
            body: 'You will receive desktop alerts when customers request human assistance.',
            icon: '/favicon.ico'
          });
        }
      } catch (err) {
        console.warn('Could not request notification permission:', err);
      }
    }
  };

  // Fire desktop notification for a new human request
  const fireDesktopNotification = (item: HandoverNotification) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`🚨 Human Request: ${item.customer_name || 'Customer'}`, {
          body: item.last_message || `Customer (${item.customer_phone}) requested human / BDE assistance`,
          icon: '/favicon.ico',
          tag: `handover_${item.customer_id}`
        });
        notif.onclick = () => {
          window.focus();
          navigate(`/inbox?customerId=${item.customer_id}`);
          setIsOpen(false);
        };
      } catch (e) {
        console.warn('Desktop notification error:', e);
      }
    }
  };

  // Fetch pending human handover notifications
  const fetchNotifications = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await api.get('/notifications/handover');
      const data = res.data;
      const list: HandoverNotification[] = data.notifications || [];
      const newCount = data.count || list.length;
      
      setNotifications(list);
      setCount(newCount);
      if (data.alertNumbers !== undefined) {
        setAlertNumbers(data.alertNumbers);
        if (!isEditingPhone) {
          setPhoneInput(data.alertNumbers);
        }
      }

      // Check if there are newly arrived human requests
      if (!isFirstLoadRef.current) {
        let hasNewRequest = false;
        list.forEach(item => {
          if (!knownCustomerIdsRef.current.has(item.customer_id)) {
            hasNewRequest = true;
            knownCustomerIdsRef.current.add(item.customer_id);
            fireDesktopNotification(item);
          }
        });

        if (hasNewRequest && soundEnabled) {
          playNotificationChime();
        }
      } else {
        // Cold start - record existing IDs without buzzing
        list.forEach(item => knownCustomerIdsRef.current.add(item.customer_id));
        isFirstLoadRef.current = false;
      }
    } catch (err) {
      console.warn('Failed to fetch handover notifications:', err);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  // Save WhatsApp Alert Phone Number
  const handleSavePhone = async () => {
    setIsSavingPhone(true);
    try {
      const res = await api.post('/notifications/alert-number', { alertNumbers: phoneInput });
      if (res.data.success) {
        setAlertNumbers(res.data.alertNumbers || phoneInput);
        setIsEditingPhone(false);
      }
    } catch (err) {
      console.error('Failed to update alert numbers:', err);
    } finally {
      setIsSavingPhone(false);
    }
  };

  // Dismiss a notification (clears requires_admin_attention flag)
  const handleDismiss = async (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post('/notifications/dismiss', { customerId });
      setNotifications(prev => prev.filter(n => n.customer_id !== customerId));
      setCount(prev => Math.max(0, prev - 1));
      knownCustomerIdsRef.current.delete(customerId);
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  // Navigate to conversation in Inbox
  const handleOpenConversation = (customerId: string) => {
    setIsOpen(false);
    navigate(`/inbox?customerId=${customerId}`);
  };

  // Toggle sound setting
  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    localStorage.setItem('shastika_handover_sound', String(nextState));
    if (nextState) {
      playNotificationChime();
    }
  };

  // Polling setup (every 6 seconds)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 6000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format relative timestamp
  const formatTimeAgo = (timestamp?: string) => {
    if (!timestamp) return 'Recently';
    try {
      const diffMs = Date.now() - new Date(timestamp).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return `${Math.floor(diffHr / 24)}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`relative p-2.5 rounded-full transition-all duration-300 ${
          count > 0 
            ? 'text-rose-200 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/50 shadow-[0_0_18px_rgba(244,63,94,0.45)]' 
            : 'text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 shadow-[0_0_12px_rgba(0,0,0,0.3)] hover:shadow-[0_0_12px_rgba(139,92,246,0.3)]'
        }`}
        title={count > 0 ? `${count} Pending Human Request(s)` : 'Notifications'}
      >
        {count > 0 ? (
          <BellRing className="w-4 h-4 text-rose-400 animate-[bounce_2s_infinite]" />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {/* Counter Badge with Pulse Glow */}
        {count > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-[10px] font-black text-white shadow-[0_0_10px_rgba(244,63,94,0.8)] border border-slate-900 animate-pulse">
              {count > 99 ? '99+' : count}
            </span>
            <span className="absolute -top-1 -right-1 flex h-5 w-5 rounded-full bg-rose-400 opacity-60 animate-ping"></span>
          </>
        )}
      </button>

      {/* Galaxy Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-indigo-500/30 shadow-[0_15px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(99,102,241,0.2)] overflow-hidden z-50 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  Human Requests
                  {count > 0 && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {count} active
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">Live customer handover alerts</p>
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="flex items-center gap-1">
              {/* Sound alert toggle */}
              <button
                onClick={toggleSound}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  soundEnabled 
                    ? 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20' 
                    : 'text-slate-400 bg-slate-800 border-slate-700 hover:text-slate-200'
                }`}
                title={soundEnabled ? 'Chime Alert Enabled (Click to Mute)' : 'Sound Alert Muted (Click to Unmute)'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
              </button>

              {/* Desktop Browser Notification Toggle */}
              {desktopPermission !== 'granted' && (
                <button
                  onClick={handleRequestPermission}
                  className="px-2 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-semibold hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                  title="Enable desktop notifications"
                >
                  <Sparkles className="w-3 h-3" />
                  Enable Push
                </button>
              )}

              {/* Refresh Button */}
              <button
                onClick={() => fetchNotifications(true)}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Refresh notifications"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* WhatsApp Alert Phone Setup Banner */}
          <div className="px-4 py-2.5 bg-indigo-950/30 border-b border-indigo-500/20 text-xs">
            {!isEditingPhone ? (
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-1.5 truncate">
                  <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-slate-400">WhatsApp Alert Number:</span>
                  <span className="font-mono text-emerald-300 font-semibold text-[11px] truncate">
                    {alertNumbers ? alertNumbers : '(Not configured)'}
                  </span>
                </div>
                <button
                  onClick={() => setIsEditingPhone(true)}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] font-medium flex items-center gap-1 hover:underline shrink-0 ml-2"
                >
                  <Edit2 className="w-3 h-3" />
                  {alertNumbers ? 'Change' : 'Set'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Set WhatsApp Notification Number
                  </span>
                  <button onClick={() => setIsEditingPhone(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="e.g. 919876543210"
                    className="flex-1 px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    onClick={handleSavePhone}
                    disabled={isSavingPhone}
                    className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-medium rounded-lg text-xs hover:from-emerald-500 hover:to-teal-400 transition-all flex items-center gap-1 disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    {isSavingPhone ? '...' : 'Save'}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500">
                  Multiple numbers can be separated with a comma.
                </span>
              </div>
            )}
          </div>

          {/* Notification Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 max-h-96">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-3 shadow-[0_0_15px_rgba(0,0,0,0.4)]">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 mb-1">All Caught Up!</h4>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  No customers are currently waiting for human handover. Bot is managing conversations smoothly.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.customer_id}
                  onClick={() => handleOpenConversation(item.customer_id)}
                  className="p-3.5 hover:bg-slate-800/50 cursor-pointer transition-colors group relative"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    {/* Customer Info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500/20 to-purple-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 font-bold text-xs shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                        {(item.customer_name || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
                            {item.customer_name || 'Customer'}
                          </span>
                          <span className="text-[10px] font-semibold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded-full shrink-0">
                            Human Request
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 text-slate-500" />
                          +{item.customer_phone}
                        </span>
                      </div>
                    </div>

                    {/* Timestamp & Dismiss */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-500">
                        {formatTimeAgo(item.last_message_time || item.updated_at)}
                      </span>
                      <button
                        onClick={(e) => handleDismiss(item.customer_id, e)}
                        className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-700/50 rounded transition-colors"
                        title="Dismiss alert"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Last Message Snippet */}
                  {item.last_message && (
                    <div className="text-xs text-slate-300 bg-slate-950/60 rounded-lg p-2 border border-slate-800/80 mb-2 line-clamp-2 font-normal italic">
                      "{item.last_message}"
                    </div>
                  )}

                  {/* Footer Bar: Assigned BDE & Reply Button */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <div className="flex items-center gap-1 text-slate-400">
                      <UserCheck className="w-3 h-3 text-cyan-400" />
                      <span>
                        {item.assigned_bde_name ? (
                          <span className="text-cyan-300 font-medium">{item.assigned_bde_name}</span>
                        ) : (
                          <span className="text-amber-400/90 font-medium">Unassigned</span>
                        )}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenConversation(item.customer_id);
                      }}
                      className="px-2.5 py-1 rounded-md bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-[11px] flex items-center gap-1 shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Reply in Inbox
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/inbox');
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium hover:underline flex items-center justify-center gap-1.5 w-full py-1"
              >
                Go to Inbox ({count} pending)
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
