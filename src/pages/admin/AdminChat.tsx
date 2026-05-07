import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, MessageCircle, User, ShieldCheck, ChevronLeft, Search, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export default function AdminChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel('admin_chat_live')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        console.log("Admin New Message:", payload);
        // Refresh conversations list to update latest message
        fetchConversations();
        
        // If the new message is for the current active chat
        if (payload.new && selectedUserId === payload.new.user_id) {
          setMessages((current) => {
            if (current.some(m => m.id === payload.new.id)) return current;
            return [...current, payload.new];
          });
        }
      })
      .subscribe((status, err) => {
        console.log("Admin Chat Sub Status:", status, err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUserId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchConversations = async () => {
    try {
      // Get latest messages that are part of a support thread (user_id is not null)
      const { data, error } = await supabase
        .from('messages')
        .select('id, user_id, created_at, content, profiles!messages_user_id_fkey(display_name, avatar_url, username)')
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(400);

      if (error) {
        console.error("Admin Fetch Error:", error);
        throw error;
      }

      // Deduplicate by user_id to get latest conversation per user
      const uniqueConversations = data.reduce((acc: any[], current: any) => {
        if (!current.user_id) return acc;
        const x = acc.find(item => item.user_id === current.user_id);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, []);

      setConversations(uniqueConversations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessagesForUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !selectedUserId) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          user_id: selectedUserId,
          sender_id: user.id,
          receiver_id: selectedUserId,
          content: messageContent,
          sender: 'admin'
        });
      
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.profiles?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-[48px] shadow-2xl shadow-slate-200/50 border border-slate-200 overflow-hidden font-sans">
      {/* Sidebar List */}
      <div className="w-[380px] border-r border-slate-100 flex flex-col bg-[#fcfcfc]">
        <div className="p-10 space-y-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1">
               <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Connections</p>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Comms Hub</h2>
          </div>
          
          <div className="relative">
            <input 
              type="text"
              placeholder="Cari user (nama/username)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-xs outline-none focus:border-primary transition-all font-bold placeholder:text-slate-300 shadow-sm"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-3">
          {filteredConversations.map((c) => (
            <button
              key={c.user_id}
              onClick={() => {
                setSelectedUserId(c.user_id);
                fetchMessagesForUser(c.user_id);
              }}
              className={`w-full p-5 rounded-[28px] flex items-center gap-4 transition-all group border-2 ${
                selectedUserId === c.user_id 
                  ? 'bg-white shadow-xl shadow-primary/5 border-primary/20' 
                  : 'bg-transparent border-transparent hover:bg-white hover:border-slate-100 hover:shadow-lg'
              }`}
            >
              <div className="w-12 h-12 rounded-[20px] bg-slate-100 shrink-0 flex items-center justify-center text-primary font-black overflow-hidden border border-white shadow-inner">
                {c.profiles?.avatar_url ? (
                  <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  c.profiles?.display_name?.[0] || 'U'
                )}
              </div>
              <div className="text-left overflow-hidden flex-1">
                <div className="flex items-center justify-between gap-2">
                   <h4 className="font-extrabold text-slate-900 truncate text-sm">{c.profiles?.display_name}</h4>
                   <span className="text-[9px] text-slate-400 font-black font-mono">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">{c.content}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* active chat */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {selectedUserId ? (
          <>
            <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white backdrop-blur-sm z-10">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-[#0f1115] flex items-center justify-center text-white shadow-xl">
                   <ShieldCheck size={28} className="text-primary" />
                </div>
                <div>
                   <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-slate-900 text-lg leading-none">
                        {conversations.find(c => c.user_id === selectedUserId)?.profiles?.display_name}
                      </h3>
                      <div className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest rounded leading-none">Online</div>
                   </div>
                   <div className="flex items-center gap-2">
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Communication Protocol: Secure</p>
                   </div>
                </div>
              </div>
              <div className="flex gap-3">
                 <button className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                    <Clock size={20} />
                 </button>
              </div>
            </header>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-10 space-y-6 bg-slate-50/20"
            >
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] space-y-2`}>
                    <div className={`px-6 py-4 rounded-[28px] text-sm font-medium leading-relaxed
                      ${msg.sender === 'admin' 
                        ? 'bg-primary text-white rounded-tr-sm shadow-lg' 
                        : 'bg-white text-slate-600 border border-tan-50 rounded-tl-sm'}
                    `}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-8 border-t border-tan-50 bg-white">
              <form onSubmit={handleSendMessage} className="flex gap-4">
                <input 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a reply..."
                  className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-8 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50"
                >
                  Reply <Send size={18} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-20 space-y-8">
             <div className="w-32 h-32 bg-tan-50 rounded-[48px] flex items-center justify-center text-primary/20">
                <MessageCircle size={64} strokeWidth={1} />
             </div>
             <div className="space-y-4">
               <h2 className="text-3xl font-black text-slate-900 tracking-tight">Admin Communication Hub</h2>
               <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
                 Select a user from the sidebar to begin helping them in realtime. All messages are persisted and encrypted.
               </p>
             </div>
             <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-3xl border border-emerald-100">
                <CheckCircle2 className="text-emerald-500" size={20} />
                <span className="text-emerald-700 text-xs font-bold uppercase tracking-widest leading-none">System Healthy & Operational</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
