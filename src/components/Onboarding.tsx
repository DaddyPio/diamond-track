import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, getDocs, setDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { useAuth } from '../AuthContext';
import { Team, UserProfile } from '../types';
import { Users, User, Trophy, Plus, Check, ArrowRight, Circle as Baseball, BookOpen } from 'lucide-react';

const sopManualHref = `${import.meta.env.BASE_URL}sop.html`;
import { cn } from '../lib/utils';

export default function Onboarding() {
  const { user } = useAuth();
  const [step, setStep] = useState<'role' | 'team'>('role');
  const [role, setRole] = useState<'coach' | 'player' | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localQuotaExceeded, setLocalQuotaExceeded] = useState(false);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const q = query(collection(db, 'teams'), orderBy('name'));
        const snapshot = await getDocs(q);
        setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      } catch (error) {
        console.error("Error fetching teams:", error);
        if (error instanceof Error && (error.message.includes('Quota exceeded') || error.message.includes('quota'))) {
          setLocalQuotaExceeded(true);
        }
      }
    };
    fetchTeams();
  }, []);

  const handleComplete = async () => {
    if (!user || !role) return;
    if (!isCreatingTeam && !selectedTeamId) return;
    if (isCreatingTeam && !newTeamName) return;

    setLoading(true);
    try {
      let teamId = selectedTeamId;

      if (isCreatingTeam) {
        const teamRef = doc(collection(db, 'teams'));
        teamId = teamRef.id;
        const newTeam: Team = {
          id: teamId,
          name: newTeamName,
          coachUid: user.uid,
          createdAt: serverTimestamp(),
        };
        await setDoc(teamRef, newTeam);
      }

      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: role,
        playerType: role === 'player' ? 'fielder' : undefined,
        status: role === 'coach' ? 'approved' : 'pending',
        teamId: teamId,
        stats: {
          batting: 50,
          pitching: 50,
          fielding: 50,
          speed: 50,
          stamina: 50,
        },
        gameStats: {
          avg: 0,
          obp: 0,
          hr: 0,
          rbi: 0,
          era: 0,
          wins: 0,
        }
      };

      await setDoc(doc(db, 'users', user.uid), profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-power-cream flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <div className="power-card p-10 bg-white">
          <div className="text-center mb-10">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="inline-block mb-4"
            >
              <Baseball className="w-16 h-16 text-power-blue" />
            </motion.div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-power-border">
              歡迎加入 <span className="text-power-blue">DIAMOND TRACK</span>
            </h1>
            <p className="text-gray-500 font-black italic uppercase tracking-widest mt-2">請完成您的球員/教練註冊</p>
          </div>

          {step === 'role' ? (
            <div className="space-y-8">
              <h2 className="text-2xl font-black italic uppercase text-center text-power-border">選擇您的身分 ROLE</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button 
                  onClick={() => setRole('coach')}
                  className={cn(
                    "power-card p-8 flex flex-col items-center gap-4 transition-all border-[4px]",
                    role === 'coach' ? "bg-power-blue text-white border-power-border scale-105 shadow-[8px_8px_0_0_rgba(0,0,0,0.2)]" : "bg-white text-power-border border-transparent hover:bg-power-blue/5"
                  )}
                >
                  <Users className={cn("w-16 h-16", role === 'coach' ? "text-power-yellow" : "text-power-blue")} />
                  <div className="text-center">
                    <p className="text-2xl font-black italic uppercase">教練</p>
                    <p className="text-xs font-black uppercase opacity-60">COACH / MANAGER</p>
                  </div>
                </button>

                <button 
                  onClick={() => setRole('player')}
                  className={cn(
                    "power-card p-8 flex flex-col items-center gap-4 transition-all border-[4px]",
                    role === 'player' ? "bg-power-green text-white border-power-border scale-105 shadow-[8px_8px_0_0_rgba(0,0,0,0.2)]" : "bg-white text-power-border border-transparent hover:bg-power-green/5"
                  )}
                >
                  <User className={cn("w-16 h-16", role === 'player' ? "text-power-yellow" : "text-power-green")} />
                  <div className="text-center">
                    <p className="text-2xl font-black italic uppercase">球員</p>
                    <p className="text-xs font-black uppercase opacity-60">PLAYER / ATHLETE</p>
                  </div>
                </button>
              </div>

              <button 
                disabled={!role}
                onClick={() => setStep('team')}
                className="w-full power-button bg-power-yellow text-power-border py-5 text-2xl flex items-center justify-center gap-3 disabled:opacity-50"
              >
                下一步 NEXT
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <h2 className="text-2xl font-black italic uppercase text-center text-power-border">
                {role === 'coach' ? '創建或加入球隊 TEAM' : '加入您的球隊 TEAM'}
              </h2>

              <div className="space-y-6">
                {role === 'coach' && (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setIsCreatingTeam(true)}
                      className={cn(
                        "w-full power-card p-6 flex items-center gap-4 border-[3px] transition-all",
                        isCreatingTeam ? "bg-power-blue text-white border-power-border" : "bg-white text-power-border border-transparent"
                      )}
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-xl font-black italic uppercase">創建新球隊 CREATE NEW TEAM</span>
                    </button>

                    {isCreatingTeam && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-4 bg-power-cream rounded-2xl border-[3px] border-power-border"
                      >
                        <label className="text-xs font-black uppercase text-gray-500 tracking-widest mb-2 block">球隊名稱 TEAM NAME</label>
                        <input 
                          type="text"
                          className="power-input w-full p-4 font-black italic"
                          placeholder="例如：台北大雷龍隊"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                        />
                      </motion.div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <Trophy className="w-5 h-5 text-power-yellow" />
                    <span className="text-xs font-black uppercase text-gray-500 tracking-widest">選擇現有球隊 SELECT EXISTING</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {localQuotaExceeded && (
                      <div className="bg-power-red/10 border-2 border-power-red/30 p-4 rounded-2xl text-center">
                        <p className="text-power-red font-black italic text-sm">⚠️ 已達資料庫讀取上限，無法載入球隊列表</p>
                        <p className="text-[10px] text-power-border/60 mt-1 uppercase font-bold">請稍後再試或聯繫管理員</p>
                      </div>
                    )}
                    {teams.map(team => (
                      <button 
                        key={team.id}
                        onClick={() => {
                          setSelectedTeamId(team.id);
                          setIsCreatingTeam(false);
                        }}
                        className={cn(
                          "w-full power-card p-4 flex items-center justify-between border-[3px] transition-all",
                          selectedTeamId === team.id ? "bg-power-blue text-white border-power-border" : "bg-white text-power-border border-transparent"
                        )}
                      >
                        <span className="font-black italic text-lg">{team.name}</span>
                        {selectedTeamId === team.id && <Check className="w-6 h-6" />}
                      </button>
                    ))}
                    {teams.length === 0 && (
                      <p className="text-center py-8 text-gray-400 font-black italic uppercase">目前尚無球隊</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setStep('role')}
                  className="px-8 power-button bg-white text-power-border py-5 text-xl"
                >
                  返回 BACK
                </button>
                <button 
                  disabled={loading || (!isCreatingTeam && !selectedTeamId) || (isCreatingTeam && !newTeamName)}
                  onClick={handleComplete}
                  className="flex-1 power-button bg-power-blue text-white py-5 text-2xl flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? '處理中...' : '完成註冊 COMPLETE'}
                  <Check className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 border-t-2 border-power-border/10 pt-6 text-center">
          <a
            href={sopManualHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 text-sm font-black italic text-power-blue hover:underline"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            使用手冊（SOP）
          </a>
        </div>
      </motion.div>
    </div>
  );
}
