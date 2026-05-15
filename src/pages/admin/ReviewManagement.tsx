import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Trash2, Clock, Star, MessageCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  book_id: string;
  user_id: string;
  profiles: {
    display_name: string;
    avatar_url: string;
  };
  books: {
    title: string;
  };
}

export default function ReviewManagement() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchReviews();

    const channel = supabase
      .channel('admin_reviews_moderation')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, fetchReviews)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, profiles(display_name, avatar_url), books(title)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data as any[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Ulasan?',
      text: "Tindakan ini tidak dapat dibatalkan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, Hapus'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('reviews')
          .delete()
          .eq('id', id);

        if (error) throw error;
        Swal.fire('Dihapus!', 'Ulasan telah dihapus.', 'success');
      } catch (err: any) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  const filteredReviews = reviews.filter(r => 
    r.comment.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.profiles?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.books?.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Manajemen Ulasan</h1>
          <p className="text-sm text-slate-500 font-medium mt-2">Jaga kualitas konten dengan memoderasi ulasan pengguna.</p>
        </div>
        <div className="relative w-full md:w-96 z-10">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
           <input 
              type="text" 
              placeholder="Cari ulasan, buku, atau pengguna..."
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-tan-100 rounded-full blur-[80px] pointer-events-none opacity-40"></div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left font-sans">
               <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <tr>
                     <th className="px-10 py-6">Penulis</th>
                     <th className="px-10 py-6">Buku</th>
                     <th className="px-10 py-6">Penilaian & Komentar</th>
                     <th className="px-10 py-6">Waktu</th>
                     <th className="px-10 py-6 text-right">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    [1,2,3].map(i => (
                       <tr key={i}><td colSpan={5} className="px-10 py-10 animate-pulse bg-slate-50/50"></td></tr>
                    ))
                  ) : filteredReviews.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                       <td className="px-10 py-6">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold overflow-hidden shadow-sm">
                                {r.profiles?.avatar_url ? <img src={r.profiles.avatar_url} className="w-full h-full object-cover" /> : r.profiles?.display_name?.[0]}
                             </div>
                             <p className="text-sm font-bold text-slate-900">{r.profiles?.display_name || 'Pembaca'}</p>
                          </div>
                       </td>
                       <td className="px-10 py-6">
                          <p className="text-sm font-medium text-slate-600 line-clamp-1">{r.books?.title || 'Buku Tidak Diketahui'}</p>
                       </td>
                       <td className="px-10 py-6 max-w-md">
                          <div className="flex items-center gap-1 mb-2">
                             {[...Array(5)].map((_, i) => (
                                <Star key={i} size={12} className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                             ))}
                          </div>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed italic">"{r.comment}"</p>
                       </td>
                       <td className="px-10 py-6">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                             <Clock size={12} />
                             {new Date(r.created_at).toLocaleDateString()}
                          </div>
                       </td>
                   <td className="px-10 py-6">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={() => handleDeleteReview(r.id)}
                            className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"
                         >
                            <Trash2 size={18} />
                         </button>
                         <button className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-all shadow-sm">
                            <AlertTriangle size={18} />
                         </button>
                      </div>
                   </td>
                </tr>
              ))}
           </tbody>
        </table>
     </div>
     {filteredReviews.length === 0 && !loading && (
        <div className="p-20 text-center text-slate-400 italic">Ulasan tidak ditemukan.</div>
     )}
  </div>
    </div>
  );
}
