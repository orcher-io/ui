'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Text, Flex, Spinner } from '@radix-ui/themes';
import { useTheme } from '@orcher/workbench-ui';
import dagre from 'dagre';
import type { JournalEntry } from '../../../hooks/use-orcher-api';

// ============================================================================
// Theme & Constants
// ============================================================================

// Monochrome dark theme — black/white/gray nodes with small status accents.
// React Flow nodes render outside Radix Theme so hardcoded values are required.
const STATUS_DARK = {
  completed: {
    bg: '#141414',
    border: '#303030',
    text: '#e5e5e5',
    badge: '#1a1a1a',
    accent: '#22c55e',
    icon: '✓',
  },
  failed: {
    bg: '#141414',
    border: '#303030',
    text: '#e5e5e5',
    badge: '#1a1a1a',
    accent: '#ef4444',
    icon: '✗',
  },
  running: {
    bg: '#141414',
    border: '#404040',
    text: '#ffffff',
    badge: '#1a1a1a',
    accent: '#ffffff',
    icon: '●',
  },
  pending: {
    bg: '#111111',
    border: '#252525',
    text: '#737373',
    badge: '#171717',
    accent: '#525252',
    icon: '○',
  },
};

const STATUS_LIGHT = {
  completed: {
    bg: '#ffffff',
    border: '#e0e0e0',
    text: '#1a1a1a',
    badge: '#f5f5f5',
    accent: '#16a34a',
    icon: '✓',
  },
  failed: {
    bg: '#ffffff',
    border: '#e0e0e0',
    text: '#1a1a1a',
    badge: '#f5f5f5',
    accent: '#dc2626',
    icon: '✗',
  },
  running: {
    bg: '#ffffff',
    border: '#d0d0d0',
    text: '#0a0a0a',
    badge: '#f5f5f5',
    accent: '#0a0a0a',
    icon: '●',
  },
  pending: {
    bg: '#fafafa',
    border: '#e5e5e5',
    text: '#a3a3a3',
    badge: '#f0f0f0',
    accent: '#a3a3a3',
    icon: '○',
  },
};

type StatusKey = 'completed' | 'failed' | 'running' | 'pending';

// Used inside node components (which can't use hooks — rendered by React Flow)
// Falls back to DOM inspection since React Flow nodes are outside the React tree
function getStatusColors(): typeof STATUS_DARK {
  if (typeof window === 'undefined') return STATUS_DARK;
  const el = document.querySelector('.radix-themes');
  if (el?.classList.contains('light')) return STATUS_LIGHT;
  const stored = localStorage.getItem('workbench-theme');
  if (stored === 'light') return STATUS_LIGHT;
  return STATUS_DARK;
}

const NODE_WIDTH = 220;
const TASK_NODE_HEIGHT = 64;
const TERMINAL_NODE_HEIGHT = 40;

