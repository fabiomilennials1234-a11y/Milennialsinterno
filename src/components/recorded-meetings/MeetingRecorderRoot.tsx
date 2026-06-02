import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRecordingOrchestrator } from '@/hooks/useRecordingOrchestrator';
import { useDocumentPiP } from '@/hooks/useDocumentPiP';
import RecordingRecoveryBanner from './RecordingRecoveryBanner';
import { RecordingFAB } from './RecordingFAB';
import { RecordingSetupModal } from './RecordingSetupModal';
import { RecordingPiPOverlay } from './RecordingPiPOverlay';

export default function MeetingRecorderRoot() {
  const {
    folders,
    clients,
    clientsLoading,
    overlayState,
    pipelineError,
    canRetry,
    title,
    setTitle,
    folderId,
    setFolderId,
    clientId,
    setClientId,
    showSetup,
    isOffline,
    isApproachingLimit,
    remainingSeconds,
    durationSeconds,
    pendingChunkCount,
    assemblyStage,
    assemblyError,
    recorderError,
    health,
    recoverableSessions,
    abandonRecovery,
    dismissRecovery,
    openSetup,
    closeSetup,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    retryPipeline,
    dismiss,
  } = useRecordingOrchestrator();

  const pip = useDocumentPiP({ width: 340, height: 220 });

  const showFab = overlayState === 'idle' && !showSetup;

  // Open the floating PiP overlay once recording is live; close it when the
  // pipeline returns to idle. The orchestrator remains the single state owner —
  // PiP is purely an additional render surface.
  const overlayActive = overlayState !== 'idle' && overlayState !== 'setup';
  useEffect(() => {
    if (!pip.isSupported) return;
    if (overlayActive && !pip.isOpen) {
      void pip.open();
    } else if (!overlayActive && pip.isOpen) {
      pip.close();
    }
  }, [overlayActive, pip]);

  const usePiPSurface = pip.isSupported && pip.isOpen && pip.container;

  // A single self-contained overlay covers every live/terminal state. It mounts
  // either into the floating PiP window (variant="pip") or in-page as the
  // graceful fallback for Safari/Firefox/denied-permission (variant="inline").
  const overlayContent = overlayActive ? (
    <RecordingPiPOverlay
      variant={usePiPSurface ? 'pip' : 'inline'}
      targetDocument={usePiPSurface ? pip.container!.ownerDocument : document}
      overlayState={overlayState}
      durationSeconds={durationSeconds}
      title={title}
      pendingChunkCount={pendingChunkCount}
      isOffline={isOffline}
      isApproachingLimit={isApproachingLimit}
      remainingSeconds={remainingSeconds}
      health={health}
      assemblyStage={assemblyStage}
      errorMessage={pipelineError || assemblyError || recorderError}
      onPause={pauseRecording}
      onResume={resumeRecording}
      onStop={stopRecording}
      onCancel={cancelRecording}
      onRetry={canRetry ? retryPipeline : undefined}
      onDismiss={dismiss}
      onPopOut={pip.isSupported && !usePiPSurface ? () => void pip.open() : undefined}
    />
  ) : null;

  return createPortal(
    <>
      <RecordingRecoveryBanner
        sessions={recoverableSessions}
        onAbandon={abandonRecovery}
        onDismiss={dismissRecovery}
      />

      {showFab && <RecordingFAB onOpen={openSetup} />}

      {showSetup && (
        <RecordingSetupModal
          title={title}
          onTitleChange={setTitle}
          folderId={folderId}
          onFolderChange={setFolderId}
          clientId={clientId}
          onClientChange={setClientId}
          folders={folders}
          clients={clients}
          clientsLoading={clientsLoading}
          onStart={startRecording}
          onClose={closeSetup}
        />
      )}

      {/* PiP supported + open → render controls in the floating window.
          Otherwise (Safari/Firefox/permission denied) render in-page. */}
      {usePiPSurface ? createPortal(overlayContent, pip.container!) : overlayContent}
    </>,
    document.body,
  );
}
