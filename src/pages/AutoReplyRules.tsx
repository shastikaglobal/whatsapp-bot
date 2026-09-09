import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  Save, Plus, Trash2, Pencil, Power, PowerOff, Bot,
  MessageSquare, ShieldCheck, AlertCircle, X, Send,
  ToggleLeft, ToggleRight
} from 'lucide-react';

const PRESET_MESSAGES = {
  welcome: [
    "👋 Welcome to Shastika Global Impex! Thank you for reaching out. How may we assist you today?",
    "Hello! 👋 Welcome to Shastika Global Impex. We're happy to assist you with your requirements.",
    "Welcome to Shastika Global Impex! Thank you for contacting us. Please let us know how we can help you.",
    "👋 Hello and welcome! Our team is ready to assist you. Please share your requirement with us.",
    "Thank you for contacting Shastika Global Impex. We’re here to help with your product and business enquiries."
  ],
  firstTime: [
    "👋 Hello! Welcome to Shastika Global Impex. We're delighted to connect with you. How may we assist you?",
    "Welcome! It's a pleasure to have you connect with us. Please share your requirement, and our team will be happy to assist.",
    "👋 Hi there! Thank you for choosing Shastika Global Impex. Please let us know what you're looking for.",
    "Hello and welcome! We appreciate your interest in our products. How can our team assist you today?",
    "👋 Welcome to Shastika Global Impex! We're glad to have you here. Feel free to share your product or business requirement with us."
  ],
  outsideHours: [
    "Thank you for reaching out! 🕐 Our team is currently outside business hours. We'll get back to you as soon as possible.",
    "Thank you for contacting us. Our team is currently unavailable, but we’ve received your message and will respond during business hours.",
    "👋 Thanks for your message! We’re currently away from the office. Our team will get back to you at the earliest during business hours.",
    "We appreciate you contacting Shastika Global Impex. Our office is currently closed. We’ll respond to your enquiry as soon as our team is available.",
    "Thank you for your enquiry. 🌙 Our team is currently offline. Please leave your message, and we’ll get back to you during our next working hours."
  ],
  holiday: [
    "🎉 Thank you for contacting Shastika Global Impex. Our team is currently on holiday. We’ll respond to your message when we return.",
    "Thank you for reaching out! Our office is currently closed for a holiday. We’ll get back to you as soon as our team resumes work.",
    "👋 We’ve received your message. Our team is currently away on holiday and will respond to your enquiry once we’re back.",
    "Thank you for contacting us. 🎊 Our team is currently unavailable due to a holiday. We appreciate your patience and will respond at the earliest.",
    "Happy holidays! ✨ Our team is currently away. Your message has been received, and we’ll get back to you once we resume business."
  ]
};

interface Rule {
  id: number;
  keyword: string;
  reply_text: string;
  is_active: boolean | number;
}

