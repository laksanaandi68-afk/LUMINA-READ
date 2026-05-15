import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChevronLeft, 
  Star, 
  MessageSquare, 
  Bookmark, 
  BookOpen, 
  Clock, 
  Layers,
  Send,
  Quote,
  Plus,
  X,
  Save,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

interface Review {
  id: string;
  rating: number;
  comment: string;
  mood?: string;
  created_at: string;
  profiles: {
    display_name: string;
    avatar_url: string;
  };
}

export default function BookDetails() {
  const { id } = useParams();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [personalReview, setPersonalReview] = useState<any>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  // Modals
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  
  const [newBookmark, setNewBookmark] = useState({ page_number: 1, note: '' });
  const [newQuote, setNewQuote] = useState({ content: '', author_name: '' });

  useEffect(() => {
    if (!id) return;
    
    fetchBookData();

    // Re-fetch when anything changes
    const syncChannel = supabase
      .channel(`book_details_sync_${id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'books',
        filter: `id=eq.${id}`
      }, fetchBookData)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reviews',
        filter: `book_id=eq.${id}`
      }, fetchBookData)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookmarks',
        filter: `book_id=eq.${id}`
      }, fetchBookData)
      .subscribe();

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [id, user?.id]);

  const fetchBookData = async () => {
    if (!id) return;
    try {
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('id, title, author, genre, synopsis, cover_url, updated_at, owner_id, status, total_pages')
        .eq('id', id)
        .single();

      if (bookError) {
        // Fallback for missing columns
        const { data: minimal, error: minimalError } = await supabase
          .from('books')
          .select('id, title, author, genre, cover_url')
          .eq('id', id)
          .single();
        
        if (minimalError) throw minimalError;
        setBook(minimal);
      } else {
        setBook(bookData);
      }

      // Fetch personal review (Private Diary Entry)
      const { data: revData } = await supabase
        .from('reviews')
        .select('*')
        .eq('book_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      setPersonalReview(revData);

      // Check bookmark status
      const { data: bookmarkData } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('book_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      setIsBookmarked(!!bookmarkData);
    } catch (err) {
      console.error(err);
      navigate('/app/user/library');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (!user?.id || !id) return;
    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('book_id', id)
          .eq('user_id', user.id);
        if (error) throw error;
        setIsBookmarked(false);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Dihapus dari Favorit',
          showConfirmButton: false,
          timer: 2000
        });
      } else {
        const { error } = await supabase
          .from('bookmarks')
          .insert({ user_id: user.id, book_id: id });
        if (error) throw error;
        setIsBookmarked(true);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Disimpan ke Favorit',
          showConfirmButton: false,
          timer: 2000
        });
      }
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !id) return;
    try {
      const { error } = await supabase.from('bookmarks').insert({
        user_id: user.id,
        book_id: id,
        page_number: newBookmark.page_number,
        note: newBookmark.note
      });
      if (error) throw error;
      setShowBookmarkModal(false);
      setNewBookmark({ page_number: 1, note: '' });
      Swal.fire('Berhasil!', 'Markah berhasil disimpan.', 'success');
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !id) return;
    try {
      const { error } = await supabase.from('quotes').insert({
        user_id: user.id,
        book_id: id,
        content: newQuote.content,
        author_name: newQuote.author_name || book.author
      });
      if (error) throw error;
      setShowQuoteModal(false);
      setNewQuote({ content: '', author_name: '' });
      Swal.fire('Berhasil!', 'Kutipan inspiratif disimpan.', 'success');
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  if (loading) return (
    <div className="p-20 text-center animate-pulse">
       <div className="w-12 h-12 border-4 border-tan-100 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
       <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Mengambil data buku...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 md:space-y-12 pb-32 px-1">
      {/* Back & Actions */}
      <div className="flex items-center justify-between gap-4">
         <button onClick={() => navigate('/app/user/library')} className="flex items-center gap-2 text-slate-400 hover:text-primary font-bold text-xs md:text-sm transition-all group shrink-0">
            <ChevronLeft size={16} md={20} className="group-hover:-translate-x-1 transition-transform" /> <span className="hidden sm:inline">Koleksi</span>
         </button>
         <div className="flex gap-2 md:gap-4 ml-auto">
            <ActionButton 
              icon={<Heart size={16} md={20} fill={isBookmarked ? 'currentColor' : 'none'} />} 
              label={isBookmarked ? 'Tersimpan' : 'Favorit'} 
              onClick={handleToggleBookmark} 
              color={isBookmarked ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-tan-50 text-slate-400 hover:text-primary'}
            />
            <ActionButton 
              icon={<Quote size={16} md={20} />} 
              label="Kutipan" 
              onClick={() => setShowQuoteModal(true)} 
              color="bg-white border-tan-50 text-slate-400 hover:text-indigo-500"
            />
         </div>
      </div>

      {/* Main Info Card */}
      <section className="bg-white rounded-[32px] md:rounded-[48px] p-6 md:p-16 border border-tan-50 shadow-sm relative overflow-hidden">
         <div className="flex flex-col md:flex-row gap-8 md:gap-20 relative z-10">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="w-full md:w-80 shrink-0"
            >
               <div className="aspect-[3/4.2] w-full max-w-[240px] md:max-w-none mx-auto rounded-[24px] md:rounded-[40px] overflow-hidden shadow-2xl border-4 border-white">
                  <img src={book.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} alt={book.title} className="w-full h-full object-cover" />
               </div>
               
               <div className="mt-8 md:mt-12 grid grid-cols-2 gap-3 md:gap-4">
                  <div className="p-4 md:p-5 bg-tan-50/50 rounded-2xl md:rounded-3xl border border-tan-50 text-center">
                     <Bookmark size={16} md={20} className="text-orange-400 mx-auto mb-1 md:mb-2" fill="currentColor" />
                     <p className="text-sm md:text-xl font-black text-slate-900 leading-none truncate px-1">{book.status || 'Aktif'}</p>
                     <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status</p>
                  </div>
                  <div className="p-4 md:p-5 bg-tan-50/50 rounded-2xl md:rounded-3xl border border-tan-50 text-center">
                     <Layers size={16} md={20} className="text-indigo-400 mx-auto mb-1 md:mb-2" />
                     <p className="text-sm md:text-xl font-black text-slate-900 leading-none">{book.total_pages || '?'}</p>
                     <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Halaman</p>
                  </div>
               </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex-1 space-y-6 md:space-y-8 text-center md:text-left"
            >
               <div className="space-y-3 md:space-y-4">
                  <span className="inline-block px-4 py-1 bg-primary/10 text-primary rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] border border-primary/10">
                     {book.genre}
                  </span>
                  <h1 className="text-2xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">{book.title}</h1>
                  <p className="text-sm md:text-xl text-slate-400 font-bold italic">Oleh {book.author}</p>
               </div>

               <div className="flex justify-center md:justify-start gap-6 md:gap-10 border-y border-tan-50 py-6 md:py-8">
                  <div className="flex items-center gap-2 md:gap-3">
                     <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-tan-50 flex items-center justify-center text-primary"><Layers size={14} md={18} /></div>
                     <div className="text-left">
                        <p className="text-[10px] md:text-xs font-black text-slate-900">{(book.total_pages || 100)} Halaman</p>
                        <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase">Volume</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                     <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-tan-50 flex items-center justify-center text-primary"><BookOpen size={14} md={18} /></div>
                     <div className="text-left">
                        <p className="text-[10px] md:text-xs font-black text-slate-900">{book.status || 'Belum Dimulai'}</p>
                        <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase">Status</p>
                     </div>
                  </div>
               </div>

               <div className="space-y-3 md:space-y-4">
                  <h3 className="text-[10px] md:text-sm font-black text-slate-900 uppercase tracking-widest">Sinopsis</h3>
                  <p className="text-slate-500 leading-relaxed font-medium text-sm md:text-lg italic px-2 md:px-0">
                     {book.synopsis || "Sinopsis tidak tersedia untuk judul ini. Larutkan diri Anda dalam cerita untuk menemukan keajaibannya."}
                  </p>
               </div>

               <button 
                  onClick={() => navigate('/app/user/tracker')}
                  className="flex items-center justify-center gap-3 w-full py-4 md:py-6 bg-slate-900 text-white rounded-2xl md:rounded-[32px] font-black text-base md:text-lg hover:bg-slate-800 transition-all shadow-xl md:shadow-2xl shadow-slate-200 active:scale-[0.98]"
               >
                  <BookOpen size={20} md={24} /> Buka Pelacak
               </button>
            </motion.div>
         </div>
         <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-tan-50 rounded-full blur-[100px] pointer-events-none opacity-40"></div>
      </section>

      {/* Private Journal Section */}
      <section className="space-y-8 md:space-y-10">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-4 px-2">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center text-primary shadow-sm border border-tan-50 shrink-0"><MessageSquare size={20} md={24} /></div>
               <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Catatan Saya ✍️</h2>
                  <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jurnal Pribadi & Rahasia</p>
               </div>
            </div>
            <Link 
               to={`/app/user/book/${id}`}
               className="w-full md:w-auto px-6 md:px-8 py-3 bg-white border border-tan-50 text-slate-900 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm"
            >
               {personalReview ? 'Perbarui' : 'Menulis'} <Plus size={16} md={18} />
            </Link>
         </div>

         {personalReview ? (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white p-6 md:p-12 rounded-[32px] md:rounded-[56px] border border-tan-50 shadow-2xl shadow-tan-100/20 relative overflow-hidden"
            >
               <div className="relative z-10 space-y-6 md:space-y-10">
                  <div className="flex items-center justify-between">
                     <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                           <Star 
                              key={i} 
                              size={18} md={24} 
                              className={i < personalReview.rating ? 'text-orange-400' : 'text-slate-100'} 
                              fill={i < personalReview.rating ? 'currentColor' : 'none'} 
                           />
                        ))}
                     </div>
                     {personalReview.mood && (
                        <div className="px-3 md:px-5 py-1.5 md:py-2 bg-slate-50 rounded-xl md:rounded-2xl border border-tan-50 flex items-center gap-2 md:gap-3">
                           <span className="text-lg md:text-2xl">{personalReview.mood}</span>
                           <span className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest border-l border-tan-100 pl-2 md:pl-3">Mood</span>
                        </div>
                      )}
                  </div>

                  <div className="space-y-4 md:space-y-6">
                     <Quote className="text-primary/20" size={32} md={48} />
                     <p className="text-lg md:text-3xl font-medium text-slate-800 leading-relaxed font-serif italic selection:bg-primary/20">
                        {personalReview.comment}
                     </p>
                  </div>

                  <div className="pt-6 md:pt-10 border-t border-tan-50 flex items-center justify-between">
                     <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-tan-50 border-2 border-white shadow-sm overflow-hidden shrink-0">
                           <img src={profile?.avatar_url || `https://i.pravatar.cc/100?u=${user?.id}`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] md:text-xs font-black text-slate-900 truncate max-w-[120px]">{profile?.display_name || 'User'}</p>
                     </div>
                     <p className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{new Date(personalReview.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
               </div>
               <Heart className="absolute -right-10 -bottom-10 md:-right-20 md:-bottom-20 text-primary/[0.03] rotate-12" size={160} md={320} />
            </motion.div>
         ) : (
            <div className="bg-white p-10 md:p-20 rounded-[32px] md:rounded-[56px] border-2 border-dashed border-tan-100 text-center space-y-6 md:space-y-8">
               <div className="w-16 h-16 md:w-24 md:h-24 bg-tan-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                  <Heart size={32} md={48} />
               </div>
               <div className="max-w-md mx-auto space-y-3 md:space-y-4">
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Belum Ada Catatan</h3>
                  <p className="text-slate-400 font-medium text-xs md:text-base pb-2 md:pb-4 leading-relaxed">Tuliskan kesan, pesan, atau sekadar kutipan favorit dari buku ini sebagai kenangan pribadi.</p>
                  <Link 
                     to={`/app/user/book/${id}`}
                     className="px-8 md:px-12 py-4 md:py-5 bg-primary text-white rounded-2xl md:rounded-3xl font-black text-[10px] md:text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl md:shadow-2xl shadow-primary/20 inline-block"
                  >
                     Tulis Sekarang
                  </Link>
               </div>
            </div>
         )}
      </section>

      {/* Bookmark Modal */}
      <AnimatePresence>
        {showBookmarkModal && (
          <Modal title="Tandai Halaman" onClose={() => setShowBookmarkModal(false)}>
             <form onSubmit={handleAddBookmark} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Halaman</label>
                   <input 
                      type="number" 
                      value={newBookmark.page_number}
                      onChange={(e) => setNewBookmark({ ...newBookmark, page_number: parseInt(e.target.value) || 1 })}
                      className="w-full p-4 bg-tan-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      min={1}
                      max={book.total_pages || 100}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catatan (Opsional)</label>
                   <textarea 
                      placeholder="Apa yang terjadi di halaman ini?"
                      value={newBookmark.note}
                      onChange={(e) => setNewBookmark({ ...newBookmark, note: e.target.value })}
                      className="w-full p-4 bg-tan-50 border-none rounded-2xl font-medium text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none h-24"
                   />
                </div>
                <button type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">Simpan Markah</button>
             </form>
          </Modal>
        )}

        {showQuoteModal && (
          <Modal title="Simpan Kutipan" onClose={() => setShowQuoteModal(false)}>
             <form onSubmit={handleAddQuote} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kutipan</label>
                   <textarea 
                      placeholder="Tulisan inspiratif..."
                      value={newQuote.content}
                      onChange={(e) => setNewQuote({ ...newQuote, content: e.target.value })}
                      className="w-full p-6 bg-tan-50 border-none rounded-[28px] font-medium text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none h-40 italic"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Penulis</label>
                   <input 
                      type="text" 
                      placeholder={book.author}
                      value={newQuote.author_name}
                      onChange={(e) => setNewQuote({ ...newQuote, author_name: e.target.value })}
                      className="w-full p-4 bg-tan-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                   />
                </div>
                <button type="submit" className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all">Simpan Kutipan</button>
             </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({ icon, label, onClick, color }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-12 h-12 md:w-auto md:px-6 rounded-2xl flex items-center justify-center gap-3 transition-all border group ${color}`}
    >
       {icon}
       <span className="hidden md:block text-[11px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
       <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-md bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-3xl border border-tan-50 space-y-6 md:space-y-8 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center">
             <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">{title}</h3>
             <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><X size={20} /></button>
          </div>
          {children}
       </motion.div>
    </div>
  );
}
