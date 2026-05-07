import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, BookOpen, Star, Filter, Heart, ChevronRight, Plus, Trash2, Library as LibraryIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [favoriteBookIds, setFavoriteBookIds] = useState<Set<string>>(new Set());

  const genres = ['Semua', 'Fiksi', 'Non-Fiksi', 'Sci-Fi', 'Fantasi', 'Romansa', 'Misteri', 'Sejarah', 'Pengembangan Diri'];
  const statuses = ['Semua', 'Belum Dimulai', 'Sedang Dibaca', 'Selesai'];

  useEffect(() => {
    if (!user) return;
    
    fetchBooks();

    const channel = supabase
      .channel('library_sync')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'books',
        filter: `owner_id=eq.${user.id}`
      }, () => {
        fetchBooks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      // Specifically select columns that are most likely to exist, 
      // adding a try-catch pattern for robustness
      const { data, error } = await supabase
        .from('books')
        .select('id, title, author, genre, synopsis, cover_url, created_at, owner_id, status, total_pages')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        // Fallback: try minimal possible columns if the above fails
        const { data: minimalData, error: minimalError } = await supabase
          .from('books')
          .select('id, title, author')
          .eq('owner_id', user?.id);
          
        if (minimalError) throw minimalError;
        setBooks(minimalData || []);
      } else {
        setBooks(data || []);
      }

      // Fetch favorites
      const { data: bookmarksData } = await supabase
        .from('bookmarks')
        .select('book_id')
        .eq('user_id', user?.id);
      
      setFavoriteBookIds(new Set(bookmarksData?.map(b => b.book_id) || []));
    } catch (err) {
      console.error('Fetch Books Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const result = await Swal.fire({
      title: 'Hapus buku?',
      text: "Data buku dan progres membaca Anda akan hilang secara permanen!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from('books').delete().eq('id', id);
        if (error) throw error;
        setBooks(books.filter(b => b.id !== id));
        Swal.fire('Terhapus!', 'Buku telah dihapus dari koleksi Anda.', 'success');
      } catch (err: any) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  const handleToggleBookmark = async (bookId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    const isFav = favoriteBookIds.has(bookId);
    try {
      if (isFav) {
        await supabase.from('bookmarks').delete().eq('book_id', bookId).eq('user_id', user.id);
        const newFavs = new Set(favoriteBookIds);
        newFavs.delete(bookId);
        setFavoriteBookIds(newFavs);
      } else {
        await supabase.from('bookmarks').insert({ user_id: user.id, book_id: bookId });
        const newFavs = new Set(favoriteBookIds);
        newFavs.add(bookId);
        setFavoriteBookIds(newFavs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredBooks = books.filter(book => {
    const title = book.title || '';
    const author = book.author || '';
    const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'Semua' || book.genre === selectedGenre;
    const matchesStatus = selectedStatus === 'Semua' || 
                         book.status === selectedStatus || 
                         (selectedStatus === 'Belum Dimulai' && book.status === 'Not Started') ||
                         (selectedStatus === 'Sedang Dibaca' && book.status === 'In Progress') ||
                         (selectedStatus === 'Selesai' && book.status === 'Completed');
    return matchesSearch && matchesGenre && matchesStatus;
  });

  return (
    <div className="space-y-12 pb-20 font-sans">
      {/* Search & Hero Section */}
      <header className="relative py-16 px-10 rounded-[48px] bg-slate-900 overflow-hidden shadow-2xl shadow-slate-200">
        <div className="relative z-10 max-w-2xl">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl md:text-5xl font-black text-white leading-tight mb-6 tracking-tight"
          >
            Koleksi Buku <br />
            <span className="text-primary">Pribadi Anda</span>
          </motion.h1>
          <p className="text-slate-400 text-lg font-medium mb-10 leading-relaxed max-w-sm">
            Kelola perpustakaan digital Anda, lacak progres, dan simpan kenangan membaca.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-xl">
            <div className="relative group flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/60 group-focus-within:text-primary transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Cari judul atau penulis..."
                className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-[28px] outline-none focus:ring-4 focus:ring-primary/20 text-sm font-bold transition-all shadow-2xl placeholder:text-slate-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => navigate('/app/user/add-book')}
              className="px-8 py-5 bg-primary text-white rounded-[28px] font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Tambah Buku
            </button>
          </div>
        </div>
        
        {/* Dekorasi */}
        <div className="absolute right-[-5%] top-[-10%] w-[40%] h-[120%] bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute right-20 bottom-10 opacity-10 pointer-events-none hidden md:block">
           <LibraryIcon size={240} className="text-white" strokeWidth={0.5} />
        </div>
      </header>

      {/* Filter */}
      <div className="space-y-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between px-2">
             <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <Filter size={18} className="text-primary" /> Filter Kategori
             </h3>
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-tan-50 px-3 py-1 rounded-full border border-primary/10">
               {filteredBooks.length} Buku ditemukan
             </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            {genres.map(genre => (
              <button 
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-8 py-3.5 rounded-2xl text-[13px] font-black whitespace-nowrap transition-all duration-300 ${
                  selectedGenre === genre 
                  ? 'bg-primary text-white shadow-xl shadow-primary/20 -translate-y-1' 
                  : 'bg-white text-slate-500 border border-tan-50 hover:bg-tan-50 hover:text-primary'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between px-2">
             <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <BookOpen size={18} className="text-primary" /> Status Membaca
             </h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            {statuses.map(status => (
              <button 
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-8 py-3.5 rounded-2xl text-[13px] font-black whitespace-nowrap transition-all duration-300 ${
                  selectedStatus === status 
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 -translate-y-1' 
                  : 'bg-white text-slate-500 border border-tan-50 hover:bg-tan-50 hover:text-primary'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Book Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 px-2">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="animate-pulse space-y-6">
              <div className="aspect-[3/4.2] bg-slate-100 rounded-[36px]"></div>
              <div className="space-y-3 px-4">
                <div className="h-4 bg-slate-100 rounded-full w-full"></div>
                <div className="h-3 bg-slate-100 rounded-full w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-8 gap-y-12 px-2">
          <AnimatePresence mode="popLayout">
            {filteredBooks.map((book, index) => (
              <motion.div
                key={book.id}
                layout
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="group relative"
              >
                <div className="relative">
                  <div 
                    onClick={() => navigate(`/app/user/details/${book.id}`)} 
                    className="block cursor-pointer"
                  >
                    <div className="aspect-[3/4.2] bg-white rounded-[36px] overflow-hidden relative shadow-sm border border-tan-50 group-hover:shadow-2xl group-hover:shadow-tan-100 group-hover:border-primary/20 transition-all duration-700 group-hover:-translate-y-4">
                      <img 
                        src={book.cover_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'} 
                        alt={book.title} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-1000"
                      />
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6 gap-3">
                         <button 
                           onClick={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             navigate(`/app/user/book/${book.id}`);
                           }}
                           className="w-full bg-orange-400 text-white py-4 rounded-2xl flex items-center justify-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 shadow-xl shadow-orange-100 font-bold text-xs"
                         >
                            <Heart size={16} fill="currentColor" /> 
                            Catatan Saya
                         </button>
                         <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl flex items-center justify-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 shadow-2xl">
                            <span className="text-[11px] font-black text-slate-900 uppercase">Lihat Detail</span>
                         </div>
                      </div>

                      {/* Favorite Toggle Button */}
                      <button 
                        onClick={(e) => handleToggleBookmark(book.id, e)}
                        className={`absolute top-4 left-4 w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-xl backdrop-blur-md z-30 opacity-0 group-hover:opacity-100 ${
                          favoriteBookIds.has(book.id) 
                            ? 'bg-primary text-white scale-100' 
                            : 'bg-white/90 text-slate-400 hover:text-primary scale-75 group-hover:scale-100'
                        }`}
                      >
                        <Heart size={20} fill={favoriteBookIds.has(book.id) ? 'currentColor' : 'none'} />
                      </button>

                      {/* Status Tags */}
                      <div className="absolute top-4 right-4 flex flex-col gap-2">
                         <div className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest shadow-sm backdrop-blur-md ${
                           (book.status || 'Belum Dimulai') === 'Selesai' ? 'bg-emerald-500/90 text-white' :
                           (book.status || 'Belum Dimulai') === 'Sedang Dibaca' ? 'bg-primary/90 text-white' : 'bg-white/90 text-slate-400'
                         }`}>
                            {book.status || 'Belum Dimulai'}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Book Info */}
                <div className="mt-7 px-2">
                  <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] block mb-2">{book.genre}</span>
                  <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors text-base line-clamp-1 mb-1 tracking-tight">{book.title}</h4>
                  <p className="text-xs font-bold text-slate-400">Oleh {book.author}</p>
                </div>

                {/* Delete Action */}
                <div className="absolute -top-2 -left-2 z-20 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={(e) => handleDelete(book.id, e)}
                    className="w-10 h-10 bg-white rounded-full border border-tan-50 flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 hover:scale-110 transition-all shadow-xl"
                  >
                     <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBooks.length === 0 && (
        <div className="text-center py-40 bg-white rounded-[48px] border border-tan-50 shadow-sm">
           <div className="w-24 h-24 bg-tan-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 text-primary/20 border border-primary/10">
              <BookOpen size={48} />
           </div>
           <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Koleksi Anda Kosong</h3>
           <p className="text-slate-400 font-medium mb-10 max-w-sm mx-auto">Mulai petualangan membaca Anda dengan menambahkan buku pertama ke koleksi pribadi Anda.</p>
           <button 
             onClick={() => navigate('/app/user/add-book')} 
             className="px-10 py-4 bg-primary text-white rounded-[24px] font-bold text-sm hover:bg-primary-dark shadow-xl shadow-primary/20 transition-all flex items-center gap-2 mx-auto"
           >
             <Plus size={18} /> Tambah Buku Sekarang
           </button>
        </div>
      )}
    </div>
  );
}
