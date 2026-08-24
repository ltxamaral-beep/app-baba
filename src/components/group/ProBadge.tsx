import React from 'react';

interface ProBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProBadge({ size = 'md', className = '' }: ProBadgeProps) {
  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider',
    md: 'text-[11px] px-2 py-0.5 rounded-md font-black tracking-wider',
    lg: 'text-xs px-2.5 py-1 rounded-md font-black tracking-wider',
  };

  return (
    <span
      className={`inline-flex items-center justify-center italic bg-[#00b49f] text-white shadow-sm font-black select-none ${sizeClasses[size]} ${className}`}
    >
      PRO
    </span>
  );
}
