import React, { useState, useEffect } from 'react';
import { Save, ShieldCheck, Zap, Globe, MessageSquare, Bot, AlertCircle } from 'lucide-react';
import api from '../api/axios';

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to load settings', err);
      showToast('Failed to load settings', 'error');
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
      fetchSettings(); // Re-fetch to get the masked versions back
    } catch (err) {
      console.error('Failed to save settings', err);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading settings...</div>;
  }

  // Webhook URL derived from current origin (fallback)
  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:3000/api/whatsapp/webhook`;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {toast && (
        <div className={`toast-banner ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">System Configuration</h2>
          <p className="text-sm text-slate-500 mt-1">Manage AI providers, business profiles, and API integrations.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="btn-save-primary whitespace-nowrap"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* AI Provider Section */}
        <div className="panel-card flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
            <Zap className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-slate-800">AI Provider & Model</h3>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Enable AI Responses</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={settings.ai_enabled === 'true'} onChange={(e) => handleChange('ai_enabled', e.target.checked ? 'true' : 'false')} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Provider</label>
            <select 
              value={settings.ai_provider || 'gemini'} 
              onChange={(e) => handleChange('ai_provider', e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Model Selection</label>
            <select 
              value={settings.ai_model || 'gemini-1.5-flash'} 
              onChange={(e) => handleChange('ai_model', e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (Reasoning)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">API Key</label>
            <input 
              type="text" 
              value={settings.ai_api_key || ''} 
              onChange={(e) => handleChange('ai_api_key', e.target.value)}
              placeholder="Enter provider API key"
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* AI Behavior Section */}
        <div className="panel-card flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
            <Bot className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-slate-800">AI Behavior</h3>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Auto-Detect Language</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={settings.ai_language_detection === 'true'} onChange={(e) => handleChange('ai_language_detection', e.target.checked ? 'true' : 'false')} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
            </label>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Creativity (Temperature)</label>
              <span className="text-xs font-bold text-slate-700">{settings.ai_temperature || '0.7'}</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.1"
              value={settings.ai_temperature || 0.7} 
              onChange={(e) => handleChange('ai_temperature', e.target.value)}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">System Instructions</label>
            <textarea 
              value={settings.ai_system_instruction || ''} 
              onChange={(e) => handleChange('ai_system_instruction', e.target.value)}
              placeholder="e.g. You are a helpful sales assistant for our clothing brand..."
              className="w-full h-32 p-3 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
            />
          </div>
        </div>

        {/* Business Information */}
        <div className="panel-card flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
            <Globe className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-slate-800">Business Information</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Company Name</label>
            <input type="text" value={settings.business_name || ''} onChange={(e) => handleChange('business_name', e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</label>
            <textarea value={settings.business_desc || ''} onChange={(e) => handleChange('business_desc', e.target.value)} className="w-full h-20 p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Contact Email/Phone</label>
              <input type="text" value={settings.business_contact || ''} onChange={(e) => handleChange('business_contact', e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Working Hours</label>
              <input type="text" placeholder="e.g. 9AM - 5PM" value={settings.business_hours || ''} onChange={(e) => handleChange('business_hours', e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
        </div>

        {/* WhatsApp & Auto Reply */}
        <div className="panel-card flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
            <MessageSquare className="w-5 h-5 text-teal-500" />
            <h3 className="font-bold text-slate-800">WhatsApp & Meta API</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">WABA ID</label>
              <input type="text" value={settings.meta_app_id || ''} onChange={(e) => handleChange('meta_app_id', e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Phone Number ID</label>
              <input type="text" value={settings.whatsapp_phone_number_id || ''} onChange={(e) => handleChange('whatsapp_phone_number_id', e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Access Token</label>
            <input 
              type="text" 
              value={settings.whatsapp_access_token || ''} 
              onChange={(e) => handleChange('whatsapp_access_token', e.target.value)}
              placeholder="Enter permanent access token"
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="mt-2 p-3 bg-slate-100 rounded-lg border border-slate-200">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Webhook URL (Read Only)</label>
            <div className="text-sm font-mono text-slate-700 bg-white p-2 rounded border border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap">
              {webhookUrl}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Copy this URL to your Meta App Dashboard. Verification token is your Admin Password.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
