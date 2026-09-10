import React, { useEffect, useState, useRef } from 'react';
import { Search, Send, User, Bot, AlertCircle, Phone, Clock, MoreVertical, X } from 'lucide-react';
import api from '../api/axios';

interface Conversation {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  status: 'open' | 'handover' | 'resolved';
  updated_at: string;
}

interface Message {
  id: string;
  customer_id: string;
  sender: 'user' | 'ai' | 'human';
  content: string;
  timestamp: string;
}

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    fetchMessages(convo.customer_id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedConvo) return;

    const tempMsg = inputMessage;
    setInputMessage('');

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
    } catch (err) {
      console.error('Failed to send', err);
    }
  };

  const handleTakeover = async (status: 'open' | 'handover') => {
    if (!selectedConvo) return;
    try {
      await api.put('/whatsapp/takeover', { customerId: selectedConvo.customer_id, status });
      setSelectedConvo({ ...selectedConvo, status });
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.customer_name?.toLowerCase().includes(search.toLowerCase()) || 
    c.customer_phone?.includes(search)
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-100px)] flex overflow-hidden">
      
      {/* Sidebar: Conversation List */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">WhatsApp Inbox</h2>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search customers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map(convo => (
            <div 
              key={convo.id} 
              onClick={() => handleSelectConvo(convo)}
              className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${selectedConvo?.id === convo.id ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-white border-l-4 border-l-transparent'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-slate-800">{convo.customer_name || 'Unknown User'}</span>
                <span className="text-[10px] text-slate-500">
                  {new Date(convo.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-500">{convo.customer_phone}</span>
                {convo.status === 'handover' ? (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <User className="w-3 h-3" /> Human
                  </span>
                ) : (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Bot className="w-3 h-3" /> AI Active
                  </span>
                )}
              </div>
            </div>
          ))}
          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">No conversations found.</div>
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
          <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 relative z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 leading-tight">{selectedConvo.customer_name}</h3>
                <span className="text-xs text-slate-500">{selectedConvo.customer_phone}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {selectedConvo.status === 'handover' ? (
                <button 
                  onClick={() => handleTakeover('open')}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Bot className="w-4 h-4" /> Return to AI
                </button>
              ) : (
                <button 
                  onClick={() => handleTakeover('handover')}
                  className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <User className="w-4 h-4" /> Human Takeover
                </button>
              )}
              <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 relative z-10">
            {messages.map((msg, idx) => {
              const isMine = msg.sender === 'ai' || msg.sender === 'human';
              return (
                <div key={msg.id || idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-xl px-4 py-3 shadow-sm ${
                    msg.sender === 'user' ? 'bg-white text-slate-800 rounded-tl-sm' :
                    msg.sender === 'ai' ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-sm' :
                    'bg-[#d9fdd3] text-slate-800 rounded-tr-sm'
                  }`}>
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    <div className={`text-[10px] mt-1 flex items-center gap-1 ${isMine ? 'text-emerald-700 justify-end' : 'text-slate-400'}`}>
                      {msg.sender === 'ai' && <Bot className="w-3 h-3 opacity-70" />}
                      {msg.sender === 'human' && <User className="w-3 h-3 opacity-70" />}
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-[#f0f2f5] shrink-0 relative z-10">
            {selectedConvo.status === 'open' ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-center gap-3 text-slate-500 text-sm shadow-sm">
                <Bot className="w-5 h-5" />
                AI is currently handling this conversation. Take over to reply manually.
                <button 
                  onClick={() => handleTakeover('handover')}
                  className="ml-2 text-amber-600 font-bold hover:underline"
                >
                  Takeover Now
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <textarea 
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 max-h-32 min-h-[44px] bg-white rounded-xl px-4 py-2.5 focus:outline-none shadow-sm resize-none text-sm border-none"
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
                  className="h-[44px] w-[44px] flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white rounded-full transition-colors shrink-0 shadow-sm"
                >
                  <Send className="w-4 h-4 ml-0.5" /> 
                </button>
              </form>
            )}
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
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Updated {new Date(selectedConvo.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</h4>
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

    </div>
  );
}
