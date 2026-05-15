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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  refreshProfile: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔥 Auth handling robust & persistent
  useEffect(() => {
    let mounted = true;

    // 1. Unified Initialization logic
    const initializeAuth = async () => {
      // Safety timeout: stop loading after 4 seconds no matter what to avoid stuck UI
      const safetyTimeout = setTimeout(() => {
        if (mounted) {
          console.warn("Auth initialization safety trigger: forcing loading to false");
          setLoading(false);
        }
      }, 4000);

      try {
        // Try to get session from storage first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn("Session fetch warning:", sessionError.message);
          // If refresh token is missing or invalid, we MUST clear the session to allow new login
          if (sessionError.message?.includes('Refresh Token Not Found') || sessionError.message?.includes('refresh_token_not_found')) {
            console.error("Critical Token Error detected, purging session...");
            await supabase.auth.signOut();
            localStorage.removeItem('lumina-read-auth-stable');
          }
        }

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          setLoading(false); 
          await fetchProfile(session.user.id);
        } else {
          // Secondary check with getUser for security/validity
          const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
          
          if (userError && (userError.message?.includes('Refresh Token') || userError.message?.includes('refresh_token'))) {
             await supabase.auth.signOut();
             localStorage.removeItem('lumina-read-auth-stable');
          }

          if (mounted) {
            if (authUser) {
              setUser(authUser);
              setLoading(false);
              await fetchProfile(authUser.id);
            } else {
              setLoading(false);
            }
          }
        }
      } catch (err) {
        console.error("Auth Init Error:", err);
      } finally {
        if (mounted) {
          clearTimeout(safetyTimeout);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // 2. Auth Listener
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log("Auth Event Update:", event);
        const currentUser = session?.user ?? null;
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (currentUser) {
            setUser(currentUser);
            // Always ensure loading is false if we have a definitive user state
            setLoading(false);
            await fetchProfile(currentUser.id);
          } else if (event !== 'INITIAL_SESSION') {
            // If sign in attempt failed or token expired
            setLoading(false);
          }
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
      // 1. Try to get existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        console.error('Fetch profile error:', error);
      }

      // 2. If record is missing or incomplete, try to heal it
      if (!data || !data.display_name || !data.username) {
        console.log("Profile missing or incomplete for:", uid, "attempting healing...");
        
        let authUser;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          authUser = user;
        } catch (authErr) {
          console.error("Auth user fetch error during healing:", authErr);
        }

        if (!authUser || authUser.id !== uid) {
          if (data) setProfile(data as UserProfile);
          return;
        }

        const baseUsername = data?.username || authUser.email?.split('@')[0] || 'pembaca';
        const uniqueSuffix = authUser.id.substring(0, 5); // Use first 5 instead of 1-6 for slightly more randomness
        const metadata = authUser.user_metadata || {};

        // Use upsert to ensure the record exists
        try {
          const { data: healedProfile, error: healError } = await supabase
            .from('profiles')
            .upsert({
              id: uid,
              email: authUser.email || data?.email || '',
              display_name: data?.display_name || metadata.full_name || metadata.displayName || baseUsername,
              username: data?.username || metadata.username || (baseUsername.toLowerCase().replace(/[^a-z0-9]/g, '') + uniqueSuffix),
              role: data?.role || (authUser.email === 'admin@gmail.com' ? 'admin' : 'user'),
            }, { 
              onConflict: 'id' 
            })
            .select()
            .maybeSingle();

          if (healError) {
            console.error('Profile healing COMPLETELY failed:', healError);
            throw healError;
          } else if (healedProfile) {
            console.log("Profile successfully healed!");
            setProfile(healedProfile as UserProfile);
          }
        } catch (upsertErr) {
          console.error("Upsert error in fetchProfile:", upsertErr);
          // Fallback to local profile object so UI doesn't hang
          setProfile({
            id: uid,
            email: authUser.email || '',
            display_name: metadata.full_name || baseUsername,
            username: baseUsername + uniqueSuffix,
            role: authUser.email === 'admin@gmail.com' ? 'admin' : 'user',
            created_at: new Date().toISOString()
          } as UserProfile);
        }
      } else {
        setProfile(data as UserProfile);
      }
    } catch (err) {
      console.error('Critical Fetch profile error:', err);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  const logout = async () => {
    try {
      // 1. Show immediate feedback
      Swal.fire({
        title: 'Keluar...',
        text: 'Membersihkan sesi Anda',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // 2. Clear Supabase session (attempts to notify server)
      // We wrap it in a timeout so it doesn't hang the whole process
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
      ]).catch(err => console.warn("SignOut notice error (expected on slow net):", err));
      
      // 3. Force purge all storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear specifically the Supabase persistence key
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('auth') || key.includes('lumina'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      // 4. Clear local states last to trigger reactivity in components
      setUser(null);
      setProfile(null);
      setLoading(false);

      Swal.close();
      
      // Force a hard reload or navigation to ensure all state is purged
      window.location.href = '/';
    } catch (err) {
      console.error("Critical Logout error:", err);
      setUser(null);
      setProfile(null);
      setLoading(false);
      localStorage.clear();
      Swal.close();
    }
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
        logout();
      });
    }
  }, [profile?.status]);

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);