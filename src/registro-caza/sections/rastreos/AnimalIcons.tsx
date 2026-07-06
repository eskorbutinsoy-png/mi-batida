import jabaliImg from '../../assets/icons/jabali.jfif';
import ciervoImg from '../../assets/icons/ciervo.jfif';
import corzoImg from '../../assets/icons/corzo.jfif';
import zorroImg from '../../assets/icons/zorro.jfif';

interface IconProps { size?: number; className?: string; }

export type AnimalType = 'jabali' | 'ciervo' | 'corzo' | 'zorro';

export const ANIMAL_IMGS: Record<AnimalType, string> = {
  jabali: jabaliImg,
  ciervo: ciervoImg,
  corzo:  corzoImg,
  zorro:  zorroImg,
};

export function JabaliIcon({ size = 32, className = '' }: IconProps) {
  return <img src={jabaliImg} width={size} height={size} className={className} style={{ objectFit: 'contain' }} />;
}
export function CiervoIcon({ size = 32, className = '' }: IconProps) {
  return <img src={ciervoImg} width={size} height={size} className={className} style={{ objectFit: 'contain' }} />;
}
export function CorzoIcon({ size = 32, className = '' }: IconProps) {
  return <img src={corzoImg} width={size} height={size} className={className} style={{ objectFit: 'contain' }} />;
}
export function ZorroIcon({ size = 32, className = '' }: IconProps) {
  return <img src={zorroImg} width={size} height={size} className={className} style={{ objectFit: 'contain' }} />;
}

export const ANIMALES: { value: AnimalType; label: string; color: string; markerColor: string }[] = [
  { value: 'jabali',  label: 'Jabalí',  color: '#92400e', markerColor: '#78350f' },
  { value: 'ciervo',  label: 'Ciervo',  color: '#065f46', markerColor: '#064e3b' },
  { value: 'corzo',   label: 'Corzo',   color: '#1e40af', markerColor: '#1e3a8a' },
  { value: 'zorro',   label: 'Zorro',   color: '#b45309', markerColor: '#92400e' },
];

export function AnimalIcon({ animal, size = 32, className = '' }: { animal: AnimalType } & IconProps) {
  return <img src={ANIMAL_IMGS[animal]} width={size} height={size} className={className} style={{ objectFit: 'contain' }} />;
}

export function buildAnimalMarkerSvgPath(_animal: AnimalType): string { return ''; }