export default function AutoReplyRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Rule form state
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleReply, setRuleReply] = useState('');

  // Simulator state
  const [simInput, setSimInput] = useState('');
  const [simMessages, setSimMessages] = useState<{ sender: 'customer' | 'bot'; text: string }[]>([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rulesRes, settingsRes] = await Promise.all([
        api.get('/auto-reply/rules'),
        api.get('/settings')
      ]);
      setRules(rulesRes.data);
      setSettings(settingsRes.data);
    } catch (err) {
      console.error('Failed to load auto-reply data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
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

  // Rule CRUD
  const openCreateForm = () => {
    setEditingRule(null);
    setRuleKeyword('');
    setRuleReply('');
    setShowForm(true);
  };

  const openEditForm = (rule: Rule) => {
    setEditingRule(rule);
    setRuleKeyword(rule.keyword);
    setRuleReply(rule.reply_text);
    setShowForm(true);
  };

  const saveRule = async () => {
    if (!ruleKeyword.trim() || !ruleReply.trim()) {
      return showToast('Keyword and reply text are required', 'error');
    }
    try {
      if (editingRule) {
        await api.put(`/auto-reply/rules/${editingRule.id}`, {
          keyword: ruleKeyword.trim(),
          reply_text: ruleReply.trim(),
          is_active: editingRule.is_active
        });
        showToast('Rule updated', 'success');
      } else {
        await api.post('/auto-reply/rules', {
          keyword: ruleKeyword.trim(),
          reply_text: ruleReply.trim(),
          is_active: true
        });
        showToast('Rule created', 'success');
      }
      setShowForm(false);
      fetchAll();
    } catch (err) {
      showToast('Failed to save rule', 'error');
    }
  };

  const toggleRule = async (rule: Rule) => {
    try {
      const newActive = rule.is_active ? false : true;
      await api.put(`/auto-reply/rules/${rule.id}`, {
        keyword: rule.keyword,
        reply_text: rule.reply_text,
        is_active: newActive
      });
      fetchAll();
    } catch (err) {
      showToast('Failed to toggle rule', 'error');
    }
  };

  const deleteRule = async (id: number) => {
    try {
      await api.delete(`/auto-reply/rules/${id}`);
      showToast('Rule deleted permanently', 'success');
      fetchAll();
    } catch (err) {
      showToast('Failed to delete rule', 'error');
    }
  };

  // Simulator
  const simulateReply = () => {
    if (!simInput.trim()) return;
    const text = simInput.trim();
    setSimMessages(prev => [...prev, { sender: 'customer', text }]);
    setSimInput('');

    // Simulate matching: check keyword rules first
    let matched = false;
    for (const rule of rules) {
      if (rule.is_active && text.toLowerCase().includes(rule.keyword.toLowerCase())) {
        setTimeout(() => {
          setSimMessages(prev => [...prev, { sender: 'bot', text: `📋 Rule match: "${rule.keyword}"\n${rule.reply_text}` }]);
        }, 500);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const aiEnabled = settings.ai_enabled === 'true';
      setTimeout(() => {
        setSimMessages(prev => [...prev, {
          sender: 'bot',
          text: aiEnabled
            ? '🤖 No keyword matched → AI fallback would generate a reply using Gemini.'
            : '⚠️ No keyword matched and AI is disabled. No reply would be sent.'
        }]);
      }, 500);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading auto-reply configuration...</div>;
  }

  return (
    <div className="rules-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
      {toast && (
        <div className={`toast-banner ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* LEFT COLUMN: Rules & Config */}
      <div className="rules-main space-y-6" style={{ minWidth: 0 }}>

        {/* Global Controls */}
        <div className="panel-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Auto-Reply Engine</h2>
            <button onClick={saveSettings} disabled={saving} className="btn-save-primary">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="text-sm font-semibold text-slate-700">Global Auto-Reply</div>
                <div className="text-xs text-slate-400">Master switch for all auto-replies</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={settings.auto_reply_enabled === 'true'} onChange={(e) => handleSettingChange('auto_reply_enabled', e.target.checked ? 'true' : 'false')} />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="text-sm font-semibold text-slate-700">AI Fallback</div>
                <div className="text-xs text-slate-400">Use Gemini when no rule matches</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={settings.ai_enabled === 'true'} onChange={(e) => handleSettingChange('ai_enabled', e.target.checked ? 'true' : 'false')} />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="text-sm font-semibold text-slate-700">Language Detection</div>
                <div className="text-xs text-slate-400">Reply in customer's language</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={settings.ai_language_detection === 'true'} onChange={(e) => handleSettingChange('ai_language_detection', e.target.checked ? 'true' : 'false')} />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="text-sm font-semibold text-slate-700">Human Takeover Pauses AI</div>
                <div className="text-xs text-slate-400">Stop AI during handover</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={settings.human_takeover_pauses_ai === 'true'} onChange={(e) => handleSettingChange('human_takeover_pauses_ai', e.target.checked ? 'true' : 'false')} />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Greeting Messages */}
        <div className="panel-card">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Greeting Messages</h2>
          <p className="text-sm text-slate-500 mb-4">Configure automatic messages for customers.</p>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Welcome Message</label>
                <select 
                  className="text-xs border border-slate-200 rounded-lg text-slate-600 focus:ring-emerald-500 focus:border-emerald-500 bg-white py-1.5 px-2 cursor-pointer shadow-sm max-w-[200px] sm:max-w-xs"
                  onChange={(e) => {
                    if (e.target.value) handleSettingChange('welcome_message', e.target.value);
                    e.target.value = '';
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Choose a preset...</option>
                  {PRESET_MESSAGES.welcome.map((opt, i) => (
                    <option key={i} value={opt}>Preset {i + 1}: {opt.substring(0, 30)}...</option>
                  ))}
                </select>
              </div>
              <textarea
                value={settings.welcome_message || ''}
                onChange={(e) => handleSettingChange('welcome_message', e.target.value)}
                placeholder="Hello! 👋 Welcome to our store. How can we help you today?"
                className="w-full h-20 p-3 border border-slate-300 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">First-Time Customer Greeting</label>
                <select 
                  className="text-xs border border-slate-200 rounded-lg text-slate-600 focus:ring-emerald-500 focus:border-emerald-500 bg-white py-1.5 px-2 cursor-pointer shadow-sm max-w-[200px] sm:max-w-xs"
                  onChange={(e) => {
                    if (e.target.value) handleSettingChange('first_time_greeting', e.target.value);
                    e.target.value = '';
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Choose a preset...</option>
                  {PRESET_MESSAGES.firstTime.map((opt, i) => (
                    <option key={i} value={opt}>Preset {i + 1}: {opt.substring(0, 30)}...</option>
                  ))}
                </select>
              </div>
              <textarea
                value={settings.first_time_greeting || ''}
                onChange={(e) => handleSettingChange('first_time_greeting', e.target.value)}
                placeholder="Hi there! 🎉 We're glad to have you as a new customer. How can we assist you?"
                className="w-full h-20 p-3 border border-slate-300 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Outside Business Hours Reply</label>
                <select 
                  className="text-xs border border-slate-200 rounded-lg text-slate-600 focus:ring-emerald-500 focus:border-emerald-500 bg-white py-1.5 px-2 cursor-pointer shadow-sm max-w-[200px] sm:max-w-xs"
                  onChange={(e) => {
                    if (e.target.value) handleSettingChange('outside_hours_reply', e.target.value);
                    e.target.value = '';
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Choose a preset...</option>
                  {PRESET_MESSAGES.outsideHours.map((opt, i) => (
                    <option key={i} value={opt}>Preset {i + 1}: {opt.substring(0, 30)}...</option>
                  ))}
                </select>
              </div>
              <textarea
                value={settings.outside_hours_reply || ''}
                onChange={(e) => handleSettingChange('outside_hours_reply', e.target.value)}
                placeholder="Thanks for reaching out! 🕐 We're currently outside of business hours. We'll get back to you as soon as possible."
                className="w-full h-20 p-3 border border-slate-300 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Holiday Auto-Reply</label>
                <select 
                  className="text-xs border border-slate-200 rounded-lg text-slate-600 focus:ring-emerald-500 focus:border-emerald-500 bg-white py-1.5 px-2 cursor-pointer shadow-sm max-w-[200px] sm:max-w-xs"
                  onChange={(e) => {
                    if (e.target.value) handleSettingChange('holiday_reply', e.target.value);
                    e.target.value = '';
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Choose a preset...</option>
                  {PRESET_MESSAGES.holiday.map((opt, i) => (
                    <option key={i} value={opt}>Preset {i + 1}: {opt.substring(0, 30)}...</option>
                  ))}
                </select>
              </div>
              <textarea
                value={settings.holiday_reply || ''}
                onChange={(e) => handleSettingChange('holiday_reply', e.target.value)}
                placeholder="Happy holidays! 🎄 Our team is currently on holiday. We'll respond when we return."
                className="w-full h-20 p-3 border border-slate-300 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button onClick={saveSettings} disabled={saving} className="btn-save-primary">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Messages'}
            </button>
          </div>
        </div>

        {/* Keyword Rules Table */}
        <div className="panel-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Keyword Rules</h2>
              <p className="text-sm text-slate-500">Rules are checked in order. First match wins.</p>
            </div>
            <button onClick={openCreateForm} className="btn-save-primary">
              <Plus className="w-4 h-4" /> Add Rule
            </button>
          </div>

          {/* Rule Form Modal */}
          {showForm && (
            <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">{editingRule ? 'Edit Rule' : 'New Keyword Rule'}</h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Keywords (comma-separated for multiple)</label>
                <input
                  type="text"
                  value={ruleKeyword}
                  onChange={(e) => setRuleKeyword(e.target.value)}
                  placeholder="e.g. price, pricing, cost"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Reply Text</label>
                <textarea
                  value={ruleReply}
                  onChange={(e) => setRuleReply(e.target.value)}
                  placeholder="The automated reply when keyword is detected..."
                  className="w-full h-24 p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100">Cancel</button>
                <button onClick={saveRule} className="btn-save-primary">
                  <Save className="w-4 h-4" /> {editingRule ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* Rules List */}
          {rules.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-4">No keyword rules configured yet.</p>
              <button onClick={openCreateForm} className="pill-button bg-white shadow-sm hover:shadow-md">
                <Plus className="w-4 h-4 text-brand-600" /> Create First Rule
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <div
                  key={rule.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    rule.is_active ? 'bg-white border-slate-200 hover:border-emerald-300' : 'bg-slate-50 border-slate-100 opacity-60'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-400 w-6 text-center shrink-0">#{index + 1}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{rule.keyword}</span>
                      {!rule.is_active && <span className="text-[10px] text-slate-400 italic">disabled</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{rule.reply_text}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleRule(rule)}
                      title={rule.is_active ? 'Disable' : 'Enable'}
                      className={`p-1.5 rounded-lg transition-colors ${rule.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                    >
                      {rule.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditForm(rule)}
                      className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: WhatsApp Simulator */}
      <div className="rules-sidebar hidden lg:block" style={{ position: 'sticky', top: '1.5rem', height: 'fit-content' }}>
        <div className="phone-mockup-wrapper">
          <div className="phone-screen">
            <div className="phone-header">
              <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-slate-600 overflow-hidden">
                <img src="https://ui-avatars.com/api/?name=SA&background=0D8ABC&color=fff" alt="Avatar" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Shastika Bot</div>
                <div className="text-[10px] text-green-200 font-medium">online</div>
              </div>
            </div>

            <div className="phone-body">
              <div className="flex justify-center mb-2">
                <span className="bg-emerald-100/80 text-emerald-800 text-[10px] px-2 py-1 rounded font-medium shadow-sm">
                  Rule Simulator
                </span>
              </div>

              {simMessages.length === 0 && (
                <div className="flex justify-start">
                  <div className="wa-bubble-preview wa-ai-bubble whitespace-pre-wrap">
                    👋 Type a message below to test your keyword rules!
                  </div>
                </div>
              )}

              {simMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`wa-bubble-preview whitespace-pre-wrap ${msg.sender === 'customer' ? 'wa-human-bubble' : 'wa-ai-bubble'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="phone-footer">
              <input
                type="text"
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && simulateReply()}
                placeholder="Type a test message..."
                className="flex-1 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={simulateReply}
                className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white hover:bg-emerald-600 transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
