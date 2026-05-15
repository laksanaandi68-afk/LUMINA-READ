import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  ShieldAlert, 
  Trash2, 
  CheckCircle, 
  X,
  Clock,
  MoreVertical,
  ChevronRight,
  User as UserIcon,
  AlertTriangle,
  FileText,
  Send,
  Loader2,
  Filter,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

interface Report {
  id: string;
  user_id: string;
  title: string;
  category: string;
  description: string;
  image_url: string | null;
  status: 'pending' | 'diproses' | 'selesai' | 'ditolak';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    display_name: string;
    username: string;
    avatar_url: string;
    email: string;
  };
}

export default function ReportManagement() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filter, setFilter] = useState<string>('Semua');
  const [adminResponse, setAdminResponse] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const stats = {
    pending: reports.filter(r => r.status === 'pending').length,
    diproses: reports.filter(r => r.status === 'diproses').length,
    selesai: reports.filter(r => r.status === 'selesai').length,
  };

  useEffect(() => {
    fetchReports();
    
    // Global subscription for all report changes
    const channel = supabase
      .channel('admin_reports_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_tickets' }, () => {
        fetchReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchReports = async () => {
    try {
      // Joining with profiles to get user info
      const { data, error } = await supabase
        .from('user_tickets')
        .select(`
          *,
          user:profiles!user_tickets_user_id_fkey(display_name, username, avatar_url, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
      
      // Update selected report if it's currently open to show latest data
      if (selectedReport) {
        const updated = data?.find(r => r.id === selectedReport.id);
        if (updated) setSelectedReport(updated);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: Report['status']) => {
    if (!selectedReport) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('user_tickets')
        .update({ 
          status,
          admin_response: adminResponse || selectedReport.admin_response,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Status Diperbarui',
        timer: 1500,
        showConfirmButton: false
      });
      
      setAdminResponse('');
      fetchReports();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Laporan?',
      text: "Data ini akan dihapus permanen dari sistem.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, Hapus'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('user_tickets')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        Swal.fire('Terhapus', 'Laporan telah dihapus.', 'success');
        setSelectedReport(null);
        fetchReports();
      } catch (err: any) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  const filteredReports = reports.filter(r => 
    filter === 'Semua' || r.status.toLowerCase() === filter.toLowerCase()
  );

  return (
    <div className="space-y-8 font-sans">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Laporan User</h1>
          <p className="text-slate-500 font-medium mt-1 italic">Kelola dan tindaklanjuti laporan masuk secara realtime.</p>
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0">
          <StatBadge icon={<Clock size={16} />} label="Pending" count={stats.pending} color="amber" />
          <StatBadge icon={<Loader2 size={16} />} label="Proses" count={stats.diproses} color="blue" />
          <StatBadge icon={<CheckCircle size={16} />} label="Selesai" count={stats.selesai} color="emerald" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-280px)]">
        {/* List Panel */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden min-h-0">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-widest">Daftar Laporan</h3>
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
               <button className="p-1 px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-primary transition-colors">
                 <Filter size={12} />
               </button>
               <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-wider text-slate-900 outline-none cursor-pointer pr-2"
               >
                 <option>Semua</option>
                 <option>Pending</option>
                 <option>Diproses</option>
                 <option>Selesai</option>
                 <option>Ditolak</option>
               </select>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-50">
            {loading ? (
              <div className="py-20 flex flex-col items-center gap-3 text-slate-300">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-[10px] font-black uppercase tracking-widest">Sinkronisasi...</span>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="py-20 text-center px-6">
                <CheckCircle className="mx-auto text-emerald-100 mb-4" size={48} />
                <p className="text-slate-400 font-bold text-sm">Tidak ada laporan {filter === 'Semua' ? '' : filter.toLowerCase()}.</p>
              </div>
            ) : filteredReports.map(report => (
              <button 
                key={report.id}
                onClick={() => {
                  setSelectedReport(report);
                  setAdminResponse(report.admin_response || '');
                }}
                className={`w-full px-6 py-5 flex items-start gap-4 text-left transition-all hover:bg-slate-50/50 relative group ${selectedReport?.id === report.id ? 'bg-primary/[0.03]' : ''}`}
              >
                {selectedReport?.id === report.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                )}
                
                <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200/50 shadow-sm">
                   {report.user?.avatar_url ? (
                     <img src={report.user.avatar_url} className="w-full h-full object-cover" alt="" />
                   ) : (
                     <UserIcon size={18} />
                   )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-black uppercase tracking-widest text-primary truncate max-w-[100px]">{report.category}</span>
                    <span className="text-[8px] font-bold text-slate-300 uppercase shrink-0">
                      {new Date(report.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm truncate group-hover:text-primary transition-colors">{report.title}</h4>
                  <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">Oleh {report.user?.display_name || 'User'}</p>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <StatusBadge status={report.status} />
                    {report.image_url && <span className="bg-slate-100 text-slate-400 p-0.5 rounded-md"><ImageIcon size={10} /></span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="hidden lg:flex lg:col-span-7 xl:col-span-8 flex-col h-full overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedReport ? (
              <DetailPanel 
                report={selectedReport} 
                onClose={() => setSelectedReport(null)}
                adminResponse={adminResponse}
                setAdminResponse={setAdminResponse}
                onUpdateStatus={handleUpdateStatus}
                onDelete={handleDeleteReport}
                isUpdating={isUpdating}
              />
            ) : (
              <EmptyDetailState />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Detail Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[200] lg:hidden flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReport(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-h-[90vh] bg-white rounded-t-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
               <DetailPanel 
                report={selectedReport} 
                onClose={() => setSelectedReport(null)}
                adminResponse={adminResponse}
                setAdminResponse={setAdminResponse}
                onUpdateStatus={handleUpdateStatus}
                onDelete={handleDeleteReport}
                isUpdating={isUpdating}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailPanel({ report, onClose, adminResponse, setAdminResponse, onUpdateStatus, onDelete, isUpdating }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-white lg:rounded-[40px] lg:border lg:border-slate-100 lg:shadow-xl lg:shadow-slate-200/20 flex flex-col h-full overflow-hidden"
    >
      {/* Detail Header */}
      <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-primary shadow-sm overflow-hidden">
            {report.user?.avatar_url ? (
              <img src={report.user.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <UserIcon size={24} />
            )}
          </div>
          <div>
            <h3 className="font-black text-slate-900 leading-tight">{report.user?.display_name || 'User'}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{report.user?.email || 'No Email'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onDelete(report.id)}
            className="p-3 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-2xl transition-all"
          >
            <Trash2 size={18} />
          </button>
          <button 
            onClick={onClose}
            className="p-3 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl transition-all"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
        {/* Report Body */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full">
              {report.category}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Dilaporkan {new Date(report.created_at).toLocaleString()}
            </span>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {report.title}
            </h2>
            <p className="text-slate-600 font-medium text-base leading-relaxed bg-slate-50/50 p-6 rounded-[28px] border border-slate-50">
              {report.description}
            </p>
          </div>
        </div>

        {/* Attachment */}
        {report.image_url && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Foto Bukti</p>
            <div className="relative group rounded-[32px] overflow-hidden border border-slate-100 shadow-lg max-w-2xl">
              <img src={report.image_url} className="w-full h-auto object-cover" alt="Bukti Laporan" />
              <a 
                href={report.image_url} 
                target="_blank" 
                rel="noreferrer"
                className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm"
              >
                <div className="bg-white p-4 rounded-2xl text-slate-900 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                   Full Size <ExternalLink size={14} />
                </div>
              </a>
            </div>
          </div>
        )}

        {/* Admin Response Section */}
        <div className="pt-6 border-t border-slate-50 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tanggapan Admin</label>
              {report.status !== 'pending' && (
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase">Sudah direspon</span>
                </div>
              )}
            </div>
            <textarea 
              value={adminResponse}
              onChange={(e) => setAdminResponse(e.target.value)}
              placeholder="Berikan tanggapan untuk warga mengenai laporan ini..."
              className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[28px] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-sm h-32 resize-none shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Sticky Action Footer */}
      <div className="px-8 py-6 border-t border-slate-50 bg-slate-50/10 shrink-0 pb-10 lg:pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionButton 
            onClick={() => onUpdateStatus('diproses')} 
            active={report.status === 'diproses'}
            color="blue"
            label="Proses"
            disabled={isUpdating}
          />
          <ActionButton 
            onClick={() => onUpdateStatus('selesai')} 
            active={report.status === 'selesai'}
            color="emerald"
            label="Selesai"
            disabled={isUpdating}
          />
          <ActionButton 
            onClick={() => onUpdateStatus('ditolak')} 
            active={report.status === 'ditolak'}
            color="rose"
            label="Tolak"
            disabled={isUpdating}
          />
          <button 
            onClick={() => onUpdateStatus(report.status)}
            disabled={isUpdating || !adminResponse || adminResponse === report.admin_response}
            className="py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-30 shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2"
          >
            {isUpdating ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            Simpan Respon
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyDetailState() {
  return (
    <div className="flex-1 bg-slate-50/50 rounded-[40px] border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center">
      <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center text-slate-200 mb-6 shadow-sm">
        <ShieldAlert size={48} strokeWidth={1} />
      </div>
      <h3 className="text-xl font-extrabold text-slate-900">Pilih Laporan</h3>
      <p className="text-slate-400 max-w-sm mt-2 font-medium">Klik pada salah satu item di daftar samping untuk meninjau detail dan memberikan respon.</p>
    </div>
  );
}

function StatBadge({ icon, label, count, color }: any) {
  const colors: any = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <div className={`px-5 py-3 rounded-2xl border ${colors[color]} shadow-sm flex items-center gap-3 shrink-0`}>
      <div className="p-2 bg-white rounded-lg shadow-xs">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">{label}</p>
        <p className="text-xl font-black">{count}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Report['status'] }) {
  const styles = {
    pending: 'bg-amber-50 text-amber-500 border-amber-100',
    diproses: 'bg-blue-50 text-blue-500 border-blue-100',
    selesai: 'bg-emerald-50 text-emerald-500 border-emerald-100',
    ditolak: 'bg-rose-50 text-rose-500 border-rose-100',
  };
  return (
    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${styles[status]}`}>
      {status}
    </span>
  );
}

function ActionButton({ onClick, active, color, label, disabled }: any) {
  const configs: any = {
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-100',
  };
  
  const activeConfigs: any = {
    blue: 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20',
    emerald: 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20',
    rose: 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-600/20',
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${active ? activeConfigs[color] : configs[color]} ${disabled ? 'opacity-30' : ''}`}
    >
      {label}
    </button>
  );
}

function ImageIcon({ size, className }: any) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}
