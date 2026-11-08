'use client';

import React, { useMemo, useEffect, useState, useCallback, useRef, createContext, useContext, type ReactNode } from 'react';
import { Box, Text, Heading, Badge, Flex, Card, Separator, Button } from '@radix-ui/themes';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import {
  WorkbenchProvider,
  Shell,
  useWindowManager,
  type TabState,
} from '@orcher/workbench-core';
import type { ActivityBarItem } from '@orcher/workbench-ui';
import { CommandPalette, useCommandPalette, Drawer, ToastProvider, type CommandItem } from '@orcher/workbench-ui';

// Platform built-in plugins
import { headerDefinition, headerModule, Header } from '@orcher/workbench-plugin-header';
import {
  breadcrumbBarDefinition,
  breadcrumbBarModule,
  BreadcrumbBar,
} from '@orcher/workbench-plugin-breadcrumb-bar';
import { explorerDefinition, explorerModule } from '@orcher/workbench-plugin-explorer';
import {
  settingsDefinition,
  settingsModule,
} from '@orcher/workbench-plugin-settings';
import { OrcherSettingsEditor, SettingsMenu } from '@/plugins/settings';
import { OrcherFooterLeft, OrcherFooterRight } from '@/plugins/footer';
import { WelcomePage, shouldShowWelcome, markWelcomeSeen } from '@/plugins/welcome';
import { GlobalNamespaceSelector } from '@/plugins/header';
import { NamespaceProvider, useGlobalNamespace } from '@/contexts/namespace-context';

// Orcher plugins
import {
  orcherConnectionDefinition,
  orcherConnectionModule,
} from '@/plugins/connection';
import {
  orcherWorkflowsDefinition,
  orcherWorkflowsModule,
  WorkflowDetailEditor,
  WorkflowsTable,
  WorkflowTimelines,
} from '@/plugins/workflows';
import { ExecutionsTable } from '@/plugins/executions';
import { SchedulesTable, ScheduleDetail } from '@/plugins/schedules';
import { WorkersTable, WorkerDetail } from '@/plugins/workers';
import { BatchOperationsTable } from '@/plugins/batch';
import { WorkflowsOverview } from '@/plugins/overview';
import { NamespacesTable } from '@/plugins/namespaces';
import {
  orcherJournalDefinition,
  orcherJournalModule,
  JournalTimeline,
} from '@/plugins/journal';

// ============ ICON RESOLVER ============

// Icon resolver imported from @/icons (shared via @orcher-io/ui package)

// ============ EDITORS ============

// Workflow detail is opened dynamically with props from the tab's data field.
// The editor registry handles passing the workflowId from the tab state.
function WorkflowDetailEditorWrapper({ workflowId }: { workflowId?: string }) {
  return <WorkflowDetailEditor workflowId={workflowId ?? '(select a workflow)'} />;
}

function JournalTimelineWrapper() {
  return <JournalTimeline executionId="(select an execution)" />;
}

function WelcomeEditor() {
  const { openTab } = useWindowManager();

  return (
    <Box p="6" style={{ maxWidth: 720, margin: '0 auto' }}>
      <Flex direction="column" gap="4">
        <Heading size="7">Orcher Dashboard</Heading>
        <Text size="3" color="gray">
          Workflow orchestration dashboard. Connect to an Orcher server to view
          and manage workflow executions.
        </Text>

        <Separator size="4" />

        <Heading size="4">Getting Started</Heading>

        <Card
          style={{ cursor: 'pointer' }}
          onClick={() =>
            openTab({
              title: 'Settings',
              editorId: 'settings',
              uri: 'orcher://settings',
              icon: 'settings',
            })
          }
        >
          <Flex direction="column" gap="1">
            <Text weight="bold">1. Configure Connection</Text>
            <Text size="2" color="gray">
              Open Settings to configure the Orcher server URL and namespace.
            </Text>
          </Flex>
        </Card>

        <Card>
          <Flex direction="column" gap="1">
            <Text weight="bold">2. Browse Workflows</Text>
            <Text size="2" color="gray">
              Use the Explorer sidebar to list workflows by namespace and status.
            </Text>
          </Flex>
        </Card>

        <Card>
          <Flex direction="column" gap="1">
            <Text weight="bold">3. Inspect Executions</Text>
            <Text size="2" color="gray">
              Click a workflow to view its execution details, journal timeline,
              and task states.
            </Text>
          </Flex>
        </Card>

        <Separator size="4" />

        <Flex gap="2">
          <Badge color="green" variant="soft">
            Orcher v2.0
          </Badge>
          <Badge color="blue" variant="soft">
            Platform Shell
          </Badge>
        </Flex>
      </Flex>
    </Box>
  );
}

