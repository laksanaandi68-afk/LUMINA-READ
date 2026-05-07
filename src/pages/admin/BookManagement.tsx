import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Pencil, Trash2, X, Upload, Save, Book as BookIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

interface Book {
  id?: string;
  title: string;
  author: string;
  genre: string;
  synopsis: string;
  content: string;
  cover_url: string;
}

export default function BookManagement() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Book>({
    title: '',
    author: '',
    genre: 'Fiksi',
    synopsis: '',
    content: '',
    cover_url: '',
  });

  const genres = ['Fiksi', 'Non-Fiksi', 'Sci-Fi', 'Fantasi', 'Romansa', 'Misteri', 'Sejarah', 'Bantuan Diri'];

  useEffect(() => {
    fetchBooks();

    const channel = supabase
      .channel('realtime_books')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, fetchBooks)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('books')
        .select(`
          id, title, author, genre, synopsis, content, cover_url, created_at, owner_id,
          profiles:owner_id (display_name, email)
        `)
        .order('title');
      
      if (error) throw error;
      setBooks(data as any[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('books')
          .update({
            title: formData.title,
            author: formData.author,
            genre: formData.genre,
            synopsis: formData.synopsis,
            content: formData.content,
            cover_url: formData.cover_url,
          })
          .eq('id', editingId);
        
        if (error) throw error;
        
        Swal.fire({
          title: 'Diperbarui!',
          text: 'Detail buku berhasil diperbarui.',
          icon: 'success',
          confirmButtonColor: '#D2B48C'
        });
      } else {
        const { error } = await supabase
          .from('books')
          .insert({
            title: formData.title,
            author: formData.author,
            genre: formData.genre,
            synopsis: formData.synopsis,
            content: formData.content,
            cover_url: formData.cover_url,
            rating: 4.5,
            review_count: 0
          });
        
        if (error) throw error;

        Swal.fire({
          title: 'Berhasil!',
          text: 'Buku baru ditambahkan ke perpustakaan.',
          icon: 'success',
          confirmButtonColor: '#D2B48C'
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchBooks();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const handleEdit = (book: Book) => {
    setEditingId(book.id!);
    setFormData({ ...book });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus buku ini?',
      text: "Tindakan ini tidak dapat dibatalkan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, hapus!'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('books')
          .delete()
          .eq('id', id);
        
        if (error) throw error;

        Swal.fire({
          title: 'Dihapus!',
          text: 'Buku telah dihapus.',
          icon: 'success',
          confirmButtonColor: '#D2B48C'
        });
        fetchBooks();
      } catch (err: any) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  const resetForm = () => {
    setFormData({ title: '', author: '', genre: 'Fiksi', synopsis: '', content: '', cover_url: '' });
    setEditingId(null);
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center bg-white p-10 rounded-[40px] border border-tan-50 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Manajemen Buku</h1>
          <p className="text-sm text-slate-400 font-medium mt-2">Kurasi dan kelola koleksi perpustakaan digital LuminaRead.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="relative z-10 flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-[24px] font-bold hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 active:scale-95"
        >
          <Plus size={22} /> Tambah Rilisan Baru
        </button>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-tan-50 rounded-full blur-[80px] pointer-events-none opacity-40"></div>
      </div>

      <div className="bg-white rounded-[40px] border border-tan-50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-tan-50/50 border-b border-tan-50 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              <tr>
                <th className="px-10 py-6">Judul Buku</th>
                <th className="px-10 py-6">Genre</th>
                <th className="px-10 py-6">Pengunggah</th>
                <th className="px-10 py-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tan-50">
              {books.map((book) => (
                <tr key={book.id} className="hover:bg-tan-50/30 transition-colors group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0 shadow-sm border border-white">
                        <img src={book.cover_url || 'https://via.placeholder.com/100x140?text=Cover'} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      </div>
                      <span className="font-bold text-slate-900 text-sm tracking-tight">{book.title}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <span className="px-4 py-1.5 bg-tan-50 text-primary border border-primary/5 rounded-full text-[10px] font-bold uppercase tracking-widest">{book.genre}</span>
                  </td>
                  <td className="px-10 py-6">
                     <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{(book as any).profiles?.display_name || 'System'}</span>
                        <span className="text-[10px] text-slate-400 font-medium tracking-tight">{(book as any).profiles?.email || 'lumina@internal'}</span>
                     </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => handleEdit(book)} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-primary hover:text-white rounded-xl text-slate-300 transition-all border border-tan-50 shadow-sm">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => handleDelete(book.id!)} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-red-500 hover:text-white rounded-xl text-slate-300 transition-all border border-tan-50 shadow-sm">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {books.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-10 py-20 text-center text-slate-300 font-medium italic">Perpustakaan Anda saat ini kosong. Mulailah dengan menambahkan buku baru yang ajaib.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 40 }}
              className="relative w-full max-w-2xl bg-white rounded-[48px] shadow-3xl p-12 overflow-hidden max-h-[90vh] flex flex-col border border-tan-50"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{editingId ? 'Sunting Publikasi' : 'Publikasi Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-tan-50 text-slate-400 hover:text-primary rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8 overflow-y-auto flex-1 pr-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">Judul Buku</label>
                    <input 
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-[24px] outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all font-medium"
                      placeholder="misal: Whispers of the Wind"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">Nama Penulis</label>
                    <input 
                      required
                      value={formData.author}
                      onChange={(e) => setFormData({...formData, author: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-[24px] outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all font-medium"
                      placeholder="misal: Julian Harper"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">Genre Sastra</label>
                    <select 
                      value={formData.genre}
                      onChange={(e) => setFormData({...formData, genre: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-[24px] outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all font-bold appearance-none cursor-pointer"
                    >
                      {genres.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">URL Karya Seni Sampul</label>
                    <div className="relative">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary">
                         <Upload size={18} />
                      </div>
                      <input 
                        value={formData.cover_url}
                        onChange={(e) => setFormData({...formData, cover_url: e.target.value})}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-tan-50 rounded-[24px] outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all font-medium"
                        placeholder="https://artwork.link/cover.jpg"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">Sinopsis Narasi</label>
                  <textarea 
                    rows={4}
                    value={formData.synopsis}
                    onChange={(e) => setFormData({...formData, synopsis: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-[24px] outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all resize-none font-medium"
                    placeholder="Jelaskan secara singkat jiwa dari buku ini..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">Konten Manuskrip</label>
                  <textarea 
                    rows={12}
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    className="w-full px-8 py-6 bg-slate-50 border border-tan-50 rounded-[32px] outline-none focus:ring-2 focus:ring-primary/20 text-base transition-all resize-none font-serif leading-relaxed"
                    placeholder="Buka ceritanya di sini..."
                  />
                </div>

                <div className="pt-6 flex gap-4 sticky bottom-0 bg-white pb-2">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-5 bg-slate-50 text-slate-400 rounded-[24px] font-bold hover:bg-slate-100 transition-all border border-tan-50"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] py-5 bg-primary text-white rounded-[24px] font-bold hover:bg-primary-dark transition-all flex items-center justify-center gap-3 shadow-2xl shadow-primary/30"
                  >
                    <Save size={22} /> {editingId ? 'Simpan Perubahan' : 'Publikasikan ke Perpustakaan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