function formatMs(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ============================================================================
// Custom Nodes
// ============================================================================

function TaskNode({ data, selected }: NodeProps) {
  const s = getStatusColors()[(data.status as StatusKey) ?? 'pending'];

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 0,
        border: 'none',
        background: s.bg,
        width: NODE_WIDTH,
        boxShadow: selected
          ? `inset 0 0 0 1px ${s.border}, 0 0 0 2px ${s.border}`
          : `inset 0 0 0 0.5px ${s.border}`,
        transition: 'box-shadow 0.2s, transform 0.15s',
        cursor: 'pointer',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 6,
          height: 6,
          background: s.border,
          border: 'none',
          top: -4,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Status dot — only color accent in the node */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: s.accent,
            flexShrink: 0,
            marginTop: 6,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Task name */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: s.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.3,
            }}
          >
            {data.label as string}
          </div>

          {/* Meta row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 4,
            }}
          >
            {Boolean(data.duration) && (
              <span
                style={{
                  fontSize: 11,
                  color: s.accent,
                  fontFamily: 'monospace',
                  opacity: 0.7,
                }}
              >
                {data.duration as string}
              </span>
            )}
            <span
              style={{
                fontSize: 10,
                color: s.accent,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                opacity: 0.5,
              }}
            >
              {(data.status as string) ?? 'pending'}
            </span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 6,
          height: 6,
          background: s.border,
          border: 'none',
          bottom: -5,
        }}
      />
    </div>
  );
}

function TerminalNode({ data }: NodeProps) {
  const s = getStatusColors()[(data.status as StatusKey) ?? 'pending'];
  const isStart = data.isStart as boolean;

  return (
    <div
      style={{
        padding: '8px 24px',
        borderRadius: 0,
        border: 'none',
        background: s.bg,
        boxShadow: `inset 0 0 0 0.5px ${s.border}`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        minWidth: 140,
      }}
    >
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            width: 8,
            height: 8,
            background: s.border,
            border: `2px solid ${s.bg}`,
            top: -5,
          }}
        />
      )}

      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: s.text,
          letterSpacing: '0.3px',
        }}
      >
        {data.label as string}
      </div>

      {!data.isEnd && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            width: 8,
            height: 8,
            background: s.border,
            border: `2px solid ${s.bg}`,
            bottom: -5,
          }}
        />
      )}
    </div>
  );
}

const nodeTypes = {
  task: TaskNode,
  terminal: TerminalNode,
};

// ============================================================================
// Dagre Layout
// ============================================================================

function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 50,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    const height = node.type === 'terminal' ? TERMINAL_NODE_HEIGHT : TASK_NODE_HEIGHT;
    g.setNode(node.id, { width: NODE_WIDTH, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - (node.type === 'terminal' ? TERMINAL_NODE_HEIGHT : TASK_NODE_HEIGHT) / 2,
      },
    };
  });
}

// ============================================================================
// Graph Builder
// ============================================================================

function buildFlowGraph(entries: JournalEntry[], dark = true): { nodes: Node[]; edges: Edge[] } {
  const edgeColor = dark ? '#303030' : '#d0d0d0';
  const edgeActiveColor = dark ? '#e5e5e5' : '#333333';
  const rawNodes: Node[] = [];
  const edges: Edge[] = [];
  const taskStatus = new Map<string, { status: string; durationMs?: number }>();

  for (const entry of entries) {
    const p = entry.payload;
    const taskId = (p.taskId ?? p.task_id ?? '') as string;
    if (!taskId) continue;

    if (entry.eventType.includes('TaskCompleted') || entry.eventType.includes('Taskcompleted')) {
      taskStatus.set(taskId, {
        status: 'completed',
        durationMs: Number(p.durationMs ?? p.duration_ms ?? 0),
      });
    } else if (entry.eventType.includes('TaskFailed') || entry.eventType.includes('Taskfailed')) {
      taskStatus.set(taskId, { status: 'failed' });
    } else if (entry.eventType.includes('TaskStarted') || entry.eventType.includes('Taskstarted')) {
      if (!taskStatus.has(taskId)) taskStatus.set(taskId, { status: 'running' });
    }
  }

  const hasCompleted = entries.some(
    (e) => e.eventType.includes('WorkflowExecutionCompleted') || e.eventType.includes('Workflowexecutioncompleted'),
  );
  const hasFailed = entries.some(
    (e) => e.eventType.includes('WorkflowExecutionFailed') || e.eventType.includes('Workflowexecutionfailed'),
  );

  // Start node
  rawNodes.push({
    id: '__start',
    type: 'terminal',
    position: { x: 0, y: 0 },
    data: { label: 'Workflow Started', status: 'completed', isStart: true },
  });

  // Task nodes
  const seenTasks = new Set<string>();
  let prevId = '__start';

  for (const entry of entries) {
    const p = entry.payload;
    const taskId = (p.taskId ?? p.task_id ?? '') as string;
    const taskType = (p.taskType ?? p.task_type ?? '') as string;
    if (!taskId || seenTasks.has(taskId)) continue;
    if (!entry.eventType.includes('TaskScheduled') && !entry.eventType.includes('Taskscheduled')) continue;

    seenTasks.add(taskId);
    const info = taskStatus.get(taskId);
    const status = info?.status ?? 'pending';

    rawNodes.push({
      id: taskId,
      type: 'task',
      position: { x: 0, y: 0 },
      data: {
        label: taskType || taskId,
        status,
        duration: formatMs(info?.durationMs),
      },
    });

    edges.push({
      id: `e-${prevId}-${taskId}`,
      source: prevId,
      target: taskId,
      type: 'smoothstep',
      animated: status === 'running',
      style: {
        stroke: status === 'running' ? edgeActiveColor : edgeColor,
        strokeWidth: 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: status === 'running' ? edgeActiveColor : edgeColor,
      },
    });

    prevId = taskId;
  }

  // End node
  const endStatus = hasCompleted ? 'completed' : hasFailed ? 'failed' : 'pending';
  const endLabel = hasCompleted ? 'Completed' : hasFailed ? 'Failed' : 'In Progress';

  rawNodes.push({
    id: '__end',
    type: 'terminal',
    position: { x: 0, y: 0 },
    data: { label: endLabel, status: endStatus, isEnd: true },
  });

  edges.push({
    id: `e-${prevId}-__end`,
    source: prevId,
    target: '__end',
    type: 'smoothstep',
    style: { stroke: edgeColor, strokeWidth: 1.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: edgeColor,
    },
  });

  // Apply dagre layout
  const nodes = layoutWithDagre(rawNodes, edges);

  return { nodes, edges };
}

// ============================================================================
// Component
// ============================================================================

interface GraphSectionProps {
  entries: JournalEntry[];
  loading: boolean;
}

export function GraphSection({ entries, loading }: GraphSectionProps) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const { nodes, edges } = useMemo(() => buildFlowGraph(entries, isDark), [entries, isDark]);

  if (loading) {
    return (
      <Flex justify="center" align="center" p="6" style={{ height: '100%' }}>
        <Spinner size="2" />
        <Text size="2" color="gray" ml="2">Loading graph...</Text>
      </Flex>
    );
  }

  if (nodes.length <= 2) {
    return (
      <Flex justify="center" align="center" p="6" style={{ height: '100%' }}>
        <Text size="2" color="gray">No tasks to display</Text>
      </Flex>
    );
  }

  return (
    <Box style={{ height: '100%', minHeight: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.4, maxZoom: 1.2 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
        style={{ background: isDark ? '#0a0a0a' : '#f8f8f8' }}
      >
        <Background color={isDark ? '#1a1a1a' : '#e8e8e8'} gap={24} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          nodeColor={(node) => {
            const status = (node.data?.status as StatusKey) ?? 'pending';
            return getStatusColors()[status]?.border ?? (isDark ? '#404040' : '#d0d0d0');
          }}
          maskColor={isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'}
          position="bottom-right"
        />
      </ReactFlow>
    </Box>
  );
}