// ============ DRAWER CONTEXT ============

interface DrawerState {
  type: 'workflow' | 'schedule' | 'worker' | null;
  id: string | null;
  title: string;
  subtitle?: string;
}

import { DrawerContext, useDrawer } from '@/contexts/drawer-context';
import { orcherIconResolver, orcherActivityIcon } from '@/icons';
import { ErrorBoundary } from '@/components/error-boundary';
import { EngineSignInGate } from '@/components/engine-sign-in';
import { setApiTransport, engineTransport } from '@/lib/api-transport';
import { configureEngine } from '@/lib/gateway-client';
import { notifySignInRequired, signOut, storedApiKey } from '@/lib/engine-auth';

// The standalone dashboard is static files the engine serves: its data routes
// run in the browser against the engine's REST API, with the API key the user
// signed in with when the engine asks for one.
configureEngine({ apiKey: storedApiKey, onUnauthorized: notifySignInRequired });
if (typeof window !== 'undefined') setApiTransport(engineTransport());
import { TableSkeleton, PageSkeleton } from '@/components/loading-skeleton';

// ============ EDITOR REGISTRY ============

function openWorkflowDetail(
  openDrawer: (wf: { executionId: string; workflowId: string; workflowType: string }) => void,
  wf: { executionId: string; workflowId: string; workflowType: string },
) {
  openDrawer(wf);
}

function WorkflowsTableWrapper() {
  const { openDrawer } = useDrawer();
  return <WorkflowsTable onSelectWorkflow={(wf) => openWorkflowDetail(openDrawer, wf)} />;
}

function WorkflowTimelinesWrapper() {
  const { openDrawer } = useDrawer();
  return <WorkflowTimelines onSelectWorkflow={(wf) => openWorkflowDetail(openDrawer, wf)} />;
}

function SchedulesTableWrapper() {
  const { openScheduleDrawer } = useDrawer();
  return <SchedulesTable onSelectSchedule={(s) => openScheduleDrawer({ id: s.id, name: s.name })} />;
}

function WorkersTableWrapper() {
  const { openWorkerDrawer } = useDrawer();
  return <WorkersTable onSelectWorker={(w) => openWorkerDrawer({ id: w.id, name: w.name || w.workerId })} />;
}

function ExecutionsTableWrapper() {
  const { openDrawer } = useDrawer();
  return <ExecutionsTable onSelectExecution={(wf) => openWorkflowDetail(openDrawer, wf)} />;
}

function renderEditor(tab: TabState): ReactNode {
  const content = (() => {
    switch (tab.editorId) {
      case 'orcher.welcome':
        return <WelcomePage />;
      case 'orcher.workflows-overview':
        return <WorkflowsOverview />;
      case 'orcher.workflows-table':
        return <WorkflowsTableWrapper />;
      case 'orcher.workflows-timelines':
        return <WorkflowTimelinesWrapper />;
      case 'orcher.executions-table':
        return <ExecutionsTableWrapper />;
      case 'orcher.namespaces-table':
        return <NamespacesTable />;
      case 'orcher.schedules-table':
        return <SchedulesTableWrapper />;
      case 'orcher.workers-table':
        return <WorkersTableWrapper />;
      case 'orcher.batch-operations':
        return <BatchOperationsTable />;
      case 'orcher.workflow-detail':
        return <WorkflowDetailEditorWrapper workflowId={workflowIdFromUri(tab.uri)} />;
      case 'orcher.journal-viewer':
        return <JournalTimelineWrapper />;
      case 'settings':
        return <OrcherSettingsEditor />;
      default:
        return (
          <Box p="4">
            <Text color="gray">Unknown editor: {tab.editorId}</Text>
          </Box>
        );
    }
  })();

  return (
    <ErrorBoundary pluginName={tab.title}>
      {content}
    </ErrorBoundary>
  );
}

