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
  type: 'friend_request' | 'friend_accepted' | 'new_message' | 'system';
  title: string;
  content: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  reminders: Reminder[];
  notifications: AppNotification[];
  unreadCount: number;
  fetchReminders: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

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
    if (!user || !profile) return;

    fetchReminders();
    fetchNotifications();

    const remindersChannel = supabase
      .channel('reminders_realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reminders',
        filter: `user_id=eq.${user.id}`
      }, () => fetchReminders())
      .subscribe();

    const notificationsChannel = supabase
      .channel(`notifications_realtime_${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new as AppNotification, ...prev].slice(0, 20));
        
        // Show toast for new notification
        Swal.fire({
          title: (payload.new as AppNotification).title,
          text: (payload.new as AppNotification).content,
          icon: 'info',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, () => fetchNotifications())
      .subscribe();

    return () => {
      supabase.removeChannel(remindersChannel);
      supabase.removeChannel(notificationsChannel);
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
          // Trigger notification
          Swal.fire({
            title: `🔔 Ingat: ${reminder.title}`,
            text: reminder.description || 'Saatnya beraktivitas!',
            icon: 'info',
            toast: true,
            position: 'top-end',
            showConfirmButton: true,
            confirmButtonText: 'Oke',
            timer: 10000,
            timerProgressBar: true,
          });

          // Play a soft sound if possible (optional, maybe too complex for now)
          
          // Update notified status in DB
          try {
            await supabase
              .from('reminders')
              .update({ is_notified: true, status: 'ongoing' })
              .eq('id', reminder.id);
            
            // Local state update will be handled by fetchReminders via real-time channel
          } catch (err) {
            console.error("Error updating reminder status:", err);
          }
        }
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [user, reminders]);

  return (
    <NotificationContext.Provider value={{ 
      reminders, 
      notifications, 
      unreadCount, 
      fetchReminders, 
      fetchNotifications, 
      markAsRead, 
      markAllAsRead 
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
