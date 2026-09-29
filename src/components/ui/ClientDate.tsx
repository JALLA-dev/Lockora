'use client';

import { useEffect, useState } from 'react';

export function ClientDate({ dateString, format = 'full' }: { dateString: string | Date, format?: 'full' | 'date' | 'time' }) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    const d = new Date(dateString);
    if (format === 'date') {
      setFormatted(d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
    } else if (format === 'time') {
      setFormatted(d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
    } else {
      setFormatted(d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
    }
  }, [dateString, format]);

  if (!formatted) return <span className="opacity-0">Loading...</span>;
  return <span>{formatted}</span>;
}
