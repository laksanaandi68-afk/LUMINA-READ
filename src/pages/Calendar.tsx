import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  BookOpen, 
  Tag, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', type: 'reading', time: '12:00' });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchEvents();

    const channel = supabase
      .channel('calendar_reminders_sync')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reminders',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchEvents = async () => {
    try {
      const { data, error: supabaseError } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user?.id)
        .order('scheduled_at', { ascending: true });
      
      if (supabaseError) {
        throw supabaseError;
      }
      setEvents(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching reminders for calendar:", err);
      // If reminders table doesn't exist yet, we handle gracefully
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEvent.title) return;

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const scheduledAt = new Date(`${dateStr}T${newEvent.time}:00`).toISOString();
      
      const { error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          title: newEvent.title,
          description: newEvent.description || `Aktivitas ${newEvent.type}`,
          scheduled_at: scheduledAt,
          status: 'upcoming',
          is_notified: false
        });

      if (error) throw error;

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Pengingat berhasil dijadwalkan!',
        showConfirmButton: false,
        timer: 2000
      });

      setIsAddingMode(false);
      setNewEvent({ title: '', description: '', type: 'reading', time: '12:00' });
      fetchEvents();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const deleteEvent = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Jadwal?',
      text: "Data akan dihapus dari kalender dan daftar pengingat.",
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
        Swal.fire({
          icon: 'success',
          title: 'Terhapus',
          text: 'Jadwal telah dihapus.',
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        fetchEvents();
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const startOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const renderCalendar = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const startDay = startOfMonth(currentMonth);

    // Padding for prev month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14 sm:h-20 lg:h-24 bg-transparent"></div>);
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = selectedDate.toDateString() === date.toDateString();
      const dateStr = date.toISOString().split('T')[0];
      
      // Filter reminders for this date
      const dayEvents = events.filter(e => e.scheduled_at.startsWith(dateStr));

      days.push(
        <motion.button
          key={day}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSelectedDate(date)}
          className={`h-14 sm:h-20 lg:h-24 rounded-2xl sm:rounded-3xl border transition-all p-2 flex flex-col items-center justify-center relative overflow-hidden group ${
            isSelected 
              ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' 
              : isToday 
                ? 'bg-tan-50 border-primary/20 text-primary' 
                : 'bg-white border-tan-50 text-slate-900 hover:bg-tan-50/50'
          }`}
        >
          <span className={`text-base sm:text-lg font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-900 group-hover:text-primary transition-colors'}`}>
            {day}
          </span>
          {dayEvents.length > 0 && (
            <div className="flex gap-1 mt-1">
              {dayEvents.slice(0, 3).map((_, idx) => (
                <div key={idx} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/50' : 'bg-primary'}`}></div>
              ))}
            </div>
          )}
          {isSelected && (
            <div className="absolute -right-2 -top-2 w-8 h-8 bg-white/10 rounded-full blur-lg"></div>
          )}
        </motion.button>
      );
    }

    return days;
  };

  const filteredEventsForDate = events.filter(e => e.scheduled_at.startsWith(selectedDate.toISOString().split('T')[0]));

  return (
    <div className="space-y-12 pb-20 font-sans max-w-7xl mx-auto px-4 sm:px-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <CalendarIcon className="text-primary" size={36} /> Kalender Membaca
          </h1>
          <p className="text-slate-500 font-medium mt-1">Kelola jadwal dan pantau konsistensi membaca Anda di sini.</p>
        </div>
        <div className="bg-white p-3 rounded-2xl flex items-center gap-3 border border-tan-50 shadow-sm">
          <button 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-2 hover:bg-tan-50 rounded-xl transition-all text-slate-400 hover:text-primary"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-black text-slate-900 uppercase tracking-widest min-w-[150px] text-center">
            {currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </span>
          <button 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-2 hover:bg-tan-50 rounded-xl transition-all text-slate-400 hover:text-primary"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-[32px] flex items-center gap-4 text-rose-600 animate-in fade-in slide-in-from-top-4 duration-500">
          <AlertCircle size={24} />
          <div className="flex-1">
            <p className="font-bold text-sm">{error}</p>
            <p className="text-xs opacity-80 mt-1">Sistem tidak dapat menemukan tabel "events" di database Anda.</p>
          </div>
          <button 
            onClick={() => fetchEvents()}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
          >
            Coba Lagi
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Calendar Grid */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white p-4 sm:p-8 rounded-[40px] border border-tan-50 shadow-xl shadow-slate-100/50">
            <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-6">
              {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, i) => (
                <div key={i} className="text-[10px] font-black text-slate-400 text-center uppercase tracking-widest py-2">
                  {d}
                </div>
              ))}
              {renderCalendar()}
            </div>
          </div>
        </div>

        {/* Date Details & Management */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[40px] border border-tan-50 shadow-xl shadow-slate-100/50 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                     {selectedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
                   </h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Jadwal & Aktivitas</p>
                </div>
                <button 
                  onClick={() => setIsAddingMode(!isAddingMode)}
                  className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <Plus size={24} />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {isAddingMode ? (
                  <motion.form 
                    key="form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onSubmit={handleAddEvent}
                    className="space-y-5 p-6 bg-tan-50/50 rounded-[32px] border border-tan-50"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Judul Jadwal</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Contoh: Baca 20 Halaman" 
                        className="w-full bg-white border-none rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                        value={newEvent.title}
                        onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Waktu</label>
                        <input 
                          required
                          type="time" 
                          className="w-full bg-white border-none rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-primary/10 transition-all font-black text-slate-600"
                          value={newEvent.time}
                          onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Jenis</label>
                        <select 
                          className="w-full bg-white border-none rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-primary/10 transition-all font-black text-slate-600 appearance-none"
                          value={newEvent.type}
                          onChange={e => setNewEvent({...newEvent, type: e.target.value})}
                        >
                          <option value="reading">Membaca</option>
                          <option value="schedule">Sesi Diskusi</option>
                          <option value="assignment">Tugas & Review</option>
                          <option value="personal">Catatan</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Deskripsi (Opsional)</label>
                      <textarea 
                        placeholder="Detail tambahan..." 
                        className="w-full bg-white border-none rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-primary/10 transition-all font-medium h-20 resize-none"
                        value={newEvent.description}
                        onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20">Simpan</button>
                      <button type="button" onClick={() => setIsAddingMode(false)} className="px-6 py-4 bg-white text-slate-400 border border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">Batal</button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div 
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    {filteredEventsForDate.length > 0 ? filteredEventsForDate.map((event) => (
                      <div key={event.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 group relative">
                        <div className="flex justify-between items-start mb-3">
                          <div className={`p-2 rounded-xl inline-flex items-center justify-center ${
                            event.type === 'reading' ? 'bg-primary/10 text-primary' : 
                            event.type === 'schedule' ? 'bg-indigo-50 text-indigo-500' : 'bg-amber-50 text-amber-500'
                          }`}>
                            {event.type === 'reading' ? <BookOpen size={16} /> : <Clock size={16} />}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full shadow-sm">
                              <Clock size={10} className="text-primary" />
                              <span className="text-[10px] font-black text-slate-900">
                                {new Date(event.scheduled_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <button 
                              onClick={() => deleteEvent(event.id)}
                              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100"
                            >
                              <Tag size={10} className="rotate-45" /> 
                            </button>
                          </div>
                        </div>
                        <h4 className="font-extrabold text-slate-900">{event.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-2 font-medium leading-relaxed">{event.description || 'Tidak ada deskripsi tambahan.'}</p>
                      </div>
                    )) : (
                      <div className="py-12 text-center bg-tan-50/30 rounded-[32px] border border-dashed border-tan-100">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-tan-200">
                          <AlertCircle size={24} />
                        </div>
                        <p className="text-slate-400 font-bold text-sm">Tidak ada jadwal.</p>
                        <button onClick={() => setIsAddingMode(true)} className="mt-2 text-primary font-black uppercase text-[9px] tracking-widest hover:underline">Tambah Sekarang</button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-tan-50/50 rounded-full blur-[80px] pointer-events-none"></div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[40px] text-white overflow-hidden relative shadow-2xl">
            <div className="relative z-10 space-y-6">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
                 <Tag className="text-white" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Ketik & Ingat</h3>
                <p className="text-slate-400 text-xs font-medium mt-2 leading-relaxed">Catat momen penting atau kutipan hari ini sebagai bagian dari jurnal membaca Anda.</p>
              </div>
              <button 
                onClick={() => navigate('/app/user/quotes')}
                className="w-full py-4 bg-white/10 hover:bg-white/20 transition-all rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                 Buka Jurnal
              </button>
            </div>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/20 rounded-full blur-[60px] pointer-events-none"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
