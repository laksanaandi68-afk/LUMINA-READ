import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Trash2, Search, Filter, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string;
    email: string;
    avatar_url: string;
  };
}

export default function CommunityManagement() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('community_moderation')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(display_name, email, avatar_url)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Posts fetch error:", error);
    } else {
      setPosts(data as any[]);
    }
    setLoading(false);
  };

  const handleDeletePost = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Kiriman?',
      text: "Konten ini akan dihapus secara permanen dari feed komunitas.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, Hapus Kiriman'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('posts')
          .delete()
          .eq('id', id);

        if (error) throw error;
        Swal.fire('Dihapus', 'Kiriman telah dihapus.', 'success');
      } catch (err: any) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  const filteredPosts = posts.filter(p => 
    p.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.profiles?.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Moderasi Komunitas</h1>
          <p className="text-sm text-slate-500 font-medium mt-2">Awasi dan pelihara lingkungan wacana sastra yang sehat.</p>
        </div>
        <div className="relative w-full md:w-96 z-10 flex gap-4">
           <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
              <input 
                 type="text" 
                 placeholder="Cari kiriman atau penulis..."
                 className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <button className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-primary border border-slate-100 rounded-2xl transition-all">
              <Filter size={20} />
           </button>
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-tan-100 rounded-full blur-[80px] pointer-events-none opacity-40"></div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence initial={false}>
          {loading ? (
            <div className="p-20 text-center animate-pulse flex flex-col items-center gap-4 text-slate-300">
               <Clock size={48} />
               <p className="font-bold uppercase tracking-widest text-xs">Menyinkronkan Aset Feed...</p>
            </div>
          ) : filteredPosts.map((post) => (
            <motion.div 
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex flex-col md:flex-row gap-6">
                 <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-white shadow-sm flex items-center justify-center text-slate-400">
                             {post.profiles?.avatar_url ? (
                               <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                             ) : <MessageSquare size={20} />}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-slate-900 leading-none">{post.profiles?.display_name || 'Anonim'}</p>
                             <p className="text-[10px] text-slate-400 font-medium mt-1">{post.profiles?.email}</p>
                          </div>
                       </div>
                       <span className="text-[10px] font-bold text-slate-400 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full">
                          <Clock size={12} /> {new Date(post.created_at).toLocaleString()}
                       </span>
                    </div>

                    <div className="bg-tan-50/50 p-6 rounded-[24px] border border-tan-50 relative overflow-hidden">
                       <p className="text-slate-700 leading-relaxed text-sm font-medium relative z-10 italic">
                         "{post.content}"
                       </p>
                       <MessageSquare className="absolute -right-4 -bottom-4 text-slate-200 opacity-20" size={80} />
                    </div>
                 </div>

                 <div className="md:w-48 flex md:flex-col justify-end md:justify-center items-center gap-4">
                    <button 
                      onClick={() => handleDeletePost(post.id)}
                      className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-500 rounded-2xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all w-full justify-center"
                    >
                       <Trash2 size={16} /> Hapus Konten
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-400 rounded-2xl text-xs font-bold hover:bg-slate-100 transition-all w-full justify-center">
                       <AlertCircle size={16} /> Tandai Pengguna
                    </button>
                 </div>
              </div>
            </motion.div>
          ))}

          {filteredPosts.length === 0 && !loading && (
             <div className="p-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                <p className="text-slate-300 font-medium italic">Konten tidak ditemukan di segmen frekuensi ini.</p>
             </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
