'use client';

import React from 'react';

/**
 * VaultGuard wrapper.
 * Dashboard access is granted immediately upon Clerk login.
 * Lockora Password checks are performed just-in-time for protected operations.
 */
export function VaultGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
