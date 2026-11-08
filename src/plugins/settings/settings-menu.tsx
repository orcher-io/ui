'use client';

import { useState } from 'react';
import { Box, Text, Flex, Separator } from '@radix-ui/themes';
import {
  GearIcon,
  SunIcon,
  MoonIcon,
  DesktopIcon,
  InfoCircledIcon,
  ExternalLinkIcon,
  CheckIcon,
  ChevronRightIcon,
  ExitIcon,
} from '@radix-ui/react-icons';
import { useTheme, type ThemeAppearance } from '@orcher/workbench-ui';
import type { ReactNode } from 'react';

interface SettingsMenuProps {
  onOpenSettings: () => void;
  /** Offered when the app signed in with a credential it can drop */
  onSignOut?: () => void;
}

function MenuItem({
  icon,
  label,
  shortcut,
  active,
  suffix,
  onClick,
  children,
}: {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  suffix?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Box style={{ position: 'relative' }}>
      <Flex
        align="center"
        gap="2"
        px="3"
        py="1"
        onClick={onClick}
        onMouseEnter={(e) => {
          setHovered(true);
          if (!active) e.currentTarget.style.background = 'var(--gray-3)';
        }}
        onMouseLeave={(e) => {
          setHovered(false);
          if (!active) e.currentTarget.style.background = 'transparent';
        }}
        style={{
          cursor: onClick || children ? 'pointer' : 'default',
          borderRadius: 0,
          background: active ? 'var(--gray-4)' : 'transparent',
          transition: 'background 0.1s',
        }}
      >
        <Box style={{ color: active ? 'var(--gray-12)' : 'var(--gray-10)', display: 'flex', width: 16, justifyContent: 'center' }}>
          {icon}
        </Box>
        <Text style={{ fontSize: 12, flex: 1, fontWeight: active ? 500 : 400, color: 'var(--gray-12)' }}>{label}</Text>
        {suffix}
        {active && <CheckIcon width={14} height={14} style={{ color: 'var(--gray-11)' }} />}
        {children && <ChevronRightIcon width={12} height={12} style={{ color: 'var(--gray-8)' }} />}
        {shortcut && !active && !children && (
          <Text style={{ fontSize: 10, color: 'var(--gray-8)', fontFamily: 'monospace' }}>{shortcut}</Text>
        )}
      </Flex>
      {children && hovered && (
        <Box
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'absolute',
            left: '100%',
            bottom: 0,
            marginLeft: 2,
            background: 'var(--gray-2)',
            border: '0.5px solid var(--gray-a6)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            zIndex: 10,
            minWidth: 160,
            padding: '4px 0',
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}

function SubMenuItem({
  icon,
  label,
  active,
  onClick,
  suffix,
}: {
  icon?: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  suffix?: ReactNode;
}) {
  return (
    <Flex
      align="center"
      gap="2"
      px="3"
      py="1"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        background: active ? 'var(--gray-4)' : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (onClick && !active) e.currentTarget.style.background = 'var(--gray-3)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {icon && (
        <Box style={{ color: active ? 'var(--gray-12)' : 'var(--gray-10)', display: 'flex', width: 14, justifyContent: 'center' }}>
          {icon}
        </Box>
      )}
      <Text style={{ fontSize: 12, flex: 1, fontWeight: active ? 500 : 400, color: 'var(--gray-12)' }}>{label}</Text>
      {suffix && <Text style={{ fontSize: 10, color: 'var(--gray-8)', fontFamily: 'monospace' }}>{suffix}</Text>}
      {active && <CheckIcon width={12} height={12} style={{ color: 'var(--gray-11)' }} />}
    </Flex>
  );
}

export function SettingsMenu({ onOpenSettings, onSignOut }: SettingsMenuProps) {
  const { appearance, setTheme } = useTheme();

  const storedPref = typeof window !== 'undefined' ? localStorage.getItem('workbench-theme') : null;
  const isSystem = !storedPref;

  const currentLabel = isSystem ? 'System' : appearance === 'dark' ? 'Dark' : 'Light';

  const handleTheme = (theme: 'dark' | 'light' | 'system') => {
    if (theme === 'system') {
      localStorage.removeItem('workbench-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    } else {
      setTheme(theme);
    }
  };

  return (
    <Box style={{ width: 220, padding: '4px' }}>
      <Box px="3" pt="1">
        <Text style={{ fontSize: 10, color: 'var(--gray-8)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Settings
        </Text>
      </Box>

      <MenuItem
        icon={<GearIcon width={14} height={14} />}
        label="Preferences"
        shortcut="⌘,"
        onClick={onOpenSettings}
      />

      <Separator size="4" my="1" />

      <MenuItem
        icon={appearance === 'dark' ? <MoonIcon width={14} height={14} /> : <SunIcon width={14} height={14} />}
        label="Theme"
        suffix={<Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>{currentLabel}</Text>}
      >
        <SubMenuItem icon={<MoonIcon width={13} height={13} />} label="Dark" active={appearance === 'dark' && !isSystem} onClick={() => handleTheme('dark')} />
        <SubMenuItem icon={<SunIcon width={13} height={13} />} label="Light" active={appearance === 'light' && !isSystem} onClick={() => handleTheme('light')} />
        <SubMenuItem icon={<DesktopIcon width={13} height={13} />} label="System" active={isSystem} onClick={() => handleTheme('system')} />
      </MenuItem>

      <Separator size="4" my="1" />

      <MenuItem
        icon={<InfoCircledIcon width={14} height={14} />}
        label="About Orcher"
      >
        <Box px="3" py="2" style={{ minWidth: 180 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-12)', display: 'block' }}>Orcher</Text>
          <Text style={{ fontSize: 11, color: 'var(--gray-8)', display: 'block', marginTop: 2 }}>v0.1.0</Text>
          <Text style={{ fontSize: 11, color: 'var(--gray-8)', display: 'block', marginTop: 4, lineHeight: 1.4 }}>
            High-performance workflow orchestration platform
          </Text>
          <Separator size="4" my="2" />
          <Flex direction="column" gap="1">
            <Text
              style={{ fontSize: 11, color: 'var(--gray-10)', cursor: 'pointer' }}
              onClick={() => window.open('https://github.com/orcher-io/orcher', '_blank')}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--gray-12)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--gray-10)'; }}
            >
              GitHub Repository
            </Text>
            <Text
              style={{ fontSize: 11, color: 'var(--gray-10)', cursor: 'pointer' }}
              onClick={() => window.open('https://github.com/orcher-io/orcher/issues', '_blank')}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--gray-12)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--gray-10)'; }}
            >
              Report Issue
            </Text>
          </Flex>
        </Box>
      </MenuItem>
      <MenuItem
        icon={<ExternalLinkIcon width={14} height={14} />}
        label="Documentation"
        onClick={() => window.open('https://docs.orcher.io', '_blank')}
      />

      {onSignOut && (
        <>
          <Separator size="4" my="1" />
          <MenuItem icon={<ExitIcon width={14} height={14} />} label="Sign out" onClick={onSignOut} />
        </>
      )}

      <Separator size="4" my="1" />

      <Box px="3" py="1">
        <Text style={{ fontSize: 10, color: 'var(--gray-7)' }}>Orcher Dashboard v0.1.0</Text>
      </Box>
    </Box>
  );
}
