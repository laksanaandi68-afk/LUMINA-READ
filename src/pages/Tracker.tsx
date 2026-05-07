import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Calendar, BookOpen, Clock, ChevronRight, Award, Star, Zap, Save, Plus, Minus, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function Tracker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newPage, setNewPage] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    
    fetchBooks();

    const channel = supabase
      .channel('tracker_realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'books',
        filter: `owner_id=eq.${user.id}`
      }, () => {
        fetchBooks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      // Specifically select columns that are most likely to exist
      const { data, error } = await supabase
        .from('books')
        .select('id, title, author, genre, synopsis, cover_url, updated_at, owner_id, status, total_pages')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) {
         // Fallback if schema is broken
         const { data: minimalData, error: minimalError } = await supabase
           .from('books')
           .select('id, title, author')
           .eq('owner_id', user?.id);
         
         if (minimalError) throw minimalError;
         setBooks(minimalData || []);
      } else {
        setBooks(data || []);
      }
    } catch (err) {
      console.error('Fetch Tracker Books Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async (book: any) => {
    if (!user) return;
    setUpdatingId(book.id);

    try {
      if (newPage < 0) {
        Swal.fire('Error', 'Halaman tidak bisa negatif.', 'error');
        return;
      }

      const prevPage = book.current_page || 0;
      const pagesReadToday = Math.max(0, newPage - prevPage);

      if (pagesReadToday === 0 && newPage <= prevPage) {
        Swal.fire('Info', 'Halaman yang dimasukkan tidak menambah progres.', 'info');
        return;
      }

      setLoading(true);

      // 1. Update Book Progress
      const isFinished = newPage >= book.total_pages;
      const { error: bookError } = await supabase
        .from('books')
        .update({ 
          current_page: newPage,
          status: isFinished ? 'Selesai' : 'Sedang Dibaca',
          updated_at: new Date().toISOString()
        })
        .eq('id', book.id);

      if (bookError) throw bookError;
      
      // Auto-update global profile activity for others to see
      await supabase
        .from('profiles')
        .update({
          last_read_book_title: book.title,
          last_read_page: newPage,
          last_active_at: new Date().toISOString()
        })
        .eq('id', user.id);

      // 2. Update/Upsert Reading Log for today
      const today = new Date().toISOString().split('T')[0];
      
      // Get current log for today to increment
      const { data: existingLog } = await supabase
        .from('reading_logs')
        .select('id, pages_read')
        .eq('user_id', user.id)
        .eq('reading_date', today)
        .maybeSingle();

      if (existingLog) {
        await supabase
          .from('reading_logs')
          .update({ pages_read: existingLog.pages_read + pagesReadToday })
          .eq('id', existingLog.id);
      } else {
        await supabase
          .from('reading_logs')
          .insert({
            user_id: user.id,
            book_id: book.id,
            reading_date: today,
            pages_read: pagesReadToday
          });
      }

      // 3. Success Feedback
      if (isFinished) {
        Swal.fire({
          title: 'Luar Biasa! 🎉',
          text: `Anda telah menyelesaikan buku "${book.title}". Satu langkah lebih dekat ke target bulanan Anda!`,
          icon: 'success',
          confirmButtonText: 'Mantap!',
          confirmButtonColor: '#D2B48C',
        });
      } else {
        Swal.fire({
          title: 'Bagus! 💪',
          text: `Anda telah membaca ${pagesReadToday} halaman baru. Terus semangat!`,
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }

      setUpdatingId(null);
      fetchBooks();
    } catch (err: any) {
      console.error('Update Progress Error:', err);
      Swal.fire('Gagal', err.message || 'Gagal memperbarui progres.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inProgressBooks = books.filter(b => (b as any).status === 'Sedang Dibaca' || (b as any).status === 'In Progress');
  const finishedBooksCount = books.filter(b => (b as any).status === 'Selesai' || (b as any).status === 'Completed').length;
  
  // Calculate total pages read from logs instead of books for better accuracy
  const [totalReadingStats, setTotalReadingStats] = useState({ pages: 0, streak: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { data: logs } = await supabase
        .from('reading_logs')
        .select('pages_read, reading_date')
        .eq('user_id', user.id);
      
      if (logs) {
        const total = logs.reduce((sum, log) => sum + (log.pages_read || 0), 0);
        setTotalReadingStats(prev => ({ ...prev, pages: total }));
      }
    };
    fetchStats();
  }, [user, books]);

  const totalPagesRead = totalReadingStats.pages;
  
  // Calculate stats
  const totalBooks = books.length;
  const targetTercapai = totalBooks > 0 ? Math.round((finishedBooksCount / totalBooks) * 100) : 0;
  
  // Simple streak calculation based on activity
  const activeDays = new Set(books.map(b => b.updated_at ? new Date(b.updated_at).toDateString() : 'Unknown')).size;
  const streak = activeDays; 

  const chartData = books.slice(0, 6).map(b => {
    return {
      name: (b.title || 'Unknown').substring(0, 8) + '...',
      progress: (b as any).status === 'Selesai' ? 100 : 0
    };
  });

  const TAN_GRADIENT = ['#D2B48C', '#C1A37B', '#B0926A', '#9F8159', '#8E7048'];

  return (
    <div className="space-y-12 pb-20 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Lacak Bacaan</h1>
          <p className="text-slate-500 font-medium">Pantau progres membaca Anda dan capai target literasi Anda.</p>
        </div>
        <div className="flex gap-4">
          <StatMini label="Total Selesai" value={finishedBooksCount} color="text-primary" />
          <StatMini label="Halaman Dibaca" value={totalPagesRead} color="text-indigo-500" />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Progress List */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <BookOpen size={24} className="text-primary" /> Sedang Dibaca
            </h2>
            <span className="text-[10px] font-black uppercase text-slate-400 bg-tan-50 px-4 py-1.5 rounded-full">
              {inProgressBooks.length} Buku Aktif
            </span>
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {inProgressBooks.length > 0 ? inProgressBooks.map((book) => (
                <motion.div 
                  layout
                  key={book.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-8 rounded-[40px] border border-tan-50 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all group"
                >
                  <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                    <div className="w-24 h-32 rounded-[24px] overflow-hidden shadow-lg shrink-0 border-4 border-white/50">
                      <img src={book.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} alt="" className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-4">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 group-hover:text-primary transition-colors line-clamp-1">{book.title}</h3>
                        <p className="text-sm font-bold text-slate-400 tracking-tight">Oleh {book.author}</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                          <span>Status</span>
                          <span className="text-primary">{book.status}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                          <span>{(book.total_pages || 100)} Halaman</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-auto flex flex-col gap-3">
                      {updatingId === book.id ? (
                        <div className="bg-tan-50 p-4 rounded-[28px] space-y-4 shadow-inner border border-primary/5">
                           <div className="flex items-center gap-3">
                              <button onClick={() => setNewPage(Math.max(0, newPage - 1))} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm hover:bg-primary hover:text-white transition-all"><Minus size={16} /></button>
                              <input 
                                type="number" 
                                value={newPage} 
                                onChange={(e) => setNewPage(parseInt(e.target.value) || 0)}
                                className="w-20 text-center font-black text-lg bg-transparent border-none outline-none text-slate-900" 
                              />
                              <button onClick={() => setNewPage(Math.min((book.total_pages || 100), newPage + 1))} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm hover:bg-primary hover:text-white transition-all"><Plus size={16} /></button>
                           </div>
                           <div className="flex gap-2">
                             <button onClick={() => handleUpdateProgress(book)} className="flex-1 py-3 bg-primary text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-primary/20 flex items-center justify-center gap-2"><Save size={14} /> Simpan</button>
                             <button onClick={() => setUpdatingId(null)} className="px-4 py-3 bg-white text-slate-400 rounded-xl font-black text-[10px] uppercase border border-tan-50">Batal</button>
                           </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => { setUpdatingId(book.id); setNewPage(0); }}
                          className="w-full py-4 px-8 bg-slate-900 text-white rounded-[24px] font-black text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-slate-200"
                        >
                          Perbarui Progres
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )) : (
                <div className="text-center py-24 bg-white rounded-[48px] border-2 border-dashed border-tan-100">
                  <BookOpen size={64} className="mx-auto text-tan-100 mb-6" />
                  <p className="text-slate-400 font-bold italic">Belum ada buku dengan status "Sedang Dibaca".</p>
                  <button onClick={() => navigate('/app/user/library')} className="mt-6 text-primary font-black uppercase tracking-widest text-[11px] hover:underline">Buka Perpustakaan</button>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Analytics & Stats */}
        <div className="space-y-10">
          <div className="bg-white p-10 rounded-[48px] border border-tan-50 shadow-sm space-y-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <TrendingUp size={24} className="text-primary" /> Statistik
            </h3>
            
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip cursor={{ fill: '#faf9f6', radius: 10 }} />
                  <Bar dataKey="progress" radius={[10, 10, 0, 0]} barSize={32}>
                    {chartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={TAN_GRADIENT[index % TAN_GRADIENT.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-6 pt-4 border-t border-tan-50">
               <AchievementItem 
                 label="Target Tercapai" 
                 value={`${targetTercapai}%`} 
                 icon={<TrendingUp className="text-primary" />} 
               />
               <AchievementItem 
                 label="Untaian Harian" 
                 value={`${streak} Hari`} 
                 icon={<Award className="text-amber-500" />} 
               />
               <AchievementItem 
                 label="Buku Selesai" 
                 value={`${finishedBooksCount} Buku`} 
                 icon={<CheckCircle className="text-emerald-500" />} 
               />
            </div>
          </div>

          <div className="bg-slate-900 p-10 rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
            <h3 className="text-xl font-black mb-8 flex items-center gap-3">
              <Calendar size={22} className="text-primary" /> Pantau Progres
            </h3>
            <div className="text-center space-y-8">
               <div className="grid grid-cols-7 gap-2 opacity-20">
                 {Array.from({ length: 14 }).map((_, i) => (
                   <div key={i} className="aspect-square rounded-lg bg-white" />
                 ))}
               </div>
               <div className="space-y-4">
                 <p className="text-slate-400 text-xs font-medium leading-relaxed">
                   Lihat detail aktivitas harian dan bangun konsistensi membaca Anda.
                 </p>
                 <button 
                   onClick={() => navigate('/app/user/calendar')}
                   className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
                 >
                   Buka Kalender
                 </button>
               </div>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/20 rounded-full blur-[60px] pointer-events-none"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value, color }: any) {
  return (
    <div className="bg-white px-6 py-4 rounded-[28px] border border-tan-50 shadow-sm flex items-center gap-4">
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</div>
    </div>
  );
}

function AchievementItem({ label, value, icon }: any) {
  return (
    <div className="flex items-center justify-between group cursor-default">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-tan-50 flex items-center justify-center border border-primary/5 transition-transform group-hover:scale-110">
          {icon}
        </div>
        <span className="text-sm font-bold text-slate-500">{label}</span>
      </div>
      <span className="text-sm font-black text-slate-900">{value}</span>
    </div>
  );
}

function StatHex({ value, label, bg, border }: any) {
  return (
    <div className={`h-24 w-20 rounded-[28px] ${bg} ${border} border flex flex-col items-center justify-center text-white backdrop-blur-md shadow-xl`}>
       <span className="text-2xl font-black leading-none">{value}</span>
       <span className="text-[9px] font-black uppercase tracking-widest mt-2 opacity-60">{label}</span>
    </div>
  );
}

function MilestoneItem({ label, progress, icon, color }: any) {
  return (
    <div className="space-y-4">
       <div className="flex justify-between items-center text-xs font-black text-slate-900 tracking-tight">
          <span className="flex items-center gap-3 text-slate-400">{icon} {label}</span>
          <span className={color.replace('bg-', 'text-')}>{progress}%</span>
       </div>
       <div className="h-2 w-full bg-tan-50 rounded-full overflow-hidden border border-primary/10">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className={`h-full ${color} rounded-full shadow-lg shadow-black/5`}
          />
       </div>
    </div>
  );
}
