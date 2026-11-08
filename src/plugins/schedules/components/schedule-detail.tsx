'use client';

import { useState, useRef, useEffect } from 'react';
import { useToastActions } from '@orcher/workbench-ui';
import { Box, Text, Flex, Badge, Button, Spinner } from '@radix-ui/themes';
import { ReloadIcon, CrossCircledIcon, PlayIcon, StopIcon } from '@radix-ui/react-icons';
import { DetailSkeleton } from '../../../components/loading-skeleton';
import { cronToText } from '../../../utils/cron-text';
import { KebabMenu } from '../../../components/kebab-menu';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { HelpTip } from '../../../components/help-tip';
import {
  useScheduleList,
  useScheduleExecutions,
  apiPauseSchedule,
  apiResumeSchedule,
  apiDeleteSchedule,
  type ScheduleItem,
  type ScheduleExecutionItem,
  type WorkflowListItem,
} from '../../../hooks/use-orcher-api';

function formatTimestamp(ts?: string): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DetailRow({ label, value, mono, help }: { label: string; value: string; mono?: boolean; help?: string }) {
  return (
    <>
      <Flex align="center" gap="1" className="detail-row-label">
        <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>{label}</Text>
        {help && <HelpTip content={help} />}
      </Flex>
      <Text style={{ color: 'var(--gray-12)', fontSize: 12, fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value}
      </Text>
    </>
  );
}

export function ScheduleDetail({ scheduleId, onClose, onSelectWorkflow }: {
  scheduleId: string;
  onClose?: () => void;
  onSelectWorkflow?: (wf: WorkflowListItem) => void;
}) {
  const toast = useToastActions();
  const { schedules, loading, refresh } = useScheduleList();
  const { executions, loading: execLoading } = useScheduleExecutions(scheduleId);
  const schedule = schedules.find((s) => s.id === scheduleId);
  const [actionLoading, setActionLoading] = useState(false);

  const [confirmAction, setConfirmAction] = useState<'pause' | 'resume' | 'delete' | null>(null);

  const executeAction = async () => {
    setActionLoading(true);
    try {
      if (confirmAction === 'pause') { await apiPauseSchedule(scheduleId); refresh(); }
      else if (confirmAction === 'resume') { await apiResumeSchedule(scheduleId); refresh(); }
      else if (confirmAction === 'delete') { await apiDeleteSchedule(scheduleId); onClose?.(); }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!schedule) {
    return (
      <Flex align="center" justify="center" p="6">
        <Text color="gray">Schedule not found</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      {/* Details */}
      <Box style={{ flex: 1, overflow: 'auto' }}>
        <Box p="3">
          <Flex justify="between" align="center" mb="2">
            <Text size="2" weight="medium" style={{ color: 'var(--gray-11)' }}>
              Configuration</Text>
            <Flex gap="3" align="center">
              <Badge size="1" variant="soft" color={schedule.status === 'paused' || !schedule.enabled ? 'orange' : 'green'}>
                {schedule.status === 'paused' || !schedule.enabled ? 'paused' : schedule.status}
              </Badge>
              <Button size="1" variant="ghost" color="gray" onClick={refresh}>
                <ReloadIcon width={12} height={12} />
              </Button>
              <KebabMenu
                disabled={actionLoading}
                items={[
                  ...(schedule.status === 'paused' || !schedule.enabled
                    ? [{ icon: <PlayIcon width={13} height={13} />, label: 'Resume', onClick: () => setConfirmAction('resume') }]
                    : [{ icon: <StopIcon width={13} height={13} />, label: 'Pause', onClick: () => setConfirmAction('pause') }]
                  ),
                  { separator: true },
                  { icon: <CrossCircledIcon width={13} height={13} />, label: 'Delete', onClick: () => setConfirmAction('delete'), danger: true },
                ]}
              />
            </Flex>
          </Flex>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', marginBottom: 16 }}>
            <DetailRow label="Schedule ID" value={schedule.id} mono />
            <DetailRow label="Workflow Type" value={schedule.workflowType || '—'} />
            <DetailRow label="Namespace" value={schedule.namespace || '—'} />
            <DetailRow label="Schedule" value={cronToText(schedule.cronExpression)} />
            <DetailRow label="Cron" value={schedule.cronExpression} mono />
            <DetailRow label="Timezone" value={schedule.timezone} help="Timezone used to evaluate the cron expression. Affects when the schedule fires" />
            <DetailRow label="Max Instances" value={String(schedule.maxInstances ?? 1)} help="Maximum concurrent workflow executions this schedule can have running at once" />
            <DetailRow label="Overlap Policy" value={schedule.overlapPolicy || 'skip'} help="What happens when a new run is due but the previous one is still running. skip = don't start, buffer = queue it, allow = run in parallel" />
          </div>

          <Text size="2" weight="medium" mb="2" style={{ display: 'block', color: 'var(--gray-11)' }}>
            Execution Stats
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', marginBottom: 16 }}>
            <DetailRow label="Total Runs" value={String(schedule.runCount)} />
            <DetailRow label="Successful" value={String(schedule.successCount)} />
            <DetailRow label="Failed" value={String(schedule.failureCount)} />
            <DetailRow label="Success Rate" value={
              schedule.runCount > 0
                ? `${Math.round((schedule.successCount / schedule.runCount) * 100)}%`
                : '—'
            } />
            <DetailRow label="Next Run" value={formatTimestamp(schedule.nextRunAt)} mono />
            <DetailRow label="Last Run" value={formatTimestamp(schedule.lastRunAt)} mono />
          </div>

          <Text size="2" weight="medium" mb="2" style={{ display: 'block', color: 'var(--gray-11)' }}>
            Metadata
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', marginBottom: 16 }}>
            <DetailRow label="Created" value={formatTimestamp(schedule.createdAt)} mono />
            <DetailRow label="Updated" value={formatTimestamp(schedule.updatedAt)} mono />
            {schedule.tags && schedule.tags.length > 0 && (
              <>
                <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>Tags</Text>
                <Flex gap="1" wrap="wrap">
                  {schedule.tags.map((tag) => (
                    <Badge key={tag} size="1" variant="surface" color="gray">{tag}</Badge>
                  ))}
                </Flex>
              </>
            )}
          </div>

          {schedule.description && (
            <>
              <Text size="2" weight="medium" mb="2" style={{ display: 'block', color: 'var(--gray-11)' }}>
                Description
              </Text>
              <Text style={{ fontSize: 12, color: 'var(--gray-10)' }}>
                {schedule.description}
              </Text>
            </>
          )}

          {/* Recent Executions */}
          <Box mt="4">
            <Flex align="center" justify="between" mb="2">
              <Text size="2" weight="medium" style={{ color: 'var(--gray-11)' }}>
                Recent Executions
              </Text>
              <Badge size="1" variant="soft" color="gray">{executions.length}</Badge>
            </Flex>
            {execLoading ? (
              <Flex align="center" justify="center" p="4">
                <Spinner size="1" />
              </Flex>
            ) : executions.length === 0 ? (
              <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>
                No executions yet. The schedule will create workflow runs on its next fire time.
              </Text>
            ) : (
              <Flex direction="column" gap="1">
                {executions.map((exec) => (
                  <Flex
                    key={exec.id}
                    align="center"
                    justify="between"
                    py="2" px="2"
                    style={{
                      cursor: exec.workflowExecutionId ? 'pointer' : 'default',
                      background: 'transparent',
                    }}
                    onClick={() => {
                      if (exec.workflowExecutionId && onSelectWorkflow) {
                        onSelectWorkflow({
                          executionId: exec.workflowExecutionId,
                          workflowId: exec.workflowExecutionId,
                          workflowType: exec.workflowName ?? '',
                          status: exec.workflowStatus ?? '',
                          startedAt: exec.startedAt,
                          completedAt: exec.completedAt,
                          namespace: '',
                          taskQueue: '',
                        });
                      }
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-a2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Flex direction="column" gap="0">
                      <Flex align="center" gap="2">
                        <Text style={{ fontSize: 12, color: 'var(--gray-11)', fontWeight: 500 }}>
                          #{exec.executionNumber}
                        </Text>
                        <Badge size="1" variant="soft" color={
                          exec.status === 'completed' ? 'green'
                          : exec.status === 'failed' ? 'red'
                          : exec.status === 'running' ? 'blue'
                          : exec.status === 'skipped' ? 'orange'
                          : 'gray'
                        }>
                          {exec.status}
                        </Badge>
                        {exec.workflowName && (
                          <Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>
                            {exec.workflowName}
                          </Text>
                        )}
                      </Flex>
                      <Text style={{ fontSize: 10, color: 'var(--gray-8)', fontFamily: 'monospace' }}>
                        {formatTimestamp(exec.scheduledAt)}
                        {exec.durationMs ? ` · ${exec.durationMs}ms` : ''}
                      </Text>
                    </Flex>
                    <Flex direction="column" align="end" gap="0">
                      {exec.workflowStatus && (
                        <Badge size="1" variant="outline" color={
                          exec.workflowStatus === 'completed' ? 'green'
                          : exec.workflowStatus === 'failed' ? 'red'
                          : 'gray'
                        }>
                          {exec.workflowStatus}
                        </Badge>
                      )}
                      {exec.errorMessage && (
                        <Text style={{ fontSize: 10, color: 'var(--red-9)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exec.errorMessage}
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            )}
          </Box>
        </Box>
      </Box>
      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeAction}
        title={
          confirmAction === 'pause' ? 'Pause Schedule'
          : confirmAction === 'resume' ? 'Resume Schedule'
          : 'Delete Schedule'
        }
        message={
          confirmAction === 'pause'
            ? `Are you sure you want to pause "${schedule?.name}"? It will stop firing until resumed.`
          : confirmAction === 'resume'
            ? `Resume "${schedule?.name}"? It will start firing on its next scheduled time.`
          : `Are you sure you want to delete "${schedule?.name}"? This action cannot be undone.`
        }
        confirmLabel={
          confirmAction === 'pause' ? 'Pause'
          : confirmAction === 'resume' ? 'Resume'
          : 'Delete'
        }
        variant={confirmAction === 'delete' ? 'danger' : 'default'}
        loading={actionLoading}
      />
    </Flex>
  );
}
