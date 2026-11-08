'use client';

const STORAGE_KEY = 'orcher-settings';

function getSettings(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Read a setting value from localStorage.
 * Returns the stored value or the default.
 */
export function getSetting<T>(key: string, defaultValue: T): T {
  const settings = getSettings();
  const value = settings[key];
  if (value === undefined || value === null) return defaultValue;
  return value as T;
}

/**
 * Read the REST API's URL from settings: the engine's HTTP port by default.
 */
export function getGatewayUrl(): string {
  return getSetting('connection.gatewayUrl', 'http://localhost:8080');
}

/**
 * Read the page size from settings.
 */
export function getPageSize(): number {
  const val = getSetting('dashboard.pageSize', '20');
  return Number(val) || 20;
}

/**
 * Read the request timeout from settings.
 */
export function getRequestTimeout(): number {
  return getSetting('connection.timeout', 30000);
}

/**
 * Read the auto-refresh interval from settings.
 * Returns 0 if off.
 */
export function getRefreshInterval(): number {
  const val = getSetting('dashboard.refreshInterval', 'off');
  if (val === 'off') return 0;
  return Number(val) || 0;
}
