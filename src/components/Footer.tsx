import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  MapPin, 
  Mail, 
  Phone, 
  ArrowUp, 
  Heart, 
  ChevronRight,
  Facebook,
  Twitter,
  Instagram,
  Music as Tiktok
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Footer() {
  const [showScroll, setShowScroll] = useState(false);

  const socialLinks = [
    { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
    { icon: Tiktok, href: "https://tiktok.com", label: "TikTok" },
    { icon: Twitter, href: "https://x.com", label: "X (Twitter)" }
  ];

  useEffect(() => {
    const checkScroll = () => {
      if (window.scrollY > 400) {
        setShowScroll(true);
      } else {
        setShowScroll(false);
      }
    };

    window.addEventListener('scroll', checkScroll);
    return () => window.removeEventListener('scroll', checkScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const linkGroups = [
    {
      title: "Tautan Cepat",
      links: [
        { name: "Beranda", href: "#home" },
        { name: "Alur Proses", href: "#flow" },
        { name: "Statistik", href: "#stats" },
        { name: "Tanya Jawab", href: "#faq" }
      ]
    },
    {
      title: "Akses",
      links: [
        { name: "Masuk", href: "/login" },
        { name: "Pusat Bantuan", href: "#help" },
        { name: "Testimoni", href: "#testimonials" }
      ]
    }
  ];

  return (
    <footer className="relative bg-slate-950 pt-20 pb-10 px-6 font-sans overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Card */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[48px] p-8 md:p-16 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 relative z-10">
            
            {/* Column 1: Branding */}
            <div className="lg:col-span-8 space-y-8">
              <div className="flex items-center gap-4 group cursor-default">
                <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <Shield className="text-white" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">LuminaRead</h2>
                  <p className="text-primary text-xs font-bold uppercase tracking-[0.2em] mt-0.5">Platform Membaca Digital</p>
                </div>
              </div>
              
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm font-medium">
                Platform membaca buku digital modern dan interaktif yang membantu meningkatkan minat baca melalui fitur rekomendasi, pelacakan, dan komunitas pembaca.
              </p>

              <div className="flex items-center gap-3">
                {socialLinks.map((social, i) => (
                  <a 
                    key={i} 
                    href={social.href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 hover:-translate-y-1 shadow-lg"
                  >
                    <social.icon size={18} />
                  </a>
                ))}
              </div>
            </div>

            {/* Column 2: Links */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-4">
              {linkGroups.map((group, i) => (
                <div key={i} className="space-y-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">{group.title}</h3>
                  <ul className="space-y-4">
                    {group.links.map((link, j) => (
                      <li key={j}>
                        <a 
                          href={link.href} 
                          className="text-slate-500 text-sm font-bold flex items-center gap-2 hover:text-primary transition-all group"
                        >
                          <ChevronRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                          {link.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

          </div>

          {/* Card Decorative Blurs */}
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center md:text-left">
            © 2026 Biruru Project. Hak cipta dilindungi undang-undang.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Dibuat dengan</span>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Heart size={14} className="text-red-500 fill-red-500" />
            </motion.div>
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">oleh biruru</span>
          </div>
        </div>
      </div>

      {/* Floating Scroll Top Button */}
      <AnimatePresence>
        {showScroll && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-10 right-10 w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 z-50 hover:-translate-y-2 transition-all active:scale-95 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 -translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <ArrowUp size={24} className="relative z-10" />
          </motion.button>
        )}
      </AnimatePresence>
    </footer>
  );
}
