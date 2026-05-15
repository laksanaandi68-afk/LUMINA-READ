import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ShieldAlert, 
  Plus, 
  X, 
  Camera, 
  Send, 
  Clock, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

interface Report {
  id: string;
  title: string;
  category: string;
  description: string;
  image_url: string | null;
  status: 'pending' | 'diproses' | 'selesai' | 'ditolak';
  admin_response: string | null;
  created_at: string;
}

export default function UserReports() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    category: 'Bug aplikasi',
    description: '',
    image_url: ''
  });

  const categories = [
    'Bug aplikasi', 
    'Masalah akun', 
    'Buku error', 
    'Konten tidak pantas', 
    'Chat bermasalah', 
    'Fitur tidak berjalan', 
    'Lainnya'
  ];

  useEffect(() => {
    if (!user) return;
    fetchReports();

    // Set up realtime subscription
    const channel = supabase
      .channel(`user_reports_${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_tickets',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchReports = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

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
      const filePath = `reports/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('book-covers') // Reusing existing bucket with prefix
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('book-covers')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
    } catch (error: any) {
      console.error('Upload error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Unggah',
        text: 'Pastikan bucket "book-covers" tersedia dan bersifat publik.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title.trim() || !formData.description.trim()) {
      Swal.fire({ icon: 'error', title: 'Oops', text: 'Judul dan Deskripsi wajib diisi!' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_tickets')
        .insert([{
          user_id: user.id,
          title: formData.title.trim(),
          category: formData.category,
          description: formData.description.trim(),
          image_url: formData.image_url || null,
          status: 'pending'
        }]);

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Tabel "user_tickets" belum dibuat di Supabase. Silakan minta admin menjalankan SQL di dashboard.');
        }
        throw error;
      }

      Swal.fire({
        icon: 'success',
        title: 'Laporan Terkirim',
        text: 'Terima kasih atas laporannya. Admin akan segera meninjau.',
        timer: 2000,
        showConfirmButton: false
      });

      setFormData({
      title: '',
      category: 'Bug aplikasi',
      description: '',
      image_url: ''
    });
      setIsFormOpen(false);
      fetchReports();
    } catch (err: any) {
      console.error('Submit error:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 md:space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-none mb-4">Laporkan Masalah</h1>
          <p className="text-slate-500 font-medium max-w-lg leading-relaxed italic">
            Laporkan bug, kendala akun, atau masalah konten langsung ke admin untuk ditindaklanjuti.
          </p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={20} />
          Buat Laporan Baru
        </button>
      </header>

      {/* Main Content */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 animate-pulse"></div>
              <Loader2 className="animate-spin text-primary relative z-10" size={48} />
            </div>
            <p className="mt-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Memuat Data Laporan</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white border border-tan-50 rounded-[40px] p-12 md:p-20 text-center flex flex-col items-center gap-6 shadow-sm">
            <div className="w-24 h-24 rounded-full bg-tan-50 flex items-center justify-center text-tan-200">
              <ShieldAlert size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">Belum Ada Laporan</h3>
              <p className="text-slate-500 font-medium">Semua terlihat aman! Jika ada masalah, jangan ragu untuk melapor.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setIsFormOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-tan-50 flex items-center justify-between bg-tan-50/20">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
                      <ShieldAlert size={20} />
                   </div>
                   <h2 className="text-xl font-black text-slate-900 tracking-tight">Buat Laporan Baru</h2>
                </div>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-6 md:space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul Laporan</label>
                    <input 
                      type="text"
                      required
                      placeholder="Judul laporan"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-tan-50 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm appearance-none cursor-pointer"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deskripsi Masalah</label>
                  <textarea 
                    required
                    placeholder="Ceritakan detail masalah yang terjadi..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-6 py-5 bg-slate-50 border border-tan-50 rounded-[28px] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm h-32 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Foto Bukti (Opsional)</label>
                  <div 
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`h-48 border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative ${
                      formData.image_url ? 'border-primary bg-primary/5' : 'border-tan-100 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                    {uploading ? (
                      <Loader2 className="animate-spin text-primary" size={32} />
                    ) : formData.image_url ? (
                      <>
                        <img src={formData.image_url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                           <Camera className="text-white" size={32} />
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData({...formData, image_url: ''});
                          }}
                          className="absolute top-4 right-4 w-8 h-8 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <ImageIcon size={32} className="mx-auto text-slate-300" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Klik untuk pilih foto</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={submitting || uploading}
                    className="w-full py-5 bg-primary text-white rounded-2xl font-black text-base md:text-lg hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                    Kirim Laporan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  const statusColors = {
    pending: 'bg-amber-100 text-amber-600',
    diproses: 'bg-blue-100 text-blue-600',
    selesai: 'bg-emerald-100 text-emerald-600',
    ditolak: 'bg-rose-100 text-rose-600'
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-tan-50 rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all group flex flex-col h-full"
    >
      {report.image_url && (
        <div className="aspect-video w-full overflow-hidden relative">
          <img src={report.image_url} alt={report.title} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
          <div className="absolute top-4 right-4 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[9px] font-black text-white uppercase tracking-widest">
            {report.category}
          </div>
        </div>
      )}
      
      <div className="p-6 space-y-4 flex-1 flex flex-col">
        {!report.image_url && (
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-tan-50 text-[9px] font-black text-primary uppercase tracking-widest rounded-full">
              {report.category}
            </span>
          </div>
        )}
        
        <div className="flex-1">
          <h3 className="font-extrabold text-slate-900 leading-tight mb-2 group-hover:text-primary transition-colors">{report.title}</h3>
          <p className="text-xs font-medium text-slate-500 line-clamp-3 leading-relaxed">{report.description}</p>
        </div>

        {report.admin_response && (
          <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-2xl">
             <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Respon Admin</p>
             <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic">"{report.admin_response}"</p>
          </div>
        )}

        <div className="pt-4 border-t border-tan-50 flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2 text-slate-300">
             <Clock size={12} />
             <span className="text-[10px] font-bold">
               {new Date(report.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
             </span>
          </div>
          <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${statusColors[report.status]}`}>
            {report.status}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
