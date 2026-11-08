'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, Text, Flex, Switch, Badge, ScrollArea } from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useTheme, type ThemeAppearance } from '@orcher/workbench-ui';
import { SearchableSelect } from '../../components/searchable-select';

// ============================================================================
// Settings schema
// ============================================================================

interface SettingDef {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  description: string;
  default: unknown;
  category: string;
  options?: { value: string; label: string }[];
  suffix?: string;
}

const SETTINGS: SettingDef[] = [
  // ── Connection ──
  { key: 'connection.defaultNamespace', type: 'string', label: 'Default Namespace', description: 'The default namespace to use when listing workflows and executions.', default: '', category: 'Connection' },
  { key: 'connection.timeout', type: 'number', label: 'Request Timeout', description: 'Maximum time to wait for API responses before timing out.', default: 30000, category: 'Connection', suffix: 'ms' },

  // ── Dashboard ──
  { key: 'dashboard.refreshInterval', type: 'select', label: 'Auto Refresh Interval', description: 'How often the dashboard automatically refreshes workflow data.', default: 'off', category: 'Dashboard', options: [{ value: 'off', label: 'Off' }, { value: '5000', label: '5 seconds' }, { value: '10000', label: '10 seconds' }, { value: '30000', label: '30 seconds' }, { value: '60000', label: '1 minute' }] },
  { key: 'dashboard.defaultView', type: 'select', label: 'Default View', description: 'The view to show when opening the Workflows section.', default: 'overview', category: 'Dashboard', options: [{ value: 'overview', label: 'Overview' }, { value: 'list', label: 'All Workflows' }, { value: 'timelines', label: 'Timelines' }] },
  { key: 'dashboard.pageSize', type: 'select', label: 'Page Size', description: 'Number of workflows to display per page in list views.', default: '20', category: 'Dashboard', options: [{ value: '10', label: '10' }, { value: '20', label: '20' }, { value: '50', label: '50' }, { value: '100', label: '100' }] },
  { key: 'dashboard.showCompletedWorkflows', type: 'boolean', label: 'Show Completed Workflows', description: 'Include completed workflows in the default workflow list.', default: true, category: 'Dashboard' },

  // ── Appearance ──
  { key: 'appearance.theme', type: 'select', label: 'Theme', description: 'Controls the color theme of the dashboard.', default: 'dark', category: 'Appearance', options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }] },
  { key: 'appearance.compactMode', type: 'boolean', label: 'Compact Mode', description: 'Reduce spacing and padding throughout the interface for denser information display.', default: false, category: 'Appearance' },
  { key: 'appearance.showStatusBar', type: 'boolean', label: 'Show Status Bar', description: 'Controls the visibility of the status bar at the bottom.', default: true, category: 'Appearance' },
  { key: 'appearance.showBreadcrumbs', type: 'boolean', label: 'Show Breadcrumbs', description: 'Controls the visibility of the breadcrumb navigation bar.', default: true, category: 'Appearance' },

  // ── Workflows ──
  { key: 'workflows.confirmCancel', type: 'boolean', label: 'Confirm Before Cancel', description: 'Show a confirmation dialog before cancelling a workflow execution.', default: true, category: 'Workflows' },
  { key: 'workflows.confirmReset', type: 'boolean', label: 'Confirm Before Reset', description: 'Show a confirmation dialog before resetting a workflow to a previous state.', default: true, category: 'Workflows' },
  { key: 'workflows.showJournalPayloads', type: 'boolean', label: 'Expand Journal Payloads', description: 'Automatically expand payload details in the journal timeline view.', default: false, category: 'Workflows' },
  { key: 'workflows.maxJournalEntries', type: 'number', label: 'Max Journal Entries', description: 'Maximum number of journal entries to load per workflow. Set to 0 for unlimited.', default: 500, category: 'Workflows' },

  // ── Notifications ──
  { key: 'notifications.enabled', type: 'boolean', label: 'Enable Notifications', description: 'Show browser notifications for workflow events (failures, completions).', default: false, category: 'Notifications' },
  { key: 'notifications.onFailure', type: 'boolean', label: 'Notify on Failure', description: 'Show a notification when a workflow execution fails.', default: true, category: 'Notifications' },
  { key: 'notifications.onCompletion', type: 'boolean', label: 'Notify on Completion', description: 'Show a notification when a workflow execution completes successfully.', default: false, category: 'Notifications' },

  // ── Advanced ──
  { key: 'advanced.debugMode', type: 'boolean', label: 'Debug Mode', description: 'Enable verbose logging in the browser console for debugging API calls and state changes.', default: false, category: 'Advanced' },
  { key: 'advanced.experimentalFeatures', type: 'boolean', label: 'Experimental Features', description: 'Enable experimental features that are still in development. May be unstable.', default: false, category: 'Advanced' },
  { key: 'advanced.apiRateLimit', type: 'number', label: 'API Rate Limit', description: 'Maximum number of API requests per minute from the dashboard.', default: 100, category: 'Advanced', suffix: 'req/min' },
];

