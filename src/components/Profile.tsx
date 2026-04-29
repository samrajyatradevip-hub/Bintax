import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Wallet, 
  Banknote, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  RefreshCw, 
  ShieldCheck, 
  ChevronDown, 
  Settings2, 
  LogOut, 
  ArrowUpRight, 
  ArrowDownRight,
  Shield,
  Key,
  Smartphone,
  Mail,
  UserCircle,
  Bell
} from 'lucide-react';

interface ProfileProps {
  user: any;
  balance: number;
  transactions: any[];
  isTransactionsLoading: boolean;
  onRefreshTransactions: () => void;
  onLogout: () => void;
  onWithdraw: () => void;
  onDeposit?: () => void;
  alerts: any[];
  onDeleteAlert: (id: string) => void;
  formatCurrency: (val: number) => string;
}

export const Profile: React.FC<ProfileProps> = ({
  user,
  balance,
  transactions,
  isTransactionsLoading,
  onRefreshTransactions,
  onLogout,
  onWithdraw,
  onDeposit,
  alerts,
  onDeleteAlert,
  formatCurrency
}) => {
  const [activeSubView, setActiveSubView] = useState<'main' | 'security' | 'account'>('main');

  if (activeSubView === 'security') {
    return (
      <div className="flex-1 flex flex-col bg-[#0b0e14] overflow-y-auto custom-scrollbar p-6">
        <div className="flex items-center gap-3 mb-8">
          <button 
            onClick={() => setActiveSubView('main')}
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <ChevronDown size={20} className="rotate-90" />
          </button>
          <h3 className="text-xl font-black text-white">Security Settings</h3>
        </div>

        <div className="space-y-4">
          <div className="bg-[#1c222d] border border-[#2d3340] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                <Key size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Change Password</div>
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">Last updated 2 days ago</div>
              </div>
            </div>
            <button className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-2 rounded-lg hover:bg-blue-500/20 transition-all">Update</button>
          </div>

          <div className="bg-[#1c222d] border border-[#2d3340] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
                < Smartphone size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Two-Factor Authentication</div>
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">Highly recommended</div>
              </div>
            </div>
            <div className="w-10 h-[22px] bg-green-600 rounded-full relative p-0.5 cursor-pointer">
              <div className="w-4 h-4 bg-white rounded-full translate-x-5" />
            </div>
          </div>

          <div className="bg-[#1c222d] border border-[#2d3340] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
                <Shield size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Login Activity</div>
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">Check your current sessions</div>
              </div>
            </div>
            <ChevronDown size={16} className="text-gray-600 -rotate-90" />
          </div>
        </div>

        <div className="mt-8 text-center p-6 border-2 border-dashed border-white/5 rounded-3xl">
           <ShieldCheck size={48} className="text-blue-500/20 mx-auto mb-4" />
           <p className="text-gray-500 text-xs font-bold leading-relaxed">
             Your account is protected by industry-standard encryption and security protocols.
           </p>
        </div>
      </div>
    );
  }

  if (activeSubView === 'account') {
    return (
      <div className="flex-1 flex flex-col bg-[#0b0e14] overflow-y-auto custom-scrollbar p-6">
        <div className="flex items-center gap-3 mb-8">
          <button 
            onClick={() => setActiveSubView('main')}
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <ChevronDown size={20} className="rotate-90" />
          </button>
          <h3 className="text-xl font-black text-white">Account Management</h3>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Email Address</label>
            <div className="bg-[#1c222d] border border-[#2d3340] rounded-xl p-4 flex items-center gap-3">
              <Mail size={18} className="text-gray-500" />
              <div className="text-sm font-bold text-white">{user.email}</div>
              <div className="ml-auto bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-[8px] font-black uppercase">Verified</div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Full Name</label>
            <div className="bg-[#1c222d] border border-[#2d3340] rounded-xl p-4 flex items-center gap-3">
              <UserCircle size={18} className="text-gray-500" />
              <input 
                type="text" 
                defaultValue={user.email.split('@')[0]}
                className="bg-transparent border-none outline-none text-sm font-bold text-white w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Trading Currency</label>
            <div className="bg-[#1c222d] border border-[#2d3340] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Banknote size={18} className="text-gray-500" />
                <span className="text-sm font-bold text-white">Indian Rupee (INR)</span>
              </div>
              <ChevronDown size={16} className="text-gray-600" />
            </div>
          </div>
          
          <div className="pt-4">
            <button className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-sm transition-all border border-white/5">
              Request Data Deletion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0b0e14] overflow-y-auto custom-scrollbar">
      {/* Profile Header */}
      <div className="p-6 pb-0">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-purple to-blue-600 flex items-center justify-center border border-white/10 shadow-xl">
            <User size={32} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white leading-tight">{user.email.split('@')[0]}</h3>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">{user.email}</p>
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-[#1c222d] border border-[#2d3340] rounded-2xl p-5 shadow-2xl relative overflow-hidden mb-6">
          <div className="relative z-10">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Balance</div>
            <div className="text-3xl font-black text-white mb-4">{formatCurrency(balance).replace('₹', '₹ ')}</div>
            
            <div className="flex gap-3">
              <button 
                onClick={onWithdraw}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl py-3 text-xs font-black transition-all flex items-center justify-center gap-2"
              >
                <Wallet size={16} className="text-blue-400" />
                Withdraw
              </button>
              <button 
                onClick={onDeposit}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-xl py-3 text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
              >
                <Banknote size={16} />
                Deposit
              </button>
            </div>
          </div>
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl opacity-50" />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#1c222d] border border-[#2d3340] rounded-2xl p-4">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Status</div>
            <div className="text-sm font-black text-green-500">Verified</div>
          </div>
          <div className="bg-[#1c222d] border border-[#2d3340] rounded-2xl p-4">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Level</div>
            <div className="text-sm font-black text-yellow-500">Trader</div>
          </div>
        </div>

        {/* Active Alerts */}
        {alerts.filter(a => a.status === 'active').length > 0 && (
          <div className="mb-6">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Active Alerts</div>
            <div className="space-y-2">
              {alerts.filter(a => a.status === 'active').map(alert => (
                <div key={alert.id} className="bg-[#1c222d] border border-[#2d3340] rounded-xl p-3 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                      alert.type === 'above' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
                    }`}>
                      {alert.type === 'above' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-black text-white">{alert.assetId.split(':')[1] || alert.assetId}</div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                        {alert.type === 'above' ? 'Above' : 'Below'} {formatCurrency(alert.targetPrice)}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDeleteAlert(alert.id)}
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Transaction History</div>
            <button 
              onClick={onRefreshTransactions}
              className={`text-gray-500 hover:text-white transition-colors ${isTransactionsLoading ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="bg-[#1c222d]/50 border border-[#2d3340]/50 rounded-xl p-8 text-center">
                <Banknote size={24} className="text-gray-700 mx-auto mb-2" />
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">No Transactions Found</p>
              </div>
            ) : (
              transactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="bg-[#1c222d] border border-[#2d3340] rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${
                      tx.type === 'deposit' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                    }`}>
                      {tx.type === 'deposit' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-black text-white capitalize">{tx.type}</div>
                      <div className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">
                        {new Date(tx.time).toLocaleDateString()} • {tx.method}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-black ${tx.type === 'deposit' ? 'text-green-500' : 'text-blue-400'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount).replace('₹', '')}
                    </div>
                    <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${
                      tx.status === 'completed' || tx.status === 'success' ? 'bg-green-500/20 text-green-500' : 
                      tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'
                    }`}>
                      {tx.status}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Settings List */}
        <div className="bg-[#1c222d]/50 rounded-2xl overflow-hidden border border-[#2d3340]/50 mb-8">
          <button 
            onClick={() => setActiveSubView('security')}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-blue-500" />
              <span className="text-sm font-bold text-gray-300">Security & Privacy</span>
            </div>
            <ChevronDown size={16} className="text-gray-600 -rotate-90" />
          </button>
          <button 
            onClick={() => setActiveSubView('account')}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5"
          >
            <div className="flex items-center gap-3">
              <Settings2 size={18} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-300">Account Settings</span>
            </div>
            <ChevronDown size={16} className="text-gray-600 -rotate-90" />
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LogOut size={18} className="text-red-500" />
              <span className="text-sm font-bold text-red-500">Sign Out</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
