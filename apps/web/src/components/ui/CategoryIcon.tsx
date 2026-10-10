import {
  Baby,
  Briefcase,
  Car,
  Coins,
  Dumbbell,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Shirt,
  ShoppingCart,
  Smartphone,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryIcon as IconId } from '@trackforge/shared';
import { cx } from '../../lib/cx';

export const ICONS: Record<IconId, LucideIcon> = {
  wallet: Wallet,
  briefcase: Briefcase,
  gift: Gift,
  'trending-up': TrendingUp,
  coins: Coins,
  home: Home,
  'shopping-cart': ShoppingCart,
  utensils: Utensils,
  car: Car,
  bolt: Zap,
  'heart-pulse': HeartPulse,
  film: Film,
  plane: Plane,
  'graduation-cap': GraduationCap,
  shirt: Shirt,
  smartphone: Smartphone,
  repeat: Repeat,
  'piggy-bank': PiggyBank,
  receipt: Receipt,
  'paw-print': PawPrint,
  dumbbell: Dumbbell,
  baby: Baby,
  wrench: Wrench,
  landmark: Landmark,
  tag: Tag,
};

export function CategoryIcon({ icon, color, size = 'md' }: { icon: IconId; color: string | null; size?: 'sm' | 'md' }) {
  const Icon = ICONS[icon] ?? Tag;
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-sm border border-line bg-elevated',
        size === 'sm' ? 'size-6' : 'size-8',
      )}
      style={{ color: color ?? 'var(--color-muted)' }}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={1.75} />
    </span>
  );
}
