import React, { useEffect, useState } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { motion } from 'motion/react';
import { Save, UserCircle, Circle as Baseball, Shield, Zap, Heart, Trophy, Info, Activity } from 'lucide-react';
import { RatingStandard, RatingCategory } from '../types';

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

export default function PlayerProfile() {
  const { profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [standards, setStandards] = useState<RatingStandard>(DEFAULT_STANDARDS);
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    playerNumber: profile?.playerNumber || '',
    position: profile?.position || '',
    bio: profile?.bio || '',
    photoURL: profile?.photoURL || '',
    role: profile?.role || 'player',
    playerType: profile?.playerType || 'fielder',
    stats: profile?.stats || {
      batting: 60,
      pitching: 60,
      fielding: 60,
      speed: 60,
      stamina: 60,
    },
    testStats: profile?.testStats || {
      runningSpeed: 0,
      pitchingVelocity: 0,
      throwingDistance: 0
    }
  });

  useEffect(() => {
    if (!profile?.teamId) return;

    const unsub = onSnapshot(doc(db, 'teams', profile.teamId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.ratingStandards) {
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoURL: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), formData);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  const statIcons = {
    batting: Baseball,
    pitching: Zap,
    fielding: Shield,
    speed: Zap,
    stamina: Heart,
  };

  const statLabels = {
    batting: '打擊',
    pitching: '投球',
    fielding: '守備',
    speed: '速度',
    stamina: '體能',
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter text-power-border">個人檔案</h1>
          <p className="text-gray-500 font-black text-lg italic uppercase tracking-widest">管理您的個人資訊與能力數值</p>
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="power-button bg-power-blue text-white px-8 py-3 text-lg flex items-center gap-2"
        >
          {isEditing ? <Save className="w-5 h-5" /> : <UserCircle className="w-5 h-5" />}
          {isEditing ? '儲存變更' : '編輯檔案'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="power-card bg-white p-8 text-center">
            <div className="relative inline-block mb-6">
              <img 
                src={formData.photoURL || profile?.photoURL} 
                className="w-32 h-32 rounded-[32px] border-4 border-power-blue/20 object-cover shadow-lg"
                alt="Profile"
                referrerPolicy="no-referrer"
              />
              {isEditing ? (
                <label className="absolute -bottom-2 -right-2 bg-power-yellow text-power-border p-2 rounded-xl border-2 border-power-border cursor-pointer hover:scale-110 transition-transform">
                  <Baseball className="w-5 h-5" />
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </label>
              ) : (
                <div className="absolute -bottom-2 -right-2 bg-power-yellow text-power-border p-2 rounded-xl border-2 border-power-border">
                  <Baseball className="w-5 h-5" />
                </div>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">顯示名稱</label>
                  <input 
                    className="power-input w-full p-3 font-black italic"
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">背號</label>
                    <input 
                      className="power-input w-full p-3 font-black italic"
                      value={formData.playerNumber}
                      onChange={(e) => setFormData({...formData, playerNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">守備位置</label>
                    <input 
                      className="power-input w-full p-3 font-black italic"
                      value={formData.position}
                      onChange={(e) => setFormData({...formData, position: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-3xl font-black italic uppercase text-power-border">{profile?.displayName}</h2>
                  <span className="text-2xl text-power-blue font-black italic">#{profile?.playerNumber || '??'}</span>
                </div>
                <p className="text-power-blue font-black uppercase tracking-[0.2em] text-sm">{profile?.position || '未設定位置'}</p>
              </div>
            )}
          </div>

          <div className="power-card bg-white p-8">
            <h3 className="text-xs font-black uppercase text-gray-500 mb-4 border-b-2 border-power-cream pb-2 tracking-widest">個人簡介</h3>
            {isEditing ? (
              <textarea 
                className="power-input w-full p-4 h-32 font-black italic resize-none"
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
              />
            ) : (
              <p className="text-power-border text-lg font-black italic leading-relaxed">
                {profile?.bio || '尚未填寫簡介...'}
              </p>
            )}
          </div>
        </div>

        {/* Stats and Test Results */}
        <div className="lg:col-span-2 space-y-8">
          {profile?.role === 'player' && (
            <div className="power-card bg-white p-8">
              <h3 className="text-2xl font-black italic uppercase mb-8 flex items-center gap-3">
                <div className="bg-power-blue p-2 rounded-xl">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                能力值設定
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {Object.keys(formData.stats).map((key) => {
                  const Icon = statIcons[key as keyof typeof statIcons];
                  const label = statLabels[key as keyof typeof statLabels];
                  const value = formData.stats[key as keyof typeof formData.stats];
                  const canEditStats = profile?.role === 'coach';

                  return (
                    <div key={key} className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-power-cream rounded-lg border-2 border-power-border/5">
                            <Icon className="w-4 h-4 text-power-blue" />
                          </div>
                          <span className="font-black uppercase italic text-sm text-gray-600">{label}</span>
                        </div>
                        <span className="text-2xl font-black italic text-power-blue">{value}</span>
                      </div>
                      
                      {isEditing && canEditStats ? (
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          className="w-full accent-power-blue bg-power-cream h-2 rounded-full appearance-none cursor-pointer border-2 border-power-border/10"
                          value={value}
                          onChange={(e) => setFormData({
                            ...formData,
                            stats: {
                              ...formData.stats,
                              [key]: parseInt(e.target.value)
                            }
                          })}
                        />
                      ) : (
                        <div className="w-full h-3 bg-power-cream rounded-full overflow-hidden border-2 border-power-border/5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${value}%` }}
                            className="h-full bg-gradient-to-r from-power-blue/60 to-power-blue"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isEditing && (
                <div className="mt-12 p-8 bg-power-cream border-[3px] border-power-border rounded-[2rem] shadow-inner">
                  <div className="flex items-start gap-6">
                    <div className="p-4 bg-power-yellow rounded-2xl border-2 border-power-border shadow-md">
                      <Trophy className="w-8 h-8 text-power-border" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black italic uppercase text-gray-500 tracking-widest text-xs">綜合評分 OVERALL</h4>
                          <p className="text-6xl font-black italic tracking-tighter text-power-border">
                            {(() => {
                              const currentWeights = standards[formData.playerType as keyof RatingStandard]?.weights || standards.fielder.weights;
                              const score = Math.round(
                                (formData.stats.batting * (currentWeights.batting / 100)) +
                                (formData.stats.pitching * (currentWeights.pitching / 100)) +
                                (formData.stats.fielding * (currentWeights.fielding / 100)) +
                                (formData.stats.speed * (currentWeights.speed / 100)) +
                                (formData.stats.stamina * (currentWeights.stamina / 100))
                              );
                              return score;
                            })()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-7xl font-black italic text-power-blue drop-shadow-[2px_2px_0_rgba(0,0,0,0.1)]">
                            {(() => {
                              const currentWeights = standards[formData.playerType as keyof RatingStandard]?.weights || standards.fielder.weights;
                              const currentLevels = standards[formData.playerType as keyof RatingStandard]?.levels || standards.fielder.levels;
                              const score = (formData.stats.batting * (currentWeights.batting / 100)) +
                                (formData.stats.pitching * (currentWeights.pitching / 100)) +
                                (formData.stats.fielding * (currentWeights.fielding / 100)) +
                                (formData.stats.speed * (currentWeights.speed / 100)) +
                                (formData.stats.stamina * (currentWeights.stamina / 100));
                              
                              if (score >= currentLevels.S) return 'S';
                              if (score >= currentLevels.A) return 'A';
                              if (score >= currentLevels.B) return 'B';
                              if (score >= currentLevels.C) return 'C';
                              return 'D';
                            })()}
                          </span>
                          <p className="text-[10px] font-black uppercase text-gray-400 mt-1 tracking-widest">等級評定 GRADE</p>
                        </div>
                      </div>
                      
                      <div className="mt-6 pt-6 border-t-2 border-power-border/10 flex items-center gap-3 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                        <Info className="w-4 h-4 text-power-blue" />
                        權重 ({formData.playerType === 'fielder' ? '野手' : '可投球野手'})：打擊 {standards[formData.playerType as keyof RatingStandard]?.weights.batting}% / 投球 {standards[formData.playerType as keyof RatingStandard]?.weights.pitching}% / 守備 {standards[formData.playerType as keyof RatingStandard]?.weights.fielding}% / 速度 {standards[formData.playerType as keyof RatingStandard]?.weights.speed}% / 體能 {standards[formData.playerType as keyof RatingStandard]?.weights.stamina}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Test Results Display */}
          {profile?.role === 'player' && profile.testStats && (
            <div className="power-card bg-white p-8">
              <h3 className="text-2xl font-black italic uppercase mb-8 flex items-center gap-3">
                <div className="bg-power-green p-2 rounded-xl">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                測驗成績 TEST RESULTS
              </h3>
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-power-cream p-6 rounded-2xl border-2 border-power-border/5 text-center">
                  <p className="text-4xl font-black italic text-power-border">{profile.testStats.runningSpeed}</p>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-2">跑壘速度 (秒)</p>
                </div>
                <div className="bg-power-cream p-6 rounded-2xl border-2 border-power-border/5 text-center">
                  <p className="text-4xl font-black italic text-power-border">{profile.testStats.pitchingVelocity}</p>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-2">球速 (km/h)</p>
                </div>
                <div className="bg-power-cream p-6 rounded-2xl border-2 border-power-border/5 text-center">
                  <p className="text-4xl font-black italic text-power-border">{profile.testStats.throwingDistance}</p>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-2">投遠距離 (m)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
