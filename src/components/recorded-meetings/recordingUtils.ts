/** Presentation helpers for the recording UI. */

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export function getAssemblyLabel(stage: string): string {
  switch (stage) {
    case 'fetching': return 'Baixando chunks...';
    case 'assembling': return 'Montando gravacao...';
    case 'uploading-video': return 'Enviando video...';
    case 'uploading-audio': return 'Enviando audio...';
    case 'finalizing': return 'Finalizando...';
    default: return 'Processando...';
  }
}
