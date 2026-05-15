import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BookOpen, Mail, Lock, User as UserIcon, ArrowRight, Phone, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function LoginPage() {
  const { user, profile, logout } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));

  React.useEffect(() => {
    if (searchParams.get('register') === 'true') {
      setIsLogin(false);
    }
  }, [searchParams]);

  const isConfigMissing = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  React.useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        const role = profile?.role || (user.email === 'admin@gmail.com' ? 'admin' : 'user');
        navigate(role === 'admin' ? '/app/admin/dashboard' : '/app/user/dashboard', { replace: true });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [user, profile, navigate]);

  const handleLogout = async () => {
    await logout();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleAuth triggered", { isLogin, email });
    
    if (!supabase.auth) {
      Swal.fire('Config Error', 'Supabase URL/Key has not been set in Settings.', 'error');
      return;
    }

    setLoading(true);

    // Fail-safe: Reset loading if it takes too long (> 10s)
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        Swal.fire({
          icon: 'warning',
          title: 'Waktu Habis',
          text: 'Proses login memakan waktu terlalu lama. Periksa koneksi internet Anda atau coba segarkan halaman.',
        });
      }
    }, 10000);

    try {
      // Basic config validation
      const url = import.meta.env.VITE_SUPABASE_URL || '';
      if (!url.startsWith('https://')) {
        clearTimeout(timeout);
        throw new Error('Konfigurasi Supabase tidak valid. Pastikan VITE_SUPABASE_URL benar.');
      }

      const cleanEmail = email.trim();

      if (isLogin) {
        // =====================
        // LOGIN PROCESS
        // =====================
        console.log("LoginPage: Attempting login for", cleanEmail);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

        clearTimeout(timeout);
        if (error) {
          console.error("LoginPage: Login error", error);
          setLoading(false); 
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Email atau password salah. Jika Anda baru, silakan DAFTAR terlebih dahulu.');
          } else if (error.message.includes('Email not confirmed')) {
            throw new Error('Konfirmasi email diperlukan. Silakan cek inbox Anda.');
          }
          throw error;
        }

        if (data?.user) {
          console.log("LoginPage: Login success for", data.user.id);
          
          setLoading(false);
          clearTimeout(timeout);
          
          const isActuallyAdmin = cleanEmail === 'admin@gmail.com' || data.user.email === 'admin@gmail.com';
          const targetPath = isActuallyAdmin ? '/app/admin/dashboard' : '/app/user/dashboard';
          
          Swal.fire({
            icon: 'success',
            title: 'Berhasil Masuk',
            text: 'Mengarahkan ke Dashboard...',
            timer: 1000,
            showConfirmButton: false,
            position: 'center',
          });

          console.log("LoginPage: Navigating to", targetPath);
          navigate(targetPath, { replace: true });
        } else {
          // Fallback if no user and no error (shouldn't happen)
          setLoading(false);
        }
      } else {
        // =====================
        // SIGNUP PROCESS
        // =====================
        console.log("Signup branch initiated");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: displayName,
              username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
              phone_number: phoneNumber,
            }
          }
        });

        console.log("Signup response received:", { userId: data?.user?.id, session: !!data.session, error });

        if (error) {
          console.error("LoginPage: Signup error", error);
          setLoading(false);
          clearTimeout(timeout);
          throw error;
        }

        // Success: Stop loading now so user can interact with messages
        setLoading(false);
        clearTimeout(timeout);

        if (data.session === null) {
          await Swal.fire({
            icon: 'info',
            title: 'Konfirmasi Email',
            text: 'Tautan konfirmasi telah dikirim ke email Anda. Silakan verifikasi untuk dapat masuk.',
            confirmButtonColor: '#bc9c74',
          });
          setIsLogin(true);
          return;
        }

        await Swal.fire({
          icon: 'success',
          title: 'Akun Berhasil Dibuat',
          text: 'Selamat datang di LuminaRead!',
          timer: 1500,
          showConfirmButton: false,
          position: 'center',
        });

        navigate('/app/user/dashboard', { replace: true });
      }
    } catch (error: any) {
      console.error('Auth Error caught in LoginPage:', error);
      setLoading(false);
      
      let msg = error.message || 'Terjadi kesalahan sistem.';
      
      if (msg.includes('Database error saving new user')) {
        msg = 'DATABASE ERROR: Gagal menyimpan data user.\n\nSOLUSI: Silakan buka Supabase Dashboard > SQL Editor, salin isi file "database.sql", lalu klik "Run".';
      } else if (msg.includes('Failed to fetch')) {
        msg = 'KONEKSI GAGAL: Tidak bisa terhubung ke Supabase. Periksa internet atau URL Supabase Anda.';
      }

      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] px-4 font-sans relative overflow-hidden">
      <div className="max-w-md w-full relative z-10">
        {/* Back to Home Button */}
        <button 
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-slate-400 hover:text-primary transition-all group font-bold text-sm outline-none"
        >
          <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center group-hover:border-primary transition-colors">
            <ArrowRight size={16} className="rotate-180" />
          </div>
          Kembali ke Beranda
        </button>

        <div className="bg-white rounded-[48px] shadow-2xl shadow-black/5 overflow-hidden border border-slate-100">
          <div className="p-12 text-center bg-primary text-white relative">
            <div className="relative z-10">
              <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-8 backdrop-blur-md border border-white/30">
                <BookOpen size={40} strokeWidth={1.5} />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight">LuminaRead</h1>
              <p className="text-white/90 text-[11px] mt-4 font-bold uppercase tracking-[0.15em] leading-relaxed max-w-[280px] mx-auto">
                {isLogin ? "Selamat datang kembali di tempat perlindungan buku Anda" : "Mulai perjalanan membaca Anda hari ini"}
              </p>
            </div>
          </div>

          <div className="px-10 py-12">
            {isConfigMissing && (
              <div className="mb-8 p-5 bg-rose-50 border border-rose-100 rounded-2xl text-[11px] text-rose-600 font-bold leading-relaxed">
                ⚠️ KESALAHAN KONFIGURASI: Periksa Environment Variables Supabase Anda.
              </div>
            )}
            
            <form onSubmit={handleAuth} className="space-y-8">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="space-y-8"
                  >
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                      <div className="relative">
                        <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                          type="text" 
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Nama lengkap..."
                          className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-transparent rounded-[24px] focus:bg-white focus:border-primary/30 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:text-slate-300"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">@</span>
                        <input 
                          type="text" 
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="username"
                          className="w-full pl-12 pr-6 py-5 bg-slate-50 border border-transparent rounded-[24px] focus:bg-white focus:border-primary/30 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:text-slate-300"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor Telepon</label>
                      <div className="relative">
                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                          type="tel" 
                          required
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="0812..."
                          className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-transparent rounded-[24px] focus:bg-white focus:border-primary/30 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:text-slate-300"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Email</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-transparent rounded-[24px] focus:bg-white focus:border-primary/30 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Kata Sandi</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-14 pr-14 py-5 bg-slate-50 border border-transparent rounded-[24px] focus:bg-white focus:border-primary/30 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-6 bg-primary text-white rounded-[28px] font-bold text-lg shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50 mt-10 flex items-center justify-center gap-3 group active:scale-95"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>{isLogin ? 'Masuk' : 'Daftar Gratis'}</span>
                    <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-12 text-center space-y-4">
              <p className="text-sm text-slate-400 font-semibold tracking-tight">
                {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="ml-2 font-black text-primary hover:underline transition-all"
                >
                  {isLogin ? 'Daftar Gratis' : 'Masuk'}
                </button>
              </p>
              
              {supabase.auth && (
                <button
                  onClick={handleLogout}
                  className="text-[10px] font-bold text-slate-300 uppercase tracking-widest hover:text-red-400 transition-colors"
                >
                  Gunakan Akun Lain (Logout)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
