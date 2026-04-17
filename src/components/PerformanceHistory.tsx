import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { PerformanceRecord } from '../types';
import { motion } from 'motion/react';
import { Trophy, Target, ChevronLeft, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

interface PerformanceHistoryProps {
  onBack: () => void;
}

export default function PerformanceHistory({ onBack }: PerformanceHistoryProps) {
  const { profile } = useAuth();
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllGames, setShowAllGames] = useState(false);
  const [showAllTests, setShowAllTests] = useState(false);

  useEffect(() => {
    if (!profile?.uid || !profile?.teamId) return;

    const fetchRecords = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'performance_records'),
          where('teamId', '==', profile.teamId),
          where('playerUid', '==', profile.uid),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PerformanceRecord)));
      } catch (error) {
        console.error("PerformanceHistory: Error fetching records:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [profile]);

  const gameRecords = records.filter(r => r.type === 'game');
  const testRecords = records.filter(r => r.type === 'test');

  const visibleGames = showAllGames ? gameRecords : gameRecords.slice(0, 3);
  const visibleTests = showAllTests ? testRecords : testRecords.slice(0, 3);

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-center gap-6">
        <button 
          onClick={onBack}
          className="p-3 bg-white border-[3px] border-power-border rounded-2xl hover:bg-power-cream transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-power-border">
            比賽與測驗成績 <span className="text-power-blue">PERFORMANCE HISTORY</span>
          </h1>
          <p className="text-gray-500 font-black text-sm italic uppercase tracking-widest">檢視過往所有比賽紀錄與測驗數據</p>
        </div>
      </header>

      {/* Summary Stats Table */}
      {records.length > 0 && (
        <section className="power-card p-8 bg-white overflow-hidden">
          <h2 className="text-2xl font-black italic uppercase mb-8 flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-power-blue" />
            個人數據累計統整 SUMMARY
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-base font-black uppercase text-power-blue tracking-widest border-b-2 border-power-blue/20 pb-2">比賽累計 BATTING & PITCHING</h3>
              <div className="grid grid-cols-3 gap-4">
                {(() => {
                  const totalHits = gameRecords.reduce((acc, r) => acc + (r.stats.hits || 0), 0);
                  const totalAB = gameRecords.reduce((acc, r) => acc + (r.stats.atBats || 0), 0);
                  const totalBB = gameRecords.reduce((acc, r) => acc + (r.stats.walks || 0), 0);
                  const totalPA = gameRecords.reduce((acc, r) => acc + (r.stats.plateAppearances || 0), 0);
                  const totalSB = gameRecords.reduce((acc, r) => acc + (r.stats.stolenBases || 0), 0);
                  const totalER = gameRecords.reduce((acc, r) => acc + (r.stats.earnedRuns || 0), 0);
                  const totalIP = gameRecords.reduce((acc, r) => acc + (r.stats.inningsPitched || 0), 0);
                  const totalHA = gameRecords.reduce((acc, r) => acc + (r.stats.hitsAllowed || 0), 0);
                  const totalPBB = gameRecords.reduce((acc, r) => acc + (r.stats.pitcherWalks || 0), 0);
                  const totalStrikes = gameRecords.reduce((acc, r) => acc + (r.stats.strikes || 0), 0);
                  const totalPitches = gameRecords.reduce((acc, r) => acc + (r.stats.totalPitches || 0), 0);

                  const avgVal = totalAB > 0 ? (totalHits / totalAB) : 0;
                  const obpVal = totalPA > 0 ? ((totalHits + totalBB) / totalPA) : 0;
                  const eraVal = totalIP > 0 ? ((totalER * 9) / totalIP) : 0;
                  const whipVal = totalIP > 0 ? ((totalHA + totalPBB) / totalIP) : 0;
                  const strikeRate = totalPitches > 0 ? Math.round((totalStrikes / totalPitches) * 100) : 0;

                  return (
                    <>
                      {[
                        { label: '打擊率', value: avgVal.toFixed(3).replace(/^0/, '') },
                        { label: '上壘率', value: obpVal.toFixed(3).replace(/^0/, '') },
                        { label: '盜壘', value: totalSB },
                        { label: '防禦率', value: eraVal.toFixed(2) },
                        { label: '好球率', value: `${strikeRate}%` },
                        { label: '被上壘率 (WHIP)', value: whipVal.toFixed(2) },
                      ].map((s, i) => (
                        <div key={i} className="bg-power-cream p-4 rounded-2xl border-2 border-power-border/5 text-center">
                          <p className="text-[10px] font-black text-gray-500 mb-1 uppercase tracking-tighter">{s.label}</p>
                          <p className="text-2xl font-black italic text-power-border">{s.value}</p>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-base font-black uppercase text-power-green tracking-widest border-b-2 border-power-green/20 pb-2">測驗最佳紀錄 BEST TESTS</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: '最快跑速 (S)', value: Math.min(...testRecords.map(r => r.stats.runningSpeed || 99)).toFixed(2) },
                  { label: '最快球速 (KM)', value: Math.max(...testRecords.map(r => r.stats.pitchingVelocity || 0)) },
                  { label: '最遠距離 (M)', value: Math.max(...testRecords.map(r => r.stats.throwingDistance || 0)) },
                ].map((s, i) => (
                  <div key={i} className="bg-power-cream p-4 rounded-2xl border-2 border-power-border/5 text-center">
                    <p className="text-[10px] font-black text-gray-500 mb-1 uppercase tracking-tighter">{s.label}</p>
                    <p className="text-2xl font-black italic text-power-green">{s.value === "Infinity" || s.value === "99.00" ? '-' : s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Game Records Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black italic uppercase flex items-center gap-2 text-power-blue">
              <Trophy className="w-8 h-8" /> 比賽紀錄 GAMES
            </h2>
            {gameRecords.length > 3 && (
              <button 
                onClick={() => setShowAllGames(!showAllGames)}
                className="text-xs font-black italic uppercase text-power-blue hover:underline"
              >
                {showAllGames ? '收起紀錄 HIDE' : `展開更多 (+${gameRecords.length - 3}) SHOW ALL`}
              </button>
            )}
          </div>
          
          {gameRecords.length === 0 ? (
            <div className="power-card p-12 text-center opacity-30">
              <p className="font-black italic uppercase tracking-widest text-sm">尚無任何比賽數據</p>
            </div>
          ) : (
            visibleGames.map((record) => {
              const battingRows = [
                [
                  { label: '打席 PA', value: record.stats.plateAppearances },
                  { label: '打數 AB', value: record.stats.atBats },
                  { label: '安打 H', value: record.stats.hits },
                  { label: '打點 RBI', value: record.stats.rbi },
                ],
                [
                  { label: '四壞 BB', value: record.stats.walks },
                  { label: '三振 SO', value: record.stats.strikeouts },
                  { label: '盜壘 SB', value: record.stats.stolenBases },
                ],
                [
                  { label: '打擊率 AVG', value: record.stats.avg?.toFixed(3) },
                  { label: '上壘率 OBP', value: record.stats.obp?.toFixed(3) },
                ]
              ];

              const pitchingRows = [
                [
                  { label: '局數 IP', value: record.stats.inningsPitched },
                  { label: '失分 R', value: record.stats.runsAllowed },
                  { label: '自責 ER', value: record.stats.earnedRuns },
                  { label: '防禦率 ERA', value: record.stats.era?.toFixed(2) },
                ],
                [
                  { label: '用球 NP', value: record.stats.totalPitches },
                  { label: '好球 S', value: record.stats.strikes },
                  { label: '壞球 B', value: record.stats.balls },
                  { label: '保送 BB', value: record.stats.pitcherWalks },
                  { label: '奪三振 SO', value: record.stats.pitcherStrikeouts },
                ]
              ];

              return (
                <motion.div 
                  key={record.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="power-card p-6 bg-white border-l-[10px] border-power-blue space-y-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.05)]"
                >
                  <div className="flex justify-between items-center border-b-2 border-power-border/5 pb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-power-blue" />
                      <span className="font-black italic text-power-border text-xl">
                        {record.date?.toDate ? format(record.date.toDate(), 'yyyy/MM/dd') : 
                         typeof record.date === 'string' ? format(parseISO(record.date), 'yyyy/MM/dd') :
                         record.date ? format(new Date(record.date), 'yyyy/MM/dd') : '剛剛'}
                      </span>
                    </div>
                    <span className="bg-power-blue text-white px-3 py-1 rounded-full text-[10px] font-black italic uppercase tracking-widest">
                      GAME RECORD
                    </span>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xl font-black uppercase text-power-blue border-b-2 border-power-blue/10 pb-1">打擊數據 BATTING</h4>
                    {battingRows.map((row, ridx) => (
                      <div key={ridx} className="grid grid-cols-4 gap-2">
                        {row.map((stat, idx) => (
                          <div key={idx} className="bg-power-cream/50 p-2 rounded-lg border border-power-border/5">
                            <p className="text-xs font-black text-gray-500 uppercase leading-none mb-1">{stat.label}</p>
                            <p className="text-xl font-black italic text-power-border">{stat.value ?? '0'}</p>
                          </div>
                        ))}
                      </div>
                    ))}

                    <h4 className="text-xl font-black uppercase text-power-red border-b-2 border-power-red/10 pb-1 pt-2">投球數據 PITCHING</h4>
                    {pitchingRows.map((row, ridx) => (
                      <div key={ridx} className={cn("grid gap-2", ridx === 0 ? "grid-cols-4" : "grid-cols-5")}>
                        {row.map((stat, idx) => (
                          <div key={idx} className="bg-power-red/5 p-2 rounded-lg border border-power-red/5">
                            <p className="text-xs font-black text-gray-500 uppercase leading-none mb-1">{stat.label}</p>
                            <p className="text-xl font-black italic text-power-red">{stat.value ?? '0'}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })
          )}
        </section>

        {/* Test Records Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black italic uppercase flex items-center gap-2 text-power-green">
              <Target className="w-8 h-8" /> 測驗成績 TESTS
            </h2>
            {testRecords.length > 3 && (
              <button 
                onClick={() => setShowAllTests(!showAllTests)}
                className="text-xs font-black italic uppercase text-power-green hover:underline"
              >
                {showAllTests ? '收起紀錄 HIDE' : `展開更多 (+${testRecords.length - 3}) SHOW ALL`}
              </button>
            )}
          </div>

          {testRecords.length === 0 ? (
            <div className="power-card p-12 text-center opacity-30">
              <p className="font-black italic uppercase tracking-widest text-sm">尚無任何測驗數據</p>
            </div>
          ) : (
            visibleTests.map((record) => (
              <motion.div 
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="power-card p-6 bg-white border-l-[10px] border-power-green"
              >
                <div className="flex justify-between items-center mb-4 border-b-2 border-power-border/5 pb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-power-green" />
                      <span className="font-black italic text-power-border text-xl">
                        {record.date?.toDate ? format(record.date.toDate(), 'yyyy/MM/dd') : 
                         typeof record.date === 'string' ? format(parseISO(record.date), 'yyyy/MM/dd') :
                         record.date ? format(new Date(record.date), 'yyyy/MM/dd') : '剛剛'}
                      </span>
                    </div>
                  <span className="bg-power-green text-white px-3 py-1 rounded-full text-[10px] font-black italic uppercase tracking-widest">
                    TEST RECORD
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '跑壘速度 RUN', value: record.stats.runningSpeed, unit: 'S' },
                    { label: '投球球速 SPEED', value: record.stats.pitchingVelocity, unit: 'KM' },
                    { label: '投遠距離 DIST', value: record.stats.throwingDistance, unit: 'M' },
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-power-cream p-3 rounded-xl border-2 border-power-border/5">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{stat.label}</p>
                      <p className="text-xl font-black italic text-power-green">
                        {stat.value ?? '-'} <span className="text-[10px] text-gray-400 not-italic ml-1">{stat.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
