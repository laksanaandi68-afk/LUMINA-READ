import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  Search, 
  UserPlus, 
  Check, 
  X, 
  MessageCircle, 
  User as UserIcon,
  Clock,
  ChevronRight,
  UserMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { Link, useNavigate } from 'react-router-dom';

export default function Friends() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchFriends();
    fetchRequests();

    // Subscribe to real-time friendship changes
    const friendsChannel = supabase
      .channel(`friends_page_sync_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friends'
      }, () => {
        fetchFriends();
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(friendsChannel);
    };
  }, [user]);

  const fetchFriends = async () => {
    if (!profile) return;
    try {
      // Fetch where user is either user_id or friend_id
      const { data, error } = await supabase
        .from('friends')
        .select(`
          status,
          user:profiles!friends_user_id_fkey(id, display_name, username, avatar_url, last_read_book_title, last_read_page),
          friend:profiles!friends_friend_id_fkey(id, display_name, username, avatar_url, last_read_book_title, last_read_page)
        `)
        .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const formattedFriends = data?.map(item => {
        const userObj = Array.isArray(item.user) ? item.user[0] : item.user;
        const friendObj = Array.isArray(item.friend) ? item.friend[0] : item.friend;
        const otherUser = userObj.id === profile.id ? friendObj : userObj;
        return { ...otherUser, status: item.status };
      }) || [];

      setFriends(formattedFriends);
    } catch (err) {
      console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          id,
          user:profiles!friends_user_id_fkey(id, display_name, username, avatar_url)
        `)
        .eq('friend_id', profile.id)
        .eq('status', 'pending');

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .neq('id', user.id)
        .limit(10);

      if (error) throw error;

      // Check friendship status for each result
      const resultsWithStatus = await Promise.all((data || []).map(async (u) => {
        const { data: rel } = await supabase
          .from('friends')
          .select('status, user_id')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .or(`user_id.eq.${u.id},friend_id.eq.${u.id}`)
          .maybeSingle();
        
        return { ...u, friendship: rel };
      }));

      setSearchResults(resultsWithStatus);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (friendId: string) => {
    if (!profile) {
      Swal.fire('Error', 'Profil kamu belum siap. Silakan refresh halaman.', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: profile.id,
          friend_id: friendId,
          status: 'pending'
        });

      if (error) throw error;

      // Add Notification for recipient
      await supabase.from('notifications').insert({
        user_id: friendId,
        type: 'friend_request',
        title: 'Permintaan Pertemanan',
        content: `${profile.display_name} mengirimkan permintaan pertemanan.`,
        data: { sender_id: profile.id },
        is_read: false
      });

      Swal.fire({
        icon: 'success',
        title: 'Permintaan Terkirim',
        text: 'Menunggu persetujuan teman kamu.',
        timer: 1500,
        showConfirmButton: false
      });

      handleSearch();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const respondToRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      // Get request details before updating
      const { data: reqData } = await supabase
        .from('friends')
        .select('user_id')
        .eq('id', requestId)
        .single();

      const { error } = await supabase
        .from('friends')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;

      if (status === 'accepted' && reqData) {
        // Notify original sender
        await supabase.from('notifications').insert({
          user_id: reqData.user_id,
          type: 'friend_accepted',
          title: 'Permintaan Diterima!',
          content: `${profile?.display_name} telah menerima permintaan pertemanan kamu. Sekarang kalian bisa chat!`,
          data: { friend_id: profile?.id },
          is_read: false
        });
      }

      Swal.fire({
        icon: status === 'accepted' ? 'success' : 'info',
        title: status === 'accepted' ? 'Pertemanan Diterima!' : 'Permintaan Ditolak',
        timer: 1500,
        showConfirmButton: false
      });

      fetchRequests();
      fetchFriends();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const unfriend = async (friendId: string) => {
    const result = await Swal.fire({
      title: 'Hapus Teman?',
      text: "Kalian tidak akan bisa chat lagi.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, Hapus'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('friends')
          .delete()
          .or(`and(user_id.eq.${profile?.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${profile?.id})`);

        if (error) throw error;
        setFriends(friends.filter(f => f.id !== friendId));
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sosial & Teman</h1>
          <p className="text-slate-500 font-medium mt-1">Kelola pertemanan dan lihat aktivitas membaca mereka.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('friends')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'friends' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Teman ({friends.length})
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'requests' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Permintaan
            {requests.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] flex items-center justify-center text-white border-2 border-white">{requests.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('search')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'search' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Cari
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'friends' && (
          <motion.div 
            key="friends"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {friends.length === 0 ? (
              <div className="col-span-full py-20 bg-tan-50/50 rounded-[40px] border border-tan-100/50 flex flex-col items-center justify-center text-center px-10">
                <Users size={48} className="text-tan-200 mb-4" />
                <h3 className="text-xl font-extrabold text-slate-900">Belum Ada Teman</h3>
                <p className="text-slate-500 mt-2 max-w-xs">Cari teman kamu dan mulailah berdiskusi tentang buku favorit!</p>
                <button 
                  onClick={() => setActiveTab('search')}
                  className="mt-6 px-8 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20"
                >
                  Cari Teman Sekarang
                </button>
              </div>
            ) : friends.map(friend => (
              <div key={friend.id} className="p-5 bg-white rounded-[32px] border border-tan-50 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                <div className="flex items-center gap-4">
                  <Link to={`/app/user/profile/${friend.id}`} className="shrink-0 relative group">
                    <div className="w-16 h-16 rounded-[24px] bg-tan-50 flex items-center justify-center overflow-hidden border-2 border-transparent group-hover:border-primary transition-all">
                      {friend.avatar_url ? <img src={friend.avatar_url} className="w-full h-full object-cover" /> : <UserIcon className="text-tan-200" />}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full"></div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-slate-900 truncate tracking-tight">{friend.display_name}</h4>
                    <p className="text-[11px] font-bold text-slate-400 truncate">@{friend.username}</p>
                    {friend.last_read_book_title && (
                      <div className="mt-2 flex items-center gap-1.5 text-emerald-600 font-bold text-[10px]">
                        <Clock size={10} />
                        <span className="truncate">Baca {friend.last_read_book_title} (Hal.{friend.last_read_page})</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-5 pt-5 border-t border-tan-50 flex gap-2">
                  <button 
                    onClick={() => navigate(`/app/user/chat?with=${friend.id}`)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-tan-50 hover:bg-primary text-primary hover:text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
                  >
                    <MessageCircle size={14} /> Chat
                  </button>
                  <button 
                    onClick={() => unfriend(friend.id)}
                    className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all"
                    title="Hapus Teman"
                  >
                    <UserMinus size={18} />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'requests' && (
          <motion.div 
            key="requests"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {requests.length === 0 ? (
              <div className="py-20 bg-slate-50 rounded-[40px] border border-slate-100 flex flex-col items-center justify-center text-center">
                <Clock size={48} className="text-slate-200 mb-4" />
                <h3 className="text-xl font-extrabold text-slate-900">Tidak Ada Permintaan</h3>
                <p className="text-slate-500 mt-2">Belum ada permintaan pertemanan yang masuk.</p>
              </div>
            ) : requests.map(req => (
              <div key={req.id} className="p-5 bg-white rounded-[32px] border border-tan-50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-tan-50 flex items-center justify-center overflow-hidden">
                    {req.user.avatar_url ? <img src={req.user.avatar_url} className="w-full h-full object-cover" /> : <UserIcon className="text-tan-200" />}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900">{req.user.display_name}</h4>
                    <p className="text-[11px] font-bold text-slate-400 font-mono">@{req.user.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => respondToRequest(req.id, 'accepted')}
                    className="w-11 h-11 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                  >
                    <Check size={20} />
                  </button>
                  <button 
                    onClick={() => respondToRequest(req.id, 'rejected')}
                    className="w-11 h-11 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'search' && (
          <motion.div 
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="relative">
              <input 
                type="text" 
                placeholder="Cari nama atau username teman..." 
                className="w-full bg-white border-2 border-tan-50 rounded-[28px] px-12 py-5 focus:outline-none focus:border-primary transition-all font-bold text-slate-700 shadow-xl shadow-slate-100"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <button 
                onClick={handleSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                Cari
              </button>
            </div>

            <div className="space-y-3">
              {searchResults.map(u => (
                <div key={u.id} className="p-4 bg-white rounded-3xl border border-tan-50 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-tan-50 overflow-hidden flex items-center justify-center">
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserIcon className="text-tan-200" />}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 group-hover:text-primary transition-colors">{u.display_name}</h4>
                      <p className="text-[10px] font-bold text-slate-400">@{u.username}</p>
                    </div>
                  </div>
                  
                  {u.friendship ? (
                    <span className="px-4 py-2 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest italic">
                      {u.friendship.status === 'accepted' ? 'Berteman' : 'Menunggu'}
                    </span>
                  ) : (
                    <button 
                      onClick={() => sendRequest(u.id)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-tan-50 hover:bg-primary text-primary hover:text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
                    >
                      <UserPlus size={14} /> Tambah
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