/** A workflow detail tab's URI is `orcher://workflows/<execution id>`. */
function workflowIdFromUri(uri: string): string | undefined {
  const match = uri.match(/^orcher:\/\/workflows\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

// ============ COMMAND PALETTE ============

function OrcherCommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const { openTab } = useWindowManager();

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: 'orcher.journal.open',
        title: 'Orcher: View Execution Journal',
        onSelect: () =>
          openTab({
            title: 'Journal',
            editorId: 'orcher.journal-viewer',
            uri: 'orcher://journal',
            icon: 'journal',
          }),
      },
      {
        id: 'orcher.workers.open',
        title: 'Orcher: View Workers',
        onSelect: () =>
          openTab({
            title: 'Workers',
            editorId: 'orcher.workers-table',
            uri: 'orcher://workers',
            icon: 'workers',
          }),
      },
      {
        id: 'orcher.welcome',
        title: 'Orcher: Welcome',
        onSelect: () =>
          openTab({ title: 'Welcome', editorId: 'orcher.welcome', uri: 'orcher://welcome', icon: 'rocket' }),
      },
      {
        id: 'settings.open',
        title: 'Open Settings',
        onSelect: () =>
          openTab({ title: 'Settings', editorId: 'settings', uri: 'orcher://settings', icon: 'settings' }),
      },
    ],
    [openTab],
  );

  return <CommandPalette isOpen={isOpen} onClose={close} commands={commands} />;
}

// ============ MAIN APP ============

const plugins = [
  // Platform built-in
  { definition: headerDefinition, module: headerModule },
  { definition: breadcrumbBarDefinition, module: breadcrumbBarModule },
  { definition: explorerDefinition, module: explorerModule },
  { definition: settingsDefinition, module: settingsModule },
  // Orcher plugins
  { definition: orcherConnectionDefinition, module: orcherConnectionModule },
  { definition: orcherWorkflowsDefinition, module: orcherWorkflowsModule },
  { definition: orcherJournalDefinition, module: orcherJournalModule },
];


// Sync active tab URI to browser URL
function useTabUrlSync() {
  const { layout } = useWindowManager();

  useEffect(() => {
    if (!layout?.root) return;

    const findActiveTab = (node: any): any => {
      if (node.type === 'tabGroup' && node.id === layout.activePaneId) {
        return node.tabs?.find((t: any) => t.id === node.activeTabId);
      }
      if (node.children) {
        for (const child of node.children) {
          const found = findActiveTab(child);
          if (found) return found;
        }
      }
      return null;
    };

    const activeTab = findActiveTab(layout.root);
    if (activeTab?.uri) {
      // Convert "orcher://workflows" -> "/orcher/workflows"
      const match = activeTab.uri.match(/^([^:]+):\/\/(.+)$/);
      if (match) {
        const path = '/' + match[1] + '/' + match[2];
        if (window.location.pathname !== path) {
          window.history.replaceState({}, '', path);
        }
      }
    }
  }, [layout, layout?.activePaneId]);
}

// ============ SIDEBAR MENUS ============

interface SidebarMenuItemProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

function SidebarMenuItem({ icon, label, onClick, active }: SidebarMenuItemProps & { active?: boolean }) {
  return (
    <Flex
      align="center"
      gap="3"
      px="3"
      py="2"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: 0,
        background: active ? 'var(--gray-4)' : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--gray-3)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Box style={{ color: active ? 'var(--gray-12)' : 'var(--gray-11)', display: 'flex' }}>{icon}</Box>
      <Text size="2" weight={active ? 'medium' : 'regular'}>{label}</Text>
    </Flex>
  );
}

