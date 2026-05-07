import React, { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Users, ArrowRight, Coffee, ChevronDown, Star, Heart, MessageSquare, User, LogOut, Settings, Clock, Sun, Moon } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';

export default function LandingPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalBooks: 0, totalUsers: 0 });
  const [onlineCount, setOnlineCount] = useState(1);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count: booksCount } = await supabase
          .from('books')
          .select('*', { count: 'exact', head: true });
        const { count: usersCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        setStats({ totalBooks: booksCount || 0, totalUsers: usersCount || 0 });
      } catch (err) { console.error(err); }
    };

    const fetchRecentUsers = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .not('avatar_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(4);
        setRecentUsers(data || []);
      } catch (err) { console.error(err); }
    };

    const fetchApprovedTestimonials = async () => {
      try {
        const { data } = await supabase
          .from('testimonials')
          .select(`
            id,
            rating,
            message,
            status,
            profiles (
              display_name,
              username,
              avatar_url
            )
          `)
          .eq('status', 'approved')
          .limit(4)
          .order('updated_at', { ascending: false });
        
        setTestimonials(data || []);
      } catch (err) {
        console.error("Error fetching testimonials:", err);
      }
    };

    fetchStats();
    fetchRecentUsers();
    fetchApprovedTestimonials();

    // Check if user has already submitted a testimonial
    const checkSubmission = async () => {
      if (user) {
        const { data } = await supabase
          .from('testimonials')
          .select('id, status')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data) setHasSubmitted(true);
      }
    };
    checkSubmission();

    // Set up real-time subscriptions
    const booksChannel = supabase
      .channel('public:books')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, fetchStats)
      .subscribe();

    const profilesChannel = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchRecentUsers();
        fetchStats();
      })
      .subscribe();

    const testimonialsChannel = supabase
      .channel('public:testimonials')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testimonials' }, fetchApprovedTestimonials)
      .subscribe();

    // REAL-TIME PRESENCE (Online Users)
    const presenceChannel = supabase.channel('online-readers');
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const uniqueUsers = new Map();
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id && !uniqueUsers.has(p.user_id)) {
              uniqueUsers.set(p.user_id, p);
            }
          });
        });

        setOnlineCount(uniqueUsers.size || 1);
        
        // Update bubble avatars based on online users if they have avatars
        const onlineWithAvatars = Array.from(uniqueUsers.values())
          .filter(u => u.avatar_url)
          .map(u => ({ display_name: u.display_name, avatar_url: u.avatar_url }))
          .slice(0, 4);
        
        if (onlineWithAvatars.length > 0) {
          setRecentUsers(prev => {
            const combined = [...onlineWithAvatars];
            prev.forEach(p => {
              if (combined.length < 4 && !combined.some(c => c.avatar_url === p.avatar_url)) {
                combined.push(p);
              }
            });
            return combined.slice(0, 4);
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            user_id: user?.id || 'anon-' + Math.random().toString(36).substring(2, 11),
            role: profile?.role || 'visitor',
            display_name: profile?.display_name || user?.email?.split('@')[0] || 'Visitor',
            avatar_url: profile?.avatar_url || null
          });
        }
      });

    // Re-track if profile updates
    if (user && profile) {
      presenceChannel.track({
        online_at: new Date().toISOString(),
        user_id: user.id,
        role: profile.role,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url || null
      });
    }

    return () => {
      supabase.removeChannel(booksChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(testimonialsChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user, profile]);

  const faqs = [
    { q: "Apakah LuminaRead gratis digunakan?", a: "Ya! Anda dapat memulai perjalanan membaca Anda secara gratis, melacak kemajuan, dan bergabung dengan komunitas tanpa biaya apa pun." },
    { q: "Bisakah saya membaca buku secara offline?", a: "Saat ini, LuminaRead adalah platform berbasis digital. Kami menyarankan untuk tetap terhubung untuk menyinkronkan progres Anda dan mengakses rekomendasi langsung." },
    { q: "Bagaimana cara kerja rekomendasi suasana hati?", a: "AI kami menganalisis suasana hati yang Anda pilih dan mencocokkannya dengan genre serta tema dari perpustakaan kurasi kami untuk menemukan pasangan buku yang sempurna." },
    { q: "Bagaimana cara melaporkan masalah pada buku?", a: "Anda dapat mengikuti bagian Alur Proses di bawah ini atau menghubungi tim dukungan kami secara langsung melalui Pusat Bantuan." }
  ];

  const handleSubmitTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newMessage.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('testimonials')
        .insert({
          user_id: user.id,
          rating: newRating,
          message: newMessage,
          status: 'pending'
        });

      if (error) throw error;

      setHasSubmitted(true);
      setNewMessage('');
      
      Swal.fire({
        icon: 'info',
        title: 'Berhasil Dikirim',
        text: 'Testimoni Anda telah dikirim dan sedang menunggu persetujuan moderator.',
        confirmButtonColor: '#D2B48C',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengirim',
        text: error.message,
        confirmButtonColor: '#D2B48C',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="home" className="min-h-screen bg-[#fdfcfb] text-slate-800 selection:bg-primary/30">
      {/* Aesthetic Navigation */}
      <nav className="fixed top-0 w-full z-[100] bg-white/70 backdrop-blur-lg border-b border-tan-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <BookOpen className="text-white" size={22} />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">LuminaRead</span>
          </div>
          <div className="hidden md:flex items-center gap-10 text-sm font-semibold text-slate-600">
            <a href="#home" className="hover:text-primary transition-colors">Beranda</a>
            <a href="#flow" className="hover:text-primary transition-colors">Alur</a>
            <a href="#stats" className="hover:text-primary transition-colors">Statistik</a>
            <a href="#testimonials" className="hover:text-primary transition-colors">Testimoni</a>
            <a href="#faq" className="hover:text-primary transition-colors">Tanya Jawab</a>
          </div>
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-8 h-8 rounded-full border-2 border-tan-50 border-t-primary animate-spin mr-2"></div>
            ) : user ? (
              <div className="flex items-center gap-3 p-1.5 pr-5 rounded-full border border-tan-100 bg-white shadow-sm relative z-[110]">
                <Link to="/app/user/profile" className="w-10 h-10 rounded-full overflow-hidden shadow-sm flex items-center justify-center bg-tan-50 text-primary font-black shrink-0 hover:scale-105 transition-transform">
                   {profile?.avatar_url ? (
                     <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                   ) : (
                     profile?.display_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'
                   )}
                </Link>
                <Link to={profile?.role === 'admin' ? "/app/admin/dashboard" : "/app/user/dashboard"} className="flex flex-col">
                   <span className="text-[13px] font-black text-slate-900 leading-tight">
                     {profile?.display_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}
                   </span>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                     {profile?.role === 'admin' ? 'Admin Panel' : 'Dashboard'}
                   </span>
                </Link>
                <div className="w-px h-8 bg-tan-100 mx-2"></div>
                <button 
                  type="button"
                  onClick={async () => {
                    try {
                      localStorage.clear();
                      sessionStorage.clear();
                      await supabase.auth.signOut();
                      window.location.replace('/');
                    } catch (err) {
                      window.location.replace('/');
                    }
                  }}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors group cursor-pointer"
                >
                  <LogOut size={18} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>
            ) : (
              <Link 
                to="/login" 
                className="bg-primary text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all hover:scale-105 active:scale-95"
              >
                Mulai Sekarang
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Cozy Hero Section */}
      <section className="pt-40 pb-20 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative z-10">
          <div className="lg:w-1/2 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-tan-50 rounded-full text-primary font-bold text-xs uppercase tracking-widest mb-6 border border-primary/20">
                <Coffee size={14} /> Tempat Membaca Pribadi Anda
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight">
                Menjelajah di <span className="text-primary italic">Setiap Bab</span>
              </h1>
              <p className="text-lg text-slate-500 mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Ruang hangat dan bebas gangguan untuk perpustakaan digital Anda. Lacak progres Anda, temukan rekomendasi berdasarkan suasana hati, dan bergabunglah dengan komunitas pecinta buku.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-8 justify-center lg:justify-start pt-4">
                <Link 
                  to={!loading && user?.id ? (profile?.role === 'admin' ? '/app/admin/dashboard' : '/app/user/dashboard') : '/login'} 
                  className="px-10 py-5 bg-slate-900 text-white rounded-[24px] font-bold shadow-2xl hover:bg-slate-800 transition-all hover:-translate-y-1 flex items-center gap-2"
                >
                  {user?.id ? 'Lanjutkan Membaca' : 'Mulai Perjalanan Anda'} <ArrowRight size={20} />
                </Link>
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {recentUsers.length > 0 ? (
                      recentUsers.map((u: any, i: number) => (
                        <img 
                          key={i} 
                          className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover bg-tan-50" 
                          src={u.avatar_url} 
                          alt={u.display_name} 
                        />
                      ))
                    ) : (
                      [1,2,3,4].map(i => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-tan-50 flex items-center justify-center text-[10px] font-bold text-primary/30">
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    <p className="text-sm font-bold text-slate-500 mt-0.5">
                      <span className="text-primary">{onlineCount.toLocaleString()}</span> Online Sekarang
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          <div className="lg:w-1/2 relative group">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative aspect-[4/5] max-w-md mx-auto"
            >
              <div className="absolute inset-0 bg-primary/20 rounded-[80px] rotate-6 group-hover:rotate-12 transition-transform duration-700 shadow-xl"></div>
              <img 
                src="https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800" 
                alt="Cozy reading" 
                className="relative z-10 w-full h-full object-cover rounded-[80px] shadow-2xl transition-transform duration-700 group-hover:-translate-y-4 border-8 border-white"
              />
              <div className="absolute -bottom-10 -right-10 z-20 bg-white p-6 rounded-[32px] shadow-2xl border border-tan-50 hidden sm:block">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                    <Star fill="currentColor" size={24} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900 tracking-tight">Platform Terpercaya</p>
                    <p className="text-xs text-slate-400 font-medium">Oleh Komunitas Global</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Report Flow Section */}
      <section id="flow" className="py-24 px-6 bg-white relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-20">
             <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary mb-4 block">Panduan Proses</span>
            <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-6 tracking-tight">Alur Membaca Tanpa Hambatan</h2>
            <p className="text-slate-500 leading-relaxed font-medium">Langkah sederhana untuk meningkatkan pengalaman membaca Anda dan melaporkan masalah koleksi.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <FlowStep number="01" title="Temukan" desc="Cari melalui perpustakaan digital kami yang berisi ribuan judul pilihan." />
            <FlowStep number="02" title="Lacak" desc="Catat progres harian Anda dan pertahankan rentetan membaca Anda." />
            <FlowStep number="03" title="Lapor" desc="Menemukan kesalahan dalam buku? Tandai langsung di tampilan bacaan Anda." />
            <FlowStep number="04" title="Selesaikan" desc="Admin kami memverifikasi dan memperbaiki masalah yang dilaporkan dalam 24 jam." />
            
            {/* Visual connector line for desktop */}
            <div className="hidden md:block absolute top-[60px] left-[10%] right-[10%] h-px bg-tan-100 -z-10"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-[#fdfcfb]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Fitur Utama Kami</h2>
            <p className="text-slate-600">Berbagai kemudahan dalam satu platform untuk meningkatkan kualitas membaca Anda.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<BookOpen size={24} className="text-primary" />} 
              title="Koleksi Digital" 
              desc="Akses ribuan judul buku pilihan dari berbagai genre ternama." 
            />
            <FeatureCard 
              icon={<Users size={24} className="text-primary" />} 
              title="Komunitas" 
              desc="Berdiskusi dan berbagi rekomendasi dengan pembaca lainnya." 
            />
            <FeatureCard 
              icon={<Star size={24} className="text-primary" />} 
              title="Progres Membaca" 
              desc="Lacak detail harian Anda dan capai target membaca bulanan." 
            />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-32 px-6 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20 max-w-2xl mx-auto space-y-2">
            <span className="text-[10px] uppercase tracking-[0.4em] font-black text-primary/50 block">Reader Love</span>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight flex items-center justify-center gap-3">
              Kata Mereka <span className="text-3xl opacity-50">💬</span>
            </h2>
            <p className="text-slate-400 font-medium text-sm leading-relaxed">Umpan balik langsung dari komunitas membaca global kami.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {testimonials.length > 0 ? (
              testimonials.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white p-10 rounded-[48px] border border-tan-50 shadow-xl shadow-slate-200/20 hover:scale-105 transition-all duration-500 group relative flex flex-col"
                >
                  <div className="flex items-center gap-1 mb-6">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={idx} size={14} className={idx < t.rating ? "fill-amber-400 text-amber-400" : "text-slate-100"} />
                    ))}
                  </div>
                  <p className="text-slate-600 font-medium leading-relaxed italic mb-10 font-serif line-clamp-4 flex-1">
                    "{t.message}"
                  </p>
                  <div className="flex items-center gap-4 border-t border-tan-50 pt-8 mt-auto">
                    <div className="w-12 h-12 rounded-2xl bg-tan-50 flex items-center justify-center text-primary font-black shadow-sm overflow-hidden border border-primary/5">
                      {t.profiles?.avatar_url ? (
                        <img src={t.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        t.profiles?.display_name?.[0] || 'U'
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900 leading-none">{t.profiles?.display_name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                        @{t.profiles?.username}
                      </p>
                    </div>
                  </div>
                  <Heart className="absolute top-10 right-10 text-primary/5 group-hover:scale-110 transition-transform" size={40} />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-24 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center text-slate-200 border border-slate-100">
                   <MessageSquare size={32} strokeWidth={1.5} />
                </div>
                <p className="text-slate-400 font-bold tracking-tight text-sm">Belum ada testimoni dari pengguna</p>
              </div>
            )}
          </div>

          {/* Testimonial Submission Form (Only for Logged In Users) */}
          <AnimatePresence>
            {user?.id && !loading && !hasSubmitted && profile ? (
              <motion.div
                key="testimonial-form"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                className="mt-24 max-w-2xl mx-auto"
              >
                <div className="bg-white p-12 rounded-[56px] border-2 border-tan-50 shadow-2xl shadow-primary/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                    <MessageSquare size={120} />
                  </div>
                  
                  <div className="relative z-10 text-center mb-10">
                    <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Bagikan Cerita Anda ✨</h3>
                    <p className="text-slate-400 font-medium text-sm">Bagaimana pengalaman Anda menggunakan LuminaRead?</p>
                  </div>

                  <form onSubmit={handleSubmitTestimonial} className="space-y-8">
                    {/* Rating Stars Selection */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center gap-3 p-4 bg-tan-50 rounded-full border border-tan-100">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewRating(star)}
                            className="transition-all hover:scale-125 group"
                          >
                            <Star
                              size={28}
                              className={`${
                                star <= newRating 
                                  ? "fill-amber-400 text-amber-400" 
                                  : "text-slate-200 group-hover:text-amber-200"
                              } transition-colors`}
                            />
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Pilih Rating</p>
                    </div>

                    <div className="relative">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Tuliskan pengalaman Anda di sini..."
                        rows={4}
                        className="w-full px-8 py-6 rounded-[32px] bg-tan-50 border-2 border-transparent focus:border-primary/20 focus:bg-white outline-none text-slate-700 font-medium text-sm transition-all resize-none placeholder:text-slate-300"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || !newMessage.trim()}
                      className={`w-full py-5 rounded-[28px] font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3
                        ${isSubmitting || !newMessage.trim() 
                          ? "bg-slate-100 text-slate-300 cursor-not-allowed" 
                          : "bg-primary text-white hover:bg-primary-dark hover:-translate-y-1 active:scale-95"
                        }
                      `}
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>Kirim Testimoni <ArrowRight size={18} /></>
                      )}
                    </button>
                  </form>
                </div>
              </motion.div>
            ) : null}

            {/* Success Message After Submission */}
            {user?.id && !loading && hasSubmitted ? (
              <motion.div
                key="testimonial-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mt-20 max-w-md mx-auto text-center p-12 bg-white rounded-[56px] border border-tan-100 shadow-xl"
              >
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-8 text-amber-500">
                   <Clock size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">Pesan Terkirim</h3>
                <p className="text-slate-400 font-medium text-sm">Testimoni sudah dikirim, menunggu persetujuan admin</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="absolute right-0 bottom-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      </section>

      {/* Statistics Section */}
      <section id="stats" className="py-32 px-6 tan-gradient relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-20">
            <div className="lg:w-1/2 text-center lg:text-left">
              <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-8 leading-tight tracking-tight">Lihat Pertumbuhan Kami Secara <span className="text-primary italic">Langsung</span></h2>
              <p className="text-lg text-slate-500 font-medium mb-10 max-w-lg">Setiap buku yang dibaca dan setiap anggota baru memperkuat komunitas kami. Bergabunglah hari ini.</p>
              <Link 
                to={!loading && user ? (profile?.role === 'admin' ? '/app/admin/dashboard' : '/app/user/dashboard') : '/login'} 
                className="px-10 py-5 bg-primary text-white rounded-[24px] font-bold shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all"
              >
                {user ? 'Ke Dashboard' : 'Bergabung Sekarang'}
              </Link>
            </div>
            
            <div className="lg:w-1/2 grid grid-cols-2 gap-8 w-full">
              <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-tan-50 text-center transform hover:-translate-y-2 transition-all">
                <div className="w-16 h-16 bg-tan-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary">
                  <BookOpen size={32} />
                </div>
                <p className="text-5xl font-bold text-slate-900 mb-2">{stats.totalBooks.toLocaleString()}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Judul Perpustakaan Aman</p>
              </div>
              <div className="bg-slate-900 p-12 rounded-[48px] shadow-2xl border border-slate-800 text-center transform translate-y-12 hover:translate-y-10 transition-all group">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary group-hover:scale-110 transition-transform">
                  <Users size={32} />
                </div>
                <p className="text-5xl font-bold text-white mb-2 tracking-tighter">{onlineCount.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none mb-4">Sedang Membaca</p>
                <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total {stats.totalUsers.toLocaleString()} Anggota</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 px-6 bg-white relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">Punya Pertanyaan?</h2>
            <p className="text-slate-500 font-medium">Segala hal yang perlu Anda ketahui tentang ruang baca baru Anda.</p>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-tan-50 rounded-[32px] overflow-hidden transition-all">
                <button 
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-tan-50 transition-colors"
                >
                  <span className="font-bold text-slate-900">{faq.q}</span>
                  <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-tan-50 transition-transform ${activeFaq === i ? 'rotate-180' : ''}`}>
                    <ChevronDown size={18} />
                  </div>
                </button>
                <AnimatePresence>
                  {activeFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-8 pb-6 text-slate-500 text-sm font-medium leading-relaxed"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FlowStep({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="text-center space-y-6 group">
      <div className="w-20 h-20 bg-tan-50 rounded-[28px] flex items-center justify-center mx-auto text-primary font-bold text-xl shadow-lg shadow-tan-100 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500 relative z-10">
        {number}
      </div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed font-medium px-4">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: ReactNode, title: string, desc: string }) {
  return (
    <div className="p-10 rounded-[40px] bg-[#fdfcfb] border border-tan-50 hover:shadow-2xl hover:shadow-primary/5 transition-all group">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed font-medium">{desc}</p>
    </div>
  );
}
