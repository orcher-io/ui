'use client';

import { Box, Flex } from '@radix-ui/themes';

const shimmerKeyframes = `
@keyframes orcher-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

function ShimmerStyle() {
  return <style>{shimmerKeyframes}</style>;
}

function ShimmerBar({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
  return (
    <Box
      style={{
        width,
        height,
        borderRadius: 0,
        backgroundColor: 'var(--gray-3)',
        backgroundImage: 'linear-gradient(90deg, var(--gray-3) 0%, var(--gray-4) 40%, var(--gray-3) 80%)',
        backgroundSize: '800px 100%',
        backgroundRepeat: 'no-repeat',
        animation: 'orcher-shimmer 1.6s ease-in-out infinite',
      }}
    />
  );
}

// --- TableSkeleton ---

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

const columnWidths = ['60%', '45%', '70%', '50%', '55%', '40%', '65%', '48%'];

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <Box>
      <ShimmerStyle />
      {/* Header */}
      <Flex
        gap="3"
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--gray-a4)',
        }}
      >
        {Array.from({ length: columns }, (_, i) => (
          <Box key={i} style={{ flex: 1 }}>
            <ShimmerBar width="70%" height={10} />
          </Box>
        ))}
      </Flex>
      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIdx) => (
        <Flex
          key={rowIdx}
          gap="3"
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--gray-a3)',
          }}
        >
          {Array.from({ length: columns }, (_, colIdx) => (
            <Box key={colIdx} style={{ flex: 1 }}>
              <ShimmerBar
                width={columnWidths[(rowIdx + colIdx) % columnWidths.length]}
                height={12}
              />
            </Box>
          ))}
        </Flex>
      ))}
    </Box>
  );
}

// --- CardSkeleton ---

interface CardSkeletonProps {
  height?: number;
}

export function CardSkeleton({ height = 80 }: CardSkeletonProps) {
  return (
    <Box>
      <ShimmerStyle />
      <ShimmerBar width="100%" height={height} />
    </Box>
  );
}

// --- DetailSkeleton ---

export function DetailSkeleton() {
  return (
    <Box p="4">
      <ShimmerStyle />
      {/* Label + value pairs in a grid */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px 24px',
          marginBottom: 20,
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Flex key={i} direction="column" gap="2">
            <ShimmerBar width="40%" height={10} />
            <ShimmerBar width="75%" height={12} />
          </Flex>
        ))}
      </Box>
      {/* Capacity bar */}
      <Box style={{ marginBottom: 16 }}>
        <ShimmerBar width="30%" height={10} />
        <Box style={{ marginTop: 6 }}>
          <ShimmerBar width="100%" height={8} />
        </Box>
      </Box>
      {/* Small text blocks */}
      <Flex direction="column" gap="2">
        <ShimmerBar width="90%" height={12} />
        <ShimmerBar width="65%" height={12} />
        <ShimmerBar width="78%" height={12} />
      </Flex>
    </Box>
  );
}

// --- PageSkeleton ---

export function PageSkeleton() {
  return (
    <Box>
      <ShimmerStyle />
      {/* Header bar */}
      <Flex
        align="center"
        justify="between"
        style={{
          padding: '12px 0',
          marginBottom: 16,
        }}
      >
        <ShimmerBar width={180} height={16} />
        <ShimmerBar width={100} height={28} />
      </Flex>
      {/* Table */}
      <TableSkeleton rows={5} columns={4} />
    </Box>
  );
}
