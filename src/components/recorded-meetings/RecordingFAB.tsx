import { Video } from 'lucide-react';

export interface RecordingFABProps {
  onOpen: () => void;
}

export function RecordingFAB({ onOpen }: RecordingFABProps) {
  return (
    <button
      onClick={onOpen}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 transition-all hover:shadow-xl hover:shadow-red-600/30 hover:scale-105 active:scale-95 group"
      title="Gravar Reuniao"
    >
      <Video size={20} className="shrink-0" />
      <span className="text-sm font-medium hidden sm:inline">Gravar Reuniao</span>
    </button>
  );
}
