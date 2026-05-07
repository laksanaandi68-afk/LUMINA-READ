import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  ShieldAlert, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  UserX, 
  Clock,
  MoreVertical,
  ChevronRight,
  MessageSquare,
  User as UserIcon,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';

export default function ReportManagement() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  useEffect(() => {
    fetchReports();
    
    const channel = supabase
      .channel('reports_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:profiles!reports_reporter_id_fkey(display_name, username, avatar_url),
          reported_user:profiles!reports_reported_user_id_fkey(id, display_name, username, avatar_url),
          message:messages(content, created_at)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (reportId: string, status: 'resolved' | 'ignored', action?: 'delete_msg' | 'ban_user') => {
    try {
      // 1. If action is delete_msg
      if (action === 'delete_msg' && selectedReport?.message_id) {
        const { error: delError } = await supabase
          .from('messages')
          .delete()
          .eq('id', selectedReport.message_id);
        if (delError) throw delError;
      }

      // 2. If action is ban_user
      if (action === 'ban_user' && selectedReport?.reported_user_id) {
        const { error: banError } = await supabase
          .from('profiles')
          .update({ status: 'banned' })
          .eq('id', selectedReport.reported_user_id);
        if (banError) throw banError;
      }

      // 3. Update report status
      const { error: updateError } = await supabase
        .from('reports')
        .update({ status })
        .eq('id', reportId);

      if (updateError) throw updateError;

      Swal.fire({
        icon: 'success',
        title: 'Tindakan Berhasil',
        timer: 1500,
        showConfirmButton: false
      });

      setSelectedReport(null);
      fetchReports();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const deleteMessage = async (msgId: string) => {
    const result = await Swal.fire({
      title: 'Hapus Pesan?',
      text: "Pesan akan hilang dari percakapan user.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus'
    });

    if (result.isConfirmed) {
      handleAction(selectedReport.id, 'resolved', 'delete_msg');
    }
  };

  const banUser = async (userId: string) => {
    const result = await Swal.fire({
      title: 'Ban User?',
      text: "User tidak akan bisa login atau chat lagi.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, Ban'
    });

    if (result.isConfirmed) {
      handleAction(selectedReport.id, 'resolved', 'ban_user');
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 font-sans">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Moderasi & Laporan</h1>
          <p className="text-slate-500 font-medium mt-1">Pantau dan tindaklanjuti laporan dari komunitas.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
            <ShieldAlert className="text-amber-500" size={20} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Menunggu</p>
              <p className="text-xl font-black text-slate-900">{reports.filter(r => r.status === 'pending').length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List Reports */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900">Semua Laporan</h3>
              <div className="flex bg-slate-50 p-1 rounded-xl">
                 <button className="px-4 py-1.5 bg-white text-xs font-bold rounded-lg shadow-sm">Pending</button>
                 <button className="px-4 py-1.5 text-xs font-bold text-slate-400">Arsip</button>
              </div>
            </div>
            
            <div className="divide-y divide-slate-50">
              {reports.length === 0 ? (
                <div className="py-20 text-center">
                  <CheckCircle className="mx-auto text-emerald-100 mb-4" size={48} />
                  <p className="text-slate-400 font-bold">Semua bersih! Tidak ada laporan pending.</p>
                </div>
              ) : reports.map(report => (
                <button 
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`w-full px-8 py-6 flex items-center justify-between text-left transition-all hover:bg-slate-50/50 ${selectedReport?.id === report.id ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden">
                       {report.reported_user?.avatar_url ? <img src={report.reported_user.avatar_url} className="w-full h-full object-cover" /> : <UserIcon />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-slate-900">@{report.reported_user?.username || 'user'}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          report.status === 'pending' ? 'bg-amber-100 text-amber-600' : 
                          report.status === 'resolved' ? 'bg-emerald-100 text-emerald-600' : 
                          'bg-slate-100 text-slate-400'
                        }`}>
                          {report.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 mt-0.5">{report.reason}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                       {new Date(report.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                    </p>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {selectedReport ? (
              <motion.div 
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 p-8 sticky top-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-extrabold text-slate-900">Detail Laporan</h3>
                  <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
                    <XCircle size={20} />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-3xl">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 overflow-hidden">
                       {selectedReport.reporter?.avatar_url ? <img src={selectedReport.reporter.avatar_url} className="w-full h-full object-cover" /> : <UserIcon size={18} />}
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Dilaporkan Oleh</p>
                      <p className="font-extrabold text-slate-900 text-sm">@{selectedReport.reporter?.username}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Pesan yang Dilaporkan</p>
                    {selectedReport.message ? (
                      <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-[28px] italic text-slate-700 text-sm leading-relaxed relative">
                        "{selectedReport.message.content}"
                        <div className="mt-4 pt-4 border-t border-amber-100 flex items-center justify-between">
                           <span className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest">
                             ID: {selectedReport.message_id.split('-')[0]}
                           </span>
                           <span className="text-[10px] font-bold text-amber-600/60">
                             {new Date(selectedReport.message.created_at).toLocaleTimeString()}
                           </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 bg-slate-50 border border-dashed border-slate-200 rounded-[28px] text-slate-400 text-xs text-center italic">
                        Pesan sudah tidak tersedia
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Alasan & Deskripsi</p>
                    <p className="font-extrabold text-slate-900">{selectedReport.reason}</p>
                    {selectedReport.description && (
                      <p className="text-sm font-medium text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-2xl">
                        {selectedReport.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-6 grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleAction(selectedReport.id, 'ignored')}
                      className="flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                    >
                      Abaikan
                    </button>
                    <button 
                      onClick={() => handleAction(selectedReport.id, 'resolved')}
                      className="flex items-center justify-center gap-2 py-4 bg-white border border-emerald-100 text-emerald-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all"
                    >
                      Resolved
                    </button>
                    <button 
                      onClick={() => deleteMessage(selectedReport.message_id)}
                      disabled={!selectedReport.message}
                      className="col-span-1 flex items-center justify-center gap-2 py-4 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-30"
                    >
                      <Trash2 size={14} /> Hapus Pesan
                    </button>
                    <button 
                      onClick={() => banUser(selectedReport.reported_user_id)}
                      className="col-span-1 flex items-center justify-center gap-2 py-4 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-slate-100"
                    >
                      <UserX size={14} /> Ban User
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-tan-50/30 rounded-[40px] border border-dashed border-tan-100 p-10 text-center flex flex-col items-center justify-center h-96">
                <ShieldAlert className="text-tan-100 mb-6" size={64} />
                <h3 className="text-xl font-extrabold text-slate-900">Belum Ada Detail</h3>
                <p className="text-slate-400 mt-2 font-medium">Pilih salah satu laporan di samping untuk melihat detail dan mengambil tindakan.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
