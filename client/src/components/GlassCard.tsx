import { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export default function GlassCard({ children, className = '', padded = true, ...rest }: Props) {
  return (
    <div
      className={`glass-surface rounded-2xl ${padded ? 'p-5' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
