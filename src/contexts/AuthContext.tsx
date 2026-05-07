import { useState, useContext, createContext, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import Swal from 'sweetalert2';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  username: string;
  role: 'admin' | 'user';
  avatar_url?: string;
  phone_number?: string;
  monthly_target?: number;
  daily_target?: number;
  created_at: string;
  status?: 'active' | 'banned';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔥 Auth handling robust & persistent
  useEffect(() => {
    let mounted = true;

    // 1. Initial Logic
    const initializeAuth = async () => {
      // Safety timeout to ensure loading definitely stops
      const timeoutId = setTimeout(() => {
        if (mounted) {
          console.warn("Auth initialization timed out, forcing loading false.");
          setLoading(false);
        }
      }, 2500);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.error("Auth getSession error:", error);
          setLoading(false);
          return;
        }

        const initialUser = session?.user ?? null;
        setUser(initialUser);
        
        if (initialUser) {
          // Fetch profile but don't let it block indefinitely - 1.5s is plenty
          await Promise.race([
            fetchProfile(initialUser.id),
            new Promise(resolve => setTimeout(resolve, 1500))
          ]);
        }
      } catch (err) {
        console.error("Critical Auth Init Failure:", err);
      } finally {
        clearTimeout(timeoutId);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 2. Auth Listener
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log("Auth Event:", event);
        const currentUser = session?.user ?? null;
        
        // Update user state
        setUser(currentUser);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (currentUser) {
            await fetchProfile(currentUser.id);
          }
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setUser(null);
          setLoading(false);
          localStorage.clear();
        }

        if (event === 'INITIAL_SESSION') {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      authListener.unsubscribe();
    };
  }, []);

  // Separate Effect for Profile Subscription to avoid auth listener re-runs
  useEffect(() => {
    if (!user?.id) return;
    
    let mounted = true;
    const profileSubscription = supabase
      .channel(`profile:${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'profiles',
        filter: `id=eq.${user.id}`
      }, (payload) => {
        if (mounted && payload.new) {
          console.log("Profile updated via realtime:", payload.new);
          setProfile(payload.new as UserProfile);
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(profileSubscription);
    };
  }, [user?.id]);

  // 🔥 fetch profile lebih aman & auto-healing
  const fetchProfile = async (uid: string) => {
    if (!uid) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        console.error('Fetch profile error:', error);
        return;
      }

      // Check if profile is missing CRITICAL data (healing)
      if (!data || !data.display_name || !data.username || !data.email) {
        // Fallback user check
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser || authUser.id !== uid) {
          if (data) setProfile(data as UserProfile);
          return;
        }

        console.log("Healing or creating profile for:", uid);
        const baseUsername = data?.username || authUser.email?.split('@')[0] || 'user';
        const uniqueSuffix = authUser.id.substring(1, 6);
        const metadata = authUser.user_metadata || {};

        const { data: updatedProfile, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: uid,
            email: authUser.email || data?.email,
            display_name: data?.display_name || metadata.full_name || metadata.displayName || baseUsername,
            username: data?.username || metadata.username || (baseUsername.toLowerCase().replace(/[^a-z0-9]/g, '') + uniqueSuffix),
            role: data?.role || (authUser.email === 'admin@gmail.com' ? 'admin' : 'user'),
          }, { 
            onConflict: 'id' 
          })
          .select()
          .maybeSingle();

        if (upsertError) {
          console.error('Profile healing error:', upsertError);
          // If upsert fails, it might be due to missing columns.
          // Fallback to basic state if record exists or blank Profile
          if (data) {
            setProfile(data);
          } else {
            // Last resort: minimal profile object to unlock UI
            setProfile({
              id: uid,
              email: authUser.email || '',
              display_name: metadata.full_name || baseUsername,
              username: baseUsername,
              role: authUser.email === 'admin@gmail.com' ? 'admin' : 'user',
              created_at: new Date().toISOString()
            });
          }
        } else if (updatedProfile) {
          setProfile(updatedProfile);
        }
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Critical Fetch profile error:', err);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  useEffect(() => {
    if (profile?.status === 'banned') {
      Swal.fire({
        icon: 'error',
        title: 'Akun Ditangguhkan',
        text: 'Akun Anda telah diblokir oleh moderator karena melanggar ketentuan.',
        confirmButtonText: 'Keluar',
        allowOutsideClick: false
      }).then(() => {
        supabase.auth.signOut();
      });
    }
  }, [profile?.status]);

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);