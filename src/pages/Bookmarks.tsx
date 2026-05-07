import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Heart, Search, BookOpen, Trash2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function Bookmarks() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchFavorites();

    const channel = supabase
      .channel('bookmarks_sync')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookmarks',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchFavorites();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select(`
          id,
          book_id,
          created_at,
          books (
            id,
            title,
            author,
            cover_url,
            genre,
            status
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setFavorites(data || []);
    } catch (err) {
      console.error("Error fetching favorites:", err);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (bookId: string) => {
    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('book_id', bookId)
        .eq('user_id', user?.id);
      
      if (error) throw error;
      
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Dihapus dari Favorit',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (err: any) {
      Swal.fire('Gagal', err.message, 'error');
    }
  };

  const filteredFavorites = favorites.filter(fav => 
    fav.books?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fav.books?.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-12 pb-20 font-sans">
      <header className="relative py-20 px-10 rounded-[60px] bg-slate-900 overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Heart size={20} fill="currentColor" />
            </div>
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Koleksi Spesial</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-black text-white leading-tight mb-8 tracking-tight"
          >
            Buku <br />
            <span className="text-primary italic">Favorit</span> Saya ⭐
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg font-medium mb-12 leading-relaxed max-w-md"
          >
            Kumpulan judul yang paling berkesan dan menginspirasi perjalanan membaca Anda.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative group max-w-md shadow-2xl"
          >
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/60 group-focus-within:text-primary transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Cari di favorit..."
              className="w-full pl-16 pr-8 py-6 bg-white border-none rounded-[32px] outline-none focus:ring-4 focus:ring-primary/20 text-sm font-bold transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </motion.div>
        </div>
        
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-10 pointer-events-none overflow-hidden">
           <Heart size={600} className="text-white absolute -right-40 -top-40 rotate-12" strokeWidth={0.5} />
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
           {[1,2,3,4].map(i => (
             <div key={i} className="aspect-[3/4] bg-slate-100 animate-pulse rounded-[48px]" />
           ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredFavorites.map((fav) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key={fav.id}
                className="group relative"
              >
                <div className="bg-white rounded-[48px] border border-tan-50 shadow-sm overflow-hidden hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 flex flex-col h-full">
                  <div className="relative aspect-[3/4.2] overflow-hidden">
                    <img 
                      src={fav.books?.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} 
                      alt={fav.books?.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-8">
                      <Link 
                        to={`/app/user/details/${fav.book_id}`}
                        className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all transform translate-y-4 group-hover:translate-y-0 duration-500"
                      >
                        Baca Detail <ArrowRight size={16} />
                      </Link>
                    </div>
                    <button 
                      onClick={() => removeFavorite(fav.book_id)}
                      className="absolute top-6 right-6 w-11 h-11 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-red-500 shadow-xl opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all hover:bg-red-500 hover:text-white"
                      title="Hapus dari Favorit"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  
                  <div className="p-8 space-y-4 flex-1 flex flex-col">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{fav.books?.genre}</span>
                      <h3 className="font-extrabold text-slate-900 text-lg leading-tight line-clamp-1">{fav.books?.title}</h3>
                      <p className="text-sm font-bold text-slate-400">Oleh {fav.books?.author}</p>
                    </div>
                    
                    <div className="pt-4 border-t border-tan-50 mt-auto flex items-center justify-between">
                       <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                          <BookOpen size={14} className="text-primary" /> {fav.books?.status || 'Active'}
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {!loading && filteredFavorites.length === 0 && (
        <div className="text-center py-40 bg-white rounded-[60px] border-2 border-dashed border-tan-100 space-y-8">
           <div className="w-24 h-24 bg-tan-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
              <Heart size={64} />
           </div>
           <div className="max-w-xs mx-auto space-y-4">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Belum ada buku favorit 📚</h3>
              <p className="text-slate-400 font-medium pb-4">Jelajahi perpustakaan dan tandai buku yang Anda sukai untuk menyimpannya di sini.</p>
              <Link 
                 to="/app/user/library"
                 className="px-10 py-4 bg-primary text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20 inline-block"
              >
                 Cari Buku
              </Link>
           </div>
        </div>
      )}
    </div>
  );
}
