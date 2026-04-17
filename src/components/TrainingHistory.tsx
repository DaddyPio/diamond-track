import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { TrainingLog, UserProfile } from '../types';
import { motion } from 'motion/react';
import { ClipboardList, Calendar, ChevronLeft, ChevronRight, BarChart3, History } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, isWithinInterval, parseISO } from 'date-fns';

export default function TrainingHistory() {
  const { profile } = useAuth();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'monthly' | 'sixMonths'>('monthly');

  useEffect(() => {
    if (!profile?.teamId) return;

    const fetchPlayers = async () => {
      const q = query(
        collection(db, 'users'),
        where('teamId', '==', profile.teamId),
        where('role', '==', 'player')
      );
      const snapshot = await getDocs(q);
      setPlayers(snapshot.docs.map(doc => doc.data() as UserProfile));
    };

    fetchPlayers();

    const qLogs = query(
      collection(db, 'training_logs'),
      where('teamId', '==', profile.teamId)
    );

    const unsub = onSnapshot(qLogs, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingLog)));
    });

    return () => unsub();
  }, [profile]);

  const trainingTypes = ['打擊練習', '投球練習', '守備練習', '體能訓練', '戰術會議', '自主訓練'];

  const monthlyData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return players.map(player => {
      const playerLogs = logs.filter(l => {
        const d = l.date?.toDate ? l.date.toDate() : new Date(l.date);
        return l.playerUid === player.uid && isWithinInterval(d, { start: monthStart, end: monthEnd });
      });

      const typeCounts: Record<string, number> = {};
      trainingTypes.forEach(t => {
        typeCounts[t] = playerLogs.filter(l => l.type === t).length;
      });

      const uniqueDays = new Set(playerLogs.map(l => {
        const d = l.date?.toDate ? l.date.toDate() : new Date(l.date);
        return d.toDateString();
      }));

      return {
        ...player,
        totalDays: uniqueDays.size,
        typeCounts
      };
    });
  }, [players, logs, currentMonth]);

  const sixMonthsData = useMemo(() => {
    const end = new Date();
    const start = subMonths(end, 5);
    const months = eachMonthOfInterval({ start, end });

    return players.map(player => {
      const monthlyStats = months.map(m => {
        const mStart = startOfMonth(m);
        const mEnd = endOfMonth(m);
        const playerLogs = logs.filter(l => {
          const d = l.date?.toDate ? l.date.toDate() : new Date(l.date);
          return l.playerUid === player.uid && isWithinInterval(d, { start: mStart, end: mEnd });
        });

        const uniqueDays = new Set(playerLogs.map(l => {
          const d = l.date?.toDate ? l.date.toDate() : new Date(l.date);
          return d.toDateString();
        }));

        return {
          month: format(m, 'MM月'),
          days: uniqueDays.size
        };
      });

      return {
        ...player,
        monthlyStats
      };
    });
  }, [players, logs]);

  const changeMonth = (offset: number) => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + offset);
    setCurrentMonth(next);
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)] text-power-border">訓練記錄</h1>
          <p className="text-gray-500 font-black text-sm italic uppercase tracking-widest">追蹤全隊球員的訓練參與度與項目統計</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setViewMode('monthly')}
            className={cn(
              "px-6 py-3 rounded-xl font-black italic border-[3px] transition-all flex items-center gap-2",
              viewMode === 'monthly' ? "bg-power-blue text-white border-power-border" : "bg-white text-power-border border-transparent"
            )}
          >
            <Calendar className="w-5 h-5" /> 當月統計
          </button>
          <button 
            onClick={() => setViewMode('sixMonths')}
            className={cn(
              "px-6 py-3 rounded-xl font-black italic border-[3px] transition-all flex items-center gap-2",
              viewMode === 'sixMonths' ? "bg-power-blue text-white border-power-border" : "bg-white text-power-border border-transparent"
            )}
          >
            <History className="w-5 h-5" /> 半年趨勢
          </button>
        </div>
      </header>

      {viewMode === 'monthly' && (
        <div className="space-y-6">
          <div className="flex items-center justify-center bg-white border-[3px] border-power-border rounded-2xl overflow-hidden shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] w-fit mx-auto">
            <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-power-cream transition-colors border-r-2 border-power-border">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="px-8 font-black italic text-xl min-w-[160px] text-center">{format(currentMonth, 'yyyy / MM')}</span>
            <button onClick={() => changeMonth(1)} className="p-3 hover:bg-power-cream transition-colors border-l-2 border-power-border">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="power-card bg-white overflow-hidden border-[4px] border-power-border shadow-[8px_8px_0_0_rgba(0,0,0,0.1)]">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-power-blue text-white">
                    <th className="p-6 text-left font-black italic uppercase tracking-widest border-r-2 border-white/20 sticky left-0 bg-power-blue z-10 min-w-[200px] text-sm">
                      球員姓名 PLAYER
                    </th>
                    <th className="p-6 text-center font-black italic border-r-2 border-white/20 min-w-[100px] bg-power-blue/90 text-sm">
                      累積天數
                    </th>
                    {trainingTypes.map(type => (
                      <th key={type} className="p-6 text-center font-black italic border-r-2 border-white/20 min-w-[100px] text-sm">
                        {type.replace('練習', '').replace('訓練', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((player, idx) => (
                    <tr key={player.uid} className={cn(idx % 2 === 0 ? "bg-white" : "bg-power-cream/30", "border-b-2 border-power-border/5 hover:bg-power-blue/5 transition-colors")}>
                      <td className="p-6 font-black italic text-lg border-r-2 border-power-border/5 sticky left-0 bg-inherit z-10">
                        <div className="flex items-center gap-3">
                          <span className="text-power-blue">#{player.playerNumber}</span>
                          <span>{player.displayName}</span>
                        </div>
                      </td>
                      <td className="p-6 text-center border-r-2 border-power-border/5">
                        <span className="text-2xl font-black italic text-power-border">{player.totalDays}</span>
                      </td>
                      {trainingTypes.map(type => (
                        <td key={type} className="p-6 text-center border-r-2 border-power-border/5">
                          <span className={cn(
                            "text-xl font-black italic",
                            player.typeCounts[type] > 0 ? "text-power-blue" : "text-gray-300"
                          )}>
                            {player.typeCounts[type]}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'sixMonths' && (
        <div className="power-card bg-white overflow-hidden border-[4px] border-power-border shadow-[8px_8px_0_0_rgba(0,0,0,0.1)]">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-power-green text-white">
                  <th className="p-6 text-left font-black italic uppercase tracking-widest border-r-2 border-white/20 sticky left-0 bg-power-green z-10 min-w-[200px] text-sm">
                    球員姓名 PLAYER
                  </th>
                  {sixMonthsData[0]?.monthlyStats.map(s => (
                    <th key={s.month} className="p-6 text-center font-black italic border-r-2 border-white/20 min-w-[100px] text-sm">
                      {s.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sixMonthsData.map((player, idx) => (
                  <tr key={player.uid} className={cn(idx % 2 === 0 ? "bg-white" : "bg-power-cream/30", "border-b-2 border-power-border/5 hover:bg-power-blue/5 transition-colors")}>
                    <td className="p-6 font-black italic text-lg border-r-2 border-power-border/5 sticky left-0 bg-inherit z-10">
                      <div className="flex items-center gap-3">
                        <span className="text-power-green">#{player.playerNumber}</span>
                        <span>{player.displayName}</span>
                      </div>
                    </td>
                    {player.monthlyStats.map(s => (
                      <td key={s.month} className="p-6 text-center border-r-2 border-power-border/5">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-2xl font-black italic text-power-border">{s.days}</span>
                          <span className="text-[10px] font-black uppercase text-gray-400">天</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
