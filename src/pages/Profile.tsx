import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, Mail, Shield, Camera, Save, ArrowLeft, Phone, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function Profile() {
    const { profile, user, refreshProfile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState(profile?.display_name || user?.user_metadata?.full_name || '');
    const [username, setUsername] = useState(profile?.username || user?.user_metadata?.username || '');
    const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
    const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (profile) {
        setDisplayName(profile.display_name || displayName || '');
        setUsername(profile.username || username || '');
        setAvatarUrl(profile.avatar_url || avatarUrl || '');
        setPhoneNumber(profile.phone_number || phoneNumber || '');
      }
    }, [profile]);

    const handleUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      
      setLoading(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            display_name: displayName,
            username: username.toLowerCase().replace(/\s/g, ''),
            avatar_url: avatarUrl,
            phone_number: phoneNumber
          })
          .eq('id', user.id);

        if (error) throw error;

        await refreshProfile();

        Swal.fire({
          icon: 'success',
          title: 'Profil Diperbarui',
          text: 'Profil Anda telah berhasil diperbarui.',
          confirmButtonColor: '#D2B48C',
        });
      } catch (error: any) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message,
          confirmButtonColor: '#D2B48C',
        });
      } finally {
        setLoading(false);
      }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;

      // Validation: Size (Max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'File Terlalu Besar',
          text: 'Maksimal ukuran file adalah 2MB.',
          confirmButtonColor: '#D2B48C',
        });
        return;
      }

      // Validation: Type
      if (!file.type.startsWith('image/')) {
        Swal.fire({
          icon: 'error',
          title: 'Format Tidak Valid',
          text: 'Silakan pilih file gambar (JPG, PNG, atau GIF).',
          confirmButtonColor: '#D2B48C',
        });
        return;
      }

      setLoading(true);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // 1. Upload to Storage
        console.log("Attempting upload to path:", filePath);
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
           console.error("Supabase Storage Error Details:", uploadError);
           // Specific handling for common storage errors
           if (uploadError.message?.includes('bucket_not_found') || (uploadError as any).status === 404) {
             throw new Error('Bucket storage "avatars" belum dibuat di Supabase. Silakan buat bucket bernama "avatars" dengan akses Public.');
           }
           throw uploadError;
        }

        console.log("Upload success:", uploadData);

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        console.log("Public URL generated:", publicUrl);
        setAvatarUrl(publicUrl);

        // 3. Update Profile Table Immediately
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            avatar_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error("Profile update error after upload:", updateError);
          throw updateError;
        }

        await refreshProfile();

        Swal.fire({
          icon: 'success',
          title: 'Foto Profil Diperbarui',
          text: 'Foto profil Anda telah berhasil diunggah.',
          confirmButtonColor: '#D2B48C',
          timer: 1500,
          showConfirmButton: false
        });
      } catch (error: any) {
        console.error('Upload process error:', error);
        let errorMsg = error.message || 'Terjadi kesalahan saat mengunggah foto.';
        
        if (error.message?.toLowerCase().includes('bucket not found') || 
            error.error?.toLowerCase().includes('bucket not found') ||
            error.status === 404) {
          errorMsg = 'Bucket "avatars" tidak ditemukan. Silakan masuk ke Dashboard Supabase -> Storage -> Buat Bucket baru dengan nama "avatars" dan centang "Public".';
        }

        Swal.fire({
          icon: 'error',
          title: 'Gagal Unggah',
          text: errorMsg,
          confirmButtonColor: '#D2B48C',
        });
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-tan-50 rounded-xl text-primary transition-colors border border-tan-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Profil Anda</h1>
          <p className="text-slate-500 font-medium">Kelola identitas dan pengaturan akun Anda.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="md:col-span-1 border border-tan-100 bg-white rounded-[40px] p-8 shadow-sm text-center">
          <div className="relative inline-block mb-6 group">
            <div className={`w-32 h-32 rounded-[32px] bg-tan-50 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:scale-105 ${loading && 'animate-pulse opacity-50'}`}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center">
                  <User size={48} className="text-primary/20" />
                  <span className="text-[10px] font-bold text-primary/40 uppercase mt-1">Tidak Ada Foto</span>
                </div>
              )}
            </div>
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/*"
              className="hidden"
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -right-2 -bottom-2 w-10 h-10 bg-primary text-white rounded-2xl border-4 border-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform disabled:opacity-50"
              disabled={loading}
            >
              <Camera size={18} />
            </button>
          </div>
          <h3 className="text-xl font-bold text-slate-900">{profile?.display_name}</h3>
          <p className="text-sm font-bold text-slate-400">@{profile?.username}</p>
          <p className="text-xs text-primary font-bold uppercase tracking-widest mt-1 mb-6">
            {profile?.role === 'admin' ? 'Administrator' : 'Pembaca Aktif'}
          </p>
          <div className="pt-6 border-t border-tan-50 text-left space-y-4">
            <div className="flex items-center gap-3 text-slate-500">
              <Mail size={16} />
              <span className="text-sm font-medium">{profile?.email}</span>
            </div>
            {profile?.phone_number && (
              <div className="flex items-center gap-3 text-slate-500">
                <Phone size={16} />
                <span className="text-sm font-medium">{profile.phone_number}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-slate-500">
              <Shield size={16} />
              <span className="text-sm font-medium">Akun Terverifikasi</span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="md:col-span-2 bg-white border border-tan-100 rounded-[40px] p-10 shadow-sm">
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Masukkan nama lengkap Anda"
                    className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-tan-50 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Pengguna</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</div>
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="nama_pengguna"
                    className="w-full pl-10 pr-6 py-3 bg-slate-50 border border-tan-50 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nomor Telepon</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="tel" 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+62 812..."
                    className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-tan-50 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Foto Profil</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 bg-slate-50 border-2 border-dashed border-tan-100 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-tan-50 hover:border-primary/30 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                    <Upload size={18} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-600">Klik untuk unggah foto</p>
                    <p className="text-[10px] text-slate-400 font-medium">PNG, JPG atau GIF (Maks. 2MB)</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Alamat Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="email" 
                    disabled
                    value={profile?.email || user?.email || ''}
                    className="w-full pl-12 pr-6 py-3 bg-slate-100 border border-tan-50 rounded-2xl text-slate-400 outline-none text-sm font-medium cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="px-8 py-4 bg-primary text-white rounded-2xl font-bold shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center gap-2 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save size={18} />
                  Simpan Perubahan
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
