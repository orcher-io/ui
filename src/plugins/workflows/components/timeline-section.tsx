'use client';

import { useMemo } from 'react';
import { Box, Text, Flex, Badge } from '@radix-ui/themes';
import type { JournalEntry } from '../../../hooks/use-orcher-api';

interface TaskSpan {
  taskId: string;
  taskType: string;
  status: 'scheduled' | 'started' | 'completed' | 'failed';
  scheduledAt: number; // ms timestamp
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'var(--gray-7)',
  started: 'var(--blue-9)',
  completed: 'var(--green-9)',
  failed: 'var(--red-9)',
};

const STATUS_BG: Record<string, string> = {
  scheduled: 'var(--gray-4)',
  started: 'var(--blue-4)',
  completed: 'var(--green-4)',
  failed: 'var(--red-4)',
};

function parseTimestamp(ts: string): number {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(ms: number, origin: number): string {
  const offset = ms - origin;
  if (offset < 1000) return `+${Math.round(offset)}ms`;
  if (offset < 60000) return `+${(offset / 1000).toFixed(1)}s`;
  return `+${(offset / 60000).toFixed(1)}m`;
}

/** Extract task spans from journal entries */
function extractTaskSpans(entries: JournalEntry[]): TaskSpan[] {
  const tasks = new Map<string, TaskSpan>();

  for (const entry of entries) {
    const p = entry.payload;
    const taskId = (p.taskId ?? p.task_id ?? '') as string;
    if (!taskId) continue;

    const ts = parseTimestamp(entry.timestamp);

    if (entry.eventType.includes('TaskScheduled') || entry.eventType.includes('Taskscheduled')) {
      tasks.set(taskId, {
        taskId,
        taskType: (p.taskType ?? p.task_type ?? taskId) as string,
        status: 'scheduled',
        scheduledAt: ts,
      });
    } else if (entry.eventType.includes('TaskStarted') || entry.eventType.includes('Taskstarted')) {
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'started';
        task.startedAt = ts;
      }
    } else if (entry.eventType.includes('TaskCompleted') || entry.eventType.includes('Taskcompleted')) {
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'completed';
        task.completedAt = ts;
        task.durationMs = Number(p.durationMs ?? p.duration_ms ?? 0) || (ts - (task.startedAt ?? task.scheduledAt));
      }
    } else if (entry.eventType.includes('TaskFailed') || entry.eventType.includes('Taskfailed')) {
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.completedAt = ts;
        task.durationMs = ts - (task.startedAt ?? task.scheduledAt);
      }
    }
  }

  return Array.from(tasks.values()).sort((a, b) => a.scheduledAt - b.scheduledAt);
}

interface TimelineSectionProps {
  entries: JournalEntry[];
  loading: boolean;
}

