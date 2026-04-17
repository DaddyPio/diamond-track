import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { UserProfile, RatingStandard, TrainingLog, AttendanceRecord } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Circle as Baseball, Search, Star, Save, X, ChevronUp, ChevronDown, ChevronsUpDown, Filter, Download, TrendingUp } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Radar as RadarComponent } from 'recharts';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

const DEFAULT_STANDARDS: RatingStandard = {
  fielder: {
    weights: { batting: 20, pitching: 20, fielding: 20, speed: 20, stamina: 20 },
    levels: { S: 90, A: 80, B: 70, C: 60 }
  },
  twoWay: {
    weights: { batting: 20, pitching: 20, fielding: 20, speed: 20, stamina: 20 },
    levels: { S: 90, A: 80, B: 70, C: 60 }
  }
};

export default function TeamRoster() {
  const { profile: currentUser } = useAuth();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [standards, setStandards] = useState<RatingStandard>(DEFAULT_STANDARDS);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  
  const [editData, setEditData] = useState<{
    stats: UserProfile['stats'];
    playerType: UserProfile['playerType'];
  }>({
    stats: { batting: 50, pitching: 50, fielding: 50, speed: 50, stamina: 50 },
    playerType: 'fielder'
  });

  useEffect(() => {
    if (!currentUser?.teamId) return;

    // Fetch players
    const q = query(
      collection(db, 'users'), 
      where('teamId', '==', currentUser.teamId),
      where('role', '==', 'player')
    );
    const unsubPlayers = onSnapshot(q, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    // Fetch team standards
    const unsubTeam = onSnapshot(doc(db, 'teams', currentUser.teamId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().ratingStandards) {
        setStandards(docSnap.data().ratingStandards);
      }
    });

    // Fetch training logs for attendance
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const logsQ = query(
      collection(db, 'training_logs'),
      where('teamId', '==', currentUser.teamId),
      where('date', '>=', monthStart),
      where('date', '<=', monthEnd)
    );
    const unsubLogs = onSnapshot(logsQ, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingLog)));
    });

    // Fetch attendance records
    const attQ = query(
      collection(db, 'attendance'),
      where('teamId', '==', currentUser.teamId)
    );
    const unsubAtt = onSnapshot(attQ, (snapshot) => {
      setAttendanceRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    });

    return () => {
      unsubPlayers();
      unsubTeam();
      unsubLogs();
      unsubAtt();
    };
  }, [currentUser]);

  // Helper: Calculate Overall Grade
  const calculateGrade = (player: UserProfile) => {
    const type = player.playerType || 'fielder';
    const cat = standards[type];
    const stats = player.stats || { batting: 0, pitching: 0, fielding: 0, speed: 0, stamina: 0 };
    
    const score = (
      (stats.batting * cat.weights.batting) +
      (stats.pitching * cat.weights.pitching) +
      (stats.fielding * cat.weights.fielding) +
      (stats.speed * cat.weights.speed) +
      (stats.stamina * cat.weights.stamina)
    ) / 100;

    if (score >= cat.levels.S) return { grade: 'S', score };
    if (score >= cat.levels.A) return { grade: 'A', score };
    if (score >= cat.levels.B) return { grade: 'B', score };
    if (score >= cat.levels.C) return { grade: 'C', score };
    return { grade: 'D', score };
  };

  const getGrade = (val: number) => {
    if (val >= 90) return 'S';
    if (val >= 80) return 'A';
    if (val >= 70) return 'B';
    if (val >= 60) return 'C';
    if (val >= 50) return 'D';
    if (val >= 40) return 'E';
    return 'F';
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'S': return 'bg-power-red text-white';
      case 'A': return 'bg-power-yellow text-power-border';
      case 'B': return 'bg-power-blue text-white';
      case 'C': return 'bg-power-green text-white';
      case 'D': return 'bg-gray-400 text-white';
      case 'E': return 'bg-gray-500 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  // Helper: Calculate Attendance Rate
  const calculateAttendance = (playerUid: string) => {
    if (attendanceRecords.length === 0) return 0;
    
    const relevantRecords = attendanceRecords.filter(r => 
      r.presentUids.includes(playerUid) || r.absentUids.includes(playerUid)
    );
    
    if (relevantRecords.length === 0) return 0;
    
    const presentCount = relevantRecords.filter(r => r.presentUids.includes(playerUid)).length;
    return Math.round((presentCount / relevantRecords.length) * 100);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredPlayers = useMemo(() => {
    let result = players.filter(p => 
      p.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.playerNumber?.includes(searchTerm)
    );

    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'name': aValue = a.displayName; bValue = b.displayName; break;
          case 'number': aValue = parseInt(a.playerNumber || '0'); bValue = parseInt(b.playerNumber || '0'); break;
          case 'type': aValue = a.playerType; bValue = b.playerType; break;
          case 'pos': aValue = a.position; bValue = b.position; break;
          case 'batting': aValue = a.stats?.batting || 0; bValue = b.stats?.batting || 0; break;
          case 'pitching': aValue = a.stats?.pitching || 0; bValue = b.stats?.pitching || 0; break;
          case 'fielding': aValue = a.stats?.fielding || 0; bValue = b.stats?.fielding || 0; break;
          case 'speed': aValue = a.stats?.speed || 0; bValue = b.stats?.speed || 0; break;
          case 'stamina': aValue = a.stats?.stamina || 0; bValue = b.stats?.stamina || 0; break;
          case 'attendance': aValue = calculateAttendance(a.uid); bValue = calculateAttendance(b.uid); break;
          case 'avg': aValue = a.gameStats?.avg || 0; bValue = b.gameStats?.avg || 0; break;
          case 'obp': aValue = a.gameStats?.obp || 0; bValue = b.gameStats?.obp || 0; break;
          case 'era': aValue = a.gameStats?.era || 99; bValue = b.gameStats?.era || 99; break;
          case 'grade': aValue = calculateGrade(a).score; bValue = calculateGrade(b).score; break;
          default: aValue = 0; bValue = 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [players, searchTerm, sortConfig, logs, standards]);

  const statsLabels: Record<string, string> = {
    batting: '打擊',
    pitching: '投球',
    fielding: '守備',
    speed: '速度',
    stamina: '體能',
  };

  const handleEditClick = (player: UserProfile) => {
    setSelectedPlayer(player);
    setEditData({
      stats: player.stats || { batting: 50, pitching: 50, fielding: 50, speed: 50, stamina: 50 },
      playerType: player.playerType || 'fielder'
    });
    setIsEditing(false);
  };

  const handleSaveStats = async () => {
    if (!selectedPlayer) return;
    try {
      await updateDoc(doc(db, 'users', selectedPlayer.uid), {
        stats: editData.stats,
        playerType: editData.playerType
      });
      setIsEditing(false);
      setSelectedPlayer({ ...selectedPlayer, stats: editData.stats, playerType: editData.playerType });
    } catch (error) {
      console.error("Error updating player stats:", error);
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-power-blue" /> : <ChevronDown className="w-3 h-3 text-power-blue" />;
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)]">球員總覽</h1>
            <p className="text-gray-500 font-black text-sm italic uppercase tracking-widest">全隊數據總覽與戰力分析</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="搜尋姓名、背號、位置..."
              className="power-input w-full pl-12 py-3 text-sm font-black italic"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Roster Table */}
      <div className="power-card overflow-hidden bg-white border-[4px] border-power-border">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-power-blue text-white border-b-[4px] border-power-border">
                <th onClick={() => handleSort('number')} className="p-4 cursor-pointer hover:bg-white/10 transition-colors text-sm">
                  <div className="flex items-center gap-2 font-black uppercase tracking-widest">
                    # <SortIcon column="number" />
                  </div>
                </th>
                <th onClick={() => handleSort('name')} className="p-4 cursor-pointer hover:bg-white/10 transition-colors min-w-[120px] text-sm">
                  <div className="flex items-center gap-2 font-black uppercase tracking-widest">
                    姓名 NAME <SortIcon column="name" />
                  </div>
                </th>
                <th onClick={() => handleSort('type')} className="p-4 cursor-pointer hover:bg-white/10 transition-colors text-sm">
                  <div className="flex items-center gap-2 font-black uppercase tracking-widest">
                    類型 TYPE <SortIcon column="type" />
                  </div>
                </th>
                <th onClick={() => handleSort('pos')} className="p-4 cursor-pointer hover:bg-white/10 transition-colors text-sm">
                  <div className="flex items-center gap-2 font-black uppercase tracking-widest">
                    位置 POS <SortIcon column="pos" />
                  </div>
                </th>
                {currentUser?.role === 'coach' && (
                  <th className="p-4 text-center border-l-2 border-white/20 text-sm">
                    <div className="font-black uppercase tracking-widest">能力值 ABILITY</div>
                    <div className="flex justify-around mt-2 gap-4 text-[10px]">
                      <div>打擊 BAT</div>
                      <div>投球 PIT</div>
                      <div>守備 FLD</div>
                      <div>速度 SPD</div>
                      <div>體能 STA</div>
                    </div>
                  </th>
                )}
                <th onClick={() => handleSort('attendance')} className="p-4 cursor-pointer hover:bg-white/10 transition-colors text-center text-sm">
                  <div className="flex flex-col items-center gap-1 font-black uppercase tracking-widest">
                    出席率 ATT <SortIcon column="attendance" />
                  </div>
                </th>
                <th className="p-4 text-center border-l-2 border-white/20 text-sm">
                  <div className="font-black uppercase tracking-widest">自主訓練 TRAINING</div>
                  <div className="flex justify-around mt-2 gap-4 text-[10px]">
                    <div>天數 DAYS</div>
                    <div>次數 COUNT</div>
                  </div>
                </th>
                <th className="p-4 text-center border-l-2 border-white/20 text-sm">
                  <div className="font-black uppercase tracking-widest">比賽數據 GAME</div>
                  <div className="flex justify-around mt-2 gap-4 text-[10px]">
                    <div onClick={(e) => { e.stopPropagation(); handleSort('avg'); }} className="cursor-pointer flex items-center gap-1">AVG <SortIcon column="avg" /></div>
                    <div onClick={(e) => { e.stopPropagation(); handleSort('obp'); }} className="cursor-pointer flex items-center gap-1">OBP <SortIcon column="obp" /></div>
                    <div onClick={(e) => { e.stopPropagation(); handleSort('era'); }} className="cursor-pointer flex items-center gap-1">ERA <SortIcon column="era" /></div>
                  </div>
                </th>
                <th className="p-4 text-center border-l-2 border-white/20 text-sm">
                  <div className="font-black uppercase tracking-widest">測驗成績 TEST</div>
                  <div className="flex justify-around mt-2 gap-4 text-[10px]">
                    <div>球速 VEL</div>
                    <div>跑壘 SPD</div>
                    <div>遠投 DIST</div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-power-border/5">
              {sortedAndFilteredPlayers.map((player) => {
                const { grade } = calculateGrade(player);
                const attendance = calculateAttendance(player.uid);
                return (
                  <tr 
                    key={player.uid}
                    onClick={() => handleEditClick(player)}
                    className="hover:bg-power-cream/50 transition-colors cursor-pointer group"
                  >
                    <td className="p-4 font-black italic text-power-blue text-lg">#{player.playerNumber || '??'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={player.photoURL} 
                          className="w-10 h-10 rounded-lg border-2 border-power-border object-cover"
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                        <span className="font-black italic text-power-border">{player.displayName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-black uppercase border-2",
                        player.playerType === 'twoWay' ? "bg-power-yellow/10 text-power-yellow border-power-yellow/30" : "bg-power-blue/10 text-power-blue border-power-blue/30"
                      )}>
                        {player.playerType === 'twoWay' ? '投手野手' : '野手'}
                      </span>
                    </td>
                    <td className="p-4 font-black italic text-sm text-gray-500 uppercase">{player.position || '-'}</td>
                    {currentUser?.role === 'coach' && (
                      <td className="p-4 border-l-2 border-power-border/5 text-center">
                        <div className="flex justify-around gap-2 font-black italic text-xs">
                          {['batting', 'pitching', 'fielding', 'speed', 'stamina'].map((key) => {
                            const val = player.stats?.[key as keyof typeof player.stats] || 0;
                            const grade = getGrade(val);
                            return (
                              <div key={key} className="flex flex-col items-center">
                                <span className="text-power-border">{val}</span>
                                <span className={cn("px-1 rounded-[2px] text-[8px] mt-0.5", getGradeColor(grade))}>{grade}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    )}
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn(
                          "font-black italic text-lg",
                          attendance >= 80 ? "text-power-green" : attendance >= 50 ? "text-power-yellow" : "text-power-red"
                        )}>
                          {attendance}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 border-l-2 border-power-border/5 text-center">
                      <div className="flex justify-around gap-4 font-black italic text-sm">
                        <span className="text-power-border">{logs.filter(l => l.playerUid === player.uid).reduce((acc, l) => {
                          const d = l.date?.toDate ? l.date.toDate() : new Date(l.date);
                          acc.add(d.toDateString());
                          return acc;
                        }, new Set()).size}天</span>
                        <span className="text-power-border">{logs.filter(l => l.playerUid === player.uid).length}次</span>
                      </div>
                    </td>
                    <td className="p-4 border-l-2 border-power-border/5 text-center">
                      <div className="flex justify-around gap-4 font-black italic text-sm">
                        <span className="text-power-border">{player.gameStats?.avg.toFixed(3) || '.000'}</span>
                        <span className="text-power-border">{player.gameStats?.obp.toFixed(3) || '.000'}</span>
                        <span className="text-power-red">{player.gameStats?.era.toFixed(2) || '0.00'}</span>
                      </div>
                    </td>
                    <td className="p-4 border-l-2 border-power-border/5 text-center">
                      <div className="flex justify-around gap-4 font-black italic text-sm">
                        <span className="text-power-border">{player.testStats?.pitchingVelocity || 0}</span>
                        <span className="text-power-border">{player.testStats?.runningSpeed || 0}</span>
                        <span className="text-power-border">{player.testStats?.throwingDistance || 0}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Player Detail Modal (Keep existing logic but ensure it's responsive) */}
      <AnimatePresence>
        {selectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-[6px] border-power-border rounded-[3rem] max-w-5xl w-full max-h-[95vh] relative shadow-[12px_12px_0_0_rgba(0,0,0,0.2)] flex flex-col"
            >
              <button 
                onClick={() => setSelectedPlayer(null)}
                className="absolute top-6 right-6 z-50 p-2 bg-power-cream border-2 border-power-border rounded-full hover:bg-power-yellow transition-colors shadow-md"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="overflow-y-auto custom-scrollbar flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="p-10 space-y-8">
                    <div className="flex items-center gap-8">
                      <img 
                        src={selectedPlayer.photoURL} 
                        className="w-28 h-28 rounded-[2rem] object-cover border-[4px] border-power-border shadow-xl"
                        alt={selectedPlayer.displayName}
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-power-border">{selectedPlayer.displayName}</h2>
                          <span className="text-3xl text-power-blue font-black italic">#{selectedPlayer.playerNumber}</span>
                        </div>
                        <p className="bg-power-blue text-white px-3 py-1 rounded-lg font-black uppercase tracking-[0.2em] text-xs inline-block border-2 border-power-border shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]">{selectedPlayer.position}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase text-gray-500 border-b-2 border-power-border/10 pb-2 tracking-widest">球員簡介 PROFILE</h4>
                      <p className="text-power-border/80 text-lg leading-relaxed italic font-black">
                        {selectedPlayer.bio || '這位球員還沒有填寫簡介。'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-power-cream p-10 flex flex-col border-l-[4px] border-power-border overflow-y-auto">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-black italic uppercase flex items-center gap-3">
                        <div className="bg-power-blue p-2 rounded-xl">
                          <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        數據總覽 SUMMARY
                      </h3>
                    </div>

                    <div className="space-y-8">
                      {/* Training Stats */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-black uppercase text-gray-500 border-b-2 border-power-border/10 pb-2 tracking-widest">自主訓練數據 TRAINING</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-2xl border-2 border-power-border/5 text-center">
                            <p className="text-3xl font-black italic text-power-blue">
                              {logs.filter(l => l.playerUid === selectedPlayer.uid).reduce((acc, l) => {
                                const d = l.date?.toDate ? l.date.toDate() : new Date(l.date);
                                acc.add(d.toDateString());
                                return acc;
                              }, new Set()).size}
                            </p>
                            <p className="text-[10px] text-gray-400 font-black uppercase">當月累積天數</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border-2 border-power-border/5 text-center">
                            <p className="text-3xl font-black italic text-power-blue">
                              {logs.filter(l => l.playerUid === selectedPlayer.uid).length}
                            </p>
                            <p className="text-[10px] text-gray-400 font-black uppercase">當月累積次數</p>
                          </div>
                        </div>
                      </div>

                      {/* Attendance */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-black uppercase text-gray-500 border-b-2 border-power-border/10 pb-2 tracking-widest">練球出席率 ATTENDANCE</h4>
                        <div className="bg-white p-6 rounded-2xl border-2 border-power-border/5 text-center">
                          <p className={cn(
                            "text-5xl font-black italic",
                            calculateAttendance(selectedPlayer.uid) >= 80 ? "text-power-green" : calculateAttendance(selectedPlayer.uid) >= 50 ? "text-power-yellow" : "text-power-red"
                          )}>
                            {calculateAttendance(selectedPlayer.uid)}%
                          </p>
                        </div>
                      </div>

                      {/* Game Stats */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-black uppercase text-gray-500 border-b-2 border-power-border/10 pb-2 tracking-widest">比賽成績 GAME STATS</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white p-4 rounded-2xl border-2 border-power-border/5 text-center">
                            <p className="text-2xl font-black italic text-power-border">{selectedPlayer.gameStats?.avg.toFixed(3) || '.000'}</p>
                            <p className="text-[10px] text-gray-400 font-black uppercase">AVG</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border-2 border-power-border/5 text-center">
                            <p className="text-2xl font-black italic text-power-border">{selectedPlayer.gameStats?.obp.toFixed(3) || '.000'}</p>
                            <p className="text-[10px] text-gray-400 font-black uppercase">OBP</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border-2 border-power-border/5 text-center">
                            <p className="text-2xl font-black italic text-power-red">{selectedPlayer.gameStats?.era.toFixed(2) || '0.00'}</p>
                            <p className="text-[10px] text-gray-400 font-black uppercase">ERA</p>
                          </div>
                        </div>
                      </div>

                      {/* Test Stats */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-black uppercase text-gray-500 border-b-2 border-power-border/10 pb-2 tracking-widest">測驗成績 TEST RESULTS</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white p-4 rounded-2xl border-2 border-power-border/5 text-center">
                            <p className="text-2xl font-black italic text-power-border">{selectedPlayer.testStats?.pitchingVelocity || 0}</p>
                            <p className="text-[10px] text-gray-400 font-black uppercase">球速</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border-2 border-power-border/5 text-center">
                            <p className="text-2xl font-black italic text-power-border">{selectedPlayer.testStats?.runningSpeed || 0}</p>
                            <p className="text-[10px] text-gray-400 font-black uppercase">跑壘</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border-2 border-power-border/5 text-center">
                            <p className="text-2xl font-black italic text-power-border">{selectedPlayer.testStats?.throwingDistance || 0}</p>
                            <p className="text-[10px] text-gray-400 font-black uppercase">遠投</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
