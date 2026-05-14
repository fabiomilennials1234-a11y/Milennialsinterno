import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeetingRecorder } from '../useMeetingRecorder';

// ── Mock Track ──

function createMockTrack(kind: 'video' | 'audio'): MediaStreamTrack {
  return {
    kind,
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    enabled: true,
    id: `${kind}-${Math.random()}`,
  } as unknown as MediaStreamTrack;
}

// ── Mock MediaStream ──

class MockMediaStream {
  private _tracks: MediaStreamTrack[];

  constructor(tracks?: MediaStreamTrack[]) {
    this._tracks = tracks ?? [];
  }

  getTracks() {
    return [...this._tracks];
  }

  getVideoTracks() {
    return this._tracks.filter((t) => t.kind === 'video');
  }

  getAudioTracks() {
    return this._tracks.filter((t) => t.kind === 'audio');
  }

  addTrack(track: MediaStreamTrack) {
    this._tracks.push(track);
  }
}

// ── Mock MediaRecorder ──

class MockMediaRecorder {
  state: string = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(
    public stream: unknown,
    public options?: MediaRecorderOptions,
  ) {}

  start(_timeslice?: number) {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    setTimeout(() => this.onstop?.(), 0);
  }

  pause() {
    if (this.state !== 'recording') throw new DOMException('InvalidStateError');
    this.state = 'paused';
  }

  resume() {
    if (this.state !== 'paused') throw new DOMException('InvalidStateError');
    this.state = 'recording';
  }

  addEventListener(_type: string, _listener: () => void) {
    // noop — health monitoring events not tested here
  }

  removeEventListener(_type: string, _listener: () => void) {
    // noop
  }

  static isTypeSupported(_mimeType: string): boolean {
    return true;
  }
}

// ── Mock AudioContext ──

class MockAudioContext {
  createMediaStreamDestination() {
    return {
      stream: new MockMediaStream([createMockTrack('audio')]),
    };
  }

  createMediaStreamSource(_stream: unknown) {
    return {
      connect: vi.fn(),
    };
  }

  close() {
    return Promise.resolve();
  }
}

// ── Setup ──

function createDisplayStream(hasAudio = true): MockMediaStream {
  const tracks: MediaStreamTrack[] = [createMockTrack('video')];
  if (hasAudio) tracks.push(createMockTrack('audio'));
  return new MockMediaStream(tracks);
}

beforeEach(() => {
  vi.useFakeTimers();

  // @ts-expect-error -- global mock
  globalThis.MediaRecorder = MockMediaRecorder;
  // @ts-expect-error -- global mock
  globalThis.AudioContext = MockAudioContext;
  // @ts-expect-error -- global mock
  globalThis.MediaStream = MockMediaStream;

  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getDisplayMedia: vi.fn().mockResolvedValue(createDisplayStream()),
      getUserMedia: vi.fn().mockResolvedValue(createDisplayStream(false)),
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useMeetingRecorder', () => {
  it('starts in idle state with isSupported true', () => {
    const { result } = renderHook(() => useMeetingRecorder());

    expect(result.current.status).toBe('idle');
    expect(result.current.isSupported).toBe(true);
    expect(result.current.durationSeconds).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('startRecording transitions to recording', async () => {
    const { result } = renderHook(() => useMeetingRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('recording');
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled();
  });

  it('startRecording with NotAllowedError stays idle (no error)', async () => {
    const error = new DOMException('Permission denied', 'NotAllowedError');
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useMeetingRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('startRecording with AbortError stays idle (no error)', async () => {
    const error = new DOMException('Aborted', 'AbortError');
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useMeetingRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('startRecording with generic error transitions to error', async () => {
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(
      new Error('Hardware failure'),
    );

    const { result } = renderHook(() => useMeetingRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Hardware failure');
  });

  it('pauseRecording transitions to paused', async () => {
    const { result } = renderHook(() => useMeetingRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.status).toBe('paused');
  });

  it('resumeRecording transitions back to recording', async () => {
    const { result } = renderHook(() => useMeetingRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.pauseRecording();
    });

    act(() => {
      result.current.resumeRecording();
    });

    expect(result.current.status).toBe('recording');
  });

  it('pauseRecording is safe when not recording', () => {
    const { result } = renderHook(() => useMeetingRecorder());

    // Should not throw
    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.status).toBe('idle');
  });

  it('resumeRecording is safe when not paused', async () => {
    const { result } = renderHook(() => useMeetingRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    // Should not throw — state guard inside prevents action
    act(() => {
      result.current.resumeRecording();
    });

    expect(result.current.status).toBe('recording');
  });

  it('cancelRecording resets to idle', async () => {
    const { result } = renderHook(() => useMeetingRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.cancelRecording();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.durationSeconds).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('stopRecording returns duration and transitions to stopped', async () => {
    const { result } = renderHook(() => useMeetingRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    // Advance timer to simulate some duration
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.durationSeconds).toBe(3);

    let duration: number | undefined;
    await act(async () => {
      const stopPromise = result.current.stopRecording();
      // Allow the setTimeout(onstop, 0) to fire
      vi.advanceTimersByTime(10);
      duration = await stopPromise;
    });

    expect(duration).toBe(3);
    expect(result.current.status).toBe('stopped');
  });

  it('stopRecording rejects when not recording', async () => {
    const { result } = renderHook(() => useMeetingRecorder());

    await expect(result.current.stopRecording()).rejects.toThrow(
      'Nenhuma gravacao em andamento',
    );
  });

  it('timer increments durationSeconds', async () => {
    const { result } = renderHook(() => useMeetingRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.durationSeconds).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.durationSeconds).toBe(5);
  });

  it('chunk callbacks are passed without crash', async () => {
    const onVideoChunk = vi.fn();
    const onAudioChunk = vi.fn();

    const { result } = renderHook(() =>
      useMeetingRecorder({ onVideoChunk, onAudioChunk }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('recording');
  });
});
