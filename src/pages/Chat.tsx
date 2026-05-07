import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, MessageCircle, ShieldCheck, Smile, ArrowLeft, User as UserIcon, ShieldAlert, Search, Clock, BookOpen, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';

export default function Chat() {
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const withUserId = searchParams.get('with');
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [acceptedFriends, setAcceptedFriends] = useState<any[]>([]);
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [friendshipLoading, setFriendshipLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchAcceptedFriends();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    if (withUserId) {
      validateAndFetchFriendProfile();
    } else {
      setFriendProfile(null);
      setMessages([]);
      setLoading(false);
    }
    
    fetchMessages();

    // Subscribe to messages
    const channel = supabase
      .channel(`chat_global`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        const msg = payload.new;
        
        const isPrivateTarget = withUserId && (
          (msg.sender_id === user.id && msg.receiver_id === withUserId) || 
          (msg.sender_id === withUserId && msg.receiver_id === user.id)
        );
        
        const isSupportTarget = !withUserId && (
          (msg.user_id === user.id) || 
          (isAdmin && !msg.receiver_id) || 
          (msg.receiver_id === user.id && !msg.sender_id) 
        );

        if (isPrivateTarget || isSupportTarget) {
          setMessages((current) => {
            if (current.some(m => m.id === msg.id)) return current;
            return [...current, msg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, withUserId, isAdmin]);

  const fetchAcceptedFriends = async () => {
    setLoadingFriends(true);
    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          status,
          user:profiles!friends_user_id_fkey(id, display_name, username, avatar_url, last_read_book_title, last_read_page),
          friend:profiles!friends_friend_id_fkey(id, display_name, username, avatar_url, last_read_book_title, last_read_page)
        `)
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const formattedFriends = data?.map(item => {
        const uObj = Array.isArray(item.user) ? item.user[0] : item.user;
        const fObj = Array.isArray(item.friend) ? item.friend[0] : item.friend;
        const otherUser = uObj.id === user.id ? fObj : uObj;
        return { ...otherUser, status: item.status };
      }) || [];

      setAcceptedFriends(formattedFriends);
    } catch (err) {
      console.error('Error fetching friends:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const validateAndFetchFriendProfile = async () => {
    setFriendshipLoading(true);
    try {
      const { data: friendship } = await supabase
        .from('friends')
        .select('status')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .or(`user_id.eq.${withUserId},friend_id.eq.${withUserId}`)
        .eq('status', 'accepted')
        .maybeSingle();

      if (!friendship) {
        setFriendProfile(null);
        Swal.fire({
          icon: 'warning',
          title: 'Akses Dibatasi',
          text: 'Kamu harus berteman terlebih dahulu untuk melakukan chat.',
          confirmButtonColor: '#000000',
        });
        navigate('/app/user/friends');
        return;
      }

      const { data } = await supabase.from('profiles').select('*').eq('id', withUserId).single();
      setFriendProfile(data);
    } catch (err) {
      console.error("Val error:", err);
    } finally {
      setFriendshipLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase.from('messages').select('*');

      if (withUserId) {
        query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${withUserId}),and(sender_id.eq.${withUserId},receiver_id.eq.${user.id})`);
      } else if (isAdmin) {
        query = query.is('receiver_id', null).order('created_at', { ascending: true });
      } else {
        query = query.or(`user_id.eq.${user.id},and(sender_id.eq.${user.id},receiver_id.is.null),and(sender_id.is.null,receiver_id.eq.${user.id})`);
      }

      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Chat Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const content = newMessage.trim();
    setNewMessage('');
    setShowEmojiPicker(false);

    try {
      const payload: any = {
        sender_id: user.id,
        content: content,
        created_at: new Date().toISOString()
      };

      if (withUserId) {
        payload.receiver_id = withUserId;
      } else {
        // Admin Support Mode Logic
        payload.user_id = user.id;
        payload.sender = isAdmin ? 'admin' : 'user';
      }

      const { error } = await supabase.from('messages').insert(payload);
      if (error) throw error;
    } catch (err: any) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: err.message, showConfirmButton: false, timer: 3000 });
      setNewMessage(content);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const onEmojiClick = (emojiData: any) => setNewMessage(p => p + emojiData.emoji);

  const handleReport = async (msg: any) => {
    if (!user) return;

    const { value: formValues } = await Swal.fire({
      title: `<div class="text-xl font-black text-slate-900 mb-2">Laporkan Pesan</div>`,
      html: `
        <div class="text-left font-sans">
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Alasan</label>
          <select id="swal-reason" class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/10 mb-4 transition-all">
            <option value="Spam">Spam / Iklan</option>
            <option value="Harassment">Pelecehan / Bullying</option>
            <option value="Inappropriate">Konten Tidak Pantas</option>
            <option value="Other">Lainnya</option>
          </select>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Keterangan Opsional</label>
          <textarea id="swal-description" class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/10 h-24 transition-all" placeholder="Ada tambahan detail?"></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Kirim Laporan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#f1f5f9',
      customClass: {
        popup: 'rounded-[32px] border-none shadow-2xl',
        confirmButton: 'rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest',
        cancelButton: 'rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500'
      },
      preConfirm: () => {
        return {
          reason: (document.getElementById('swal-reason') as HTMLSelectElement).value,
          description: (document.getElementById('swal-description') as HTMLTextAreaElement).value
        };
      }
    });

    if (formValues) {
      try {
        const { error } = await supabase.from('reports').insert({
          reporter_id: user.id,
          reported_user_id: msg.sender_id,
          message_id: msg.id,
          reason: formValues.reason,
          description: formValues.description,
          status: 'pending'
        });

        if (error) throw error;

        Swal.fire({
          icon: 'success',
          title: 'Laporan Dikirim',
          text: 'Terima kasih telah melapor. Kami akan meninjau pesan ini.',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const handleReportUser = async () => {
    if (!user || !friendProfile) return;

    const { value: formValues } = await Swal.fire({
      title: `<div class="text-xl font-black text-slate-900 mb-2">Laporkan @${friendProfile.username}</div>`,
      html: `
        <div class="text-left font-sans">
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Alasan</label>
          <select id="swal-reason" class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/10 mb-4 transition-all">
            <option value="Spam">Spam atau Iklan</option>
            <option value="Harassment">Pelecehan atau Bullying</option>
            <option value="Inappropriate Content">Konten Tidak Pantas</option>
            <option value="Other">Lainnya</option>
          </select>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Keterangan</label>
          <textarea id="swal-description" class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/10 h-24 transition-all" placeholder="Jelaskan masalahnya..."></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Kirim Laporan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#f1f5f9',
      customClass: {
        popup: 'rounded-[32px] border-none shadow-2xl',
        confirmButton: 'rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest',
        cancelButton: 'rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500'
      },
      preConfirm: () => {
        return {
          reason: (document.getElementById('swal-reason') as HTMLSelectElement).value,
          description: (document.getElementById('swal-description') as HTMLTextAreaElement).value
        };
      }
    });

    if (formValues) {
      try {
        const { error } = await supabase.from('reports').insert({
          reporter_id: user.id,
          reported_user_id: friendProfile.id,
          reason: formValues.reason,
          description: formValues.description,
          status: 'pending'
        });

        if (error) throw error;

        Swal.fire({
          icon: 'success',
          title: 'Laporan Diterima',
          text: 'Laporan akun telah terkirim ke moderator.',
          confirmButtonColor: '#000000',
        });
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  if (loading && !messages.length) return <div className="flex items-center justify-center h-full py-40 scale-150 grayscale opacity-20"><MessageCircle className="animate-pulse" /></div>;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-tan-50 overflow-hidden font-sans">
      {/* List Sidebar */}
      <aside className="w-80 border-r border-tan-50 flex flex-col bg-slate-50/20">
        <div className="p-8 border-b border-tan-50 bg-white">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pesan</h2>
          <div className="mt-6 relative">
            <input 
              type="text" 
              placeholder="Cari obrolan..." 
              className="w-full bg-slate-100 border-none rounded-2xl px-10 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Default Support/Admin Chat */}
          <div 
            onClick={() => navigate('/app/user/chat')}
            className={`p-6 flex items-center gap-4 cursor-pointer transition-all border-b border-tan-50/50 ${!withUserId ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <ShieldCheck size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-sm font-black text-slate-900 truncate">Lumina Support</span>
                <span className="text-[10px] font-bold text-slate-300">Admin</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 truncate tracking-tight">Butuh bantuan?</p>
            </div>
          </div>

          <div className="px-8 py-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Teman Membaca</h3>
            {loadingFriends ? (
                <div className="space-y-4">
                   {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />)}
                </div>
            ) : acceptedFriends.length === 0 ? (
                <div className="py-10 text-center">
                   <p className="text-[11px] font-bold text-slate-400">Belum ada teman.</p>
                   <Link to="/app/user/friends" className="text-[10px] font-black text-primary uppercase mt-2 block">Cari Teman</Link>
                </div>
            ) : acceptedFriends.map(friend => (
              <div 
                key={friend.id}
                onClick={() => navigate(`/app/user/chat?with=${friend.id}`)}
                className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer mb-2 transition-all group ${withUserId === friend.id ? 'bg-white shadow-xl shadow-slate-200/50 scale-[1.02]' : 'hover:bg-white'}`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-tan-50 flex items-center justify-center overflow-hidden border border-tan-100">
                    {friend.avatar_url ? <img src={friend.avatar_url} className="w-full h-full object-cover" /> : <UserIcon size={20} className="text-tan-200" />}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate tracking-tight group-hover:text-primary transition-colors">{friend.display_name}</p>
                  <p className="text-[10px] font-bold text-emerald-500 truncate lowercase truncate">
                    {friend.last_read_book_title ? `📖 ${friend.last_read_book_title}` : `@${friend.username}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {withUserId || !isAdmin ? (
          <>
            <header className="px-8 py-6 border-b border-tan-50 bg-white flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-4">
                <Link to={withUserId ? `/app/user/profile/${withUserId}` : '/app/user/friends'} className="flex items-center gap-3 group">
                  <div className="w-12 h-12 rounded-2xl bg-tan-50 flex items-center justify-center overflow-hidden border border-tan-100 group-hover:border-primary transition-all">
                    {friendProfile?.avatar_url ? (
                      <img src={friendProfile.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={24} className="text-tan-200" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 group-hover:text-primary transition-colors tracking-tight">
                      {friendProfile?.display_name || (isAdmin ? "Service Admin" : "Lumina Support")}
                    </h2>
                    <div className="flex items-center gap-2">
                       {friendProfile?.last_read_book_title ? (
                          <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-[10px]">
                             <BookOpen size={10} />
                             <span>Sedang baca "{friendProfile.last_read_book_title}"</span>
                          </div>
                       ) : (
                          <>
                             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                             <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Online</span>
                          </>
                       )}
                    </div>
                  </div>
                </Link>
              </div>
              <div className="flex items-center gap-2 relative">
                 <button 
                   onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                   className="p-3 text-slate-300 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all"
                 >
                    <MoreVertical size={20} />
                 </button>

                 <AnimatePresence>
                   {headerMenuOpen && (
                     <>
                       <div 
                         className="fixed inset-0 z-10" 
                         onClick={() => setHeaderMenuOpen(false)}
                       />
                       <motion.div
                         initial={{ opacity: 0, y: 10, scale: 0.95 }}
                         animate={{ opacity: 1, y: 0, scale: 1 }}
                         exit={{ opacity: 0, y: 10, scale: 0.95 }}
                         className="absolute right-0 top-14 w-48 bg-white rounded-2xl shadow-2xl border border-tan-50 p-2 z-20"
                       >
                         <button 
                           onClick={() => {
                             setHeaderMenuOpen(false);
                             handleReportUser();
                           }}
                           className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                         >
                           <ShieldAlert size={16} /> Laporkan User
                         </button>
                         <button 
                           onClick={() => {
                             setHeaderMenuOpen(false);
                             navigate(`/app/user/profile/${withUserId}`);
                           }}
                           className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                         >
                           <UserIcon size={16} /> Lihat Profil
                         </button>
                       </motion.div>
                     </>
                   )}
                 </AnimatePresence>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-4 bg-slate-50/10">
              <div className="py-10 text-center">
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Mulai Percakapan Baru</p>
                 <div className="w-10 h-1 bg-tan-100 mx-auto rounded-full"></div>
              </div>
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === user.id || (msg.sender === (isAdmin ? 'admin' : 'user') && !msg.receiver_id);
                return (
                  <motion.div
                    key={msg.id || i}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1 relative group`}>
                      <div className={`px-5 py-3.5 rounded-[24px] text-sm font-medium shadow-sm leading-relaxed
                        ${isMe ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white border border-tan-50 text-slate-700 rounded-tl-sm shadow-xl shadow-slate-200/20'}
                      `}>
                        {msg.content}
                      </div>
                      {!isMe && (
                        <button 
                          onClick={() => handleReport(msg)}
                          className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                          title="Laporkan Pesan"
                        >
                          <ShieldAlert size={14} />
                        </button>
                      )}
                      <div className="flex items-center gap-2 px-2">
                         <span className="text-[9px] font-bold text-slate-300 uppercase">
                           {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                         {isMe && <ShieldCheck size={10} className="text-primary" />}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="p-6 bg-white border-t border-tan-50 shrink-0">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3 relative">
                <div className="flex-1 relative">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Ketik pesan di sini..."
                    className="w-full bg-slate-50 border-none rounded-[24px] px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors"
                  >
                    <Smile size={20} />
                  </button>
                  {showEmojiPicker && (
                    <div ref={pickerRef} className="absolute bottom-16 right-0 z-50">
                      <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.LIGHT} />
                    </div>
                  )}
                </div>
                <button 
                  type="submit" 
                  disabled={!newMessage.trim()}
                  className="w-14 h-14 bg-primary text-white rounded-[24px] flex items-center justify-center shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
             <div className="w-24 h-24 bg-tan-50 rounded-[40px] flex items-center justify-center text-tan-200 mb-6">
                <MessageCircle size={48} />
             </div>
             <h3 className="text-2xl font-black text-slate-900 tracking-tight">Pilih Obrolan</h3>
             <p className="text-slate-400 font-medium mt-2 max-w-xs">Pilih salah satu teman kamu dari sidebar untuk mulai mengobrol.</p>
          </div>
        )}
      </div>
    </div>
  );
}
