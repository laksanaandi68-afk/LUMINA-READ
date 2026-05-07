import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BookPlus, Plus, X, Camera, Save, ArrowLeft, Image as ImageIcon, Loader2 } from 'lucide-react';
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({ icon: 'error', title: 'File Terlalu Besar', text: 'Maksimal 2MB' });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('book-covers')
        .getPublicUrl(filePath);

      setFormData({ ...formData, cover_url: publicUrl });
      
      Swal.fire({
        icon: 'success',
        title: 'Berhasil diunggah',
        text: 'Sampul buku telah masuk ke koleksi!',
        timer: 1500,
        showConfirmButton: false,
        confirmButtonColor: '#D2B48C',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      let errorMsg = 'Terjadi kesalahan saat mengunggah sampul buku.';
      
      if (error.message?.toLowerCase().includes('bucket not found') || 
          error.error?.toLowerCase().includes('bucket not found') ||
          error.status === 404) {
        errorMsg = 'Bucket "book-covers" tidak ditemukan. Silakan masuk ke Dashboard Supabase -> Storage -> Buat Bucket baru dengan nama "book-covers" dan centang pilihan "Public".';
      }

      Swal.fire({
        icon: 'error',
        title: 'Gagal Unggah',
        text: errorMsg,
        confirmButtonColor: '#D2B48C',
      });
    } finally {
      setUploading(false);
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
    try {
      // First attempt: Include all fields
      const { error: firstError } = await supabase.from('books').insert([
        {
          owner_id: user.id,
          title: formData.title,
          author: formData.author,
          genre: formData.genre,
          total_pages: formData.total_pages,
          status: formData.status,
          cover_url: formData.cover_url,
          synopsis: formData.synopsis,
          content: '' // Explicitly send empty string to satisfy NOT NULL constraint
        }
      ]);

      if (firstError) {
        // Fallback: If "schema cache" error occurs (columns missing), try minimal insert
        if (firstError.message?.toLowerCase().includes('schema cache') || 
            firstError.message?.toLowerCase().includes('column') ||
            firstError.code === '42703' || firstError.code === 'PGRST204') {
          
          console.warn('Fallback insert active: Attempting minimal record save.');
          const { error: secondError } = await supabase.from('books').insert([
            {
              owner_id: user.id,
              title: formData.title,
              author: formData.author,
              genre: formData.genre,
              cover_url: formData.cover_url,
              synopsis: formData.synopsis,
              content: '' // Explicitly send empty string
            }
          ]);
          
          if (secondError) throw secondError;
        } else {
          throw firstError;
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Buku berhasil ditambahkan ke koleksi Anda.',
        confirmButtonColor: '#D2B48C',
      });
      navigate('/app/user/library');
      } catch (err: any) {
      console.error('Final Save Error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: err.message || 'Terjadi kesalahan sistem database.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <header className="flex items-center gap-6 mb-12">
        <button 
          onClick={() => navigate(-1)}
          className="w-12 h-12 rounded-2xl bg-white border border-tan-50 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary transition-all shadow-sm"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Tambah Buku Baru</h1>
          <p className="text-slate-500 font-medium">Lengkapi detail buku untuk mulai melacak progres Anda.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Preview Card */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 space-y-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Pratinjau Kartu</p>
            <div className="bg-white rounded-[40px] border border-tan-50 p-6 shadow-xl shadow-slate-100 overflow-hidden group transition-all hover:shadow-2xl">
              <div className="aspect-[3/4.2] rounded-[32px] bg-slate-50 border border-dashed border-tan-100 mb-6 flex items-center justify-center overflow-hidden group-hover:scale-[1.02] transition-transform duration-500">
                {formData.cover_url ? (
                  <img src={formData.cover_url} alt="Cover Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center space-y-3">
                    <BookPlus size={64} className="text-slate-200 mx-auto" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum Ada Sampul</p>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                 <span className="text-[10px] font-black text-primary uppercase tracking-widest">{formData.genre}</span>
                 <h3 className="text-xl font-bold text-slate-900 line-clamp-1">{formData.title || 'Judul Buku'}</h3>
                 <p className="text-sm font-bold text-slate-400">Oleh {formData.author || 'Penulis'}</p>
                 <div className="pt-4 mt-4 border-t border-tan-50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formData.total_pages} Halaman</span>
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
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
          <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[48px] border border-tan-50 shadow-sm space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul Buku</label>
                <input 
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Masukkan judul buku"
                  className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Penulis</label>
                <input 
                  type="text"
                  required
                  value={formData.author}
                  onChange={(e) => setFormData({...formData, author: e.target.value})}
                  placeholder="Nama penulis"
                  className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                <select 
                  value={formData.genre}
                  onChange={(e) => setFormData({...formData, genre: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm appearance-none cursor-pointer"
                >
                  {genres.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Halaman</label>
                <input 
                  type="number"
                  min="1"
                  required
                  value={formData.total_pages || 0}
                  onChange={(e) => setFormData({...formData, total_pages: parseInt(e.target.value) || 0})}
                  className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm"
                />
              </div>

              {/* Cover Selection Logic */}
              <div className="md:col-span-2 space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sampul Buku</label>
                
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Upload Button */}
                  <div className="flex-1">
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full h-16 flex items-center justify-center gap-3 bg-white border-2 border-dashed border-tan-100 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 hover:border-primary hover:text-primary transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="animate-spin text-primary" size={20} />
                          <span>Mengunggah...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="group-hover:scale-110 transition-transform" size={20} />
                          <span>Pilih dari Galeri</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Or input URL */}
                  <div className="flex-[2] relative">
                    <Camera className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="url"
                      value={formData.cover_url}
                      onChange={(e) => setFormData({...formData, cover_url: e.target.value})}
                      placeholder="Atau masukkan URL gambar..."
                      className="w-full h-16 pl-14 pr-6 bg-slate-50 border border-tan-50 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm"
                    />
                  </div>
                </div>
                <p className="text-[9px] font-medium text-slate-400 italic">Disarankan ukuran 3:4 untuk hasil terbaik (Max 2MB).</p>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Membaca</label>
                <div className="flex gap-4">
                  {['Belum Dimulai', 'Sedang Dibaca', 'Selesai'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({...formData, status: s})}
                      className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border ${
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
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sinopsis (Opsional)</label>
                <textarea 
                  value={formData.synopsis}
                  onChange={(e) => setFormData({...formData, synopsis: e.target.value})}
                  placeholder="Tulis sedikit tentang isi buku..."
                  className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-[32px] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm h-40 resize-none shadow-inner"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading || uploading}
              className="w-full py-6 bg-primary text-white rounded-[32px] font-black text-lg hover:bg-primary-dark transition-all shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={22} /> Menambahkan...
                </>
              ) : (
                <>
                  <Save size={22} /> Simpan ke Koleksi
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
