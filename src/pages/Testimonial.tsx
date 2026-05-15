import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Star, Send, Heart, CheckCircle, Clock, AlertCircle, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function Testimonial() {
  const { profile, user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingTestimonial, setExistingTestimonial] = useState<any>(null);
  const [allTestimonials, setAllTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestimonials();
    if (profile) {
      checkExisting();
    } else {
      setLoading(false);
    }

    // Real-time subscription for testimonials
    const channel = supabase
      .channel('public:testimonials')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testimonials' }, () => {
        fetchTestimonials();
        if (profile) checkExisting();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select(`
          id,
          rating,
          message,
          created_at,
          profiles (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllTestimonials(data || []);
    } catch (err) {
      console.error('Error fetching testimonials:', err);
    }
  };

  const checkExisting = async () => {
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .eq('user_id', profile?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setExistingTestimonial(data);
    } catch (err) {
      console.error('Error checking testimonial:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteMyTestimonial = async () => {
    const result = await Swal.fire({
      title: 'Hapus testimoni?',
      text: "Anda dapat mengirimkan testimoni baru setelah ini.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, hapus'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('testimonials')
          .delete()
          .eq('id', existingTestimonial.id);

        if (error) throw error;
        setExistingTestimonial(null);
        setRating(0);
        setMessage('');
        Swal.fire('Dihapus!', 'Testimoni Anda telah dihapus.', 'success');
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || rating === 0 || message.length < 10) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('testimonials')
        .insert({
          user_id: profile.id,
          rating,
          message,
          status: 'pending'
        });

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Terima kasih!',
        text: 'Testimoni Anda telah dikirim dan sedang menunggu persetujuan moderator.',
        confirmButtonColor: '#D2B48C',
      });
      
      checkExisting();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to submit testimonial', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 px-6 font-sans">
      <header className="text-center space-y-4">
        <div className="w-20 h-20 bg-tan-50 rounded-[28px] flex items-center justify-center mx-auto text-primary shadow-sm border border-primary/5">
          <Heart size={40} className="fill-primary/10" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Suara Anda Penting</h1>
        <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
          Bagaimana pengalaman Anda menggunakan LuminaRead? Bagikan pendapat Anda untuk membantu pembaca lain.
        </p>
      </header>

      <section className="bg-white p-10 rounded-[48px] border border-tan-50 shadow-xl shadow-slate-200/40 relative overflow-hidden">
        {user ? (
          existingTestimonial ? (
            <div className="text-center space-y-8 py-10 relative z-10">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-inner animate-pulse">
                 <Clock size={32} />
              </div>
              <div className="space-y-4">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Testimoni Terkirim</h2>
                <div className="bg-amber-50/50 py-3 px-6 rounded-2xl inline-block border border-amber-100">
                  <p className="text-amber-700 font-bold text-sm tracking-tight">👉 Testimoni sudah dikirim, menunggu persetujuan admin</p>
                </div>
              </div>
              
              <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 text-left space-y-4 shadow-inner opacity-75">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={18} className={i < existingTestimonial.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                  ))}
                </div>
                <p className="text-slate-600 italic leading-relaxed text-sm">"{existingTestimonial.message}"</p>
                <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4 border-t border-slate-200/50">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Clock size={12} /> {new Date(existingTestimonial.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      existingTestimonial.status === 'approved' ? 'bg-emerald-50 text-emerald-500' : 
                      existingTestimonial.status === 'rejected' ? 'bg-rose-50 text-rose-500' : 
                      'bg-amber-50 text-amber-500'
                    }`}>
                      {existingTestimonial.status === 'approved' ? 'dipilih' : 
                       existingTestimonial.status === 'rejected' ? 'ditolak' : 'sedang ditinjau'}
                    </span>
                    <button 
                      onClick={deleteMyTestimonial}
                      className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:underline"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-tan-50 py-3 px-6 rounded-2xl inline-block">
                Anda hanya dapat mengirimkan satu testimoni.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-10 relative z-10">
              <div className="space-y-6">
                <label className="text-sm font-black text-slate-900 uppercase tracking-widest text-center block">
                  Berapa bintang untuk kami?
                </label>
                <div className="flex justify-center items-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => setRating(star)}
                      className="p-2 transition-all hover:scale-125 active:scale-95"
                    >
                      <Star 
                        size={48} 
                        className={`transition-colors duration-200 ${
                          (hoveredRating || rating) >= star 
                          ? "fill-amber-400 text-amber-400" 
                          : "text-slate-200"
                        }`}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
                {rating === 0 && (
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest text-center animate-pulse">
                    Silakan pilih rating untuk melanjutkan
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <label className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    Cerita Anda
                  </label>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${message.length < 10 ? 'text-slate-300' : 'text-emerald-500'}`}>
                    {message.length} / min 10 karakter
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Bagikan pengalaman Anda menggunakan perpustakaan, pelacak, atau komunitas kami..."
                  className="w-full bg-slate-50 border-none rounded-[32px] p-8 text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all resize-none h-48 font-medium placeholder:text-slate-300 shadow-inner"
                />
              </div>

              <div className="pt-6 border-t border-tan-50">
                 <button
                    type="submit"
                    disabled={rating === 0 || message.length < 10 || isSubmitting}
                    className="w-full py-6 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:bg-primary-dark transition-all disabled:opacity-30 flex items-center justify-center gap-3 active:scale-[0.98]"
                 >
                   {isSubmitting ? 'Mengirim...' : 'Kirim Umpan Balik'}
                   <Send size={20} />
                 </button>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-6 flex items-center justify-center gap-2">
                   <AlertCircle size={14} /> Pengiriman bersifat final dan hanya dapat dilakukan satu kali.
                 </p>
              </div>
            </form>
          )
        ) : (
          <div className="text-center py-10 space-y-6">
            <div className="w-16 h-16 bg-tan-50 rounded-2xl flex items-center justify-center mx-auto text-primary">
              <Star size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Ingin membagikan cerita Anda?</h3>
              <p className="text-sm text-slate-500 font-medium">Silakan masuk ke akun Anda untuk mengirimkan testimoni.</p>
            </div>
            <a href="/login" className="inline-block px-8 py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:scale-105 transition-all">
              Masuk Sekarang
            </a>
          </div>
        )}
        <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-tan-50/50 rounded-full blur-[100px] pointer-events-none"></div>
      </section>

      {/* Real-time Display Section */}
      <section className="space-y-8 pt-10">
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Apa Kata Pembaca Lain</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Pembaruan Real-time dari Komunitas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {allTestimonials.length > 0 ? (
              allTestimonials.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white p-8 rounded-[40px] border border-tan-50 shadow-sm hover:shadow-md transition-shadow relative group"
                >
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={idx} size={12} className={idx < t.rating ? "fill-amber-400 text-amber-400" : "text-slate-100"} />
                    ))}
                  </div>
                  <p className="text-slate-600 font-medium text-sm italic leading-relaxed mb-6 font-serif line-clamp-3">
                    "{t.message}"
                  </p>
                  <div className="flex items-center gap-3 pt-6 border-t border-tan-50">
                    <div className="w-10 h-10 rounded-xl bg-tan-50 flex items-center justify-center text-primary font-black text-xs border border-primary/5 overflow-hidden shadow-sm">
                      {t.profiles?.avatar_url ? (
                        <img src={t.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        t.profiles?.display_name?.[0] || 'U'
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 leading-none">{t.profiles?.display_name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">@{t.profiles?.username}</p>
                    </div>
                  </div>
                  <Heart className="absolute top-8 right-8 text-primary/5 group-hover:scale-110 transition-transform" size={24} />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
                <p className="text-slate-400 font-medium italic">Belum ada testimoni yang disetujui.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

