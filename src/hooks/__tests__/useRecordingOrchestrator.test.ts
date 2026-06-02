import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RecordingSession } from '../useRecordingSession';

// ── Mocks must be declared BEFORE imports ──

const mockSession: RecordingSession = {
  id: 'sess-123',
  title: 'Test Meeting',
  folder_id: 'folder-1',
  client_id: null,
  status: 'recording',
  chunk_count: 0,
  total_bytes: 0,
  duration_seconds: null,
  storage_prefix: 'user-1/sessions/sess-123/',
  meeting_id: null,
  error_message: null,
  started_at: new Date().toISOString(),
  stopped_at: null,
  created_by: 'user-1',
};

const mockStartRecording = vi.fn().mockResolvedValue(undefined);
const mockStopRecording = vi.fn().mockResolvedValue(10);
const mockPauseRecording = vi.fn();
const mockResumeRecording = vi.fn();
const mockCancelRecording = vi.fn();

vi.mock('../useMeetingRecorder', () => ({
  useMeetingRecorder: () => ({
    status: 'idle' as const,
    durationSeconds: 0,
    error: null,
    isSupported: true,
    videoChunkIndex: 0,
    audioChunkIndex: 0,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    pauseRecording: mockPauseRecording,
    resumeRecording: mockResumeRecording,
    cancelRecording: mockCancelRecording,
  }),
}));

const mockCreateSession = vi.fn().mockResolvedValue(mockSession);
const mockUpdateChunkProgress = vi.fn().mockResolvedValue(undefined);
const mockStopSession = vi.fn().mockResolvedValue(undefined);
const mockMarkFailed = vi.fn().mockResolvedValue(undefined);
const mockAbandonSession = vi.fn().mockResolvedValue(undefined);

vi.mock('../useRecordingSession', () => ({
  useRecordingSession: () => ({
    createSession: mockCreateSession,
    updateChunkProgress: mockUpdateChunkProgress,
    stopSession: mockStopSession,
    markAssembling: vi.fn().mockResolvedValue(undefined),
    markDone: vi.fn().mockResolvedValue(undefined),
    markFailed: mockMarkFailed,
    abandonSession: mockAbandonSession,
    getIncompleteSessions: vi.fn().mockResolvedValue([]),
  }),
}));

const mockEnqueueChunk = vi.fn();
const mockDrainQueue = vi.fn().mockResolvedValue(undefined);

vi.mock('../useChunkUploader', () => ({
  useChunkUploader: () => ({
    enqueueChunk: mockEnqueueChunk,
    drainQueue: mockDrainQueue,
    uploadPendingFromIDB: vi.fn().mockResolvedValue(undefined),
    pendingCount: 0,
    error: null,
    consecutiveFailures: 0,
    pauseUploads: vi.fn(),
    resumeUploads: vi.fn(),
    resetFailures: vi.fn(),
  }),
}));

const mockAssemble = vi.fn().mockResolvedValue('meeting-456');

vi.mock('../useRecordingAssembly', () => ({
  useRecordingAssembly: () => ({
    assemble: mockAssemble,
    stage: 'idle' as const,
    error: null,
  }),
}));

vi.mock('../useRecordingRecovery', () => ({
  useRecordingRecovery: () => ({
    recoverableSessions: [],
    isChecking: false,
    abandonSession: vi.fn().mockResolvedValue(undefined),
    dismissSession: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOffline: false,
  }),
}));

vi.mock('../useRecordingLimits', () => ({
  useRecordingLimits: () => ({
    isApproachingLimit: false,
    remainingSeconds: 7200,
    shouldAutoStop: false,
  }),
}));

vi.mock('../useRecordedMeetings', () => ({
  useRecordedMeetings: () => ({
    folders: [],
  }),
}));

vi.mock('../useAllActiveClients', () => ({
  useAllActiveClients: () => ({
    data: [],
    isLoading: false,
  }),
}));

const mockClearSession = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/recordingIDB', () => ({
  clearSession: (...args: unknown[]) => mockClearSession(...args),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

