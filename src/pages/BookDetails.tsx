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
    fetchBookData();
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
    <div className="max-w-5xl mx-auto space-y-12 pb-32">
      {/* Back & Actions */}
      <div className="flex items-center justify-between px-2">
         <button onClick={() => navigate('/app/user/library')} className="flex items-center gap-2 text-slate-400 hover:text-primary font-bold text-sm transition-all group">
            <ChevronLeft className="group-hover:-translate-x-1 transition-transform" /> Kembali ke Koleksi
         </button>
         <div className="flex gap-4">
            <ActionButton 
              icon={<Heart size={20} fill={isBookmarked ? 'currentColor' : 'none'} />} 
              label={isBookmarked ? 'Tersimpan' : 'Favorit'} 
              onClick={handleToggleBookmark} 
              color={isBookmarked ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-tan-50 text-slate-400 hover:text-primary'}
            />
            <ActionButton 
              icon={<Quote size={20} />} 
              label="Kutipan" 
              onClick={() => setShowQuoteModal(true)} 
              color="bg-white border-tan-50 text-slate-400 hover:text-indigo-500"
            />
         </div>
      </div>

      {/* Main Info Card */}
      <section className="bg-white rounded-[48px] p-10 md:p-16 border border-tan-50 shadow-sm relative overflow-hidden">
         <div className="flex flex-col md:flex-row gap-12 md:gap-20 relative z-10">
            <motion.div 
               initial={{ opacity: 0, x: -30 }}
               animate={{ opacity: 1, x: 0 }}
               className="w-full md:w-80 shrink-0"
            >
               <div className="aspect-[3/4.2] rounded-[40px] overflow-hidden shadow-2xl border-4 border-white transform hover:rotate-3 transition-transform duration-700">
                  <img src={book.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} alt={book.title} className="w-full h-full object-cover" />
               </div>
               
               <div className="mt-12 grid grid-cols-2 gap-4">
                  <div className="p-5 bg-tan-50/50 rounded-3xl border border-tan-50 text-center">
                     <Bookmark size={20} className="text-orange-400 mx-auto mb-2" fill="currentColor" />
                     <p className="text-xl font-black text-slate-900 leading-none">{book.status || 'Aktif'}</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status</p>
                  </div>
                  <div className="p-5 bg-tan-50/50 rounded-3xl border border-tan-50 text-center">
                     <Layers size={20} className="text-indigo-400 mx-auto mb-2" />
                     <p className="text-xl font-black text-slate-900 leading-none">{book.total_pages || '?'}</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Halaman</p>
                  </div>
               </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, x: 30 }}
               animate={{ opacity: 1, x: 0 }}
               className="flex-1 space-y-8"
            >
               <div className="space-y-4">
                  <span className="px-5 py-1.5 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-primary/10">
                     {book.genre}
                  </span>
                  <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">{book.title}</h1>
                  <p className="text-xl text-slate-400 font-bold italic">Oleh {book.author}</p>
               </div>

               <div className="flex gap-10 border-y border-tan-50 py-8">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-tan-50 flex items-center justify-center text-primary"><Layers size={18} /></div>
                     <div>
                        <p className="text-xs font-black text-slate-900">{(book.total_pages || 100)} Halaman</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Volume</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-tan-50 flex items-center justify-center text-primary"><BookOpen size={18} /></div>
                     <div>
                        <p className="text-xs font-black text-slate-900">{book.status || 'Belum Dimulai'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Tentang perjalanan ini</h3>
                  <p className="text-slate-500 leading-relaxed font-medium text-lg italic">
                     {book.synopsis || "Sinopsis tidak tersedia untuk judul ini. Larutkan diri Anda dalam cerita untuk menemukan keajaibannya."}
                  </p>
               </div>

               <button 
                  onClick={() => navigate('/app/user/tracker')}
                  className="flex items-center justify-center gap-3 w-full py-6 bg-slate-900 text-white rounded-[32px] font-black text-lg hover:scale-105 transition-all shadow-2xl shadow-slate-200"
               >
                  <BookOpen size={24} /> Buka Pelacak Bacaan
               </button>
            </motion.div>
         </div>
         <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-tan-50 rounded-full blur-[100px] pointer-events-none opacity-40"></div>
      </section>

      {/* Private Journal Section */}
      <section className="space-y-10">
         <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border border-tan-50"><MessageSquare size={24} /></div>
               <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Catatan Membaca Saya ✍️</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jurnal Pribadi & Rahasia</p>
               </div>
            </div>
            <Link 
               to={`/app/user/book/${id}`}
               className="px-8 py-3 bg-white border border-tan-50 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-3 shadow-sm hover:translate-y-[-2px]"
            >
               {personalReview ? 'Perbarui Catatan' : 'Mulai Menulis'} <Plus size={18} />
            </Link>
         </div>

         {personalReview ? (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white p-12 rounded-[56px] border border-tan-50 shadow-2xl shadow-tan-100/20 relative overflow-hidden"
            >
               <div className="relative z-10 space-y-10">
                  <div className="flex items-center justify-between">
                     <div className="flex gap-1.5">
                        {[...Array(5)].map((_, i) => (
                           <Star 
                              key={i} 
                              size={24} 
                              className={i < personalReview.rating ? 'text-orange-400' : 'text-slate-100'} 
                              fill={i < personalReview.rating ? 'currentColor' : 'none'} 
                           />
                        ))}
                     </div>
                     {personalReview.mood && (
                        <div className="px-5 py-2 bg-slate-50 rounded-2xl border border-tan-50 flex items-center gap-3">
                           <span className="text-2xl">{personalReview.mood}</span>
                           <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-l border-tan-100 pl-3">Mood</span>
                        </div>
                     )}
                  </div>

                  <div className="space-y-6">
                     <Quote className="text-primary/20" size={48} />
                     <p className="text-3xl font-medium text-slate-800 leading-relaxed font-serif italic selection:bg-primary/20">
                        {personalReview.comment}
                     </p>
                  </div>

                  <div className="pt-10 border-t border-tan-50 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-tan-50 border-2 border-white shadow-sm overflow-hidden">
                           <img src={profile?.avatar_url || `https://i.pravatar.cc/100?u=${user?.id}`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-xs font-black text-slate-900">{profile?.display_name || 'Membaca...'}</p>
                     </div>
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Dibuat: {new Date(personalReview.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
               </div>
               <Heart className="absolute -right-20 -bottom-20 text-primary/[0.03] rotate-12" size={320} />
            </motion.div>
         ) : (
            <div className="bg-white p-20 rounded-[56px] border-2 border-dashed border-tan-100 text-center space-y-8">
               <div className="w-24 h-24 bg-tan-50 rounded-full flex items-center justify-center mx-auto text-slate-200 group-hover:scale-110 transition-transform">
                  <Heart size={48} />
               </div>
               <div className="max-w-md mx-auto space-y-4">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Perjalanan Anda belum dicatat</h3>
                  <p className="text-slate-400 font-medium pb-4">Tuliskan pesan moral, kutipan favorit, atau sekadar perasaan Anda setelah membaca buku ini. Catatan ini hanya milik Anda.</p>
                  <Link 
                     to={`/app/user/book/${id}`}
                     className="px-12 py-5 bg-primary text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-2xl shadow-primary/20 inline-block"
                  >
                     Tulis Catatan Sekarang
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
       <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-md bg-white rounded-[40px] p-10 shadow-3xl border border-tan-50 space-y-8">
          <div className="flex justify-between items-center">
             <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
             <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><X size={20} /></button>
          </div>
          {children}
       </motion.div>
    </div>
  );
}