const CATEGORIES = [...new Set(SETTINGS.map((s) => s.category))];

// ============================================================================
// Storage
// ============================================================================

const STORAGE_KEY = 'orcher-settings';

function loadSettings(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function saveSettings(settings: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ============================================================================
// Setting row
// ============================================================================

function SettingRow({
  setting,
  value,
  onChange,
  isModified,
}: {
  setting: SettingDef;
  value: unknown;
  onChange: (value: unknown) => void;
  isModified: boolean;
}) {
  const renderControl = () => {
    switch (setting.type) {
      case 'boolean':
        return (
          <Switch
            checked={(value as boolean) ?? (setting.default as boolean) ?? false}
            onCheckedChange={onChange}
          />
        );
      case 'string':
        return (
          <input
            value={(value as string) ?? (setting.default as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: '100%', maxWidth: 400,
              padding: '6px 8px', fontSize: 12,
              background: 'var(--gray-3)', color: 'var(--gray-12)',
              border: 'none', boxShadow: 'inset 0 0 0 1px var(--gray-a6)',
              borderRadius: 0, outline: 'none',
            }}
          />
        );
      case 'number':
        return (
          <Flex align="center" gap="2">
            <input
              type="number"
              value={(value as number) ?? (setting.default as number) ?? 0}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              style={{
                width: 120, padding: '6px 8px', fontSize: 12,
                background: 'var(--gray-3)', color: 'var(--gray-12)',
                border: 'none', boxShadow: 'inset 0 0 0 1px var(--gray-a6)',
                borderRadius: 0, outline: 'none',
              }}
            />
            {setting.suffix && (
              <Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>{setting.suffix}</Text>
            )}
          </Flex>
        );
      case 'select':
        return (
          <SearchableSelect
            value={(value as string) ?? (setting.default as string) ?? ''}
            onChange={(v) => onChange(v)}
            width={200}
            options={setting.options ?? []}
            placeholder="Select..."
            searchPlaceholder="Search..."
            maxDropdownHeight={150}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box style={{ padding: '12px 0' }}>
      <Flex align="start" gap="2" mb="1">
        <Text style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-12)' }}>
          {setting.label}
        </Text>
        {isModified && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue-9)', marginTop: 4, flexShrink: 0 }} />
        )}
      </Flex>
      <Text style={{ fontSize: 12, color: 'var(--gray-9)', display: 'block', marginBottom: 8, lineHeight: 1.4 }}>
        {setting.description}
      </Text>
      {renderControl()}
    </Box>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function OrcherSettingsEditor() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const { appearance, setTheme } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const stored = loadSettings();
    stored['appearance.theme'] = appearance;
    setValues(stored);
  }, [appearance]);

  const handleChange = useCallback((key: string, value: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      if (key === 'appearance.theme') {
        const theme = value as string;
        if (theme === 'system') {
          localStorage.removeItem('workbench-theme');
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setTheme(prefersDark ? 'dark' : 'light');
        } else if (theme === 'dark' || theme === 'light') {
          setTheme(theme as ThemeAppearance);
        }
      }
      return next;
    });
  }, [setTheme]);

  // Filter settings by search
  const filteredByCategory = useMemo(() => {
    const groups: Record<string, SettingDef[]> = {};
    for (const cat of CATEGORIES) groups[cat] = [];
    for (const s of SETTINGS) {
      if (search) {
        const q = search.toLowerCase();
        if (!s.label.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q) && !s.key.toLowerCase().includes(q)) continue;
      }
      groups[s.category].push(s);
    }
    return groups;
  }, [search]);

  const visibleCategories = CATEGORIES.filter((cat) => (filteredByCategory[cat]?.length ?? 0) > 0);

  // Scroll to category — lock scroll tracking until user manually scrolls again
  const clickedRef = useRef(false);
  const scrollToCategory = useCallback((cat: string) => {
    setActiveCategory(cat);
    clickedRef.current = true;
    sectionRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Unlock after animation completes + buffer
    setTimeout(() => { clickedRef.current = false; }, 800);
  }, []);

  // Track active category on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handler = () => {
      if (clickedRef.current) return;
      const containerTop = container.getBoundingClientRect().top;
      for (const cat of visibleCategories) {
        const el = sectionRefs.current[cat];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top - containerTop < 100) {
            setActiveCategory(cat);
          }
        }
      }
    };
    container.addEventListener('scroll', handler);
    return () => container.removeEventListener('scroll', handler);
  }, [visibleCategories]);

  const modifiedCount = Object.keys(values).filter((k) => {
    const def = SETTINGS.find((s) => s.key === k);
    return def && values[k] !== undefined && values[k] !== def.default;
  }).length;

  return (
    <Flex style={{ height: '100%' }}>
      {/* Sidebar */}
      <Flex
        direction="column"
        style={{
          width: 180, minWidth: 180, flexShrink: 0,
          borderRight: '1px solid var(--gray-a3)',
          padding: '12px 0',
        }}
      >
        <Text style={{ fontSize: 10, color: 'var(--gray-8)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 16px', marginBottom: 8 }}>
          Categories
        </Text>
        {visibleCategories.map((cat) => {
          const isActive = activeCategory === cat;
          const count = filteredByCategory[cat]?.length ?? 0;
          return (
            <Flex
              key={cat}
              align="center"
              justify="between"
              px="4"
              py="1"
              onClick={() => scrollToCategory(cat)}
              style={{
                cursor: 'pointer',
                background: isActive ? 'var(--gray-a3)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--gray-12)' : '2px solid transparent',
                transition: 'all 0.1s',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--gray-a2)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--gray-a3)' : 'transparent'; }}
            >
              <Text style={{ fontSize: 12, color: isActive ? 'var(--gray-12)' : 'var(--gray-10)', fontWeight: isActive ? 500 : 400 }}>
                {cat}
              </Text>
              <Text style={{ fontSize: 10, color: 'var(--gray-7)' }}>{count}</Text>
            </Flex>
          );
        })}
        {modifiedCount > 0 && (
          <Flex px="4" mt="3">
            <Badge size="1" variant="soft" color="blue">{modifiedCount} modified</Badge>
          </Flex>
        )}
      </Flex>

      {/* Content */}
      <Flex direction="column" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Search */}
        <Flex
          align="center"
          gap="2"
          style={{ padding: '8px 16px', borderBottom: '1px solid var(--gray-a3)', flexShrink: 0 }}
        >
          <MagnifyingGlassIcon width={14} height={14} style={{ color: 'var(--gray-8)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search settings..."
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--gray-12)', fontSize: 12,
            }}
          />
          {search && (
            <Text
              style={{ fontSize: 11, color: 'var(--gray-8)', cursor: 'pointer' }}
              onClick={() => setSearch('')}
            >
              Clear
            </Text>
          )}
        </Flex>

        {/* Settings list */}
        <Box ref={contentRef} style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
          {visibleCategories.length === 0 ? (
            <Flex align="center" justify="center" p="6">
              <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>No settings match "{search}"</Text>
            </Flex>
          ) : (
            visibleCategories.map((cat) => (
              <Box
                key={cat}
                ref={(el) => { sectionRefs.current[cat] = el; }}
                style={{ paddingTop: 20 }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--gray-12)',
                  display: 'block', marginBottom: 4,
                }}>
                  {cat}
                </Text>
                <div style={{ height: 1, background: 'var(--gray-a3)', marginBottom: 4 }} />
                {filteredByCategory[cat].map((setting) => {
                  const isModified = values[setting.key] !== undefined && values[setting.key] !== setting.default;
                  return (
                    <SettingRow
                      key={setting.key}
                      setting={setting}
                      value={values[setting.key]}
                      onChange={(v) => handleChange(setting.key, v)}
                      isModified={isModified}
                    />
                  );
                })}
              </Box>
            ))
          )}
        </Box>
      </Flex>
    </Flex>
  );
}
