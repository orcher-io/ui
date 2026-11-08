'use client';

import { useState, useCallback, useRef, useEffect, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Box, Text, Flex, Button, Theme } from '@radix-ui/themes';
import { Cross1Icon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { useTheme } from '@orcher/workbench-ui';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  icon?: ReactNode;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  icon,
  loading = false,
}: ConfirmDialogProps) {
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [confirming, setConfirming] = useState(false);
  const { appearance } = useTheme();

  // Center on open
  useEffect(() => {
    if (open) {
      setPos({
        x: Math.max(0, (window.innerWidth - 400) / 2),
        y: Math.max(0, (window.innerHeight - 200) / 3),
      });
    }
  }, [open]);

  // Lock scroll + escape
  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = orig; document.removeEventListener('keydown', handler); };
  }, [open, onClose]);

  // Drag
  const onTitleMouseDown = useCallback((e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: globalThis.MouseEvent) => {
      setPos({
        x: Math.max(0, dragStart.current.px + e.clientX - dragStart.current.x),
        y: Math.max(0, dragStart.current.py + e.clientY - dragStart.current.y),
      });
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <Theme appearance={appearance} accentColor="gray">
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            style={{
              position: 'fixed',
              left: pos.x, top: pos.y,
              width: 400, zIndex: 99999,
              display: 'flex', flexDirection: 'column',
              backgroundColor: 'var(--gray-1)',
              borderRadius: 0,
              border: '0.5px solid var(--gray-a6)',
              boxShadow: '0 16px 50px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            {/* Title bar */}
            <Box
              onMouseDown={onTitleMouseDown}
              style={{
                display: 'flex', alignItems: 'center', height: 36,
                backgroundColor: 'var(--gray-2)',
                borderBottom: '1px solid var(--gray-a6)',
                padding: '0 12px',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none', flexShrink: 0,
              }}
            >
              <Text size="2" weight="medium" style={{ flex: 1 }}>{title}</Text>
              <Button size="1" variant="ghost" color="gray" onClick={onClose}>
                <Cross1Icon width={14} height={14} />
              </Button>
            </Box>

            {/* Content */}
            <Flex gap="3" align="start" style={{ padding: '16px' }}>
              <Box style={{
                flexShrink: 0, marginTop: 2,
                color: variant === 'danger' ? 'var(--red-9)' : 'var(--gray-9)',
              }}>
                {icon ?? (variant === 'danger'
                  ? <ExclamationTriangleIcon width={18} height={18} />
                  : <InfoCircledIcon width={18} height={18} />
                )}
              </Box>
              <Text style={{ fontSize: 13, color: 'var(--gray-11)', lineHeight: 1.5 }}>
                {message}
              </Text>
            </Flex>

            {/* Footer */}
            <Flex gap="2" justify="end" style={{ padding: '12px 16px' }}>
              <Button variant="soft" color="gray" onClick={onClose} disabled={confirming || loading}>
                {cancelLabel}
              </Button>
              <Button
                variant="solid"
                color={variant === 'danger' ? 'red' : 'gray'}
                highContrast={variant !== 'danger'}
                onClick={handleConfirm}
                disabled={confirming || loading}
              >
                {confirming ? 'Processing...' : confirmLabel}
              </Button>
            </Flex>
          </motion.div>
        </Theme>
      )}
    </AnimatePresence>,
    document.body,
  );
}
