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

    // Particle system state
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      life: number;
      maxLife: number;
      color: string;

      constructor(x: number, y: number, color: string) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -Math.random() * 3 - 1;
        this.size = Math.random() * 2 + 1;
        this.maxLife = Math.random() * 30 + 20;
        this.life = this.maxLife;
        this.color = color;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
      }

      draw(ctx: CanvasRenderingContext2D) {
        const opacity = this.life / this.maxLife;
        ctx.fillStyle = `${this.color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const particles: Particle[] = [];

    const render = () => {
      if (!analyserRef.current || !contextRef.current) return;
      
      if (contextRef.current.state === 'suspended') {
        contextRef.current.resume();
      }
      
      const width = canvas.width;
      const height = canvas.height;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      // Add a subtle glow effect to the background
      let totalEnergy = 0;
      for (let i = 0; i < bufferLength; i++) totalEnergy += dataArray[i];
      const avgEnergy = totalEnergy / bufferLength;
      
      const glowOpacity = (avgEnergy / 255) * 0.15;
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      
      const barWidth = (width / (bufferLength * 0.8));
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * sensitivity;
        
        // Spawn particles on frequency spikes
        if (dataArray[i] > 200 && particles.length < 50 && Math.random() > 0.9) {
          particles.push(new Particle(x + barWidth / 2, height - barHeight, color));
        }

        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, `${color}11`);
        gradient.addColorStop(1, color);

        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        const r = 2;
        ctx.roundRect(x, height - barHeight, Math.max(1, barWidth - 4), barHeight, [r, r, 0, 0]);
        ctx.fill();

        x += barWidth;
      }

      // Update and draw particles
      ctx.shadowBlur = 0;
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
          particles.splice(i, 1);
        } else {
          particles[i].draw(ctx);
        }
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
