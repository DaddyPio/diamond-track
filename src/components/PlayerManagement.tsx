import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, UserMinus, Check, X, ShieldAlert, Users, Search, Filter, Circle as Baseball } from 'lucide-react';
import { cn } from '../lib/utils';

export default function PlayerManagement() {
  const { profile } = useAuth();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!profile?.teamId) return;

    const q = query(
      collection(db, 'users'),
      where('teamId', '==', profile.teamId),
      where('role', '==', 'player')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    });

    return () => unsub();
  }, [profile]);

  const handleApprove = async (playerUid: string) => {
    try {
      await updateDoc(doc(db, 'users', playerUid), {
        status: 'approved'
      });
      setMessage({ type: 'success', text: '球員已核准加入球隊！' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error approving player:", error);
      setMessage({ type: 'error', text: '核准失敗，請稍後再試。' });
    }
  };

  const handleReject = async (playerUid: string) => {
    if (!window.confirm('確定要取消此球員的加入申請嗎？')) return;
    try {
      await updateDoc(doc(db, 'users', playerUid), {
        teamId: null,
        status: null
      });
      setMessage({ type: 'success', text: '申請已取消。' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error rejecting player:", error);
      setMessage({ type: 'error', text: '操作失敗。' });
    }
  };

  const handleRemove = async (playerUid: string) => {
    if (!window.confirm('確定要將此球員移出球隊嗎？該球員將無法再進入此球隊系統。')) return;
    try {
      await updateDoc(doc(db, 'users', playerUid), {
        teamId: null,
        status: null
      });
      setMessage({ type: 'success', text: '球員已移出球隊。' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error removing player:", error);
      setMessage({ type: 'error', text: '操作失敗。' });
    }
  };

  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.playerNumber?.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = players.filter(p => p.status === 'pending').length;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)] text-power-border">管理球員</h1>
          <p className="text-gray-500 font-black text-sm italic uppercase tracking-widest">核准新球員加入或管理現有成員</p>
        </div>

        <div className="flex gap-4">
          <div className="power-card bg-power-blue text-white px-6 py-4 flex items-center gap-4 border-[3px] border-power-border">
            <Users className="w-8 h-8 opacity-50" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none">球隊總人數</p>
              <p className="text-2xl font-black italic">{players.filter(p => p.status === 'approved').length}</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <div className="power-card bg-power-yellow text-power-border px-6 py-4 flex items-center gap-4 border-[3px] border-power-border animate-bounce">
              <UserPlus className="w-8 h-8" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none">待核准申請</p>
                <p className="text-2xl font-black italic">{pendingCount}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-5 rounded-2xl font-black italic uppercase tracking-widest border-[3px] flex items-center gap-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]",
            message.type === 'success' ? "bg-power-green/10 text-power-green border-power-green/30" : "bg-power-red/10 text-power-red border-power-red/30"
          )}
        >
          <ShieldAlert className="w-6 h-6" />
          {message.text}
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text"
            placeholder="搜尋球員姓名或背號..."
            className="power-input w-full pl-12 pr-4 py-4 font-black italic shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-white border-[3px] border-power-border rounded-2xl overflow-hidden shadow-inner">
          <button 
            onClick={() => setFilterStatus('all')}
            className={cn("px-6 py-4 font-black italic uppercase tracking-widest transition-colors", filterStatus === 'all' ? "bg-power-blue text-white" : "hover:bg-power-cream")}
          >
            全部
          </button>
          <button 
            onClick={() => setFilterStatus('approved')}
            className={cn("px-6 py-4 font-black italic uppercase tracking-widest border-x-2 border-power-border transition-colors", filterStatus === 'approved' ? "bg-power-green text-white" : "hover:bg-power-cream")}
          >
            正式球員
          </button>
          <button 
            onClick={() => setFilterStatus('pending')}
            className={cn("px-6 py-4 font-black italic uppercase tracking-widest transition-colors", filterStatus === 'pending' ? "bg-power-yellow text-power-border" : "hover:bg-power-cream")}
          >
            待核准
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredPlayers.map((player) => (
            <motion.div 
              key={player.uid}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "power-card overflow-hidden transition-all bg-white relative",
                player.status === 'pending' ? "border-power-yellow border-[3px]" : "border-power-border border-[3px]"
              )}
            >
              {player.status === 'pending' && (
                <div className="absolute top-4 right-4 bg-power-yellow text-power-border px-3 py-1 rounded-full text-[10px] font-black uppercase italic tracking-widest border-2 border-power-border shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]">
                  PENDING
                </div>
              )}
              
              <div className="p-8">
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-20 h-20 bg-power-cream border-4 border-power-border rounded-2xl flex items-center justify-center overflow-hidden shrink-0 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
                    {player.photoURL ? (
                      <img src={player.photoURL} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <Baseball className="w-10 h-10 text-power-border/20" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black italic uppercase text-power-border">
                      <span className="text-power-blue mr-2">#{player.playerNumber || '--'}</span>
                      {player.displayName}
                    </h3>
                    <p className="text-gray-400 font-black text-xs uppercase tracking-widest mt-1">{player.position || '尚未設定守位'}</p>
                    <p className="text-[10px] text-gray-500 font-bold mt-2 truncate w-40">{player.email}</p>
                  </div>
                </div>

                {player.status === 'pending' ? (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => handleApprove(player.uid)}
                      className="flex-1 power-button bg-power-green text-white py-3 flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      核准加入
                    </button>
                    <button 
                      onClick={() => handleReject(player.uid)}
                      className="power-button bg-power-red text-white p-3"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleRemove(player.uid)}
                    className="w-full power-button bg-white text-power-red border-power-red/30 py-3 flex items-center justify-center gap-2 hover:bg-power-red hover:text-white transition-all"
                  >
                    <UserMinus className="w-5 h-5" />
                    移出球隊 REMOVE
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredPlayers.length === 0 && (
        <div className="text-center py-24 opacity-20">
          <Users className="w-24 h-24 mx-auto mb-6" />
          <h3 className="text-3xl font-black italic uppercase italic">查無球員資料</h3>
        </div>
      )}
    </div>
  );
}
