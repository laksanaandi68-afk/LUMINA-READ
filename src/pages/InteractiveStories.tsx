import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Type, Ghost, Map, Key, ArrowRight, RotateCcw, Award } from 'lucide-react';

interface StoryNode {
  id: string;
  text: string;
  icon?: React.ReactNode;
  choices: {
    text: string;
    nextNode: string;
  }[];
  ending?: string;
}

const STORY: Record<string, StoryNode> = {
  start: {
    id: 'start',
    text: 'Anda terbangun di sebuah perpustakaan kuno yang sunyi. Lampu gas berkedip di kejauhan. Di tangan Anda ada sepucuk surat misterius yang disegel dengan lilin merah.',
    choices: [
      { text: 'Buka suratnya', nextNode: 'open_letter' },
      { text: 'Jelajahi lorong berdebu', nextNode: 'explore_aisle' }
    ]
  },
  open_letter: {
    id: 'open_letter',
    text: 'Surat itu berisi tulisan tangan yang berantakan: "Jangan lepaskan kunci emas itu..." Tiba-tiba, Anda mendengar suara langkah kaki dari balik lemari.',
    choices: [
      { text: 'Sembunyi di bawah meja', nextNode: 'hide' },
      { text: 'Memanggil ke dalam kegelapan', nextNode: 'call_out' }
    ]
  },
  explore_aisle: {
    id: 'explore_aisle',
    text: 'Anda berjalan melewati deretan buku berdebu. Sebuah buku tiba-tiba jatuh. Judulnya: "Cara Melarikan Diri Dari Sini".',
    choices: [
      { text: 'Ambil dan baca bukunya', nextNode: 'read_book' },
      { text: 'Abaikan dan terus bergerak', nextNode: 'ignore' }
    ]
  },
  hide: {
    id: 'hide',
    text: 'Sesuatu yang gelap melintas di dekat meja Anda. Ia meninggalkan sebuah Kunci Emas di lantai.',
    choices: [
      { text: 'Ambil kuncinya', nextNode: 'ending_brave' },
      { text: 'Tunggu sampai merasa aman', nextNode: 'ending_coward' }
    ]
  },
  read_book: {
    id: 'read_book',
    text: 'Buku itu berisi peta rahasia gedung ini. Anda menemukan pintu tersembunyi di balik rak "Sejarah".',
    choices: [
      { text: 'Masuk ke pintu rahasia', nextNode: 'ending_smart' }
    ]
  },
  // Endings
  ending_brave: {
    id: 'ending_brave',
    text: 'Anda mengambil kunci dan menemukan pintu logam yang berat. Dengan kunci ini, Anda bebas dan menemukan bahwa Anda adalah pemilik sah perpustakaan ini!',
    choices: [],
    ending: 'Akhir Sejati: Pemilik Sah',
    icon: <Award className="text-yellow-500" />
  },
  ending_coward: {
    id: 'ending_coward',
    text: 'Anda menunggu terlalu lama. Cahaya menghilang dan Anda terjebak di sana selamanya sebagai bagian dari koleksi buku.',
    choices: [],
    ending: 'Akhir Buruk: Koleksi yang Terlupa',
    icon: <Ghost className="text-red-500" />
  },
  ending_smart: {
    id: 'ending_smart',
    text: 'Anda mengikuti peta dan keluar melalui terowongan rahasia. Anda berhasil melarikan diri dengan peta harta karun yang terselip di dalam buku!',
    choices: [],
    ending: 'Akhir Baik: Pemburu Harta Karun',
    icon: <Award className="text-emerald-500" />
  },
  ignore: {
    id: 'ignore',
    text: 'Tanpa panduan, Anda tersesat di labirin rak buku yang tak berujung. Setiap lorong terlihat sama.',
    choices: [],
    ending: 'Akhir Berulang: Pembaca yang Tersesat',
    icon: <Map className="text-blue-500" />
  },
  call_out: {
    id: 'call_out',
    text: 'Bayangan itu berbalik. Itu bukan manusia, melainkan manifestasi dari cerita sedih yang belum selesai.',
    choices: [],
    ending: 'Akhir Melankolis: Bagian dari Cerita',
    icon: <Ghost className="text-indigo-500" />
  }
};

export default function InteractiveStories() {
  const [currentNodeId, setCurrentNodeId] = useState('start');
  const [history, setHistory] = useState<string[]>([]);
  const node = STORY[currentNodeId];

  const handleChoice = (nextNode: string) => {
    setHistory([...history, currentNodeId]);
    setCurrentNodeId(nextNode);
  };

  const restart = () => {
    setCurrentNodeId('start');
    setHistory([]);
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-16">
        <div className="w-20 h-20 bg-tan-50 rounded-[28px] flex items-center justify-center mx-auto mb-8 text-primary shadow-sm border border-primary/5">
          <Type size={40} />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Misteri Perpustakaan</h1>
        <p className="text-slate-500 font-medium italic">Pilihan Anda menentukan nasib pembaca yang tersesat.</p>
      </div>

      <motion.div 
        key={currentNodeId}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white p-10 rounded-[40px] border border-tan-50 shadow-2xl shadow-primary/5 min-h-[500px] flex flex-col justify-between relative overflow-hidden"
      >
        <div>
          {node.ending && (
            <div className="flex flex-col items-center mb-12 text-center animate-in fade-in zoom-in duration-500">
               <div className="w-24 h-24 bg-tan-50 rounded-[32px] flex items-center justify-center mb-6 border border-primary/10 shadow-inner">
                  {node.icon}
               </div>
               <span className="px-6 py-2 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
                  {node.ending}
               </span>
               <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Cerita Berakhir</h2>
            </div>
          )}
          
          <p className="text-xl text-slate-700 leading-relaxed font-serif mb-12 text-center italic font-medium pt-4">
            "{node.text}"
          </p>

          <div className="grid grid-cols-1 gap-4">
            {node.choices.map((choice, i) => (
              <button 
                key={i}
                onClick={() => handleChoice(choice.nextNode)}
                className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-primary hover:text-white rounded-[24px] group transition-all text-left font-bold text-base shadow-sm hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1"
              >
                <span>{choice.text}</span>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                   <ArrowRight size={20} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {node.ending && (
          <button 
            onClick={restart}
            className="w-full py-5 mt-12 bg-primary text-white rounded-[24px] font-bold flex items-center justify-center gap-3 hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 active:scale-95"
          >
            <RotateCcw size={22} /> Mulai Bab Baru
          </button>
        )}
        
        <div className="absolute top-0 right-0 w-32 h-32 bg-tan-50 rounded-full blur-[60px] opacity-50 pointer-events-none"></div>
      </motion.div>

      <div className="mt-12 flex justify-center gap-3">
        {history.length > 0 && Array.from({ length: history.length }).map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-tan-100"></div>
        ))}
        <div className="w-3 h-3 rounded-full bg-primary animate-pulse shadow-lg shadow-primary/30"></div>
      </div>
    </div>
  );
}
