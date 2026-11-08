'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Box, Text, Flex, Button, Theme } from '@radix-ui/themes';
import { GearIcon } from '@radix-ui/react-icons';
import { createPortal } from 'react-dom';

export interface KebabMenuItem {
  icon?: ReactNode;
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface KebabMenuProps {
  items: KebabMenuItem[];
  disabled?: boolean;
}

export function KebabMenu({ items, disabled }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node)) return;
      const menu = document.querySelector('[data-kebab-menu]');
      if (menu?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Position dropdown
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 2,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const isDark = typeof document !== 'undefined'
    ? !document.querySelector('.radix-themes')?.classList.contains('light')
    : true;

  return (
    <>
      <Button
        ref={buttonRef}
        size="1"
        variant="ghost"
        color="gray"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        title="Actions"
      >
        <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7.5" cy="3" r="1.2" fill="currentColor"/>
          <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor"/>
          <circle cx="7.5" cy="12" r="1.2" fill="currentColor"/>
        </svg>
      </Button>

      {open && typeof window !== 'undefined' && createPortal(
        <Theme appearance={isDark ? 'dark' : 'light'} accentColor="gray">
          <Box
            data-kebab-menu=""
            style={{
              position: 'fixed',
              top: pos.top,
              right: pos.right,
              width: 180,
              background: 'var(--gray-1)',
              border: 'none',
              boxShadow: 'inset 0 0 0 0.5px var(--gray-a5), 0 4px 16px rgba(0,0,0,0.25)',
              borderRadius: 0,
              zIndex: 99999,
              overflow: 'hidden',
              padding: '4px 0',
            }}
          >
            {items.map((item, i) => {
              if (item.separator) {
                return <div key={i} style={{ height: 1, background: 'var(--gray-a4)', margin: '3px 0' }} />;
              }
              return (
                <Flex
                  key={i}
                  align="center"
                  gap="3"
                  px="3"
                  onClick={() => { setOpen(false); item.onClick?.(); }}
                  style={{
                    cursor: 'pointer',
                    height: 30,
                    transition: 'background 0.08s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = item.danger ? 'var(--red-a2)' : 'var(--gray-a3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {item.icon && (
                    <Box style={{ color: item.danger ? 'var(--red-9)' : 'var(--gray-9)', display: 'flex', width: 14 }}>
                      {item.icon}
                    </Box>
                  )}
                  <Text style={{ fontSize: 12, color: item.danger ? 'var(--red-9)' : 'var(--gray-12)' }}>
                    {item.label}
                  </Text>
                </Flex>
              );
            })}
          </Box>
        </Theme>,
        document.body,
      )}
    </>
  );
}
