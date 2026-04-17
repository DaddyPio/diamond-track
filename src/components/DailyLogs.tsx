import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { TrainingLog, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ClipboardList, ChevronLeft, User, Search, Check } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

interface DailyLogsProps {
  onBack: () => void;
  initialDate?: string;
}

export default function DailyLogs({ onBack, initialDate }: DailyLogsProps) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile?.teamId) return;

    const fetchPlayers = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('teamId', '==', profile.teamId),
          where('role', '==', 'player')
        );
        const snapshot = await getDocs(q);
        setPlayers(snapshot.docs.map(doc => doc.data() as UserProfile));
      } catch (error) {
        console.error("DailyLogs: Error fetching players:", error);
      }
    };

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const qLogs = query(
          collection(db, 'training_logs'),
          where('teamId', '==', profile.teamId),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(qLogs);
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingLog)));
      } catch (error) {
        console.error("DailyLogs: Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
    fetchLogs();
  }, [profile]);

  // Group logs by date
  const groupedLogs = logs.reduce((acc, log) => {
    const dateStr = log.date?.toDate ? format(log.date.toDate(), 'yyyy-MM-dd') : format(new Date(log.date), 'yyyy-MM-dd');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(log);
    return acc;
  }, {} as Record<string, TrainingLog[]>);

  const sortedDates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  const baseTypes = ['打擊練習', '投球練習', '守備練習', '體能訓練', '自主訓練'];
  const allLogsTypes = Array.from(new Set(logs.map(l => l.type))) as string[];
  const otherTypes = allLogsTypes.filter(t => !baseTypes.includes(t));
  const finalTypes = [...baseTypes, '其他'];

  useEffect(() => {
    if (!loading && initialDate) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`daily-log-${initialDate}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, initialDate]);

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 bg-white border-[3px] border-power-border rounded-2xl hover:bg-power-cream transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-power-border">
              訓練日誌總覽 <span className="text-power-blue">DAILY TRAINING LOGS</span>
            </h1>
            <p className="text-gray-500 font-black text-sm italic uppercase tracking-widest">
              以日為單位查看全隊訓練參與情形
            </p>
          </div>
        </div>

        <div className="relative group max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-power-blue transition-colors" />
          <input
            type="text"
            placeholder="搜尋球員姓名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="power-input w-full pl-12 py-3"
          />
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-power-blue"></div>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="power-card p-20 bg-white text-center opacity-30">
          <ClipboardList className="w-20 h-20 mx-auto mb-6 text-gray-400" />
          <p className="text-2xl font-black uppercase italic tracking-widest">目前尚無任何訓練紀錄</p>
        </div>
      ) : (
        <div className="space-y-12">
          {sortedDates.map((dateStr) => {
            const dateLogs = groupedLogs[dateStr];
            const filteredPlayers = players.filter(p => 
              p.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (filteredPlayers.length === 0) return null;

            return (
              <motion.section 
                key={dateStr}
                id={`daily-log-${dateStr}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 bg-power-border text-white px-6 py-3 rounded-t-2xl skew-x-[-10deg] ml-4 w-fit">
                  <Calendar className="w-5 h-5 skew-x-[10deg]" />
                  <span className="text-xl font-black italic skew-x-[10deg]">{dateStr}</span>
                </div>

                <div className="power-card bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-power-cream/50 text-power-border text-xs font-black uppercase tracking-widest border-b-[3px] border-power-border">
                          <th className="px-6 py-4 sticky left-0 bg-power-cream/50 z-10 w-48">球員姓名 NAME</th>
                          <th className="px-6 py-4 text-center">筆數 LOGS</th>
                          {baseTypes.map(type => (
                            <th key={type} className="px-6 py-4 text-center min-w-[120px]">{type}</th>
                          ))}
                          <th className="px-6 py-4 text-center min-w-[120px]">其他 OTHER</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-power-border/5">
                        {filteredPlayers.map((player) => {
                          const playerLogs = dateLogs.filter(l => l.playerUid === player.uid);
                          const hasTrained = playerLogs.length > 0;
                          
                          return (
                            <tr key={player.uid} className={cn("hover:bg-power-cream/30 transition-colors", !hasTrained && "opacity-40")}>
                              <td className="px-6 py-4 sticky left-0 bg-white z-10">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-power-cream border-2 border-power-border rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                                    {player.photoURL ? (
                                      <img src={player.photoURL} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                    ) : (
                                      <User className="w-5 h-5 text-power-border/30" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-black italic text-power-border text-sm leading-none truncate">{player.displayName}</p>
                                    <p className="text-[10px] font-black text-gray-400 mt-1">#{player.playerNumber || '00'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {hasTrained ? (
                                  <span className="text-xl font-black italic text-power-blue">
                                    {playerLogs.length}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-300 font-black uppercase tracking-tight">X</span>
                                )}
                              </td>
                              {baseTypes.map(type => {
                                const didThisType = playerLogs.some(l => l.type === type);
                                return (
                                  <td key={type} className="px-6 py-4 text-center">
                                    {didThisType ? (
                                      <div className="w-8 h-8 bg-power-green/20 text-power-green rounded-full flex items-center justify-center mx-auto border-2 border-power-green/30">
                                        <Check className="w-4 h-4" />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-200 mx-auto" />
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-6 py-4 text-center text-xs">
                                {playerLogs.some(l => !baseTypes.includes(l.type)) ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="w-8 h-8 bg-power-yellow/20 text-power-yellow rounded-full flex items-center justify-center mx-auto border-2 border-power-yellow/30">
                                      <Check className="w-4 h-4" />
                                    </div>
                                    <span className="text-[8px] font-black text-power-yellow whitespace-nowrap">
                                      {playerLogs.filter(l => !baseTypes.includes(l.type)).map(l => l.type).join(', ')}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-200 mx-auto" />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.section>
            );
          })}
        </div>
      )}
    </div>
  );
}
