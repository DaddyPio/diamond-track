import React, { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, serverTimestamp, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../AuthContext';
import { Instruction, UserProfile, TrainingLog, InstructionCompletion } from '../types';
import { motion } from 'motion/react';
import { Send, Users, User, Bell, CheckCircle2, ClipboardList, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Instructions() {
  const { profile } = useAuth();
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [reportingInstruction, setReportingInstruction] = useState<Instruction | null>(null);
  const [viewingInstruction, setViewingInstruction] = useState<Instruction | null>(null);
  const [feedbacks, setFeedbacks] = useState<TrainingLog[]>([]);
  const [completions, setCompletions] = useState<InstructionCompletion[]>([]);
  const [playerCompletionIds, setPlayerCompletionIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'todo' | 'completed'>('todo');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [newInstruction, setNewInstruction] = useState({
    targetUid: 'team',
    title: '打擊練習',
    customTitle: '',
    content: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
  });
  const [reportData, setReportData] = useState({
    description: '',
    executionDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const trainingOptions = ['打擊練習', '投球練習', '守備練習', '體能訓練', '自主訓練', '其他'];

  useEffect(() => {
    if (!profile?.teamId) return;

    const fetchData = async () => {
      try {
        // Fetch players for coach
        if (profile.role === 'coach') {
          const qPlayers = query(
            collection(db, 'users'), 
            where('role', '==', 'player'),
            where('teamId', '==', profile.teamId)
          );
          const pSnapshot = await getDocs(qPlayers);
          setPlayers(pSnapshot.docs.map(doc => doc.data() as UserProfile));
        }

        // Fetch instructions
        const qInst = query(
          collection(db, 'instructions'), 
          where('teamId', '==', profile.teamId),
          orderBy('createdAt', 'desc')
        );
        const iSnapshot = await getDocs(qInst);
        let allInst = iSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Instruction));
        
        if (profile.role === 'player') {
          allInst = allInst.filter(inst => 
            inst.targetUid === 'team' || 
            inst.targetUid === profile.uid || 
            (inst.targetUid === 'custom' && inst.targetUids?.includes(profile.uid))
          );
        }
        setInstructions(allInst);

        // Fetch user's completion IDs if player
        if (profile.role === 'player') {
          const qUserComp = query(
            collection(db, 'instruction_completions'),
            where('teamId', '==', profile.teamId),
            where('playerUid', '==', profile.uid)
          );
          const ucSnapshot = await getDocs(qUserComp);
          setPlayerCompletionIds(ucSnapshot.docs.map(doc => (doc.data() as InstructionCompletion).instructionId));
        }

      } catch (error) {
        console.error("Instructions: Error fetching data:", error);
      }
    };

    fetchData();
  }, [profile]);

  useEffect(() => {
    if (!profile?.teamId || instructions.length === 0) {
      setCompletions([]);
      return;
    }

    const fetchCompletions = async () => {
      try {
        const qComp = query(
          collection(db, 'instruction_completions'),
          where('teamId', '==', profile.teamId),
          where('instructionId', 'in', instructions.map(i => i.id).slice(0, 30))
        );
        const snapshot = await getDocs(qComp);
        setCompletions(snapshot.docs.map(doc => doc.data() as InstructionCompletion));
      } catch (error) {
        console.error("Instructions: Error fetching completions:", error);
      }
    };

    fetchCompletions();
  }, [profile, instructions]);

  useEffect(() => {
    if (!viewingInstruction || !profile?.teamId) {
      setFeedbacks([]);
      return;
    }

    const fetchFeedbacks = async () => {
      try {
        const q = query(
          collection(db, 'training_logs'),
          where('teamId', '==', profile.teamId),
          where('instructionId', '==', viewingInstruction.id),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        setFeedbacks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingLog)));
      } catch (error) {
        console.error("Feedbacks: Error fetching feedbacks:", error);
      }
    };

    fetchFeedbacks();
  }, [viewingInstruction, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || profile.role !== 'coach') return;

    try {
      const isCustomTitle = newInstruction.title === '其他' || newInstruction.title === '自主訓練';
      const title = isCustomTitle && newInstruction.customTitle ? `${newInstruction.title}: ${newInstruction.customTitle}` : newInstruction.title;
      
      const instructionRef = await addDoc(collection(db, 'instructions'), {
        coachUid: profile.uid,
        teamId: profile.teamId,
        createdAt: serverTimestamp(),
        isRead: false,
        targetUid: newInstruction.targetUid,
        targetUids: newInstruction.targetUid === 'custom' ? selectedPlayers : null,
        title: title,
        content: newInstruction.content,
        dueDate: newInstruction.dueDate
      });

      // Create notifications
      const notificationData = {
        teamId: profile.teamId,
        title: `新指示：${title}`,
        content: newInstruction.content,
        type: 'instruction',
        relatedId: instructionRef.id,
        isRead: false,
        createdAt: serverTimestamp()
      };

      if (newInstruction.targetUid === 'team') {
        // For team-wide, we can either create individual notifications or a special 'team' notification
        // Let's create individual ones for simplicity in querying
        players.forEach(async (player) => {
          await addDoc(collection(db, 'notifications'), {
            ...notificationData,
            recipientUid: player.uid
          });
        });
      } else if (newInstruction.targetUid === 'custom') {
        selectedPlayers.forEach(async (uid) => {
          await addDoc(collection(db, 'notifications'), {
            ...notificationData,
            recipientUid: uid
          });
        });
      } else {
        await addDoc(collection(db, 'notifications'), {
          ...notificationData,
          recipientUid: newInstruction.targetUid
        });
      }
      
      setIsAdding(false);
      setNewInstruction({ 
        targetUid: 'team', 
        title: '打擊練習', 
        customTitle: '', 
        content: '', 
        dueDate: format(new Date(), 'yyyy-MM-dd') 
      });
      setSelectedPlayers([]);
      setMessage({ type: 'success', text: '指示已成功發佈！' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error adding instruction:", error);
      setMessage({ type: 'error', text: '發佈失敗，請稍後再試。' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleReportProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !reportingInstruction) return;

    try {
      // Add training log
      const logPath = 'training_logs';
      const logDate = new Date(reportData.executionDate);
      if (isNaN(logDate.getTime())) {
          throw new Error("無效的日期格式");
      }
      
      await addDoc(collection(db, logPath), {
        playerUid: profile.uid,
        teamId: profile.teamId,
        date: logDate,
        type: reportingInstruction.title,
        duration: 60, // Default duration
        description: `[針對指令：${reportingInstruction.title}] ${reportData.description}`,
        instructionId: reportingInstruction.id
      });

      // Add completion record
      await addDoc(collection(db, 'instruction_completions'), {
        instructionId: reportingInstruction.id,
        playerUid: profile.uid,
        teamId: profile.teamId,
        completedAt: serverTimestamp()
      });

      // Create notification for coach
      await addDoc(collection(db, 'notifications'), {
        recipientUid: reportingInstruction.coachUid,
        teamId: profile.teamId,
        title: '指令已完成',
        content: `${profile.displayName} 已完成指令：${reportingInstruction.title}`,
        type: 'completion',
        relatedId: reportingInstruction.id,
        isRead: false,
        createdAt: serverTimestamp()
      });

      // Mark instruction as read/completed (only if it's a personal instruction)
      if (reportingInstruction.id && reportingInstruction.targetUid !== 'team') {
        await updateDoc(doc(db, 'instructions', reportingInstruction.id), {
          isRead: true
        });
      }

      setReportingInstruction(null);
      setReportData({ description: '', executionDate: format(new Date(), 'yyyy-MM-dd') });
      setMessage({ type: 'success', text: '回報成功！訓練進度已提交。' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error reporting progress:", error);
      setMessage({ type: 'error', text: '提交失敗，請檢查權限或網路連線。' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

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

  const isExpired = (dueDate: string | undefined, instructionId: string) => {
    if (!dueDate) return false;
    // Check if current user has completed this instruction
    const isCompleted = profile?.role === 'coach' 
      ? false 
      : playerCompletionIds.includes(instructionId);
    
    if (isCompleted) return false;
    return new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
  };

  const filteredInstructions = instructions.filter(inst => {
    const isCompleted = profile?.role === 'coach' 
      ? getCompletionStats(inst).percent === 100
      : playerCompletionIds.includes(inst.id!);
    return activeTab === 'todo' ? !isCompleted : isCompleted;
  });

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)]">教練指示</h1>
            <p className="text-gray-500 font-black text-sm italic uppercase tracking-widest">接收與查看球隊最新戰術與通知</p>
          </div>
        </div>
        {profile?.role === 'coach' && (
          <button 
            onClick={() => setIsAdding(true)}
            className="power-button bg-power-blue text-white px-8 py-4 text-xl flex items-center gap-3"
          >
            <Send className="w-6 h-6" />
            發佈指示
          </button>
        )}
      </header>

      <div className="flex gap-4">
        <button 
          onClick={() => setActiveTab('todo')}
          className={cn(
            "flex-1 py-4 font-black italic uppercase tracking-widest border-[3px] rounded-2xl transition-all",
            activeTab === 'todo' 
              ? "bg-power-blue text-white border-power-border shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]" 
              : "bg-white text-power-border border-transparent hover:bg-power-cream"
          )}
        >
          {profile?.role === 'coach' ? '進行中 IN PROGRESS' : '待完成 TO DO'}
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          className={cn(
            "flex-1 py-4 font-black italic uppercase tracking-widest border-[3px] rounded-2xl transition-all",
            activeTab === 'completed' 
              ? "bg-power-green text-white border-power-border shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]" 
              : "bg-white text-power-border border-transparent hover:bg-power-cream"
          )}
        >
          {profile?.role === 'coach' ? '已完成 COMPLETED' : '已完成 COMPLETED'}
        </button>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-2xl font-black italic uppercase tracking-widest border-[3px] flex items-center gap-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] ${
            message.type === 'success' ? "bg-power-green/10 text-power-green border-power-green/30" : "bg-power-red/10 text-power-red border-power-red/30"
          }`}
        >
          <Bell className="w-6 h-6" />
          {message.text}
        </motion.div>
      )}

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="power-card p-10 bg-gradient-to-br from-white to-power-blue/5"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-black uppercase text-gray-500 tracking-widest">發送對象 TARGET</label>
                <select 
                  className="power-input w-full p-4 font-black italic bg-white"
                  value={newInstruction.targetUid}
                  onChange={(e) => setNewInstruction({...newInstruction, targetUid: e.target.value})}
                >
                  <option value="team">全隊隊員 ALL TEAM</option>
                  <option value="custom">自選群組 CUSTOM GROUP</option>
                  {players.map(p => (
                    <option key={p.uid} value={p.uid}>{p.displayName} (#{p.playerNumber})</option>
                  ))}
                </select>
              </div>
              {newInstruction.targetUid === 'custom' && (
                <div className="col-span-full space-y-3">
                  <label className="text-sm font-black uppercase text-gray-500 tracking-widest">選擇球員 SELECT PLAYERS</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-white border-2 border-power-border rounded-2xl max-h-48 overflow-y-auto custom-scrollbar">
                    {players.map(p => (
                      <label key={p.uid} className="flex items-center gap-3 p-2 hover:bg-power-cream rounded-xl cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-power-blue"
                          checked={selectedPlayers.includes(p.uid)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPlayers([...selectedPlayers, p.uid]);
                            } else {
                              setSelectedPlayers(selectedPlayers.filter(id => id !== p.uid));
                            }
                          }}
                        />
                        <span className="font-black italic text-sm">{p.displayName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <label className="text-sm font-black uppercase text-gray-500 tracking-widest">標題 TITLE</label>
                <select 
                  className="power-input w-full p-4 font-black italic bg-white"
                  value={newInstruction.title}
                  onChange={(e) => setNewInstruction({...newInstruction, title: e.target.value})}
                >
                  {trainingOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {(newInstruction.title === '其他' || newInstruction.title === '自主訓練') && (
                  <motion.input 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    type="text"
                    placeholder={newInstruction.title === '自主訓練' ? "請輸入自主訓練內容 (如：重量訓練)..." : "請輸入自定義標題..."}
                    className="power-input w-full p-4 font-black italic mt-2"
                    value={newInstruction.customTitle}
                    onChange={(e) => setNewInstruction({...newInstruction, customTitle: e.target.value})}
                  />
                )}
              </div>
              <div className="space-y-3">
                <label className="text-sm font-black uppercase text-gray-500 tracking-widest">預計完成日 COMPLETION DATE</label>
                <input 
                  type="date"
                  className="power-input w-full p-4 font-black italic bg-white"
                  value={newInstruction.dueDate}
                  onChange={(e) => setNewInstruction({...newInstruction, dueDate: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-black uppercase text-gray-500 tracking-widest">內容 CONTENT</label>
              <textarea 
                className="power-input w-full p-6 h-48 font-black italic resize-none"
                placeholder="請輸入詳細指示內容..."
                value={newInstruction.content}
                onChange={(e) => setNewInstruction({...newInstruction, content: e.target.value})}
              />
            </div>
            <div className="flex gap-6">
              <button type="submit" className="flex-1 power-button bg-power-blue text-white py-5 text-2xl">發佈指示 SEND</button>
              <button type="button" onClick={() => setIsAdding(false)} className="px-12 power-button bg-white text-power-border py-5 text-2xl">取消 CANCEL</button>
            </div>
          </form>
        </motion.div>
      )}

          <div className="grid grid-cols-1 gap-8">
        {filteredInstructions.map((instruction) => (
            <motion.div 
              key={instruction.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "power-card p-10 relative overflow-hidden group bg-white",
                isExpired(instruction.dueDate, instruction.id!) && "border-power-red border-[4px] shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse"
              )}
            >
              <div className={cn(
                "absolute top-0 left-0 w-3 h-full",
                isExpired(instruction.dueDate, instruction.id!) ? "bg-power-red" : "bg-power-blue"
              )}></div>
              
              <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-power-blue/10 rounded-2xl border-2 border-power-blue/20">
                  {instruction.targetUid === 'team' ? <Users className="w-8 h-8 text-power-blue" /> : <User className="w-8 h-8 text-power-blue" />}
                </div>
                <div>
                  <h3 className="text-3xl font-black italic uppercase tracking-tight text-power-border">{instruction.title}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-3 py-1 bg-power-border text-white text-[10px] font-black uppercase tracking-widest rounded-lg">
                      {instruction.targetUid === 'team' ? '全隊廣播' : '個人指示'}
                    </span>
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                      建立: {instruction.createdAt?.toDate ? format(instruction.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : '剛剛'}
                    </span>
                    {instruction.dueDate && (
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                        isExpired(instruction.dueDate, instruction.id!) ? "text-power-red" : "text-power-blue"
                      )}>
                        <Calendar className="w-3 h-3" />
                        截止: {instruction.dueDate}
                        {isExpired(instruction.dueDate, instruction.id!) && " (已逾期)"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {profile?.role === 'coach' && (
                  <div className="flex flex-col items-end">
                    {instruction.targetUid === 'team' || instruction.targetUid === 'custom' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black italic text-power-blue">{getCompletionStats(instruction).percent}%</span>
                          <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">完成度</span>
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {getCompletionStats(instruction).count} / {getCompletionStats(instruction).total} 人已完成
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        {completions.some(c => c.instructionId === instruction.id) ? (
                          <div className="flex items-center gap-2 text-power-green bg-power-green/10 px-4 py-2 rounded-full border-2 border-power-green/20 shadow-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase italic tracking-widest">已完成</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-power-red bg-power-red/10 px-4 py-2 rounded-full border-2 border-power-red/20 shadow-sm">
                            <X className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase italic tracking-widest">未完成</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
            {profile?.role === 'player' && !playerCompletionIds.includes(instruction.id!) && (
              <div className="flex items-center gap-2 text-power-red bg-power-red/10 px-4 py-2 rounded-full border-2 border-power-red/20 shadow-sm">
                <Bell className="w-5 h-5 animate-bounce" />
                <span className="text-xs font-black uppercase italic tracking-widest">NEW!</span>
              </div>
            )}
            {profile?.role === 'player' && playerCompletionIds.includes(instruction.id!) && (
              <div className="flex items-center gap-2 text-power-green bg-power-green/10 px-4 py-2 rounded-full border-2 border-power-green/20 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-xs font-black uppercase italic tracking-widest">已完成</span>
              </div>
            )}
          </div>
        </div>

        <div className={cn(
          "bg-power-cream p-8 rounded-[2rem] border-[3px] border-power-border shadow-inner transition-colors",
          isExpired(instruction.dueDate, instruction.id!) && "bg-power-red/5"
        )}>
          <p className="text-power-border text-lg font-black italic leading-relaxed whitespace-pre-wrap">{instruction.content}</p>
        </div>

        {profile?.role === 'player' && !playerCompletionIds.includes(instruction.id!) && (
          <div className="mt-8 pt-8 border-t-2 border-power-border/5 flex justify-end">
            <button 
              onClick={() => setReportingInstruction(instruction)}
              className="power-button bg-power-green text-white px-8 py-3 text-lg flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5" />
              回報進度 REPORT
            </button>
          </div>
        )}

            {profile?.role === 'coach' && (
              <div className="mt-8 pt-8 border-t-2 border-power-border/5 flex justify-end">
                <button 
                  onClick={() => setViewingInstruction(instruction)}
                  className="power-button bg-power-yellow text-power-border px-8 py-3 text-lg flex items-center gap-3"
                >
                  <ClipboardList className="w-5 h-5" />
                  查看球員回饋 VIEW
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Report Progress Modal */}
      {reportingInstruction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border-[6px] border-power-border rounded-[3rem] max-w-lg w-full p-10 relative shadow-[12px_12px_0_0_rgba(0,0,0,0.2)]"
          >
            <button 
              onClick={() => setReportingInstruction(null)}
              className="absolute top-6 right-6 p-2 bg-power-cream border-2 border-power-border rounded-full hover:bg-power-yellow transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="mb-10">
              <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-2 text-power-border">回報訓練進度</h3>
              <p className="text-gray-500 text-sm font-black uppercase tracking-widest">針對指令：<span className="text-power-blue">{reportingInstruction.title}</span></p>
            </div>

            <form onSubmit={handleReportProgress} className="space-y-8">
              <div className="space-y-3">
                <label className="text-sm font-black uppercase text-gray-500 tracking-widest">訓練類型 TYPE</label>
                <div className="power-input w-full p-3 font-black italic bg-power-cream opacity-70">
                  {reportingInstruction.title}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-black uppercase text-gray-500 tracking-widest">執行日期 EXECUTION DATE</label>
                <input 
                  type="date"
                  required
                  className="power-input w-full p-4 font-black italic bg-white"
                  value={reportData.executionDate}
                  onChange={(e) => setReportData({ ...reportData, executionDate: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-black uppercase text-gray-500 tracking-widest">執行說明 DESCRIPTION</label>
                <textarea 
                  className="power-input w-full p-5 h-40 font-black italic resize-none"
                  placeholder="描述您的訓練狀況..."
                  value={reportData.description}
                  onChange={(e) => setReportData({...reportData, description: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full power-button bg-power-blue text-white py-5 text-2xl flex items-center justify-center gap-3">
                <ClipboardList className="w-7 h-7" />
                提交並連動紀錄 SUBMIT
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* View Feedbacks Modal */}
      {viewingInstruction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border-[6px] border-power-border rounded-[3rem] max-w-2xl w-full p-10 relative max-h-[85vh] flex flex-col shadow-[12px_12px_0_0_rgba(0,0,0,0.2)]"
          >
            <button 
              onClick={() => setViewingInstruction(null)}
              className="absolute top-6 right-6 p-2 bg-power-cream border-2 border-power-border rounded-full hover:bg-power-yellow transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="mb-10">
              <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-2 text-power-border">球員回饋狀況</h3>
              <p className="text-gray-500 text-sm font-black uppercase tracking-widest">針對指令：<span className="text-power-blue">{viewingInstruction.title}</span></p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar bg-power-cream rounded-[2rem] p-6 border-[3px] border-power-border shadow-inner">
              {feedbacks.length === 0 ? (
                <div className="text-center py-20 opacity-30">
                  <ClipboardList className="w-20 h-20 text-gray-400 mx-auto mb-6" />
                  <p className="text-2xl font-black uppercase italic tracking-widest">尚無球員回饋</p>
                </div>
              ) : (
                feedbacks.map((fb) => {
                  const player = players.find(p => p.uid === fb.playerUid);
                  return (
                    <div key={fb.id} className="bg-white border-[3px] border-power-border rounded-2xl p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.05)]">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-power-blue text-white rounded-xl flex items-center justify-center text-xl font-black italic border-2 border-power-border shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]">
                            {player?.playerNumber || '?'}
                          </div>
                          <div>
                            <p className="font-black italic uppercase text-lg text-power-border">{player?.displayName || '未知球員'}</p>
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                              {fb.date?.toDate ? format(fb.date.toDate(), 'yyyy/MM/dd HH:mm') : '剛剛'}
                            </p>
                          </div>
                        </div>
                        <div className="px-4 py-1.5 bg-power-green text-white rounded-lg border-2 border-power-border shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]">
                          <span className="text-[10px] font-black uppercase italic tracking-widest">{fb.type}</span>
                        </div>
                      </div>
                      <p className="text-power-border text-lg font-black italic leading-relaxed bg-power-cream/50 p-4 rounded-xl border-2 border-power-border/5">{fb.description}</p>
                      <div className="mt-4 pt-4 border-t-2 border-power-border/5 flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">訓練時長 DURATION:</span>
                        <span className="text-lg font-black italic text-power-blue">{fb.duration} 分鐘</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
