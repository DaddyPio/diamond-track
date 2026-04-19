import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  UserCircle, 
  ClipboardList, 
  MessageSquare, 
  Trophy, 
  LogOut,
  Menu,
  X,
  Circle as Baseball,
  Settings,
  Target,
  CheckCircle2,
  Settings2,
  Save,
  CalendarDays,
  Users,
  BookOpen
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { signInWithGoogle, logout, db, auth } from './firebase';
import { cn } from './lib/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { subscribeToTeamDocument } from './data/team';

// Components
import Dashboard from './components/Dashboard';
import PlayerProfile from './components/PlayerProfile';
import TrainingLogs from './components/TrainingLogs';
import Instructions from './components/Instructions';
import TeamRoster from './components/TeamRoster';
import PlayerManagement from './components/PlayerManagement';
import RatingStandards from './components/RatingStandards';
import Onboarding from './components/Onboarding';
import PerformanceEntry from './components/PerformanceEntry';
import Attendance from './components/Attendance';
import TrainingHistory from './components/TrainingHistory';
import DailyLogs from './components/DailyLogs';
import PerformanceHistory from './components/PerformanceHistory';

const sopManualHref = `${import.meta.env.BASE_URL}sop.html`;

export default function App() {
  const { user, profile, loading, quotaExceeded } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [teamData, setTeamData] = useState({ name: '', logoURL: '' });
  const [coachName, setCoachName] = useState('');
  const [loginError, setLoginError] = useState('');

  React.useEffect(() => {
    if (profile?.teamId) {
      const unsub = subscribeToTeamDocument(profile.teamId, (docSnap) => {
        if (docSnap.exists()) {
          setTeamData({
            name: docSnap.data().name || '',
            logoURL: docSnap.data().logoURL || ''
          });
        }
      });
      return () => unsub();
    }
  }, [profile?.teamId]);

  React.useEffect(() => {
    if (profile) {
      setCoachName(profile.displayName || '');
    }
  }, [profile]);

  const handleSaveSettings = async () => {
    if (!profile?.teamId || !profile?.uid) return;
    try {
      await updateDoc(doc(db, 'teams', profile.teamId), {
        name: teamData.name,
        logoURL: teamData.logoURL
      });
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: coachName
      });
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTeamData({ ...teamData, logoURL: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-power-cream flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Baseball className="w-16 h-16 text-power-blue" />
        </motion.div>
      </div>
    );
  }

  const isWebView = () => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return (
      ua.includes('fban') ||
      ua.includes('fbav') ||
      ua.includes('line/') ||
      ua.includes('instagram') ||
      ua.includes('micromessenger')
    );
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    try {
      await signInWithGoogle({ preferRedirect: isWebView() });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google 登入失敗，請稍後再試。';
      setLoginError(message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-power-blue text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-power-yellow/20 rounded-full blur-3xl"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-8 max-w-md w-full relative z-10"
        >
          <div className="flex justify-center">
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative"
            >
              <div className="w-48 h-48 bg-white/10 rounded-full flex items-center justify-center border-4 border-white/20 backdrop-blur-sm">
                <Baseball className="w-32 h-32 text-power-yellow drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]" />
              </div>
            </motion.div>
          </div>
          <div className="space-y-2">
            <h1 className="text-6xl font-black tracking-tighter uppercase italic drop-shadow-[4px_4px_0_rgba(0,0,0,0.5)]">
              Diamond <span className="text-power-yellow">Track</span>
            </h1>
            <p className="text-white/80 font-black text-xl italic uppercase tracking-widest">實況野球風格管理系統</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full py-5 bg-power-yellow text-power-border power-button text-2xl"
            >
              <div className="flex items-center justify-center gap-3">
                <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
                登入球隊
              </div>
            </button>

            {loginError && (
              <div className="bg-power-red/20 border-2 border-power-red p-4 rounded-2xl text-sm font-black">
                {loginError}
              </div>
            )}

            {isWebView() && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-power-red/20 border-2 border-power-red p-4 rounded-2xl text-sm font-black italic"
              >
                <p className="text-power-yellow mb-2">⚠️ 檢測到內置瀏覽器</p>
                <p className="text-white/90">
                  Google 不允許在 Line 或 Facebook 等 App 內直接登入。
                  請點擊右上角選單，選擇「在瀏覽器中開啟」以正常登入。
                </p>
              </motion.div>
            )}
          </div>
          
          <div className="pt-8 flex items-center justify-center gap-4 opacity-50">
            <div className="h-1 w-12 bg-white rounded-full"></div>
            <span className="text-sm uppercase tracking-[0.3em] font-black italic">Power Pros Edition</span>
            <div className="h-1 w-12 bg-white rounded-full"></div>
          </div>

          <a
            href={sopManualHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-white/40 bg-white/10 px-4 py-3 text-sm font-black italic text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <BookOpen className="h-5 w-5 shrink-0 text-power-yellow" />
            使用手冊（SOP）
          </a>
        </motion.div>
      </div>
    );
  }

  if (!profile || !profile.teamId) {
    return <Onboarding />;
  }

  // Handle pending player status
  if (profile.role === 'player' && profile.status === 'pending') {
    return (
      <div className="min-h-screen bg-power-cream flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="power-card p-12 bg-white max-w-lg w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="p-6 bg-power-yellow/20 rounded-full border-4 border-power-yellow animate-pulse">
              <ClipboardList className="w-16 h-16 text-power-yellow" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-power-border">等待核准中</h1>
            <p className="text-gray-500 font-black italic uppercase tracking-widest mt-2">WAITING FOR APPROVAL</p>
          </div>
          <div className="bg-power-cream p-6 rounded-2xl border-2 border-power-border/10">
            <p className="text-power-border font-bold text-lg leading-relaxed">
              您的加入申請已送出！<br />
              請等待教練核准後即可進入球隊系統。
            </p>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="power-button bg-power-red text-white px-8 py-3 w-full"
          >
            登出系統 SIGN OUT
          </button>
          <a
            href={sopManualHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 text-sm font-black italic text-power-blue hover:underline"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            使用手冊（SOP）
          </a>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: '儀表板', icon: LayoutDashboard },
    { id: 'roster', label: '球員總覽', icon: Trophy },
    { id: 'instructions', label: '教練指示', icon: MessageSquare },
    ...(profile?.role === 'player' ? [
      { id: 'logs', label: '訓練記錄', icon: ClipboardList },
      { id: 'performance-history', label: '比賽與測驗成績', icon: Trophy },
      { id: 'profile', label: '個人檔案', icon: UserCircle },
    ] : []),
    ...(profile?.role === 'coach' ? [
      { id: 'attendance', label: '出席點名', icon: CheckCircle2 },
      { id: 'daily-logs', label: '訓練日誌', icon: CalendarDays },
      { id: 'performance', label: '數據登錄', icon: Target },
      { id: 'player-management', label: '球員管理', icon: Users },
      { id: 'standards', label: '評分標準', icon: Settings }
    ] : []),
  ];

  const handleDashboardNavigate = (tab: string, date?: string) => {
    if (tab === 'daily-logs' && date) {
      setSelectedDate(date);
    }
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard setActiveTab={handleDashboardNavigate} />;
      case 'roster': return <TeamRoster />;
      case 'logs': return <TrainingLogs />;
      case 'instructions': return <Instructions />;
      case 'profile': return <PlayerProfile />;
      case 'performance': return <PerformanceEntry />;
      case 'attendance': return <Attendance />;
      case 'history': return <TrainingHistory />;
      case 'standards': return <RatingStandards />;
      case 'daily-logs': return <DailyLogs onBack={() => setActiveTab('dashboard')} initialDate={selectedDate} />;
      case 'performance-history': return <PerformanceHistory onBack={() => setActiveTab('dashboard')} />;
      case 'player-management': return <PlayerManagement />; 
      default: return <Dashboard setActiveTab={handleDashboardNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-power-cream text-power-border flex flex-col md:flex-row font-sans">
      {quotaExceeded && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-power-red text-white p-3 text-center font-black italic uppercase tracking-widest text-xs flex items-center justify-center gap-2">
          <span>⚠️ 已達資料庫今日讀取上限 (Quota Exceeded) - 部份功能載入受限</span>
        </div>
      )}
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 border-r-[4px] border-power-border bg-power-blue p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-10 w-32 h-32 bg-power-yellow rounded-full blur-2xl"></div>
        </div>

        <div 
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-3 mb-12 relative z-10 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="bg-white p-1 rounded-xl border-2 border-power-border shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] w-12 h-12 flex items-center justify-center overflow-hidden">
            {teamData.logoURL ? (
              <img src={teamData.logoURL} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Baseball className="w-8 h-8 text-power-blue" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tighter uppercase italic drop-shadow-[2px_2px_0_rgba(0,0,0,0.3)] leading-none">
              {teamData.name || 'Diamond Track'}
            </span>
            {teamData.name && (
              <span className="text-[10px] font-black uppercase tracking-widest text-power-yellow mt-1">Diamond Track System</span>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-3 relative z-10">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-black uppercase italic transition-all border-[3px] border-transparent",
                activeTab === item.id 
                  ? "bg-power-yellow text-power-border border-power-border shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] scale-105" 
                  : "text-white/80 hover:text-white hover:bg-white/10"
              )}
            >
              <item.icon className="w-6 h-6" />
              {item.label}
            </button>
          ))}
        </nav>

        <a
          href={sopManualHref}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-white/30 bg-white/10 px-4 py-3 text-sm font-black italic text-white transition-colors hover:bg-white/20"
        >
          <BookOpen className="h-5 w-5 shrink-0 text-power-yellow" />
          使用手冊 SOP
        </a>

        <div className="mt-auto pt-6 border-t-4 border-power-border/30 relative z-10">
          <div className="flex items-center gap-3 mb-6 px-2 bg-white/10 p-4 rounded-2xl border-2 border-white/20">
            <div className="relative">
              <img 
                src={profile?.photoURL || user.photoURL || ''} 
                className="w-12 h-12 rounded-full border-2 border-power-border shadow-md"
                alt="Profile"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-power-green rounded-full border-2 border-power-border"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-black italic truncate text-lg">{profile?.displayName || user.displayName}</p>
                {profile?.role === 'coach' && (
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    title="球隊設定"
                  >
                    <Settings2 className="w-4 h-4 text-power-yellow" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-power-yellow uppercase font-black tracking-widest">{profile?.role === 'coach' ? '監督 (COACH)' : '選手 (PLAYER)'}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-black uppercase italic text-white bg-power-red/80 hover:bg-power-red border-[3px] border-power-border shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all"
          >
            <LogOut className="w-5 h-5" />
            登出
          </button>
        </div>

        {/* Team Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white border-[6px] border-power-border rounded-[3rem] max-w-md w-full p-10 relative shadow-[12px_12px_0_0_rgba(0,0,0,0.2)]"
              >
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="absolute top-6 right-6 p-2 bg-power-cream border-2 border-power-border rounded-full hover:bg-power-yellow transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-power-border">球隊相關設定</h3>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase text-gray-700 tracking-widest">個人名稱 NAME</label>
                    <input 
                      type="text" 
                      className="power-input w-full p-3 font-black italic text-power-border bg-white border-2 border-power-border/20"
                      value={coachName}
                      onChange={(e) => setCoachName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase text-gray-700 tracking-widest">球隊名稱 TEAM NAME</label>
                    <input 
                      type="text" 
                      className="power-input w-full p-3 font-black italic text-power-border bg-white border-2 border-power-border/20"
                      value={teamData.name}
                      onChange={(e) => setTeamData({...teamData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase text-gray-700 tracking-widest">球隊 Logo</label>
                    <div className="flex flex-col gap-3">
                      <input 
                        type="text" 
                        className="power-input w-full p-3 font-black italic text-power-border bg-white border-2 border-power-border/20"
                        placeholder="圖片網址 URL..."
                        value={teamData.logoURL}
                        onChange={(e) => setTeamData({...teamData, logoURL: e.target.value})}
                      />
                      <div className="flex items-center gap-3">
                        <label className="flex-1 cursor-pointer bg-power-cream border-2 border-dashed border-power-border/30 rounded-xl p-3 text-center hover:bg-power-yellow/10 transition-colors">
                          <span className="text-xs font-black italic text-power-border/60">點擊上傳圖檔 UPLOAD FILE</span>
                          <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </label>
                      </div>
                    </div>
                    {teamData.logoURL && (
                      <div className="mt-2 flex justify-center">
                        <img src={teamData.logoURL} alt="Logo Preview" className="w-16 h-16 object-contain border-2 border-power-border rounded-xl p-1" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={handleSaveSettings}
                    className="w-full power-button bg-power-blue text-white py-4 text-xl flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" /> 儲存設定
                  </button>

                  <a
                    href={sopManualHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-power-border bg-power-cream py-3 text-sm font-black italic text-power-border transition-colors hover:bg-white"
                  >
                    <BookOpen className="h-5 w-5 shrink-0 text-power-blue" />
                    開啟使用手冊（SOP）
                  </a>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b-[4px] border-power-border bg-power-blue text-white sticky top-0 z-50">
        <div 
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="bg-white p-1 rounded-lg border-2 border-power-border w-10 h-10 flex items-center justify-center overflow-hidden">
            {teamData.logoURL ? (
              <img src={teamData.logoURL} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Baseball className="w-6 h-6 text-power-blue" />
            )}
          </div>
          <span className="font-black tracking-tighter uppercase italic text-xl">
            {teamData.name || 'Diamond Track'}
          </span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="bg-white/20 p-2 rounded-xl border-2 border-white/30">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed inset-0 z-40 md:hidden bg-power-blue pt-24 p-6 text-white"
          >
            <nav className="space-y-4">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-5 rounded-2xl font-black uppercase italic text-2xl border-[3px] transition-all",
                    activeTab === item.id 
                      ? "bg-power-yellow text-power-border border-power-border shadow-[6px_6px_0_0_rgba(0,0,0,0.3)]" 
                      : "text-white/80 border-transparent"
                  )}
                >
                  <item.icon className="w-8 h-8" />
                  {item.label}
                </button>
              ))}
              <a
                href={sopManualHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex w-full items-center gap-4 rounded-2xl border-[3px] border-white/30 bg-white/10 px-6 py-5 text-2xl font-black italic text-white transition-colors hover:bg-white/20"
              >
                <BookOpen className="h-8 w-8 shrink-0 text-power-yellow" />
                使用手冊 SOP
              </a>
              <button 
                onClick={logout}
                className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl font-black uppercase italic text-2xl text-white bg-power-red/80 border-[3px] border-power-border shadow-[6px_6px_0_0_rgba(0,0,0,0.3)]"
              >
                <LogOut className="w-8 h-8" />
                登出
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-10">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
