"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Box,
  Text,
  Flex,
  Badge,
  Spinner,
  ScrollArea,
  Heading,
  Button,
} from "@radix-ui/themes";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ReloadIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import {
  useWorkflowList,
  useJournal,
  useNamespaceList,
  type WorkflowListItem,
  type JournalEntry,
} from "../../../hooks/use-orcher-api";
import { SearchableSelect } from "../../../components/searchable-select";
import { useGlobalNamespace } from "../../../contexts/namespace-context";
import { resolveNamespace } from "../../../hooks/use-orcher-api";
import { journaledTaskResult, stepResult } from "./task-result";

// ============================================================================
// Types & Constants
// ============================================================================

type ViewMode = "hour" | "day" | "week" | "month";

const ROW_HEIGHT = 34;
const INDENT = 20;
const LABEL_WIDTH = 256;
const TASK_BAR_H = 14;
const WF_BAR_H = 18;
const TICK_COUNT = 6;

// ============================================================================
// Period helpers — for filtering which workflows to show
// ============================================================================

function getPeriod(date: Date, mode: ViewMode): { start: number; end: number } {
  const d = new Date(date);
  if (mode === "hour") {
    d.setMinutes(0, 0, 0);
    return { start: d.getTime(), end: d.getTime() + 3_600_000 };
  }
  if (mode === "day") {
    d.setHours(0, 0, 0, 0);
    return { start: d.getTime(), end: d.getTime() + 86_400_000 };
  }
  if (mode === "week") {
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - diff);
    return { start: d.getTime(), end: d.getTime() + 604_800_000 };
  }
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  const start = d.getTime();
  d.setMonth(d.getMonth() + 1);
  return { start, end: d.getTime() };
}

function shiftPeriod(date: Date, mode: ViewMode, dir: -1 | 1): Date {
  const d = new Date(date);
  if (mode === "hour") d.setHours(d.getHours() + dir);
  else if (mode === "day") d.setDate(d.getDate() + dir);
  else if (mode === "week") d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  return d;
}

