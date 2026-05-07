import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Book, TrendingUp, Clock, Award, Star, ArrowRight, Sparkles, BookOpen, ChevronRight, Plus, Heart, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { reminders } = useNotifications();
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

    const channel = supabase
      .channel(`dashboard_updates_${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'books',
        filter: `owner_id=eq.${user.id}`
      }, fetchDashboardData)
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
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
    <div className="space-y-12 pb-20 font-sans">
      {/* Personalized Welcome */}
      <section className="px-2">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">
          Halo, <span className="text-primary">{displayName}!</span> ✨
        </h2>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.3em] mt-3">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </section>

      {/* Aesthetic Featured Section: Currently Reading */}
      <section className="bg-white rounded-[48px] p-12 shadow-sm border border-tan-50 flex flex-col lg:flex-row items-center justify-between overflow-hidden relative min-h-[400px]">
        <div className="relative z-10 max-w-xl w-full">
          <div>
            <span className="px-5 py-2 bg-tan-50 text-primary rounded-full text-[11px] font-black uppercase tracking-widest border border-primary/10">
              Sedang Dibaca
            </span>
            
            {currentlyReading ? (
              <>
                <h1 className="text-4xl md:text-5xl font-black mt-8 mb-6 text-slate-900 tracking-tight leading-tight">
                  {currentlyReading.title}
                </h1>
                <p className="text-slate-500 leading-relaxed line-clamp-2 mb-10 text-lg font-medium italic">
                  "{currentlyReading.synopsis || "Sinopsis tidak tersedia untuk buku ini."}"
                </p>
                
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <Link 
                      to={`/app/user/book/${currentlyReading.id}`} 
                      className="w-full sm:w-auto px-10 py-5 bg-primary text-white rounded-[24px] font-black shadow-2xl shadow-primary/20 hover:scale-105 transition-all text-sm flex items-center justify-center gap-3 whitespace-nowrap"
                    >
                      Catatan Membaca Saya ✍️ <Heart size={20} fill="currentColor" />
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12">
                <h2 className="text-3xl font-black text-slate-900 mb-6">Tidak ada buku yang sedang dibaca</h2>
                <p className="text-slate-500 font-medium mb-10 max-w-sm">Siap untuk petualangan baru? Pilih buku dari perpustakaan Anda dan mulai membaca.</p>
                <Link to="/app/user/library" className="inline-flex px-10 py-5 bg-slate-900 text-white rounded-[24px] font-black shadow-xl hover:scale-105 transition-all text-sm items-center gap-3">
                  Buka Perpustakaan <BookOpen size={20} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {currentlyReading ? (
          <motion.div 
            initial={{ opacity: 0, x: 50, rotate: 10 }}
            animate={{ opacity: 1, x: 0, rotate: 5 }}
            className="mt-12 lg:mt-0 w-64 h-80 bg-white rounded-[40px] shadow-2xl relative z-10 overflow-hidden transform shrink-0 border-[8px] border-white group"
          >
            <img 
              src={currentlyReading.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} 
              alt={currentlyReading.title} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center p-6 text-center opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="text-white font-black text-lg leading-tight tracking-tight uppercase px-4">
                 {currentlyReading.title}
               </span>
            </div>
          </motion.div>
        ) : (
          <div className="hidden lg:flex w-64 h-80 bg-tan-50 rounded-[40px] border-4 border-dashed border-tan-100 items-center justify-center text-tan-200">
             <Book size={64} strokeWidth={1} />
          </div>
        )}
        
        <div className="absolute -right-20 -top-20 w-[40%] h-[120%] bg-tan-50/50 rounded-full blur-[100px] pointer-events-none"></div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard 
          icon={<Award className="text-primary" />} 
          label="Buku Selesai" 
          value={stats.booksFinished} 
          suffix={`/ ${profile?.monthly_target || 5} Bln`}
        />
        <StatCard 
          icon={<TrendingUp className="text-orange-400" />} 
          label="Dibaca Hari Ini" 
          value={stats.totalPagesRead} 
          suffix={`/ ${stats.dailyTarget} Hal`}
        />
        <StatCard 
          icon={<Clock className="text-indigo-400" />} 
          label="Target Harian" 
          value={stats.dailyTarget} 
          suffix="Hal/Hari"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 pt-4">
        {/* Recent Activity & Favorites */}
        <div className="lg:col-span-2 space-y-16">
          <section>
            <div className="flex items-center justify-between mb-10 px-2">
              <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tight">
                <Clock size={28} className="text-primary" /> Aktivitas Terbaru
              </h2>
              <Link to="/app/user/library" className="text-[10px] font-black uppercase tracking-widest text-primary px-6 py-2.5 bg-tan-50 rounded-full border border-primary/5 hover:bg-primary hover:text-white transition-all">
                Semua Buku
              </Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {recentBooks.length > 0 ? recentBooks.map((book) => (
                <div 
                  key={book.id} 
                  onClick={() => navigate(`/app/user/details/${book.id}`)}
                  className="bg-white p-6 rounded-[40px] border border-tan-50 hover:shadow-2xl hover:shadow-slate-100 transition-all group flex items-center gap-6 cursor-pointer"
                >
                  <div className="w-24 h-32 bg-slate-50 rounded-[24px] overflow-hidden relative shadow-sm shrink-0 border border-tan-50">
                    <img 
                      src={book.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} 
                      alt={book.title} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest mb-1.5 block">{book.genre}</span>
                    <h4 className="font-extrabold text-slate-900 group-hover:text-primary transition-colors text-base line-clamp-1 mb-1 tracking-tight">
                      {book.title}
                    </h4>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                      Oleh {(book.author || 'Anonim').split(' ').slice(0, 2).join(' ')}
                    </p>
                    <div className="flex items-center gap-3">
                       <Link 
                         to={`/app/user/book/${book.id}`}
                         onClick={(e) => e.stopPropagation()}
                         className="px-4 py-1.5 bg-orange-400 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-orange-500 transition-colors shadow-lg shadow-orange-100"
                       >
                         Catatan Saya
                       </Link>
                       <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                         (book.status || 'Belum Dimulai') === 'Selesai' ? 'bg-emerald-50 text-emerald-500' :
                         (book.status || 'Belum Dimulai') === 'Sedang Dibaca' ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-400'
                       }`}>
                          {book.status || 'Belum Dimulai'}
                       </span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 border-2 border-dashed border-tan-100 rounded-[48px] p-20 text-center bg-white/50">
                  <div className="w-20 h-20 bg-tan-50 rounded-[28px] flex items-center justify-center mx-auto mb-6 text-primary/20 border border-primary/10">
                    <Book size={40} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Koleksi Kosong</h3>
                  <p className="text-slate-400 font-medium max-w-xs mx-auto text-sm">Belum ada aktivitas membaca. Tambahkan buku favorit Anda sekarang!</p>
                </div>
              )}
            </div>
          </section>

          {/* Favorite Section In Dashboard */}
          <section>
            <div className="flex items-center justify-between mb-10 px-2">
              <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tight">
                <Heart size={28} className="text-primary" fill="currentColor" /> Favorit Saya
              </h2>
              <Link to="/app/user/bookmarks" className="text-[10px] font-black uppercase tracking-widest text-primary px-6 py-2.5 bg-tan-50 rounded-full border border-primary/5 hover:bg-primary hover:text-white transition-all">
                Semua Favorit
              </Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {favoriteBooks.length > 0 ? favoriteBooks.map((book) => (
                <div 
                  key={book.id} 
                  onClick={() => navigate(`/app/user/details/${book.id}`)}
                  className="bg-white p-6 rounded-[40px] border border-tan-50 hover:shadow-2xl hover:shadow-primary/5 transition-all group flex items-center gap-6 cursor-pointer"
                >
                  <div className="w-24 h-32 bg-slate-50 rounded-[24px] overflow-hidden relative shadow-sm shrink-0 border border-tan-50">
                    <img 
                      src={book.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} 
                      alt={book.title} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                    />
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest mb-1.5 block">{book.genre}</span>
                    <h4 className="font-extrabold text-slate-900 group-hover:text-primary transition-colors text-base line-clamp-1 mb-1 tracking-tight">
                      {book.title}
                    </h4>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                      Oleh {(book.author || 'Anonim').split(' ').slice(0, 2).join(' ')}
                    </p>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black text-primary flex items-center gap-2">
                          Detail <ArrowRight size={14} />
                       </span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 border-2 border-dashed border-tan-100 rounded-[48px] p-20 text-center bg-white/50">
                  <div className="w-20 h-20 bg-tan-50 rounded-[28px] flex items-center justify-center mx-auto mb-6 text-primary/10 border border-primary/5">
                    <Heart size={40} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Belum ada favorit</h3>
                  <p className="text-slate-400 font-medium max-w-xs mx-auto text-sm">Tandai buku yang berkesan sebagai favorit untuk melihatnya di sini.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Mini */}
        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-4 tracking-tight">
              <Sparkles size={24} className="text-primary" /> Tindakan Cepat
            </h2>
            <div className="bg-white rounded-[48px] p-8 border border-tan-50 space-y-4 shadow-sm shadow-slate-100/50">
               <QuickAction 
                 to="/app/user/add-book" 
                 label="Tambah Buku" 
                 icon={<Plus className="size-5" />} 
                 desc="Tambah buku baru"
                 color="bg-primary text-white" 
               />
               <QuickAction 
                 to="/app/user/tracker" 
                 label="Lacak Progres" 
                 icon={<TrendingUp className="size-5" />} 
                 desc="Perbarui jumlah hal"
                 color="bg-slate-900 text-white" 
               />
               <QuickAction 
                 to="/app/user/quotes" 
                 label="Kutipan" 
                 icon={<Star className="size-5" />} 
                 desc="Simpan kata bijak"
                 color="bg-tan-50 text-primary border border-primary/10" 
               />
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-4 tracking-tight">
              <Bell size={24} className="text-primary" /> Pengingat
            </h2>
            <div className="bg-white rounded-[48px] p-8 border border-tan-50 space-y-4 shadow-sm shadow-slate-100/50">
               {reminders.length > 0 ? reminders.slice(0, 2).map((r: any) => (
                 <div key={r.id} className="p-5 bg-tan-50/30 rounded-3xl border border-tan-50 group hover:border-primary/20 transition-all">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">
                      {new Date(r.scheduled_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <h4 className="font-extrabold text-slate-800 line-clamp-1">{r.title}</h4>
                 </div>
               )) : (
                 <div className="text-center py-6">
                    <p className="text-xs text-slate-400 font-bold italic">Tidak ada jadwal terdekat</p>
                 </div>
               )}
               <Link to="/app/user/reminders" className="w-full flex items-center justify-center p-4 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                  Atur Jadwal
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
    <div className="p-10 bg-white rounded-[40px] border border-tan-50 shadow-sm flex items-center gap-8 hover:border-primary/20 transition-all hover:shadow-2xl hover:shadow-slate-100 group">
      <div className="w-20 h-20 rounded-[28px] flex items-center justify-center shrink-0 bg-tan-50 transition-all group-hover:scale-110 group-hover:bg-primary/5 border border-primary/5">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase">{suffix}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, label, icon, desc, color }: any) {
  return (
    <Link 
      to={to} 
      className={`w-full flex items-center justify-between p-5 rounded-[28px] font-bold text-sm transition-all active:scale-[0.98] ${color} group`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:rotate-12 transition-transform">
          {icon}
        </div>
        <div className="text-left">
           <p className="font-black leading-none">{label}</p>
           <p className="text-[9px] opacity-60 font-medium uppercase tracking-widest mt-1.5">{desc}</p>
        </div>
      </div>
      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
    </Link>
  );
}
