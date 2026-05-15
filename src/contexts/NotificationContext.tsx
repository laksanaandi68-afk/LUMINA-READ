import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import Swal from 'sweetalert2';
import { Bell } from 'lucide-react';

interface Reminder {
  id: string;
  title: string;
  description: string;
  scheduled_at: string;
  is_notified: boolean;
  status: string;
}

interface AppNotification {
  id: string;
  user_id: string;
  type: 'system' | 'reminder';
  title: string;
  content: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  reminders: Reminder[];
  notifications: AppNotification[];
  activeToasts: any[];
  unreadCount: number;
  fetchReminders: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeToasts, setActiveToasts] = useState<any[]>([]);

  const removeToast = (id: string) => {
    setActiveToasts(current => current.filter(t => t.id !== id));
  };

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_notified', false)
        .order('scheduled_at', { ascending: true });
      
      if (error) throw error;
      setReminders(data || []);
    } catch (err) {
      console.error("Error fetching reminders:", err);
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        // If table doesn't exist, this might fail, but we'll catch it
        console.warn("Notifications table might not exist yet:", error);
        return;
      }
      setNotifications(data || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  }, [profile]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Real-time synchronization
  useEffect(() => {
    if (!user || !profile) {
      setReminders([]);
      setNotifications([]);
      setActiveToasts([]);
      return;
    }

    fetchReminders();
    fetchNotifications();

    const syncChannel = supabase
      .channel(`notif_sync_${profile.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reminders',
        filter: `user_id=eq.${user.id}`
      }, () => fetchReminders())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, async (payload) => {
        const notif = payload.new as AppNotification;
        setNotifications(prev => [notif, ...prev].slice(0, 20));
        
        // Fetch sender details if needed for the toast
        let senderInfo = { avatar_url: undefined, display_name: undefined };
        if (notif.data?.sender_id) {
          const { data: sData } = await supabase
            .from('profiles')
            .select('avatar_url, display_name')
            .eq('id', notif.data.sender_id)
            .single();
          if (sData) {
            senderInfo.avatar_url = sData.avatar_url;
            senderInfo.display_name = sData.display_name;
          }
        }

        // Push to active toasts
        setActiveToasts(current => [{
          id: notif.id,
          type: notif.type,
          title: notif.title,
          content: notif.content,
          avatar_url: senderInfo.avatar_url || notif.data?.avatar_url,
          sender_name: senderInfo.display_name || notif.data?.sender_name,
          data: notif.data
        }, ...current].slice(0, 5));

        // Browser Native Notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(notif.title, {
            body: notif.content,
            icon: '/favicon.ico'
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, () => fetchNotifications())
      .subscribe();

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [user, profile, fetchReminders, fetchNotifications]);

  // Notification engine (tick every 10 seconds)
  useEffect(() => {
    if (!user || reminders.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      reminders.forEach(async (reminder) => {
        const scheduledTime = new Date(reminder.scheduled_at).getTime();
        
        // If scheduled time has reached or passed, and not yet notified
        if (now >= scheduledTime && !reminder.is_notified) {
          // 1. Create a persistent notification record
          const { data: newNotif, error: notifError } = await supabase
            .from('notifications')
            .insert([{
              user_id: user.id,
              type: 'reminder',
              title: `Pengingat: ${reminder.title}`,
              content: reminder.description || 'Waktunya sesuai jadwal Anda!',
              data: { reminder_id: reminder.id },
              is_read: false
            }])
            .select()
            .single();

          if (notifError) console.error("Error creating persistence for reminder:", notifError);

          // 2. Browser Native Notification (Optional enrichment)
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`🔔 ${reminder.title}`, {
              body: reminder.description || 'Waktunya sesuai jadwal Anda!',
              icon: '/favicon.ico'
            });
          }
            
          // 3. Update notified status in DB
          try {
            await supabase
              .from('reminders')
              .update({ is_notified: true, status: 'ongoing' })
              .eq('id', reminder.id);
            
            // fetchReminders() and fetchNotifications() will be updated via realtime channels
          } catch (err) {
            console.error("Error updating reminder status:", err);
          }
        }
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [user, reminders]);

  // Browser Notification Permission Request
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      reminders, 
      notifications, 
      activeToasts,
      unreadCount, 
      fetchReminders, 
      fetchNotifications, 
      markAsRead, 
      markAllAsRead,
      removeToast
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
