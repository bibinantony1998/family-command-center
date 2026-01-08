import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center rounded-3xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                    {
                        'bg-primary text-white hover:bg-indigo-600': variant === 'primary',
                        'bg-secondary text-white hover:bg-rose-600': variant === 'secondary',
                        'border-2 border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700': variant === 'outline',
                        'bg-transparent hover:bg-slate-100 text-slate-700': variant === 'ghost',
                        'bg-red-500 text-white hover:bg-red-600': variant === 'danger',
                        'h-10 px-4 py-2 text-sm': size === 'sm',
                        'h-12 px-6 py-3 text-base': size === 'md', // Default large touch target
                        'h-14 px-8 py-4 text-lg': size === 'lg',
                        'h-12 w-12': size === 'icon',
                    },
                    className
                )}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
