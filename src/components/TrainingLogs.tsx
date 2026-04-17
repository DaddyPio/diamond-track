import React, { useEffect, useState } from 'react';
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { TrainingLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ClipboardList, Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Circle as Baseball } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { cn } from '../lib/utils';

export default function TrainingLogs() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [newLog, setNewLog] = useState({
    type: '打擊練習',
    description: '',
    duration: 30,
    customDate: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    if (!user || !profile?.teamId) return;

    const fetchLogs = async () => {
      try {
        const q = query(
          collection(db, 'training_logs'),
          where('teamId', '==', profile.teamId),
          where('playerUid', '==', user.uid),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingLog)));
      } catch (error) {
        console.error("TrainingLogs: Error fetching logs:", error);
      }
    };

    fetchLogs();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.teamId) return;

    try {
      const logDate = newLog.customDate ? new Date(newLog.customDate) : new Date();
      // Set time to current time if it's today, otherwise set to noon
      if (isSameDay(logDate, new Date())) {
        logDate.setHours(new Date().getHours(), new Date().getMinutes());
      } else {
        logDate.setHours(12, 0, 0, 0);
      }

      await addDoc(collection(db, 'training_logs'), {
        playerUid: user.uid,
        teamId: profile.teamId,
        date: logDate,
        type: newLog.type,
        description: newLog.description,
        duration: newLog.duration,
      });
      setIsAdding(false);
      setNewLog({ type: '打擊練習', description: '', duration: 30, customDate: format(new Date(), 'yyyy-MM-dd') });
    } catch (error) {
      console.error("Error adding log:", error);
    }
  };

  // Calendar Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  
  const monthlyLogs = logs.filter(log => {
    if (!log.date) return false;
    const logDate = log.date.toDate ? log.date.toDate() : new Date(log.date);
    return isWithinInterval(logDate, { start: monthStart, end: monthEnd });
  });

  const monthlyStats = {
    days: new Set(monthlyLogs.map(log => {
      const d = log.date?.toDate ? log.date.toDate() : new Date(log.date);
      return d.toDateString();
    })).size,
    counts: monthlyLogs.reduce((acc, log) => {
      acc[log.type] = (acc[log.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getLogsForDay = (day: Date) => {
    return logs.filter(log => {
      if (!log.date) return false;
      const logDate = log.date.toDate ? log.date.toDate() : new Date(log.date);
      return isSameDay(logDate, day);
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div className="flex items-center gap-6">
          <motion.div 
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-20 h-20 bg-white rounded-2xl border-[3px] border-power-border shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] flex items-center justify-center hidden md:flex"
          >
            <ClipboardList className="w-10 h-10 text-power-blue" />
          </motion.div>
          <div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)]">訓練紀錄</h1>
            <p className="text-gray-500 font-black text-lg italic uppercase tracking-widest">以月曆形式追蹤您的進步</p>
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="power-button bg-power-green text-white px-8 py-4 text-xl flex items-center gap-3"
        >
          <Plus className="w-6 h-6" />
          新增紀錄
        </button>
      </header>

      {/* Monthly Summary */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="power-card p-8 bg-white border-[4px] border-power-border"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-power-blue p-3 rounded-2xl">
            <ClipboardList className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">每月訓練總結</h2>
            <p className="text-gray-500 text-xs font-black uppercase tracking-widest">{format(currentMonth, 'yyyy MMMM', { locale: zhTW })} SUMMARY</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-power-cream p-6 rounded-2xl border-2 border-power-border shadow-inner">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">累積訓練天數</p>
            <p className="text-3xl font-black italic text-power-blue">{monthlyStats.days} <span className="text-sm font-bold text-gray-400">天</span></p>
          </div>
          <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(monthlyStats.counts).map(([type, count]) => (
              <div key={type} className="bg-white p-4 rounded-xl border-2 border-power-border/10 flex flex-col justify-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{type}</p>
                <p className="text-xl font-black italic text-power-border">{count} <span className="text-[10px] font-bold text-gray-400">次</span></p>
              </div>
            ))}
            {Object.keys(monthlyStats.counts).length === 0 && (
              <div className="col-span-full flex items-center justify-center py-4 opacity-30">
                <p className="text-sm font-black italic uppercase tracking-widest">本月尚無訓練數據</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="power-card p-10 bg-gradient-to-br from-white to-power-green/5"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest">訓練日期 DATE</label>
                <input 
                  type="date"
                  className="power-input w-full p-4 font-black italic"
                  value={newLog.customDate}
                  onChange={(e) => setNewLog({...newLog, customDate: e.target.value})}
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest">訓練類型 TYPE</label>
                <select 
                  className="power-input w-full p-4 font-black italic bg-white"
                  value={newLog.type}
                  onChange={(e) => setNewLog({...newLog, type: e.target.value})}
                >
                  <option value="打擊練習">打擊練習</option>
                  <option value="投球練習">投球練習</option>
                  <option value="守備練習">守備練習</option>
                  <option value="體能訓練">體能訓練</option>
                  <option value="重量訓練">重量訓練</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest">持續時間 DURATION (MIN)</label>
                <input 
                  type="number"
                  className="power-input w-full p-4 font-black italic"
                  value={newLog.duration}
                  onChange={(e) => setNewLog({...newLog, duration: parseInt(e.target.value)})}
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-black uppercase text-gray-500 tracking-widest">訓練內容描述 DESCRIPTION</label>
              <textarea 
                className="power-input w-full p-6 h-40 font-black italic resize-none"
                placeholder="今天練習了什麼？有什麼心得？"
                value={newLog.description}
                onChange={(e) => setNewLog({...newLog, description: e.target.value})}
              />
            </div>
            <div className="flex gap-6">
              <button 
                type="submit"
                className="flex-1 power-button bg-power-blue text-white py-5 text-2xl"
              >
                儲存紀錄 SAVE
              </button>
              <button 
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-12 power-button bg-white text-power-border py-5 text-2xl"
              >
                取消 CANCEL
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Calendar View */}
      <div className="power-card overflow-hidden bg-white">
        <div className="p-8 border-b-[4px] border-power-border bg-power-blue text-white flex items-center justify-between">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.2)]">
            {format(currentMonth, 'yyyy年 MMMM', { locale: zhTW })}
          </h2>
          <div className="flex gap-4">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-3 bg-white/20 border-2 border-white/30 rounded-full hover:bg-white/40 transition-all shadow-lg"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-3 bg-white/20 border-2 border-white/30 rounded-full hover:bg-white/40 transition-all shadow-lg"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b-[4px] border-power-border bg-power-cream">
          {['日', '一', '二', '三', '四', '五', '六'].map(day => (
            <div key={day} className="py-4 text-center text-sm font-black text-power-border uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 bg-power-cream">
          {calendarDays.map((day, idx) => {
            const dayLogs = getLogsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={day.toString()}
                onClick={() => dayLogs.length > 0 && setSelectedDay(day)}
                className={cn(
                  "min-h-[140px] p-3 border-r-[2px] border-b-[2px] border-power-border/10 relative transition-all group",
                  !isCurrentMonth && "opacity-20 bg-gray-100/50",
                  dayLogs.length > 0 ? "cursor-pointer hover:bg-power-yellow/20" : "cursor-default",
                  (idx + 1) % 7 === 0 && "border-r-0"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-lg font-black italic",
                    isToday && "text-white bg-power-blue px-3 py-1 rounded-xl border-2 border-power-border shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {dayLogs.slice(0, 2).map((log, i) => (
                    <div 
                      key={log.id} 
                      className="text-[10px] px-3 py-1.5 bg-white border-2 border-power-border rounded-xl truncate text-power-border font-black italic shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]"
                    >
                      {log.type}
                    </div>
                  ))}
                  {dayLogs.length > 2 && (
                    <div className="text-[10px] text-center text-power-blue font-black uppercase tracking-tighter">
                      +{dayLogs.length - 2} MORE
                    </div>
                  )}
                </div>

                {dayLogs.length > 0 && (
                  <div className="absolute bottom-3 right-3">
                    <Baseball className="w-5 h-5 text-power-blue opacity-20 group-hover:opacity-100 group-hover:rotate-180 transition-all duration-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Modal */}
      <AnimatePresence>
        {selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-[6px] border-power-border rounded-[3rem] max-w-2xl w-full overflow-hidden shadow-[12px_12px_0_0_rgba(0,0,0,0.2)]"
            >
              <div className="p-10 border-b-[4px] border-power-border bg-power-blue text-white flex justify-between items-center">
                <div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.2)]">
                    {format(selectedDay, 'yyyy年 M月 d日', { locale: zhTW })}
                  </h2>
                  <p className="text-power-yellow font-black uppercase text-xs mt-2 tracking-[0.3em]">當日訓練詳情 TRAINING DETAILS</p>
                </div>
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="p-3 bg-white/20 border-2 border-white/30 rounded-full hover:bg-white/40 transition-all"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="p-10 max-h-[60vh] overflow-y-auto space-y-8 bg-power-cream">
                {getLogsForDay(selectedDay).map((log) => (
                  <div key={log.id} className="bg-white border-[4px] border-power-border rounded-[2rem] p-8 space-y-6 shadow-[6px_6px_0_0_rgba(0,0,0,0.05)]">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <span className="px-4 py-1.5 bg-power-green text-white text-xs font-black uppercase rounded-xl border-2 border-power-border shadow-[3px_3px_0_0_rgba(0,0,0,0.1)]">
                          {log.type}
                        </span>
                        <div className="flex items-center gap-2 text-power-border text-sm font-black italic">
                          <Clock className="w-4 h-4" />
                          {log.duration} 分鐘
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-power-border text-lg font-black italic leading-relaxed">{log.description}</p>
                    
                    {log.coachFeedback && (
                      <div className="p-6 bg-power-yellow/20 rounded-2xl border-[3px] border-power-border relative mt-6">
                        <div className="absolute -top-3 left-6 px-3 py-1 bg-power-yellow text-power-border text-[10px] font-black uppercase rounded-lg border-2 border-power-border shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]">教練回饋 FEEDBACK</div>
                        <p className="text-power-border text-lg italic font-black">"{log.coachFeedback}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
