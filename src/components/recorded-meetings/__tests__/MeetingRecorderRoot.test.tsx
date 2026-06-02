import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseRecordingOrchestratorReturn } from '@/hooks/useRecordingOrchestrator';
import type { UseDocumentPiPReturn } from '@/hooks/useDocumentPiP';

// ── Mocks must be declared BEFORE the import under test ──

const baseHealth = {
  overall: 'ok' as const,
  checks: {
    recorder: { status: 'ok' as const, message: '' },
    auth: { status: 'ok' as const, message: '' },
    upload: { status: 'ok' as const, message: '' },
    storage: { status: 'ok' as const, message: '' },
  },
};

function makeOrchestrator(
  overrides: Partial<UseRecordingOrchestratorReturn> = {},
): UseRecordingOrchestratorReturn {
  return {
    folders: [],
    clients: [],
    clientsLoading: false,
    overlayState: 'recording',
    activeSession: null,
    pipelineError: null,
    canRetry: false,
    title: 'Reunião X',
    setTitle: vi.fn(),
    folderId: 'f1',
    setFolderId: vi.fn(),
    clientId: null,
    setClientId: vi.fn(),
    showSetup: false,
    isOffline: false,
    isApproachingLimit: false,
    remainingSeconds: 7200,
    durationSeconds: 42,
    pendingChunkCount: 0,
    assemblyStage: 'idle',
    assemblyError: null,
    recorderError: null,
    health: baseHealth,
    recoverableSessions: [],
    abandonRecovery: vi.fn().mockResolvedValue(undefined),
    dismissRecovery: vi.fn(),
    openSetup: vi.fn(),
    closeSetup: vi.fn(),
    startRecording: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn().mockResolvedValue(undefined),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
    cancelRecording: vi.fn().mockResolvedValue(undefined),
    retryPipeline: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn(),
    ...overrides,
  };
}

let orchestratorReturn: UseRecordingOrchestratorReturn;
vi.mock('@/hooks/useRecordingOrchestrator', () => ({
  useRecordingOrchestrator: () => orchestratorReturn,
}));

function makePiP(overrides: Partial<UseDocumentPiPReturn> = {}): UseDocumentPiPReturn {
  return {
    isSupported: false,
    isOpen: false,
    container: null,
    open: vi.fn().mockResolvedValue(true),
    close: vi.fn(),
    ...overrides,
  };
}

let pipReturn: UseDocumentPiPReturn;
vi.mock('@/hooks/useDocumentPiP', () => ({
  useDocumentPiP: () => pipReturn,
}));

// The recovery banner reaches into auth/session APIs that are irrelevant to the
// overlay surface under test — stub it so we don't need a full provider tree.
vi.mock('../RecordingRecoveryBanner', () => ({
  default: () => null,
}));

import MeetingRecorderRoot from '../MeetingRecorderRoot';

beforeEach(() => {
  orchestratorReturn = makeOrchestrator();
  pipReturn = makePiP();
});

afterEach(() => {
  vi.clearAllMocks();
});

function getOverlay(): HTMLElement | null {
  return document.body.querySelector('.rpip-root');
}

