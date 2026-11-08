'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Box, Text, Flex, Theme } from '@radix-ui/themes';
import { ChevronDownIcon, CheckIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional custom render for the option row */
  render?: ReactNode;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  width?: number | string;
  /** Allow typing a custom value not in the options list */
  allowCustom?: boolean;
  /** Max dropdown height in px (default 220) */
  maxDropdownHeight?: number;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  width = '100%',
  allowCustom = false,
  maxDropdownHeight = 220,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownId = useRef(`ss-${Math.random().toString(36).slice(2, 8)}`).current;

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      const portal = document.querySelector(`[data-ss-id="${dropdownId}"]`);
      if (portal?.contains(target)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, dropdownId]);

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setSearch(''); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    opt.value.toLowerCase().includes(search.toLowerCase()),
  );

  const current = options.find((o) => o.value === value);

  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 180),
    });
  }, [open]);

  const handleSelect = useCallback((val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  return (
    <Box ref={ref} style={{ position: 'relative', width }}>
      {/* Trigger */}
      <Flex
        ref={triggerRef}
        align="center"
        justify="between"
        gap="2"
        onClick={() => setOpen(!open)}
        style={{
          padding: '5px 8px',
          background: 'var(--gray-3)',
          borderRadius: 0,
          cursor: 'pointer',
          boxShadow: open ? 'inset 0 0 0 0.5px var(--gray-7)' : 'inset 0 0 0 0.5px var(--gray-a5)',
          transition: 'box-shadow 0.1s',
          minHeight: 28,
        }}
      >
        <Box style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {current?.render ?? (
            <Text style={{ fontSize: 12, color: (current || (allowCustom && value)) ? 'var(--gray-12)' : 'var(--gray-8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {current?.label ?? (allowCustom && value ? value : placeholder)}
            </Text>
          )}
        </Box>
        <ChevronDownIcon
          width={12} height={12}
          style={{
            color: 'var(--gray-8)',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
      </Flex>

      {/* Dropdown portal */}
      {open && typeof window !== 'undefined' && createPortal(
        <Theme
          appearance={document.querySelector('.radix-themes')?.classList.contains('light') ? 'light' : 'dark'}
          accentColor="gray"
          style={{ display: 'contents' }}
        >
          <Box
            data-ss-id={dropdownId}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              background: 'var(--gray-2)',
              border: 'none',
              boxShadow: 'inset 0 0 0 0.5px var(--gray-a5), 0 8px 24px rgba(0,0,0,0.3)',
              borderRadius: 0,
              zIndex: 99999,
              overflow: 'hidden',
            }}
          >
            {/* Search */}
            <Flex
              align="center"
              gap="2"
              style={{ padding: '6px 8px', borderBottom: '1px solid var(--gray-a5)' }}
            >
              <MagnifyingGlassIcon width={12} height={12} style={{ color: 'var(--gray-8)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent', color: 'var(--gray-12)', fontSize: 12,
                }}
              />
            </Flex>

            {/* Options */}
            <Box style={{ maxHeight: maxDropdownHeight, overflowY: 'auto' }}>
              {/* Custom value option */}
              {allowCustom && search.trim() && !options.some((o) => o.value === search.trim()) && (
                <Flex
                  align="center"
                  gap="2"
                  px="3"
                  py="1"
                  onClick={() => handleSelect(search.trim())}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--gray-a3)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Text style={{ fontSize: 12, color: 'var(--gray-10)' }}>Use "</Text>
                  <Text style={{ fontSize: 12, color: 'var(--gray-12)', fontWeight: 500 }}>{search.trim()}</Text>
                  <Text style={{ fontSize: 12, color: 'var(--gray-10)' }}>"</Text>
                </Flex>
              )}
              {filtered.length === 0 && !(allowCustom && search.trim()) ? (
                <Text style={{ fontSize: 12, color: 'var(--gray-8)', padding: '8px 12px', display: 'block', textAlign: 'center' }}>
                  No results
                </Text>
              ) : (
                filtered.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <Flex
                      key={opt.value}
                      align="center"
                      justify="between"
                      px="3"
                      py="1"
                      onClick={() => handleSelect(opt.value)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'var(--gray-4)' : 'transparent',
                        transition: 'background 0.08s',
                        minHeight: 28,
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--gray-3)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isSelected ? 'var(--gray-4)' : 'transparent'; }}
                    >
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        {opt.render ?? (
                          <Text style={{ fontSize: 12, color: 'var(--gray-12)' }}>{opt.label}</Text>
                        )}
                      </Box>
                      {isSelected && <CheckIcon width={12} height={12} style={{ color: 'var(--gray-11)', flexShrink: 0 }} />}
                    </Flex>
                  );
                })
              )}
            </Box>
          </Box>
        </Theme>,
        document.body,
      )}
    </Box>
  );
}
