import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { supabase } from '../lib/supabase';
import { 
  Home,
  Library as LibraryIcon, 
  BarChart2, 
  MessageSquare, 
  Sparkles, 
  Type, 
  Bookmark,
  Quote,
  Compass,
  Calendar,
  LogOut,
  Menu,
  X,
  User,
  Heart,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Clock,
  Bell,
  MoreVertical
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { NotificationToast, ToastContainer } from '../components/NotificationToast';

export default function UserLayout() {
  const { profile, user, isAdmin, logout } = useAuth();
  const { reminders, notifications, activeToasts, unreadCount, markAsRead, markAllAsRead, removeToast } = useNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Derived display name and username for robustness
  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Pembaca';
  const username = profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'pembaca';

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [monthlyProgress, setMonthlyProgress] = useState({ completed: 0, goal: 5 });
  const [dailyProgress, setDailyProgress] = useState({ pages: 0, goal: 20 });
  const [isEditingMonthly, setIsEditingMonthly] = useState(false);
  const [isEditingDaily, setIsEditingDaily] = useState(false);
  const [newMonthlyGoal, setNewMonthlyGoal] = useState(5);
  const [newDailyGoal, setNewDailyGoal] = useState(20);

  const fetchProgress = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch Completed Books for Monthly (only those updated in the current month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: booksData } = await supabase
        .from('books')
        .select('id, status, updated_at')
        .eq('owner_id', user.id)
        .gte('updated_at', startOfMonth.toISOString());
      
      const completedCount = booksData?.filter(b => b.status === 'Selesai' || b.status === 'Completed').length || 0;
      setMonthlyProgress(prev => ({ ...prev, completed: completedCount }));

      // Fetch Today's Reading Logs for Daily
      const today = new Date().toISOString().split('T')[0];
      const { data: logData } = await supabase
        .from('reading_logs')
        .select('pages_read')
        .eq('user_id', user.id)
        .eq('reading_date', today)
        .maybeSingle(); // Use maybeSingle to avoid errors when no logs exist
      
      setDailyProgress(prev => ({ ...prev, pages: logData?.pages_read || 0 }));
    } catch (err) {
      console.error("Error fetching progress:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (profile) {
      if (profile.monthly_target) {
        setMonthlyProgress(prev => ({ ...prev, goal: profile.monthly_target }));
        setNewMonthlyGoal(profile.monthly_target);
      }
      if (profile.daily_target) {
        setDailyProgress(prev => ({ ...prev, goal: profile.daily_target }));
        setNewDailyGoal(profile.daily_target);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    fetchProgress();

    // Subscribe to real-time changes
    const booksChannel = supabase
      .channel(`books_progress_${profile.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'books',
        filter: `owner_id=eq.${profile.id}`
      }, fetchProgress)
      .subscribe();

    const logsChannel = supabase
      .channel(`logs_progress_${profile.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reading_logs',
        filter: `user_id=eq.${profile.id}`
      }, fetchProgress)
      .subscribe();
    
    const profileChannel = supabase
      .channel(`profile_sync_layout_${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${profile.id}`
      }, (payload) => {
        if (payload.new.monthly_target) {
          setMonthlyProgress(prev => ({ ...prev, goal: payload.new.monthly_target }));
          setNewMonthlyGoal(payload.new.monthly_target);
        }
        if (payload.new.daily_target) {
          setDailyProgress(prev => ({ ...prev, goal: payload.new.daily_target }));
          setNewDailyGoal(payload.new.daily_target);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(booksChannel);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [profile?.id, fetchProgress]);

  const handleUpdateMonthlyGoal = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ monthly_target: newMonthlyGoal })
        .eq('id', user.id);
      
      if (error) throw error;
      setMonthlyProgress(prev => ({ ...prev, goal: newMonthlyGoal }));
      setIsEditingMonthly(false);
    } catch (err) {
      console.error("Error updating monthly goal:", err);
    }
  };

  const handleUpdateDailyGoal = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ daily_target: newDailyGoal })
        .eq('id', user.id);
      
      if (error) throw error;
      setDailyProgress(prev => ({ ...prev, goal: newDailyGoal }));
      setIsEditingDaily(false);
    } catch (err) {
      console.error("Error updating daily goal:", err);
    }
  };

  const monthlyPercent = Math.min(100, Math.round((monthlyProgress.completed / (monthlyProgress.goal || 1)) * 100));
  const dailyPercent = Math.min(100, Math.round((dailyProgress.pages / (dailyProgress.goal || 1)) * 100));

  const motivationalDaily = useMemo(() => {
    const diff = dailyProgress.goal - dailyProgress.pages;
    if (diff <= 0) return "Target harian tercapai! 🎉";
    if (dailyPercent > 80) return "Sikit lagi! Tinggal " + diff + " hal lagi 🔥";
    if (dailyPercent > 50) return "Mantap! Kamu konsisten hari ini 💪";
    if (dailyPercent > 0) return "Terus baca, kamu pasti bisa! ✨";
    return "Mulai baca hari ini yuk! 📖";
  }, [dailyProgress.pages, dailyProgress.goal, dailyPercent]);

  const motivationalMonthly = useMemo(() => {
    const diff = monthlyProgress.goal - monthlyProgress.completed;
    if (diff <= 0) return "Misi bulan ini tuntas! 🏆";
    if (monthlyPercent > 80) return "Satu buku lagi lho! 📚";
    return diff + " buku lagi ke target! 🚀";
  }, [monthlyProgress.completed, monthlyProgress.goal, monthlyPercent]);

  const userLinks = useMemo(() => {
    const links = [
      { to: '/app/user/dashboard', icon: Home, label: 'Dashboard' },
      { to: '/app/user/library', icon: LibraryIcon, label: 'Perpustakaan' },
      { to: '/app/user/tracker', icon: BarChart2, label: 'Lacak & Target' },
      { to: '/app/user/calendar', icon: Calendar, label: 'Kalender' },
      { to: '/app/user/quotes', icon: Quote, label: 'Quotes & Review' },
      { to: '/app/user/bookmarks', icon: Bookmark, label: 'Buku Favorit' },
      { to: '/app/user/testimonial', icon: Heart, label: 'Testimoni' },
      { to: '/app/user/reports', icon: ShieldAlert, label: 'Laporkan Masalah' },
    ];

    if (isAdmin) {
      links.push({ to: '/app/admin/dashboard', icon: ShieldCheck, label: 'Admin Panel' });
    }
    return links;
  }, [isAdmin]);

  return (
    <div className="flex h-screen bg-[#faf9f6] overflow-hidden font-sans transition-colors duration-300 relative">
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-tan-50 flex items-center justify-around px-4 z-[100] pb-safe">
        {userLinks.slice(0, 5).map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link 
              key={link.to} 
              to={link.to} 
              className={`flex flex-col items-center justify-center gap-1 transition-all ${isActive ? 'text-primary' : 'text-slate-400'}`}
            >
              <link.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] font-black uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {link.label.split(' ')[0]}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="bottomNavDot"
                  className="w-1 h-1 bg-primary rounded-full absolute bottom-1"
                />
              )}
            </Link>
          );
        })}
        <button 
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center justify-center gap-1 text-slate-400"
        >
          <Menu size={20} />
          <span className="text-[10px] font-black uppercase tracking-tighter opacity-60">Menu</span>
        </button>
      </nav>

      {/* Sidebar - Desktop & Tablet */}
      <AnimatePresence>
        {(isSidebarOpen || !window.matchMedia('(max-width: 768px)').matches) && (
          <motion.aside 
            initial={window.innerWidth < 768 ? { x: -280 } : false}
            animate={{ x: 0, width: isSidebarOpen ? 280 : 80 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`bg-white border-r border-tan-50 flex flex-col z-[110] shadow-[20px_0_40px_rgba(0,0,0,0.01)] fixed md:relative h-full`}
          >
            {/* Mobile Sidebar Close Button */}
            <button 
              onClick={() => setSidebarOpen(false)}
              className="md:hidden absolute top-6 right-6 p-2 bg-tan-50 rounded-xl text-slate-400"
            >
              <X size={20} />
            </button>

            <div className="p-6 md:p-8 flex items-center justify-between">
              <Link to="/app/user/dashboard" className="flex items-center gap-3 overflow-hidden min-w-[200px]">
                <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-white shrink-0 font-bold text-xl shadow-lg shadow-primary/20">
                  <Compass size={24} />
                </div>
                <AnimatePresence>
                  {isSidebarOpen && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex flex-col"
                    >
                      <span className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">LuminaRead</span>
                      <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mt-1">Pusat Pembaca</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-hide">
              <nav className="space-y-1.5">
                {userLinks.map((link) => (
                  <UserSidebarLink 
                    key={link.to} 
                    {...link} 
                    active={location.pathname === link.to} 
                    collapsed={!isSidebarOpen}
                    onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}
                  />
                ))}
              </nav>

              {isSidebarOpen && (
                <div className="space-y-4 px-4 overflow-hidden">
                  {/* Monthly Goal Card */}
                  <div className="p-5 rounded-3xl bg-tan-50/50 border border-tan-50 relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Target Bulanan</p>
                        <span className="text-[10px] font-black text-primary/40 bg-white px-2 py-0.5 rounded-full">{monthlyPercent}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditingMonthly ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              value={newMonthlyGoal} 
                              onChange={(e) => setNewMonthlyGoal(parseInt(e.target.value) || 1)}
                              className="w-12 bg-white border border-tan-100 rounded-lg text-sm font-bold px-1 outline-none focus:ring-1 focus:ring-primary"
                              autoFocus
                              onBlur={handleUpdateMonthlyGoal}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateMonthlyGoal()}
                            />
                            <span className="text-sm font-extrabold text-slate-900">Buku</span>
                          </div>
                        ) : (
                          <p 
                            className="text-lg font-extrabold text-slate-900 cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
                            onClick={() => setIsEditingMonthly(true)}
                            title="Klik untuk ubah target"
                          >
                            {monthlyProgress.completed} / {monthlyProgress.goal} Buku
                          </p>
                        )}
                      </div>
                      <div className="mt-3 w-full h-1.5 bg-white rounded-full overflow-hidden">
                        <motion.div 
                          layout
                          initial={{ width: 0 }}
                          animate={{ width: `${monthlyPercent}%` }}
                          transition={{ type: 'spring', stiffness: 50 }}
                          className="h-full bg-primary rounded-full shadow-sm"
                        />
                      </div>
                    </div>
                    <Sparkles className="absolute -right-2 -bottom-2 text-primary/5 group-hover:scale-125 transition-transform" size={60} />
                  </div>

                  {/* Daily Goal Card */}
                  <div className="p-5 rounded-3xl bg-slate-900 relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Target Harian</p>
                        <span className="text-[10px] font-black text-white/20 bg-white/5 px-2 py-0.5 rounded-full">{dailyPercent}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditingDaily ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              value={newDailyGoal} 
                              onChange={(e) => setNewDailyGoal(parseInt(e.target.value) || 1)}
                              className="w-12 bg-white/10 border border-white/20 rounded-lg text-sm font-bold px-1 outline-none focus:ring-1 focus:ring-white text-white"
                              autoFocus
                              onBlur={handleUpdateDailyGoal}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateDailyGoal()}
                            />
                            <span className="text-sm font-extrabold text-white">Hal</span>
                          </div>
                        ) : (
                          <p 
                            className="text-lg font-extrabold text-white cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
                            onClick={() => setIsEditingDaily(true)}
                            title="Klik untuk ubah target"
                          >
                            {dailyProgress.pages} / {dailyProgress.goal} Hal
                          </p>
                        )}
                      </div>
                      <div className="mt-3 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          layout
                          initial={{ width: 0 }}
                          animate={{ width: `${dailyPercent}%` }}
                          transition={{ type: 'spring', stiffness: 50 }}
                          className="h-full bg-white rounded-full shadow-sm"
                        />
                      </div>
                    </div>
                    <Clock className="absolute -right-2 -bottom-2 text-white/5 group-hover:rotate-12 transition-transform" size={60} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 mt-auto">
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
                className={`w-full flex items-center gap-3 p-5 md:p-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-sm cursor-pointer relative z-50 ${!isSidebarOpen && 'justify-center p-3'}`}
              >
                <LogOut size={22} className="shrink-0" />
                {isSidebarOpen && <span className="whitespace-nowrap">Keluar</span>}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Overlay for Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && window.innerWidth < 768 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[105] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-white relative pb-20 md:pb-0">
        <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-10 bg-white/80 backdrop-blur-xl border-b border-tan-50 sticky top-0 z-20 transition-all duration-300">
          <div className="flex items-center gap-2 md:gap-8">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)} 
              className="p-2 md:p-2.5 rounded-xl hover:bg-tan-50 text-primary transition-colors hidden md:block"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="md:hidden w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Compass size={20} />
            </div>
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-tan-50 rounded-full border border-primary/10">
               <Sparkles size={14} className="text-primary" />
               <span className="text-[10px] font-black uppercase tracking-widest text-primary">Pembaca Premium</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`relative p-2.5 rounded-xl transition-all group ${isNotifOpen ? 'bg-primary/10 text-primary' : 'bg-tan-50 text-slate-500 hover:text-primary hover:bg-primary/5'}`}
              >
                <Bell size={20} className={isNotifOpen ? '' : 'group-hover:rotate-12 transition-transform'} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce-short">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-80 bg-white border border-tan-50 rounded-[32px] shadow-2xl shadow-slate-200 py-2 z-50 overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-tan-50 flex items-center justify-between bg-tan-50/20">
                       <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Notifikasi</h4>
                       {unreadCount > 0 && (
                         <button 
                           onClick={markAllAsRead}
                           className="text-[9px] font-black text-slate-400 hover:text-primary uppercase tracking-wider transition-colors"
                         >
                           Tandai Semua Sudah Baca
                         </button>
                       )}
                    </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-12 px-6 text-center">
                    <Bell size={32} className="mx-auto text-tan-100 mb-3" />
                    <p className="text-xs font-bold text-slate-400">Belum ada notifikasi baru.</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={`px-6 py-4 border-b border-tan-50/50 hover:bg-tan-50/30 transition-colors cursor-pointer group ${!notif.is_read ? 'bg-primary/[0.02]' : ''}`}
                      onClick={() => {
                        markAsRead(notif.id);
                        setIsNotifOpen(false);
                      }}
                    >
                      <div className="flex gap-4">
                        <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${
                          notif.type === 'reminder' ? 'bg-amber-50 text-amber-500' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {notif.type === 'reminder' ? <Calendar size={18} /> :
                           <Bell size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 group-hover:text-primary transition-colors">{notif.title}</p>
                          <p className="text-[11px] font-medium text-slate-500 leading-relaxed mt-0.5 line-clamp-2">{notif.content}</p>
                          <p className="text-[9px] font-bold text-slate-300 mt-2 uppercase tracking-wide">
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <div className="shrink-0 w-2 h-2 bg-primary rounded-full mt-1.5 shadow-sm shadow-primary/40"></div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Link 
        to="/" 
        className="flex items-center gap-2 px-5 py-2.5 bg-tan-50 hover:bg-primary hover:text-white text-primary rounded-2xl transition-all font-bold text-xs uppercase tracking-widest shadow-sm shadow-primary/5"
      >
        <Globe size={16} />
        <span className="hidden sm:inline">Halaman Utama</span>
      </Link>
      <div className="relative" ref={dropdownRef}>
        <div 
          onClick={() => setProfileMenuOpen(!isProfileMenuOpen)}
          className="flex items-center gap-4 transition-all group outline-none cursor-pointer"
        >
          <div className="w-12 h-12 rounded-[20px] bg-tan-50 border border-primary/10 flex items-center justify-center text-primary font-black text-lg overflow-hidden group-hover:shadow-lg group-hover:shadow-primary/10 transition-all">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-tan-50 text-primary">
                <User size={24} className="text-primary/40" />
              </div>
            )}
          </div>
        </div>
              
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation(); // Prevent Link from triggering
                  setProfileMenuOpen(!isProfileMenuOpen);
                }}
                className="absolute -bottom-2 -right-2 w-8 h-8 md:w-5 md:h-5 bg-white border border-tan-50 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-all shadow-md z-10"
              >
                <MoreVertical size={16} className="md:w-3 md:h-3" />
              </button>

              <AnimatePresence>
                {isProfileMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-64 bg-white border border-tan-50 rounded-[32px] shadow-2xl shadow-slate-200 py-4 z-50 overflow-hidden"
                  >
                    <div className="px-6 py-5 border-b border-tan-50 mb-2 bg-tan-50/30">
                       <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Akun Saya</p>
                       <p className="text-base font-extrabold text-slate-900 truncate">{displayName}</p>
                       <p className="text-[11px] font-bold text-slate-400 truncate mt-1">@{username}</p>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate('/app/user/profile');
                      }} 
                      className="flex items-center gap-3 px-6 py-3.5 text-slate-500 hover:bg-tan-50 hover:text-primary transition-colors text-sm font-bold w-full text-left"
                    >
                      <User size={18} /> Edit Profil
                    </button>
                    <Link to="/app/user/tracker" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-3 px-6 py-3.5 text-slate-500 hover:bg-tan-50 hover:text-primary transition-colors text-sm font-bold">
                      <BarChart2 size={18} /> Progres Membaca
                    </Link>
                    
                    <div className="h-px bg-tan-50 my-2 mx-6"></div>
                    
                    <button 
                      type="button"
                      onClick={handleLogout} 
                      className="w-full flex items-center gap-3 px-6 py-3.5 text-red-500 hover:bg-red-50 transition-colors text-sm font-bold cursor-pointer"
                    >
                      <LogOut size={18} /> Keluar
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full overflow-x-hidden box-border">
          <Outlet />
        </div>

        {/* Global Notification Toast Container */}
        <ToastContainer>
          <AnimatePresence>
            {activeToasts.map((toast) => (
              <NotificationToast 
                key={toast.id} 
                {...toast} 
                onClose={removeToast} 
              />
            ))}
          </AnimatePresence>
        </ToastContainer>
      </main>
    </div>
  );
}