describe('MeetingRecorderRoot — PiP overlay integration', () => {
  it('renders the overlay inline when Document PiP is unsupported (Safari/Firefox)', () => {
    pipReturn = makePiP({ isSupported: false });

    render(<MeetingRecorderRoot />);

    const overlay = getOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('data-variant')).toBe('inline');
    // Recording does not break: the live state is still rendered.
    expect(overlay?.getAttribute('data-state')).toBe('recording');
  });

  it('never opens a PiP window when unsupported', () => {
    const open = vi.fn().mockResolvedValue(true);
    pipReturn = makePiP({ isSupported: false, open });

    render(<MeetingRecorderRoot />);

    expect(open).not.toHaveBeenCalled();
  });

  it('mounts the overlay into the PiP window document when supported and open', () => {
    const pipDoc = document.implementation.createHTMLDocument('pip');
    const container = pipDoc.createElement('div');
    pipDoc.body.appendChild(container);
    pipReturn = makePiP({ isSupported: true, isOpen: true, container });

    render(<MeetingRecorderRoot />);

    // Overlay rendered into the PiP document, not the host page.
    const overlay = container.querySelector('.rpip-root');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('data-variant')).toBe('pip');
    expect(getOverlay()).toBeNull();
  });

  it('opens the PiP window once recording is live and the API is supported', () => {
    const open = vi.fn().mockResolvedValue(true);
    pipReturn = makePiP({ isSupported: true, isOpen: false, container: null, open });

    render(<MeetingRecorderRoot />);

    expect(open).toHaveBeenCalled();
  });

  it('surfaces a pipeline error in the overlay with a decoded title and a retry action', async () => {
    orchestratorReturn = makeOrchestrator({
      overlayState: 'error',
      pipelineError: 'upload failed: token expired (401)',
      canRetry: true,
    });
    const retryPipeline = orchestratorReturn.retryPipeline as ReturnType<typeof vi.fn>;

    render(<MeetingRecorderRoot />);

    const overlay = getOverlay()!;
    expect(overlay.getAttribute('data-state')).toBe('error');
    // Decoded copy, not the raw console message.
    expect(within(overlay).getByText('Sessão expirou')).toBeInTheDocument();

    const retryButton = within(overlay).getByRole('button', { name: /tentar de novo/i });
    await userEvent.click(retryButton);
    expect(retryPipeline).toHaveBeenCalled();
  });

  it('hides the retry action when the error is not retryable', () => {
    orchestratorReturn = makeOrchestrator({
      overlayState: 'error',
      pipelineError: 'fatal',
      canRetry: false,
    });

    render(<MeetingRecorderRoot />);

    const overlay = getOverlay()!;
    expect(within(overlay).queryByRole('button', { name: /tentar de novo/i })).toBeNull();
  });

  it('re-opens as a PiP window when the in-page pop-out action is used', async () => {
    const open = vi.fn().mockResolvedValue(true);
    pipReturn = makePiP({ isSupported: true, isOpen: false, container: null, open });

    render(<MeetingRecorderRoot />);
    open.mockClear(); // ignore the auto-open effect; assert the explicit pop-out

    const overlay = getOverlay()!;
    const popOut = within(overlay).getByRole('button', { name: /janela flutuante/i });
    await userEvent.click(popOut);

    expect(open).toHaveBeenCalled();
  });

  it('propagates pause/stop from inside the overlay to the orchestrator', async () => {
    const pauseRecording = vi.fn();
    const stopRecording = vi.fn().mockResolvedValue(undefined);
    orchestratorReturn = makeOrchestrator({
      overlayState: 'recording',
      pauseRecording,
      stopRecording,
    });

    render(<MeetingRecorderRoot />);
    const overlay = getOverlay()!;

    await userEvent.click(within(overlay).getByRole('button', { name: /pausar/i }));
    expect(pauseRecording).toHaveBeenCalled();

    await userEvent.click(within(overlay).getByRole('button', { name: /finalizar/i }));
    expect(stopRecording).toHaveBeenCalled();
  });

  it('propagates resume from the paused overlay to the orchestrator', async () => {
    const resumeRecording = vi.fn();
    orchestratorReturn = makeOrchestrator({ overlayState: 'paused', resumeRecording });

    render(<MeetingRecorderRoot />);
    const overlay = getOverlay()!;
    expect(overlay.getAttribute('data-state')).toBe('paused');

    await userEvent.click(within(overlay).getByRole('button', { name: /retomar/i }));
    expect(resumeRecording).toHaveBeenCalled();
  });

  it('renders processing and done terminal states through the same overlay surface', () => {
    orchestratorReturn = makeOrchestrator({ overlayState: 'processing', assemblyStage: 'uploading-video' });
    const { rerender } = render(<MeetingRecorderRoot />);
    expect(getOverlay()?.getAttribute('data-state')).toBe('processing');

    orchestratorReturn = makeOrchestrator({ overlayState: 'done' });
    rerender(<MeetingRecorderRoot />);
    expect(getOverlay()?.getAttribute('data-state')).toBe('done');
  });

  it('does not offer the pop-out action while already mounted in the PiP window', () => {
    const pipDoc = document.implementation.createHTMLDocument('pip');
    const container = pipDoc.createElement('div');
    pipDoc.body.appendChild(container);
    pipReturn = makePiP({ isSupported: true, isOpen: true, container });

    render(<MeetingRecorderRoot />);

    // The PiP doc is detached from a window, so query the DOM directly rather
    // than via the role API (which needs a defaultView for the a11y tree).
    const overlay = container.querySelector('.rpip-root')!;
    expect(overlay.querySelector('[aria-label="Abrir janela flutuante"]')).toBeNull();
  });

  it('renders a SINGLE recording surface in the inline fallback (no legacy top strip)', () => {
    // B1: Safari/Firefox path. The legacy RecordingTopStrip used to mount
    // in-page ALONGSIDE the overlay → two "GRAVANDO" + two timers. The overlay
    // is now the sole surface.
    pipReturn = makePiP({ isSupported: false });
    orchestratorReturn = makeOrchestrator({ overlayState: 'recording', durationSeconds: 42 });

    render(<MeetingRecorderRoot />);

    // Exactly one live-state word and one timer across the whole document body.
    const stateWords = document.body.querySelectorAll('.rpip-state-word');
    expect(stateWords).toHaveLength(1);
    const timers = document.body.querySelectorAll('[role="timer"]');
    expect(timers).toHaveLength(1);

    // No legacy top-strip Tailwind surface bleeding raw bg-red-600 into the page.
    expect(document.body.querySelector('.bg-red-600')).toBeNull();
    expect(document.body.querySelector('.bg-blue-600')).toBeNull();
  });

  it('does not double the recording surface in the processing state either', () => {
    pipReturn = makePiP({ isSupported: false });
    orchestratorReturn = makeOrchestrator({ overlayState: 'processing', assemblyStage: 'uploading-video' });

    render(<MeetingRecorderRoot />);

    expect(document.body.querySelectorAll('.rpip-state-word')).toHaveLength(1);
    expect(document.body.querySelector('.bg-blue-600')).toBeNull();
  });

  it('paints the PiP document background dark so no white halo flashes around the window', () => {
    // B2: the PiP doc has its own html/body that inherit nothing. They must be
    // explicitly painted with the dark canvas, or an always-on-top white frame
    // flickers over the user's screen.
    const pipDoc = document.implementation.createHTMLDocument('pip');
    const container = pipDoc.createElement('div');
    pipDoc.body.appendChild(container);
    pipReturn = makePiP({ isSupported: true, isOpen: true, container });

    render(<MeetingRecorderRoot />);

    // jsdom normalizes hsl(240 10% 4%) → rgb(9, 9, 11): a near-black dark canvas.
    // Assert it is painted (non-empty) and not the white default.
    const DARK_CANVAS = 'rgb(9, 9, 11)';
    expect(pipDoc.body.style.background).toBe(DARK_CANVAS);
    expect(pipDoc.documentElement.style.background).toBe(DARK_CANVAS);
    expect(pipDoc.body.style.margin).toBe('0px');
  });

  it('auto-focuses the retry button when the overlay enters the error state', async () => {
    // A3: in a PiP window the user is not looking at, an error must pull focus
    // to its primary recovery action.
    orchestratorReturn = makeOrchestrator({
      overlayState: 'error',
      pipelineError: 'upload failed',
      canRetry: true,
    });

    render(<MeetingRecorderRoot />);

    const overlay = getOverlay()!;
    const retry = within(overlay).getByRole('button', { name: /tentar de novo/i });
    // Focus is applied in an effect; wait a tick.
    await vi.waitFor(() => expect(retry).toHaveFocus());
  });

  it('does not throw or steal focus when an error is non-retryable (no retry target)', () => {
    // A3 guard: retryRef is null when there is no retry button — focus is a no-op.
    orchestratorReturn = makeOrchestrator({
      overlayState: 'error',
      pipelineError: 'fatal',
      canRetry: false,
    });

    expect(() => render(<MeetingRecorderRoot />)).not.toThrow();
    const overlay = getOverlay()!;
    expect(within(overlay).queryByRole('button', { name: /tentar de novo/i })).toBeNull();
  });

  it('announces the live state to assistive tech without the timer tagariling', () => {
    // A1: state word is a polite live region; the timer is muted.
    orchestratorReturn = makeOrchestrator({ overlayState: 'recording' });
    pipReturn = makePiP({ isSupported: false });

    render(<MeetingRecorderRoot />);
    const overlay = getOverlay()!;

    const stateWord = overlay.querySelector('.rpip-state-word')!;
    expect(stateWord.getAttribute('role')).toBe('status');
    expect(stateWord.getAttribute('aria-live')).toBe('polite');

    const timer = overlay.querySelector('[role="timer"]')!;
    expect(timer.getAttribute('aria-live')).toBe('off');
  });

  it('resets to inline when the PiP window is closed by the user (pagehide → not open)', () => {
    const pipDoc = document.implementation.createHTMLDocument('pip');
    const container = pipDoc.createElement('div');
    pipDoc.body.appendChild(container);
    pipReturn = makePiP({ isSupported: true, isOpen: true, container });

    const { rerender } = render(<MeetingRecorderRoot />);
    expect(container.querySelector('.rpip-root')).not.toBeNull();

    // Simulate the hook resetting after pagehide.
    pipReturn = makePiP({ isSupported: true, isOpen: false, container: null });
    act(() => {
      rerender(<MeetingRecorderRoot />);
    });

    // Falls back in-page; recording stays live.
    const overlay = getOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('data-variant')).toBe('inline');
  });
});
