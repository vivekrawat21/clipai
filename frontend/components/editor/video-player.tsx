"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";

export interface VideoPlayerHandle {
  seek(time: number): void;
  play(): void;
  pause(): void;
  getCurrentTime(): number;
}

interface VideoPlayerProps {
  src: string | null;
  poster?: string;
  aspect?: "9:16" | "16:9" | "1:1";
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  showSafeArea?: boolean;
  loadingLabel?: string;
  /** Fired on the video's timeupdate so parents can sync scrubbers. */
  onTimeUpdate?: (time: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      src,
      poster,
      aspect = "9:16",
      autoPlay = false,
      muted = false,
      controls = true,
      className,
      showSafeArea = false,
      loadingLabel = "Loading preview…",
      onTimeUpdate,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(autoPlay);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(muted);
    const [volume, setVolume] = useState(1);
    const [fullscreen, setFullscreen] = useState(false);

    useEffect(() => {
      setLoading(true);
      setError(null);
      setPlaying(autoPlay);
    }, [src, autoPlay]);

    useImperativeHandle(
      ref,
      () => ({
        seek(time: number) {
          const video = videoRef.current;
          if (!video) return;
          video.currentTime = time;
          setProgress(time);
        },
        play() {
          void videoRef.current?.play().catch(() => setError("Playback blocked"));
        },
        pause() {
          videoRef.current?.pause();
        },
        getCurrentTime() {
          return videoRef.current?.currentTime ?? 0;
        },
      }),
      [],
    );

    const togglePlay = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) void video.play().catch(() => setError("Playback blocked"));
      else video.pause();
    }, []);

    const toggleMute = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }, []);

    const onVolume = useCallback((value: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = value;
      video.muted = value === 0;
      setVolume(value);
      setIsMuted(video.muted);
    }, []);

    const seek = useCallback((value: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = value;
      setProgress(value);
    }, []);

    const toggleFullscreen = useCallback(() => {
      const element = videoRef.current?.parentElement;
      if (!element) return;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
        setFullscreen(false);
      } else {
        void element.requestFullscreen().then(() => setFullscreen(true));
      }
    }, []);

    useEffect(() => {
      const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
      document.addEventListener("fullscreenchange", onFsChange);
      return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    const aspectClass =
      aspect === "9:16"
        ? "aspect-[9/16]"
        : aspect === "1:1"
          ? "aspect-square"
          : "aspect-video";

    return (
      <div className={cn("group relative overflow-hidden rounded-xl bg-black", aspectClass, className)}>
        {src ? (
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            muted={muted}
            autoPlay={autoPlay}
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              setProgress(t);
              onTimeUpdate?.(t);
            }}
            onWaiting={() => setLoading(true)}
            onPlaying={() => setLoading(false)}
            onCanPlay={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError("Unable to load this video");
            }}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            No video source
          </div>
        )}

        {showSafeArea && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-8 z-10 mb-12 h-24 border-x-2 border-y-2 border-dashed border-white/20 sm:mb-16"
          />
        )}

        {loading && src && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-black/40">
            <Loader2 className="size-6 animate-spin text-white" aria-hidden />
            <p className="text-xs font-medium text-white/80">{loadingLabel}</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-black/60 px-6 text-center">
            <p className="text-sm font-medium text-white">{error}</p>
            <p className="text-xs text-white/60">The file may still be rendering.</p>
          </div>
        )}

        {controls && src && !error && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <input
              type="range"
              aria-label="Seek"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(progress, duration || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
                className="pointer-events-auto rounded-full p-1 text-white hover:bg-white/15"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
                className="pointer-events-auto rounded-full p-1 text-white hover:bg-white/15"
              >
                {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <input
                type="range"
                aria-label="Volume"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolume(Number(e.target.value))}
                className="h-1 w-14 cursor-pointer appearance-none rounded-full bg-white/20"
              />
              <span className="ml-1 text-[11px] tabular-nums text-white/80">
                {formatDuration(progress)} / {formatDuration(duration)}
              </span>
              <button
                onClick={toggleFullscreen}
                aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                className="pointer-events-auto ml-auto rounded-full p-1 text-white hover:bg-white/15"
              >
                {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";