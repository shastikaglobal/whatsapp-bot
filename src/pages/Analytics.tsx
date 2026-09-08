import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  Users, MessageSquareText, Mail, Send, Bot, 
  Settings, Bell, Activity, Clock 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30days');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let url = '/analytics';
      if (dateRange !== 'all') {
        const end = new Date();
        const start = new Date();
        if (dateRange === 'today') start.setHours(0,0,0,0);
        else if (dateRange === '7days') start.setDate(end.getDate() - 7);
        else if (dateRange === '30days') start.setDate(end.getDate() - 30);
        
        // format to YYYY-MM-DD HH:mm:ss for MySQL
        const formatDate = (d: Date) => {
          const tzoffset = d.getTimezoneOffset() * 60000;
          return new Date(d.getTime() - tzoffset).toISOString().slice(0, 19).replace('T', ' ');
        };
        
        url += `?startDate=${encodeURIComponent(formatDate(start))}&endDate=${encodeURIComponent(formatDate(end))}`;
      }
      
      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return <div className="p-8 text-center text-slate-500">Loading analytics...</div>;
  }

  const m = data?.metrics || {};
  const charts = data?.charts || {};

  const COLORS = ['#10b981', '#0ea5e9']; // Emerald for AI, Sky for Rule

  // Format seconds to readable string
  const formatTime = (secs: number) => {
    if (!secs) return '0s';
    if (secs < 60) return `${Math.round(secs)}s`;
    return `${Math.floor(secs/60)}m ${Math.round(secs%60)}s`;
  };

  // Prevent PieChart from crashing on empty data
  const hasPieData = charts.aiVsRule && charts.aiVsRule.some((d: any) => d.value > 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Analytics & Insights</h2>
          <p className="text-sm text-slate-500 mt-1">Monitor your CRM performance and bot metrics.</p>
        </div>
        <select 
          className="p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
        >
          <option value="today">Today</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="card-pro stat-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Customers</div>
            <div className="text-2xl font-bold text-slate-900">{m.totalCustomers || 0}</div>
          </div>
        </div>

        <div className="card-pro stat-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <MessageSquareText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversations</div>
            <div className="text-2xl font-bold text-slate-900">{m.totalConversations || 0}</div>
          </div>
        </div>

        <div className="card-pro stat-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Messages Received</div>
            <div className="text-2xl font-bold text-slate-900">{m.messagesReceived || 0}</div>
          </div>
        </div>

        <div className="card-pro stat-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Messages Sent</div>
            <div className="text-2xl font-bold text-slate-900">{m.messagesSent || 0}</div>
          </div>
        </div>

        <div className="card-pro stat-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Replies</div>
            <div className="text-2xl font-bold text-slate-900">{m.aiReplies || 0}</div>
          </div>
        </div>

        <div className="card-pro stat-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rule Replies</div>
            <div className="text-2xl font-bold text-slate-900">{m.ruleReplies || 0}</div>
          </div>
        </div>

        <div className="card-pro stat-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unread Convos</div>
            <div className="text-2xl font-bold text-slate-900">{m.unreadConversations || 0}</div>
          </div>
        </div>

        <div className="card-pro stat-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Response</div>
            <div className="text-2xl font-bold text-slate-900">{formatTime(m.avgResponseTimeSeconds)}</div>
          </div>
        </div>

      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        
        <div className="panel-card flex flex-col mb-0">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-slate-800">Message Volume</h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.messages || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRecv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#475569', paddingTop: '10px' }} />
                <Area type="monotone" name="Received" dataKey="received" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorRecv)" />
                <Area type="monotone" name="Sent" dataKey="sent" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-rows-2 gap-6">
          <div className="panel-card flex flex-col mb-0 h-full min-h-[220px]">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-slate-400" />
              <h3 className="font-bold text-slate-800">New Customers</h3>
            </div>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.customers || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <YAxis tick={{fontSize: 10, fill: '#64748b'}} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar name="New Customers" dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel-card flex flex-col mb-0 h-full min-h-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-5 h-5 text-slate-400" />
              <h3 className="font-bold text-slate-800">Reply Distribution</h3>
            </div>
            <div className="flex-1 w-full flex items-center justify-center">
              {hasPieData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.aiVsRule || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {(charts.aiVsRule || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#475569' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 italic">No reply data available for this period.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
