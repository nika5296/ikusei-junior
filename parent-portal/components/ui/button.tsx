import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-lg font-black ring-offset-background transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        reservation:
          'min-h-[3.35rem] w-full rounded-full border-2 border-yellow-300 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300 px-5 py-3.5 text-base font-bold text-neutral-900 shadow-md hover:from-orange-300 hover:via-amber-300 hover:to-yellow-200',
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
