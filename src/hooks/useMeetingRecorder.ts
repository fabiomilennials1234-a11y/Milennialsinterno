import { useState, useRef, useCallback, useEffect } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

interface RecorderResult {
  videoBlob: Blob;
  audioBlob: Blob;
  durationSeconds: number;
}

interface UseMeetingRecorderReturn {
  status: RecorderStatus;
  durationSeconds: number;
  error: string | null;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecorderResult>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
}

/**
 * Hook for screen + audio recording via getDisplayMedia.
 * Creates two MediaRecorders: one for video+audio (.webm), one for audio-only (.webm opus).
 * Timer increments each second during recording.
 */
export function useMeetingRecorder(): UseMeetingRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveStopRef = useRef<((result: RecorderResult) => void) | null>(null);
  const durationRef = useRef(0);
  const stopInternalRef = useRef<() => void>(() => {});

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
    videoRecorderRef.current = null;
    audioRecorderRef.current = null;
    videoChunksRef.current = [];
    audioChunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
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
      videoChunksRef.current = [];
      audioChunksRef.current = [];

      // Request screen capture with system audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true, // System audio (if browser supports)
      });

      displayStreamRef.current = displayStream;

      // Try to get microphone audio
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // Microphone not available — continue without it
      }

      // Combine all audio tracks for the video recording
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Add display audio tracks (system audio)
      const displayAudioTracks = displayStream.getAudioTracks();
      if (displayAudioTracks.length > 0) {
        const displaySource = audioContext.createMediaStreamSource(
          new MediaStream(displayAudioTracks)
        );
        displaySource.connect(destination);
      }

      // Add microphone
      if (micStream) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
      }

      // Combined stream: display video + mixed audio
      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      // Video recorder (video + audio)
      const videoMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const videoRecorder = new MediaRecorder(combinedStream, {
        mimeType: videoMimeType,
        videoBitsPerSecond: 2_500_000,
      });

      videoRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      videoRecorderRef.current = videoRecorder;

      // Audio-only recorder (for future transcription)
      const audioOnlyStream = destination.stream;
      const audioMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const audioRecorder = new MediaRecorder(audioOnlyStream, {
        mimeType: audioMimeType,
        audioBitsPerSecond: 128_000,
      });

      audioRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      audioRecorderRef.current = audioRecorder;

      // Handle user stopping screen share via browser UI
      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        if (videoRecorderRef.current?.state !== 'inactive') {
          // User clicked "Stop sharing" in browser — auto-stop recording
          stopInternalRef.current();
        }
      });

      // Start both recorders
      videoRecorder.start(1000); // 1s timeslice
      audioRecorder.start(1000);
      startTimer();
      setStatus('recording');
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      // User cancelled the screen picker
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
    const videoRecorder = videoRecorderRef.current;
    const audioRecorder = audioRecorderRef.current;

    if (!videoRecorder || videoRecorder.state === 'inactive') return;

    pauseTimer();

    const finalDuration = durationRef.current;

    // Create promise that resolves when both recorders stop
    let videoStopped = false;
    let audioStopped = false;

    const checkDone = () => {
      if (videoStopped && audioStopped) {
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Stop all tracks
        if (displayStreamRef.current) {
          displayStreamRef.current.getTracks().forEach(t => t.stop());
          displayStreamRef.current = null;
        }

        setStatus('stopped');

        if (resolveStopRef.current) {
          resolveStopRef.current({
            videoBlob,
            audioBlob,
            durationSeconds: finalDuration,
          });
          resolveStopRef.current = null;
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
      audioRecorder.stop();
    } else {
      audioStopped = true;
    }

    videoRecorder.stop();
  }, [pauseTimer]);

  // Keep ref in sync so event listener can call latest version
  stopInternalRef.current = stopRecordingInternal;

  const stopRecording = useCallback((): Promise<RecorderResult> => {
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
    if (videoRecorderRef.current?.state === 'recording') {
      videoRecorderRef.current.pause();
      audioRecorderRef.current?.pause();
      pauseTimer();
      setStatus('paused');
    }
  }, [pauseTimer]);

  const resumeRecording = useCallback(() => {
    if (videoRecorderRef.current?.state === 'paused') {
      videoRecorderRef.current.resume();
      audioRecorderRef.current?.resume();
      resumeTimer();
      setStatus('recording');
    }
  }, [resumeTimer]);

  const cancelRecording = useCallback(() => {
    pauseTimer();
    cleanup();
    setStatus('idle');
    setDurationSeconds(0);
    durationRef.current = 0;
    setError(null);
    resolveStopRef.current = null;
  }, [cleanup, pauseTimer]);

  return {
    status,
    durationSeconds,
    error,
    isSupported,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  };
}
