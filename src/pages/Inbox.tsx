import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Send, User, Bot, AlertCircle, Phone, Clock, MoreVertical, X, Check, Smile } from 'lucide-react';
import EmojiPicker from '../components/EmojiPicker';
import api from '../api/axios';

interface Conversation {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  status: 'open' | 'handover' | 'resolved';
  updated_at: string;
  assigned_bde_id?: string;
  assigned_bde_name?: string;
  intent?: string;
  is_important?: boolean;
  requires_admin_attention?: boolean;
}

interface Message {
  id: string;
  customer_id: string;
  sender: string;
  content: string;
  timestamp: string;
}

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'needs_human' | 'bot_active' | 'resolved'>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [bdes, setBdes] = useState<{id: string, name: string}[]>([]);
  const [searchParams] = useSearchParams();
  const queryCustomerId = searchParams.get('customerId') || searchParams.get('customer');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertEmoji = (emoji: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart ?? inputMessage.length;
      const end = textarea.selectionEnd ?? inputMessage.length;
      const updated = inputMessage.substring(0, start) + emoji + inputMessage.substring(end);
      setInputMessage(updated);
      setTimeout(() => {
        textarea.focus();
        const newPos = start + emoji.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setInputMessage(prev => prev + emoji);
    }
  };

  const fetchBDEs = async () => {
    try {
      const res = await api.get('/bdes');
      setBdes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBDEs();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/conversations');
      setConversations(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (customerId: string) => {
    try {
      const res = await api.get(`/messages/${customerId}`);
      setMessages(res.data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConversations();
    // In a real app, you'd use websockets or polling here
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedConvo) {
        fetchMessages(selectedConvo.customer_id);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedConvo]);

  const handleSelectConvo = (convo: Conversation) => {
    setSelectedConvo(convo);
    setIsDropdownOpen(false);
    fetchMessages(convo.customer_id);
  };

  // Auto-select conversation if customerId query param is provided (e.g. from notification)
  useEffect(() => {
    if (queryCustomerId && conversations.length > 0) {
      const target = conversations.find(
        c => String(c.customer_id) === String(queryCustomerId) || String(c.id) === String(queryCustomerId)
      );
      if (target && (!selectedConvo || selectedConvo.customer_id !== target.customer_id)) {
        handleSelectConvo(target);
      }
    }
  }, [queryCustomerId, conversations]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedConvo) return;

    const tempMsg = inputMessage;
    setInputMessage('');

    // If bot was active, sending a manual reply automatically switches to handover (pauses bot)
    if (selectedConvo.status === 'open') {
      try {
        await api.put('/whatsapp/takeover', { customerId: selectedConvo.customer_id, status: 'handover' });
        setSelectedConvo(prev => prev ? { ...prev, status: 'handover' } : null);
      } catch (e) {
        console.warn('Could not auto-takeover conversation:', e);
      }
    }

    // Optimistic UI update
    const newMsg: Message = {
      id: Date.now().toString(),
      customer_id: selectedConvo.customer_id,
      sender: 'human',
      content: tempMsg,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    try {
      await api.post('/whatsapp/send', { customerId: selectedConvo.customer_id, content: tempMsg });
      fetchMessages(selectedConvo.customer_id);
      fetchConversations();
    } catch (err) {
      console.error('Failed to send', err);
    }
  };

  const handleTakeover = async (status: 'open' | 'handover' | 'resolved') => {
    if (!selectedConvo) return;
    try {
      await api.put('/whatsapp/takeover', { customerId: selectedConvo.customer_id, status });
      setSelectedConvo({ ...selectedConvo, status });
      fetchConversations();
      setIsDropdownOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignBDE = async (bdeId: string) => {
    if (!selectedConvo) return;
    try {
      await api.put(`/customers/${selectedConvo.customer_id}/assign`, { assigned_bde_id: bdeId });
      const assignedBde = bdes.find(b => b.id.toString() === bdeId.toString());
      setSelectedConvo({ ...selectedConvo, assigned_bde_id: bdeId, assigned_bde_name: assignedBde?.name });
      fetchConversations();
      setIsAssignModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const countNeedsHuman = conversations.filter(c => c.status === 'handover' || c.requires_admin_attention || c.intent === 'Human Request').length;
  const countBotActive = conversations.filter(c => c.status === 'open' && !c.requires_admin_attention && c.intent !== 'Human Request').length;
  const countResolved = conversations.filter(c => c.status === 'resolved').length;

  const filteredConversations = conversations.filter(c => {
    const matchesSearch = 
      c.customer_name?.toLowerCase().includes(search.toLowerCase()) || 
      c.customer_phone?.includes(search);
    if (!matchesSearch) return false;

    if (filter === 'needs_human') {
      return c.status === 'handover' || c.requires_admin_attention || c.intent === 'Human Request';
    }
    if (filter === 'bot_active') {
      return c.status === 'open' && !c.requires_admin_attention && c.intent !== 'Human Request';
    }
    if (filter === 'resolved') {
      return c.status === 'resolved';
    }
    return true;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-100px)] flex overflow-hidden">
      
      {/* Sidebar: Conversation List */}
      <div className="w-84 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-bold text-slate-800 mb-3">WhatsApp Inbox</h2>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search customers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
                filter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({conversations.length})
            </button>
            <button
              onClick={() => setFilter('needs_human')}
              className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                filter === 'needs_human' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              🚨 Needs Human {countNeedsHuman > 0 && `(${countNeedsHuman})`}
            </button>
            <button
              onClick={() => setFilter('bot_active')}
              className={`px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                filter === 'bot_active' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              🤖 Bot ({countBotActive})
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
                filter === 'resolved' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Resolved ({countResolved})
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map(convo => {
            const needsHuman = convo.status === 'handover' || convo.requires_admin_attention || convo.intent === 'Human Request';
            return (
              <div 
                key={convo.id} 
                onClick={() => handleSelectConvo(convo)}
                className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                  selectedConvo?.id === convo.id 
                    ? 'bg-emerald-50 border-l-4 border-l-emerald-500' 
                    : needsHuman 
                    ? 'hover:bg-rose-50/40 border-l-4 border-l-rose-400 bg-rose-50/20' 
                    : 'hover:bg-white border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      {convo.customer_name || 'Unknown User'}
                      {needsHuman && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                    </span>
                    {convo.intent && (
                      <span className={`text-[10px] w-fit px-2 py-0.5 mt-1 rounded-full font-medium ${
                        needsHuman ? 'bg-rose-100 text-rose-700 font-bold' : convo.is_important ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {convo.intent}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {new Date(convo.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-500">{convo.customer_phone}</span>
                  {convo.assigned_bde_name && (
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 border border-slate-200" title={`Assigned BDE: ${convo.assigned_bde_name}`}>
                      <User className="w-2.5 h-2.5 text-slate-500" /> {convo.assigned_bde_name}
                    </span>
                  )}
                  {needsHuman ? (
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-rose-200">
                      <AlertCircle className="w-3 h-3 text-rose-600" /> Needs Human
                    </span>
                  ) : convo.status === 'resolved' ? (
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                      Resolved
                    </span>
                  ) : (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Bot className="w-3 h-3" /> AI Active
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">No conversations match this filter.</div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {selectedConvo ? (
        <div className="flex-1 flex flex-col relative" style={{ backgroundColor: '#EFEAE2' }}>
          
          {/* WhatsApp-inspired Doodle Pattern */}
          <div className="absolute inset-0 z-0 pointer-events-none" style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='0.04' stroke='%23000000' stroke-opacity='0.04' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M40 40 h20 v15 h-5 l-5 5 v-5 h-10 z' fill='none'/%3E%3Cpath d='M120 40 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 q 0 10 -10 15 q -10 -5 -10 -15 z' fill='none'/%3E%3Ccircle cx='80' cy='140' r='15' fill='none'/%3E%3Cpath d='M75 135 v2 M85 135 v2 M73 143 q 7 7 14 0' fill='none'/%3E%3Cpath d='M160 120 l 20 -10 l -5 25 l -5 -10 l -10 5 z' fill='none'/%3E%3Cpath d='M160 180 l 5 5 l 10 -10' fill='none'/%3E%3Cpath d='M30 160 v 20 h 15 v -20 z M35 175 h 5' fill='none'/%3E%3Ccircle cx='20' cy='100' r='1'/%3E%3Ccircle cx='180' cy='60' r='1'/%3E%3Ccircle cx='100' cy='90' r='1'/%3E%3Cpath d='M100 20 l 2 5 l 5 0 l -4 3 l 2 5 l -5 -4 l -5 4 l 2 -5 l -4 -3 l 5 0 z' fill='none'/%3E%3Cpath d='M10 10 q 5 0 5 -5 M15 15 l 10 10 M170 10 a10 10 0 0 0 10 10' fill='none'/%3E%3Cpath d='M50 180 h10 v10 h-10 z' fill='none'/%3E%3C/g%3E%3C/svg%3E")`, 
            backgroundSize: '200px' 
          }} />

          {/* Chat Header */}
          <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 relative z-[999] shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 leading-tight">{selectedConvo.customer_name}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>{selectedConvo.customer_phone}</span>
                  <span>•</span>
                  <span>
                    BDE: <strong className="text-emerald-700 font-semibold">{selectedConvo.assigned_bde_name || 'Unassigned'}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {selectedConvo.status === 'handover' ? (
                <button 
                  onClick={() => handleTakeover('open')}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Resume automated bot replies"
                >
                  <Bot className="w-4 h-4 text-emerald-600" /> Resume Bot
                </button>
              ) : (
                <button 
                  onClick={() => handleTakeover('handover')}
                  className="px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Pause bot and take over manually"
                >
                  <User className="w-4 h-4 text-amber-700" /> Pause Bot (Take Over)
                </button>
              )}
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors ${isDropdownOpen ? 'bg-slate-100 text-slate-600' : 'hover:bg-slate-100'}`}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-50 mb-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Options</p>
                    </div>
                    <button 
                      onClick={() => { setIsAssignModalOpen(true); setIsDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-slate-400" /> Assign BDE
                    </button>
                    <button 
                      onClick={() => handleTakeover('resolved')}
                      className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                      <Check className="w-4 h-4 text-slate-400" /> Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, idx) => {
              const isMine = msg.sender !== 'customer' && msg.sender !== 'user';
              return (
                <div key={msg.id || idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-xl px-4 py-3 shadow-sm ${
                    msg.sender === 'user' || msg.sender === 'customer' ? 'bg-white text-slate-800 rounded-tl-sm' :
                    msg.sender === 'ai' ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-sm' :
                    'bg-[#d9fdd3] text-slate-800 rounded-tr-sm'
                  }`}>
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    <div className={`text-[10px] mt-1 flex items-center gap-1.5 ${isMine ? 'text-emerald-700 justify-end' : 'text-slate-400'}`}>
                      {msg.sender === 'ai' ? (
                        <span className="flex items-center gap-0.5"><Bot className="w-3 h-3 opacity-70" /> AI</span>
                      ) : msg.sender === 'holding' ? (
                        <span className="flex items-center gap-0.5 font-semibold text-amber-700"><Bot className="w-3 h-3 opacity-70" /> Auto Holding Reply</span>
                      ) : isMine ? (
                        <span className="flex items-center gap-0.5 font-semibold text-emerald-800"><User className="w-3 h-3 opacity-70" /> {msg.sender === 'human' ? 'BDE' : msg.sender}</span>
                      ) : null}
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-[#f0f2f5] shrink-0 relative z-10 border-t border-slate-200">
            {selectedConvo.status === 'handover' ? (
              <div className="mb-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-800">
                <span className="flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  Bot paused for this customer. You are in manual reply mode.
                </span>
                <button
                  type="button"
                  onClick={() => handleTakeover('open')}
                  className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Bot className="w-3.5 h-3.5" /> Resume Bot
                </button>
              </div>
            ) : (
              <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-800">
                <span className="flex items-center gap-1.5 font-medium">
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
                  AI Bot is active. Typing a reply here will pause the bot and switch to manual takeover.
                </span>
                <button
                  type="button"
                  onClick={() => handleTakeover('handover')}
                  className="font-bold text-amber-700 hover:underline flex items-center gap-1"
                >
                  <User className="w-3.5 h-3.5" /> Pause Bot Now
                </button>
              </div>
            )}
            {/* Quick WhatsApp Reactions Bar */}
            <div className="flex items-center gap-1.5 mb-2 px-1 overflow-x-auto text-sm shrink-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-0.5">Quick:</span>
              {['👍', '🤝', '🙏', '😊', '🥥', '🍌', '📞', '📦', '✅', '🧾'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all text-base shadow-2xs hover:scale-115 shrink-0 select-none cursor-pointer"
                  title={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="flex items-end gap-2 relative">
              {/* WhatsApp Style Emoji Picker Popover */}
              {isEmojiPickerOpen && (
                <EmojiPicker 
                  onSelect={insertEmoji} 
                  onClose={() => setIsEmojiPickerOpen(false)} 
                />
              )}

              {/* Emoji Picker Toggle Button */}
              <button
                type="button"
                onClick={() => setIsEmojiPickerOpen(prev => !prev)}
                className={`h-[44px] w-[44px] flex items-center justify-center rounded-xl border transition-all shrink-0 cursor-pointer ${
                  isEmojiPickerOpen 
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-600 shadow-sm' 
                    : 'bg-white border-slate-300 text-slate-500 hover:text-emerald-600 hover:border-emerald-400 shadow-sm'
                }`}
                title="Add Emoji (WhatsApp style)"
              >
                <Smile className="w-5 h-5" />
              </button>

              <textarea 
                ref={textareaRef}
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                placeholder={selectedConvo.status === 'handover' ? "Type a reply as human BDE..." : "Type reply (sending will pause bot and take over)..."}
                className="flex-1 max-h-32 min-h-[44px] bg-white rounded-xl px-4 py-2.5 focus:outline-none shadow-sm resize-none text-sm text-slate-900 font-medium placeholder:text-slate-400 caret-emerald-600 border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                rows={1}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <button 
                type="submit"
                disabled={!inputMessage.trim()}
                className="h-[44px] px-5 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all shrink-0 shadow-sm hover:shadow-[0_0_15px_rgba(16,185,129,0.35)] cursor-pointer"
              >
                <Send className="w-4 h-4 ml-0.5" />
                <span>Send</span>
              </button>
            </form>
          </div>

        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 text-center p-8">
          <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">No Conversation Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a conversation from the sidebar to view the message history and reply to the customer.</p>
        </div>
      )}
      
      {/* Right Panel: Customer Details */}
      {selectedConvo && (
        <div className="w-72 border-l border-slate-200 bg-white shrink-0 hidden lg:block overflow-y-auto">
          <div className="p-6 border-b border-slate-100 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600">
              <User className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">{selectedConvo.customer_name}</h3>
            <p className="text-sm text-slate-500">Active Customer</p>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contact Details</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700 font-medium">{selectedConvo.customer_phone}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-xs text-slate-400 block">Assigned BDE</span>
                      <span className="text-slate-700 font-medium">{selectedConvo.assigned_bde_name || 'Unassigned'}</span>
                    </div>
                  </div>
                  {sessionStorage.getItem('shastika_role')?.toLowerCase() === 'admin' && (
                    <button 
                      onClick={() => setIsAssignModalOpen(true)}
                      className="text-xs text-emerald-600 hover:underline font-semibold"
                    >
                      Assign
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Updated {new Date(selectedConvo.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</h4>
              {selectedConvo.requires_admin_attention ? (
                <div className="flex items-start gap-2 text-rose-700 text-sm mb-3 font-bold bg-rose-50 p-2 rounded border border-rose-200">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>BDE On Leave. Admin attention required.</p>
                </div>
              ) : null}
              {selectedConvo.status === 'handover' ? (
                <div className="flex items-start gap-2 text-amber-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>AI is paused. A human agent is currently handling this chat.</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-blue-700 text-sm">
                  <Bot className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>AI is actively answering messages automatically.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Assign BDE Modal */}
      {isAssignModalOpen && selectedConvo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Assign BDE</h2>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
              {bdes.map(bde => (
                <button
                  key={bde.id}
                  onClick={() => handleAssignBDE(bde.id)}
                  className={`w-full text-left p-4 rounded-xl border flex items-center justify-between transition-colors ${
                    selectedConvo.assigned_bde_id === bde.id 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800' 
                      : 'border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{bde.name}</span>
                  </div>
                  {selectedConvo.assigned_bde_id === bde.id && <Check className="w-5 h-5 text-emerald-500" />}
                </button>
              ))}
              {bdes.length === 0 && (
                <div className="text-center p-4 text-sm text-slate-500">No active BDEs found. Create one in Employee Management.</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
