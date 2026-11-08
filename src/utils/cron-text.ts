const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Convert a cron expression to a human-readable description.
 */
export function cronToText(cron: string): string {
  if (!cron) return '—';
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [m, h, dom, , dow] = parts;

  if (cron === '* * * * *') return 'Every minute';
  if (cron === '*/5 * * * *') return 'Every 5 minutes';
  if (cron === '*/15 * * * *') return 'Every 15 minutes';
  if (cron === '*/30 * * * *') return 'Every 30 minutes';

  const pad = (s: string) => s.padStart(2, '0');

  if (h === '*' && dom === '*' && dow === '*') {
    return `Every hour at :${pad(m)}`;
  }
  if (h === '*/6' && dom === '*' && dow === '*') {
    return `Every 6 hours at :${pad(m)}`;
  }
  if (dom === '*' && dow === '*') {
    return `Daily at ${pad(h)}:${pad(m)}`;
  }
  if (dom === '*' && dow !== '*') {
    const day = DAYS[Number(dow)] ?? dow;
    return `Every ${day} at ${pad(h)}:${pad(m)}`;
  }
  if (dow === '*') {
    return `Monthly on day ${dom} at ${pad(h)}:${pad(m)}`;
  }
  return cron;
}
