import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  User as UserIcon, 
  BookOpen, 
  MessageCircle, 
  UserPlus, 
  CheckCircle2, 
  ArrowLeft,
  Calendar,
  Layers,
  Star,
  Award,
  Globe,
  Settings,
  ShieldCheck,
  MoreVertical,
  UserMinus,
  AlertCircle,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';

export default function ProfileDetail() {
  const { id } = useParams();
  const { user, profile: myProfile } = useAuth();
  const navigate = useNavigate();
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalBooks: 0, completedBooks: 0, totalPages: 0 });

  const isOwnProfile = id === user?.id;

  useEffect(() => {
    if (id) {
      fetchProfile();
      fetchFriendship();
      fetchUserStats();
    }
  }, [id, user]);

  useEffect(() => {
    // If we're looking at our own profile and it fails to load from DB,
    // use the profile from AuthContext as a fallback
    if (isOwnProfile && myProfile && !targetProfile && !loading) {
      setTargetProfile(myProfile);
    }
  }, [isOwnProfile, myProfile, targetProfile, loading]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Profile fetch error:', error);
        // If it's my own profile and there's an error, we'll rely on the fallback effect
        if (!isOwnProfile) {
          setLoading(false);
          return;
        }
      } else {
        setTargetProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendship = async () => {
    if (isOwnProfile || !user) return;
    try {
      const { data } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${user.id})`)
        .maybeSingle();
      
      setFriendshipStatus(data?.status || null);
    } catch (err) {
      console.error('Friendship fetch error:', err);
    }
  };

  const fetchUserStats = async () => {
    try {
      const { data: books } = await supabase
        .from('books')
        .select('status')
        .eq('owner_id', id);
      
      const { data: logs } = await supabase
        .from('reading_logs')
        .select('pages_read')
        .eq('user_id', id);

      if (books) {
        setStats(prev => ({
          ...prev,
          totalBooks: books.length,
          completedBooks: books.filter(b => b.status === 'Selesai' || b.status === 'Completed').length
        }));
      }

      if (logs) {
        const total = logs.reduce((sum, log) => sum + (log.pages_read || 0), 0);
        setStats(prev => ({ ...prev, totalPages: total }));
      }
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  };

  const handleFriendAction = async () => {
    if (!myProfile || friendshipStatus === 'accepted' || friendshipStatus === 'pending') return;

    try {
      const { error } = await supabase
        .from('friends')
        .insert({ user_id: myProfile.id, friend_id: id, status: 'pending' });
      
      if (error) throw error;

      // Add Notification
      await supabase.from('notifications').insert({
        user_id: id,
        type: 'friend_request',
        title: 'Permintaan Pertemanan',
        content: `${myProfile.display_name} mengirimkan permintaan pertemanan.`,
        data: { sender_id: myProfile.id },
        is_read: false
      });

      setFriendshipStatus('pending');
      Swal.fire({
        icon: 'success',
        title: 'Permintaan Dikirim',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const handleReportUser = async () => {
    if (!user || !myProfile) return;

    const { value: formValues } = await Swal.fire({
      title: `<div class="text-xl font-black text-slate-900 mb-2">Laporkan @${targetProfile.username}</div>`,
      html: `
        <div class="text-left font-sans">
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Alasan Pelaporan</label>
          <select id="swal-reason" class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/10 mb-4 transition-all">
            <option value="Spam">Spam atau Iklan</option>
            <option value="Harassment">Pelecehan atau Bullying</option>
            <option value="Inappropriate Content">Konten Tidak Pantas</option>
            <option value="Other">Lainnya</option>
          </select>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ceritakan Masalahnya</label>
          <textarea id="swal-description" class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/10 h-32 transition-all" placeholder="Jelaskan secara singkat..."></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Kirim Laporan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#f1f5f9',
      customClass: {
        popup: 'rounded-[32px] border-none shadow-2xl',
        confirmButton: 'rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest',
        cancelButton: 'rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500'
      },
      preConfirm: () => {
        return {
          reason: (document.getElementById('swal-reason') as HTMLSelectElement).value,
          description: (document.getElementById('swal-description') as HTMLTextAreaElement).value
        };
      }
    });

    if (formValues) {
      try {
        const { error } = await supabase
          .from('reports')
          .insert({
            reporter_id: myProfile.id,
            reported_user_id: id,
            reason: formValues.reason,
            description: formValues.description,
            status: 'pending'
          });

        if (error) throw error;

        Swal.fire({
          icon: 'success',
          title: 'Laporan Diterima',
          text: 'Terima kasih telah menjaga komunitas kami tetap aman.',
          confirmButtonColor: '#000000',
        });
      } catch (err: any) {
        Swal.fire('Gagal Mengirim Laporan', err.message, 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-20 grayscale opacity-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="font-black text-[10px] uppercase tracking-[0.2em] text-primary">Memuat Profil...</p>
      </div>
    );
  }

  if (!targetProfile) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <AlertCircle size={64} className="mx-auto text-red-100 mb-6" />
        <h2 className="text-3xl font-extrabold text-slate-900">User Tidak Ditemukan</h2>
        <p className="text-slate-500 mt-4 font-medium mb-8">Maaf, profil yang Anda cari mungkin telah dihapus atau ID tidak valid.</p>
        <button onClick={() => navigate(-1)} className="px-10 py-4 bg-primary text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20">Kembali</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20 font-sans">
      <div className="mb-10 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-3 px-5 py-2.5 bg-white border border-tan-50 rounded-2xl text-slate-500 hover:text-primary transition-all font-bold text-xs shadow-sm hover:shadow-lg hover:shadow-slate-200/50"
        >
          <ArrowLeft size={16} /> Kembali
        </button>
        {isOwnProfile && (
          <Link 
            to="/app/user/profile" 
            className="p-3 bg-white border border-tan-50 rounded-2xl text-slate-400 hover:text-primary transition-all shadow-sm"
          >
            <Settings size={20} />
          </Link>
        )}
      </div>

      <div className="relative">
        {/* Profile Header Card */}
        <div className="bg-white rounded-[48px] border border-tan-50 shadow-2xl shadow-slate-200/50 overflow-hidden">
          <div className="h-44 bg-gradient-to-br from-tan-50 to-primary/5 relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          </div>
          
          <div className="px-10 pb-12 relative">
            <div className="flex flex-col md:flex-row md:items-end justify-between -mt-20 gap-8">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
                <div className="w-40 h-40 rounded-[40px] bg-white p-2 shadow-2xl shadow-slate-300 transition-transform hover:scale-105 duration-500">
                  <div className="w-full h-full rounded-[32px] bg-tan-50 flex items-center justify-center overflow-hidden border-2 border-tan-100/30">
                    {targetProfile.avatar_url ? (
                      <img src={targetProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={64} className="text-tan-200" />
                    )}
                  </div>
                </div>
                <div className="mb-2">
                  <div className="flex items-center gap-3 justify-center md:justify-start">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{targetProfile.display_name}</h1>
                    {targetProfile.role === 'admin' && <ShieldCheck size={24} className="text-primary" />}
                  </div>
                  <div className="flex items-center gap-3 mt-2 justify-center md:justify-start">
                    <span className="text-sm font-bold text-slate-400 font-mono">@{targetProfile.username}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="flex items-center gap-1.5 text-emerald-500 font-black text-[10px] uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Online
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isOwnProfile ? (
                  <div className="flex gap-2">
                     <div className="px-6 py-3.5 bg-tan-50 text-primary rounded-[24px] font-black text-xs uppercase tracking-widest border border-primary/10">Ini Profil Kamu ✨</div>
                  </div>
                ) : (
                  <>
                    {friendshipStatus === 'accepted' ? (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => navigate(`/app/user/chat?with=${id}`)}
                          className="px-8 py-4 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                          <MessageCircle size={18} /> Chat Teman
                        </button>
                        <button className="p-4 bg-slate-100 text-slate-400 rounded-[24px] hover:text-red-500 hover:bg-red-50 transition-all">
                          <UserMinus size={20} />
                        </button>
                      </div>
                    ) : friendshipStatus === 'pending' ? (
                      <div className="flex items-center gap-3">
                        <button className="px-8 py-4 bg-slate-100 text-slate-400 rounded-[24px] font-black text-xs uppercase tracking-widest cursor-default flex items-center gap-2">
                          <Clock size={18} /> Menunggu Persetujuan
                        </button>
                        <button 
                          onClick={() => handleReportUser()}
                          className="p-4 bg-slate-100 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-[24px] transition-all"
                          title="Laporkan Pengguna"
                        >
                          <AlertCircle size={20} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={handleFriendAction}
                          className="px-8 py-4 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 group"
                        >
                          <UserPlus size={18} className="group-hover:rotate-12 transition-transform" /> Tambah Teman
                        </button>
                        <button 
                          onClick={() => handleReportUser()}
                          className="p-4 bg-slate-100 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-[24px] transition-all"
                          title="Laporkan Pengguna"
                        >
                          <AlertCircle size={20} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-6 bg-tan-50/50 rounded-[32px] border border-tan-100/30 flex flex-col items-center justify-center text-center">
                 <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Buku Dibaca</span>
                 <span className="text-3xl font-extrabold text-slate-900">{stats.totalBooks}</span>
              </div>
              <div className="p-6 bg-indigo-50/50 rounded-[32px] border border-indigo-100/30 flex flex-col items-center justify-center text-center">
                 <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Selesai</span>
                 <span className="text-3xl font-extrabold text-slate-900">{stats.completedBooks}</span>
              </div>
              <div className="p-6 bg-slate-50/50 rounded-[32px] border border-slate-100/30 flex flex-col items-center justify-center text-center">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Halaman</span>
                 <span className="text-3xl font-extrabold text-slate-900">{stats.totalPages.toLocaleString()}</span>
              </div>
              <div className="p-6 bg-amber-50/50 rounded-[32px] border border-amber-100/30 flex flex-col items-center justify-center text-center">
                 <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Poin Literasi</span>
                 <span className="text-3xl font-extrabold text-slate-900">{stats.totalPages * 5}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Activity Column */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-10 rounded-[48px] border border-tan-50 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Aktivitas Membaca</h3>
                <Link to="/app/user/tracker" className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Lihat Semua</Link>
              </div>

              {targetProfile.last_read_book_title ? (
                <div className="p-8 bg-slate-900 rounded-[40px] text-white relative overflow-hidden group">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                       <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div> Active Now
                       </span>
                       <span className="text-[10px] font-bold text-white/40">Terakhir diperbarui hari ini</span>
                    </div>
                    <h4 className="text-2xl font-extrabold leading-tight">Sedang membaca <span className="text-primary italic">"{targetProfile.last_read_book_title}"</span></h4>
                    <p className="text-white/60 mt-2 font-medium">Baru saja mencapai halaman <span className="text-white font-bold">{targetProfile.last_read_page}</span>. Teruslah tumbuh!</p>
                    
                    <div className="mt-8 flex items-center gap-4">
                       <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                          <BookOpen className="text-white/50" />
                       </div>
                       <div className="flex-1">
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: '45%' }}
                               className="h-full bg-primary"
                             />
                          </div>
                       </div>
                    </div>
                  </div>
                  <Globe size={180} className="absolute -right-20 -bottom-20 text-white/5 group-hover:rotate-45 transition-transform duration-1000" />
                </div>
              ) : (
                <div className="py-20 text-center bg-tan-50/20 rounded-[40px] border border-dashed border-tan-100">
                  <BookOpen size={48} className="mx-auto text-tan-100 mb-4" />
                  <p className="text-slate-400 font-bold">Belum ada aktivitas membaca publik.</p>
                </div>
              )}
            </div>

            <div className="bg-white p-10 rounded-[48px] border border-tan-50 shadow-sm">
               <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-8">Pencapaian</h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="flex flex-col items-center text-center group">
                     <div className="w-20 h-20 bg-amber-50 rounded-[28px] flex items-center justify-center text-amber-500 mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                        <Award size={32} />
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pembaca Awal</span>
                  </div>
                  <div className="flex flex-col items-center text-center opacity-30 grayscale group">
                     <div className="w-20 h-20 bg-indigo-50 rounded-[28px] flex items-center justify-center text-indigo-500 mb-3 grayscale group-hover:grayscale-0 transition-all">
                        <Star size={32} />
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pecinta Novel</span>
                  </div>
                  <div className="flex flex-col items-center text-center opacity-30 grayscale group">
                     <div className="w-20 h-20 bg-emerald-50 rounded-[28px] flex items-center justify-center text-emerald-500 mb-3 grayscale group-hover:grayscale-0 transition-all">
                        <Layers size={32} />
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kolektor</span>
                  </div>
                  <div className="flex flex-col items-center text-center opacity-30 grayscale group">
                     <div className="w-20 h-20 bg-rose-50 rounded-[28px] flex items-center justify-center text-rose-500 mb-3 grayscale group-hover:grayscale-0 transition-all">
                        <Calendar size={32} />
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Konsisten</span>
                  </div>
               </div>
            </div>
          </div>

          {/* Social Stats Sidebar */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[40px] border border-tan-50 shadow-sm">
               <h4 className="text-lg font-extrabold text-slate-900 mb-6">Tentang @{targetProfile.username}</h4>
               <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  "Seorang pembaca setia yang percaya bahwa setiap halaman buku adalah petualangan baru yang menunggu untuk dijelajahi."
               </p>
               <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-xl bg-tan-50 flex items-center justify-center text-primary">
                        <Calendar size={14} />
                     </div>
                     <p className="text-xs font-bold text-slate-500">Bergabung {new Date(targetProfile.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-xl bg-tan-50 flex items-center justify-center text-primary">
                        <Globe size={14} />
                     </div>
                     <p className="text-xs font-bold text-slate-500">Bumi, Indonesia</p>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[40px] text-white overflow-hidden relative group">
               <div className="relative z-10">
                  <h4 className="text-lg font-extrabold mb-4">Level Literasi</h4>
                  <div className="flex items-end gap-2 mb-2">
                     <span className="text-4xl font-extrabold">Lv. 3</span>
                     <span className="text-white/40 font-bold mb-1 ml-1 tracking-widest text-xs">NOVICE</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full mt-4 overflow-hidden">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '65%' }}
                        className="h-full bg-primary"
                     />
                  </div>
                  <p className="text-[10px] font-bold text-white/40 mt-3 uppercase tracking-widest">340 p lagi ke Lv. 4</p>
               </div>
               <Award size={100} className="absolute -right-5 -bottom-5 text-white/5 group-hover:scale-110 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
