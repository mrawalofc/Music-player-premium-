import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Music, ChevronDown, 
  Plus, ListMusic, X, Info, MicVocal, Loader2, SkipBack, SkipForward, ArrowDownToLine, Sparkles,
  Trash2, GripVertical, CheckCircle2, Download, Database, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { get, set, del, keys } from 'idb-keyval';
import { Visualizer } from './Visualizer';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getSongMetadata, getSongRecommendations, type SongMetadata, type RecommendedSong } from '@/src/services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  blob?: Blob;
  isUserUploaded?: boolean;
  isDownloaded?: boolean;
}

const DEFAULT_SONGS: Song[] = [
  {
    id: 'default_1',
    title: 'Ethereal Voyage',
    artist: 'VibeShell Studio',
    url: 'https://assets.mixkit.co/music/preview/mixkit-ethereal-fairy-win-2019.mp3',
  }
];

export const MusicPlayer: React.FC = () => {
  const [playlist, setPlaylist] = useState<Song[]>(DEFAULT_SONGS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingProgress, setDownloadingProgress] = useState<Record<string, number>>({});
  const [songMetadata, setSongMetadata] = useState<SongMetadata | null>(null);
  const [vizSensitivity, setVizSensitivity] = useState(1.5);
  const [vizBitRate, setVizBitRate] = useState(128);
  const [vizColor, setVizColor] = useState('#a855f7');

  const VISUALIZER_COLORS = [
    '#a855f7', // Purple
    '#3b82f6', // Blue
    '#06b6d4', // Cyan
    '#10b8k81', // Emerald
    '#f59e0b', // Amber
    '#f43f5e', // Rose
    '#ffffff', // White
  ].map(c => c.slice(0, 7)); // Ensure 7 chars
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedSong[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [listeningHistory, setListeningHistory] = useState<{ title: string, artist: string }[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const metadataCache = useRef<Record<string, SongMetadata>>({});

  const currentSong = playlist[currentSongIndex];

  // Load from IndexedDB
  useEffect(() => {
    const loadStoredSongs = async () => {
      try {
        const idbKeys = await keys();
        const musicKeys = idbKeys.filter(k => typeof k === 'string' && (k.startsWith('song_') || k.startsWith('cached_')));
        
        const storedSongsMap: Record<string, Song> = {};
        for (const key of musicKeys) {
          const songData = await get(key);
          if (songData && songData.blob) {
            const url = URL.createObjectURL(songData.blob);
            const isUserUploaded = (key as string).startsWith('song_');
            const songId = isUserUploaded ? (key as string) : (key as string).replace('cached_', '');
            
            storedSongsMap[songId] = {
              id: songId,
              title: songData.title,
              artist: songData.artist,
              url: url,
              blob: songData.blob,
              isUserUploaded: isUserUploaded,
              isDownloaded: true
            };
          }
        }
        
        setPlaylist(prev => {
          // Merge stored songs into the playlist
          const merged = prev.map(song => {
            if (storedSongsMap[song.id]) {
              return { ...song, ...storedSongsMap[song.id] };
            }
            return song;
          });

          // Add any user uploaded songs that weren't in the initial playlist
          const extraUserSongs = Object.values(storedSongsMap).filter(s => s.isUserUploaded && !merged.find(ps => ps.id === s.id));
          return [...merged, ...extraUserSongs];
        });
      } catch (err) {
        console.error("Failed to load stored songs:", err);
      }
    };

    loadStoredSongs();

    return () => {
      playlist.forEach(song => {
        if (song.url.startsWith('blob:')) {
          URL.revokeObjectURL(song.url);
        }
      });
    };
  }, []);

  // Fetch Metadata & Recommendations
  useEffect(() => {
    if (!currentSong) return;

    const updateHistoryAndMetadata = async () => {
      setListeningHistory(prev => {
        const last = prev[prev.length - 1];
        if (last?.title === currentSong.title && last?.artist === currentSong.artist) return prev;
        return [...prev.slice(-4), { title: currentSong.title, artist: currentSong.artist }];
      });

      if (metadataCache.current[currentSong.id]) {
        setSongMetadata(metadataCache.current[currentSong.id]);
      } else {
        setIsLoadingMetadata(true);
        const metadata = await getSongMetadata(currentSong.title, currentSong.artist);
        metadataCache.current[currentSong.id] = metadata;
        setSongMetadata(metadata);
        setIsLoadingMetadata(false);
      }
    };

    updateHistoryAndMetadata();
  }, [currentSongIndex, !!currentSong]);

  const fetchRecommendations = async () => {
    if (listeningHistory.length === 0) return;
    setIsLoadingRecommendations(true);
    const recs = await getSongRecommendations(listeningHistory);
    setRecommendations(recs);
    setIsLoadingRecommendations(false);
  };

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && currentSong) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [currentSongIndex, isPlaying, !!currentSong]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (audioRef.current && currentSong) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipTrack = (direction: 'next' | 'prev') => {
    if (playlist.length === 0) return;
    let nextIndex = (direction === 'next') 
      ? (currentSongIndex + 1) % playlist.length
      : (currentSongIndex - 1 + playlist.length) % playlist.length;
    setCurrentSongIndex(nextIndex);
    setIsPlaying(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newSongs: Song[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = `song_${Date.now()}_${i}`;
      const songData = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: 'Personal Collection',
        blob: file
      };

      try {
        await set(id, songData);
        const url = URL.createObjectURL(file);
        newSongs.push({
          id,
          title: songData.title,
          artist: songData.artist,
          url,
          blob: file,
          isUserUploaded: true,
          isDownloaded: true
        });
      } catch (err) {
        console.error("Failed to store song:", err);
      }
    }

    if (newSongs.length > 0) {
      setPlaylist(prev => [...prev, ...newSongs]);
      setCurrentSongIndex(playlist.length);
      setIsPlaying(true);
      setShowPlaylist(true);
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadSong = async (song: Song) => {
    if (song.isDownloaded || downloadingProgress[song.id] !== undefined) return;

    setDownloadingProgress(prev => ({ ...prev, [song.id]: 0 }));
    
    try {
      const response = await fetch(song.url);
      if (!response.ok) throw new Error('Network response was not ok');
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Body reader not available');

      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        if (total > 0) {
          const progress = Math.round((loaded / total) * 100);
          setDownloadingProgress(prev => ({ ...prev, [song.id]: progress }));
        }
      }

      const blob = new Blob(chunks);
      const storageKey = `cached_${song.id}`;
      
      await set(storageKey, {
        title: song.title,
        artist: song.artist,
        blob: blob
      });

      const localUrl = URL.createObjectURL(blob);
      setPlaylist(prev => prev.map(s => s.id === song.id ? { ...s, url: localUrl, blob, isDownloaded: true } : s));
    } catch (err) {
      console.error("Failed to download song:", err);
    } finally {
      setDownloadingProgress(prev => {
        const next = { ...prev };
        delete next[song.id];
        return next;
      });
    }
  };

  const downloadAll = async () => {
    const toDownload = playlist.filter(s => !s.isDownloaded);
    for (const song of toDownload) {
      await downloadSong(song);
    }
  };

  const removeSong = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const songToRemove = playlist.find(s => s.id === id);
      if (songToRemove?.isDownloaded) {
        const storageKey = songToRemove.isUserUploaded ? id : `cached_${id}`;
        await del(storageKey);
        if (songToRemove.url.startsWith('blob:')) {
          URL.revokeObjectURL(songToRemove.url);
        }
      }
      
      const newPlaylist = playlist.filter(s => s.id !== id);
      const wasPlaying = playlist[currentSongIndex]?.id === id;
      
      setPlaylist(newPlaylist);
      if (wasPlaying) {
        setIsPlaying(false);
        setCurrentSongIndex(0);
      } else {
        const newIndex = newPlaylist.findIndex(s => s.id === playlist[currentSongIndex]?.id);
        setCurrentSongIndex(newIndex !== -1 ? newIndex : 0);
      }
    } catch (err) {
      console.error("Failed to remove song:", err);
    }
  };

  const handleReorder = (newOrder: Song[]) => {
    const currentId = playlist[currentSongIndex]?.id;
    setPlaylist(newOrder);
    if (currentId) {
      const newIdx = newOrder.findIndex(s => s.id === currentId);
      if (newIdx !== -1) setCurrentSongIndex(newIdx);
    }
  };

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const totalOfflineSize = playlist.reduce((acc, s) => acc + (s.blob?.size || 0), 0);
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={cn(
      "fixed inset-0 z-[150] transition-all duration-500 pointer-events-none",
      isExpanded ? "bg-black/40 backdrop-blur-sm pointer-events-auto" : "flex items-end justify-center pointer-events-none pb-8 px-4 md:pb-12"
    )}>
      <div className={cn(
        "w-full max-w-xl pointer-events-auto relative transition-all duration-500",
        isExpanded 
          ? "fixed inset-x-0 bottom-0 top-0 h-full md:relative md:inset-auto md:h-auto md:max-w-xl" 
          : "relative"
      )}>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={window.innerWidth < 768 ? { y: '100%' } : { opacity: 0, y: 50, scale: 0.95 }}
              animate={window.innerWidth < 768 ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
              exit={window.innerWidth < 768 ? { y: '100%' } : { opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={cn(
                "bg-black md:bg-black/60 backdrop-blur-3xl border-t md:border border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden",
                "h-full md:h-auto md:rounded-[40px] p-6 md:p-8 flex flex-col"
              )}
            >
              <div className="flex items-center justify-between mb-6 md:mb-8 flex-shrink-0">
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setShowPlaylist(!showPlaylist);
                      setShowDetails(false);
                      setShowRecommendations(false);
                      setShowStorage(false);
                    }}
                    className={cn(
                      "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all border border-white/5",
                      showPlaylist ? "bg-white text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    <ListMusic size={20} />
                  </button>
                  <button 
                    onClick={() => {
                      setShowRecommendations(!showRecommendations);
                      setShowPlaylist(false);
                      setShowDetails(false);
                      setShowStorage(false);
                      if (!showRecommendations) fetchRecommendations();
                    }}
                    className={cn(
                      "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all border border-white/5",
                      showRecommendations ? "bg-purple-500 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    <Sparkles size={20} />
                  </button>
                  <button 
                    onClick={() => {
                      setShowStorage(!showStorage);
                      setShowPlaylist(false);
                      setShowDetails(false);
                      setShowRecommendations(false);
                    }}
                    className={cn(
                      "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all border border-white/5",
                      showStorage ? "bg-emerald-500 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    <Database size={20} />
                  </button>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.8)] animate-pulse mb-2" />
                  <span className="luxury-text text-[8px] md:text-[9px] text-purple-400 whitespace-nowrap">Velocity Pro Mode</span>
                </div>

                <button 
                  onClick={() => setIsExpanded(false)}
                  className="w-10 h-10 md:w-12 md:h-12 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl text-white/40 flex items-center justify-center border border-white/5 transition-colors"
                >
                  <ChevronDown size={24} />
                </button>
              </div>

              <div className="flex-1 min-h-0">
                {!showPlaylist && !showDetails && !showRecommendations && !showStorage ? (
                  <div className="h-full flex flex-col">
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-4 md:py-0">
                      <motion.div 
                        animate={isPlaying ? { rotate: 360 } : {}}
                        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                        className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-full flex items-center justify-center text-purple-400 border-[8px] md:border-[12px] border-white/5 relative shadow-2xl mb-8 md:mb-10 overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white z-10 border-4 border-zinc-900/50">
                          <Music size={window.innerWidth < 768 ? 24 : 32} />
                        </div>
                      </motion.div>
                      
                      {/* Audio Visualizer */}
                      <div className="mb-6 flex flex-col items-center gap-4">
                        <Visualizer 
                          audioRef={audioRef} 
                          isPlaying={isPlaying} 
                          color={vizColor} 
                          sensitivity={vizSensitivity}
                          bitRate={vizBitRate}
                        />
                        
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex gap-2.5">
                            {[
                              '#a855f7', '#3b82f6', '#06b6d4', '#10b881', '#f59e0b', '#f43f5e', '#ffffff'
                            ].map((color) => (
                              <button
                                key={color}
                                onClick={() => setVizColor(color)}
                                className={cn(
                                  "w-5 h-5 md:w-4 md:h-4 rounded-full border border-white/20 transition-all duration-300",
                                  vizColor === color 
                                    ? "ring-2 ring-white ring-offset-4 ring-offset-black scale-125 shadow-[0_0_15px_rgba(255,255,255,0.3)]" 
                                    : "hover:scale-110 opacity-60 hover:opacity-100"
                                )}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          
                          <div className="flex items-center gap-2 text-[8px] luxury-text text-white/20 uppercase tracking-[0.2em]">
                            <BarChart3 size={10} />
                            <span>Frequency Response: {vizColor === '#ffffff' ? 'Pure' : 'Vivid'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-center gap-2 mb-2">
                        <h2 className="font-display italic text-3xl sm:text-4xl font-bold text-white line-clamp-1 w-full px-4">
                          {currentSong?.title || "Silence"}
                        </h2>
                        {currentSong?.isDownloaded && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                            <CheckCircle2 size={10} className="text-emerald-400" />
                            <span className="text-[8px] luxury-text text-emerald-400">Offline Ready</span>
                          </div>
                        )}
                      </div>
                      <p className="luxury-text text-[10px] md:text-xs text-white/40">{currentSong?.artist}</p>
                    </div>

                    <div className="space-y-4 py-6">
                      <input 
                        type="range" 
                        min="0" 
                        max={duration || 100} 
                        value={currentTime}
                        onChange={(e) => {
                          const time = parseFloat(e.target.value);
                          if (audioRef.current) audioRef.current.currentTime = time;
                        }}
                        className="w-full h-1.5 md:h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all focus:outline-none"
                      />
                      <div className="flex justify-between font-mono text-[10px] text-white/30 px-1">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-6 md:gap-8 pb-4">
                      <div className="flex items-center justify-center gap-8 sm:gap-12">
                        <button onClick={() => skipTrack('prev')} className="text-white/40 hover:text-white transition-all transform active:scale-90 p-4 md:p-2">
                          <SkipBack size={window.innerWidth < 768 ? 32 : 28} fill="currentColor" />
                        </button>
                        
                        <button 
                          onClick={togglePlay}
                          className="w-20 h-20 md:w-24 md:h-24 bg-white text-black rounded-full flex items-center justify-center hover:bg-purple-500 hover:text-white hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(168,85,247,0.2)] border-[4px] md:border-[6px] border-zinc-950/20"
                        >
                          {isPlaying ? (
                            <Pause size={window.innerWidth < 768 ? 32 : 36} fill="currentColor" />
                          ) : (
                            <Play size={window.innerWidth < 768 ? 32 : 36} fill="currentColor" className="ml-1.5" />
                          )}
                        </button>

                        <button onClick={() => skipTrack('next')} className="text-white/40 hover:text-white transition-all transform active:scale-90 p-4 md:p-2">
                          <SkipForward size={window.innerWidth < 768 ? 32 : 28} fill="currentColor" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between bg-white/[0.03] rounded-3xl p-4 border border-white/5">
                        <div className="hidden lg:flex flex-col gap-2 flex-1 max-w-[120px] mr-4">
                          <div className="flex justify-between luxury-text text-[7px] text-white/30 uppercase">
                            <span>Viz Sens</span>
                            <span>{vizSensitivity.toFixed(1)}x</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.5" 
                            max="2.5" 
                            step="0.1"
                            value={vizSensitivity}
                            onChange={(e) => setVizSensitivity(parseFloat(e.target.value))}
                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>

                        <div className="hidden lg:flex flex-col gap-2 flex-1 max-w-[120px] mr-4">
                          <div className="flex justify-between luxury-text text-[7px] text-white/30 uppercase">
                            <span>Viz Bit</span>
                            <span>{vizBitRate}</span>
                          </div>
                          <input 
                            type="range" 
                            min="32" 
                            max="512" 
                            step="32"
                            value={vizBitRate}
                            onChange={(e) => setVizBitRate(parseInt(e.target.value))}
                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                        
                        <div className="hidden sm:flex items-center gap-4 flex-1 max-w-[200px]">
                          <button onClick={() => setIsMuted(!isMuted)} className="text-white/40 hover:text-purple-400 transition-colors">
                            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                          </button>
                          <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.01" 
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>

                        <div className="flex w-full sm:w-auto gap-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (currentSong) downloadSong(currentSong);
                            }}
                            disabled={currentSong?.isDownloaded || downloadingProgress[currentSong?.id || ''] !== undefined}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-4 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all border border-white/5 disabled:opacity-80 relative overflow-hidden"
                          >
                           {downloadingProgress[currentSong?.id || ''] !== undefined && (
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${downloadingProgress[currentSong?.id || '']}%` }}
                                className="absolute inset-0 bg-emerald-500/20 pointer-events-none"
                              />
                            )}
                            
                            <div className="relative z-10 flex items-center gap-2">
                              {downloadingProgress[currentSong?.id || ''] !== undefined ? (
                                <Loader2 size={14} className="animate-spin text-purple-400" />
                              ) : currentSong?.isDownloaded ? (
                                <CheckCircle2 size={14} className="text-emerald-400" />
                              ) : (
                                <Download size={14} className="group-hover:text-purple-400" />
                              )}
                              <span>
                                {downloadingProgress[currentSong?.id || ''] !== undefined 
                                  ? `${downloadingProgress[currentSong?.id || '']}%` 
                                  : currentSong?.isDownloaded ? 'Offline' : 'Download'}
                              </span>
                            </div>
                          </button>
                          <button 
                            onClick={() => setShowDetails(true)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all border border-white/5 active:scale-95 group"
                          >
                            <MicVocal size={14} className="group-hover:text-purple-400" />
                            Lyrics
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : showStorage ? (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/10">
                          <Database size={18} />
                        </div>
                        <h3 className="luxury-text text-[11px] text-white">Storage Manager</h3>
                      </div>
                      <button onClick={() => setShowStorage(false)} className="w-10 h-10 hover:bg-white/5 rounded-xl flex items-center justify-center text-white/40">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto px-1 space-y-8 custom-scrollbar overscroll-contain">
                      <div className="flex flex-col items-center gap-6 py-4">
                        <div className="relative w-32 h-32">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="58"
                              className="stroke-white/5 fill-none"
                              strokeWidth="6"
                            />
                            <motion.circle
                              initial={{ strokeDasharray: "0 364" }}
                              animate={{ strokeDasharray: `${Math.min(364, (totalOfflineSize / (500 * 1024 * 1024)) * 364)} 364` }}
                              cx="64"
                              cy="64"
                              r="58"
                              className="stroke-emerald-500 fill-none"
                              strokeWidth="6"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-bold text-white mb-1">{formatSize(totalOfflineSize)}</span>
                            <span className="text-[7px] luxury-text text-zinc-500">Local Cache</span>
                          </div>
                        </div>

                        <div className="w-full space-y-3">
                          <div className="flex justify-between items-center luxury-text text-[8px] text-zinc-500">
                             <span>Storage Limit</span>
                             <span>500 MB</span>
                          </div>
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${Math.min(100, (totalOfflineSize / (500 * 1024 * 1024)) * 100)}%` }}
                               className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                             />
                          </div>
                        </div>
                      </div>

                      {Object.keys(downloadingProgress).length > 0 && (
                        <section className="space-y-3">
                          <div className="flex items-center gap-2 text-emerald-400">
                            <Loader2 size={12} className="animate-spin" />
                            <span className="luxury-text text-[8px]">Active Syncing</span>
                          </div>
                          <div className="space-y-2">
                            {playlist.filter(s => downloadingProgress[s.id] !== undefined).map(song => (
                              <div key={song.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] font-bold text-white truncate w-2/3">{song.title}</span>
                                  <span className="text-[10px] font-mono text-emerald-400">{downloadingProgress[song.id]}%</span>
                                </div>
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${downloadingProgress[song.id]}%` }}
                                    className="h-full bg-emerald-400"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      <section className="space-y-4">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <ListMusic size={12} />
                          <span className="luxury-text text-[8px]">Offline Library ({playlist.filter(s => s.isDownloaded).length})</span>
                        </div>
                        <div className="space-y-2">
                          {playlist.filter(s => s.isDownloaded).map(song => (
                            <div key={song.id} className="group flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-colors">
                              <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-bold text-white truncate">{song.title}</span>
                                <span className="text-[8px] text-zinc-500 uppercase">{formatSize(song.blob?.size || 0)}</span>
                              </div>
                              <button 
                                onClick={(e) => removeSong(song.id, e)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>

                    <div className="flex gap-3 pt-6 shrink-0">
                      <button 
                        onClick={downloadAll}
                        disabled={playlist.every(s => s.isDownloaded)}
                        className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-500 text-black rounded-2xl luxury-text text-[10px] font-bold hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
                      >
                        <Download size={14} /> Sync All
                      </button>
                      <button 
                         onClick={async () => {
                            const offline = playlist.filter(s => s.isDownloaded);
                            for (const song of offline) {
                              const storageKey = song.isUserUploaded ? song.id : `cached_${song.id}`;
                              await del(storageKey);
                              if (song.url.startsWith('blob:')) URL.revokeObjectURL(song.url);
                            }
                            setPlaylist(prev => prev.map(s => ({ ...s, isDownloaded: false, blob: undefined })));
                          }}
                        className="flex items-center justify-center gap-2 px-6 py-4 bg-white/5 border border-white/10 text-white rounded-2xl luxury-text text-[10px] font-bold hover:bg-red-500/10 hover:border-red-500/20 transition-all hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : showRecommendations ? (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/10">
                          <Sparkles size={18} />
                        </div>
                        <h3 className="luxury-text text-[11px] text-white">Recommended</h3>
                      </div>
                      <button onClick={() => setShowRecommendations(false)} className="w-10 h-10 hover:bg-white/5 rounded-xl flex items-center justify-center text-white/40">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                      {isLoadingRecommendations ? (
                        <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                          <Loader2 size={32} className="animate-spin text-purple-400" />
                          <span className="luxury-text">Analyzing VibeHistory...</span>
                        </div>
                      ) : recommendations.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center px-10">
                          <p className="text-sm italic">"Play more music to wake the algorithm."</p>
                        </div>
                      ) : (
                        recommendations.map((rec, i) => (
                          <div 
                            key={i}
                            className="bg-white/5 rounded-2xl p-4 border border-white/10 group"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold truncate text-white">{rec.title}</h4>
                                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">{rec.artist}</p>
                              </div>
                              <button 
                                onClick={() => {
                                  const newSong: Song = {
                                    id: `rec_${Date.now()}_${i}`,
                                    title: rec.title,
                                    artist: rec.artist,
                                    url: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibe-2257.mp3'
                                  };
                                  setPlaylist(prev => [...prev, newSong]);
                                  setCurrentSongIndex(playlist.length);
                                  setIsPlaying(true);
                                  setShowRecommendations(false);
                                }}
                                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white text-white hover:text-black flex items-center justify-center transition-all border border-white/10 shrink-0 ml-4"
                              >
                                <Plus size={18} />
                              </button>
                            </div>
                            <p className="text-[11px] text-zinc-400 italic leading-relaxed">
                              {rec.reason}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <button 
                      onClick={fetchRecommendations}
                      className="mt-6 py-4 text-[10px] luxury-text text-purple-400 hover:text-white transition-colors flex-shrink-0"
                    >
                      Refresh Suggestions
                    </button>
                  </div>
                ) : showDetails ? (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/10">
                          <MicVocal size={18} />
                        </div>
                        <h3 className="luxury-text text-[11px] text-white">Insight</h3>
                      </div>
                      <button onClick={() => setShowDetails(false)} className="w-10 h-10 hover:bg-white/5 rounded-xl flex items-center justify-center text-white/40">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-8 custom-scrollbar">
                      {isLoadingMetadata ? (
                        <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                          <Loader2 size={32} className="animate-spin text-purple-400" />
                          <span className="luxury-text">Searching Nebula...</span>
                        </div>
                      ) : (
                        <>
                          <section className="space-y-4">
                            <div className="flex items-center gap-2 text-purple-400">
                              <Info size={14} />
                              <span className="luxury-text text-[9px]">Artist & Genre</span>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-5 md:p-6 border border-white/10">
                              <p className="text-zinc-400 leading-relaxed text-sm mb-4 font-light italic">
                                {songMetadata?.artistBio}
                              </p>
                              <div className="flex gap-4">
                                <div className="px-3 py-1 bg-purple-500/10 rounded-lg text-purple-400 text-[9px] font-bold uppercase border border-purple-500/20">
                                  {songMetadata?.genre}
                                </div>
                              </div>
                            </div>
                          </section>

                          <section className="space-y-4">
                            <div className="flex items-center gap-2 text-purple-400">
                              <MicVocal size={14} />
                              <span className="luxury-text text-[9px]">Lyrics</span>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-6 md:p-8 border border-white/10">
                              <pre className="whitespace-pre-wrap font-sans text-lg md:text-xl text-white font-medium leading-[1.8] italic tracking-tight">
                                {songMetadata?.lyrics}
                              </pre>
                            </div>
                          </section>

                          <section className="space-y-4 pb-8">
                            <div className="flex items-center gap-2 text-purple-400">
                               <Music size={14} />
                              <span className="luxury-text text-[9px]">Fun Fact</span>
                            </div>
                            <div className="bg-emerald-500/5 rounded-2xl p-5 md:p-6 border border-emerald-500/10">
                              <p className="text-emerald-400 text-sm italic font-light leading-relaxed">
                                "{songMetadata?.funFact}"
                              </p>
                            </div>
                          </section>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/10">
                          <ListMusic size={18} />
                        </div>
                        <h3 className="luxury-text text-[11px] text-white">Collection</h3>
                      </div>
                      <button onClick={() => setShowPlaylist(false)} className="w-10 h-10 hover:bg-white/5 rounded-xl flex items-center justify-center text-white/40">
                        <X size={20} />
                      </button>
                    </div>

                    <Reorder.Group 
                      axis="y" 
                      values={playlist} 
                      onReorder={handleReorder}
                      className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar"
                    >
                      {playlist.map((song, index) => (
                        <Reorder.Item 
                          key={song.id}
                          value={song}
                          className={cn(
                            "group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border",
                            currentSongIndex === index 
                              ? "bg-gradient-to-tr from-purple-500 to-blue-500 text-white border-white/10 shadow-xl" 
                              : "bg-white/5 border-white/10 active:bg-white/10 text-white/80"
                          )}
                          onClick={() => {
                            setCurrentSongIndex(index);
                            setIsPlaying(true);
                            if (window.innerWidth < 768) setShowPlaylist(false);
                          }}
                        >
                          <div className="text-white/20">
                            <GripVertical size={14} />
                          </div>

                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all relative",
                            currentSongIndex === index ? "bg-black/20" : "bg-black/40"
                          )}>
                            {currentSongIndex === index && isPlaying ? (
                              <div className="flex items-end gap-0.5 h-3">
                                <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className={cn("w-0.5", currentSongIndex === index ? "bg-white" : "bg-purple-400")} />
                                <motion.div animate={{ height: [12, 4, 12] }} transition={{ repeat: Infinity, duration: 0.6 }} className={cn("w-0.5", currentSongIndex === index ? "bg-white" : "bg-purple-400")} />
                                <motion.div animate={{ height: [6, 10, 6] }} transition={{ repeat: Infinity, duration: 0.55 }} className={cn("w-0.5", currentSongIndex === index ? "bg-white" : "bg-purple-400")} />
                              </div>
                            ) : (
                              <Music size={16} className={currentSongIndex === index ? "text-white" : "text-purple-400"} />
                            )}
                            
                            {song.isDownloaded && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 p-0.5 rounded-full ring-2 ring-zinc-950">
                                <CheckCircle2 size={6} className="text-black" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <p className="text-xs font-bold truncate tracking-tight">{song.title}</p>
                              {song.blob?.size && (
                                <span className="text-[8px] text-zinc-500 font-mono ml-2">{formatSize(song.blob.size)}</span>
                              )}
                            </div>
                            <p className={cn(
                              "text-[9px] uppercase font-bold tracking-widest truncate mt-0.5",
                              currentSongIndex === index ? "text-white/60" : "text-zinc-500"
                            )}>
                              {song.artist}
                            </p>
                            {downloadingProgress[song.id] !== undefined && (
                              <div className="w-full h-0.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${downloadingProgress[song.id]}%` }}
                                  className="h-full bg-emerald-400"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {!song.isDownloaded && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadSong(song);
                                }}
                                className="p-2 hover:bg-white/10 text-white/40 hover:text-white rounded-lg transition-colors"
                              >
                                {downloadingProgress[song.id] !== undefined ? (
                                  <div className="text-[8px] font-mono font-bold text-emerald-400">
                                    {downloadingProgress[song.id]}%
                                  </div>
                                ) : (
                                  <Download size={14} />
                                )}
                              </button>
                            )}
                            <button 
                              onClick={(e) => removeSong(song.id, e)}
                              className={cn(
                                "p-2 rounded-lg transition-all shrink-0",
                                currentSongIndex === index ? "hover:bg-white/10 text-white" : "text-white/20 hover:text-red-400 hover:bg-red-400/10"
                              )}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>

                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="mt-6 flex-shrink-0 relative group w-full h-14 bg-white text-black rounded-[20px] flex items-center justify-center gap-3 hover:bg-purple-500 hover:text-white transition-all duration-300 disabled:opacity-50 font-bold uppercase text-[10px] tracking-widest overflow-hidden premium-btn shadow-2xl active:scale-95"
                    >
                      {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
                      {isUploading ? "Importing Master..." : "Add to Library"}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" multiple className="hidden" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Mini Controller */}
        <div className={cn(
          "flex items-center justify-center transition-all duration-500 w-full px-4 mb-2 md:mb-0",
          isExpanded ? "opacity-0 translate-y-10 pointer-events-none" : "opacity-100 translate-y-0"
        )}>
          <button 
            onClick={() => setIsExpanded(true)}
            className="w-full md:w-auto h-16 rounded-[24px] md:rounded-[28px] flex items-center justify-between md:justify-start gap-4 px-5 md:px-6 transition-all shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] cursor-pointer bg-zinc-900 border border-white/10 hover:scale-105 active:scale-95 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                <Music size={18} className={isPlaying ? "animate-pulse" : ""} />
              </div>
              <div className="flex flex-col items-start pr-4 border-r border-white/10 max-w-[120px] sm:max-w-[200px]">
                <div className="flex items-center gap-2 w-full">
                  <span className="text-[10px] font-bold truncate text-left">{currentSong?.title || "No Media"}</span>
                  {currentSong?.isDownloaded && <CheckCircle2 size={8} className="text-emerald-400 shrink-0" />}
                </div>
                <span className="text-[8px] opacity-40 uppercase tracking-widest font-mono">{isPlaying ? "Streaming" : "Standby"}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 relative z-10 shrink-0">
              <span className="hidden sm:block luxury-text text-[8px] opacity-60">Expand Player</span>
              <div className="rotate-180 text-purple-400 group-hover:translate-y-[-2px] transition-transform">
                <ArrowDownToLine size={16} />
              </div>
            </div>
          </button>
        </div>
      </div>

      <audio 
        ref={audioRef} 
        src={currentSong?.url} 
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => skipTrack('next')}
      />
    </div>
  );
};