// ── Import the hook AFTER mocks ──
import { useRecordingOrchestrator } from '../useRecordingOrchestrator';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRecordingOrchestrator', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    expect(result.current.overlayState).toBe('idle');
    expect(result.current.pipelineError).toBeNull();
    expect(result.current.showSetup).toBe(false);
  });

  it('openSetup opens modal', () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    act(() => {
      result.current.openSetup();
    });

    expect(result.current.showSetup).toBe(true);
  });

  it('closeSetup closes modal', () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    act(() => {
      result.current.openSetup();
    });

    act(() => {
      result.current.closeSetup();
    });

    expect(result.current.showSetup).toBe(false);
  });

  it('startRecording validates title', async () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockToastError).toHaveBeenCalledWith('Titulo e obrigatorio');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('startRecording validates folderId', async () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    act(() => {
      result.current.setTitle('Test Meeting');
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockToastError).toHaveBeenCalledWith('Selecione uma pasta');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('startRecording happy path: creates session + starts recorder', async () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    act(() => {
      result.current.setTitle('Test Meeting');
      result.current.setFolderId('folder-1');
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockCreateSession).toHaveBeenCalledWith({
      title: 'Test Meeting',
      folderId: 'folder-1',
      clientId: null,
    });
    expect(mockStartRecording).toHaveBeenCalled();
    expect(result.current.activeSession).toEqual(mockSession);
    expect(result.current.showSetup).toBe(false);
  });

  it('startRecording error: recorder fails post-session → abandons session', async () => {
    mockStartRecording.mockRejectedValueOnce(new Error('Camera denied'));

    const { result } = renderHook(() => useRecordingOrchestrator());

    act(() => {
      result.current.setTitle('Test Meeting');
      result.current.setFolderId('folder-1');
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockToastError).toHaveBeenCalledWith('Camera denied');
    expect(mockAbandonSession).toHaveBeenCalledWith('sess-123');
    expect(mockClearSession).toHaveBeenCalledWith('sess-123');
    expect(result.current.activeSession).toBeNull();
  });

  it('startRecording error: session creation fails → no orphan', async () => {
    mockCreateSession.mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHook(() => useRecordingOrchestrator());

    act(() => {
      result.current.setTitle('Test Meeting');
      result.current.setFolderId('folder-1');
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockToastError).toHaveBeenCalledWith('DB error');
    expect(mockAbandonSession).not.toHaveBeenCalled();
    expect(mockStartRecording).not.toHaveBeenCalled();
  });

  it('cancelRecording happy path: cancels + abandons + resets', async () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    // Start recording first
    act(() => {
      result.current.setTitle('Test Meeting');
      result.current.setFolderId('folder-1');
    });

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.cancelRecording();
    });

    expect(mockCancelRecording).toHaveBeenCalled();
    expect(mockAbandonSession).toHaveBeenCalledWith('sess-123');
    expect(mockClearSession).toHaveBeenCalledWith('sess-123');
    expect(result.current.overlayState).toBe('idle');
    expect(result.current.pipelineError).toBeNull();
  });

  it('cancelRecording with abandon error: still resets state', async () => {
    mockAbandonSession.mockRejectedValueOnce(new Error('DB down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useRecordingOrchestrator());

    act(() => {
      result.current.setTitle('Test Meeting');
      result.current.setFolderId('folder-1');
    });

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.cancelRecording();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Recording] Erro ao abandonar sessao:',
      expect.any(Error),
    );
    // State should STILL be reset despite error
    expect(result.current.overlayState).toBe('idle');

    consoleSpy.mockRestore();
  });

  it('dismiss resets all state', () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.overlayState).toBe('idle');
    expect(result.current.pipelineError).toBeNull();
    expect(result.current.title).toBe('');
    expect(result.current.folderId).toBe('');
    expect(result.current.clientId).toBeNull();
  });

  it('form state setters work correctly', () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    act(() => {
      result.current.setTitle('New Title');
      result.current.setFolderId('folder-2');
      result.current.setClientId('client-1');
    });

    expect(result.current.title).toBe('New Title');
    expect(result.current.folderId).toBe('folder-2');
    expect(result.current.clientId).toBe('client-1');
  });

  it('exposes recovery data', () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    expect(result.current.recoverableSessions).toEqual([]);
    expect(typeof result.current.abandonRecovery).toBe('function');
    expect(typeof result.current.dismissRecovery).toBe('function');
  });

  it('exposes network and limits state', () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    expect(result.current.isOffline).toBe(false);
    expect(result.current.isApproachingLimit).toBe(false);
    expect(result.current.remainingSeconds).toBe(7200);
  });

  // ── Live-session retry (issue #71) ──
  // A failed assembly/upload of the live session used to be terminal+silent.
  // The overlay now surfaces it and offers retry, which re-runs the pipeline
  // against the SAME live session (distinct from #72's persisted-record retry).

  async function driveToError(result: { current: ReturnType<typeof useRecordingOrchestrator> }) {
    act(() => {
      result.current.setTitle('Test Meeting');
      result.current.setFolderId('folder-1');
    });
    await act(async () => {
      await result.current.startRecording();
    });
    mockAssemble.mockRejectedValueOnce(new Error('upload failed: 500'));
    await act(async () => {
      await result.current.stopRecording();
    });
  }

  it('enters error state and offers retry after a failed assembly of the live session', async () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    await driveToError(result);

    expect(result.current.overlayState).toBe('error');
    expect(result.current.pipelineError).toBe('upload failed: 500');
    expect(result.current.canRetry).toBe(true);
    // The live session is preserved so retry has something to re-run.
    expect(result.current.activeSession).toEqual(mockSession);
    expect(mockMarkFailed).toHaveBeenCalledWith('sess-123', 'upload failed: 500');
  });

  it('retryPipeline re-runs assembly and reaches done on success', async () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    await driveToError(result);
    expect(result.current.overlayState).toBe('error');

    mockAssemble.mockResolvedValueOnce('meeting-789');
    await act(async () => {
      await result.current.retryPipeline();
    });

    expect(mockAssemble).toHaveBeenCalledTimes(2);
    expect(result.current.overlayState).toBe('done');
    expect(result.current.pipelineError).toBeNull();
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('retryPipeline re-marks the session failed when the retry also fails', async () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    await driveToError(result);
    mockMarkFailed.mockClear();

    mockAssemble.mockRejectedValueOnce(new Error('still offline'));
    await act(async () => {
      await result.current.retryPipeline();
    });

    expect(result.current.overlayState).toBe('error');
    expect(result.current.pipelineError).toBe('still offline');
    expect(mockMarkFailed).toHaveBeenCalledWith('sess-123', 'still offline');
  });

  it('retryPipeline is a no-op when not in error state', async () => {
    const { result } = renderHook(() => useRecordingOrchestrator());

    await act(async () => {
      await result.current.retryPipeline();
    });

    expect(mockAssemble).not.toHaveBeenCalled();
    expect(result.current.overlayState).toBe('idle');
  });

  it('canRetry is false when idle', () => {
    const { result } = renderHook(() => useRecordingOrchestrator());
    expect(result.current.canRetry).toBe(false);
  });
});
