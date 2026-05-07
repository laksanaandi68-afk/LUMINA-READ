import React, { useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  Bell, 
  MessageSquare, 
  Users, 
  Heart, 
  Trash2, 
  CheckCircle, 
  Clock,
  ArrowRight,
  Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function Notifications() {
  const { notifications, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleNotifClick = (notif: any) => {
    markAsRead(notif.id);
    if (notif.type === 'friend_request') navigate('/app/user/friends');
    if (notif.type === 'new_message') navigate(`/app/user/chat?with=${notif.data?.sender_id}`);
    if (notif.type === 'friend_accepted') navigate(`/app/user/profile/${notif.data?.friend_id}`);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'friend_request': return <Users className="text-indigo-500" />;
      case 'friend_accepted': return <Heart className="text-emerald-500" />;
      case 'new_message': return <MessageSquare className="text-primary" />;
      default: return <Bell className="text-slate-400" />;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case 'friend_request': return 'bg-indigo-50';
      case 'friend_accepted': return 'bg-emerald-50';
      case 'new_message': return 'bg-primary/10';
      default: return 'bg-slate-50';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Pusat Notifikasi</h1>
          <p className="text-slate-500 font-medium mt-1">Pantau semua aktivitas sosial kamu di LuminaRead.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
          >
            <CheckCircle size={14} /> Tandai Semua Dibaca
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-[40px] border border-slate-100 p-20 text-center shadow-sm">
            <div className="w-20 h-20 bg-tan-50 rounded-[32px] flex items-center justify-center text-tan-200 mx-auto mb-6">
              <Bell size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Belum Ada Notifikasi</h3>
            <p className="text-slate-400 mt-2 font-medium">Semua aktivitas terbaru kamu akan muncul di sini.</p>
          </div>
        ) : (
          notifications.map((notif, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={notif.id}
              onClick={() => handleNotifClick(notif)}
              className={`group bg-white p-6 rounded-[32px] border transition-all cursor-pointer flex items-center gap-6
                ${!notif.is_read ? 'border-primary/20 shadow-xl shadow-primary/5 ring-1 ring-primary/5' : 'border-slate-100 hover:border-tan-200 shadow-sm'}
              `}
            >
              <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${getBg(notif.type)}`}>
                {getIcon(notif.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className={`font-black text-sm tracking-tight ${!notif.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                    {notif.title}
                  </h4>
                  {!notif.is_read && (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest rounded-full">Baru</span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-500 line-clamp-2 leading-relaxed">
                  {notif.content}
                </p>
                <div className="flex items-center gap-4 mt-3">
                   <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-wide">
                      <Clock size={12} />
                      <span>{new Date(notif.created_at).toLocaleDateString('id-ID', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                   </div>
                </div>
              </div>

              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                <div className="w-10 h-10 bg-tan-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:text-primary transition-colors">
                  <ArrowRight size={18} />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
