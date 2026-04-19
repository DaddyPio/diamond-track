import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, where, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { TrainingLog, Instruction, Notification, PerformanceRecord } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Circle as Baseball, ClipboardList, TrendingUp, Trophy, Target, Activity, Bell, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, Radar as RadarComponent, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';

export default function PlayerDashboard({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { profile } = useAuth();
  const [recentLogs, setRecentLogs] = useState<TrainingLog[]>([]);
  const [monthlyLogsCount, setMonthlyLogsCount] = useState(0);
  const [monthlyTrainingDays, setMonthlyTrainingDays] = useState(0);
  const [pendingInstructionsCount, setPendingInstructionsCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [performanceRecords, setPerformanceRecords] = useState<PerformanceRecord[]>([]);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      try {
        // Recent Logs
        const logsQuery = query(
          collection(db, 'training_logs'),
          where('teamId', '==', profile.teamId),
          where('playerUid', '==', profile.uid),
          orderBy('date', 'desc'),
          limit(5)
        );
        const logsSnap = await getDocs(logsQuery);
        setRecentLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingLog)));

        // Monthly Logs & Days
        const monthlyQuery = query(
          collection(db, 'training_logs'),
          where('teamId', '==', profile.teamId),
          where('playerUid', '==', profile.uid),
          where('date', '>=', monthStart),
          where('date', '<=', monthEnd)
        );
        const monthlySnap = await getDocs(monthlyQuery);
        const monthlyLogs = monthlySnap.docs.map(doc => doc.data() as TrainingLog);
        setMonthlyLogsCount(monthlyLogs.length);
        
        const uniqueDays = new Set(monthlyLogs.map(l => {
          const d = l.date?.toDate ? l.date.toDate() : new Date(l.date as string);
          return d.toDateString();
        }));
        setMonthlyTrainingDays(uniqueDays.size);

        // Instructions
        const instructionsQuery = query(
          collection(db, 'instructions'),
          where('teamId', '==', profile.teamId)
        );
        const instructionsSnap = await getDocs(instructionsQuery);
        const allInstructions = instructionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Instruction))
          .filter(inst => 
            inst.targetUid === 'team' || 
            inst.targetUid === profile.uid || 
            (inst.targetUid === 'custom' && inst.targetUids?.includes(profile.uid))
          );

        const qComp = query(
          collection(db, 'instruction_completions'),
          where('teamId', '==', profile.teamId),
          where('playerUid', '==', profile.uid)
        );
        const compSnap = await getDocs(qComp);
        const completedIds = compSnap.docs.map(doc => doc.data().instructionId);
        const pending = allInstructions.filter(inst => !completedIds.includes(inst.id));
        setPendingInstructionsCount(pending.length);

        // Notifications
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('recipientUid', '==', profile.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const notificationsSnap = await getDocs(notificationsQuery);
        setNotifications(notificationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));

        // Performance Records
        const perfQuery = query(
          collection(db, 'performance_records'),
          where('playerUid', '==', profile.uid),
          where('teamId', '==', profile.teamId),
          orderBy('date', 'desc')
        );
        const perfSnap = await getDocs(perfQuery);
        setPerformanceRecords(perfSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PerformanceRecord)));

      } catch (error) {
        console.error("PlayerDashboard: Error fetching dashboard data:", error);
      }
    };

    fetchData();
  }, [profile]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const statsData = profile?.stats ? [
    { subject: '打擊', A: profile.stats.batting, fullMark: 100 },
    { subject: '投球', A: profile.stats.pitching, fullMark: 100 },
    { subject: '守備', A: profile.stats.fielding, fullMark: 100 },
    { subject: '速度', A: profile.stats.speed, fullMark: 100 },
    { subject: '體能', A: profile.stats.stamina, fullMark: 100 },
  ] : [];

  // Calculate summary from performance records
  const gameRecords = performanceRecords.filter(r => r.type === 'game');
  const testRecords = performanceRecords.filter(r => r.type === 'test');
  
  const totalHits = gameRecords.reduce((acc, r) => acc + (r.stats.hits || 0), 0);
  const totalAB = gameRecords.reduce((acc, r) => acc + (r.stats.atBats || 0), 0);
  const totalBB = gameRecords.reduce((acc, r) => acc + (r.stats.walks || 0), 0);
  const totalPA = gameRecords.reduce((acc, r) => acc + (r.stats.plateAppearances || 0), 0);
  const totalHR = gameRecords.reduce((acc, r) => acc + (r.stats.hr || 0), 0);
  const totalRBI = gameRecords.reduce((acc, r) => acc + (r.stats.rbi || 0), 0);
  const totalSB = gameRecords.reduce((acc, r) => acc + (r.stats.stolenBases || 0), 0);
  
  const totalER = gameRecords.reduce((acc, r) => acc + (r.stats.earnedRuns || 0), 0);
  const totalIP = gameRecords.reduce((acc, r) => acc + (r.stats.inningsPitched || 0), 0);
  const totalHA = gameRecords.reduce((acc, r) => acc + (r.stats.hitsAllowed || 0), 0);
  const totalPBB = gameRecords.reduce((acc, r) => acc + (r.stats.pitcherWalks || 0), 0);
  const totalStrikes = gameRecords.reduce((acc, r) => acc + (r.stats.strikes || 0), 0);
  const totalPitches = gameRecords.reduce((acc, r) => acc + (r.stats.totalPitches || 0), 0);
  
  const calculatedStats = {
    avg: totalAB > 0 ? (totalHits / totalAB) : 0,
    obp: totalPA > 0 ? ((totalHits + totalBB) / totalPA) : 0,
    hr: totalHR,
    rbi: totalRBI,
    sb: totalSB,
    era: totalIP > 0 ? ((totalER * 9) / totalIP) : 0,
    whip: totalIP > 0 ? ((totalHA + totalPBB) / totalIP) : 0,
    strikeRate: totalPitches > 0 ? (totalStrikes / totalPitches) : 0,
    wins: gameRecords.reduce((acc, r) => acc + (r.stats.wins || 0), 0)
  };

  const bestTests = {
    runningSpeed: testRecords.length > 0 ? Math.min(...testRecords.map(r => r.stats.runningSpeed || 99)) : null,
    pitchingVelocity: testRecords.length > 0 ? Math.max(...testRecords.map(r => r.stats.pitchingVelocity || 0)) : null,
    throwingDistance: testRecords.length > 0 ? Math.max(...testRecords.map(r => r.stats.throwingDistance || 0)) : null,
  };

  const gameStats = calculatedStats;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)]">
              球員主頁 <span className="text-power-blue">PLAYER HUB</span>
            </h1>
            <p className="text-gray-500 font-black text-lg italic uppercase tracking-widest">追蹤您的訓練進度與比賽表現</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="power-card p-6 flex items-center gap-4 bg-gradient-to-br from-white to-power-green/5">
          <div className="p-3 bg-power-green/20 rounded-2xl border-2 border-power-green/30">
            <Activity className="w-8 h-8 text-power-green" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">本月訓練</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black italic text-power-border">{monthlyLogsCount} <span className="text-xs font-bold text-gray-400">次</span></p>
              <p className="text-xl font-black italic text-power-blue">{monthlyTrainingDays} <span className="text-xs font-bold text-gray-400">天</span></p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setActiveTab('instructions')}
          className="power-card p-6 flex items-center gap-4 bg-gradient-to-br from-white to-power-blue/5 hover:scale-105 transition-transform text-left"
        >
          <div className="p-3 bg-power-blue/20 rounded-2xl border-2 border-power-blue/30">
            <Target className="w-8 h-8 text-power-blue" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">待辦指令</p>
            <p className="text-3xl font-black italic text-power-border">{pendingInstructionsCount} <span className="text-sm font-bold text-gray-400">項</span></p>
          </div>
        </button>
    <div className="power-card p-6 flex items-center gap-4 bg-gradient-to-br from-white to-power-yellow/5">
      <div className="p-3 bg-power-yellow/20 rounded-2xl border-2 border-power-yellow/30">
        <Trophy className="w-8 h-8 text-power-yellow" />
      </div>
      <div>
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">打擊率 AVG</p>
        <p className="text-3xl font-black italic text-power-border leading-none">{gameStats.avg.toFixed(3).replace(/^0/, '')}</p>
      </div>
    </div>
    <div className="power-card p-6 flex items-center gap-4 bg-gradient-to-br from-white to-power-red/5">
      <div className="p-3 bg-power-red/20 rounded-2xl border-2 border-power-red/30">
        <TrendingUp className="w-8 h-8 text-power-red" />
      </div>
      <div>
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">上壘率 OBP</p>
        <p className="text-3xl font-black italic text-power-border leading-none">{gameStats.obp.toFixed(3).replace(/^0/, '')}</p>
      </div>
    </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Radar Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-1 power-card p-8 flex flex-col items-center"
        >
          <h2 className="text-2xl font-black italic uppercase mb-8 self-start flex items-center gap-3">
            <div className="bg-power-blue p-2 rounded-xl">
              <Baseball className="w-6 h-6 text-white" />
            </div>
            能力分析
          </h2>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={statsData}>
                <PolarGrid stroke="#ddd" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#333', fontSize: 14, fontWeight: 900 }} />
                <RadarComponent
                  name="能力值"
                  dataKey="A"
                  stroke="#0066cc"
                  fill="#0066cc"
                  fillOpacity={0.4}
                  strokeWidth={3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 w-full">
            {statsData.map(stat => (
              <div key={stat.subject} className="flex justify-between items-center p-4 bg-power-cream border-[3px] border-power-border rounded-2xl shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
                <span className="text-xs text-gray-600 font-black uppercase tracking-widest">{stat.subject}</span>
                <span className="text-xl font-black italic text-power-blue">{stat.A}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Game Stats Detail */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 power-card p-8 cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => setActiveTab('performance-history')}
        >
          <h2 className="text-2xl font-black italic uppercase mb-8 flex items-center gap-3">
            <div className="bg-power-yellow p-2 rounded-xl">
              <Trophy className="w-6 h-6 text-power-border" />
            </div>
            比賽與測驗成績
          </h2>
          <div className="space-y-6">
            <div className="p-6 bg-power-cream border-[3px] border-power-border rounded-[2rem] shadow-[6px_6px_0_0_rgba(0,0,0,0.05)]">
              <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest mb-6 border-b-2 border-power-border/10 pb-2">打擊累計 BATTING</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <p className="text-2xl md:text-3xl font-black italic text-power-border leading-none">{gameStats.avg.toFixed(3).replace(/^0/, '')}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">打擊率 AVG</p>
                </div>
                <div>
                  <p className="text-2xl md:text-3xl font-black italic text-power-border leading-none">{gameStats.obp.toFixed(3).replace(/^0/, '')}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">上壘率 OBP</p>
                </div>
                <div>
                  <p className="text-2xl md:text-3xl font-black italic text-power-border leading-none">{gameStats.hr}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">全壘打 HR</p>
                </div>
                <div>
                  <p className="text-2xl md:text-3xl font-black italic text-power-border leading-none">{gameStats.sb}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">盜壘 SB</p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-power-cream border-[3px] border-power-border rounded-[2rem] shadow-[6px_6px_0_0_rgba(0,0,0,0.05)]">
              <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest mb-6 border-b-2 border-power-border/10 pb-2">投球累計 PITCHING</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <p className="text-2xl md:text-3xl font-black italic text-power-border leading-none">{gameStats.era.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">防禦率 ERA</p>
                </div>
                <div>
                  <p className="text-2xl md:text-3xl font-black italic text-power-border leading-none">{gameStats.whip.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">WHIP</p>
                </div>
                <div>
                  <p className="text-2xl md:text-3xl font-black italic text-power-border leading-none">{(gameStats.strikeRate * 100).toFixed(2)}<span className="text-sm ml-0.5">%</span></p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">好球率 S%</p>
                </div>
                <div>
                  <p className="text-2xl md:text-3xl font-black italic text-power-border leading-none">{gameStats.wins}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">勝場 WINS</p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-power-cream border-[3px] border-power-border rounded-[2rem] shadow-[6px_6px_0_0_rgba(0,0,0,0.05)]">
              <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest mb-6 border-b-2 border-power-border/10 pb-2">測驗最佳 BEST TESTS</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <p className="text-2xl md:text-3xl font-black italic text-power-green leading-none">
                    {bestTests.runningSpeed && bestTests.runningSpeed !== 99 ? bestTests.runningSpeed.toFixed(2) : '-'}
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">最快跑速 (SEC)</p>
                </div>
                <div>
                  <p className="text-2xl md:text-3xl font-black italic text-power-green leading-none">
                    {bestTests.pitchingVelocity || '-'}
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">最快球速 (KM)</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Logs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 power-card p-8"
        >
          <h2 className="text-2xl font-black italic uppercase mb-8 flex items-center gap-3">
            <div className="bg-power-green p-2 rounded-xl">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            最近訓練紀錄
          </h2>
          <div className="space-y-4">
            {recentLogs.length > 0 ? recentLogs.map((log) => (
              <div key={log.id} className="p-5 bg-power-cream border-[3px] border-power-border rounded-2xl hover:bg-white hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <span className="px-3 py-1 bg-power-green text-white text-[10px] font-black uppercase rounded-lg border-2 border-power-border">
                    {log.type}
                  </span>
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                    {log.date?.toDate ? format(log.date.toDate(), 'MM/dd') : '剛剛'}
                  </span>
                </div>
                <p className="text-sm font-black italic line-clamp-2 text-power-border group-hover:text-power-blue transition-colors">{log.description}</p>
              </div>
            )) : (
              <div className="text-center py-16 opacity-30">
                <ClipboardList className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="italic font-black text-xl uppercase tracking-widest">尚無訓練紀錄</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
