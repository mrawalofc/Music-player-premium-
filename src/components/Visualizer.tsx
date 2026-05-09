import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  color?: string;
  sensitivity?: number; // Adjusts how much the bars react (0.1 to 2.0)
  bitRate?: number; // Maps to FFT size (low = 32, med = 128, high = 512)
}

export const Visualizer: React.FC<VisualizerProps> = ({ 
  audioRef, 
  isPlaying, 
  color = '#a855f7',
  sensitivity = 1.0,
  bitRate = 128
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (!audioRef.current || !canvasRef.current || analyserRef.current) return;

    // Initialize Web Audio API
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = context.createAnalyser();
    const source = context.createMediaElementSource(audioRef.current);

    source.connect(analyser);
    analyser.connect(context.destination);

    analyser.fftSize = bitRate; // Dynamic FFT size
    analyser.smoothingTimeConstant = 0.8; // Smoothness factor
    
    analyserRef.current = analyser;
    contextRef.current = context;
    sourceRef.current = source;

    return () => {
      cancelAnimationFrame(animationRef.current);
      if (context.state !== 'closed') {
        context.close();
      }
    };
  }, [bitRate]);

  // Handle sensitivity and bitrate changes
  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.fftSize = bitRate;
    }
  }, [bitRate]);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (!analyserRef.current || !contextRef.current) return;
      
      // Auto-resume context if it's suspended (browser policy)
      if (contextRef.current.state === 'suspended') {
        contextRef.current.resume();
      }
      
      const width = canvas.width;
      const height = canvas.height;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / (bufferLength * 0.8)); // Zoom into lower/mid frequencies for better visual
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Apply sensitivity and scaling
        const barHeight = (dataArray[i] / 255) * height * sensitivity;
        
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, `${color}22`);
        gradient.addColorStop(1, color);

        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        const r = 3;
        ctx.roundRect(x, height - barHeight, Math.max(1, barWidth - 4), barHeight, [r, r, 0, 0]);
        ctx.fill();

        x += barWidth;
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, color, sensitivity]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={60} 
      className="w-full max-w-[280px] h-12 opacity-80"
    />
  );
};
