import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { TrainingLog, Instruction, UserProfile, InstructionCompletion, Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Circle as Baseball, ClipboardList, MessageSquare, Users, TrendingUp, Activity, BarChart2, Bell, Check, X, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, eachDayOfInterval, subDays } from 'date-fns';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, Radar as RadarComponent, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { cn } from '../lib/utils';

/** Single training_logs listener: recent list + weekly chart (see docs/database-strategy.md). */
const TRAINING_FEED_LIMIT = 200;

export default function CoachDashboard({ setActiveTab }: { setActiveTab: (tab: string, date?: string) => void }) {
  const { profile } = useAuth();
  const [recentLogs, setRecentLogs] = useState<TrainingLog[]>([]);
  const [weeklyLogs, setWeeklyLogs] = useState<TrainingLog[]>([]);
  const [recentInstructions, setRecentInstructions] = useState<Instruction[]>([]);
  const [completions, setCompletions] = useState<InstructionCompletion[]>([]);
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastMonthStats, setLastMonthStats] = useState({
    batting: 0,
    pitching: 0,
    fielding: 0,
    speed: 0,
    stamina: 0,
  });
  const [last3MonthsStats, setLast3MonthsStats] = useState({
    batting: 0,
    pitching: 0,
    fielding: 0,
    speed: 0,
    stamina: 0,
  });
  const [teamStats, setTeamStats] = useState({
    totalPlayers: 0,
    activePlayersThisMonth: 0,
    avgStats: {
      batting: 0,
      pitching: 0,
      fielding: 0,
      speed: 0,
      stamina: 0,
    }
  });

  useEffect(() => {
    if (!profile) return;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    const lastWeekStart = startOfDay(subDays(now, 6));

    const logDate = (log: TrainingLog) =>
      log.date?.toDate ? log.date.toDate() : new Date(log.date as string);

    // Players
    const usersQuery = query(
      collection(db, 'users'), 
      where('role', '==', 'player'),
      where('teamId', '==', profile.teamId)
    );
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const playersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setPlayers(playersData);
      const total = playersData.length;
      
      const avg = playersData.reduce((acc, p) => {
        if (p.stats) {
          acc.batting += p.stats.batting;
          acc.pitching += p.stats.pitching;
          acc.fielding += p.stats.fielding;
          acc.speed += p.stats.speed;
          acc.stamina += p.stats.stamina;
        }
        return acc;
      }, { batting: 0, pitching: 0, fielding: 0, speed: 0, stamina: 0 });

      if (total > 0) {
        Object.keys(avg).forEach(key => {
          avg[key as keyof typeof avg] = Math.round(avg[key as keyof typeof avg] / total);
        });
      }

      setTeamStats(prev => ({ ...prev, totalPlayers: total, avgStats: avg }));
    }, (error) => {
      console.error("CoachDashboard: Users listener error", error);
    });

    // Last Month Performance Records for comparison
    const lastMonthQuery = query(
      collection(db, 'performance_records'),
      where('teamId', '==', profile.teamId),
      where('date', '>=', lastMonthStart),
      where('date', '<=', lastMonthEnd)
    );
    getDocs(lastMonthQuery).then(snapshot => {
      const records = snapshot.docs.map(doc => doc.data());
      if (records.length > 0) {
        const avg = records.reduce((acc, r) => {
          if (r.stats) {
            acc.batting += r.stats.batting || 0;
            acc.pitching += r.stats.pitching || 0;
            acc.fielding += r.stats.fielding || 0;
            acc.speed += r.stats.speed || 0;
            acc.stamina += r.stats.stamina || 0;
          }
          return acc;
        }, { batting: 0, pitching: 0, fielding: 0, speed: 0, stamina: 0 });

        Object.keys(avg).forEach(key => {
          avg[key as keyof typeof avg] = Math.round(avg[key as keyof typeof avg] / records.length);
        });
        setLastMonthStats(avg);
      } else {
        // Fallback: slightly lower than current
        setLastMonthStats(prev => ({
          batting: Math.max(0, teamStats.avgStats.batting - 5),
          pitching: Math.max(0, teamStats.avgStats.pitching - 3),
          fielding: Math.max(0, teamStats.avgStats.fielding - 4),
          speed: Math.max(0, teamStats.avgStats.speed - 2),
          stamina: Math.max(0, teamStats.avgStats.stamina - 6),
        }));
      }
    });

    // Last 3 Months Performance Records for comparison
    const last3MonthsStart = startOfMonth(subMonths(now, 3));
    const last3MonthsQuery = query(
      collection(db, 'performance_records'),
      where('teamId', '==', profile.teamId),
      where('date', '>=', last3MonthsStart),
      where('date', '<=', now)
    );
    getDocs(last3MonthsQuery).then(snapshot => {
      const records = snapshot.docs.map(doc => doc.data());
      if (records.length > 0) {
        const avg = records.reduce((acc, r) => {
          if (r.stats) {
            acc.batting += r.stats.batting || 0;
            acc.pitching += r.stats.pitching || 0;
            acc.fielding += r.stats.fielding || 0;
            acc.speed += r.stats.speed || 0;
            acc.stamina += r.stats.stamina || 0;
          }
          return acc;
        }, { batting: 0, pitching: 0, fielding: 0, speed: 0, stamina: 0 });

        Object.keys(avg).forEach(key => {
          avg[key as keyof typeof avg] = Math.round(avg[key as keyof typeof avg] / records.length);
        });
        setLast3MonthsStats(avg);
      }
    });

    // Recent + weekly chart from one listener (see TRAINING_FEED_LIMIT in docs/database-strategy.md)
    const trainingFeedQuery = query(
      collection(db, 'training_logs'),
      where('teamId', '==', profile.teamId),
      orderBy('date', 'desc'),
      limit(TRAINING_FEED_LIMIT)
    );
    const unsubTrainingFeed = onSnapshot(trainingFeedQuery, (snapshot) => {
      const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingLog));
      setRecentLogs(all.slice(0, 20));
      const weekly = all
        .filter((log) => logDate(log) >= lastWeekStart)
        .sort((a, b) => logDate(a).getTime() - logDate(b).getTime());
      setWeeklyLogs(weekly);
    }, (error) => {
      console.error("CoachDashboard: Training feed listener error", error);
    });

    // Recent Instructions
    const instructionsQuery = query(
      collection(db, 'instructions'),
      where('teamId', '==', profile.teamId),
      where('coachUid', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const unsubInstructions = onSnapshot(instructionsQuery, (snapshot) => {
      setRecentInstructions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Instruction)));
    }, (error) => {
      console.error("CoachDashboard: Instructions listener error", error);
    });

    // Completions
    const completionsQuery = query(
      collection(db, 'instruction_completions'),
      where('teamId', '==', profile.teamId)
    );
    const unsubCompletions = onSnapshot(completionsQuery, (snapshot) => {
      setCompletions(snapshot.docs.map(doc => doc.data() as InstructionCompletion));
    }, (error) => {
      console.error("CoachDashboard: Completions listener error", error);
    });

    // Notifications
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsubNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    }, (error) => {
      console.error("CoachDashboard: Notifications listener error", error);
    });

    return () => {
      unsubUsers();
      unsubTrainingFeed();
      unsubInstructions();
      unsubCompletions();
      unsubNotifications();
    };
  }, [profile]);

  // Monthly active player count: full month scan on interval (cheaper than a third real-time listener).
  useEffect(() => {
    if (!profile?.teamId) return;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const logsThisMonthQuery = query(
      collection(db, 'training_logs'),
      where('teamId', '==', profile.teamId),
      where('date', '>=', monthStart),
      where('date', '<=', monthEnd)
    );

    const fetchActiveThisMonth = async () => {
      try {
        const snapshot = await getDocs(logsThisMonthQuery);
        const uniquePlayers = new Set(snapshot.docs.map((d) => d.data().playerUid as string));
        setTeamStats((prev) => ({ ...prev, activePlayersThisMonth: uniquePlayers.size }));
      } catch (error) {
        console.error('CoachDashboard: Active players this month fetch error', error);
      }
    };

    void fetchActiveThisMonth();
    const intervalId = window.setInterval(fetchActiveThisMonth, 45_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchActiveThisMonth();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [profile?.teamId]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const statsData = [
    { subject: '打擊', A: teamStats.avgStats.batting, fullMark: 100 },
    { subject: '投球', A: teamStats.avgStats.pitching, fullMark: 100 },
    { subject: '守備', A: teamStats.avgStats.fielding, fullMark: 100 },
    { subject: '速度', A: teamStats.avgStats.speed, fullMark: 100 },
    { subject: '體能', A: teamStats.avgStats.stamina, fullMark: 100 },
  ];

  const dailySummaries = useMemo(() => {
    const groups: Record<string, { date: any, logs: TrainingLog[] }> = {};
    
    recentLogs.forEach(log => {
      const date = log.date?.toDate ? log.date.toDate() : new Date(log.date);
      const dateStr = format(date, 'yyyy-MM-dd');
      if (!groups[dateStr]) {
        groups[dateStr] = { date: log.date, logs: [] };
      }
      groups[dateStr].logs.push(log);
    });

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5);
  }, [recentLogs]);

  const weeklyChartData = useMemo(() => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    });

    return days.map(day => {
      const dayStr = format(day, 'MM/dd');
      const dateKey = format(day, 'yyyy-MM-dd');
      const count = weeklyLogs.filter(log => {
        const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        return format(logDate, 'MM/dd') === dayStr;
      }).length;
      return { name: dayStr, count, fullDate: dateKey };
    });
  }, [weeklyLogs]);

  const getCompletionStats = (instruction: Instruction) => {
    const instructionCompletions = completions.filter(c => c.instructionId === instruction.id);
    let totalTargets = 0;
    
    if (instruction.targetUid === 'team') {
      totalTargets = players.length;
    } else if (instruction.targetUid === 'custom') {
      totalTargets = instruction.targetUids?.length || 0;
    } else {
      totalTargets = 1;
    }

    if (totalTargets === 0) return { percent: 0, count: 0, total: 0 };
    const count = instructionCompletions.length;
    return {
      percent: Math.round((count / totalTargets) * 100),
      count,
      total: totalTargets
    };
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)]">
              教練主頁 <span className="text-power-blue">COACH HUB</span>
            </h1>
            <p className="text-gray-500 font-black text-lg italic uppercase tracking-widest">監控球隊整體戰力與訓練狀況</p>
          </div>
        </div>
      </header>

      {/* Notifications Widget */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="power-card p-6 bg-power-yellow/10 border-power-yellow/30 border-[3px] shadow-[8px_8px_0_0_rgba(245,158,11,0.1)]"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black italic uppercase flex items-center gap-2 text-power-yellow">
            <Bell className={cn("w-6 h-6", notifications.some(n => !n.isRead) && "animate-bounce")} /> 訊息通知 MESSAGES
          </h2>
          <span className="bg-power-yellow text-power-border px-3 py-1 rounded-full text-xs font-black italic">
            {notifications.filter(n => !n.isRead).length} 則未讀
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="wait">
            {notifications.filter(n => !n.isRead).length > 0 ? (
              notifications.filter(n => !n.isRead).slice(0, 3).map((n) => (
                <motion.div 
                  key={n.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white p-4 rounded-2xl border-2 border-power-border/10 flex justify-between items-start group cursor-pointer hover:bg-power-cream transition-colors"
                  onClick={() => {
                    handleMarkAsRead(n.id!);
                    setActiveTab('instructions');
                  }}
                >
                  <div className="flex-1">
                    <p className="text-xs font-black text-power-blue uppercase mb-1">{n.title}</p>
                    <p className="text-sm font-medium text-power-border line-clamp-1">{n.content}</p>
                    <p className="text-[8px] text-gray-400 mt-2 font-black uppercase tracking-widest">
                      {n.createdAt?.toDate ? format(n.createdAt.toDate(), 'HH:mm') : '剛剛'}
                    </p>
                  </div>
                  <button 
                    className="p-1 hover:bg-power-green/10 rounded-lg text-gray-300 group-hover:text-power-green transition-colors"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-4 text-center opacity-30">
                <p className="font-black italic uppercase tracking-widest text-sm text-power-border">目前沒有新訊息</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button 
          onClick={() => setActiveTab('roster')}
          className="power-card p-6 flex items-center gap-4 bg-gradient-to-br from-white to-power-blue/5 hover:scale-105 transition-transform text-left w-full"
        >
          <div className="p-3 bg-power-blue/20 rounded-2xl border-2 border-power-blue/30">
            <Users className="w-8 h-8 text-power-blue" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">球員總數</p>
            <p className="text-3xl font-black italic text-power-border">{teamStats.totalPlayers} <span className="text-sm font-bold text-gray-400">人</span></p>
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('attendance')}
          className="power-card p-6 flex items-center gap-4 bg-gradient-to-br from-white to-power-green/5 hover:scale-105 transition-transform text-left w-full"
        >
          <div className="p-3 bg-power-green/20 rounded-2xl border-2 border-power-green/30">
            <Activity className="w-8 h-8 text-power-green" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">本月練球出席</p>
            <p className="text-3xl font-black italic text-power-border">{teamStats.activePlayersThisMonth} <span className="text-sm font-bold text-gray-400">人</span></p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Team Radar Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="power-card p-8 flex flex-col items-center cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => setActiveTab('performance')}
        >
          <div className="flex justify-between items-center mb-8 self-start w-full">
            <h2 className="text-2xl font-black italic uppercase flex items-center gap-3">
              <div className="bg-power-blue p-2 rounded-xl">
                <Baseball className="w-6 h-6 text-white" />
              </div>
              團隊戰力分析
            </h2>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">平均能力值 OVERALL</p>
              <p className="text-4xl font-black italic text-power-blue leading-none">
                {Math.round((Object.values(teamStats.avgStats) as number[]).reduce((acc, val) => acc + val, 0) / 5)}
              </p>
            </div>
          </div>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={statsData}>
                <PolarGrid stroke="#ddd" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#333', fontSize: 14, fontWeight: 900 }} />
                <RadarComponent
                  name="本月平均"
                  dataKey="A"
                  stroke="#0066cc"
                  fill="#0066cc"
                  fillOpacity={0.4}
                  strokeWidth={3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Stats Table */}
          <div className="w-full mt-8 overflow-hidden border-[3px] border-power-border rounded-2xl">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-power-blue text-white text-[10px] font-black uppercase tracking-widest">
                  <th className="p-2 border-r border-white/20">項目</th>
                  <th className="p-2 border-r border-white/20">本月平均</th>
                  <th className="p-2">近3月平均</th>
                </tr>
              </thead>
              <tbody className="bg-white text-xs font-black italic">
                {statsData.map((stat, idx) => {
                  const last3 = Object.values(last3MonthsStats)[idx] || 0;
                  return (
                    <tr key={stat.subject} className="border-t border-power-border/5">
                      <td className="p-2 border-r border-power-border/5 bg-power-cream/30">{stat.subject}</td>
                      <td className="p-2 border-r border-power-border/5 text-power-blue">{stat.A}</td>
                      <td className="p-2 text-gray-500">{last3}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Weekly Training Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="power-card p-8 flex flex-col cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => setActiveTab('daily-logs')}
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black italic uppercase flex items-center gap-3">
              <div className="bg-power-green p-2 rounded-xl">
                <BarChart2 className="w-6 h-6 text-white" />
              </div>
              全隊最近訓練 (週統計)
            </h2>
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveTab('daily-logs'); }}
              className="text-xs font-black italic uppercase text-power-green hover:underline flex items-center gap-1"
            >
              詳細日誌 LOGS <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{fontSize: 12, fontWeight: 900}} />
                <YAxis tick={{fontSize: 12, fontWeight: 900}} />
                <Tooltip contentStyle={{ borderRadius: '1rem', border: '3px solid #1a1a1a', fontWeight: 900 }} />
                <Bar 
                  dataKey="count" 
                  name="訓練次數" 
                  fill="#10b981" 
                  radius={[8, 8, 0, 0]} 
                  onClick={(data: any) => {
                    if (data && data.fullDate) {
                      setActiveTab('daily-logs', data.fullDate);
                    }
                  }}
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Team Logs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="power-card p-8 cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => setActiveTab('daily-logs')}
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black italic uppercase flex items-center gap-3">
              <div className="bg-power-green p-2 rounded-xl">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              全隊最近訓練記錄
            </h2>
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveTab('daily-logs'); }}
              className="text-xs font-black italic uppercase text-power-green hover:underline flex items-center gap-1"
            >
              更多紀錄 MORE <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-6">
            {dailySummaries.length > 0 ? dailySummaries.map(([dateStr, group]) => {
              const types = group.logs.reduce((acc, log) => {
                acc[log.type] = (acc[log.type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              return (
                <div 
                  key={dateStr} 
                  onClick={() => setActiveTab('daily-logs', dateStr)}
                  className="p-5 bg-power-cream border-[3px] border-power-border rounded-2xl hover:bg-white hover:shadow-[4px_4px_0_0_rgba(245,158,11,0.2)] hover:scale-[1.02] transition-all group cursor-pointer"
                >
                  <div className="flex justify-between items-center mb-4 border-b-2 border-power-border/5 pb-2">
                    <span className="text-lg font-black italic text-power-border">
                      {group.date?.toDate ? format(group.date.toDate(), 'MM/dd') : format(new Date(dateStr), 'MM/dd')}
                    </span>
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                      共 {group.logs.length} 筆紀錄
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(types).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-2 px-3 py-1 bg-white border-2 border-power-border/10 rounded-lg">
                        <span className="w-2 h-2 rounded-full bg-power-green"></span>
                        <span className="text-xs font-black italic">{type}</span>
                        <span className="bg-power-green/10 text-power-green px-1.5 rounded text-[10px] font-black">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex -space-x-2 overflow-hidden">
                    {group.logs.slice(0, 5).map((log, i) => {
                      const player = players.find(p => p.uid === log.playerUid);
                      return (
                        <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-power-blue flex items-center justify-center text-[10px] font-black text-white italic border-2 border-power-border">
                          {player?.displayName?.substring(0, 1) || '?'}
                        </div>
                      );
                    })}
                    {group.logs.length > 5 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white bg-gray-100 text-[10px] font-black text-gray-500 border-2 border-power-border">
                        +{group.logs.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-16 opacity-30">
                <ClipboardList className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="italic font-black text-xl uppercase tracking-widest">尚無訓練紀錄</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Instructions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="power-card p-8 cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => setActiveTab('instructions')}
        >
          <h2 className="text-2xl font-black italic uppercase mb-8 flex items-center gap-3">
            <div className="bg-power-yellow p-2 rounded-xl">
              <MessageSquare className="w-6 h-6 text-power-border" />
            </div>
            發佈的指示
          </h2>
          <div className="space-y-4">
            {recentInstructions.length > 0 ? recentInstructions.map((instruction) => {
              const stats = getCompletionStats(instruction);
              return (
                <div key={instruction.id} className="p-5 bg-power-cream border-[3px] border-power-border rounded-2xl hover:bg-white hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black italic text-power-blue uppercase tracking-tight">{instruction.title}</h3>
                    <div className="flex flex-col items-end">
                      <span className="text-lg font-black italic text-power-blue leading-none">{stats.percent}%</span>
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">完成度</span>
                    </div>
                  </div>
                  <p className="text-sm text-power-border line-clamp-2 mb-4 font-medium">{instruction.content}</p>
                  <div className="flex justify-between items-center text-[10px] text-gray-500 font-black uppercase tracking-widest border-t-2 border-power-border/5 pt-3">
                    <span className="bg-power-border text-white px-2 py-0.5 rounded">
                      {instruction.targetUid === 'team' ? '全隊' : instruction.targetUid === 'custom' ? '群組' : '個人'}
                    </span>
                    <span>{instruction.createdAt?.toDate ? format(instruction.createdAt.toDate(), 'yyyy/MM/dd') : '剛剛'}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-16 opacity-30">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="italic font-black text-xl uppercase tracking-widest">尚無發佈指示</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
