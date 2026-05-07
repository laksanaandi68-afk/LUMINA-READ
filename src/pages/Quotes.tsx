import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Quote as QuoteIcon, Trash2, Search, Plus, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function Quotes() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuote, setNewQuote] = useState({ content: '', book_id: '', author_name: '' });

  useEffect(() => {
    if (!user) return;
    
    fetchQuotes();
    fetchBooks();

    const channel = supabase
      .channel('quotes_sync')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'quotes',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchQuotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`*, books (title)`)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setQuotes(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBooks = async () => {
    const { data } = await supabase.from('books').select('id, title').eq('owner_id', user?.id);
    setBooks(data || []);
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuote.content || !newQuote.book_id) {
      Swal.fire('Error', 'Harap isi kutipan dan pilih buku!', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('quotes').insert({
        ...newQuote,
        user_id: user?.id
      });

      if (error) throw error;

      Swal.fire('Berhasil!', 'Kutipan telah disimpan.', 'success');
      setShowAddModal(false);
      setNewQuote({ content: '', book_id: '', author_name: '' });
      fetchQuotes();
    } catch (err: any) {
      Swal.fire('Gagal', err.message, 'error');
    }
  };

  const deleteQuote = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Kutipan?',
      text: "Kutipan ini akan dihapus secara permanen.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (!error) {
        setQuotes(quotes.filter(q => q.id !== id));
        Swal.fire('Dihapus!', '', 'success');
      }
    }
  };

  const filteredQuotes = quotes.filter(q => 
    q.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.books?.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-12 pb-20 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Kutipan Favorit</h1>
          <p className="text-slate-500 font-medium">Kumpulan kata-kata bijak dari buku-buku yang Anda cintai.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-8 py-4 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-primary/20 hover:scale-105 transition-all"
        >
          <Plus size={18} /> Tambah Kutipan
        </button>
      </header>

      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
        <input 
          type="text" 
          placeholder="Cari kutipan atau judul buku..."
          className="w-full pl-16 pr-8 py-5 bg-white border border-tan-50 rounded-[32px] outline-none focus:ring-4 focus:ring-primary/10 text-sm font-bold transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
        <AnimatePresence>
          {filteredQuotes.map((quote) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={quote.id}
              className="break-inside-avoid bg-white p-10 rounded-[48px] border border-tan-50 shadow-sm hover:shadow-2xl transition-all group relative"
            >
              <div className="absolute top-8 left-8 text-primary/10 scale-[3]">
                <QuoteIcon size={24} fill="currentColor" />
              </div>
              <div className="relative z-10 space-y-6">
                <p className="text-lg font-black text-slate-800 leading-relaxed italic">
                  "{quote.content}"
                </p>
                <div className="pt-6 border-t border-tan-50">
                  <p className="text-xs font-black text-primary uppercase tracking-widest">{quote.books?.title}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">— {quote.author_name || 'Buku Anda'}</p>
                </div>
              </div>
              <button 
                onClick={() => deleteQuote(quote.id)}
                className="absolute top-8 right-8 p-3 bg-red-50 text-red-500 rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all shadow-lg"
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             onClick={() => setShowAddModal(false)}
             className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
           />
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="relative z-10 w-full max-w-lg bg-white rounded-[48px] shadow-3xl p-10 space-y-8 border border-tan-50"
           >
              <div className="flex justify-between items-center">
                 <h3 className="text-2xl font-black text-slate-900 tracking-tight">Simpan Kutipan</h3>
                 <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
              </div>

              <form onSubmit={handleAddQuote} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Buku</label>
                    <select 
                      value={newQuote.book_id}
                      onChange={(e) => setNewQuote({ ...newQuote, book_id: e.target.value })}
                      className="w-full p-4 bg-tan-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    >
                       <option value="">Pilih dari koleksi Anda</option>
                       {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </select>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kutipan</label>
                    <textarea 
                      rows={4}
                      placeholder="Apa yang membuat bagian ini istimewa?"
                      value={newQuote.content}
                      onChange={(e) => setNewQuote({ ...newQuote, content: e.target.value })}
                      className="w-full p-6 bg-tan-50 border-none rounded-[32px] font-medium text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none italic"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Penulis (Opsional)</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: J.R.R. Tolkien"
                      value={newQuote.author_name}
                      onChange={(e) => setNewQuote({ ...newQuote, author_name: e.target.value })}
                      className="w-full p-4 bg-tan-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                 </div>

                 <button type="submit" className="w-full py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all flex items-center justify-center gap-3">
                    <Save size={18} /> Simpan Selamanya
                 </button>
              </form>
           </motion.div>
        </div>
      )}

     {!loading && filteredQuotes.length === 0 && (
        <div className="text-center py-40 bg-white rounded-[48px] border-2 border-dashed border-tan-100">
           <QuoteIcon size={64} className="mx-auto text-tan-50 mb-6" />
           <h3 className="text-xl font-black text-slate-900 mb-2">Belum ada kutipan</h3>
           <p className="text-slate-400 font-medium text-sm">Bagian buku mana yang paling berkesan bagi Anda? Simpan di sini.</p>
        </div>
      )}
    </div>
  );
}
