'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Lock, Key, Cpu, Network } from 'lucide-react';

export function CyberBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only render animations on client to prevent hydration mismatch
    // and check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mediaQuery.matches) {
      setMounted(true);
    }
  }, []);

  if (!mounted) {
    // Static background fallback
    return <div className="fixed inset-0 z-0 bg-white dark:bg-zinc-950 cyber-bg-pattern pointer-events-none" />;
  }

  // Generate deterministic floating items
  const items = [
    { id: 1, Icon: Shield, x: 15, delay: 0, duration: 45, size: 24 },
    { id: 2, Icon: Lock, x: 85, delay: 10, duration: 55, size: 20 },
    { id: 3, Icon: Key, x: 45, delay: 5, duration: 50, size: 18 },
    { id: 4, Icon: Cpu, x: 70, delay: 20, duration: 60, size: 32 },
    { id: 5, Icon: Network, x: 25, delay: 15, duration: 40, size: 28 },
    { id: 6, Icon: Lock, x: 60, delay: 25, duration: 48, size: 16 },
    { id: 7, Icon: Shield, x: 35, delay: 35, duration: 52, size: 22 },
    { id: 8, Icon: Network, x: 5, delay: 30, duration: 65, size: 24 },
    { id: 9, Icon: Cpu, x: 95, delay: 40, duration: 50, size: 26 },
  ];

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Base patterned background */}
      <div className="absolute inset-0 bg-white dark:bg-zinc-950 cyber-bg-pattern opacity-100" />
      
      {/* Floating Elements Container */}
      <div className="absolute inset-0 opacity-[0.15] dark:opacity-[0.25]">
        {items.map(({ id, Icon, x, delay, duration, size }) => (
          <div
            key={id}
            className="absolute bottom-0 text-indigo-500/50 dark:text-indigo-400/50 animate-float-up"
            style={{
              left: `${x}%`,
              animationDuration: `${duration}s`,
              animationDelay: `-${delay}s`,
              transform: 'translateY(100px)'
            }}
          >
            <Icon size={size} strokeWidth={1.5} />
          </div>
        ))}
      </div>
    </div>
  );
}
