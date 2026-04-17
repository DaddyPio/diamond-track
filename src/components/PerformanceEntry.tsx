import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { UserProfile, PerformanceRecord } from '../types';
import { motion } from 'motion/react';
import { Save, Trophy, Activity, Target, Search, CheckCircle2, AlertCircle, Calendar, TrendingUp, BarChart2, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function PerformanceEntry() {
  const { profile } = useAuth();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [gameStats, setGameStats] = useState({
    plateAppearances: 0,
    atBats: 0,
    hits: 0,
    walks: 0,
    strikeouts: 0,
    rbi: 0,
    stolenBases: 0,
    inningsPitched: 0,
    runsAllowed: 0,
    earnedRuns: 0,
    pitcherWalks: 0,
    pitcherStrikeouts: 0,
    totalPitches: 0,
    strikes: 0,
    balls: 0,
    avg: 0,
    obp: 0,
    era: 0
  });

  const [abilityStats, setAbilityStats] = useState({
    batting: 50,
    pitching: 50,
    fielding: 50,
    speed: 50,
    stamina: 50
  });

  const [testStats, setTestStats] = useState({
    runningSpeed: 0,
    pitchingVelocity: 0,
    throwingDistance: 0
  });

  // Auto-calculate stats
  useEffect(() => {
    const avg = gameStats.atBats > 0 ? gameStats.hits / gameStats.atBats : 0;
    const obp = gameStats.plateAppearances > 0 ? (gameStats.hits + gameStats.walks) / gameStats.plateAppearances : 0;
    const era = gameStats.inningsPitched > 0 ? (gameStats.earnedRuns / gameStats.inningsPitched) * 9 : 0;

    setGameStats(prev => ({
      ...prev,
      avg,
      obp,
      era
    }));
  }, [gameStats.hits, gameStats.atBats, gameStats.walks, gameStats.plateAppearances, gameStats.earnedRuns, gameStats.inningsPitched]);

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
  }, [profile]);

  useEffect(() => {
    if (!selectedPlayer) {
      setRecords([]);
      return;
    }

    const q = query(
      collection(db, 'performance_records'),
      where('teamId', '==', profile.teamId),
      where('playerUid', '==', selectedPlayer.uid),
      orderBy('date', 'asc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PerformanceRecord)));
    });

    return () => unsub();
  }, [selectedPlayer]);

  const averages = useMemo(() => {
    if (records.length === 0) return null;
    
    const gameRecords = records.filter(r => r.type === 'game');
    const testRecords = records.filter(r => r.type === 'test');

    const calcAvg = (recs: PerformanceRecord[], key: string) => {
      const valid = recs.filter(r => (r.stats as any)[key] !== undefined);
      if (valid.length === 0) return 0;
      return valid.reduce((acc, r) => acc + ((r.stats as any)[key] || 0), 0) / valid.length;
    };

    return {
      game: {
        avg: calcAvg(gameRecords, 'avg'),
        obp: calcAvg(gameRecords, 'obp'),
        hr: calcAvg(gameRecords, 'hr'),
        rbi: calcAvg(gameRecords, 'rbi'),
        era: calcAvg(gameRecords, 'era'),
        wins: calcAvg(gameRecords, 'wins'),
      },
      test: {
        runningSpeed: calcAvg(testRecords, 'runningSpeed'),
        pitchingVelocity: calcAvg(testRecords, 'pitchingVelocity'),
        throwingDistance: calcAvg(testRecords, 'throwingDistance'),
      }
    };
  }, [records]);

  const chartData = useMemo(() => {
    return records.map(r => ({
      date: typeof r.date === 'string' ? format(parseISO(r.date), 'MM/dd') : r.date?.toDate ? format(r.date.toDate(), 'MM/dd') : '',
      ...r.stats,
      type: r.type
    }));
  }, [records]);

  const handleSelectPlayer = (player: UserProfile) => {
    setSelectedPlayer(player);
    setGameStats({
      plateAppearances: 0,
      atBats: 0,
      hits: 0,
      walks: 0,
      strikeouts: 0,
      rbi: 0,
      stolenBases: 0,
      inningsPitched: 0,
      runsAllowed: 0,
      earnedRuns: 0,
      hitsAllowed: 0,
      pitcherWalks: 0,
      pitcherStrikeouts: 0,
      totalPitches: 0,
      strikes: 0,
      balls: 0,
      avg: 0,
      obp: 0,
      era: 0
    });
    setAbilityStats(player.stats || {
      batting: 50,
      pitching: 50,
      fielding: 50,
      speed: 50,
      stamina: 50
    });
    setTestStats({ runningSpeed: 0, pitchingVelocity: 0, throwingDistance: 0 });
  };

  const handleSave = async (type: 'game' | 'test') => {
    if (!selectedPlayer || !profile) return;
    setLoading(true);
    try {
      const stats = type === 'game' ? gameStats : testStats;

      // Add to records
      await addDoc(collection(db, 'performance_records'), {
        playerUid: selectedPlayer.uid,
        teamId: profile.teamId,
        date: selectedDate,
        type,
        stats
      });

      // Recalculate averages including the new record
      const newRecords = [...records, { playerUid: selectedPlayer.uid, teamId: profile.teamId, date: selectedDate, type, stats }];
      const gameRecs = newRecords.filter(r => r.type === 'game');
      const testRecs = newRecords.filter(r => r.type === 'test');
      
      const calcAvg = (recs: any[], key: string) => {
        const valid = recs.filter(r => r.stats[key] !== undefined);
        if (valid.length === 0) return 0;
        return valid.reduce((acc, r) => acc + (r.stats[key] || 0), 0) / valid.length;
      };

      const newAverages = {
        gameStats: {
          avg: calcAvg(gameRecs, 'avg'),
          obp: calcAvg(gameRecs, 'obp'),
          hr: calcAvg(gameRecs, 'hr'),
          rbi: calcAvg(gameRecs, 'rbi'),
          era: calcAvg(gameRecs, 'era'),
          wins: calcAvg(gameRecs, 'wins'),
        },
        testStats: {
          runningSpeed: calcAvg(testRecs, 'runningSpeed'),
          pitchingVelocity: calcAvg(testRecs, 'pitchingVelocity'),
          throwingDistance: calcAvg(testRecs, 'throwingDistance'),
          updatedAt: serverTimestamp()
        }
      };

      await updateDoc(doc(db, 'users', selectedPlayer.uid), newAverages);

      setMessage({ type: 'success', text: `${type === 'game' ? '比賽' : '測驗'}數據已新增並更新平均值！` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving stats:", error);
      setMessage({ type: 'error', text: '儲存失敗，請稍後再試。' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAbility = async () => {
    if (!selectedPlayer || !profile) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', selectedPlayer.uid), {
        stats: abilityStats,
        updatedAt: serverTimestamp()
      });
      setMessage({ type: 'success', text: '球員能力值已更新！' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving ability:", error);
      setMessage({ type: 'error', text: '儲存失敗，請稍後再試。' });
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(p => 
    p.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.playerNumber?.includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-6">
        <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)]">數據登錄</h1>
            <p className="text-gray-500 font-black text-sm italic uppercase tracking-widest">逐次新增數據並追蹤成長趨勢</p>
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
          {message.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          {message.text}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Player List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="搜尋球員..."
              className="power-input w-full pl-12 py-3 text-sm font-black italic"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="power-card bg-white h-[600px] overflow-y-auto custom-scrollbar p-4 space-y-2">
            {filteredPlayers.map(player => (
              <button
                key={player.uid}
                onClick={() => handleSelectPlayer(player)}
                className={cn(
                  "w-full p-4 rounded-xl border-[3px] flex items-center justify-between transition-all",
                  selectedPlayer?.uid === player.uid 
                    ? "bg-power-blue text-white border-power-border shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]" 
                    : "bg-power-cream border-transparent hover:border-power-blue/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black italic">#{player.playerNumber}</span>
                  <span className="font-black italic">{player.displayName}</span>
                </div>
                <span className="text-[10px] font-black uppercase opacity-60">{player.position}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Data Entry Form & Charts */}
        <div className="lg:col-span-3 space-y-8">
          {!selectedPlayer && (
            <>
              <div className="power-card p-8 bg-white text-nowrap select-none">
              <h2 className="text-2xl font-black italic uppercase mb-8 flex items-center gap-3">
                <BarChart2 className="w-7 h-7 text-power-blue" />
                全隊數據統整總表 TEAM SUMMARY
              </h2>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-power-blue text-white">
                      <th className="p-4 text-left font-black italic uppercase tracking-widest border-r-2 border-white/20 sticky left-0 bg-power-blue z-10 text-xs">球員 PLAYER</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest border-r-2 border-white/20 text-xs">打擊率 AVG</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest border-r-2 border-white/20 text-xs">上壘率 OBP</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest border-r-2 border-white/20 text-xs">防禦率 ERA</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest border-r-2 border-white/20 text-xs">球速 VEL</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest border-r-2 border-white/20 text-xs">跑速 SPD</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest text-xs">投遠 DIST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, idx) => (
                      <tr key={player.uid} className={cn("border-b-2 border-power-border/5", idx % 2 === 0 ? "bg-white" : "bg-power-cream/30")}>
                        <td className="p-4 font-black italic text-power-border sticky left-0 bg-inherit z-10 border-r-2 border-power-border/5">
                          <div className="flex items-center gap-2">
                            <span className="text-power-blue text-xs">#{player.playerNumber}</span>
                            <span className="text-sm">{player.displayName}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center font-black italic text-power-blue border-r-2 border-power-border/5">
                          {(player.gameStats?.avg || 0).toFixed(3)}
                        </td>
                        <td className="p-4 text-center font-black italic text-power-blue border-r-2 border-power-border/5">
                          {(player.gameStats?.obp || 0).toFixed(3)}
                        </td>
                        <td className="p-4 text-center font-black italic text-power-red border-r-2 border-power-border/5">
                          {(player.gameStats?.era || 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-center font-black italic text-power-green border-r-2 border-power-border/5">
                          {player.testStats?.pitchingVelocity || 0} <span className="text-[8px]">KM</span>
                        </td>
                        <td className="p-4 text-center font-black italic text-power-green border-r-2 border-power-border/5">
                          {(player.testStats?.runningSpeed || 0).toFixed(2)} <span className="text-[8px]">S</span>
                        </td>
                        <td className="p-4 text-center font-black italic text-power-green">
                          {player.testStats?.throwingDistance || 0} <span className="text-[8px]">M</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Team Ability Summary Table */}
            <div className="power-card p-8 bg-white mt-8">
              <h2 className="text-2xl font-black italic uppercase mb-8 flex items-center gap-3">
                <Target className="w-7 h-7 text-power-blue" />
                全隊能力值總表 ABILITY SUMMARY
              </h2>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-power-green text-white">
                      <th className="p-4 text-left font-black italic uppercase tracking-widest border-r-2 border-white/20 sticky left-0 bg-power-green z-10 text-xs whitespace-nowrap">球員 PLAYER</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest border-r-2 border-white/20 text-xs">打擊</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest border-r-2 border-white/20 text-xs">投球</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest border-r-2 border-white/20 text-xs">守備</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest border-r-2 border-white/20 text-xs">速度</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest border-r-2 border-white/20 text-xs">體能</th>
                      <th className="p-4 text-center font-black italic uppercase tracking-widest text-xs">綜合評價 RANK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...players]
                      .map(p => {
                        const stats = p.stats || { batting: 0, pitching: 0, fielding: 0, speed: 0, stamina: 0 };
                        const total = (Object.values(stats) as number[]).reduce((a, b) => a + b, 0);
                        return { ...p, total };
                      })
                      .sort((a, b) => b.total - a.total)
                      .map((player, idx) => {
                        const stats = player.stats || { batting: 0, pitching: 0, fielding: 0, speed: 0, stamina: 0 };
                        const avg = Math.round(player.total / 5);
                        let rank = 'G';
                        if (avg >= 90) rank = 'S';
                        else if (avg >= 80) rank = 'A';
                        else if (avg >= 70) rank = 'B';
                        else if (avg >= 60) rank = 'C';
                        else if (avg >= 50) rank = 'D';
                        else if (avg >= 40) rank = 'E';
                        else rank = 'F';

                        return (
                          <tr key={player.uid} className={cn("border-b-2 border-power-border/5", idx % 2 === 0 ? "bg-white" : "bg-power-cream/30")}>
                            <td className="p-4 font-black italic text-power-border sticky left-0 bg-inherit z-10 border-r-2 border-power-border/5">
                              <div className="flex items-center gap-2">
                                <span className="text-power-blue text-xs">#{player.playerNumber}</span>
                                <span className="text-sm">{player.displayName}</span>
                              </div>
                            </td>
                            <td className="p-4 text-center font-black italic text-power-border border-r-2 border-power-border/5">{stats.batting}</td>
                            <td className="p-4 text-center font-black italic text-power-border border-r-2 border-power-border/5">{stats.pitching}</td>
                            <td className="p-4 text-center font-black italic text-power-border border-r-2 border-power-border/5">{stats.fielding}</td>
                            <td className="p-4 text-center font-black italic text-power-border border-r-2 border-power-border/5">{stats.speed}</td>
                            <td className="p-4 text-center font-black italic text-power-border border-r-2 border-power-border/5">{stats.stamina}</td>
                            <td className="p-4 text-center">
                              <span className={cn(
                                "inline-block w-8 h-8 rounded-lg flex items-center justify-center text-xl font-black italic text-white shadow-md border-2 border-power-border",
                                rank === 'S' ? 'bg-power-yellow' : 
                                rank === 'A' ? 'bg-power-red' : 
                                rank === 'B' ? 'bg-power-blue' : 
                                rank === 'C' ? 'bg-power-green' : 'bg-gray-400'
                              )}>
                                {rank}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

          {selectedPlayer ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="power-card p-6 bg-white flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-power-blue" />
                  <label className="text-xs font-black uppercase text-gray-500 tracking-widest">記錄日期 DATE</label>
                </div>
                <input 
                  type="date"
                  className="power-input p-3 font-black italic"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Game Stats Entry */}
                <div className="space-y-6">
                  <div className="power-card p-8 bg-white">
                    <h2 className="text-2xl font-black italic uppercase mb-6 flex items-center gap-3">
                      <div className="bg-power-yellow p-2 rounded-xl">
                        <Trophy className="w-6 h-6 text-power-border" />
                      </div>
                      新增比賽數據
                    </h2>
                    <div className="space-y-6">
                      <div className="bg-power-cream/30 p-4 rounded-2xl border-2 border-power-border/5">
                        <h3 className="text-base font-black italic uppercase mb-4 text-power-blue border-b-2 border-power-blue/20 pb-2">打擊 BATTING</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">打席 PA</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.plateAppearances} onChange={(e) => setGameStats({...gameStats, plateAppearances: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">打數 AB</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.atBats} onChange={(e) => setGameStats({...gameStats, atBats: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">安打 H</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.hits} onChange={(e) => setGameStats({...gameStats, hits: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">四壞 BB</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.walks} onChange={(e) => setGameStats({...gameStats, walks: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">三振 SO</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.strikeouts} onChange={(e) => setGameStats({...gameStats, strikeouts: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">打點 RBI</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.rbi} onChange={(e) => setGameStats({...gameStats, rbi: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">盜壘 SB</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.stolenBases} onChange={(e) => setGameStats({...gameStats, stolenBases: parseInt(e.target.value) || 0})} />
                          </div>
                        </div>
                      </div>

                      <div className="bg-power-cream/30 p-4 rounded-2xl border-2 border-power-border/5">
                        <h3 className="text-base font-black italic uppercase mb-4 text-power-red border-b-2 border-power-red/20 pb-2">投球 PITCHING</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">局數 IP</label>
                            <input type="number" min="0" step="0.1" className="power-input w-full p-2 font-black italic" value={gameStats.inningsPitched} onChange={(e) => setGameStats({...gameStats, inningsPitched: parseFloat(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">失分 R</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.runsAllowed} onChange={(e) => setGameStats({...gameStats, runsAllowed: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">責失 ER</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.earnedRuns} onChange={(e) => setGameStats({...gameStats, earnedRuns: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">被安打 H</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.hitsAllowed} onChange={(e) => setGameStats({...gameStats, hitsAllowed: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">四壞 BB</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.pitcherWalks} onChange={(e) => setGameStats({...gameStats, pitcherWalks: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">三振 SO</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.pitcherStrikeouts} onChange={(e) => setGameStats({...gameStats, pitcherStrikeouts: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">用球數 PITCHES</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.totalPitches} onChange={(e) => setGameStats({...gameStats, totalPitches: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">好球 S</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.strikes} onChange={(e) => setGameStats({...gameStats, strikes: parseInt(e.target.value) || 0})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">壞球 B</label>
                            <input type="number" min="0" className="power-input w-full p-2 font-black italic" value={gameStats.balls} onChange={(e) => setGameStats({...gameStats, balls: parseInt(e.target.value) || 0})} />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4 p-4 bg-power-blue/5 rounded-2xl">
                        <div className="flex-1 text-center">
                          <p className="text-xs font-black uppercase text-gray-500">打擊率 AVG</p>
                          <p className="text-xl font-black italic text-power-blue">{gameStats.avg.toFixed(3)}</p>
                        </div>
                        <div className="flex-1 text-center border-x-2 border-power-border/10">
                          <p className="text-xs font-black uppercase text-gray-500">上壘率 OBP</p>
                          <p className="text-xl font-black italic text-power-blue">{gameStats.obp.toFixed(3)}</p>
                        </div>
                        <div className="flex-1 text-center">
                          <p className="text-xs font-black uppercase text-gray-500">防禦率 ERA</p>
                          <p className="text-xl font-black italic text-power-red">{gameStats.era.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleSave('game')} disabled={loading} className="w-full power-button bg-power-yellow text-power-border py-3 text-xl flex items-center justify-center gap-2">
                      <Save className="w-5 h-5" /> 新增比賽紀錄
                    </button>
                  </div>

                  {/* Game Stats Averages */}
                  {averages && (
                    <div className="power-card p-6 bg-power-cream border-2 border-power-border/5">
                      <h3 className="text-sm font-black italic uppercase mb-4 flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-power-blue" /> 平均數據 SUMMARY
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-black italic text-power-blue">{averages.game.avg.toFixed(3)}</p>
                          <p className="text-[8px] font-black uppercase text-gray-500">AVG</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black italic text-power-blue">{averages.game.obp.toFixed(3)}</p>
                          <p className="text-[8px] font-black uppercase text-gray-500">OBP</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black italic text-power-blue">{averages.game.hr.toFixed(1)}</p>
                          <p className="text-[8px] font-black uppercase text-gray-500">HR</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Test Stats Entry */}
                <div className="space-y-6">
                  <div className="power-card p-8 bg-white">
                    <h2 className="text-2xl font-black italic uppercase mb-6 flex items-center gap-3">
                      <div className="bg-power-blue p-2 rounded-xl">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                      能力值設定
                    </h2>
                    <div className="space-y-4 mb-6">
                      {Object.entries(abilityStats).map(([key, val]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-black uppercase text-gray-500 tracking-widest">
                              {key === 'batting' ? '打擊' : key === 'pitching' ? '投球' : key === 'fielding' ? '守備' : key === 'speed' ? '速度' : '體能'}
                            </label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                min="0" 
                                max="100" 
                                className="power-input w-16 p-1 text-center font-black italic text-power-blue"
                                value={val}
                                onChange={(e) => setAbilityStats({...abilityStats, [key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))})}
                              />
                            </div>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            className="w-full accent-power-blue h-2 bg-power-cream rounded-full appearance-none cursor-pointer"
                            value={val}
                            onChange={(e) => setAbilityStats({...abilityStats, [key]: parseInt(e.target.value)})}
                          />
                        </div>
                      ))}
                    </div>
                    <button onClick={handleSaveAbility} disabled={loading} className="w-full power-button bg-power-blue text-white py-3 text-xl flex items-center justify-center gap-2">
                      <Save className="w-5 h-5" /> 儲存能力值
                    </button>
                  </div>

                  <div className="power-card p-8 bg-white">
                    <h2 className="text-2xl font-black italic uppercase mb-6 flex items-center gap-3">
                      <div className="bg-power-green p-2 rounded-xl">
                        <Activity className="w-6 h-6 text-white" />
                      </div>
                      新增測驗成績
                    </h2>
                    <div className="grid grid-cols-1 gap-4 mb-6">
                      <div className="space-y-1">
                        <label className="text-sm font-black uppercase text-gray-500 tracking-widest">跑壘速度 (秒)</label>
                        <input type="number" step="0.01" className="power-input w-full p-2 font-black italic" value={testStats.runningSpeed} onChange={(e) => setTestStats({...testStats, runningSpeed: parseFloat(e.target.value) || 0})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-black uppercase text-gray-500 tracking-widest">球速 (km/h)</label>
                        <input type="number" className="power-input w-full p-2 font-black italic" value={testStats.pitchingVelocity} onChange={(e) => setTestStats({...testStats, pitchingVelocity: parseInt(e.target.value) || 0})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-black uppercase text-gray-500 tracking-widest">投遠距離 (m)</label>
                        <input type="number" className="power-input w-full p-2 font-black italic" value={testStats.throwingDistance} onChange={(e) => setTestStats({...testStats, throwingDistance: parseInt(e.target.value) || 0})} />
                      </div>
                    </div>
                    <button onClick={() => handleSave('test')} disabled={loading} className="w-full power-button bg-power-green text-white py-3 text-xl flex items-center justify-center gap-2">
                      <Save className="w-5 h-5" /> 新增測驗紀錄
                    </button>
                  </div>

                  {/* Test Stats Averages */}
                  {averages && (
                    <div className="power-card p-6 bg-power-cream border-2 border-power-border/5">
                      <h3 className="text-sm font-black italic uppercase mb-4 flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-power-green" /> 平均數據 SUMMARY
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-black italic text-power-green">{averages.test.runningSpeed.toFixed(2)}</p>
                          <p className="text-[8px] font-black uppercase text-gray-500">SPEED (S)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black italic text-power-green">{averages.test.pitchingVelocity.toFixed(0)}</p>
                          <p className="text-[8px] font-black uppercase text-gray-500">VEL (KM/H)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black italic text-power-green">{averages.test.throwingDistance.toFixed(0)}</p>
                          <p className="text-[8px] font-black uppercase text-gray-500">DIST (M)</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Trend Charts */}
              {records.length > 0 && (
                <div className="power-card p-8 bg-white">
                  <h2 className="text-2xl font-black italic uppercase mb-8 flex items-center gap-3">
                    <TrendingUp className="w-7 h-7 text-power-blue" />
                    成長趨勢圖 TRENDS
                  </h2>
                  
                  <div className="space-y-12">
                    <div className="h-[300px]">
                      <h3 className="text-xs font-black uppercase text-gray-500 mb-4 tracking-widest">打擊表現趨勢 (AVG / OBP)</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.filter(d => d.type === 'game')}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                          <XAxis dataKey="date" tick={{fontSize: 10, fontWeight: 900}} />
                          <YAxis tick={{fontSize: 10, fontWeight: 900}} domain={[0, 1]} />
                          <Tooltip contentStyle={{ borderRadius: '1rem', border: '3px solid #1a1a1a', fontWeight: 900 }} />
                          <Legend />
                          <Line type="monotone" dataKey="avg" name="打擊率 AVG" stroke="#3b82f6" strokeWidth={4} dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                          <Line type="monotone" dataKey="obp" name="上壘率 OBP" stroke="#f59e0b" strokeWidth={4} dot={{ r: 6, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="h-[300px]">
                      <h3 className="text-xs font-black uppercase text-gray-500 mb-4 tracking-widest">球速測驗趨勢 (KM/H)</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.filter(d => d.type === 'test')}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                          <XAxis dataKey="date" tick={{fontSize: 10, fontWeight: 900}} />
                          <YAxis tick={{fontSize: 10, fontWeight: 900}} />
                          <Tooltip contentStyle={{ borderRadius: '1rem', border: '3px solid #1a1a1a', fontWeight: 900 }} />
                          <Line type="monotone" dataKey="pitchingVelocity" name="球速 Velocity" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          ) : (
            <div className="power-card bg-white h-full flex flex-col items-center justify-center p-20 opacity-30 text-center">
              <Target className="w-24 h-24 mb-6" />
              <p className="text-3xl font-black italic uppercase tracking-widest">請從左側選擇球員</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
