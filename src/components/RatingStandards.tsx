import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { RatingStandard, RatingCategory } from '../types';
import { motion } from 'motion/react';
import { Save, Settings, Info, AlertTriangle } from 'lucide-react';

const DEFAULT_CATEGORY: RatingCategory = {
  weights: {
    batting: 20,
    pitching: 20,
    fielding: 20,
    speed: 20,
    stamina: 20,
  },
  levels: {
    S: 90,
    A: 80,
    B: 70,
    C: 60,
  }
};

const DEFAULT_STANDARDS: RatingStandard = {
  fielder: { ...DEFAULT_CATEGORY },
  twoWay: { ...DEFAULT_CATEGORY },
};

export default function RatingStandards() {
  const { profile } = useAuth();
  const [standards, setStandards] = useState<RatingStandard>(DEFAULT_STANDARDS);
  const [activeCategory, setActiveCategory] = useState<'fielder' | 'twoWay'>('fielder');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!profile?.teamId) return;

    const unsub = onSnapshot(doc(db, 'teams', profile.teamId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.ratingStandards) {
          // Migration check for old structure
          const fetched = data.ratingStandards;
          if (fetched.weights && !fetched.fielder) {
            setStandards({
              fielder: fetched,
              twoWay: fetched,
            });
          } else {
            setStandards(fetched as RatingStandard);
          }
        }
      }
    });
    return () => unsub();
  }, [profile]);

  const handleSave = async () => {
    if (profile?.role !== 'coach' || !profile.teamId) return;
    
    // Validate weights sum to 100 for both categories
    const fielderTotal = (Object.values(standards.fielder.weights) as number[]).reduce((acc, val) => acc + val, 0);
    const twoWayTotal = (Object.values(standards.twoWay.weights) as number[]).reduce((acc, val) => acc + val, 0);

    if (fielderTotal !== 100 || twoWayTotal !== 100) {
      setMessage({ 
        type: 'error', 
        text: `權重總和必須等於 100% (野手: ${fielderTotal}%, 可投球野手: ${twoWayTotal}%)` 
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'teams', profile.teamId), {
        ratingStandards: standards
      });
      setMessage({ type: 'success', text: '評分標準已更新' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving standards:", error);
      setMessage({ type: 'error', text: '儲存失敗，請稍後再試' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentCategory = standards[activeCategory];
  const totalWeight = (Object.values(currentCategory.weights) as number[]).reduce((acc, val) => acc + val, 0);

  const updateWeight = (key: string, value: number) => {
    setStandards({
      ...standards,
      [activeCategory]: {
        ...currentCategory,
        weights: { ...currentCategory.weights, [key]: value }
      }
    });
  };

  const updateLevel = (level: string, value: number) => {
    setStandards({
      ...standards,
      [activeCategory]: {
        ...currentCategory,
        levels: { ...currentCategory.levels, [level]: value }
      }
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-20 h-20 bg-white rounded-2xl border-[3px] border-power-border shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] flex items-center justify-center hidden md:flex"
          >
            <Settings className="w-10 h-10 text-power-blue" />
          </motion.div>
          <div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)] text-power-border">評分標準設定</h1>
            <p className="text-gray-500 font-black text-lg italic uppercase tracking-widest">調整各項能力的權重與等級門檻</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex bg-power-cream p-2 rounded-2xl border-[3px] border-power-border shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
            <button 
              onClick={() => setActiveCategory('fielder')}
              className={cn(
                "px-6 py-2 rounded-xl font-black italic transition-all",
                activeCategory === 'fielder' ? "bg-power-blue text-white shadow-lg" : "text-power-border hover:bg-power-blue/10"
              )}
            >
              野手
            </button>
            <button 
              onClick={() => setActiveCategory('twoWay')}
              className={cn(
                "px-6 py-2 rounded-xl font-black italic transition-all",
                activeCategory === 'twoWay' ? "bg-power-blue text-white shadow-lg" : "text-power-border hover:bg-power-blue/10"
              )}
            >
              可投球野手
            </button>
          </div>
          {profile?.role === 'coach' && (
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="power-button bg-power-blue text-white px-10 py-4 text-2xl flex items-center gap-3 disabled:opacity-50"
            >
              <Save className="w-7 h-7" />
              {isSaving ? '儲存中...' : '儲存設定 SAVE'}
            </button>
          )}
        </div>
      </header>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-6 rounded-2xl font-black italic uppercase tracking-widest border-[3px] flex items-center gap-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]",
            message.type === 'success' ? "bg-power-green/10 text-power-green border-power-green/30" : "bg-power-red/10 text-power-red border-power-red/30"
          )}
        >
          {message.type === 'success' ? <Info className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
          {message.text}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Weights Section */}
        <div className="power-card p-10 bg-white">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-4 bg-power-blue/10 rounded-2xl border-2 border-power-blue/20">
              <Settings className="w-8 h-8 text-power-blue" />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tight text-power-border">能力權重設定 WEIGHTS</h2>
          </div>

          <div className="space-y-10">
            {Object.entries(currentCategory.weights).map(([key, weight]) => (
              <div key={key} className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-black uppercase italic text-lg text-power-border tracking-widest">
                    {key === 'batting' ? '打擊 BATTING' : key === 'pitching' ? '投球 PITCHING' : key === 'fielding' ? '守備 FIELDING' : key === 'speed' ? '速度 SPEED' : '體能 STAMINA'}
                  </span>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number"
                      min="0"
                      max="100"
                      disabled={profile?.role !== 'coach'}
                      className="power-input w-20 p-2 text-center text-xl font-black italic text-power-blue"
                      value={weight}
                      onChange={(e) => updateWeight(key, parseInt(e.target.value) || 0)}
                    />
                    <span className="text-xl font-black italic text-power-blue">%</span>
                  </div>
                </div>
                <div className="relative h-4 bg-power-cream rounded-full border-2 border-power-border overflow-hidden shadow-inner">
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    disabled={profile?.role !== 'coach'}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                    value={weight}
                    onChange={(e) => updateWeight(key, parseInt(e.target.value) || 0)}
                  />
                  <motion.div 
                    className="h-full bg-power-blue"
                    initial={{ width: 0 }}
                    animate={{ width: `${weight}%` }}
                    transition={{ type: "spring", stiffness: 100 }}
                  />
                </div>
              </div>
            ))}

            <div className={cn(
              "mt-10 p-8 rounded-[2rem] border-[4px] flex justify-between items-center shadow-[6px_6px_0_0_rgba(0,0,0,0.1)]",
              totalWeight === 100 ? "bg-power-green/10 border-power-green text-power-green" : "bg-power-red/10 border-power-red text-power-red"
            )}>
              <span className="text-xl font-black uppercase italic tracking-widest">權重總和 TOTAL</span>
              <span className="text-4xl font-black italic">{totalWeight}%</span>
            </div>
          </div>
        </div>

        {/* Levels Section */}
        <div className="power-card p-10 bg-white">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-4 bg-power-yellow/10 rounded-2xl border-2 border-power-yellow/20">
              <Info className="w-8 h-8 text-power-yellow" />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tight text-power-border">等級門檻設定 LEVELS</h2>
          </div>

          <div className="space-y-10">
            {Object.entries(currentCategory.levels).map(([level, score]) => (
              <div key={level} className="flex items-center gap-8 bg-power-cream p-6 rounded-[2rem] border-[3px] border-power-border shadow-[4px_4px_0_0_rgba(0,0,0,0.05)]">
                <div className="w-20 h-20 bg-power-blue text-white rounded-[1.5rem] flex items-center justify-center text-5xl font-black italic border-[4px] border-power-border shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] shrink-0">
                  {level}
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-gray-500 tracking-widest">最低分數門檻 MIN SCORE</span>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        disabled={profile?.role !== 'coach'}
                        className="power-input w-20 p-2 text-center text-xl font-black italic text-power-border"
                        value={score}
                        onChange={(e) => updateLevel(level, parseInt(e.target.value) || 0)}
                      />
                      <span className="text-xl font-black italic text-power-border">分</span>
                    </div>
                  </div>
                  <div className="relative h-4 bg-white rounded-full border-2 border-power-border overflow-hidden shadow-inner">
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      disabled={profile?.role !== 'coach'}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                      value={score}
                      onChange={(e) => updateLevel(level, parseInt(e.target.value) || 0)}
                    />
                    <motion.div 
                      className="h-full bg-power-yellow"
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ type: "spring", stiffness: 100 }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