export function TimelineSection({ entries, loading }: TimelineSectionProps) {
  const tasks = useMemo(() => extractTaskSpans(entries), [entries]);

  if (loading) {
    return (
      <Flex justify="center" p="6">
        <Text size="2" color="gray">Loading timeline...</Text>
      </Flex>
    );
  }

  if (tasks.length === 0) {
    return (
      <Flex justify="center" p="6">
        <Text size="2" color="gray">No tasks to display</Text>
      </Flex>
    );
  }

  // Compute time range
  const minTime = Math.min(...tasks.map((t) => t.scheduledAt));
  const maxTime = Math.max(
    ...tasks.map((t) => t.completedAt ?? t.startedAt ?? t.scheduledAt),
  );
  const totalDuration = Math.max(maxTime - minTime, 1);

  // Scale factor: bar area width (px)
  const BAR_AREA_WIDTH = 600;
  const LABEL_WIDTH = 160;
  const ROW_HEIGHT = 32;
  const BAR_HEIGHT = 18;

  // Time axis ticks
  const TICK_COUNT = 6;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
    const t = minTime + (totalDuration * i) / TICK_COUNT;
    return { time: t, label: formatTime(t, minTime) };
  });

  return (
    <Box p="3" style={{ overflowX: 'auto' }}>
      {/* Time axis */}
      <Flex style={{ marginLeft: LABEL_WIDTH, marginBottom: 4 }}>
        {ticks.map((tick, i) => (
          <Text
            key={i}
            size="1"
            color="gray"
            style={{
              position: 'absolute',
              left: LABEL_WIDTH + (BAR_AREA_WIDTH * (tick.time - minTime)) / totalDuration,
              transform: 'translateX(-50%)',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            {tick.label}
          </Text>
        ))}
      </Flex>

      {/* Gantt rows */}
      <Box
        style={{
          position: 'relative',
          width: LABEL_WIDTH + BAR_AREA_WIDTH + 20,
          marginTop: 16,
        }}
      >
        {/* Grid lines */}
        {ticks.map((tick, i) => (
          <Box
            key={i}
            style={{
              position: 'absolute',
              left: LABEL_WIDTH + (BAR_AREA_WIDTH * (tick.time - minTime)) / totalDuration,
              top: 0,
              bottom: 0,
              width: 1,
              height: tasks.length * ROW_HEIGHT,
              backgroundColor: 'var(--gray-4)',
            }}
          />
        ))}

        {tasks.map((task, index) => {
          const startOffset = task.startedAt
            ? ((task.startedAt - minTime) / totalDuration) * BAR_AREA_WIDTH
            : ((task.scheduledAt - minTime) / totalDuration) * BAR_AREA_WIDTH;

          const schedOffset = ((task.scheduledAt - minTime) / totalDuration) * BAR_AREA_WIDTH;

          const endTime = task.completedAt ?? task.startedAt ?? task.scheduledAt;
          const barStart = task.startedAt ?? task.scheduledAt;
          const barWidth = Math.max(
            ((endTime - barStart) / totalDuration) * BAR_AREA_WIDTH,
            4, // minimum visible width
          );

          // Waiting bar (scheduled → started)
          const waitWidth = task.startedAt
            ? ((task.startedAt - task.scheduledAt) / totalDuration) * BAR_AREA_WIDTH
            : 0;

          return (
            <Flex
              key={task.taskId}
              align="center"
              style={{
                height: ROW_HEIGHT,
                position: 'relative',
              }}
            >
              {/* Task label */}
              <Flex
                align="center"
                gap="1"
                style={{
                  width: LABEL_WIDTH,
                  flexShrink: 0,
                  paddingRight: 8,
                  overflow: 'hidden',
                }}
              >
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: STATUS_COLORS[task.status],
                    flexShrink: 0,
                  }}
                />
                <Text size="1" truncate style={{ flex: 1 }}>
                  {task.taskType}
                </Text>
              </Flex>

              {/* Bar area */}
              <Box style={{ position: 'relative', flex: 1, height: BAR_HEIGHT }}>
                {/* Wait bar (gray, scheduled → started) */}
                {waitWidth > 1 && (
                  <Box
                    title={`Waiting: ${formatMs(task.startedAt! - task.scheduledAt)}`}
                    style={{
                      position: 'absolute',
                      left: schedOffset,
                      top: (BAR_HEIGHT - 4) / 2,
                      width: waitWidth,
                      height: 4,
                      backgroundColor: 'var(--gray-6)',
                      borderRadius: 0,
                    }}
                  />
                )}

                {/* Execution bar */}
                <Box
                  title={`${task.taskType}: ${task.status} (${formatMs(task.durationMs ?? 0)})`}
                  style={{
                    position: 'absolute',
                    left: startOffset,
                    top: (BAR_HEIGHT - 14) / 2,
                    width: barWidth,
                    height: 14,
                    backgroundColor: STATUS_BG[task.status],
                    border: 'none', boxShadow: `inset 0 0 0 0.5px ${STATUS_COLORS[task.status]}`,
                    borderRadius: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    cursor: 'default',
                  }}
                >
                  {barWidth > 40 && (
                    <Text
                      size="1"
                      style={{
                        fontSize: 9,
                        color: STATUS_COLORS[task.status],
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatMs(task.durationMs ?? 0)}
                    </Text>
                  )}
                </Box>
              </Box>
            </Flex>
          );
        })}
      </Box>

      {/* Legend */}
      <Flex gap="4" mt="3" style={{ marginLeft: LABEL_WIDTH }}>
        <Flex align="center" gap="1">
          <Box style={{ width: 20, height: 4, backgroundColor: 'var(--gray-6)', borderRadius: 2 }} />
          <Text size="1" color="gray">Waiting</Text>
        </Flex>
        <Flex align="center" gap="1">
          <Box style={{ width: 20, height: 10, backgroundColor: STATUS_BG.completed, border: `1px solid ${STATUS_COLORS.completed}`, borderRadius: 2 }} />
          <Text size="1" color="gray">Completed</Text>
        </Flex>
        <Flex align="center" gap="1">
          <Box style={{ width: 20, height: 10, backgroundColor: STATUS_BG.failed, border: `1px solid ${STATUS_COLORS.failed}`, borderRadius: 2 }} />
          <Text size="1" color="gray">Failed</Text>
        </Flex>
        <Flex align="center" gap="1">
          <Box style={{ width: 20, height: 10, backgroundColor: STATUS_BG.started, border: `1px solid ${STATUS_COLORS.started}`, borderRadius: 2 }} />
          <Text size="1" color="gray">Running</Text>
        </Flex>
      </Flex>
    </Box>
  );
}