function WorkflowsSidebar({ openTab }: { openTab: (tab: any) => void }) {
  const { layout } = useWindowManager();

  // Derive active sidebar item from the active tab's editorId
  const activeEditorId = useMemo(() => {
    if (!layout?.root) return null;
    const findActiveTab = (node: any): any => {
      if (node.type === 'tabGroup' && node.id === layout.activePaneId) {
        return node.tabs?.find((t: any) => t.id === node.activeTabId);
      }
      if (node.children) {
        for (const child of node.children) {
          const found = findActiveTab(child);
          if (found) return found;
        }
      }
      return null;
    };
    return findActiveTab(layout.root)?.editorId ?? null;
  }, [layout, layout?.activePaneId]);

  return (
    <Flex direction="column" gap="1" p="2">
      <SidebarMenuItem
        icon={orcherIconResolver('dashboard', 16)}
        label="Overview"
        active={activeEditorId === 'orcher.workflows-overview'}
        onClick={() => openTab({
          title: 'Overview',
          editorId: 'orcher.workflows-overview',
          uri: 'orcher://workflows/overview',
          icon: 'dashboard',
          groupId: 'workflows',
        })}
      />
      <SidebarMenuItem
        icon={orcherIconResolver('workflows', 16)}
        label="All Workflows"
        active={activeEditorId === 'orcher.workflows-table' || activeEditorId === 'orcher.workflow-detail'}
        onClick={() => openTab({
          title: 'All Workflows',
          editorId: 'orcher.workflows-table',
          uri: 'orcher://workflows',
          icon: 'workflows',
          groupId: 'workflows',
        })}
      />
      <SidebarMenuItem
        icon={orcherIconResolver('timer', 16)}
        label="Timelines"
        active={activeEditorId === 'orcher.workflows-timelines'}
        onClick={() => openTab({
          title: 'Timelines',
          editorId: 'orcher.workflows-timelines',
          uri: 'orcher://workflows/timelines',
          icon: 'timer',
          groupId: 'workflows',
        })}
      />
    </Flex>
  );
}

// ============ MAIN SHELL ============

