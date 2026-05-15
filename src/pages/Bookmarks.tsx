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
    <div className="space-y-8 md:space-y-12 pb-20 font-sans px-1">
      <header className="relative py-12 md:py-20 px-6 md:px-10 rounded-[32px] md:rounded-[60px] bg-slate-900 overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-2xl px-1">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Heart size={16} md={20} fill="currentColor" />
            </div>
            <span className="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-[0.3em]">Koleksi Utama</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-6xl font-black text-white leading-tight mb-6 md:mb-8 tracking-tight"
          >
            Buku <br />
            <span className="text-primary italic">Favorit</span> Anda ⭐
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-xs md:text-lg font-medium mb-8 md:mb-12 leading-relaxed max-w-xs md:max-w-md"
          >
            Kumpulan judul yang paling berkesan bagi Anda.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative group max-w-xs md:max-w-md shadow-2xl"
          >
            <Search className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 text-primary/60 group-focus-within:text-primary transition-colors" size={18} md={20} />
            <input 
              type="text" 
              placeholder="Cari favorit..."
              className="w-full pl-12 md:pl-16 pr-6 md:pr-8 py-4 md:py-6 bg-white border-none rounded-2xl md:rounded-[32px] outline-none focus:ring-4 focus:ring-primary/20 text-xs md:text-sm font-bold transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </motion.div>
        </div>
        
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-10 pointer-events-none overflow-hidden">
           <Heart size={400} md={600} className="text-white absolute -right-20 md:-right-40 -top-20 md:-top-40 rotate-12" strokeWidth={0.5} />
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
           {[1,2,3,4].map(i => (
             <div key={i} className="aspect-[3/4.2] bg-slate-100 animate-pulse rounded-3xl md:rounded-[48px]" />
           ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
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
                <div className="bg-white rounded-3xl md:rounded-[48px] border border-tan-50 shadow-sm overflow-hidden hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] transition-all duration-500 flex flex-col h-full hover:-translate-y-2 hover:scale-[1.02]">
                  <div className="relative aspect-[3/4.2] overflow-hidden">
                    <img 
                      src={fav.books?.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} 
                      alt={fav.books?.title} 
                      className="w-full h-full object-cover group-hover:scale-105 duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4 md:p-8">
                      <Link 
                        to={`/app/user/details/${fav.book_id}`}
                        className="w-full py-3 md:py-4 bg-white text-slate-900 rounded-xl md:rounded-2xl font-black text-[8px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 md:gap-2 hover:bg-primary hover:text-white transition-all transform translate-y-4 md:group-hover:translate-y-0 duration-500"
                      >
                        Detail <ArrowRight size={14} md={16} />
                      </Link>
                    </div>
                    
                    <Link to={`/app/user/details/${fav.book_id}`} className="absolute inset-0 md:hidden z-10" />

                    <button 
                      onClick={() => removeFavorite(fav.book_id)}
                      className="absolute top-3 right-3 md:top-6 md:right-6 w-8 h-8 md:w-11 md:h-11 bg-white/90 backdrop-blur-md rounded-lg md:rounded-2xl flex items-center justify-center text-red-500 shadow-xl opacity-100 md:opacity-0 md:scale-75 md:group-hover:opacity-100 md:group-hover:scale-100 transition-all hover:bg-red-500 hover:text-white z-20"
                      title="Hapus dari Favorit"
                    >
                      <Trash2 size={16} md={20} />
                    </button>
                  </div>
                  
                  <div className="p-4 md:p-8 space-y-2 md:space-y-4 flex-1 flex flex-col">
                    <div className="space-y-1">
                      <span className="text-[7px] md:text-[10px] font-black text-primary uppercase tracking-[0.2em] truncate block">{fav.books?.genre}</span>
                      <h3 className="font-extrabold text-slate-900 text-sm md:text-lg leading-tight line-clamp-1">{fav.books?.title}</h3>
                      <p className="text-[10px] md:text-sm font-bold text-slate-400 truncate">Oleh {fav.books?.author}</p>
                    </div>
                    
                    <div className="pt-3 md:pt-4 border-t border-tan-50 mt-auto flex items-center justify-between">
                       <div className="flex items-center gap-1.5 md:gap-2 text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest truncate">
                          <BookOpen size={12} md={14} className="text-primary shrink-0" /> {fav.books?.status || 'Active'}
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
