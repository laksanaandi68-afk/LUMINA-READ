import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { X, MessageSquare, Users, Heart, Bell } from 'lucide-react';

export interface ToastData {
  id: string;
  type: 'friend_request' | 'friend_accepted' | 'system' | 'reminder';
  title: string;
  content: string;
  avatar_url?: string;
  sender_name?: string;
  data?: any;
  onClose: (id: string) => void;
}

export const NotificationToast: React.FC<ToastData> = ({ 
  id, type, title, content, avatar_url, sender_name, data, onClose 
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const handleClick = () => {
    if (type === 'friend_request') navigate('/app/user/friends');
    if (type === 'friend_accepted') navigate(`/app/user/profile/${data?.friend_id}`);
    if (type === 'reminder') navigate('/app/user/calendar');
    onClose(id);
  };

  const getIcon = () => {
    switch (type) {
      case 'friend_request': return <Users size={16} />;
      case 'friend_accepted': return <Heart size={16} />;
      default: return <Bell size={16} />;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, y: 0, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, x: 20 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full max-w-sm bg-white/95 backdrop-blur-md border border-tan-50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[24px] p-4 flex items-center gap-4 cursor-pointer relative group overflow-hidden"
      onClick={handleClick}
    >
      {/* Indicator Bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
        type === 'friend_request' ? 'bg-indigo-500' : 
        type === 'reminder' ? 'bg-amber-500' :
        'bg-emerald-500'
      }`} />

      {/* Avatar / Icon container */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-tan-50 flex items-center justify-center overflow-hidden border border-tan-100 shadow-inner">
          {avatar_url ? (
            <img src={avatar_url} alt={sender_name} className="w-full h-full object-cover" />
          ) : (
            <div className="text-primary">{getIcon()}</div>
          )}
        </div>
        {!avatar_url && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-tan-50">
                <div className="text-primary scale-75">{getIcon()}</div>
            </div>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.15em] mb-0.5">
            {type === 'friend_request' ? 'Pertemanan' : 
             type === 'reminder' ? 'Pengingat' :
             'Notifikasi'}
          </p>
          <span className="text-[9px] font-bold text-slate-300">Baru saja</span>
        </div>
        <p className="text-[13px] font-extrabold text-slate-900 truncate tracking-tight">
          {sender_name || title}
        </p>
        <p className="text-[11px] font-medium text-slate-500 truncate leading-tight mt-0.5">
          {content}
        </p>
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClose(id);
        }}
        className="shrink-0 p-1.5 text-slate-200 hover:text-slate-400 hover:bg-slate-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

export const ToastContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:top-6 z-[9999] flex flex-col gap-3 pointer-events-none items-center md:items-end">
      <div className="pointer-events-auto flex flex-col gap-3 w-full max-w-sm">
        {children}
      </div>
    </div>
  );
};