function OrcherShell() {
  const { openTab } = useWindowManager();
  useTabUrlSync();
  const [sidebarActive, setSidebarActive] = useState<string | null>(null);

  // Show Welcome tab on first visit or version update
  const welcomeCheckedRef = useRef(false);
  useEffect(() => {
    if (welcomeCheckedRef.current) return;
    welcomeCheckedRef.current = true;
    if (shouldShowWelcome()) {
      markWelcomeSeen();
      openTab({
        title: 'Welcome',
        editorId: 'orcher.welcome',
        uri: 'orcher://welcome',
        icon: 'rocket',
      });
    }
  }, [openTab]);
  const drawerStackRef = useRef<DrawerState[]>([]);
  const [drawerState, setDrawerState] = useState<DrawerState>({ type: null, id: null, title: '' });
  const drawerStateRef = useRef<DrawerState>({ type: null, id: null, title: '' });

  // Restore drawer state from sessionStorage after hydration
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('orcher-drawer');
      if (stored) {
        const parsed = JSON.parse(stored);
        drawerStateRef.current = parsed;
        setDrawerState(parsed);
      }
    } catch { /* ignore */ }
  }, []);
  const [, forceUpdate] = useState(0);
  const { layout } = useWindowManager();

  // Persist drawer state to sessionStorage
  useEffect(() => {
    try {
      if (drawerState.type) {
        sessionStorage.setItem('orcher-drawer', JSON.stringify(drawerState));
      } else {
        sessionStorage.removeItem('orcher-drawer');
      }
    } catch { /* ignore */ }
  }, [drawerState]);

  const canGoBack = drawerStackRef.current.length > 0;

  const openDrawerImpl = useCallback((next: DrawerState) => {
    const prev = drawerStateRef.current;
    if (prev.type !== null) {
      drawerStackRef.current = [...drawerStackRef.current, prev];
    } else {
      drawerStackRef.current = [];
    }
    drawerStateRef.current = next;
    setDrawerState(next);
    forceUpdate((n) => n + 1);
  }, []);

  const openDrawer = useCallback((wf: { executionId: string; workflowId: string; workflowType: string }) => {
    openDrawerImpl({ type: 'workflow', id: wf.executionId, title: wf.workflowType, subtitle: wf.executionId.slice(0, 20) });
  }, [openDrawerImpl]);

  const openScheduleDrawer = useCallback((s: { id: string; name: string }) => {
    openDrawerImpl({ type: 'schedule', id: s.id, title: s.name, subtitle: s.id.slice(0, 20) });
  }, [openDrawerImpl]);

  const openWorkerDrawer = useCallback((w: { id: string; name: string }) => {
    openDrawerImpl({ type: 'worker', id: w.id, title: w.name || 'Worker', subtitle: w.id.slice(0, 20) });
  }, [openDrawerImpl]);

  const closeDrawer = useCallback(() => {
    drawerStackRef.current = [];
    drawerStateRef.current = { type: null, id: null, title: '' };
    setDrawerState({ type: null, id: null, title: '' });
    forceUpdate((n) => n + 1);
  }, []);

  const goBackDrawer = useCallback(() => {
    const stack = drawerStackRef.current;
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1];
    drawerStackRef.current = stack.slice(0, -1);
    drawerStateRef.current = prev;
    setDrawerState(prev);
    forceUpdate((n) => n + 1);
  }, []);

  const openInTab = useCallback(() => {
    if (drawerState.type === 'workflow' && drawerState.id) {
      openTab({
        title: drawerState.title || drawerState.id.slice(0, 16),
        editorId: 'orcher.workflow-detail',
        uri: `orcher://workflows/${drawerState.id}`,
        icon: 'workflow-detail',
        groupId: 'workflows',
      });
    }
  }, [drawerState, openTab]);

  // Restore sidebar on page load based on active tab
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || !layout?.root) return;
    const findActiveTab = (node: any): any => {
      if (node.type === 'tabGroup' && node.id === layout.activePaneId) {
        return node.tabs?.find((t: any) => t.id === node.activeTabId);
      }
      if (node.children) {
        for (const child of node.children) {
          const found = findActiveTab(child);
          if (found) return found;
        }
      }
      return null;
    };
    const tab = findActiveTab(layout.root);
    if (tab) {
      initializedRef.current = true;
      const group = tab.groupId ?? tab.icon;
      if (group === 'workflows') {
        setSidebarActive('workflows');
      }
    }
  }, [layout, layout?.activePaneId]);

  const toggleSidebar = useCallback((id: string) => {
    setSidebarActive((prev) => prev === id ? null : id);
  }, []);

  const activityBarItems: ActivityBarItem[] = useMemo(
    () => [
      {
        id: 'namespaces',
        icon: orcherActivityIcon('namespaces'),
        label: 'Namespaces',
        onClick: () => {
          setSidebarActive(null);
          openTab({
            title: 'Namespaces',
            editorId: 'orcher.namespaces-table',
            uri: 'orcher://namespaces',
            icon: 'namespaces',
          });
        },
      },
      {
        id: 'workflows',
        icon: orcherActivityIcon('workflows'),
        label: 'Workflows',
        onClick: () => toggleSidebar('workflows'),
      },
      {
        id: 'executions',
        icon: orcherActivityIcon('executions'),
        label: 'Executions',
        onClick: () => {
          setSidebarActive(null);
          openTab({
            title: 'Executions',
            editorId: 'orcher.executions-table',
            uri: 'orcher://executions',
            icon: 'executions',
          });
        },
      },
      {
        id: 'schedules',
        icon: orcherActivityIcon('schedules'),
        label: 'Schedules',
        onClick: () => {
          setSidebarActive(null);
          openTab({
            title: 'Schedules',
            editorId: 'orcher.schedules-table',
            uri: 'orcher://schedules',
            icon: 'schedules',
          });
        },
      },
      {
        id: 'workers',
        icon: orcherActivityIcon('workers'),
        label: 'Workers',
        onClick: () => {
          setSidebarActive(null);
          openTab({
            title: 'Workers',
            editorId: 'orcher.workers-table',
            uri: 'orcher://workers',
            icon: 'workers',
          });
        },
      },
      {
        id: 'batch',
        icon: orcherActivityIcon('batch'),
        label: 'Batch Operations',
        onClick: () => {
          setSidebarActive(null);
          openTab({
            title: 'Batch Operations',
            editorId: 'orcher.batch-operations',
            uri: 'orcher://batch-operations',
            icon: 'batch',
          });
        },
      },
    ],
    [openTab, toggleSidebar],
  );

  const openSettingsTab = useCallback(() => {
    setSidebarActive(null);
    openTab({
      title: 'Settings',
      editorId: 'settings',
      uri: 'orcher://settings',
      icon: 'settings',
    });
  }, [openTab]);

  const activityBarBottomItems: ActivityBarItem[] = useMemo(
    () => [
      {
        id: 'settings',
        icon: orcherActivityIcon('settings'),
        label: 'Settings',
        content: <SettingsMenu onOpenSettings={openSettingsTab} onSignOut={storedApiKey() ? signOut : undefined} />,
      },
    ],
    [openSettingsTab],
  );

  const sidebarContent = useMemo(() => {
    if (sidebarActive === 'workflows') {
      return <WorkflowsSidebar openTab={openTab} />;
    }
    return null;
  }, [sidebarActive, openTab]);

  const drawerElement = (
    <Drawer
      open={drawerState.type !== null}
      onClose={closeDrawer}
      title={drawerState.title || 'Detail'}
      subtitle={drawerState.subtitle}
      onOpenInTab={drawerState.type === 'workflow' ? openInTab : undefined}
      width={560}
      headerActions={canGoBack ? (
        <Button size="1" variant="ghost" color="gray" onClick={goBackDrawer} title="Back">
          <ChevronLeftIcon width={14} height={14} />
        </Button>
      ) : undefined}
    >
      {drawerState.type === 'workflow' && drawerState.id && (
        <WorkflowDetailEditor workflowId={drawerState.id} />
      )}
      {drawerState.type === 'schedule' && drawerState.id && (
        <ScheduleDetail scheduleId={drawerState.id} onClose={closeDrawer} onSelectWorkflow={(wf) => openDrawer(wf)} />
      )}
      {drawerState.type === 'worker' && drawerState.id && (
        <WorkerDetail workerId={drawerState.id} onSelectWorkflow={(wf) => {
          openDrawer(wf);
        }} />
      )}
    </Drawer>
  );

  return (
    <DrawerContext.Provider value={{ openDrawer, openScheduleDrawer, openWorkerDrawer, closeDrawer, activeDrawerId: drawerState.id, activeDrawerType: drawerState.type }}>
      <Shell
        renderEditor={renderEditor}
        header={<Header left={<GlobalNamespaceSelector />} />}
        breadcrumbBar={<BreadcrumbBar />}
        activityBarItems={activityBarItems}
        activityBarBottomItems={activityBarBottomItems}
        showLeftSidebar={sidebarActive !== null}
        leftSidebar={sidebarContent}
        sidebarTitle={sidebarActive === 'workflows' ? 'Workflows' : undefined}
        onSidebarToggle={() => setSidebarActive(null)}
        iconResolver={orcherIconResolver}
        drawer={drawerElement}
        statusBarLeft={<OrcherFooterLeft />}
        statusBarRight={<OrcherFooterRight />}
      />
      <OrcherCommandPalette />
    </DrawerContext.Provider>
  );
}

export default function OrcherDashboard() {
  return (
    <EngineSignInGate>
    <WorkbenchProvider
      config={{
        theme: {
          appearance: 'dark',
          accentColor: 'gray',
        },
        plugins,
      }}
    >
      <ToastProvider position="bottom-right" defaultDuration={8000}>
        <NamespaceProvider>
          <OrcherShell />
        </NamespaceProvider>
      </ToastProvider>
    </WorkbenchProvider>
    </EngineSignInGate>
  );
}
