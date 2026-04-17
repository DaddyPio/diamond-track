import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc, orderBy, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { UserProfile, AttendanceRecord } from '../types';
import { motion } from 'motion/react';
import { Check, X, Calendar, Users, Save, Plus, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

export default function Attendance() {
  const { profile } = useAuth();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Load saved dates or defaults
  const [startDate, setStartDate] = useState(() => {
    return localStorage.getItem('attendance_startDate') || format(startOfMonth(new Date()), 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    return localStorage.getItem('attendance_endDate') || format(new Date(), 'yyyy-MM-dd');
  });
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isAddingDate, setIsAddingDate] = useState(false);

  useEffect(() => {
    localStorage.setItem('attendance_startDate', startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem('attendance_endDate', endDate);
  }, [endDate]);

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

    const qAtt = query(
      collection(db, 'attendance'),
      where('teamId', '==', profile.teamId)
    );

    const unsub = onSnapshot(qAtt, (snapshot) => {
      setAttendanceRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    });

    return () => unsub();
  }, [profile]);

  const activeDates = useMemo(() => {
    return attendanceRecords
      .map(r => r.date)
      .filter(d => d >= startDate && d <= endDate)
      .sort((a, b) => b.localeCompare(a));
  }, [attendanceRecords, startDate, endDate]);

  const teamAttendanceRate = useMemo(() => {
    if (players.length === 0 || activeDates.length === 0) return 0;
    
    let totalPossible = players.length * activeDates.length;
    let totalPresent = 0;

    activeDates.forEach(date => {
      const record = attendanceRecords.find(r => r.date === date);
      if (record) {
        totalPresent += record.presentUids.length;
      }
    });

    return totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0;
  }, [players, attendanceRecords, activeDates]);

  const handleToggleAttendance = async (playerUid: string, date: string, isPresent: boolean) => {
    if (!profile?.teamId) return;

    const record = attendanceRecords.find(r => r.date === date);
    if (!record) return;

    let newPresent = [...record.presentUids];
    let newAbsent = [...record.absentUids];

    if (isPresent) {
      // Mark as present
      if (!newPresent.includes(playerUid)) newPresent.push(playerUid);
      newAbsent = newAbsent.filter(id => id !== playerUid);
    } else {
      // Mark as absent
      if (!newAbsent.includes(playerUid)) newAbsent.push(playerUid);
      newPresent = newPresent.filter(id => id !== playerUid);
    }

    try {
      await updateDoc(doc(db, 'attendance', record.id!), {
        presentUids: newPresent,
        absentUids: newAbsent
      });

      // Update player's overall attendance rate
      updatePlayerAttendanceRate(playerUid);
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
  };

  const updatePlayerAttendanceRate = async (playerUid: string) => {
    // Fetch all records for the team to ensure accurate calculation
    const q = query(collection(db, 'attendance'), where('teamId', '==', profile?.teamId));
    const snapshot = await getDocs(q);
    const allRecords = snapshot.docs.map(doc => doc.data() as AttendanceRecord);
    
    const playerPresentCount = allRecords.filter(r => r.presentUids.includes(playerUid)).length;
    const playerTotalCount = allRecords.filter(r => r.presentUids.includes(playerUid) || r.absentUids.includes(playerUid)).length;
    
    const rate = playerTotalCount === 0 ? 0 : Math.round((playerPresentCount / playerTotalCount) * 100);
    
    try {
      await updateDoc(doc(db, 'users', playerUid), {
        attendanceRate: rate
      });
    } catch (error) {
      console.error("Error updating player attendance rate:", error);
    }
  };

  const handleAddDate = async () => {
    if (!profile?.teamId) return;
    
    // Check if date already exists in attendanceRecords
    if (attendanceRecords.some(r => r.date === newDate)) {
      setIsAddingDate(false);
      return;
    }

    try {
      await addDoc(collection(db, 'attendance'), {
        teamId: profile.teamId,
        date: newDate,
        presentUids: [],
        absentUids: []
      });
      setIsAddingDate(false);
    } catch (error) {
      console.error("Error adding date:", error);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)] text-power-border">出席點名</h1>
            <p className="text-gray-500 font-black text-sm italic uppercase tracking-widest">記錄每日出席狀況並統計出席率</p>
          </div>
        </div>
        <div className="power-card bg-power-blue text-white p-6 flex items-center gap-6 shadow-[8px_8px_0_0_rgba(0,0,0,0.1)] border-[4px] border-power-border">
          <div className="p-3 bg-white/20 rounded-2xl border-2 border-white/30">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest opacity-80">全隊平均出席率</p>
            <p className="text-4xl font-black italic">{teamAttendanceRate.toFixed(1)}%</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="power-card p-8 bg-white space-y-6">
            <h2 className="text-xl font-black italic uppercase flex items-center gap-2">
              <Plus className="w-5 h-5 text-power-blue" /> 新增日期
            </h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-black uppercase text-gray-500 tracking-widest">日期 DATE</label>
                <input 
                  type="date" 
                  className="power-input w-full p-3 font-black italic"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <button 
                onClick={handleAddDate}
                disabled={loading}
                className="w-full power-button bg-power-yellow text-power-border py-4 text-xl flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> 新增日期
              </button>
            </div>
          </div>

          <div className="power-card p-8 bg-power-cream border-2 border-power-border/5 space-y-6">
            <h2 className="text-xl font-black italic uppercase flex items-center gap-2">
              <Calendar className="w-5 h-5 text-power-blue" /> 篩選範圍
            </h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-black uppercase text-gray-500 tracking-widest">起始日期 FROM</label>
                <input 
                  type="date" 
                  className="power-input w-full p-3 font-black italic"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-black uppercase text-gray-500 tracking-widest">結束日期 TO</label>
                <input 
                  type="date" 
                  className="power-input w-full p-3 font-black italic"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="power-card bg-white overflow-hidden border-[4px] border-power-border shadow-[8px_8px_0_0_rgba(0,0,0,0.1)]">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-power-blue text-white">
                    <th className="p-6 text-left font-black italic uppercase tracking-widest border-r-2 border-white/20 sticky left-0 bg-power-blue z-10 min-w-[200px] text-sm">
                      球員姓名 PLAYER
                    </th>
                    <th className="p-6 text-center font-black italic min-w-[100px] bg-power-blue/90 text-sm border-r-2 border-white/20">
                      出席率
                    </th>
                    {activeDates.map(date => (
                      <th key={date} className="p-6 text-center font-black italic min-w-[120px] text-sm border-r-2 border-white/20">
                        {date.split('-').slice(1).join('/')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, idx) => {
                    const playerAttendance = attendanceRecords.filter(r => r.presentUids.includes(player.uid)).length;
                    const playerTotal = attendanceRecords.filter(r => r.presentUids.includes(player.uid) || r.absentUids.includes(player.uid)).length;
                    const rate = playerTotal > 0 ? (playerAttendance / playerTotal) * 100 : 0;

                    return (
                      <tr key={player.uid} className={cn(idx % 2 === 0 ? "bg-white" : "bg-power-cream/30", "border-b-2 border-power-border/5 hover:bg-power-blue/5 transition-colors")}>
                        <td className="p-6 font-black italic text-lg border-r-2 border-power-border/5 sticky left-0 bg-inherit z-10">
                          <div className="flex items-center gap-3">
                            <span className="text-power-blue">#{player.playerNumber}</span>
                            <span>{player.displayName}</span>
                          </div>
                        </td>
                        <td className="p-6 text-center bg-power-blue/5 border-r-2 border-power-border/5">
                          <span className={cn(
                            "text-xl font-black italic",
                            rate >= 90 ? "text-power-green" : rate >= 70 ? "text-power-yellow" : "text-power-red"
                          )}>
                            {rate.toFixed(0)}%
                          </span>
                        </td>
                        {activeDates.map(date => {
                          const record = attendanceRecords.find(r => r.date === date);
                          const isPresent = record?.presentUids.includes(player.uid);
                          const isAbsent = record?.absentUids.includes(player.uid);
                          
                          return (
                            <td key={date} className="p-6 text-center border-r-2 border-power-border/5">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => handleToggleAttendance(player.uid, date, true)}
                                  className={cn(
                                    "w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all",
                                    isPresent ? "bg-power-green border-power-border text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]" : "bg-white border-power-border/10 text-transparent"
                                  )}
                                >
                                  <Check className="w-6 h-6" />
                                </button>
                                <button 
                                  onClick={() => handleToggleAttendance(player.uid, date, false)}
                                  className={cn(
                                    "w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all",
                                    isAbsent ? "bg-power-red border-power-border text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]" : "bg-white border-power-border/10 text-transparent"
                                  )}
                                >
                                  <X className="w-6 h-6" />
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
