import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChevronLeft, 
  Star, 
  Send,
  Sparkles,
  Heart,
  MessageSquare,
  Award,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function BookView() {
  const { id } = useParams();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [mood, setMood] = useState('😊');
  const [submitting, setSubmitting] = useState(false);

  const moods = [
    { emoji: '🤩', label: 'Excited' },
    { emoji: '😊', label: 'Happy' },
    { emoji: '✨', label: 'Inspired' },
    { emoji: '😌', label: 'Relaxed' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '🥱', label: 'Bored' }
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user?.id) return;
      try {
        // Fetch Book
        const { data: bookData, error: bookError } = await supabase
          .from('books')
          .select('*')
          .eq('id', id)
          .single();
        
        if (bookError) throw bookError;
        setBook(bookData);

        // Fetch user's existing private journal entry for this book
        const { data: reviewData } = await supabase
          .from('reviews')
          .select('*')
          .eq('book_id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (reviewData) {
          setRating(reviewData.rating);
          setComment(reviewData.comment || '');
          if (reviewData.mood) setMood(reviewData.mood);
        }

      } catch (err) {
        console.error(err);
        navigate('/app/user/library');
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Re-fetch when anything changes
    const syncChannel = supabase
      .channel(`book_view_sync_${id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'books',
        filter: `id=eq.${id}`
      }, fetchData)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reviews',
        filter: `book_id=eq.${id}`
      }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [id, user?.id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !id || !comment.trim()) {
      Swal.fire('Oops!', 'Mohon berikan ulasan tertulis Anda.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('reviews').upsert({
        user_id: user.id,
        book_id: id,
        rating,
        comment: comment.trim(),
        mood
      });

      if (error) throw error;

      // Update book average rating (optional/simplified)
      // Real app should use triggered function, but we can do a simple update for UI feel
      const { data: allR } = await supabase.from('reviews').select('rating').eq('book_id', id);
      if (allR && allR.length > 0) {
        const avg = allR.reduce((acc, curr) => acc + curr.rating, 0) / allR.length;
        await supabase.from('books').update({ 
          rating: avg, 
          review_count: allR.length 
        }).eq('id', id);
      }

      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Ulasan Anda telah disimpan.',
        showConfirmButton: false,
        timer: 1500
      });
      
      setTimeout(() => navigate(`/app/user/details/${id}`), 1500);
    } catch (err: any) {
      Swal.fire('Gagal', err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#fdfcfb]">
      <div className="w-12 h-12 border-4 border-tan-100 border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fdfcfb] font-sans pb-32">
      {/* Header */}
      <header className="h-16 md:h-20 px-4 md:px-8 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-tan-50 sticky top-0 z-50">
        <div className="flex items-center gap-3 md:gap-6">
          <button onClick={() => navigate(-1)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-tan-50 text-primary rounded-xl hover:scale-105 transition-all">
            <ChevronLeft size={16} md={20} />
          </button>
          <div className="min-w-0">
            <h1 className="font-black text-xs md:text-base tracking-tight text-slate-900 truncate">Jurnal Membaca ✍️</h1>
            <p className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Hanya untuk matamu saja</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
           <Link to={`/app/user/details/${id}`} className="text-[7px] md:text-[10px] font-black uppercase text-primary bg-tan-50 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl whitespace-nowrap">Info Buku</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto mt-8 md:mt-16 px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 md:gap-16">
          {/* Left Side: Book Info */}
          <div className="lg:col-span-2 space-y-8 md:space-y-10">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="relative"
            >
              <div className="aspect-[3/4.2] w-full max-w-[200px] md:max-w-none mx-auto rounded-[32px] md:rounded-[48px] overflow-hidden shadow-2xl border-4 border-white rotate-2 md:rotate-3 hover:rotate-0 transition-transform duration-700">
                <img 
                  src={book?.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} 
                  alt={book?.title} 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="absolute -z-10 -right-5 md:-right-10 -bottom-5 md:-bottom-10 w-32 md:w-40 h-32 md:h-40 bg-primary/10 rounded-full blur-3xl"></div>
            </motion.div>

            <div className="space-y-3 md:space-y-4 text-center lg:text-left">
              <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">{book?.title}</h1>
              <p className="text-sm md:text-lg font-bold text-slate-400 italic">Oleh {book?.author}</p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 md:gap-3 mt-4 md:mt-6">
                <div className="px-4 md:px-5 py-1.5 md:py-2 bg-white rounded-xl md:rounded-2xl border border-tan-50 shadow-sm flex items-center gap-2 md:gap-3">
                   <Award className="text-orange-400" size={14} md={18} />
                   <span className="text-[10px] md:text-xs font-black text-slate-900">{book?.status || 'Selesai'}</span>
                </div>
                <div className="px-4 md:px-5 py-1.5 md:py-2 bg-white rounded-xl md:rounded-2xl border border-tan-50 shadow-sm flex items-center gap-2 md:gap-3">
                   <BookOpen className="text-indigo-400" size={14} md={18} />
                   <span className="text-[10px] md:text-xs font-black text-slate-900">{book?.total_pages || 100} Hal</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Review Form */}
          <div className="lg:col-span-3">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 md:p-14 rounded-[32px] md:rounded-[56px] border border-tan-50 shadow-2xl shadow-tan-100/30 relative overflow-hidden"
            >
              <div className="relative z-10 space-y-8 md:space-y-12">
                <div className="text-center space-y-3 md:space-y-4">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-tan-50 rounded-[22px] md:rounded-[28px] flex items-center justify-center mx-auto text-primary animate-bounce-slow">
                    <Heart size={32} md={40} fill="currentColor" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Catatan Pribadi</h2>
                  <p className="text-slate-400 font-medium text-xs md:text-sm">Bagaimana perasaan Anda setelah menyelesaikan petualangan ini?</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8 md:space-y-10">
                  {/* Mood Selection */}
                  <div className="space-y-3 md:space-y-4">
                    <p className="text-center text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Suasana Hati</p>
                    <div className="flex justify-center flex-wrap gap-2 md:gap-3">
                       {moods.map((m) => (
                         <button
                           key={m.label}
                           type="button"
                           onClick={() => setMood(m.emoji)}
                           className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl flex flex-col items-center gap-1 transition-all border-2 shrink-0 ${
                             mood === m.emoji 
                               ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5 scale-105 md:scale-110' 
                               : 'bg-slate-50 border-transparent text-slate-400 hover:bg-tan-50'
                           }`}
                         >
                           <span className="text-xl md:text-2xl">{m.emoji}</span>
                           <span className="text-[7px] md:text-[8px] font-black uppercase tracking-tighter">{m.label}</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* Star Rating */}
                  <div className="flex justify-center gap-2 md:gap-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-90 ${
                          rating >= star 
                            ? 'bg-orange-50 text-orange-400 border-2 border-orange-100 shadow-lg shadow-orange-100' 
                            : 'bg-slate-50 text-slate-200 border-2 border-slate-100'
                        }`}
                      >
                        <Star size={20} md={28} fill={rating >= star ? 'currentColor' : 'none'} strokeWidth={rating >= star ? 0 : 2} />
                      </button>
                    ))}
                  </div>

                  {/* Review Text */}
                  <div className="relative group">
                    <div className="absolute top-4 left-4 md:top-6 md:left-6 text-slate-200 group-focus-within:text-primary transition-colors">
                      <MessageSquare size={18} md={24} />
                    </div>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Apa yang paling berkesan bagi Anda?"
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-primary/20 rounded-[24px] md:rounded-[40px] p-5 pl-12 md:p-8 md:pl-20 text-[1xs] md:text-sm font-medium outline-none transition-all h-40 md:h-52 resize-none placeholder:text-slate-300 shadow-inner"
                    />
                  </div>

                  <button
                    disabled={submitting}
                    className="w-full py-4 md:py-6 bg-primary text-white rounded-2xl md:rounded-[32px] font-black text-base md:text-lg shadow-2xl shadow-primary/20 hover:bg-primary-dark transition-all transform hover:-translate-y-1 disabled:opacity-50 flex items-center justify-center gap-3 md:gap-4 active:scale-[0.98]"
                  >
                    {submitting ? 'Menyimpan...' : (
                      <>
                        Simpan Catatan <Send size={20} md={24} />
                      </>
                    )}
                  </button>
                </form>
              </div>
              
              <Sparkles className="absolute -right-10 -top-10 text-primary/5 rotate-12 pointer-events-none" size={150} md={200} />
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
