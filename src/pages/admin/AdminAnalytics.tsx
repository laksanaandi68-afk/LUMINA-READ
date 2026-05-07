import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  TrendingUp, 
  Users, 
  BookOpen, 
  Award, 
  ArrowUpRight, 
  ArrowDownRight,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export default function AdminAnalytics() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBooks: 0,
    activeReaders: 0,
    completionRate: 0,
    growthRate: 12.5,
    retentionRate: 85
  });
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [genreStats, setGenreStats] = useState<any[]>([]);
  const [isServerConnected, setIsServerConnected] = useState(true);

  const fetchAnalyticsData = async () => {
    try {
      // Fetch basic counts
      const [users, books, readingTracks] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: false }),
        supabase.from('books').select('*', { count: 'exact', head: false }),
        supabase.from('reading_tracks').select('*', { count: 'exact', head: false })
      ]);

      const totalUsers = users.count || 0;
      const totalBooks = books.count || 0;
      const finishedBooks = readingTracks.data?.filter(t => t.is_finished).length || 0;

      // Group books by genre for chart
      const categoryMap: Record<string, number> = {};
      books.data?.forEach(book => {
        const genre = book.genre || 'Lainnya';
        categoryMap[genre] = (categoryMap[genre] || 0) + 1;
      });

      const formattedGenreData = Object.entries(categoryMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Generate growth history (Last 6 months)
      const now = new Date();
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return {
          month: date.toLocaleString('default', { month: 'short' }),
          timestamp: date.getTime(),
          users: 0,
          books: 0
        };
      });

      users.data?.forEach(user => {
        const date = new Date(user.created_at);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
        const monthData = last6Months.find(m => m.timestamp === monthStart);
        if (monthData) monthData.users++;
      });

      books.data?.forEach(book => {
        const date = new Date(book.created_at);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
        const monthData = last6Months.find(m => m.timestamp === monthStart);
        if (monthData) monthData.books++;
      });

      // Cumulative user counts for better visual representation
      let cumulativeUsers = 0;
      let cumulativeBooks = 0;
      const cumulativeHistory = last6Months.map(m => {
        cumulativeUsers += m.users;
        cumulativeBooks += m.books;
        return {
          month: m.month,
          users: cumulativeUsers + 20, // Add base for visual
          books: cumulativeBooks + 10  // Add base for visual
        };
      });

      // Calculate Growth Rate (This month vs Last month)
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
      
      const newUsersThisMonth = users.data?.filter(u => {
        const d = new Date(u.created_at);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      }).length || 0;

      const newUsersLastMonth = users.data?.filter(u => {
        const d = new Date(u.created_at);
        return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
      }).length || 0;

      const growthRate = newUsersLastMonth > 0 
        ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100) 
        : (newUsersThisMonth > 0 ? 100 : 0);

      // Calculate Retention (Active users in last 7 days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const activeUserIds = new Set(
        readingTracks.data?.filter(t => new Date(t.updated_at) > sevenDaysAgo).map(t => t.user_id)
      );
      const retentionRate = totalUsers > 0 ? Math.round((activeUserIds.size / totalUsers) * 100) : 0;

      setStats({
        totalUsers,
        totalBooks,
        activeReaders: activeUserIds.size,
        completionRate: totalBooks > 0 ? (finishedBooks / totalBooks) * 100 : 0,
        growthRate,
        retentionRate
      });
      setGenreStats(formattedGenreData);
      setHistoryData(cumulativeHistory);
    } catch (err) {
      console.error('Analytics Error:', err);
      setIsServerConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();

    const channel = supabase.channel('realtime_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAnalyticsData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => fetchAnalyticsData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reading_tracks' }, () => fetchAnalyticsData())
      .subscribe((status) => {
        setIsServerConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const COLORS = ['#D2B48C', '#e6d5bc', '#b69b78', '#f5eedf', '#10b981'];

  return (
    <div className="space-y-6 pb-20 font-sans">
      {/* Search and Top Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between mb-8">
        <div className="relative w-full lg:w-[450px]">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
             <Search size={18} className="text-slate-400" />
          </div>
          <input 
            type="text" 
            placeholder="Cari data, sistem, atau log..." 
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all placeholder:text-slate-300"
          />
        </div>
        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Status Server</span>
              <div className="flex items-center gap-2 mt-1">
                 <span className={`w-2 h-2 rounded-full ${isServerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                 <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">{isServerConnected ? 'Terhubung' : 'Terputus'}</span>
              </div>
           </div>
           <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xs uppercase shadow-lg shadow-primary/20 overflow-hidden">
                 {profile?.avatar_url ? (
                   <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                 ) : (
                   profile?.display_name?.[0] || 'A'
                 )}
              </div>
              <div className="hidden sm:block">
                 <p className="text-[11px] font-black text-slate-900 leading-none">{profile?.display_name || 'admin'}</p>
                 <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-1">Master Control</p>
              </div>
           </div>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          label="TOTAL PEMBACA" 
          value={stats.totalUsers} 
          trend={`${stats.growthRate >= 0 ? '+' : ''}${stats.growthRate}%`} 
          isPositive={stats.growthRate >= 0} 
          icon={Users} 
        />
        <StatsCard 
          label="UKURAN PERPUSTAKAAN" 
          value={stats.totalBooks} 
          trend="+5%" 
          isPositive={true} 
          icon={BookOpen} 
          iconColor="text-emerald-500"
        />
        <StatsCard 
          label="TINGKAT PERTUMBUHAN" 
          value={`${stats.growthRate}%`} 
          trend={stats.growthRate > 10 ? '+3%' : '-1%'} 
          isPositive={stats.growthRate > 10} 
          icon={TrendingUp} 
          iconColor="text-orange-500"
        />
        <StatsCard 
          label="RETENSI" 
          value={`${stats.retentionRate}%`} 
          trend={stats.retentionRate > 80 ? '+2%' : '-1%'} 
          isPositive={stats.retentionRate > 80} 
          icon={Award} 
          iconColor="text-rose-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 mt-12">
        {/* Growth Line Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 bg-white p-10 rounded-[48px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.03)] border border-slate-50 relative overflow-hidden"
        >
          <div className="flex justify-between items-center mb-10 relative z-10">
             <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Pertumbuhan Ekosistem</h2>
                <p className="text-[11px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">6 BULAN TERAKHIR</p>
             </div>
             <div className="flex gap-6">
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-[#6366f1] shadow-[0_0_10px_rgba(99,102,241,0.3)]"></div>
                   <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Pengguna</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                   <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Buku</span>
                </div>
             </div>
          </div>
          <div className="h-[350px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBooks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }}
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }}
                />
                <ReTooltip 
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                    fontSize: '13px',
                    fontWeight: 900,
                    padding: '16px'
                  }}
                  itemStyle={{ padding: '4px 0' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#6366f1" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorUsers)" 
                  animationDuration={2000}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#6366f1' }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="books" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorBooks)" 
                  animationDuration={2000}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#10b981' }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Subtle background aesthetic */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
        </motion.div>

        {/* Genre Bar Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-10 rounded-[48px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.03)] border border-slate-50 flex flex-col"
        >
          <div className="mb-10">
             <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Distribusi Genre</h2>
             <p className="text-[11px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">KATEGORI DOMINAN</p>
          </div>
          <div className="flex-1 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genreStats} layout="vertical" margin={{ left: 0, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={100}
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 800 }}
                />
                <ReTooltip 
                  cursor={{ fill: '#f1f5f9', radius: 12 }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={28}>
                  {genreStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Syncing Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/40 backdrop-blur-[8px] z-50 flex items-center justify-center"
          >
             <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Data Engine</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest animate-pulse">Sinkronisasi Realtime...</p>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatsCard({ label, value, trend, isPositive, icon: Icon, iconColor = "text-primary" }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -8, shadow: '0 40px 80px -15px rgba(0,0,0,0.08)' }}
      className="bg-white p-10 rounded-[48px] border border-slate-50 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.02)] relative overflow-hidden group transition-all duration-500"
    >
       <div className="flex items-start justify-between mb-10">
          <div className={`w-14 h-14 rounded-[22px] bg-slate-50 flex items-center justify-center ${iconColor} group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm`}>
             <Icon size={28} strokeWidth={2.5} />
          </div>
          <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[10px] font-black ${
            isPositive 
              ? 'bg-emerald-50 text-emerald-500' 
              : 'bg-rose-50 text-rose-500'
          }`}>
             {isPositive ? <ArrowUpRight size={14} strokeWidth={3} /> : <ArrowDownRight size={14} strokeWidth={3} />}
             {trend}
          </div>
       </div>

       <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{label}</p>
       <motion.h3 
          key={value}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-black text-slate-900 tracking-tight"
        >
          {value}
        </motion.h3>

       {/* Visual Polish */}
       <div className="absolute right-0 bottom-0 w-32 h-32 bg-slate-50 rounded-full blur-[40px] translate-x-12 translate-y-12 group-hover:bg-primary/5 transition-colors duration-500"></div>
    </motion.div>
  );
}