function UserSidebarLink({ to, icon: Icon, label, active, collapsed, onClick }: any) {
  const { reminders } = useNotifications();
  return (
    <Link 
      to={to} 
      onClick={onClick}
      className={`
        relative flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group z-10 isolate
        ${active 
          ? 'bg-tan-50 text-primary shadow-sm font-extrabold' 
          : 'text-slate-400 hover:bg-tan-50/50 hover:text-primary font-bold'}
        ${collapsed && 'justify-center'}
      `}
    >
      <Icon size={22} className={`shrink-0 ${active && 'text-primary'}`} strokeWidth={active ? 2.5 : 2} />
      {!collapsed && <span className="text-[15px] tracking-tight">{label}</span>}
      {!collapsed && (label === 'Kalender' || label === 'Pengingat') && reminders.length > 0 && (
        <span className="w-2 h-2 bg-red-500 rounded-full ml-auto animate-pulse"></span>
      )}
      {collapsed && (
        <div className="absolute left-full ml-5 px-3 py-2 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all scale-95 group-hover:scale-100 whitespace-nowrap z-50 font-bold shadow-xl border">
          {label}
        </div>
      )}
      {active && !collapsed && (
        <motion.div 
          layoutId="activePill"
          className="absolute left-0 w-1 h-6 bg-primary rounded-full"
        />
      )}
    </Link>
  );
}
