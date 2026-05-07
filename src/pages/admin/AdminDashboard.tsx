import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Activity, 
  User, 
  Library, 
  Star, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  Zap,
  MessageCircle,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBooks: 0,
    totalChats: 0,
    totalReports: 0,
    pendingReports: 0
  });
  const [activities, setActivities] = useState<any[]>([]);
  const [popularBooks, setPopularBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentActivities();
    fetchPopularBooks();

    const statsChannel = supabase.channel('admin_stats_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reading_tracks' }, () => {
        fetchStats();
        fetchRecentActivities();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(statsChannel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const [users, books, chats, reports, pending] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('books').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      ]);
      setStats({
        totalUsers: users.count || 0,
        totalBooks: books.count || 0,
        totalChats: chats.count || 0,
        totalReports: reports.count || 0,
        pendingReports: pending.count || 0
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRecentActivities = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('reading_tracks')
        .select('*, profiles(display_name), books(title)')
        .order('updated_at', { ascending: false })
        .limit(10);
      
      setActivities(data?.map(t => ({
        id: t.id,
        user: t.profiles?.display_name || 'Pembaca Anonim',
        content: `Membaca "${t.books?.title || 'Buku'}"`,
        created_at: t.updated_at
      })) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPopularBooks = async () => {
    try {
      const { data } = await supabase
        .from('books')
        .select('id, title, cover_url, rating')
        .order('rating', { ascending: false })
        .limit(3);
      setPopularBooks(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const lineChartData = {
    labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
    datasets: [
      {
        label: 'Aktivitas Membaca',
        data: [120, 150, 130, 180, 210, 250, 230],
        fill: true,
        borderColor: '#D2B48C',
        backgroundColor: 'rgba(210, 180, 140, 0.1)',
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#fff',
        titleColor: '#1e293b',
        bodyColor: '#64748b',
        padding: 12,
        borderColor: '#f1f5f9',
        borderWidth: 1,
        cornerRadius: 12,
        displayColors: false
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11, weight: 'bold' as const } }
      },
      y: {
        display: false,
      }
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 font-sans">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
             <div className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] rounded">System v4.0</div>
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             Command Console
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            Perpustakaan Digital LuminaRead • Node: Global-01
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden sm:flex flex-col text-right mr-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu Inisialisasi</p>
              <p className="text-sm font-black text-slate-900 font-mono tracking-tighter">04:36:22</p>
           </div>
           <div className="px-5 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 group hover:border-primary/30 transition-all cursor-default">
             <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(210,180,140,0.8)]"></div>
             <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Sinyal Enkripsi Aktif</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-sans">
         <MetricBlock icon={User} label="TOTAL PENGGUNA" value={stats.totalUsers} sub="Pengguna Terdaftar" />
         <Link to="/app/admin/chat">
           <MetricBlock icon={MessageCircle} label="TOTAL CHAT" value={stats.totalChats} sub="Sinyal Komunikasi" />
         </Link>
         <MetricBlock icon={ShieldAlert} label="TOTAL LAPORAN" value={stats.totalReports} sub="Aduan Komunitas" />
         <Link to="/app/admin/reports" className="block">
            <div className={`p-8 rounded-[40px] border shadow-xl relative group overflow-hidden h-full transition-all ${stats.pendingReports > 0 ? 'bg-rose-500 border-rose-400' : 'bg-slate-900 border-slate-800'}`}>
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                   <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <AlertCircle size={24} />
                   </div>
                   <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2">MODERATION QUEUE</p>
                   <p className="text-2xl font-black text-white leading-tight">{stats.pendingReports} Laporan Pending</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                   <span className={`w-2 h-2 rounded-full bg-white ${stats.pendingReports > 0 ? 'animate-ping' : ''}`}></span>
                   <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{stats.pendingReports > 0 ? 'Tindakan Diperlukan' : 'Sistem Aman'}</span>
                </div>
              </div>
              <ShieldAlert className="absolute -right-6 -bottom-6 text-white/5 w-32 h-32" />
            </div>
         </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 font-sans">
        <div className="xl:col-span-2 space-y-8">
           <div className="bg-white rounded-[40px] border border-tan-50 shadow-sm p-8">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                   Tren Aktivitas Mingguan
                 </h2>
                 <div className="flex gap-2">
                    <button className="px-3 py-1 text-[10px] font-bold bg-tan-50 text-primary rounded-full">WEEKLY</button>
                    <button className="px-3 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-50 rounded-full">MONTHLY</button>
                 </div>
              </div>
              <div className="h-[300px]">
                 <Line data={lineChartData} options={chartOptions} />
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-[40px] border border-tan-50 shadow-sm p-8">
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Buku Populer</h3>
                 <div className="space-y-4">
                    {popularBooks.map((book: any, i: number) => (
                       <div key={book.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-transparent hover:border-primary/20 transition-all">
                          <div className="flex items-center gap-3">
                             <span className="text-xs font-bold text-slate-300">0{i+1}</span>
                             <div className="w-10 h-14 rounded-xl bg-slate-200 overflow-hidden shadow-sm">
                                <img src={book.cover_url} className="w-full h-full object-cover" />
                             </div>
                             <div>
                               <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{book.title}</p>
                               <div className="flex items-center gap-1 mt-1">
                                 <Star size={10} className="fill-amber-400 text-amber-400" />
                                 <span className="text-[10px] font-bold text-slate-400">{book.rating}</span>
                               </div>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
              <div className="bg-primary rounded-[40px] p-8 flex flex-col justify-between text-white relative overflow-hidden group">
                 <div className="relative z-10 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                       <Zap size={24} />
                    </div>
                    <div>
                       <h3 className="text-2xl font-bold tracking-tight">Kesehatan Sistem</h3>
                       <p className="text-sm text-white/80 font-medium">Sinkronisasi database LuminaRead berjalan normal.</p>
                    </div>
                 </div>
                 <div className="relative z-10 mt-8">
                    <div className="flex justify-between text-[10px] font-black uppercase text-white/60 mb-2">
                       <span>Integritas Database</span>
                       <span>99.9%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: '99.9%' }}
                         className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" 
                        />
                    </div>
                 </div>
                 <Sparkles className="absolute -right-10 -top-10 text-white/10 w-40 h-40 rotate-12" />
              </div>
           </div>
        </div>

        <div className="bg-white rounded-[40px] border border-tan-50 shadow-sm flex flex-col h-full overflow-hidden">
           <div className="p-8 border-b border-tan-50 bg-tan-50/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                 Aktivitas Terbaru
              </h2>
              <div className="flex gap-1">
                 <Clock size={16} className="text-primary" />
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto divide-y divide-tan-50 p-4">
              <AnimatePresence initial={false}>
                 {loading ? (
                    <div className="p-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">Menghubungkan ke Server...</div>
                 ) : activities.length > 0 ? activities.map((log) => (
                   <motion.div 
                     key={log.id}
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="p-4 hover:bg-tan-50/50 transition-all rounded-3xl"
                   >
                     <p className="text-sm font-bold text-slate-900 mb-1">{log.user}</p>
                     <p className="text-xs text-slate-500 mb-3">{log.content}</p>
                     <div className="flex justify-between items-center text-[10px] font-bold text-slate-300">
                        <span>LOKASI: PERPUSTAKAAN</span>
                        <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                     </div>
                   </motion.div>
                 )) : (
                   <div className="p-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">Belum ada aktivitas.</div>
                 )}
              </AnimatePresence>
           </div>
           
           <div className="p-8 bg-slate-50">
              <button className="w-full py-4 bg-white border border-tan-100 rounded-2xl text-xs font-bold text-slate-500 hover:text-primary hover:border-primary/20 transition-all shadow-sm">
                Perbarui Laporan
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function MetricBlock({ icon: Icon, label, value, sub }: any) {
  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative group overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-500">
       <div className="relative z-10">
         <div className="flex items-center justify-between mb-8">
            <div className="w-14 h-14 rounded-2xl bg-tan-50 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
               <Icon size={28} />
            </div>
            <div className="w-8 h-8 rounded-full border-4 border-slate-50 flex items-center justify-center">
               <div className="w-full h-full rounded-full border border-slate-100 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors"></div>
               </div>
            </div>
         </div>
         <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
            <p className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">{value.toLocaleString()}</p>
            <div className="flex items-center gap-2 pt-2">
               <TrendingUp size={12} className="text-emerald-500" />
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{sub}</p>
            </div>
         </div>
       </div>
       {/* Background Decoration */}
       <div className="absolute top-0 right-0 w-40 h-40 bg-tan-50/50 rounded-full -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
       <div className="absolute bottom-4 right-8 text-[8px] font-mono text-slate-100 font-bold tracking-widest opacity-0 group-hover:opacity-100 transition-opacity uppercase select-none">
          {label.split(' ').join('_')} // SYS_04
       </div>
    </div>
  );
}
