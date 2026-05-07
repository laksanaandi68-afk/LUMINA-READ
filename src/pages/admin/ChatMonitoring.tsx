import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  MessageCircle, 
  Search, 
  Trash2, 
  UserX, 
  Clock,
  Filter,
  ArrowRight,
  ShieldAlert,
  User as UserIcon,
  ChevronRight,
  RefreshCcw,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';

export default function ChatMonitoring() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'flagged'>('all');

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender_prof:profiles!messages_sender_id_fkey(display_name, username, avatar_url, status),
          receiver_prof:profiles!messages_receiver_id_fkey(display_name, username, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteMsg = async (id: string) => {
    const res = await Swal.fire({
      title: 'Hapus Pesan?',
      text: "Tindakan ini tidak bisa dibatalkan.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444'
    });

    if (res.isConfirmed) {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        setMessages(m => m.filter(msg => msg.id !== id));
      }
    }
  };

  const banUser = async (userId: string, username: string) => {
    const res = await Swal.fire({
      title: `Ban @${username}?`,
      text: "User ini akan dilarang akses sistem selamanya.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#000000',
      confirmButtonText: 'Ya, Ban Permanen'
    });

    if (res.isConfirmed) {
      const { error } = await supabase.from('profiles').update({ status: 'banned' }).eq('id', userId);
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        Swal.fire('Berhasil', 'User telah diblokir.', 'success');
        fetchMessages();
      }
    }
  };

  const filteredMessages = messages.filter(m => 
    m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.sender_prof?.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Monitoring Percakapan</h1>
          <p className="text-slate-500 font-medium mt-1">Pantau seluruh jalur komunikasi user secara realtime.</p>
        </div>
        <button 
           onClick={fetchMessages}
           className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-slate-600 font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
        >
          <RefreshCcw size={16} /> Segarkan Data
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Filter Bar */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
           <div className="relative flex-1 w-full">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
             <input 
               type="text" 
               placeholder="Cari pesan atau username..." 
               className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
             />
           </div>
           <div className="flex gap-2">
              <button 
                onClick={() => setFilterType('all')}
                className={`px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${filterType === 'all' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
              >
                Semua Chat
              </button>
              <button 
                onClick={() => setFilterType('flagged')}
                className={`px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${filterType === 'flagged' ? 'bg-rose-500 text-white shadow-xl shadow-rose-500/20' : 'bg-slate-50 text-slate-400 hover:text-rose-500'}`}
              >
                Terdeteksi Spam
              </button>
           </div>
        </div>

        {/* Message Table */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead>
                   <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      <th className="px-10 py-5">Pengirim & Penerima</th>
                      <th className="px-10 py-5">Isi Pesan</th>
                      <th className="px-10 py-5">Waktu</th>
                      <th className="px-10 py-5 text-right w-40">Moderasi</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {loading ? (
                     <tr>
                       <td colSpan={4} className="py-20 text-center">
                          <RefreshCcw className="animate-spin mx-auto text-primary/30 mb-2" size={32} />
                          <p className="text-xs font-black uppercase tracking-widest text-slate-300">Menarik Data Chat...</p>
                       </td>
                     </tr>
                   ) : filteredMessages.length === 0 ? (
                     <tr>
                       <td colSpan={4} className="py-20 text-center">
                          <MessageSquare className="mx-auto text-slate-100 mb-2" size={48} />
                          <p className="text-slate-400 font-bold">Tidak ada pesan ditemukan.</p>
                       </td>
                     </tr>
                   ) : filteredMessages.map(msg => (
                     <tr key={msg.id} className="group hover:bg-slate-50/50 transition-all">
                        <td className="px-10 py-6">
                           <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                 <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-900 leading-none">@{msg.sender_prof?.username || 'user'}</span>
                                    {msg.sender_prof?.status === 'banned' && <span className="bg-rose-100 text-rose-500 text-[8px] font-black px-1.5 py-0.5 rounded-full">BANNED</span>}
                                 </div>
                                 <div className="flex items-center gap-1.5 mt-1">
                                    <ArrowRight size={10} className="text-slate-300" />
                                    <span className="text-[10px] font-bold text-slate-400">@{msg.receiver_prof?.username || 'admin'}</span>
                                 </div>
                              </div>
                           </div>
                        </td>
                        <td className="px-10 py-6">
                           <div className="max-w-md">
                              <p className="text-sm font-medium text-slate-600 leading-relaxed truncate group-hover:whitespace-normal group-hover:overflow-visible" title={msg.content}>
                                 {msg.content}
                              </p>
                           </div>
                        </td>
                        <td className="px-10 py-6">
                           <span className="text-[10px] font-black text-slate-300 uppercase">
                              {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                           </span>
                        </td>
                        <td className="px-10 py-6 text-right">
                           <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => deleteMsg(msg.id)}
                                className="w-9 h-9 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                title="Hapus Pesan"
                              >
                                 <Trash2 size={16} />
                              </button>
                              <button 
                                onClick={() => banUser(msg.sender_id, msg.sender_prof?.username)}
                                disabled={msg.sender_prof?.status === 'banned'}
                                className="w-9 h-9 flex items-center justify-center bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-xl shadow-slate-900/10 disabled:opacity-30"
                                title="Ban User"
                              >
                                 <UserX size={16} />
                              </button>
                           </div>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
}
