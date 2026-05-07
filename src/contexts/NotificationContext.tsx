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

interface NotificationContextType {
  reminders: Reminder[];
  fetchReminders: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);

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

  // Real-time synchronization
  useEffect(() => {
    if (!user) return;

    fetchReminders();

    const channel = supabase
      .channel('reminders_realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reminders',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchReminders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchReminders]);

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
    <NotificationContext.Provider value={{ reminders, fetchReminders }}>
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
