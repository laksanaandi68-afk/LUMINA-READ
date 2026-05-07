import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  BarChart3, 
  MessageSquare, 
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Search,
  Heart,
  ShieldAlert,
  MessageCircle,
  AlertCircle
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminLayout() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const adminLinks = [
    { to: '/app/admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { to: '/app/admin/reports', icon: ShieldAlert, label: 'Laporan User' },
    { to: '/app/admin/chats', icon: MessageCircle, label: 'Pantau Chat' },
    { to: '/app/admin/users', icon: Users, label: 'Users & Bans' },
    { to: '/app/admin/books', icon: BookOpen, label: 'Koleksi Buku' },
    { to: '/app/admin/analytics', icon: BarChart3, label: 'Statistik' },
  ];

  return (
    <div className="flex h-screen bg-[#f8f9fa] overflow-hidden font-sans">
      {/* Sidebar - Dark Professional Identity */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-[#0f1115] flex flex-col z-30 transition-all duration-300 shadow-2xl relative"
      >
        <div className="p-8 flex items-center justify-between relative z-10">
          <Link to="/app/admin/dashboard" className="flex items-center gap-3 overflow-hidden min-w-[200px]">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shrink-0 font-bold text-xl shadow-lg shadow-primary/20">
              <ShieldCheck size={24} />
            </div>
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex flex-col"
                >
                  <span className="font-extrabold text-lg tracking-tight text-white leading-none">Admin Panel</span>
                  <span className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1">LuminaRead OS</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 relative z-10 overflow-y-auto">
          <p className={`text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-4 ${!isSidebarOpen && 'text-center px-0'}`}>
            {isSidebarOpen ? 'Menu Utama' : '•••'}
          </p>
          {adminLinks.map((link) => (
            <AdminSidebarLink 
              key={link.to} 
              {...link} 
              active={location.pathname === link.to} 
              collapsed={!isSidebarOpen}
            />
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-white/5 relative z-50">
          <button 
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 p-3 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all cursor-pointer ${!isSidebarOpen && 'justify-center p-2'}`}
          >
            <LogOut size={20} className="shrink-0" />
            {isSidebarOpen && <span className="text-sm font-bold whitespace-nowrap">Keluar Admin</span>}
          </button>
        </div>

        {/* Decorative elements for admin feel */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#f8f9fa] relative">
        <header className="h-20 flex items-center justify-between px-10 bg-white/50 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)} 
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/30 transition-all shadow-sm"
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="relative w-96 hidden lg:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari data, sistem, atau log..." 
                className="w-full pl-12 pr-6 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-primary/50 transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-3 pr-6 border-r border-slate-200">
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status Server</p>
                  <div className="flex items-center gap-1.5 justify-end">
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                     <p className="text-[10px] font-bold text-slate-600">Terhubung</p>
                  </div>
               </div>
            </div>

            
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center space-x-3 bg-white p-1 rounded-2xl border border-slate-200 hover:border-primary/20 transition-all shadow-sm group"
              >
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-primary/20 overflow-hidden group-hover:scale-105 transition-transform">
                   {profile?.avatar_url ? (
                     <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                   ) : (
                     profile?.display_name?.[0] || 'A'
                   )}
                </div>
                <div className="text-left leading-tight hidden sm:block pr-3">
                  <p className="text-xs font-black text-slate-900 tracking-tight">{profile?.display_name}</p>
                  <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Master Control</p>
                </div>
              </button>

              <AnimatePresence>
                {isProfileMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-56 bg-white border border-tan-100 rounded-2xl shadow-2xl py-2 z-50"
                  >
                    <div className="px-4 py-3 border-b border-tan-100 mb-1">
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Info Sesi</p>
                       <p className="text-xs font-bold text-slate-600 truncate">{profile?.email}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={handleLogout} 
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 transition-colors text-sm font-bold cursor-pointer"
                    >
                      <LogOut size={16} /> Keluar
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function AdminSidebarLink({ to, icon: Icon, label, active, collapsed }: any) {
  return (
    <Link 
      to={to} 
      className={`
        relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all group
        ${active 
          ? 'bg-primary text-white shadow-lg shadow-primary/20' 
          : 'text-slate-400 hover:bg-white/5 hover:text-white'}
        ${collapsed && 'justify-center'}
      `}
    >
      <Icon size={20} className="shrink-0" />
      {!collapsed && <span className="text-sm font-bold tracking-tight">{label}</span>}
      {collapsed && (
        <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 text-white text-[10px] uppercase font-black tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-2xl border border-white/5">
          {label}
        </div>
      )}
      {!active && !collapsed && (
        <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity">
           <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
        </div>
      )}
    </Link>
  );
}
