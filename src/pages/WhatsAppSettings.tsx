import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, Plus, AlertCircle, CheckCircle2, ShieldCheck, HelpCircle, Edit2, Trash2, Power, PowerOff } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import api from '../api/axios';

interface WhatsAppConnection {
    id?: string;
    display_name: string;
    whatsapp_phone_number: string;
    phone_number_id: string;
    meta_app_id: string;
    access_token: string;
    bot_enabled: boolean;
    connection_status: string;
    updated_at?: string;
}

export default function WhatsAppSettings() {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string, message: string, onConfirm: () => void, isDestructive?: boolean, confirmText?: string } | null>(null);
  const [currentConnection, setCurrentConnection] = useState<WhatsAppConnection>({
    display_name: '',
    whatsapp_phone_number: '',
    phone_number_id: '',
    meta_app_id: '',
    access_token: '',
    bot_enabled: true,
    connection_status: 'Not Verified'
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/whatsapp/config');
      if (Array.isArray(res.data)) {
        setConnections(res.data);
      } else {
        console.error('Expected array of connections but got:', res.data);
        setConnections([]);
        showToast('Please restart your backend server. It is running an old version.', 'error');
      }
    } catch (err) {
      console.error('Failed to load WhatsApp configs', err);
      showToast('Failed to load configurations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
      setCurrentConnection({
        display_name: '',
        whatsapp_phone_number: '',
        phone_number_id: '',
        meta_app_id: '',
        access_token: '',
        bot_enabled: true,
        connection_status: 'Not Verified'
      });
      setIsModalOpen(true);
  };

  const openEditModal = (conn: WhatsAppConnection) => {
      setCurrentConnection({ ...conn });
      setIsModalOpen(true);
  };

  const handleModalChange = (key: keyof WhatsAppConnection, value: any) => {
      setCurrentConnection(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveConnection = async () => {
    setSaving(true);
    try {
      if (currentConnection.id) {
          await api.put(`/whatsapp/config/${currentConnection.id}`, currentConnection);
          showToast('Connection updated successfully', 'success');
      } else {
          await api.post('/whatsapp/config', currentConnection);
          showToast('Connection added successfully', 'success');
      }
      setIsModalOpen(false);
      fetchConfigs();
    } catch (err: any) {
      console.error('Failed to save config', err);
      showToast(err.response?.data?.error || 'Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConnection = (id: string) => {
      setConfirmConfig({
        title: 'Delete Connection',
        message: 'Are you sure you want to delete this WhatsApp connection? This action cannot be undone.',
        confirmText: 'Delete',
        isDestructive: true,
        onConfirm: () => {
          setConnections(prev => prev.filter(conn => conn.id !== id));
          showToast('Connection removed from view', 'success');
        }
      });
  };

  const handleToggleBot = (id: string, currentStatus: boolean) => {
      const action = currentStatus ? 'Disable' : 'Enable';
      setConfirmConfig({
        title: `${action} AI Auto-Reply`,
        message: `Are you sure you want to ${action.toLowerCase()} the AI Auto-Reply for this number?`,
        confirmText: action,
        isDestructive: currentStatus, // red if disabling, blue if enabling
        onConfirm: async () => {
          try {
            await api.patch(`/whatsapp/bot-status/${id}`, { bot_enabled: !currentStatus });
            showToast(`Bot ${!currentStatus ? 'enabled' : 'disabled'} successfully`, 'success');
            fetchConfigs();
          } catch (err: any) {
            showToast(err.response?.data?.error || 'Failed to update bot status', 'error');
          }
        }
      });
  };

  const handleTestConnection = async (id?: string) => {
    setTesting(true);
    try {
      const payload = id 
        ? { id } 
        : { 
            id: currentConnection.id,
            whatsapp_phone_number_id: currentConnection.phone_number_id, 
            whatsapp_access_token: currentConnection.access_token 
          };
      
      const res = await api.post('/whatsapp/test', payload);
      
      if (res.data.success) {
        showToast('Connection test successful!', 'success');
        if (!id) {
            setCurrentConnection(prev => ({...prev, connection_status: 'Connected'}));
        } else {
            fetchConfigs();
        }
      } else {
        showToast(res.data.error || 'Connection failed', 'error');
        if (!id) {
            setCurrentConnection(prev => ({...prev, connection_status: 'Error'}));
        } else {
            fetchConfigs();
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Connection failed', 'error');
      if (!id) {
        setCurrentConnection(prev => ({...prev, connection_status: 'Error'}));
      } else {
        fetchConfigs();
      }
    } finally {
      setTesting(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading WhatsApp configurations...</div>;
  }

  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:3000/webhook`;

  return (
    <div className="w-full max-w-7xl mx-auto pb-12">
      {toast && typeof document !== 'undefined' && createPortal(
        <div className={`toast-banner ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>,
        document.body
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">WhatsApp Connections</h2>
          <p className="text-sm text-slate-500 mt-1">Manage multiple Meta Cloud API numbers independently.</p>
        </div>
        <button 
          onClick={openAddModal} 
          className="btn-save-primary whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Add Number
        </button>
      </div>

      {/* Connections List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {connections.length === 0 ? (
              <div className="col-span-full p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-slate-500 mb-4">No WhatsApp numbers configured yet.</p>
                  <button onClick={openAddModal} className="btn-save-primary mx-auto">
                      <Plus className="w-4 h-4" /> Add Your First Number
                  </button>
              </div>
          ) : (
              connections.map(conn => (
                  <div key={conn.id} className="panel-card flex flex-col hover:border-blue-200 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                  {conn.display_name}
                              </h3>
                              <p className="text-sm text-slate-500 font-mono mt-1">{conn.whatsapp_phone_number}</p>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => handleTestConnection(conn.id)} className="p-1.5 text-slate-400 hover:text-blue-500 bg-slate-50 hover:bg-blue-50 rounded" title="Test Connection">
                                  <ShieldCheck className="w-4 h-4" />
                              </button>
                              <button onClick={() => openEditModal(conn)} className="p-1.5 text-slate-400 hover:text-emerald-500 bg-slate-50 hover:bg-emerald-50 rounded" title="Edit">
                                  <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteConnection(conn.id!)} className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded" title="Delete">
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm mb-4">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${conn.connection_status === 'Connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                              {conn.connection_status === 'Connected' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                              <span className="font-medium">{conn.connection_status}</span>
                          </div>
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${conn.bot_enabled ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              {conn.bot_enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                              <span className="font-medium">{conn.bot_enabled ? 'Bot Active' : 'Bot Temporarily Disabled'}</span>
                          </div>
                      </div>

                      <div className="text-xs text-slate-400 font-mono mb-4 flex-1">
                          ID: {conn.phone_number_id}
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">Updated: {new Date(conn.updated_at!).toLocaleString()}</span>
                          <button 
                              onClick={() => handleToggleBot(conn.id!, conn.bot_enabled)}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                  conn.bot_enabled 
                                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' 
                                  : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                              }`}
                          >
                              {conn.bot_enabled ? 'Disable Bot' : 'Enable Bot'}
                          </button>
                      </div>
                  </div>
              ))
          )}
      </div>

      {/* Global Webhook Info */}
      <div className="panel-card flex flex-col gap-4">
        <h3 className="font-bold text-slate-800">Global Webhook Configuration</h3>
        <p className="text-xs text-slate-500">
            Configure this webhook URL in the Meta App Dashboard. All configured numbers under this Meta App will receive webhooks here.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Webhook URL</label>
                <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                <span className="text-sm font-mono text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap">
                    {webhookUrl}
                </span>
                <button 
                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                    className="ml-2 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium text-slate-600 transition-colors"
                >
                    Copy
                </button>
                </div>
            </div>

            <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Verify Token</label>
                <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                <span className="text-sm font-mono text-slate-700">
                    my_secure_verify_token
                </span>
                <button 
                    onClick={() => navigator.clipboard.writeText('my_secure_verify_token')}
                    className="ml-2 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium text-slate-600 transition-colors"
                >
                    Copy
                </button>
                </div>
            </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                      <h3 className="font-bold text-xl text-slate-800">
                          {currentConnection.id ? 'Edit WhatsApp Connection' : 'Add WhatsApp Connection'}
                      </h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <AlertCircle className="w-6 h-6 rotate-45" /> {/* simple X icon */}
                      </button>
                  </div>

                  <div className="p-6 flex flex-col gap-5">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Display Name / Label</label>
                        <input 
                            type="text" 
                            value={currentConnection.display_name || ''} 
                            onChange={(e) => handleModalChange('display_name', e.target.value)} 
                            placeholder="e.g. Sales Team Line"
                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">WhatsApp Phone Number</label>
                            <input 
                            type="text" 
                            value={currentConnection.whatsapp_phone_number || ''} 
                            onChange={(e) => handleModalChange('whatsapp_phone_number', e.target.value)} 
                            placeholder="e.g. +1234567890"
                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Phone Number ID</label>
                            <input 
                            type="text" 
                            value={currentConnection.phone_number_id || ''} 
                            onChange={(e) => handleModalChange('phone_number_id', e.target.value)} 
                            placeholder="e.g. 10123456789"
                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">WABA ID</label>
                        <input 
                            type="text" 
                            value={currentConnection.meta_app_id || ''} 
                            onChange={(e) => handleModalChange('meta_app_id', e.target.value)} 
                            placeholder="WhatsApp Business Account ID"
                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Permanent Access Token</label>
                        <input 
                            type="text" 
                            value={currentConnection.access_token || ''} 
                            onChange={(e) => handleModalChange('access_token', e.target.value)}
                            placeholder="EAXXXXXXXXXXXX..."
                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">This token will be encrypted and masked when saved.</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
                        <div>
                            <h4 className="font-bold text-blue-800 text-sm">Bot AI Auto-Reply</h4>
                            <p className="text-xs text-blue-600 mt-0.5">Allow AI and Keyword rules to reply to messages on this number.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={currentConnection.bot_enabled} onChange={(e) => handleModalChange('bot_enabled', e.target.checked)} />
                            <div className="w-11 h-6 bg-blue-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 flex justify-between bg-slate-50 rounded-b-2xl">
                      <button 
                        onClick={() => handleTestConnection()} 
                        disabled={testing || saving || !currentConnection.phone_number_id || !currentConnection.access_token}
                        className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                          {testing ? 'Testing...' : 'Test Connection'}
                      </button>
                      <div className="flex gap-3">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveConnection} 
                            disabled={saving || testing}
                            className="btn-save-primary whitespace-nowrap"
                        >
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Connection'}
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <ConfirmModal
        isOpen={!!confirmConfig}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        confirmText={confirmConfig?.confirmText}
        isDestructive={confirmConfig?.isDestructive}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
      />
    </div>
  );
}
