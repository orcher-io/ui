'use client';

import { useMemo } from 'react';
import { Box, Text, Flex, Badge, Heading, Card, ScrollArea, Spinner } from '@radix-ui/themes';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { useWorkflowList, resolveNamespace, type WorkflowListItem } from '../../../hooks/use-orcher-api';
import { useGlobalNamespace } from '../../../contexts/namespace-context';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

// ============================================================================
// GLOBAL CHART.JS DEFAULTS
// ============================================================================

// Set once — applies to all charts on the page.
ChartJS.defaults.color = '#a1a1aa';
ChartJS.defaults.borderColor = '#27272a';
ChartJS.defaults.font.family = 'system-ui, -apple-system, sans-serif';
ChartJS.defaults.font.size = 11;
ChartJS.defaults.plugins.tooltip.backgroundColor = '#18181b';
ChartJS.defaults.plugins.tooltip.titleColor = '#a1a1aa';
ChartJS.defaults.plugins.tooltip.bodyColor = '#fafafa';
ChartJS.defaults.plugins.tooltip.borderColor = '#3f3f46';
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.cornerRadius = 0;
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.displayColors = true;
ChartJS.defaults.plugins.tooltip.boxPadding = 4;
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.pointStyle = 'circle';
ChartJS.defaults.plugins.legend.labels.boxWidth = 8;
ChartJS.defaults.plugins.legend.labels.boxHeight = 8;
if (ChartJS.defaults.animation) ChartJS.defaults.animation.duration = 800;

// ============================================================================
// STAT CARD
// ============================================================================

