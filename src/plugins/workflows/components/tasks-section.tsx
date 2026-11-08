'use client';

import { useState, Fragment } from 'react';
import {
  Box,
  Text,
  Flex,
  Badge,
  Table,
} from '@radix-ui/themes';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import type { JournalEntry } from '../../../hooks/use-orcher-api';
import { journaledTaskResult, stepResult } from './task-result';

interface TaskInfo {
  taskId: string;
  taskType: string;
  status: 'scheduled' | 'started' | 'completed' | 'failed';
  taskQueue?: string;
  input?: Record<string, unknown>;
  result?: string;
  error?: string;
  durationMs?: number;
  attempt?: number;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
}

const STATUS_COLORS: Record<string, 'green' | 'red' | 'blue' | 'gray'> = {
  scheduled: 'gray',
  started: 'blue',
  completed: 'green',
  failed: 'red',
};

/** Group journal entries into task lifecycle objects */
function groupTasksFromJournal(entries: JournalEntry[]): TaskInfo[] {
  const tasks = new Map<string, TaskInfo>();

  for (const entry of entries) {
    const p = entry.payload;

    if (entry.eventType.includes('StepCompleted')) {
      const step = stepResult(p);
      const task = step && tasks.get(step.taskId);
      if (step && task) task.result = step.result;
      continue;
    }

    const taskId = (p.taskId ?? p.task_id ?? '') as string;
    if (!taskId) continue;

    if (entry.eventType.includes('TaskScheduled') || entry.eventType.includes('Taskscheduled')) {
      tasks.set(taskId, {
        taskId,
        taskType: (p.taskType ?? p.task_type ?? '') as string,
        status: 'scheduled',
        taskQueue: (p.input as any)?.task_queue ?? (p.taskQueue ?? '') as string,
        input: p.input as Record<string, unknown>,
        scheduledAt: entry.timestamp,
      });
    } else if (entry.eventType.includes('TaskStarted') || entry.eventType.includes('Taskstarted')) {
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'started';
        task.startedAt = entry.timestamp;
      }
    } else if (entry.eventType.includes('TaskCompleted') || entry.eventType.includes('Taskcompleted')) {
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'completed';
        task.completedAt = (p.completedAt ?? p.completed_at ?? entry.timestamp) as string;
        task.durationMs = Number(p.durationMs ?? p.duration_ms ?? 0);
        task.attempt = Number(p.executionAttempt ?? p.execution_attempt ?? 1);
        task.result = journaledTaskResult(p) ?? task.result;
      }
    } else if (entry.eventType.includes('TaskFailed') || entry.eventType.includes('Taskfailed')) {
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.error = (p.message ?? p.error ?? '') as string;
        task.attempt = Number(p.executionAttempt ?? p.execution_attempt ?? 1);
      }
    }
  }

  return Array.from(tasks.values());
}

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface TasksSectionProps {
  entries: JournalEntry[];
}

export function TasksSection({ entries }: TasksSectionProps) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const tasks = groupTasksFromJournal(entries);

  if (tasks.length === 0) {
    return (
      <Text size="2" color="gray">
        No tasks found in journal
      </Text>
    );
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;
  const runningCount = tasks.filter((t) => t.status === 'started').length;

  return (
    <Flex direction="column" gap="2">
      <Flex gap="2" align="center">
        <Text weight="medium">
          Tasks ({tasks.length})
        </Text>
        {completedCount > 0 && (
          <Badge color="green" size="1" variant="soft">
            {completedCount} completed
          </Badge>
        )}
        {failedCount > 0 && (
          <Badge color="red" size="1" variant="soft">
            {failedCount} failed
          </Badge>
        )}
        {runningCount > 0 && (
          <Badge color="blue" size="1" variant="soft">
            {runningCount} running
          </Badge>
        )}
      </Flex>

      <Table.Root variant="surface" size="1" className="orcher-compact-table">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell style={{ width: 30 }} />
            <Table.ColumnHeaderCell>Task</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Duration</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Attempt</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Queue</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {tasks.map((task) => {
            const isExpanded = expandedTask === task.taskId;

            return (
              <Fragment key={task.taskId}>
                <Table.Row
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    setExpandedTask(isExpanded ? null : task.taskId)
                  }
                >
                  <Table.Cell>
                    {isExpanded ? (
                      <ChevronDownIcon width={14} height={14} />
                    ) : (
                      <ChevronRightIcon width={14} height={14} />
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Text weight="medium">
                      {task.taskType || task.taskId}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      color={STATUS_COLORS[task.status] ?? 'gray'}
                      size="1"
                      variant="soft"
                    >
                      {task.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text color="gray" style={{ fontSize: 'inherit' }}>
                      {formatDuration(task.durationMs)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text color="gray" style={{ fontSize: 'inherit' }}>
                      {task.attempt ?? '—'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text color="gray" style={{ fontSize: 'inherit' }}>
                      {task.taskQueue || '—'}
                    </Text>
                  </Table.Cell>
                </Table.Row>

                {isExpanded && (
                  <Table.Row key={`${task.taskId}-detail`}>
                    <Table.Cell colSpan={6}>
                      <div style={{ padding: '8px 0', display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '4px 16px', fontSize: 12 }}>
                        <Text style={{ color: 'var(--gray-8)' }}>Task ID</Text>
                        <Text style={{ color: 'var(--gray-12)', fontFamily: 'monospace' }}>{task.taskId}</Text>
                        <Text style={{ color: 'var(--gray-8)' }}>Type</Text>
                        <Text style={{ color: 'var(--gray-12)' }}>{task.taskType}</Text>

                        {task.scheduledAt && (
                          <>
                            <Text style={{ color: 'var(--gray-8)' }}>Scheduled</Text>
                            <Text style={{ color: 'var(--gray-12)', fontFamily: 'monospace' }}>{task.scheduledAt}</Text>
                          </>
                        )}

                        {task.completedAt && (
                          <>
                            <Text style={{ color: 'var(--gray-8)' }}>Completed</Text>
                            <Text style={{ color: 'var(--gray-12)', fontFamily: 'monospace' }}>{task.completedAt}</Text>
                          </>
                        )}

                        {task.result && (
                          <>
                            <Text style={{ color: 'var(--gray-8)' }}>Result</Text>
                            <Text style={{ color: 'var(--gray-12)', fontFamily: 'monospace', gridColumn: '2 / -1', maxHeight: 80, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {task.result}
                            </Text>
                          </>
                        )}

                        {task.error && (
                          <>
                            <Text style={{ color: 'var(--red-9)' }}>Error</Text>
                            <Text style={{ color: 'var(--red-9)', gridColumn: '2 / -1' }}>{task.error}</Text>
                          </>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Fragment>
            );
          })}
        </Table.Body>
      </Table.Root>
    </Flex>
  );
}
