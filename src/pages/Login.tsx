import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, KeyRound, Mail, ArrowLeft } from 'lucide-react';
import api from '../api/axios';

export default function Login() {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const res = await api.post('/login', { password });
      if (res.data.token) {
        localStorage.setItem('shastika_token', res.data.token);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const res = await api.post('/forgot-password', { email });
      setSuccess(res.data.message || 'Recovery email sent.');
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center tracking-tight">Shastika Bot CRM</h1>
          <p className="text-slate-400 text-sm mt-2">
            {isForgotPassword ? 'Recover your admin password' : 'Enter the admin password to continue'}
          </p>
        </div>

        {!isForgotPassword ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Admin Password"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  required
                />
              </div>
              {error && <p className="text-red-400 text-sm mt-2 font-medium">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 flex justify-center"
            >
              {isLoading ? 'Authenticating...' : 'Secure Login'}
            </button>
            
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setIsForgotPassword(true); setError(''); setSuccess(''); }}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Admin Email Address"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  required
                />
              </div>
              {error && <p className="text-red-400 text-sm mt-2 font-medium">{error}</p>}
              {success && <p className="text-emerald-400 text-sm mt-2 font-medium">{success}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 flex justify-center"
            >
              {isLoading ? 'Sending...' : 'Send Recovery Email'}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setIsForgotPassword(false); setError(''); setSuccess(''); }}
                className="inline-flex items-center text-sm text-slate-400 hover:text-slate-300 transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
