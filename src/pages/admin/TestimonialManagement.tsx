import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Star, Check, X, Trash2, Clock, Filter, Search, User, MessageSquare, Hourglass, ThumbsUp as ThumbsUpIcon, CheckSquare, Info, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function TestimonialManagement() {
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchTestimonials();

    // Real-time subscription
    const channel = supabase
      .channel('admin:testimonials')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testimonials' }, () => {
        fetchTestimonials();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select(`
          *,
          profiles (
            display_name,
            avatar_url,
            username
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const dataSet = data || [];
      setTestimonials(dataSet);
      
      // Sync selected IDs with existing 'approved' status
      const initialSelected = dataSet.filter(t => t.status === 'approved').map(t => t.id);
      setSelectedIds(initialSelected);
    } catch (err) {
      console.error('Error fetching testimonials:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDisplay = async () => {
    try {
      setLoading(true);
      
      // Reset all previously selected to 'pending' (or keep their previous status if better, but simple logic is often best for batch updates)
      // Actually, a more precise way is to set only those that CHANGED.
      
      const currentSelected = testimonials.filter(t => t.status === 'approved').map(t => t.id);
      
      // Find IDs that were deselected
      const deselected = currentSelected.filter(id => !selectedIds.includes(id));
      // Find IDs that were newly selected
      const newlySelected = selectedIds.filter(id => !currentSelected.includes(id));

      if (deselected.length > 0) {
        await supabase
          .from('testimonials')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .in('id', deselected);
      }

      if (newlySelected.length > 0) {
        await supabase
          .from('testimonials')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .in('id', newlySelected);
      }

      await fetchTestimonials();
      
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Tampilan Berhasil Disimpan',
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (err: any) {
      Swal.fire('Gagal', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      if (prev.length >= 4) {
        Swal.fire({
          icon: 'warning',
          title: 'Maksimum 4',
          text: 'Anda hanya dapat menampilkan maksimal 4 testimoni.',
          confirmButtonColor: '#D2B48C'
        });
        return prev;
      }
      return [...prev, id];
    });
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      // Check for limit if selecting
      if (status === 'approved') {
        const currentlySelected = testimonials.filter(t => t.status === 'approved');
        
        if (currentlySelected.length >= 4) {
          const result = await Swal.fire({
            title: 'Batas Maksimal 4',
            text: "Anda sudah memilih 4 testimoni. Ingin mengganti testimoni terpilih yang paling lama?",
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Ya, Ganti',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#D2B48C'
          });

          if (!result.isConfirmed) return;

          // Find the oldest selected one
          const oldest = currentlySelected.sort((a, b) => 
            new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          )[0];

          // Revert the oldest to pending
          await supabase
            .from('testimonials')
            .update({ status: 'pending' })
            .eq('id', oldest.id);
        }
      }

      const { error } = await supabase
        .from('testimonials')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      await fetchTestimonials();
      
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Status: ${status === 'approved' ? 'Dipilih' : status === 'rejected' ? 'Ditolak' : 'Direset'}`,
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (err: any) {
      Swal.fire('Gagal', err.message, 'error');
    }
  };

  const deleteTestimonial = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus testimoni?',
      text: "Tindakan ini bersifat permanen!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, hapus'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('testimonials')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setTestimonials(testimonials.filter(t => t.id !== id));
        Swal.fire('Dihapus!', 'Testimoni telah dihapus.', 'success');
      } catch (err: any) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  const filteredTestimonials = testimonials.filter(t => {
    const matchesFilter = filter === 'all' || t.status === filter;
    const matchesSearch = 
      t.profiles?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const selectedCount = selectedIds.length;
  const stats = {
    total: testimonials.length,
    pending: testimonials.filter(t => t.status === 'pending').length,
    approved: testimonials.filter(t => t.status === 'approved' || t.status === 'pending').length, // In context of screenshot "Disetujui" usually means non-rejected
    actualApproved: testimonials.filter(t => t.status !== 'rejected').length,
    displayed: testimonials.filter(t => t.status === 'approved').length
  };

  return (
    <div className="space-y-6 pb-20 font-sans">
      {/* Header */}
      <header className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden group">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary relative z-10">
          <MessageCircle size={28} className="fill-primary/20" />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Manajemen Testimoni
          </h1>
          <p className="text-sm font-bold text-slate-400 mt-1">
            Sortir, approve, dan pilih ulasan untuk ditampilkan di homepage.
          </p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          label="TOTAL MASUK" 
          value={stats.total} 
          color="bg-indigo-600" 
          icon={MessageSquare} 
        />
        <StatsCard 
          label="MENUNGGU" 
          value={stats.pending} 
          color="bg-amber-500" 
          icon={Hourglass} 
        />
        <StatsCard 
          label="DISETUJUI" 
          value={stats.actualApproved} 
          color="bg-emerald-500" 
          icon={ThumbsUpIcon} 
        />
        <StatsCard 
          label="DITAMPILKAN" 
          value={stats.displayed} 
          color="bg-rose-500" 
          icon={Star} 
        />
      </div>

      {/* Control Panel */}
      <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
             {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                    filter === f ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f === 'all' ? 'Semua' : f === 'pending' ? 'Menunggu' : f === 'approved' ? 'Disetujui' : 'Ditolak'}
                </button>
             ))}
          </div>

          <div className="flex items-center gap-6">
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ditampilkan: <span className="text-primary font-mono">{selectedCount}/4</span></p>
             </div>
             <button 
               onClick={handleSaveDisplay}
               disabled={loading}
               className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
             >
               <CheckSquare size={18} /> Simpan Tampil
             </button>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="flex items-start gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
           <Info size={18} className="text-slate-400 mt-0.5" />
           <p className="text-xs font-bold text-slate-500 leading-relaxed">
             Centang ulasan <span className="text-primary">approved</span> untuk tampil di homepage (maks. 4).
           </p>
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="popLayout">
            {loading ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="bg-white p-8 rounded-[40px] border border-slate-100 animate-pulse h-48 shadow-sm"></div>
                  ))}
               </div>
            ) : filteredTestimonials.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-6">
                {filteredTestimonials.map((t) => (
                  <motion.div 
                    key={t.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`bg-white p-6 rounded-[32px] border transition-all duration-300 relative group flex flex-col justify-between ${
                      selectedIds.includes(t.id) 
                        ? 'border-[#2563eb]/30 ring-4 ring-[#2563eb]/5 shadow-xl' 
                        : 'border-slate-200 shadow-sm'
                    }`}
                  >
                    <div>
                      {/* Status Badge */}
                      <div className="flex justify-between items-start mb-4">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          t.status === 'approved' ? 'bg-[#2563eb] text-white' : 
                          t.status === 'rejected' ? 'bg-rose-500 text-white' : 
                          'bg-[#ffc107] text-slate-900'
                        }`}>
                          {t.status === 'pending' && <Hourglass size={12} />}
                          {t.status === 'approved' ? 'Ditampilkan' : t.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                        </div>
                        
                        {t.status !== 'rejected' && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400">Pilih Tampil</span>
                            <input 
                              type="checkbox"
                              checked={selectedIds.includes(t.id)}
                              onChange={() => toggleSelection(t.id)}
                              className="w-5 h-5 rounded-lg border-2 border-slate-200 text-[#2563eb] focus:ring-[#2563eb]/20 transition-all cursor-pointer"
                            />
                          </div>
                        )}
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-0.5 mb-3">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} className={i < t.rating ? "fill-[#ffc107] text-[#ffc107]" : "text-slate-100"} />
                        ))}
                      </div>

                      {/* Message */}
                      <p className="text-slate-700 font-bold text-sm mb-6 line-clamp-3">
                        "{t.message}"
                      </p>

                      {/* User Info */}
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-[#e91e63] flex items-center justify-center text-white font-black text-sm shadow-sm overflow-hidden shrink-0">
                          {t.profiles?.avatar_url ? (
                            <img src={t.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{t.profiles?.display_name?.substring(0, 2).toUpperCase() || 'U'}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{t.profiles?.display_name || 'Pembaca'}</h4>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                            <span>-</span>
                            <span>{new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => updateStatus(t.id, 'approved')}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white transition-all active:scale-95 shadow-sm ${
                            t.status === 'approved' ? 'bg-[#2563eb]/50 cursor-not-allowed' : 'bg-[#198754] hover:bg-[#157347]'
                          }`}
                        >
                          <Check size={16} strokeWidth={3} /> Setujui
                        </button>
                        <button 
                          onClick={() => updateStatus(t.id, 'rejected')}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white transition-all active:scale-95 shadow-sm ${
                            t.status === 'rejected' ? 'bg-rose-500/50 cursor-not-allowed' : 'bg-[#ffc107] hover:bg-[#ffb300]'
                          }`}
                        >
                          <X size={16} strokeWidth={3} /> Tolak
                        </button>
                      </div>

                      <button 
                         onClick={() => deleteTestimonial(t.id)}
                         className="w-10 h-10 rounded-full border border-rose-200 text-rose-500 bg-white hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-90"
                         title="Hapus"
                      >
                         <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                 <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center text-slate-200 relative group">
                    <MessageSquare size={48} className="relative z-10" />
                    <div className="absolute inset-0 bg-primary/5 rounded-[40px] scale-150 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 </div>
                 <p className="font-black text-slate-300 uppercase tracking-[0.3em] text-sm">Belum ada ulasan.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ label, value, color, icon: Icon }: any) {
  return (
    <div className={`p-8 rounded-[40px] ${color} text-white shadow-xl relative overflow-hidden group`}>
       <div className="relative z-10 h-full flex flex-col justify-between min-h-[140px]">
          <p className="text-4xl font-black tabular-nums tracking-tighter">{value}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mt-2">{label}</p>
       </div>
       <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
          <Icon size={120} />
       </div>
       {/* Background Shapes */}
       <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
    </div>
  );
}
