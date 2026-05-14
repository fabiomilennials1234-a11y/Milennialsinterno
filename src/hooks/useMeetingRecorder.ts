import { useState, useRef, useCallback, useEffect } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

interface UseMeetingRecorderOptions {
  /** Called when recording stops externally (e.g. user clicks browser "Stop sharing"). */
  onAutoStop?: (durationSeconds: number) => void;
  /** Called for each video chunk from timeslice. */
  onVideoChunk?: (blob: Blob, index: number) => void;
  /** Called for each audio chunk from timeslice. */
  onAudioChunk?: (blob: Blob, index: number) => void;
}

interface UseMeetingRecorderReturn {
  status: RecorderStatus;
  durationSeconds: number;
  error: string | null;
  isSupported: boolean;
  videoChunkIndex: number;
  audioChunkIndex: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<number>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
}

/**
 * Hook for screen + audio recording via getDisplayMedia.
 *
 * In chunked mode (when onVideoChunk/onAudioChunk are provided),
 * chunks are delivered via callbacks and NOT accumulated in memory.
 * stopRecording() returns only durationSeconds.
 */
export function useMeetingRecorder(options?: UseMeetingRecorderOptions): UseMeetingRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoChunkIndex, setVideoChunkIndex] = useState(0);
  const [audioChunkIndex, setAudioChunkIndex] = useState(0);

  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveStopRef = useRef<((durationSeconds: number) => void) | null>(null);
  const durationRef = useRef(0);
  const stopInternalRef = useRef<() => void>(() => {});

  // Chunk indices tracked via refs for synchronous access in callbacks
  const videoIndexRef = useRef(0);
  const audioIndexRef = useRef(0);

  // Keep callbacks in refs for stable references
  const onAutoStopRef = useRef(options?.onAutoStop);
  const onVideoChunkRef = useRef(options?.onVideoChunk);
  const onAudioChunkRef = useRef(options?.onAudioChunk);
  onAutoStopRef.current = options?.onAutoStop;
  onVideoChunkRef.current = options?.onVideoChunk;
  onAudioChunkRef.current = options?.onAudioChunk;

  const isSupported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && !!navigator.mediaDevices.getDisplayMedia;

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach(t => t.stop());
      displayStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    videoRecorderRef.current = null;
    audioRecorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  const startTimer = useCallback(() => {
    durationRef.current = 0;
    setDurationSeconds(0);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDurationSeconds(durationRef.current);
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resumeTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDurationSeconds(durationRef.current);
    }, 1000);
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Seu navegador nao suporta gravacao de tela.');
      setStatus('error');
      return;
    }

    try {
      setError(null);
      videoIndexRef.current = 0;
      audioIndexRef.current = 0;
      setVideoChunkIndex(0);
      setAudioChunkIndex(0);

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });

      displayStreamRef.current = displayStream;

      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // Microphone not available — continue without it
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      const displayAudioTracks = displayStream.getAudioTracks();
      if (displayAudioTracks.length > 0) {
        const displaySource = audioContext.createMediaStreamSource(
          new MediaStream(displayAudioTracks)
        );
        displaySource.connect(destination);
      }

      if (micStream) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
      }

      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      // Video recorder
      const videoMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const videoRecorder = new MediaRecorder(combinedStream, {
        mimeType: videoMimeType,
        videoBitsPerSecond: 1_000_000,
      });

      videoRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          const idx = videoIndexRef.current;
          videoIndexRef.current += 1;
          setVideoChunkIndex(videoIndexRef.current);
          onVideoChunkRef.current?.(e.data, idx);
        }
      };

      videoRecorderRef.current = videoRecorder;

      // Audio-only recorder
      const audioOnlyStream = destination.stream;
      const audioMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const audioRecorder = new MediaRecorder(audioOnlyStream, {
        mimeType: audioMimeType,
        audioBitsPerSecond: 64_000,
      });

      audioRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          const idx = audioIndexRef.current;
          audioIndexRef.current += 1;
          setAudioChunkIndex(audioIndexRef.current);
          onAudioChunkRef.current?.(e.data, idx);
        }
      };

      audioRecorderRef.current = audioRecorder;

      // Handle user stopping screen share via browser UI
      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        if (videoRecorderRef.current?.state !== 'inactive') {
          stopInternalRef.current();
        }
      });

      videoRecorder.start(1000);
      audioRecorder.start(1000);
      startTimer();
      setStatus('recording');
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setError(e.message || 'Erro ao iniciar gravacao');
      setStatus('error');
      cleanup();
    }
  }, [isSupported, cleanup, startTimer]);

  const stopRecordingInternal = useCallback(() => {
    try {
      const videoRecorder = videoRecorderRef.current;
      const audioRecorder = audioRecorderRef.current;

      if (!videoRecorder || videoRecorder.state === 'inactive') return;

      pauseTimer();

      const finalDuration = durationRef.current;

      let videoStopped = false;
      let audioStopped = false;

      const checkDone = () => {
        if (videoStopped && audioStopped) {
          try {
            if (displayStreamRef.current) {
              displayStreamRef.current.getTracks().forEach(t => t.stop());
              displayStreamRef.current = null;
            }
          } catch (trackErr) {
            console.error('[Recording] Erro ao parar tracks:', trackErr);
          }

          setStatus('stopped');

          if (resolveStopRef.current) {
            resolveStopRef.current(finalDuration);
            resolveStopRef.current = null;
          } else if (onAutoStopRef.current) {
            onAutoStopRef.current(finalDuration);
          }
        }
      };

      videoRecorder.onstop = () => {
        videoStopped = true;
        checkDone();
      };

      if (audioRecorder && audioRecorder.state !== 'inactive') {
        audioRecorder.onstop = () => {
          audioStopped = true;
          checkDone();
        };
        try {
          audioRecorder.stop();
        } catch (audioErr) {
          console.error('[Recording] Erro ao parar gravador de audio:', audioErr);
          audioStopped = true;
          checkDone();
        }
      } else {
        audioStopped = true;
      }

      try {
        videoRecorder.stop();
      } catch (videoErr) {
        console.error('[Recording] Erro ao parar gravador de video:', videoErr);
        videoStopped = true;
        checkDone();
      }
    } catch (err) {
      console.error('[Recording] Erro ao parar gravacao:', err);
      setError('Erro ao parar gravacao');
      setStatus('error');
      cleanup();
    }
  }, [pauseTimer, cleanup]);

  stopInternalRef.current = stopRecordingInternal;

  const stopRecording = useCallback((): Promise<number> => {
    return new Promise((resolve, reject) => {
      if (!videoRecorderRef.current || videoRecorderRef.current.state === 'inactive') {
        reject(new Error('Nenhuma gravacao em andamento'));
        return;
      }
      resolveStopRef.current = resolve;
      stopRecordingInternal();
    });
  }, [stopRecordingInternal]);

  const pauseRecording = useCallback(() => {
    try {
      if (videoRecorderRef.current?.state === 'recording') {
        videoRecorderRef.current.pause();
        audioRecorderRef.current?.pause();
        pauseTimer();
        setStatus('paused');
      }
    } catch (err) {
      console.error('[Recording] Erro ao pausar gravacao:', err);
      // Non-critical: log but don't crash the recording flow
    }
  }, [pauseTimer]);

  const resumeRecording = useCallback(() => {
    try {
      if (videoRecorderRef.current?.state === 'paused') {
        videoRecorderRef.current.resume();
        audioRecorderRef.current?.resume();
        resumeTimer();
        setStatus('recording');
      }
    } catch (err) {
      console.error('[Recording] Erro ao retomar gravacao:', err);
      // Non-critical: log but don't crash the recording flow
    }
  }, [resumeTimer]);

  const cancelRecording = useCallback(() => {
    try {
      pauseTimer();
      cleanup();
    } catch (err) {
      console.error('[Recording] Erro durante cleanup ao cancelar:', err);
    }
    // Always reset state, even if cleanup failed
    setStatus('idle');
    setDurationSeconds(0);
    durationRef.current = 0;
    videoIndexRef.current = 0;
    audioIndexRef.current = 0;
    setVideoChunkIndex(0);
    setAudioChunkIndex(0);
    setError(null);
    resolveStopRef.current = null;
  }, [cleanup, pauseTimer]);

  return {
    status,
    durationSeconds,
    error,
    isSupported,
    videoChunkIndex,
    audioChunkIndex,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  };
}
