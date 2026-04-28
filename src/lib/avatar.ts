// Determinístico avatar color/initials a partir de userId.
// Mesma palette para qualquer instância — duas montagens do mesmo user ficam
// com a mesma cor (estável entre sessões e telas).

export const AVATAR_PALETTE = [
  'bg-violet-500/20 text-violet-300',
  'bg-cyan-500/20 text-cyan-300',
  'bg-amber-500/20 text-amber-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-rose-500/20 text-rose-300',
  'bg-blue-500/20 text-blue-300',
  'bg-pink-500/20 text-pink-300',
  'bg-orange-500/20 text-orange-300',
] as const;

export function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
