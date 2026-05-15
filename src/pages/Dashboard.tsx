import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Book, TrendingUp, Clock, Award, Star, ArrowRight, Sparkles, BookOpen, ChevronRight, Plus, Heart, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { reminders, fetchReminders } = useNotifications();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ 
    booksFinished: 0, 
    totalPagesRead: 0,
    dailyTarget: 10,
    totalBooks: 0
  });

  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const [currentlyReading, setCurrentlyReading] = useState<any>(null);
  const [recentBooks, setRecentBooks] = useState<any[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const fetchDashboardData = async () => {
      if (!isMounted) return;
      setLoading(true);
      
      // Safety timeout
      const safetyTimeout = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 5000);

      try {
        const [booksRes, logRes, favRes] = await Promise.allSettled([
          supabase
            .from('books')
            .select('id, title, author, genre, synopsis, cover_url, updated_at, owner_id, status, total_pages, current_page')
            .eq('owner_id', user.id),
          supabase
            .from('reading_logs')
            .select('pages_read')
            .eq('user_id', user.id)
            .eq('reading_date', new Date().toISOString().split('T')[0])
            .maybeSingle(),
          supabase
            .from('bookmarks')
            .select('id, book_id, books(*)')
            .eq('user_id', user.id)
            .limit(4)
        ]);

        if (!isMounted) return;

        // Process Books
        let books: any[] = [];
        if (booksRes.status === 'fulfilled' && !booksRes.value.error) {
          books = booksRes.value.data || [];
        }

        // Process Logs
        let pagesToday = 0;
        if (logRes.status === 'fulfilled' && !logRes.value.error) {
          pagesToday = logRes.value.data?.pages_read || 0;
        }
        
        // Process Favorites
        let favorites: any[] = [];
        if (favRes.status === 'fulfilled' && !favRes.value.error) {
          favorites = favRes.value.data?.map((f: any) => f.books).filter(Boolean) || [];
        }

        // Currently Reading
        const inProgress = books.find(b => (b as any).status === 'Sedang Dibaca' || (b as any).status === 'In Progress');
        setCurrentlyReading(inProgress || books[0] || null);

        // Stats
        const finishedCount = books.filter(b => b.status === 'Selesai' || b.status === 'Completed').length;
        
        setStats({
          booksFinished: finishedCount,
          totalPagesRead: pagesToday, 
          dailyTarget: profile?.daily_target || 20,
          totalBooks: books.length
        });

        // Recent Books
        const sorted = [...books].sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        setRecentBooks(sorted.slice(0, 4));
        setFavoriteBooks(favorites);

      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        clearTimeout(safetyTimeout);
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboardData();

    const syncChannel = supabase
      .channel(`dashboard_sync_${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reminders',
        filter: `user_id=eq.${user.id}`
      }, () => fetchReminders())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookmarks',
        filter: `user_id=eq.${user.id}`
      }, fetchDashboardData)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reading_logs',
        filter: `user_id=eq.${user.id}`
      }, fetchDashboardData)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'books',
        filter: `owner_id=eq.${user.id}`
      }, fetchDashboardData)
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(syncChannel);
    };
  }, [user?.id, profile?.daily_target]);

  if (loading) return (
    <div className="animate-pulse space-y-10">
      <div className="h-64 bg-slate-100 rounded-[48px] w-full"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-[32px]"></div>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-96 bg-slate-100 rounded-[48px]"></div>
        <div className="h-96 bg-slate-100 rounded-[48px]"></div>
      </div>
    </div>
  );

  const progressPercent = (currentlyReading && (currentlyReading.total_pages || 100) > 0)
    ? Math.round(((currentlyReading.current_page || 0) / (currentlyReading.total_pages || 100)) * 100) 
    : 0;

  return (
    <div className="space-y-8 md:space-y-12 pb-16 md:pb-20 font-sans overflow-x-hidden">
      {/* Personalized Welcome */}
      <section className="px-1 md:px-2">
        <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
          Halo, <span className="text-primary">{displayName}!</span> ✨
        </h2>
        <p className="text-slate-400 font-bold text-[9px] md:text-xs uppercase tracking-[0.2em] mt-2 md:mt-3">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </section>

      {/* Aesthetic Featured Section: Currently Reading */}
      <section className="bg-white rounded-[32px] md:rounded-[48px] p-6 md:p-12 shadow-sm border border-tan-50 flex flex-col lg:flex-row items-center justify-between overflow-hidden relative min-h-auto md:min-h-[400px]">
        <div className="relative z-10 max-w-xl w-full text-center lg:text-left">
          <div>
            <span className="px-4 md:px-5 py-1.5 md:py-2 bg-tan-50 text-primary rounded-full text-[9px] md:text-[11px] font-black uppercase tracking-widest border border-primary/10">
              Sedang Dibaca
            </span>
            
            {currentlyReading ? (
              <>
                <h1 className="text-3xl md:text-5xl font-black mt-6 md:mt-8 mb-4 md:mb-6 text-slate-900 tracking-tight leading-tight line-clamp-2">
                  {currentlyReading.title}
                </h1>
                <p className="text-slate-500 leading-relaxed line-clamp-3 md:line-clamp-2 mb-8 md:mb-10 text-base md:text-lg font-medium italic px-2 md:px-0">
                  "{currentlyReading.synopsis || "Sinopsis tidak tersedia untuk buku ini."}"
                </p>
                
                <div className="space-y-6 md:space-y-8">
                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 md:gap-6">
                    <Link 
                      to={`/app/user/book/${currentlyReading.id}`} 
                      className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 bg-primary text-white rounded-[20px] md:rounded-[24px] font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all text-xs md:text-sm flex items-center justify-center gap-3 whitespace-nowrap"
                    >
                      Buka Catatan <Heart size={18} fill="currentColor" />
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 md:py-12">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-4 md:mb-6">Tidak ada buku aktif</h2>
                <p className="text-slate-500 font-medium mb-8 md:mb-10 max-w-sm mx-auto lg:mx-0 text-sm md:text-base">Mulai petualangan baru hari ini!</p>
                <Link to="/app/user/library" className="inline-flex px-8 md:px-10 py-4 md:py-5 bg-slate-900 text-white rounded-[20px] md:rounded-[24px] font-black shadow-xl hover:scale-105 transition-all text-xs md:text-sm items-center gap-3">
                  Pilih Buku <BookOpen size={18} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {currentlyReading ? (
          <motion.div 
            initial={{ opacity: 0, y: 30, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: 5 }}
            className="mt-10 lg:mt-0 w-48 md:w-64 aspect-[3/4] bg-white rounded-[32px] md:rounded-[40px] shadow-2xl relative z-10 overflow-hidden transform shrink-0 border-[6px] md:border-[8px] border-white group"
          >
            <img 
              src={currentlyReading.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} 
              alt={currentlyReading.title} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 shadow-inner" 
            />
          </motion.div>
        ) : (
          <div className="mt-10 lg:mt-0 w-48 md:w-64 aspect-[3/4] bg-tan-50 rounded-[32px] md:rounded-[40px] border-2 md:border-4 border-dashed border-tan-100 items-center justify-center text-tan-200 flex">
             <Book size={48} md={64} strokeWidth={1} />
          </div>
        )}
        
        <div className="absolute -right-20 -top-20 w-[60%] md:w-[40%] h-[120%] bg-tan-50/50 rounded-full blur-[60px] md:blur-[100px] pointer-events-none"></div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
        <StatCard 
          icon={<Award className="text-primary" />} 
          label="Selesai" 
          value={stats.booksFinished} 
          suffix={`/ ${profile?.monthly_target || 5}`}
        />
        <StatCard 
          icon={<TrendingUp className="text-orange-400" />} 
          label="Hari Ini" 
          value={stats.totalPagesRead} 
          suffix={`/ ${stats.dailyTarget}`}
        />
        <div className="col-span-2 md:col-span-1">
          <StatCard 
            icon={<Clock className="text-indigo-400" />} 
            label="Target" 
            value={stats.dailyTarget} 
            suffix="Hal/Hari"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 pt-0 md:pt-4">
        {/* Recent Activity & Favorites */}
        <div className="lg:col-span-2 space-y-12 md:space-y-16">
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-10 px-1 md:px-2">
              <h2 className="text-xl md:text-3xl font-black text-slate-900 flex items-center gap-3 md:gap-4 tracking-tight">
                <Clock size={24} md={28} className="text-primary" /> Aktivitas Terbaru
              </h2>
              <Link to="/app/user/library" className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-primary px-4 md:px-6 py-2 md:py-2.5 bg-tan-50 rounded-full border border-primary/5 hover:bg-primary hover:text-white transition-all">
                Semua
              </Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
              {recentBooks.length > 0 ? recentBooks.map((book) => (
                <div 
                  key={book.id} 
                  onClick={() => navigate(`/app/user/details/${book.id}`)}
                  className="bg-white p-4 md:p-6 rounded-[32px] md:rounded-[40px] border border-tan-50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-300 group flex items-center gap-4 md:gap-6 cursor-pointer hover:scale-[1.02] hover:-translate-y-1"
                >
                  <div className="w-20 md:w-24 h-28 md:h-32 bg-slate-50 rounded-[20px] md:rounded-[24px] overflow-hidden relative shadow-sm shrink-0 border border-tan-50">
                    <img 
                      src={book.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} 
                      alt={book.title} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-widest mb-1 md:mb-1.5 block">{book.genre}</span>
                    <h4 className="font-extrabold text-slate-900 group-hover:text-primary transition-colors text-sm md:text-base line-clamp-1 mb-0.5 md:mb-1 tracking-tight">
                      {book.title}
                    </h4>
                    <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 md:mb-4">
                      Oleh {(book.author || 'Anonim').split(' ').slice(0, 2).join(' ')}
                    </p>
                    <div className="flex items-center gap-2 md:gap-3">
                       <span className={`px-2 py-0.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase tracking-widest ${
                         (book.status || 'Belum Dimulai') === 'Selesai' ? 'bg-emerald-50 text-emerald-500' :
                         (book.status || 'Belum Dimulai') === 'Sedang Dibaca' ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-400'
                       }`}>
                          {book.status || 'Belum Dimulai'}
                       </span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-span-full border-2 border-dashed border-tan-100 rounded-[32px] md:rounded-[48px] p-12 md:p-20 text-center bg-white/50">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-tan-50 rounded-[24px] md:rounded-[28px] flex items-center justify-center mx-auto mb-4 md:mb-6 text-primary/20 border border-primary/10">
                    <Book size={32} md={40} />
                  </div>
                  <h3 className="text-lg md:text-xl font-black text-slate-900 mb-2">Belum ada buku</h3>
                  <p className="text-slate-400 font-medium max-w-xs mx-auto text-xs md:text-sm">Klik 'Tambah Buku' untuk memulai koleksi Anda.</p>
                </div>
              )}
            </div>
          </section>

          {/* Favorite Section */}
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-10 px-1 md:px-2">
              <h2 className="text-xl md:text-3xl font-black text-slate-900 flex items-center gap-3 md:gap-4 tracking-tight">
                <Heart size={24} md={28} className="text-primary" fill="currentColor" /> Favorit
              </h2>
              <Link to="/app/user/bookmarks" className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-primary px-4 md:px-6 py-2 md:py-2.5 bg-tan-50 rounded-full border border-primary/5 hover:bg-primary hover:text-white transition-all">
                Semua
              </Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
              {favoriteBooks.length > 0 ? favoriteBooks.map((book) => (
                <div 
                  key={book.id} 
                  onClick={() => navigate(`/app/user/details/${book.id}`)}
                  className="bg-white p-4 md:p-6 rounded-[32px] md:rounded-[40px] border border-tan-50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-300 group flex items-center gap-4 md:gap-6 cursor-pointer hover:scale-[1.02] hover:-translate-y-1"
                >
                  <div className="w-20 md:w-24 h-28 md:h-32 bg-slate-50 rounded-[20px] md:rounded-[24px] overflow-hidden relative shadow-sm shrink-0 border border-tan-50">
                    <img 
                      src={book.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} 
                      alt={book.title} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-widest mb-1 block">{book.genre}</span>
                    <h4 className="font-extrabold text-slate-900 group-hover:text-primary transition-colors text-sm md:text-base line-clamp-1 mb-0.5 md:mb-1 tracking-tight">
                      {book.title}
                    </h4>
                    <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      Oleh {(book.author || 'Anonim').split(' ').slice(0, 2).join(' ')}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="col-span-full border-2 border-dashed border-tan-100 rounded-[32px] md:rounded-[48px] p-12 md:p-20 text-center bg-white/50">
                  <Heart size={32} md={40} className="mx-auto mb-4 text-primary/10" />
                  <p className="text-slate-400 font-bold text-xs md:text-sm italic">Belum ada buku favorit</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Mini - Stacked on Mobile */}
        <div className="space-y-8 md:space-y-10">
          <section>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-6 md:mb-8 flex items-center gap-3 md:gap-4 tracking-tight">
              <Sparkles size={20} md={24} className="text-primary" /> Tindakan Cepat
            </h2>
            <div className="bg-white rounded-[32px] md:rounded-[48px] p-6 md:p-8 border border-tan-50 grid grid-cols-2 lg:grid-cols-1 gap-3 md:gap-4 shadow-sm">
               <QuickAction 
                 to="/app/user/add-book" 
                 label="Tambah" 
                 icon={<Plus size={18} />} 
                 desc="Buku Baru"
                 color="bg-primary text-white" 
               />
               <QuickAction 
                 to="/app/user/tracker" 
                 label="Lacak" 
                 icon={<TrendingUp size={18} />} 
                 desc="Halaman"
                 color="bg-slate-900 text-white" 
               />
               <div className="col-span-2 lg:col-span-1">
                 <QuickAction 
                   to="/app/user/quotes" 
                   label="Kutipan" 
                   icon={<Star size={18} />} 
                   desc="Ide & Quote"
                   color="bg-tan-50 text-primary border border-primary/10" 
                 />
               </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-6 md:mb-8 flex items-center gap-3 md:gap-4 tracking-tight">
              <Bell size={20} md={24} className="text-primary" /> Pengingat
            </h2>
            <div className="bg-white rounded-[32px] md:rounded-[48px] p-6 md:p-8 border border-tan-50 space-y-4 shadow-sm">
               {reminders.length > 0 ? reminders.slice(0, 2).map((r: any) => (
                 <div key={r.id} className="p-4 md:p-5 bg-tan-50/30 rounded-2xl md:rounded-3xl border border-tan-50 group">
                    <p className="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-widest mb-1">
                      {new Date(r.scheduled_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <h4 className="font-extrabold text-slate-800 line-clamp-1 text-xs md:text-sm">{r.title}</h4>
                 </div>
               )) : (
                 <div className="text-center py-4 md:py-6">
                    <p className="text-[10px] md:text-xs text-slate-400 font-bold italic">Tidak ada jadwal</p>
                 </div>
               )}
               <Link to="/app/user/calendar" className="w-full flex items-center justify-center p-3 md:p-4 bg-slate-50 text-slate-600 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                  Lihat Kalender
               </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, suffix }: any) {
  return (
    <div className="p-5 md:p-10 bg-white rounded-[32px] md:rounded-[40px] border border-tan-50 shadow-sm flex flex-col md:flex-row items-center md:items-center text-center md:text-left gap-3 md:gap-8 hover:border-primary/20 transition-all hover:shadow-2xl hover:shadow-slate-100 group">
      <div className="w-12 h-12 md:w-20 md:h-20 rounded-[18px] md:rounded-[28px] flex items-center justify-center shrink-0 bg-tan-50 transition-all group-hover:scale-110 group-hover:bg-primary/5 border border-primary/5">
        {icon}
      </div>
      <div>
        <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 md:mb-2">{label}</p>
        <div className="flex items-baseline justify-center md:justify-start gap-1 md:gap-2">
          <p className="text-xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">{value}</p>
          <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase">{suffix}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, label, icon, desc, color }: any) {
  return (
    <Link 
      to={to} 
      className={`w-full flex items-center justify-between p-3 md:p-5 rounded-[20px] md:rounded-[28px] font-bold text-sm transition-all active:scale-[0.98] ${color} group min-h-[64px]`}
    >
      <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:rotate-12 transition-transform shrink-0">
          {icon}
        </div>
        <div className="text-left min-w-0">
           <p className="font-black leading-none text-xs md:text-sm truncate">{label}</p>
           <p className="text-[7px] md:text-[9px] opacity-60 font-medium uppercase tracking-widest mt-1 md:mt-1.5 truncate">{desc}</p>
        </div>
      </div>
      <ArrowRight size={14} md={18} className="group-hover:translate-x-1 transition-transform shrink-0" />
    </Link>
  );
}
