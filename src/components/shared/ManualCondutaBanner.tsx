import { BookOpen, ExternalLink } from 'lucide-react';

const MANUAL_URL =
  'https://drive.google.com/file/d/1NrqcJCcq-UuOvPyjsp-kyWpugWJIsilX/view?usp=sharing';

export default function ManualCondutaBanner() {
  return (
    <a
      href={MANUAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 mt-4 cursor-pointer hover:bg-amber-500/15 transition-colors"
    >
      <BookOpen size={16} className="text-amber-500 shrink-0" />
      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
        Manual de Conduta dos Gestores
      </span>
      <ExternalLink size={12} className="text-amber-400 ml-auto shrink-0" />
    </a>
  );
}
