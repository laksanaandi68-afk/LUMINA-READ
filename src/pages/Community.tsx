import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Heart, Share2, Send, BookOpen, Sparkles, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function Community() {
  const { user, profile, isAdmin } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('community_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !profile) return;

    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: profile.id,
          content: newPost,
          likes: 0
        });
      
      if (error) throw error;

      setNewPost('');
      // fetchPosts handle by subscription
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Pemikiran dibagikan!',
        showConfirmButton: false,
        timer: 3000,
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const result = await Swal.fire({
      title: 'Hapus kiriman?',
      text: "Anda tidak akan dapat mengembalikan ini!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, hapus!'
    });

    if (result.isConfirmed) {
      await supabase.from('posts').delete().eq('id', postId);
      Swal.fire('Dihapus!', 'Kiriman telah dihapus.', 'success');
    }
  };

  const handleReportUser = async (targetUser: any) => {
    if (!user) return;

    const { value: formValues } = await Swal.fire({
      title: `<div class="text-xl font-black text-slate-900 mb-2">Laporkan @${targetUser.username}</div>`,
      html: `
        <div class="text-left font-sans">
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Alasan</label>
          <select id="swal-reason" class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/10 mb-4 transition-all">
            <option value="Spam">Spam / Konten Tidak Pantas</option>
            <option value="Harassment">Pelecehan / Kata-kata Kasar</option>
            <option value="Inappropriate">Gambar / Konten Sensitif</option>
            <option value="Other">Lainnya</option>
          </select>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ceritakan Masalahnya</label>
          <textarea id="swal-description" class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/10 h-24 transition-all" placeholder="Detail laporan..."></textarea>
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
        const { error } = await supabase.from('reports').insert({
          reporter_id: user.id,
          reported_user_id: targetUser.id,
          reason: formValues.reason,
          description: formValues.description,
          status: 'pending'
        });

        if (error) throw error;

        Swal.fire({
          icon: 'success',
          title: 'Terima Kasih',
          text: 'Laporan Anda telah kami terima untuk peninjauan lebih lanjut.',
          confirmButtonColor: '#000000',
        });
      } catch (err: any) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Lingkaran Pembaca</h1>
        <p className="text-slate-500 font-medium italic mt-2">Terhubung dengan sesama pencinta buku dari seluruh dunia.</p>
      </header>

      <section className="bg-white p-8 rounded-[40px] border border-tan-50 shadow-sm relative overflow-hidden">
        <div className="flex gap-6 relative z-10">
           <div className="w-12 h-12 rounded-2xl bg-tan-50 flex items-center justify-center text-primary font-bold shrink-0 shadow-sm border border-primary/5">
              {profile?.display_name?.[0] || 'U'}
           </div>
           <form onSubmit={handlePost} className="flex-1 space-y-4">
              <textarea 
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Apa yang Anda pikirkan? Bagikan penemuan bacaan terbaru Anda..."
                className="w-full bg-slate-50 border-none rounded-3xl p-6 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none h-32 font-medium placeholder:text-slate-300 shadow-inner"
              />
              <div className="flex justify-between items-center">
                 <div className="flex gap-1 lg:gap-3">
                    <button type="button" className="p-2.5 text-slate-400 hover:text-primary transition-all hover:bg-tan-50 rounded-xl">
                       <BookOpen size={20} />
                    </button>
                    <button type="button" className="p-2.5 text-slate-400 hover:text-primary transition-all hover:bg-tan-50 rounded-xl">
                       <Sparkles size={20} />
                    </button>
                    {isAdmin && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-500 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-indigo-100 italic">
                        <ShieldCheck size={14} /> Mode Moderator
                      </div>
                    )}
                 </div>
                 <button 
                  type="submit" 
                  disabled={!newPost.trim()}
                  className="px-8 py-3 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95"
                >
                    Bagikan <Send size={18} />
                 </button>
              </div>
           </form>
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-tan-50 rounded-full blur-[80px] pointer-events-none"></div>
      </section>

      <div className="space-y-6">
        {loading ? [1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-[40px]"></div>) : (
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <motion.div 
                key={post.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-8 rounded-[40px] border border-tan-50 shadow-sm hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group relative"
              >
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-tan-50 flex items-center justify-center text-primary font-bold shadow-sm border border-primary/5 overflow-hidden">
                          {post.profiles?.avatar_url ? (
                            <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            post.profiles?.display_name?.[0] || 'U'
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <h4 className="font-extrabold text-slate-900 text-base leading-none tracking-tight">{post.profiles?.display_name || 'Anonim'}</h4>
                             {post.user_id === profile?.id && <span className="text-[8px] font-black uppercase text-tan-500 bg-tan-50 px-2 py-0.5 rounded leading-none">Anda</span>}
                          </div>
                          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                              <Clock size={10} />
                            {post.created_at ? `${new Date(post.created_at).toLocaleDateString()} • ${new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Baru saja'}
                          </p>
                        </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {post.user_id !== user?.id && (
                        <button 
                          onClick={() => handleReportUser(post.profiles)}
                          className="p-3 text-slate-200 hover:text-rose-500 transition-all hover:bg-rose-50 rounded-2xl"
                          title="Laporkan User"
                        >
                           <AlertCircle size={20} />
                        </button>
                      )}
                      {(isAdmin || post.user_id === profile?.id) && (
                        <button 
                          onClick={() => handleDeletePost(post.id)}
                          className="p-3 text-slate-200 hover:text-red-500 transition-all hover:bg-red-50 rounded-2xl"
                        >
                           <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                </div>
                <p className="text-slate-600 text-lg leading-relaxed mb-8 font-serif italic">
                    "{post.content}"
                </p>
                <div className="flex items-center gap-8 border-t border-tan-100/50 pt-6">
                    <button className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors text-[10px] font-bold uppercase tracking-[0.2em]">
                        <Heart size={18} className="text-red-400/50" /> {post.likes} Suka
                    </button>
                    <button className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors text-[10px] font-bold uppercase tracking-[0.2em]">
                        <MessageSquare size={18} className="text-blue-400/50" /> Komentar
                    </button>
                    <button className="ml-auto text-slate-300 hover:text-slate-900 transition-colors bg-tan-50 p-3 rounded-2xl">
                        <Share2 size={18} />
                    </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function Clock({ size, className }: any) {
  return (
    <svg 
      width={size} 
      height={size} 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
