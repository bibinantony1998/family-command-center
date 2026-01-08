import React from 'react';
import { cn } from '../../lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'rounded-3xl bg-white p-6 shadow-sm border border-slate-100',
                    className
                )}
                {...props}
            />
        );
    }
);

Card.displayName = 'Card';
