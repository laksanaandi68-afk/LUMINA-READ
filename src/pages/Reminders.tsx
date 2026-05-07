import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Plus, Clock, Calendar as CalendarIcon, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function Reminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00'
  });

  useEffect(() => {
    if (user) fetchReminders();
  }, [user]);

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user?.id)
        .order('scheduled_at', { ascending: true });
      
      if (error) throw error;
      setReminders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const scheduledAt = new Date(`${formData.date}T${formData.time}:00`).toISOString();
      
      const { error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          title: formData.title,
          description: formData.description,
          scheduled_at: scheduledAt,
          status: 'upcoming',
          is_notified: false
        });

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Jadwal Ditambahkan',
        text: 'Kami akan mengingatkan Anda tepat waktu!',
        timer: 2000,
        showConfirmButton: false
      });

      setShowForm(false);
      setFormData({ title: '', description: '', date: new Date().toISOString().split('T')[0], time: '12:00' });
      fetchReminders();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const deleteReminder = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Jadwal?',
      text: "Aksi ini tidak dapat dibatalkan.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff5c35',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from('reminders').delete().eq('id', id);
        if (error) throw error;
        fetchReminders();
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const upcomingReminders = reminders.filter(r => !r.is_notified);
  const pastReminders = reminders.filter(r => r.is_notified);

  return (
    <div className="space-y-12 pb-20 font-sans">
      <header className="relative py-20 px-10 rounded-[60px] bg-slate-900 overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-2xl text-left">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Bell size={20} />
            </div>
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Produktifitas</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-black text-white leading-tight mb-8 tracking-tight"
          >
            Sistem <br />
            <span className="text-primary italic">Pengingat</span> 🔔
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg font-medium mb-12 leading-relaxed max-w-md"
          >
            Jangan biarkan hobi membaca Anda terlewatkan. Atur jadwal dan kami akan mengingatkan Anda.
          </motion.p>
          
          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => setShowForm(true)}
            className="px-10 py-5 bg-primary text-white rounded-[28px] font-black text-sm uppercase tracking-widest flex items-center gap-4 hover:scale-105 transition-all shadow-2xl shadow-primary/20"
          >
            Buat Jadwal Baru <Plus size={20} />
          </motion.button>
        </div>
        
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-5 pointer-events-none overflow-hidden">
           <Bell size={400} className="text-white absolute -right-20 top-20 rotate-12" strokeWidth={0.5} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Upcoming Section */}
        <section className="space-y-8">
          <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-tan-50 text-indigo-500">
                   <Clock size={24} />
                </div>
                <div>
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight">Jadwal Mendatang</h2>
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Siap untuk Beraksi</p>
                </div>
             </div>
             <span className="text-[10px] font-black bg-indigo-50 text-indigo-500 px-3 py-1 rounded-full">{upcomingReminders.length} Tugas</span>
          </div>

          <div className="space-y-4">
             {upcomingReminders.length === 0 ? (
               <div className="bg-white p-12 rounded-[40px] border-2 border-dashed border-tan-100 text-center">
                  <p className="text-slate-400 font-bold italic">Belum ada jadwal. Tambahkan satu untuk memulai!</p>
               </div>
             ) : upcomingReminders.map((r) => (
                <motion.div 
                  layout
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-8 rounded-[32px] border border-tan-50 shadow-sm relative group overflow-hidden"
                >
                   <div className="flex justify-between items-start">
                      <div className="space-y-2">
                         <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">{r.title}</h3>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-500 text-[8px] font-black uppercase rounded-lg">Soon</span>
                         </div>
                         <p className="text-sm font-medium text-slate-500 line-clamp-2 max-w-sm">{r.description || 'Tidak ada deskripsi'}</p>
                      </div>
                      <button 
                        onClick={() => deleteReminder(r.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                         <Trash2 size={18} />
                      </button>
                   </div>
                   
                   <div className="mt-8 pt-6 border-t border-tan-50 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <CalendarIcon size={14} className="text-primary" /> {new Date(r.scheduled_at).toLocaleDateString('id-ID')}
                         </div>
                         <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Clock size={14} className="text-primary" /> {new Date(r.scheduled_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                         </div>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-500">
                         <AlertCircle size={16} />
                         <span className="text-[10px] font-black uppercase tracking-widest">Aktif</span>
                      </div>
                   </div>
                </motion.div>
             ))}
          </div>
        </section>

        {/* History Section */}
        <section className="space-y-8">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-tan-50 text-emerald-500">
                    <CheckCircle size={24} />
                 </div>
                 <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Riwayat Notifikasi</h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tugas yang Selesai</p>
                 </div>
              </div>
           </div>

           <div className="space-y-4">
              {pastReminders.map((r) => (
                 <div key={r.id} className="bg-tan-50/30 p-6 rounded-[28px] border border-tan-50 flex items-center justify-between group grayscale hover:grayscale-0 transition-all">
                    <div className="space-y-1">
                       <h4 className="font-extrabold text-slate-600 line-through">{r.title}</h4>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {new Date(r.scheduled_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                       </p>
                    </div>
                    <button 
                       onClick={() => deleteReminder(r.id)}
                       className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                       <Trash2 size={16} />
                    </button>
                 </div>
              ))}
              {pastReminders.length === 0 && (
                <div className="p-12 text-center text-slate-300 font-medium italic">Belum ada riwayat.</div>
              )}
           </div>
        </section>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowForm(false)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative bg-white w-full max-w-lg rounded-[48px] shadow-2xl p-10 overflow-hidden"
             >
                <div className="flex justify-between items-center mb-10">
                   <h2 className="text-3xl font-black text-slate-900 tracking-tight">Buat Jadwal Baru</h2>
                   <button onClick={() => setShowForm(false)} className="p-2 bg-slate-50 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
                      <X size={20} />
                   </button>
                </div>

                <form onSubmit={handleAddReminder} className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Judul Kegiatan</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Misal: Membaca Atomic Habits"
                        className="w-full px-8 py-5 bg-slate-50 border-transparent rounded-[24px] outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-slate-900"
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Tanggal</label>
                         <input 
                           required
                           type="date" 
                           className="w-full px-8 py-5 bg-slate-50 border-transparent rounded-[24px] outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-slate-900"
                           value={formData.date}
                           onChange={(e) => setFormData({...formData, date: e.target.value})}
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Waktu</label>
                         <input 
                           required
                           type="time" 
                           className="w-full px-8 py-5 bg-slate-50 border-transparent rounded-[24px] outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-slate-900"
                           value={formData.time}
                           onChange={(e) => setFormData({...formData, time: e.target.value})}
                         />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Deskripsi (Opsional)</label>
                      <textarea 
                        placeholder="Berikan detail tambahan..."
                        className="w-full px-8 py-5 bg-slate-50 border-transparent rounded-[24px] outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-slate-900 h-32 resize-none"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                      />
                   </div>

                   <button 
                     type="submit"
                     className="w-full py-6 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                   >
                      Konfirmasi Jadwal
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
