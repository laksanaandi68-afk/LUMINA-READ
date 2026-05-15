import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BookPlus, Plus, X, Camera, Save, ArrowLeft, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { motion } from 'motion/react';

export default function AddBook() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    genre: 'Fiksi',
    total_pages: 100,
    cover_url: '',
    status: 'Belum Dimulai',
    synopsis: ''
  });

  const genres = ['Fiksi', 'Non-Fiksi', 'Sci-Fi', 'Fantasi', 'Romansa', 'Misteri', 'Sejarah', 'Pengembangan Diri'];

  const isMounted = useRef(true);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({ icon: 'error', title: 'File Terlalu Besar', text: 'Maksimal 2MB' });
      return;
    }

    // Create local preview immediately
    if (localPreview) URL.revokeObjectURL(localPreview);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploading(true);
    
    // Safety timeout for upload
    const uploadTimeout = setTimeout(() => {
      if (isMounted.current) setUploading(false);
      Swal.fire({
        icon: 'error',
        title: 'Timeout',
        text: 'Unggah sampul memakan waktu terlalu lama. Periksa koneksi internet Anda atau coba file yang lebih kecil.',
        confirmButtonColor: '#D2B48C',
      });
    }, 45000); // 45 seconds timeout

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `covers/${fileName}`;

      console.log("Attempting upload to book-covers:", filePath);
      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      clearTimeout(uploadTimeout);

      if (uploadError) {
        console.error("Supabase Storage Error Details:", uploadError);
        throw uploadError;
      }

      console.log("Upload successful, fetching public URL...");
      const { data: { publicUrl } } = supabase.storage
        .from('book-covers')
        .getPublicUrl(filePath);

      if (isMounted.current) {
        setFormData(prev => ({ ...prev, cover_url: publicUrl }));
        setLocalPreview(null); // Clear preview once we have real URL
        
        Swal.fire({
          icon: 'success',
          title: 'Berhasil diunggah',
          text: 'Sampul buku telah masuk ke koleksi!',
          timer: 1500,
          showConfirmButton: false,
          confirmButtonColor: '#D2B48C',
        });
      }
    } catch (error: any) {
      clearTimeout(uploadTimeout);
      console.error('Upload process error:', error);
      let errorMsg = 'Terjadi kesalahan saat mengunggah sampul buku.';
      
      if (error.message?.toLowerCase().includes('bucket not found') || 
          error.error?.toLowerCase().includes('bucket not found') ||
          error.status === 404) {
        errorMsg = 'Bucket "book-covers" tidak ditemukan. Silakan masuk ke Dashboard Supabase -> Storage -> Buat Bucket baru dengan nama "book-covers" dan centang pilihan "Public".';
      } else if (error.message?.includes('storage_quota_exceeded')) {
        errorMsg = 'Kapasitas penyimpanan Supabase Anda sudah penuh.';
      }

      if (isMounted.current) {
        setLocalPreview(null);
        Swal.fire({
          icon: 'error',
          title: 'Gagal Unggah',
          text: errorMsg,
          confirmButtonColor: '#D2B48C',
        });
      }
    } finally {
      if (isMounted.current) setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title.trim() || !formData.author.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Judul dan Penulis wajib diisi!',
      });
      return;
    }

    if (formData.total_pages <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Total halaman harus lebih besar dari 0!',
      });
      return;
    }

    setLoading(true);
    
    // Safety timeout to prevent stuck button
    const timeoutId = setTimeout(() => {
      setLoading(false);
      console.warn('Saving operation timed out after 10s');
    }, 10000);

    try {
      console.log('Attempting to save book for user:', user.id);
      
      // Basic insert object with all standard fields
      const bookToInsert = {
        owner_id: user.id,
        title: formData.title.trim(),
        author: formData.author.trim(),
        genre: formData.genre,
        total_pages: Math.max(1, formData.total_pages || 100),
        status: formData.status || 'Belum Dimulai',
        cover_url: formData.cover_url || null,
        synopsis: formData.synopsis || '',
        content: '' // Required by some previous versions of schema
      };

      // Perform single, robust insert attempt
      const { error } = await supabase
        .from('books')
        .insert([bookToInsert]);

      clearTimeout(timeoutId);

      if (error) {
        console.error('Supabase Error details:', error);
        throw error;
      }

      console.log('Book saved successfully');

      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Buku berhasil ditambahkan ke koleksi Anda.',
        confirmButtonColor: '#D2B48C',
        timer: 1500,
        showConfirmButton: false
      });
      
      navigate('/app/user/library');
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Final Save Error:', err);
      
      let errorMessage = err.message || 'Terjadi kesalahan sistem database.';
      if (err.code === '42501') {
        errorMessage = 'Izin ditolak. Silakan coba login ulang.';
      } else if (err.code === '23502') {
        errorMessage = 'Gagal menyimpan: Ada data wajib yang belum terisi di database.';
      }

      await Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: errorMessage,
        confirmButtonColor: '#D2B48C',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 md:space-y-10 pb-20 px-1">
      <header className="flex items-center gap-4 md:gap-6 mb-8 md:mb-12">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white border border-tan-50 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary transition-all shadow-sm shrink-0"
        >
          <ArrowLeft size={20} md={22} />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight truncate">Tambah Buku</h1>
          <p className="text-slate-500 font-medium text-xs md:text-base line-clamp-1 italic">Lengkapi detail koleksi baru Anda.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
        {/* Preview Card - Hidden on very small screens or made compact */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-32 space-y-4 md:space-y-6">
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Pratinjau</p>
            <div className="bg-white rounded-[32px] md:rounded-[40px] border border-tan-50 p-5 md:p-6 shadow-xl shadow-slate-100 overflow-hidden group transition-all">
              <div className="aspect-[3/4.2] rounded-[24px] md:rounded-[32px] bg-slate-50 border border-dashed border-tan-100 mb-4 md:mb-6 flex items-center justify-center overflow-hidden group-hover:scale-[1.02] transition-transform duration-500">
                {localPreview ? (
                  <img src={localPreview} alt="Local Preview" className="w-full h-full object-cover" />
                ) : formData.cover_url ? (
                  <img src={formData.cover_url} alt="Cover Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center space-y-2">
                    <BookPlus size={48} md={64} className="text-slate-200 mx-auto" strokeWidth={1} />
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Belum Ada Sampul</p>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                 <span className="text-[9px] font-black text-primary uppercase tracking-widest block">{formData.genre}</span>
                 <h3 className="text-base md:text-xl font-extrabold text-slate-900 line-clamp-1 leading-tight">{formData.title || 'Judul Buku'}</h3>
                 <p className="text-xs font-bold text-slate-400 truncate">Oleh {formData.author || 'Penulis'}</p>
                 <div className="pt-3 mt-3 border-t border-tan-50 flex items-center justify-between">
                    <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formData.total_pages} Hal</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[7px] md:text-[9px] font-black uppercase tracking-widest ${
                      formData.status === 'Selesai' ? 'bg-emerald-50 text-emerald-500' :
                      formData.status === 'Sedang Dibaca' ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {formData.status}
                    </span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[48px] border border-tan-50 shadow-sm space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul Buku</label>
                <input 
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Judul buku"
                  className="w-full px-5 py-3.5 md:px-6 md:py-4 bg-slate-50 border border-tan-50 rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-xs md:text-sm"
                />
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Penulis</label>
                <input 
                  type="text"
                  required
                  value={formData.author}
                  onChange={(e) => setFormData({...formData, author: e.target.value})}
                  placeholder="Nama penulis"
                  className="w-full px-5 py-3.5 md:px-6 md:py-4 bg-slate-50 border border-tan-50 rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-xs md:text-sm"
                />
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                <select 
                  value={formData.genre}
                  onChange={(e) => setFormData({...formData, genre: e.target.value})}
                  className="w-full px-5 py-3.5 md:px-6 md:py-4 bg-slate-50 border border-tan-50 rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-xs md:text-sm appearance-none cursor-pointer"
                >
                  {genres.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Halaman</label>
                <input 
                  type="number"
                  min="1"
                  required
                  value={formData.total_pages || 0}
                  onChange={(e) => setFormData({...formData, total_pages: parseInt(e.target.value) || 0})}
                  className="w-full px-5 py-3.5 md:px-6 md:py-4 bg-slate-50 border border-tan-50 rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-xs md:text-sm"
                />
              </div>

              {/* Cover Selection Logic */}
              <div className="md:col-span-2 space-y-4">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Sampul Buku</label>
                
                <div className="relative group mx-auto w-full max-w-[200px] md:max-w-[240px]">
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <div 
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`aspect-[3/4] rounded-[32px] md:rounded-[40px] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative shadow-inner ${
                      formData.cover_url || localPreview ? 'border-primary bg-white' : 'border-tan-100 bg-slate-50 hover:bg-slate-100 hover:border-primary'
                    }`}
                  >
                    {uploading ? (
                      <div className="text-center space-y-4 z-10 w-full h-full flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                        {localPreview && (
                          <img src={localPreview} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                        )}
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl md:rounded-3xl shadow-sm flex items-center justify-center mx-auto relative z-10">
                          <Loader2 className="animate-spin text-primary" size={24} md={32} />
                        </div>
                        <p className="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-widest relative z-10">Unggah...</p>
                      </div>
                    ) : (localPreview || formData.cover_url) ? (
                      <>
                        <img src={localPreview || formData.cover_url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/60 transition-opacity flex flex-col items-center justify-center backdrop-blur-[2px] opacity-0 group-hover:opacity-100">
                          <Camera className="text-white mb-2" size={24} md={32} />
                          <p className="text-[8px] md:text-[10px] font-black text-white uppercase tracking-widest text-center">Ganti Sampul</p>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-3 md:space-y-4 group-hover:scale-105 transition-all duration-300 p-4">
                        <div className="w-14 h-14 md:w-20 md:h-20 bg-white rounded-[24px] md:rounded-[32px] shadow-lg flex items-center justify-center text-slate-200 group-hover:text-primary transition-all">
                          <Camera size={28} md={40} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest">Pilih Sampul</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {(formData.cover_url || localPreview) && (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData(prev => ({...prev, cover_url: ''}));
                        setLocalPreview(null);
                      }}
                      className="absolute -top-2 -right-2 w-8 h-8 md:w-10 md:h-10 bg-rose-500 text-white rounded-xl md:rounded-2xl shadow-lg flex items-center justify-center hover:bg-rose-600 transition-all z-20"
                    >
                      <X size={16} md={20} />
                    </button>
                  )}
                </div>
                <p className="text-[8px] md:text-[9px] font-bold text-slate-400 text-center px-4 md:px-10 leading-relaxed italic">Rekomendasi 3:4 atau vertikal (Maks 2MB).</p>
              </div>

              <div className="md:col-span-2 space-y-2 md:space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Membaca</label>
                <div className="flex gap-2 md:gap-4 overflow-x-auto no-scrollbar pb-2 px-1">
                  {['Belum Dimulai', 'Sedang Dibaca', 'Selesai'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({...formData, status: s})}
                      className={`flex-1 min-w-[100px] py-3 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all border shrink-0 ${
                        formData.status === s 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xl' 
                        : 'bg-white text-slate-400 border-tan-50 hover:border-primary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 space-y-1.5 md:space-y-2">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sinopsis (Wajib)</label>
                <textarea 
                  required
                  value={formData.synopsis}
                  onChange={(e) => setFormData({...formData, synopsis: e.target.value})}
                  placeholder="Tulis sedikit tentang isi buku..."
                  className="w-full px-5 py-4 md:px-6 md:py-5 bg-slate-50 border border-tan-50 rounded-[24px] md:rounded-[32px] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-xs md:text-sm h-32 md:h-40 resize-none shadow-inner"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading || uploading}
              className="w-full py-4 md:py-6 bg-primary text-white rounded-2xl md:rounded-[32px] font-black text-base md:text-lg hover:bg-primary-dark transition-all shadow-xl md:shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} md={22} /> Menambahkan...
                </>
              ) : (
                <>
                  <Save size={20} md={22} /> Simpan Buku
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
