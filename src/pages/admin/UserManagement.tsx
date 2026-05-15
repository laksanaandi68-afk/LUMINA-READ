import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Trash2, Shield, User, Plus, X, Mail, Key, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
  avatar_url?: string;
  status: 'active' | 'banned';
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'user'
  });

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel('public:profiles_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchUsers)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Users error:", error);
    } else {
      setUsers(data as UserProfile[]);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          email: newUser.email,
          display_name: newUser.displayName,
          role: newUser.role,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUser.email}`
        })
        .select()
        .single();

      if (error) throw error;

      Swal.fire({
        title: 'Pengguna Dibuat',
        text: 'Profil pengguna telah diinisialisasi. Catatan: Pengguna harus tetap mendaftar melalui halaman pendaftaran untuk mengaktifkan kredensial mereka.',
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });

      setIsModalOpen(false);
      setNewUser({ email: '', password: '', displayName: '', role: 'user' });
      fetchUsers();
    } catch (err: any) {
      Swal.fire('Gagal', err.message, 'error');
    }
  };

  const handlePromote = async (uid: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', uid);

      if (error) throw error;
      Swal.fire({
        title: 'Berhasil',
        text: `Peran pengguna diperbarui menjadi ${newRole}`,
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
    } catch (err: any) {
      Swal.fire('Gagal', err.message, 'error');
    }
  };

  const handleDeleteUser = async (uid: string) => {
     const result = await Swal.fire({
      title: 'Hapus Pengguna?',
      text: "Data profil pengguna akan hilang selamanya!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Hapus Pengguna'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', uid);
        
        if (error) throw error;
        Swal.fire({
          title: 'Dihapus!',
          text: 'Pengguna telah dihapus dari database.',
          icon: 'success',
          confirmButtonColor: '#4f46e5'
        });
      } catch (err: any) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  const handleBanToggle = async (uid: string, currentStatus: string) => {
    const newStatus = currentStatus === 'banned' ? 'active' : 'banned';
    const actionLabel = newStatus === 'banned' ? 'Blokir' : 'Aktifkan';
    
    const result = await Swal.fire({
      title: `${actionLabel} Akun?`,
      text: newStatus === 'banned' ? "User tidak akan bisa login." : "User akan mendapatkan kembali akses.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Ya, ${actionLabel}`
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ status: newStatus })
          .eq('id', uid);

        if (error) throw error;
        Swal.fire('Berhasil', `Status diperbarui menjadi ${newStatus}`, 'success');
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const filteredUsers = users.filter(u => 
    (u.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="relative z-10 text-center md:text-left">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Direktori Sistem</h1>
          <p className="text-sm text-slate-500 font-medium mt-2">Total {users.length} akun terdaftar di platform.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64 z-10">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
             <input 
                type="text" 
                placeholder="Cari..."
                className="w-full pl-12 pr-6 py-3 bg-tan-50 border border-tan-100 rounded-[20px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder:text-slate-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-[20px] font-bold text-sm hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Plus size={18} /> Tambah Pengguna Baru
          </button>
        </div>
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-[80px] pointer-events-none opacity-40"></div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
         <table className="w-full text-left font-sans">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
               <tr>
                  <th className="px-10 py-6">Profil Pengguna</th>
                  <th className="px-10 py-6">Status/Peran</th>
                  <th className="px-10 py-6">Bergabung Sejak</th>
                  <th className="px-10 py-6 text-right">Aksi</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {loading ? (
                 [1,2,3].map(i => (
                    <tr key={i}>
                       <td colSpan={4} className="px-10 py-8 h-12 animate-pulse bg-slate-50"></td>
                    </tr>
                 ))
               ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                     <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-tan-50 flex items-center justify-center text-primary font-bold text-sm shadow-sm border border-primary/10 group-hover:scale-110 transition-transform overflow-hidden relative">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                              ) : (
                                (user.display_name || '?')[0]
                              )}
                              {user.status === 'banned' && (
                                <div className="absolute inset-0 bg-rose-500/80 flex items-center justify-center text-white text-[8px] font-black uppercase tracking-tighter">Banned</div>
                              )}
                           </div>
                           <div>
                              <p className="text-sm font-bold text-slate-900 tracking-tight">{user.display_name || 'Pembaca'}</p>
                              <p className="text-[10px] text-slate-400 font-medium lowercase">@{user.username || user.email.split('@')[0]}</p>
                           </div>
                        </div>
                     </td>
                     <td className="px-10 py-6">
                        <div className="flex flex-col gap-1.5">
                           <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit border ${
                             user.role === 'admin' 
                               ? 'bg-primary text-white border-primary/20' 
                               : 'bg-slate-50 text-slate-500 border-slate-100'
                           }`}>
                              {user.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                              {user.role}
                           </span>
                           <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit border ${
                             user.status === 'active' || !user.status
                               ? 'bg-emerald-50 text-emerald-500 border-emerald-100' 
                               : 'bg-rose-50 text-rose-500 border-rose-100'
                           }`}>
                              • {user.status || 'active'}
                           </span>
                        </div>
                     </td>
                     <td className="px-10 py-6 text-xs text-slate-500 font-medium">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                     </td>
                     <td className="px-10 py-6">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                             onClick={() => handleBanToggle(user.id, user.status || 'active')}
                             title={user.status === 'banned' ? 'Aktifkan Akun' : 'Ban Akun'}
                             className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border shadow-sm ${user.status === 'banned' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-white text-slate-300 hover:bg-rose-500 hover:text-white border-slate-100'}`}
                           >
                              <UserX size={18} />
                           </button>
                           <button 
                             onClick={() => handlePromote(user.id, user.role)}
                             title={user.role === 'admin' ? 'Turunkan ke Pembaca' : 'Naikkan ke Admin'}
                             className="w-10 h-10 flex items-center justify-center bg-white hover:bg-primary hover:text-white rounded-xl text-slate-300 transition-all border border-tan-100 shadow-sm"
                           >
                              <Shield size={18} />
                           </button>
                           <button 
                             onClick={() => handleDeleteUser(user.id)}
                             className="w-10 h-10 flex items-center justify-center bg-white hover:bg-red-500 hover:text-white rounded-xl text-slate-300 transition-all border border-slate-100 shadow-sm"
                           >
                              <Trash2 size={18} />
                           </button>
                        </div>
                     </td>
                  </tr>
                ))
               )}
               {filteredUsers.length === 0 && !loading && (
                 <tr>
                    <td colSpan={4} className="px-10 py-20 text-center text-slate-300 font-medium italic">Tidak ada pembaca yang sesuai dengan pencarian Anda.</td>
                 </tr>
               )}
            </tbody>
         </table>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsModalOpen(false)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="flex justify-between items-center mb-10">
                <div>
                   <p className="text-sm font-bold text-slate-900 tracking-tight">Direktori Sistem</p>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Antarmuka Direktori LuminaRead</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center bg-tan-50 text-slate-400 hover:text-primary rounded-xl transition-all"
                >
                   <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-6">
                 <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Tampilan Identitas</label>
                    <div className="relative">
                       <User className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
                       <input 
                         required
                         type="text"
                         value={newUser.displayName}
                         onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                         placeholder="misal: Neo Anderson"
                         className="w-full pl-12 pr-6 py-4 bg-tan-50 border border-tan-100 rounded-[20px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                       />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Alamat Email</label>
                    <div className="relative">
                       <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
                       <input 
                         required
                         type="email"
                         value={newUser.email}
                         onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                         placeholder="neo@lumina.read"
                         className="w-full pl-12 pr-6 py-4 bg-tan-50 border border-tan-100 rounded-[20px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                       />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tingkat Akses</label>
                    <div className="relative">
                       <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
                       <select 
                         value={newUser.role}
                         onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                         className="w-full pl-12 pr-6 py-4 bg-tan-50 border border-tan-100 rounded-[20px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold appearance-none cursor-pointer"
                       >
                          <option value="user">Pembaca Standar</option>
                          <option value="admin">Admin Sistem</option>
                       </select>
                    </div>
                 </div>

                 <button 
                   type="submit"
                   className="w-full py-4 bg-primary text-white rounded-[20px] font-bold text-sm hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 mt-4 active:scale-95"
                 >
                    Inisialisasi Sinyal Akun
                 </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
