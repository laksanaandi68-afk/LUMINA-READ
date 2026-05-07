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
  Globe,
  Clock,
  Bell,
  Users,
  MoreVertical
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function UserLayout() {
  const { profile, user, isAdmin } = useAuth();
  const { reminders, notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Derived display name and username for robustness
  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const username = profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'user';

  const handleLogout = async () => {
    try {
      // Clear all possible local session data first for immediate UI response
      localStorage.clear();
      sessionStorage.clear();
      
      // Perform Supabase sign out
      await supabase.auth.signOut();
      
      // Full redirect to landing to reset all React states/providers
      window.location.replace('/');
    } catch (err) {
      console.error("Logout error:", err);
      window.location.replace('/');
    }
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

  const [friendCount, setFriendCount] = useState(0);

  const fetchFriendCount = useCallback(async () => {
    if (!profile) return;
    try {
      const { count, error } = await supabase
        .from('friends')
        .select('id', { count: 'exact' })
        .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`)
        .eq('status', 'accepted');
      
      if (error) {
        console.error("Supabase count error:", error);
        return;
      }
      setFriendCount(count || 0);
    } catch (err) {
      console.error("Error fetching friend count:", err);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;

    fetchProgress();
    fetchFriendCount();

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

    // Listen to ALL friend changes for this user
    const friendsChannel = supabase
      .channel(`friends_sync_layout_${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friends'
      }, (payload) => {
        // Only refresh if the change affects current profile
        const target = (payload.new || payload.old) as any;
        if (target?.user_id === profile.id || target?.friend_id === profile.id) {
          fetchFriendCount();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(booksChannel);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(friendsChannel);
    };
  }, [profile?.id, fetchProgress, fetchFriendCount]);

  // Reminder Notification System
  useEffect(() => {
    if (!user) return;

    const checkReminders = async () => {
      try {
        const now = new Date();
        const { data: upcomingReminders, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_notified', false)
          .lte('scheduled_at', now.toISOString());

        if (error) throw error;

        if (upcomingReminders && upcomingReminders.length > 0) {
          for (const reminder of upcomingReminders) {
            // Trigger Notification
            Swal.fire({
              title: 'Pengingat Waktu! 🔔',
              text: reminder.title,
              icon: 'info',
              confirmButtonText: 'Oke, Saya Ingat!',
              confirmButtonColor: '#D2B48C',
              footer: reminder.description,
              toast: false,
              position: 'center'
            });

            // Mark as notified
            await supabase
              .from('reminders')
              .update({ is_notified: true, status: 'completed' })
              .eq('id', reminder.id);
          }
          // Refresh progress if needed
          fetchProgress();
        }
      } catch (err) {
        console.error("Reminder check error:", err);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkReminders, 30000);
    checkReminders(); // Initial check

    return () => clearInterval(interval);
  }, [user]);

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
      { to: '/app/user/friends', icon: Users, label: `Teman (${friendCount})` },
      { to: '/app/user/tracker', icon: BarChart2, label: 'Lacak & Target' },
      { to: '/app/user/calendar', icon: Calendar, label: 'Kalender' },
      { to: '/app/user/quotes', icon: Quote, label: 'Quotes & Review' },
      { to: '/app/user/bookmarks', icon: Bookmark, label: 'Buku Favorit' },
    ];

    if (isAdmin) {
      links.push({ to: '/app/admin/dashboard', icon: ShieldCheck, label: 'Admin Panel' });
      links.push({ to: '/app/admin/chat', icon: MessageSquare, label: 'Support Chat' });
    }
    return links;
  }, [isAdmin, friendCount]);

  return (
    <div className="flex h-screen bg-[#faf9f6] overflow-hidden font-sans transition-colors duration-300">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-white border-r border-tan-50 flex flex-col z-30 shadow-[20px_0_40px_rgba(0,0,0,0.01)]"
      >
        <div className="p-8 flex items-center justify-between">
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

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <nav className="space-y-1.5">
            {userLinks.map((link) => (
              <UserSidebarLink 
                key={link.to} 
                {...link} 
                active={location.pathname === link.to} 
                collapsed={!isSidebarOpen}
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
                  <p className="text-[9px] font-bold text-slate-400 mt-2 italic line-clamp-1">{motivationalMonthly}</p>
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
                  <p className="text-[9px] font-bold text-white/40 mt-2 italic line-clamp-1">{motivationalDaily}</p>
                </div>
                <Clock className="absolute -right-2 -bottom-2 text-white/5 group-hover:rotate-12 transition-transform" size={60} />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 mt-auto">
          <button 
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 p-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-sm cursor-pointer relative z-50 ${!isSidebarOpen && 'justify-center p-3'}`}
          >
            <LogOut size={20} className="shrink-0" />
            {isSidebarOpen && <span className="whitespace-nowrap">Keluar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-white relative">
        <header className="h-20 flex items-center justify-between px-10 bg-white/80 backdrop-blur-xl border-b border-tan-50 sticky top-0 z-20 transition-all duration-300">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)} 
              className="p-2.5 rounded-xl hover:bg-tan-50 text-primary transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
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
                              if (notif.type === 'friend_request') navigate('/app/user/friends');
                              if (notif.type === 'new_message') navigate(`/app/user/chat?with=${notif.data?.sender_id}`);
                              setIsNotifOpen(false);
                            }}
                          >
                            <div className="flex gap-4">
                              <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${
                                notif.type === 'friend_request' ? 'bg-indigo-50 text-indigo-500' :
                                notif.type === 'friend_accepted' ? 'bg-emerald-50 text-emerald-500' :
                                'bg-primary/10 text-primary'
                              }`}>
                                {notif.type === 'friend_request' ? <Users size={18} /> :
                                 notif.type === 'friend_accepted' ? <Heart size={18} /> :
                                 <MessageSquare size={18} />}
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
                    {notifications.length > 0 && (
                      <div className="p-4 text-center">
                        <Link 
                          to="/app/user/notifications" 
                          onClick={() => setIsNotifOpen(false)}
                          className="text-[10px] font-black text-slate-400 hover:text-primary uppercase tracking-widest transition-colors"
                        >
                          Lihat Riwayat Lengkap
                        </Link>
                      </div>
                    )}
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
              <Link 
                to={`/app/user/profile/${user?.id}`}
                className="flex items-center gap-4 transition-all group outline-none"
              >
                <div className="w-12 h-12 rounded-[20px] bg-tan-50 border border-primary/10 flex items-center justify-center text-primary font-black text-lg overflow-hidden group-hover:shadow-lg group-hover:shadow-primary/10 transition-all">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    displayName?.[0] || 'U'
                  )}
                </div>
              </Link>
              
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  setProfileMenuOpen(!isProfileMenuOpen);
                }}
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-white border border-tan-50 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-all shadow-sm z-10"
              >
                <MoreVertical size={12} />
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

        <div className="p-10 max-w-7xl mx-auto">
          <Outlet />
        </div>
        
        {/* Floating Chat Button */}
        {!isAdmin && (
          <Link 
            to="/app/user/chat"
            className="fixed bottom-10 right-10 w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all z-50 group"
          >
             <div className="absolute -top-12 right-0 bg-slate-900 text-white text-[10px] font-black py-2 px-4 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl border border-white/10 pointer-events-none">
                Bicara dengan Admin
             </div>
             <MessageSquare size={28} />
             <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></span>
          </Link>
        )}
      </main>
    </div>
  );
}

function UserSidebarLink({ to, icon: Icon, label, active, collapsed }: any) {
  const { reminders } = useNotifications();
  return (
    <Link 
      to={to} 
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
      {!collapsed && label === 'Pengingat' && reminders.length > 0 && (
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