function formatPeriodLabel(date: Date, mode: ViewMode): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const pad = (n: number) => n.toString().padStart(2, "0");

  if (mode === "hour")
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} — ${pad(date.getHours())}:00`;
  if (mode === "day")
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  if (mode === "week") {
    const { start, end } = getPeriod(date, "week");
    const s = new Date(start);
    const e = new Date(end - 1);
    return `${months[s.getMonth()]} ${s.getDate()} — ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDur(ms: number): string {
  if (ms <= 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ============================================================================
// Task parsing
// ============================================================================

interface TaskNode {
  id: string;
  label: string;
  status: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  taskQueue?: string;
  attempt?: number;
  input?: string;
  result?: string;
  error?: string;
  scheduledAt?: string;
  completedAt?: string;
}

function parseTasks(entries: JournalEntry[]): TaskNode[] {
  const tasks: TaskNode[] = [];
  const map = new Map<string, TaskNode>();

  for (const e of entries) {
    const p = e.payload;
    if (e.eventType.includes("StepCompleted")) {
      const step = stepResult(p);
      const n = step && map.get(step.taskId);
      if (step && n) n.result = step.result;
      continue;
    }
    const id = (p.taskId ?? p.task_id ?? "") as string;
    if (!id) continue;
    const ts = new Date(e.timestamp).getTime();

    if (
      e.eventType.includes("TaskScheduled") ||
      e.eventType.includes("Taskscheduled")
    ) {
      map.set(id, {
        id,
        label: (p.taskType ?? p.task_type ?? id) as string,
        status: "scheduled",
        startMs: ts,
        endMs: ts,
        durationMs: 0,
        taskQueue: (p.input as any)?.task_queue ?? "",
        input: (p.input as any)?.input ?? "",
        scheduledAt: e.timestamp,
      });
      tasks.push(map.get(id)!);
    } else if (
      e.eventType.includes("TaskStarted") ||
      e.eventType.includes("Taskstarted")
    ) {
      const n = map.get(id);
      if (n) {
        n.status = "started";
        n.startMs = Math.min(n.startMs, ts);
      }
    } else if (
      e.eventType.includes("TaskCompleted") ||
      e.eventType.includes("Taskcompleted")
    ) {
      const n = map.get(id);
      if (n) {
        n.status = "completed";
        const ca = (p.completed_at ?? p.completedAt ?? e.timestamp) as string;
        n.endMs = new Date(ca).getTime();
        n.durationMs =
          Number(p.durationMs ?? p.duration_ms ?? 0) || n.endMs - n.startMs;
        if (n.endMs <= n.startMs)
          n.endMs = n.startMs + Math.max(n.durationMs, 10);
        n.attempt = Number(p.executionAttempt ?? p.execution_attempt ?? 1);
        n.result = journaledTaskResult(p) ?? n.result;
        n.completedAt = ca;
      }
    } else if (
      e.eventType.includes("TaskFailed") ||
      e.eventType.includes("Taskfailed")
    ) {
      const n = map.get(id);
      if (n) {
        n.status = "failed";
        n.endMs = ts;
        n.durationMs = ts - n.startMs;
        if (n.endMs <= n.startMs) n.endMs = n.startMs + 10;
        n.error = (p.message ?? p.error ?? "") as string;
        n.attempt = Number(p.executionAttempt ?? p.execution_attempt ?? 1);
      }
    }
  }
  return tasks;
}

// ============================================================================
// Grid lines
// ============================================================================

function GridLines() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: TICK_COUNT - 1 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${((i + 1) / TICK_COUNT) * 100}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: "var(--gray-a2)",
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Per-workflow ruler (shows ticks relative to workflow duration)
// ============================================================================

function WorkflowRuler({ span }: { span: number }) {
  const ticks = useMemo(() => {
    return Array.from({ length: TICK_COUNT + 1 }, (_, i) => ({
      pct: (i / TICK_COUNT) * 100,
      label: formatDur((span * i) / TICK_COUNT),
    }));
  }, [span]);

  return (
    <>
      {ticks.map((t, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${t.pct}%`,
            transform:
              i === 0
                ? "translateX(2px)"
                : i === TICK_COUNT
                  ? "translateX(calc(-100% - 2px))"
                  : "translateX(-50%)",
            bottom: 2,
            fontSize: 8,
            color: "var(--gray-6)",
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {t.label}
        </span>
      ))}
    </>
  );
}

// ============================================================================
// Workflow row — bars use per-workflow relative scale
// ============================================================================

function WorkflowRow({
  workflow,
  onSelect,
}: {
  workflow: WorkflowListItem;
  onSelect?: (wf: WorkflowListItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  const { entries } = useJournal(
    expanded ? workflow.executionId : "",
    expanded ? workflow.executionId : "",
  );

  const wfStart = workflow.startedAt
    ? new Date(workflow.startedAt).getTime()
    : Date.now();
  const wfEnd = workflow.completedAt
    ? new Date(workflow.completedAt).getTime()
    : wfStart + Math.max(workflow.durationMs ?? 1000, 100);
  const wfSpan = Math.max(wfEnd - wfStart, 1);

  const tasks = useMemo(() => {
    if (!expanded || !entries.length) return [];
    return parseTasks(entries);
  }, [expanded, entries]);

  const startTime = workflow.startedAt
    ? formatTime(new Date(workflow.startedAt))
    : "";

  return (
    <>
      {/* Workflow row */}
      <div
        onMouseEnter={() => setHoverRow("wf")}
        onMouseLeave={() => setHoverRow(null)}
        style={{
          display: "flex",
          height: ROW_HEIGHT,
          borderBottom: "1px solid var(--gray-a2)",
          background: hoverRow === "wf" ? "var(--gray-a2)" : "transparent",
        }}
      >
        {/* Label */}
        <div
          style={{
            width: LABEL_WIDTH,
            minWidth: LABEL_WIDTH,
            display: "flex",
            alignItems: "center",
            gap: 4,
            paddingLeft: 6,
            paddingRight: 6,
            overflow: "hidden",
          }}
        >
          <div
            onClick={() => setExpanded(!expanded)}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexShrink: 0,
            }}
          >
            <Badge
              size="1"
              variant="surface"
              color="gray"
              style={{
                fontSize: 8,
                minWidth: 14,
                textAlign: "center",
                padding: "0 3px",
              }}
            >
              {tasks.length || "…"}
            </Badge>
            {expanded ? (
              <ChevronDownIcon
                width={11}
                height={11}
                style={{ color: "var(--gray-9)" }}
              />
            ) : (
              <ChevronRightIcon
                width={11}
                height={11}
                style={{ color: "var(--gray-9)" }}
              />
            )}
          </div>
          <span
            onClick={() => onSelect?.(workflow)}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--gray-12)",
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {workflow.workflowType || workflow.executionId.slice(0, 14)}
          </span>
        </div>

        {/* Bar area — workflow spans full width (defines its own scale) */}
        <div
          style={{
            flex: 1,
            position: "relative",
            borderLeft: "1px solid var(--gray-a3)",
          }}
        >
          <GridLines />
          {/* Full-width workflow bar */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: (ROW_HEIGHT - WF_BAR_H) / 2,
              height: WF_BAR_H,
              background: hoverRow === "wf" ? "var(--gray-8)" : "var(--gray-7)",
              borderRadius: 0,
              transition: "background 0.12s",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 6px",
            }}
          >
            <span
              style={{
                fontSize: 8,
                color: "var(--gray-12)",
                fontFamily: "monospace",
                opacity: 0.7,
              }}
            >
              {startTime}
            </span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 600,
                color: "var(--gray-12)",
                whiteSpace: "nowrap",
                opacity: 0.9,
              }}
            >
              {formatDur(wfSpan)}
            </span>
            <span
              style={{
                fontSize: 8,
                color: "var(--gray-12)",
                fontFamily: "monospace",
                opacity: 0.7,
              }}
            >
              {workflow.completedAt ? formatTime(new Date(workflow.completedAt)) : "running"}
            </span>
          </div>
        </div>
      </div>

      {/* Task rows — bars positioned relative to workflow start/end */}
      {expanded && (
        <>
          {tasks.map((task, idx) => {
            const isLast = idx === tasks.length - 1;
            const tEnd =
              task.endMs > task.startMs
                ? task.endMs
                : task.startMs + Math.max(task.durationMs, 10);
            const left = Math.max(0, ((task.startMs - wfStart) / wfSpan) * 100);
            const width = Math.max(
              0.8,
              Math.min(((tEnd - task.startMs) / wfSpan) * 100, 100 - left),
            );
            const isHover = hoverRow === task.id;

            const isExpanded = expandedTask === task.id;

            return (
              <div key={task.id}>
                <div
                  onMouseEnter={() => setHoverRow(task.id)}
                  onMouseLeave={() => setHoverRow(null)}
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  style={{
                    display: "flex",
                    height: ROW_HEIGHT,
                    borderBottom: isExpanded ? "none" : "1px solid var(--gray-a2)",
                    background: isExpanded ? "var(--gray-a3)" : isHover ? "var(--gray-a2)" : "transparent",
                    position: "relative",
                    cursor: "pointer",
                  }}
                >
                  {/* Tree lines */}
                  <div
                    style={{
                      position: "absolute",
                      left: 16,
                      top: 0,
                      height: isLast && !isExpanded ? ROW_HEIGHT / 2 : ROW_HEIGHT,
                      width: 1,
                      background: "var(--gray-a4)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: 16,
                      top: ROW_HEIGHT / 2,
                      width: INDENT - 4,
                      height: 1,
                      background: "var(--gray-a4)",
                    }}
                  />

                  {/* Label */}
                  <div
                    style={{
                      width: LABEL_WIDTH,
                      minWidth: LABEL_WIDTH,
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 6 + INDENT + 8,
                      paddingRight: 6,
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: isExpanded ? "var(--gray-12)" : "var(--gray-10)",
                        fontWeight: isExpanded ? 500 : 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {task.label}
                    </span>
                  </div>

                  {/* Bar area */}
                  <div
                    style={{
                      flex: 1,
                      position: "relative",
                      borderLeft: "1px solid var(--gray-a3)",
                    }}
                  >
                    <GridLines />
                    <div
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        width: `${width}%`,
                        top: (ROW_HEIGHT - TASK_BAR_H) / 2,
                        height: TASK_BAR_H,
                        background: isExpanded ? "var(--gray-10)" : isHover ? "var(--gray-9)" : "var(--gray-8)",
                        borderRadius: 0,
                        transition: "background 0.12s",
                        minWidth: 4,
                      }}
                      title={`${task.label}: ${task.status} (${formatDur(task.durationMs)})`}
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: `calc(${left + width}% + 4px)`,
                        top: (ROW_HEIGHT - 10) / 2,
                        fontSize: 9,
                        color: "var(--gray-8)",
                        fontFamily: "monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDur(task.durationMs)}
                    </span>
                  </div>
                </div>

                {/* Expanded task detail */}
                {isExpanded && (
                  <div
                    style={{
                      borderBottom: "1px solid var(--gray-a2)",
                      background: "var(--gray-a2)",
                      padding: "8px 12px 8px 54px",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto 1fr",
                      gap: "4px 12px",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--gray-8)" }}>Status</span>
                    <span style={{ color: task.status === "failed" ? "var(--red-9)" : "var(--gray-11)", fontWeight: 500 }}>
                      {task.status}
                    </span>
                    <span style={{ color: "var(--gray-8)" }}>Duration</span>
                    <span style={{ color: "var(--gray-11)", fontFamily: "monospace" }}>
                      {formatDur(task.durationMs)}
                    </span>

                    <span style={{ color: "var(--gray-8)" }}>Task ID</span>
                    <span style={{ color: "var(--gray-11)", fontFamily: "monospace", fontSize: 10 }}>
                      {task.id}
                    </span>
                    <span style={{ color: "var(--gray-8)" }}>Attempt</span>
                    <span style={{ color: "var(--gray-11)" }}>
                      {task.attempt ?? 1}
                    </span>

                    {task.taskQueue && (
                      <>
                        <span style={{ color: "var(--gray-8)" }}>Queue</span>
                        <span style={{ color: "var(--gray-11)" }}>
                          {task.taskQueue}
                        </span>
                      </>
                    )}
                    {task.scheduledAt && (
                      <>
                        <span style={{ color: "var(--gray-8)" }}>Scheduled</span>
                        <span style={{ color: "var(--gray-11)", fontFamily: "monospace", fontSize: 10 }}>
                          {new Date(task.scheduledAt).toLocaleTimeString()}
                        </span>
                      </>
                    )}
                    {task.completedAt && (
                      <>
                        <span style={{ color: "var(--gray-8)" }}>Completed</span>
                        <span style={{ color: "var(--gray-11)", fontFamily: "monospace", fontSize: 10 }}>
                          {new Date(task.completedAt).toLocaleTimeString()}
                        </span>
                      </>
                    )}
                    {task.error && (
                      <>
                        <span style={{ color: "var(--gray-8)" }}>Error</span>
                        <span style={{ color: "var(--red-9)", gridColumn: "2 / -1" }}>
                          {task.error}
                        </span>
                      </>
                    )}
                    {task.result && (
                      <>
                        <span style={{ color: "var(--gray-8)" }}>Result</span>
                        <span style={{ color: "var(--gray-11)", fontFamily: "monospace", fontSize: 10, gridColumn: "2 / -1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>
                          {task.result}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Scale ruler row */}
          <div
            style={{
              display: "flex",
              height: 18,
              borderBottom: "1px solid var(--gray-a3)",
            }}
          >
            <div style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH, paddingLeft: 6, paddingRight: 6 }} />
            <div
              style={{
                flex: 1,
                position: "relative",
                borderLeft: "1px solid var(--gray-a3)",
              }}
            >
              <WorkflowRuler span={wfSpan} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ============================================================================
// View mode buttons
// ============================================================================

function ViewModeButtons({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const modes: { value: ViewMode; label: string }[] = [
    { value: "hour", label: "Hour" },
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ];
  return (
    <Flex gap="1">
      {modes.map((m) => (
        <Button
          key={m.value}
          size="1"
          variant={value === m.value ? "solid" : "soft"}
          color="gray"
          onClick={() => onChange(m.value)}
          style={{ fontSize: 12, padding: "2px 10px" }}
        >
          {m.label}
        </Button>
      ))}
    </Flex>
  );
}

// ============================================================================
// Namespace selector
// ============================================================================

function NamespaceSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { namespaces } = useNamespaceList();
  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      placeholder="All Namespaces"
      searchPlaceholder="Search namespaces..."
      width={160}
      options={[
        { value: "all", label: "All Namespaces" },
        ...namespaces.filter((ns) => ns.status === "active").map((ns) => ({ value: ns.name, label: ns.name })),
      ]}
    />
  );
}

// ============================================================================
// Legend
// ============================================================================

function Legend() {
  return (
    <Flex gap="3" align="center">
      <Flex align="center" gap="1">
        <div
          style={{
            width: 16,
            height: 8,
            background: "var(--gray-7)",
            borderRadius: 0,
          }}
        />
        <Text style={{ fontSize: 10, color: "var(--gray-9)" }}>Workflow</Text>
      </Flex>
      <Flex align="center" gap="1">
        <div
          style={{
            width: 16,
            height: 8,
            background: "var(--gray-8)",
            borderRadius: 0,
          }}
        />
        <Text style={{ fontSize: 10, color: "var(--gray-9)" }}>Task</Text>
      </Flex>
    </Flex>
  );
}

// ============================================================================
// Main
// ============================================================================

interface WorkflowTimelinesProps {
  onSelectWorkflow?: (wf: WorkflowListItem) => void;
}

const STATUS_OPTIONS = [
  "all",
  "completed",
  "running",
  "failed",
  "canceled",
] as const;

export function WorkflowTimelines({
  onSelectWorkflow,
}: WorkflowTimelinesProps) {
  const [namespace, setNamespace] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("hour");
  const [anchorDate, setAnchorDate] = useState<Date | null>(null);
  const { globalNamespace } = useGlobalNamespace();
  const { workflows, loading, error, refresh } = useWorkflowList(
    resolveNamespace(namespace, globalNamespace),
  );

  // Anchor to today by default, or explicit selection
  const currentAnchor = useMemo(() => {
    if (anchorDate) return anchorDate;
    return new Date();
  }, [anchorDate]);

  // Filter workflows by the selected calendar period
  const { periodStart, periodEnd, filtered } = useMemo(() => {
    const { start, end } = getPeriod(currentAnchor, viewMode);
    const visible = workflows
      .filter((wf) => {
        if (!wf.startedAt) return false;
        if (
          statusFilter !== "all" &&
          wf.status !== statusFilter &&
          !(statusFilter === "canceled" && wf.status === "cancelled")
        )
          return false;
        if (search) {
          const q = search.toLowerCase();
          const matches =
            wf.workflowType?.toLowerCase().includes(q) ||
            wf.executionId?.toLowerCase().includes(q) ||
            wf.workflowId?.toLowerCase().includes(q);
          if (!matches) return false;
        }
        const s = new Date(wf.startedAt).getTime();
        const e = wf.completedAt
          ? new Date(wf.completedAt).getTime()
          : s + Math.max(wf.durationMs ?? 0, 100);
        return e >= start && s <= end;
      })
      .sort(
        (a, b) =>
          new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime(),
      );
    return { periodStart: start, periodEnd: end, filtered: visible };
  }, [currentAnchor, viewMode, workflows, statusFilter, search]);

  const navigatePrev = useCallback(
    () => setAnchorDate(shiftPeriod(currentAnchor, viewMode, -1)),
    [currentAnchor, viewMode],
  );
  const navigateNext = useCallback(
    () => setAnchorDate(shiftPeriod(currentAnchor, viewMode, 1)),
    [currentAnchor, viewMode],
  );
  const navigateLatest = useCallback(() => {
    let latest = 0;
    for (const wf of workflows) {
      if (wf.startedAt) {
        const t = new Date(wf.startedAt).getTime();
        if (t > latest) latest = t;
      }
    }
    setAnchorDate(latest > 0 ? new Date(latest) : new Date());
  }, [workflows]);
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setAnchorDate(null);
  }, []);

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ height: "100%" }}>
        <Spinner size="3" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Box p="6" style={{ textAlign: "center" }}>
        <Heading size="4" color="red" mb="2">
          Connection Error
        </Heading>
        <Text size="2" color="gray">
          {error}
        </Text>
        <Box mt="3">
          <Button variant="soft" onClick={refresh}>
            <ReloadIcon /> Retry
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Flex direction="column" style={{ height: "100%" }}>
      {/* Toolbar */}
      <Flex
        p="3"
        gap="3"
        align="center"
        style={{ borderBottom: "1px solid var(--gray-a3)", flexShrink: 0 }}
      >
        <Heading size="3">Timelines</Heading>
        <Legend />
        <Box style={{ flex: 1 }} />
        <ViewModeButtons value={viewMode} onChange={handleViewModeChange} />
        <SearchableSelect
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All Status"
          searchPlaceholder="Search status..."
          width={140}
          options={STATUS_OPTIONS.map((s) => ({
            value: s,
            label: s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1),
          }))}
        />
        <NamespaceSelect value={namespace} onChange={setNamespace} />
        <Button variant="ghost" size="2" onClick={refresh}>
          <ReloadIcon />
        </Button>
      </Flex>

      {/* Navigation */}
      <Flex
        align="center"
        gap="2"
        px="3"
        py="1"
        style={{ borderBottom: "1px solid var(--gray-a3)", flexShrink: 0 }}
      >
        <div style={{ position: "relative", width: 190, flexShrink: 0 }}>
          <MagnifyingGlassIcon
            width={12}
            height={12}
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--gray-8)",
              pointerEvents: "none",
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            style={{
              background: "var(--gray-3)",
              color: "var(--gray-11)",
              border: "none",
              boxShadow: "inset 0 0 0 0.5px var(--gray-a3)",
              borderRadius: 0,
              padding: "4px 8px 4px 24px",
              fontSize: 12,
              outline: "none",
              width: "100%",
            }}
          />
        </div>
        <Box style={{ width: 36, flexShrink: 0 }} />
        <Button size="1" variant="ghost" color="gray" onClick={navigatePrev}>
          <ChevronLeftIcon width={14} height={14} />
        </Button>
        <Box style={{ width: 1, flexShrink: 0 }} />
        <Button
          size="1"
          variant="soft"
          color="gray"
          onClick={navigateLatest}
          style={{ fontSize: 10 }}
        >
          Latest
        </Button>
        <Box style={{ width: 1, flexShrink: 0 }} />
        <Button size="1" variant="ghost" color="gray" onClick={navigateNext}>
          <ChevronRightIcon width={14} height={14} />
        </Button>
        <Box style={{ width: 6, flexShrink: 0 }} />
        <Text
          size="2"
          weight="medium"
          style={{ color: "var(--gray-11)", whiteSpace: "nowrap" }}
        >
          {formatPeriodLabel(currentAnchor, viewMode)}
        </Text>
        <Box style={{ flex: 1 }} />
        <Text
          size="1"
          color="gray"
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          {filtered.length} workflows
        </Text>
      </Flex>

      {/* Rows */}
      <ScrollArea style={{ flex: 1 }}>
        <Box p="3">
          <div style={{ border: '1px solid var(--gray-a3)', borderRadius: 0, overflow: 'hidden' }}>
            {/* Column header */}
            <div style={{ display: 'flex', height: 28, borderBottom: '1px solid var(--gray-a3)', background: 'var(--gray-a2)' }}>
              <div style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH, paddingLeft: 6, paddingRight: 6, display: 'flex', alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: 'var(--gray-8)', fontWeight: 500 }}>Workflow / Task</Text>
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid var(--gray-a3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                <Text style={{ fontSize: 10, color: 'var(--gray-8)' }}>Start</Text>
                <Text style={{ fontSize: 10, color: 'var(--gray-8)' }}>Execution Duration</Text>
                <Text style={{ fontSize: 10, color: 'var(--gray-8)' }}>End</Text>
              </div>
            </div>
            {filtered.length === 0 ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                p="6"
                gap="2"
              >
                <Text size="2" color="gray">
                  No workflows in this period
                </Text>
                <Text size="1" color="gray">
                  Use arrows to navigate or click "Latest"
                </Text>
              </Flex>
            ) : (
              filtered.map((wf) => (
                <WorkflowRow
                  key={wf.executionId}
                  workflow={wf}
                  onSelect={onSelectWorkflow}
                />
              ))
            )}
          </div>
        </Box>
      </ScrollArea>
    </Flex>
  );
}
