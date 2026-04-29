import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Clock, IndianRupee, ChevronRight, History, X, Target, Activity, Wallet, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface Trade {
  id: string;
  asset: string;
  type: 'buy' | 'sell';
  amount: number;
  status: 'win' | 'loss' | 'pending';
  profit: number;
  time: number;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(val);
};

export const TradeHistory: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch('/api/trades');
        if (response.ok) {
          const data = await response.json();
          setTrades(data.trades);
        }
      } catch (err) {
        console.error('Failed to fetch trades', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrades();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-brand-dark p-6">
        <div className="w-8 h-8 border-2 border-brand-purple/20 border-t-brand-purple rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm font-medium">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-brand-dark custom-scrollbar pb-20">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
           <div className="p-2 bg-brand-purple/10 rounded-lg">
             <History className="text-brand-purple" size={20} />
           </div>
           <div>
             <h2 className="text-xl font-bold">Trade History</h2>
             <p className="text-xs text-gray-500 font-medium">Your recent performance and activity</p>
           </div>
        </div>

        {trades.length === 0 ? (
          <div className="text-center py-24 bg-[#1c222d] rounded-3xl border border-white/5 flex flex-col items-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-inner">
               <History size={32} className="text-gray-600" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">No Trades Found</h3>
            <p className="text-gray-500 text-sm font-medium max-w-[240px] mx-auto">No trades found for this period. Start trading to see your history here!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trades.map((trade, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={trade.id}
                onClick={() => setSelectedTrade(trade)}
                className={`glass-card p-4 flex items-center justify-between border-l-4 transition-all group overflow-hidden cursor-pointer active:scale-[0.98] ${
                  trade.status === 'win' 
                    ? 'border-green-500/50 hover:bg-green-500/5' 
                    : trade.status === 'loss'
                    ? 'border-red-500/50 hover:bg-red-500/5'
                    : 'border-blue-500/50 hover:bg-blue-500/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    trade.type === 'buy' 
                      ? 'bg-green-500/10 text-green-500 group-hover:scale-110' 
                      : 'bg-red-500/10 text-red-500 group-hover:scale-110'
                  }`}>
                    {trade.type === 'buy' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  </div>
                  
                  <div>
                    <div className="font-bold text-sm tracking-tight flex items-center gap-2">
                       {trade.asset}
                       <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${
                         trade.status === 'win' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                       }`}>
                         {trade.status}
                       </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                      <Clock size={10} />
                      {new Date(trade.time).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`font-black text-sm ${
                      trade.status === 'win' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {trade.status === 'win' ? '+' : ''}{formatCurrency(trade.profit)}
                    </div>
                    <div className="text-[10px] text-gray-600 font-bold uppercase">
                      {trade.type} {formatCurrency(trade.amount)}
                    </div>
                  </div>
                  
                  <ChevronRight size={16} className="text-gray-700 group-hover:text-gray-400 transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Trade Detail Modal */}
      <AnimatePresence>
        {selectedTrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedTrade(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-[#161a22] border border-[#2d3340] rounded-3xl overflow-hidden shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="text-xl font-black text-white">Trade Details</h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Order ID: {selectedTrade.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedTrade(null)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Result Section */}
                <div className="flex flex-col items-center text-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                    selectedTrade.status === 'win' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                  }`}>
                    {selectedTrade.status === 'win' ? <CheckCircle2 size={48} /> : <AlertCircle size={48} />}
                  </div>
                  <h5 className={`text-4xl font-black mb-1 ${
                    selectedTrade.status === 'win' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {selectedTrade.status === 'win' ? '+' : ''}{formatCurrency(selectedTrade.profit)}
                  </h5>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Payout</p>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                       <Target size={12} className="text-gray-500" />
                       <span className="text-[10px] font-bold uppercase text-gray-500">Asset</span>
                    </div>
                    <div className="text-sm font-black text-white">{selectedTrade.asset}</div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                       <Activity size={12} className="text-gray-500" />
                       <span className="text-[10px] font-bold uppercase text-gray-500">Type</span>
                    </div>
                    <div className={`text-sm font-black uppercase ${selectedTrade.type === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                      {selectedTrade.type} (High)
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                       <Wallet size={12} className="text-gray-500" />
                       <span className="text-[10px] font-bold uppercase text-gray-500">Investment</span>
                    </div>
                    <div className="text-sm font-black text-white">{formatCurrency(selectedTrade.amount)}</div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                       <Clock size={12} className="text-gray-500" />
                       <span className="text-[10px] font-bold uppercase text-gray-500">Duration</span>
                    </div>
                    <div className="text-sm font-black text-white">60 Seconds</div>
                  </div>
                </div>

                {/* Footer Meta */}
                <div className="bg-[#0b0e14] rounded-2xl p-4 border border-white/5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold uppercase text-gray-500">Execution Time</span>
                    <span className="text-[10px] font-black text-white">{new Date(selectedTrade.time).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-gray-500">Status</span>
                    <div className="flex items-center gap-1">
                      <ShieldCheck size={12} className="text-blue-500" />
                      <span className="text-[10px] font-black text-blue-500 uppercase">Confirmed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-6 pt-0">
                 <button 
                  onClick={() => setSelectedTrade(null)}
                  className="w-full py-4 bg-white text-black rounded-xl font-black text-sm active:scale-95 transition-all shadow-xl shadow-white/5"
                 >
                   Got it
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
