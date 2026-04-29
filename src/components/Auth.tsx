import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, ArrowRight, TrendingUp, ShieldCheck, Diamond } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onAuthSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4">
      {/* Logo Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col items-center"
      >
        <div className="w-16 h-16 bg-gradient-to-tr from-brand-purple to-brand-blue rounded-2xl flex items-center justify-center shadow-lg shadow-brand-purple/20 mb-4">
          <Diamond size={32} className="text-white fill-white/20" />
        </div>
        <h1 className="text-3xl font-bold font-display tracking-tight text-white mb-2">BINTEX</h1>
        <p className="text-gray-400 text-sm font-medium">Professional Trading Platform</p>
      </motion.div>

      <motion.div 
        layout
        className="w-full max-w-md glass-card p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-purple/10 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-brand-blue/10 blur-[100px] pointer-events-none" />

        <div className="flex gap-4 mb-8">
          <button 
            onClick={() => setIsLogin(true)}
            className={`flex-1 pb-2 font-semibold transition-all border-b-2 ${isLogin ? 'text-white border-brand-purple' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
          >
            Login
          </button>
          <button 
            onClick={() => setIsLogin(false)}
            className={`flex-1 pb-2 font-semibold transition-all border-b-2 ${!isLogin ? 'text-white border-brand-purple' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-purple transition-all placeholder:text-gray-600"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-purple transition-all placeholder:text-gray-600"
                placeholder="••••••••"
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-lg border border-red-400/20"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit"
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? 'Sign In' : 'Create Account'}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
            <ShieldCheck size={14} className="text-green-500" />
            SECURE AUTH
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium justify-end">
            <TrendingUp size={14} className="text-blue-500" />
            LIVE MARKET
          </div>
        </div>
      </motion.div>

      <p className="mt-8 text-xs text-gray-600 text-center max-w-xs leading-relaxed">
        By continuing, you agree to BINTEX's Terms of Service and Privacy Policy. Trading involves significant risk.
      </p>
    </div>
  );
};
