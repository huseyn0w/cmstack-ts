import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

const badgeVariants = cva(
  'inline-flex items-center rounded-full h-[22px] px-2.5 text-xs font-medium leading-none border',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary border-primary/20',
        secondary: 'bg-secondary text-secondary-foreground border-border',
        outline: 'border-border text-foreground bg-transparent',
        success: 'bg-success-bg text-success border-success/25',
        warning: 'bg-warning-bg text-warning border-warning/25',
        muted: 'bg-muted text-muted-foreground border-border',
        destructive: 'bg-error-bg text-error border-error/25',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
