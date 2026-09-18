import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Save, Shield, Bell, Globe, Monitor, LogOut, Lock,
  CheckCircle2, XCircle, AlertCircle, Clock, Database,
  MessageSquare, Wifi, Server, Eye, EyeOff
} from 'lucide-react';

export default function AppSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [settingsRes, statusRes] = await Promise.all([
        api.get('/settings'),
        api.get('/system/status')
      ]);
      setSettings(settingsRes.data);
      setSystemStatus(statusRes.data);
    } catch (err) {
      console.error('Failed to load system settings', err);
      showToast('Failed to load system settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      showToast('Settings saved successfully', 'success');
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      return showToast('Please fill in all password fields', 'error');
    }
    if (newPassword !== confirmPassword) {
      return showToast('New passwords do not match', 'error');
    }
    if (newPassword.length < 6) {
      return showToast('Password must be at least 6 characters', 'error');
    }

    setChangingPassword(true);
    try {
      await api.post('/system/password', { currentPassword, newPassword });
      showToast('Password changed successfully. Please log in again.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Force re-login with new password
      setTimeout(() => {
        sessionStorage.removeItem('shastika_token');
        navigate('/login');
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to change password';
      showToast(msg, 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('shastika_token');
    navigate('/login');
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading system settings...</div>;
  }

  const status = systemStatus || {};
  const StatusDot = ({ ok }: { ok: boolean }) => (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
  );

  return (
    <div className="w-full max-w-7xl mx-auto pb-12">
      {toast && (
        <div className={`toast-banner ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">System Settings</h2>
          <p className="text-sm text-slate-500 mt-1">General preferences, security, and system health monitoring.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleLogout} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <LogOut className="w-4 h-4" /> Log Out
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-save-primary whitespace-nowrap">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xl:gap-8 items-start">

        {/* System Status */}
        <div className="panel-card flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-1">
            <Monitor className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-slate-800">System Status</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Server className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Backend API</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot ok={status.api?.status === 'online'} />
                <span className="text-xs font-medium text-slate-500">{status.api?.status === 'online' ? 'Online' : 'Offline'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Database</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot ok={status.database?.status === 'online'} />
                <span className="text-xs font-medium text-slate-500">
                  {status.database?.status === 'online' ? `Connected (${status.database?.tables} tables)` : 'Offline'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Wifi className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">WhatsApp API</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot ok={status.whatsapp?.status === 'configured'} />
                <span className="text-xs font-medium text-slate-500">
                  {status.whatsapp?.status === 'configured' ? 'Configured' : 'Not Configured'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Version</p>
                <p className="text-sm font-bold text-slate-800">{status.app?.version || '—'}</p>
              </div>
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Uptime</p>
                <p className="text-sm font-bold text-slate-800">{formatUptime(status.uptime)}</p>
              </div>
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Node.js</p>
                <p className="text-sm font-bold text-slate-800">{status.nodeVersion || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* General Configuration */}
        <div className="panel-card flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-1">
            <Globe className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-slate-800">General Configuration</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">CRM Name</label>
            <input
              type="text"
              value={settings.crm_name || ''}
              onChange={(e) => handleChange('crm_name', e.target.value)}
              placeholder="e.g. Shastika AI"
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Time Zone</label>
            <select
              value={settings.timezone || 'Asia/Kolkata'}
              onChange={(e) => handleChange('timezone', e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {typeof Intl !== 'undefined' && 
                // @ts-ignore
                typeof Intl.supportedValuesOf !== 'undefined'
                // @ts-ignore
                ? Intl.supportedValuesOf('timeZone').map((tz: any) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))
                : (
                  <>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                    <option value="America/New_York">America/New_York (EST, UTC-5)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
                    <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
                    <option value="Europe/Berlin">Europe/Berlin (CET, UTC+1)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                    <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST, UTC+10)</option>
                  </>
                )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Date Format</label>
            <select
              value={settings.date_format || 'DD/MM/YYYY'}
              onChange={(e) => handleChange('date_format', e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              <option value="DD-MMM-YYYY">DD-MMM-YYYY</option>
            </select>
          </div>
        </div>

        {/* Security */}
        <div className="panel-card flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-1">
            <Shield className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-slate-800">Security</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>
          </div>

          <button
            onClick={handleChangePassword}
            disabled={changingPassword}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Lock className="w-4 h-4" /> {changingPassword ? 'Changing...' : 'Change Password'}
          </button>

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full py-2.5 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Log Out of This Session
            </button>
          </div>
        </div>

        {/* Notifications & Preferences */}
        <div className="panel-card flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-1">
            <Bell className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-800">Notifications & Preferences</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-slate-700">New Message Alerts</label>
              <p className="text-xs text-slate-400">Get notified when a new customer message arrives.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={settings.notify_new_message === 'true'} onChange={(e) => handleChange('notify_new_message', e.target.checked ? 'true' : 'false')} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-slate-700">Sound Notifications</label>
              <p className="text-xs text-slate-400">Play a sound for incoming messages.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={settings.notify_sound === 'true'} onChange={(e) => handleChange('notify_sound', e.target.checked ? 'true' : 'false')} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-slate-700">Auto-Assign Conversations</label>
              <p className="text-xs text-slate-400">Automatically assign new conversations to available agents.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={settings.auto_assign === 'true'} onChange={(e) => handleChange('auto_assign', e.target.checked ? 'true' : 'false')} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Default Customer View</label>
            <select
              value={settings.customer_view || 'list'}
              onChange={(e) => handleChange('customer_view', e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="list">List View</option>
              <option value="grid">Grid View</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Conversation Sort Order</label>
            <select
              value={settings.conversation_sort || 'newest'}
              onChange={(e) => handleChange('conversation_sort', e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="unread">Unread First</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  );
}
