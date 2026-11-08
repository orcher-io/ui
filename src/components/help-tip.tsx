'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Theme } from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useTheme } from '@orcher/workbench-ui';

interface HelpTipProps {
  /** The help text shown on hover */
  content: string;
  /** Icon size in px (default 12) */
  size?: number;
  /** Always visible (default false — only shows on parent hover) */
  alwaysVisible?: boolean;
}

export function HelpTip({ content, size = 12, alwaysVisible = false }: HelpTipProps) {
  const { appearance } = useTheme();

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <InfoCircledIcon
            width={size}
            height={size}
            className={alwaysVisible ? undefined : 'help-tip-icon'}
            style={{
              color: 'var(--gray-8)',
              cursor: 'help',
              flexShrink: 0,
              opacity: alwaysVisible ? 1 : 0,
              transition: 'opacity 0.15s',
            }}
          />
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <Theme appearance={appearance} accentColor="gray" style={{ display: 'contents' }}>
            <TooltipPrimitive.Content
              side="top"
              sideOffset={4}
              style={{
                maxWidth: 260,
                padding: '4px 8px',
                fontSize: 12,
                lineHeight: 1.3,
                fontFamily: 'var(--default-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
                color: 'var(--gray-12)',
                backgroundColor: 'var(--gray-2)',
                border: '0.5px solid var(--gray-a6)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                zIndex: 99999,
              }}
            >
              {content}
            </TooltipPrimitive.Content>
          </Theme>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
