import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-lg font-black ring-offset-background transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        reservation:
          'min-h-14 w-full rounded-2xl border-0 bg-gradient-to-r from-[#FFC233] to-[#FFE15A] px-5 py-4 text-base font-bold text-[#1F2937] shadow-md hover:brightness-[1.03] active:brightness-[0.98] [&_svg]:size-6',
        ghost: 'shadow-none ring-0 hover:bg-accent'
      },
      size: {
        default: 'px-4 py-3',
        sm: 'h-9 rounded-md px-3 text-sm'
      }
    },
    defaultVariants: {
      variant: 'reservation',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
