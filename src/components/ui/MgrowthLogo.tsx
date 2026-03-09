import mgrowthLogo from '@/assets/mgrowth-logo.png';

interface MgrowthLogoProps {
  className?: string;
}

export function MgrowthLogo({ className }: MgrowthLogoProps) {
  return (
    <img
      src={mgrowthLogo}
      alt="MGrowth Marketing B2B"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
