import { createPortal } from 'react-dom';
import { useRecordingOrchestrator } from '@/hooks/useRecordingOrchestrator';
import RecordingRecoveryBanner from './RecordingRecoveryBanner';
import { RecordingFAB } from './RecordingFAB';
import { RecordingSetupModal } from './RecordingSetupModal';
import { RecordingTopStrip } from './RecordingTopStrip';
import { RecordingControlBar } from './RecordingControlBar';
import { RecordingStatusToast } from './RecordingStatusToast';

export default function MeetingRecorderRoot() {
  const {
    folders,
    clients,
    clientsLoading,
    overlayState,
    pipelineError,
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
    dismiss,
  } = useRecordingOrchestrator();

  const showFab = overlayState === 'idle' && !showSetup;
  const showRecordingBar = overlayState === 'recording' || overlayState === 'paused';
  const showProcessing = overlayState === 'processing';
  const showDone = overlayState === 'done';
  const showError = overlayState === 'error';

  return createPortal(
    <>
      <RecordingRecoveryBanner
        sessions={recoverableSessions}
        onAbandon={abandonRecovery}
        onDismiss={dismissRecovery}
      />

      {(showRecordingBar || showProcessing) && (
        <RecordingTopStrip
          overlayState={overlayState}
          isProcessing={showProcessing}
          isOffline={isOffline}
          isApproachingLimit={isApproachingLimit}
          remainingSeconds={remainingSeconds}
          durationSeconds={durationSeconds}
        />
      )}

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

      {showRecordingBar && (
        <RecordingControlBar
          overlayState={overlayState}
          durationSeconds={durationSeconds}
          title={title}
          pendingChunkCount={pendingChunkCount}
          isOffline={isOffline}
          isApproachingLimit={isApproachingLimit}
          remainingSeconds={remainingSeconds}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
          onCancel={cancelRecording}
        />
      )}

      {showProcessing && (
        <RecordingStatusToast
          variant="processing"
          assemblyStage={assemblyStage}
          errorMessage={null}
          onDismiss={dismiss}
        />
      )}

      {showDone && (
        <RecordingStatusToast
          variant="done"
          assemblyStage={assemblyStage}
          errorMessage={null}
          onDismiss={dismiss}
        />
      )}

      {showError && (
        <RecordingStatusToast
          variant="error"
          assemblyStage={assemblyStage}
          errorMessage={pipelineError || assemblyError || recorderError}
          onDismiss={dismiss}
        />
      )}
    </>,
    document.body,
  );
}
