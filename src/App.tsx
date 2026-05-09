import { MusicPlayer } from './components/MusicPlayer';
import { Background } from './components/Background';
import { motion } from 'motion/react';
import { Headphones, Sparkles, Disc, Mic2, Heart, Music } from 'lucide-react';
import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen font-sans selection:bg-purple-500/30 selection:text-white overflow-x-hidden">
      <Background />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 md:px-12">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center text-white shadow-2xl">
              <Headphones size={20} />
            </div>
            <span className="font-display italic text-lg md:text-xl font-black tracking-tighter uppercase whitespace-nowrap">Play Good, Sound Good</span>
          </div>

          <div className="hidden lg:flex items-center gap-10">
            {['Library', 'Discover', 'Artists', 'Lyrics'].map((item) => (
              <a 
                key={item} 
                href={`#${item.toLowerCase()}`} 
                className="luxury-text text-white/40 hover:text-white transition-colors"
              >
                {item}
              </a>
            ))}
          </div>

          <button className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full luxury-text text-[8px] md:text-[9px] transition-all active:scale-95">
            Pro Account
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative pt-32 md:pt-40 pb-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row items-center gap-12 md:gap-20"
          >
            <div className="flex-1 space-y-8 md:space-y-10 text-center lg:text-left">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-full">
                <Sparkles size={14} className="text-purple-400" />
                <span className="luxury-text text-[8px] md:text-[9px] text-zinc-400">Lossless Streaming Active</span>
              </div>
              
              <h1 className="font-display italic text-5xl sm:text-6xl md:text-8xl font-black leading-[1] md:leading-[0.95] tracking-tighter">
                Sound <br className="hidden md:block" />
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Reimagined.</span>
              </h1>
              
              <p className="text-zinc-400 text-base md:text-lg max-w-lg mx-auto lg:mx-0 leading-relaxed font-light">
                Escape into the clarity of high-fidelity audio. Your music, beautifully rendered behind the elegance of glass.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 pt-4">
                <button className="w-full sm:w-auto px-10 py-5 bg-white text-black hover:bg-purple-500 hover:text-white rounded-2xl luxury-text text-[11px] font-black transition-all flex items-center justify-center gap-3 premium-btn shadow-2xl">
                  Get Started
                </button>
                <div className="flex items-center gap-6">
                  <div className="flex -space-x-3">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-zinc-950 bg-zinc-800" />
                    ))}
                  </div>
                  <span className="luxury-text text-[8px] md:text-[9px] text-zinc-500 uppercase">2.5k listeners active</span>
                </div>
              </div>
            </div>

            <div className="flex-1 relative group w-full max-w-sm md:max-w-md">
              <div className="absolute inset-x-0 -bottom-10 bg-purple-500/20 blur-3xl h-20 -z-10 group-hover:scale-110 transition-transform duration-700" />
              <div className="aspect-square backdrop-blur-3xl bg-white/5 rounded-[40px] border border-white/10 relative overflow-hidden p-8 md:p-12 shadow-2xl transition-all duration-700">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5" />
                <motion.div 
                  animate={{ 
                    y: [0, -15, 0],
                    rotate: [0, 1, 0]
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  className="h-full w-full flex items-center justify-center relative z-10"
                >
                  <Disc className="w-full h-full text-white/5 animate-spin-slow" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 md:w-40 md:h-40 bg-zinc-900 rounded-full border border-white/20 flex items-center justify-center shadow-2xl ring-8 md:ring-12 ring-white/5">
                      <Music className="w-10 h-10 md:w-12 md:h-12 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.5)]" />
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Features Grid */}
          <section className="mt-24 md:mt-40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <FeatureCard 
              icon={<Sparkles size={24} />}
              title="AI Lyrics"
              desc="Real-time lyrics generation and meaning extraction for every track."
            />
            <FeatureCard 
              icon={<Mic2 size={24} />}
              title="Artist DNA"
              desc="Deep dive into artist biographies and historical context instantly."
            />
             <FeatureCard 
              icon={<Heart size={24} />}
              title="Personal Vault"
              desc="Secure IndexedDB storage for your entire offline audio collection."
            />
          </section>
        </div>
      </main>

      {/* Components */}
      <MusicPlayer />

      {/* Footer Meta */}
      <footer className="py-12 border-t border-white/10 px-8 md:px-12 mt-20 backdrop-blur-lg bg-white/[0.02]">
        <div className="max-w-7xl mx-auto flex items-center justify-between luxury-text text-[10px] text-zinc-500">
          <span>&copy; 2026 Play Good, Sound Good Audio</span>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">System Status: Online</a>
            <a href="#" className="hover:text-purple-400 transition-colors">Privacy Architecture</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-10 backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-[32px] hover:bg-white/[0.06] transition-all group">
      <div className="w-16 h-16 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center text-purple-400 mb-8 group-hover:scale-110 transition-transform border border-purple-500/20">
        {icon}
      </div>
      <h3 className="font-display italic text-2xl font-bold mb-4 tracking-tight">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed font-light">{desc}</p>
    </div>
  );
}