function fmt(v: string | number): string {
  if (typeof v === 'number') return v.toLocaleString();
  return v;
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <Card
      style={{
        flex: 1,
        minWidth: 120,
        background: 'var(--gray-2)',
        border: 'none',
        boxShadow: 'inset 0 0 0 0.5px var(--gray-a3)',
        padding: '8px 12px',
      }}
    >
      <Flex direction="column" gap="0">
        <Text style={{ fontSize: 10, color: 'var(--gray-9)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </Text>
        <Text size="5" weight="bold" style={{ lineHeight: 1.2, color: 'var(--gray-12)' }}>
          {fmt(value)}
        </Text>
        {subtitle && <Text style={{ fontSize: 10, color: 'var(--gray-8)', marginTop: 1 }}>{subtitle}</Text>}
      </Flex>
    </Card>
  );
}

// ============================================================================
// DATA HELPERS
// ============================================================================

function computeStats(workflows: WorkflowListItem[]) {
  const total = workflows.length;
  const running = workflows.filter((w) => w.status === 'running' || w.status === 'pending').length;
  const completed = workflows.filter((w) => w.status === 'completed').length;
  const failed = workflows.filter((w) => w.status === 'failed').length;
  const successRate = completed + failed > 0 ? Math.round((completed / (completed + failed)) * 100) : 0;
  const durations = workflows.filter((w) => w.durationMs && w.durationMs > 0).map((w) => w.durationMs!);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  return { total, running, completed, failed, successRate, avgDuration };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function computeStatusDistribution(workflows: WorkflowListItem[]) {
  const counts: Record<string, number> = {};
  for (const w of workflows) {
    const s = w.status === 'cancelled' ? 'canceled' : w.status;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

function computeTimelineData(workflows: WorkflowListItem[]) {
  const buckets: Record<string, { completed: number; failed: number }> = {};
  for (const w of workflows) {
    if (!w.startedAt) continue;
    const t = new Date(w.startedAt);
    const key = `${(t.getMonth() + 1).toString().padStart(2, '0')}/${t.getDate().toString().padStart(2, '0')}`;
    if (!buckets[key]) buckets[key] = { completed: 0, failed: 0 };
    if (w.status === 'completed') buckets[key].completed++;
    else if (w.status === 'failed') buckets[key].failed++;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [time, data]) => {
      acc.labels.push(time);
      acc.completed.push(data.completed);
      acc.failed.push(data.failed);
      return acc;
    }, { labels: [] as string[], completed: [] as number[], failed: [] as number[] });
}

function computeWorkflowTypeDist(workflows: WorkflowListItem[]) {
  const counts: Record<string, number> = {};
  for (const w of workflows) {
    const type = w.workflowType || 'unknown';
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
}

function getRecentFailures(workflows: WorkflowListItem[]) {
  return workflows
    .filter((w) => w.status === 'failed')
    .sort((a, b) => (new Date(b.startedAt ?? 0).getTime()) - (new Date(a.startedAt ?? 0).getTime()))
    .slice(0, 5);
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WorkflowsOverview() {
  const { globalNamespace } = useGlobalNamespace();
  const { workflows, loading, error } = useWorkflowList(
    resolveNamespace('all', globalNamespace),
  );

  const stats = useMemo(() => computeStats(workflows), [workflows]);
  const statusDist = useMemo(() => computeStatusDistribution(workflows), [workflows]);
  const timeline = useMemo(() => computeTimelineData(workflows), [workflows]);
  const typeDist = useMemo(() => computeWorkflowTypeDist(workflows), [workflows]);
  const recentFailures = useMemo(() => getRecentFailures(workflows), [workflows]);

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Spinner size="3" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Text color="red">{error}</Text>
      </Flex>
    );
  }

  // ---- Chart.js data objects ----

  const lineData = {
    labels: timeline.labels,
    datasets: [
      {
        label: 'Completed',
        data: timeline.completed,
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.08)',
        fill: true,
        tension: 0.4,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHitRadius: 10,
        pointHoverRadius: 3,
        pointHoverBackgroundColor: '#60a5fa',
        pointHoverBorderColor: '#18181b',
        pointHoverBorderWidth: 2,
      },
      {
        label: 'Failed',
        data: timeline.failed,
        borderColor: '#71717a',
        backgroundColor: 'rgba(113, 113, 122, 0.04)',
        fill: true,
        tension: 0.4,
        borderWidth: 1,
        pointRadius: 0,
        pointHitRadius: 10,
        pointHoverRadius: 3,
        pointHoverBackgroundColor: '#71717a',
        pointHoverBorderColor: '#18181b',
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { maxRotation: 0, color: '#3f3f46', font: { size: 10 }, maxTicksLimit: 8 },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        ticks: { color: '#3f3f46', font: { size: 10 }, precision: 0 },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { position: 'bottom' as const },
    },
  };

  const statusLabels = Object.keys(statusDist).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  const statusValues = Object.values(statusDist);
  const statusColors = ['#e4e4e7', '#a1a1aa', '#71717a', '#52525b', '#3f3f46'];

  const doughnutData = {
    labels: statusLabels,
    datasets: [
      {
        data: statusValues,
        backgroundColor: statusColors.slice(0, statusLabels.length),
        borderWidth: 0,
        hoverBorderWidth: 2,
        hoverBorderColor: '#fafafa',
        hoverOffset: 4,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    interaction: {
      mode: 'nearest' as const,
      intersect: true,
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  const typeLabels = typeDist.map(([name]) => name);
  const typeValues = typeDist.map(([, count]) => count);

  const barData = {
    labels: typeLabels,
    datasets: [
      {
        label: 'Executions',
        data: typeValues,
        backgroundColor: '#a1a1aa',
        borderRadius: 0,
        borderSkipped: false,
        maxBarThickness: 24,
        hoverBackgroundColor: '#d4d4d8',
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    scales: {
      x: {
        grid: { color: '#27272a' },
        ticks: { precision: 0 },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  return (
    <ScrollArea style={{ height: '100%' }}>
      <Box p="4" style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <Flex align="center" justify="between" mb="4">
          <Heading size="5">Workflow Overview <Text size="1" color="gray">(Chart.js)</Text></Heading>
          <Badge variant="soft" color="gray">{stats.total} total</Badge>
        </Flex>

        {/* KPI Cards */}
        <Flex gap="3" mb="5" wrap="wrap">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Running" value={stats.running} subtitle="Active now" />
          <StatCard label="Completed" value={stats.completed} />
          <StatCard label="Failed" value={stats.failed} />
          <StatCard label="Success Rate" value={`${stats.successRate}%`} subtitle={`${stats.completed} of ${stats.completed + stats.failed}`} />
          <StatCard label="Avg Duration" value={formatDuration(stats.avgDuration)} />
        </Flex>

        {/* Charts Row */}
        <Flex gap="4" mb="5" wrap="wrap">
          {/* Executions Over Time */}
          <Card style={{ flex: 2, minWidth: 400, background: 'var(--gray-2)', border: 'none', boxShadow: 'inset 0 0 0 0.5px var(--gray-a3)' }}>
            <Box p="3">
              <Text size="2" weight="medium" mb="3" style={{ display: 'block' }}>
                Executions Over Time
              </Text>
              <Box style={{ height: 220, position: 'relative' }}>
                <Line data={lineData} options={lineOptions} />
              </Box>
            </Box>
          </Card>

          {/* Status Distribution — Doughnut */}
          <Card style={{ flex: 1, minWidth: 260, background: 'var(--gray-2)', border: 'none', boxShadow: 'inset 0 0 0 0.5px var(--gray-a3)' }}>
            <Box p="3">
              <Text size="2" weight="medium" mb="3" style={{ display: 'block' }}>
                Status Distribution
              </Text>
              <Box style={{ height: 220, position: 'relative' }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </Box>
            </Box>
          </Card>
        </Flex>

        {/* Bottom Row */}
        <Flex gap="4" wrap="wrap">
          {/* Workflow Types — Horizontal Bar */}
          <Card style={{ flex: 1, minWidth: 350, background: 'var(--gray-2)', border: 'none', boxShadow: 'inset 0 0 0 0.5px var(--gray-a3)' }}>
            <Box p="3">
              <Flex align="center" justify="between" mb="3">
                <Text size="2" weight="medium">Workflow Types</Text>
                <Badge variant="soft" color="gray">{typeDist.length}</Badge>
              </Flex>
              <Box style={{ maxHeight: 280, overflowY: 'auto' }}>
                <Box style={{ height: Math.max(120, typeDist.length * 28), position: 'relative' }}>
                  <Bar data={barData} options={barOptions} />
                </Box>
              </Box>
            </Box>
          </Card>

          {/* Recent Failures */}
          <Card style={{ flex: 1, minWidth: 350, background: 'var(--gray-2)', border: 'none', boxShadow: 'inset 0 0 0 0.5px var(--gray-a3)' }}>
            <Box p="3">
              <Flex align="center" justify="between" mb="3">
                <Text size="2" weight="medium">Recent Failures</Text>
                <Badge variant="soft" color="gray">{stats.failed}</Badge>
              </Flex>
              {recentFailures.length === 0 ? (
                <Flex align="center" justify="center" py="6">
                  <Text size="2" color="gray">No recent failures</Text>
                </Flex>
              ) : (
                <Flex direction="column" gap="2">
                  {recentFailures.map((wf) => (
                    <Flex
                      key={wf.executionId}
                      align="center"
                      justify="between"
                      py="2"
                      px="2"
                      style={{
                        borderRadius: 0,
                        border: 'none',
                        boxShadow: 'inset 0 0 0 0.5px var(--gray-a3)',
                        background: 'var(--gray-1)',
                      }}
                    >
                      <Flex direction="column" gap="1">
                        <Text size="2" weight="medium" style={{ color: 'var(--gray-12)' }}>
                          {wf.workflowType}
                        </Text>
                        <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>
                          {wf.executionId.slice(0, 12)}...
                        </Text>
                      </Flex>
                      <Text size="1" color="gray">{timeAgo(wf.startedAt)}</Text>
                    </Flex>
                  ))}
                </Flex>
              )}
            </Box>
          </Card>
        </Flex>
      </Box>
    </ScrollArea>
  );
}
