'use client';

import { Box, Text, Flex, Heading, Badge, Code, Card, ScrollArea } from '@radix-ui/themes';
import {
  RocketIcon,
  FileTextIcon,
  CodeIcon,
  LightningBoltIcon,
  ExternalLinkIcon,
  StarIcon,
} from '@radix-ui/react-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api-transport';
import { DASHBOARD_VERSION } from '@/lib/version';

// ============================================================================
// Versions
// ============================================================================

/** The version of the engine this dashboard is reading, once it has answered. */
function useEngineVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/system/info')
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => {
        if (!cancelled && info && typeof info.version === 'string') setVersion(info.version);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return version;
}

// ============================================================================
// Section components
// ============================================================================

function SectionCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card style={{ background: 'var(--gray-2)', border: 'none', boxShadow: 'inset 0 0 0 0.5px var(--gray-a5)', padding: '16px' }}>
      <Flex gap="3" align="start">
        <Box style={{ color: 'var(--gray-9)', marginTop: 2, flexShrink: 0 }}>{icon}</Box>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium" style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>{title}</Text>
          {children}
        </Box>
      </Flex>
    </Card>
  );
}

function CommandBlock({ label, command }: { label: string; command: string }) {
  return (
    <Flex direction="column" gap="1" mb="2">
      <Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>{label}</Text>
      <Code style={{ fontSize: 12, padding: '6px 10px', display: 'block', background: 'var(--gray-a2)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {command}
      </Code>
    </Flex>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <Flex align="center" gap="2" py="1">
      <Text style={{ fontSize: 12, color: 'var(--gray-11)' }}>• {text}</Text>
    </Flex>
  );
}

function LinkItem({ label, url }: { label: string; url: string }) {
  return (
    <Flex
      align="center"
      gap="2"
      py="1"
      style={{ cursor: 'pointer' }}
      onClick={() => window.open(url, '_blank')}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gray-12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--gray-10)'; }}
    >
      <ExternalLinkIcon width={12} height={12} style={{ flexShrink: 0, color: 'var(--gray-8)' }} />
      <Text style={{ fontSize: 12, color: 'inherit' }}>{label}</Text>
    </Flex>
  );
}

// ============================================================================
// Main Welcome component
// ============================================================================

export function WelcomePage() {
  const engineVersion = useEngineVersion();
  return (
    <ScrollArea style={{ height: '100%' }}>
      <Box style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px' }}>
        {/* Header */}
        <Flex direction="column" gap="2" mb="5">
          <Flex align="center" gap="3">
            <Heading size="6">Welcome to Orcher</Heading>
            {engineVersion && <Badge variant="soft" color="gray">Engine v{engineVersion}</Badge>}
          </Flex>
          <Text style={{ fontSize: 13, color: 'var(--gray-9)', lineHeight: 1.5 }}>
            A high-performance workflow orchestration platform — built with Rust.
            This dashboard provides visibility into your workflow executions, schedules, and workers.
          </Text>
        </Flex>

        <Flex direction="column" gap="4">
          {/* Getting Started */}
          <SectionCard icon={<RocketIcon width={18} height={18} />} title="Getting Started">
            <Text style={{ fontSize: 12, color: 'var(--gray-9)', marginBottom: 12, display: 'block' }}>
              Get up and running with Orcher in minutes. Install the CLI, start the server, and run your first workflow.
            </Text>
            <CommandBlock
              label="1. Install the Orcher CLI"
              command="brew install orcher-io/tap/orcher"
            />
            <CommandBlock
              label="2. Start the engine and PostgreSQL in Docker"
              command="orcher dev start"
            />
            <CommandBlock
              label="3. Create a project: python, typescript or rust"
              command="orcher new rust my-app && cd my-app"
            />
            <CommandBlock
              label="4. Run the worker in one terminal, and start a workflow in another"
              command={`cargo run -- worker
cargo run -- start Ada`}
            />
            <Text style={{ fontSize: 11, color: 'var(--gray-8)', marginTop: 4, display: 'block' }}>
              The engine serves gRPC on :50051 and its REST API on :8080, which this dashboard reads.
            </Text>
          </SectionCard>

          {/* Alternative: Manual Setup */}
          <SectionCard icon={<CodeIcon width={18} height={18} />} title="From source (without the CLI)">
            <Text style={{ fontSize: 12, color: 'var(--gray-9)', marginBottom: 12, display: 'block' }}>
              In a checkout of the engine, github.com/orcher-io/orcher:
            </Text>
            <CommandBlock
              label="Create the database and apply the schema"
              command={`createdb orcher
DATABASE_URL=postgresql://localhost/orcher \\
  cargo run --release -p orcher-storage --bin orcher-migrate -- run`}
            />
            <CommandBlock
              label="Start the engine (gRPC :50051, REST :8080)"
              command={`DATABASE_URL=postgresql://localhost/orcher \\
  cargo run --release -p orcher-orchestrator`}
            />
          </SectionCard>

          {/* Documentation */}
          <SectionCard icon={<FileTextIcon width={18} height={18} />} title="Documentation & Guides">
            <Text style={{ fontSize: 12, color: 'var(--gray-9)', marginBottom: 8, display: 'block' }}>
              Orcher supports Rust, TypeScript, and Python SDKs — all powered by a shared Rust core.
            </Text>
            <Flex gap="4" wrap="wrap">
              <Box style={{ flex: 1, minWidth: 180 }}>
                <Text style={{ fontSize: 11, color: 'var(--gray-8)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 4 }}>Getting Started</Text>
                <LinkItem label="Quickstart Guide" url="https://docs.orcher.io/guides/getting-started/quickstart" />
                <LinkItem label="Architecture Overview" url="https://docs.orcher.io/guides/getting-started/architecture" />
                <LinkItem label="Features" url="https://docs.orcher.io/guides/getting-started/features" />
                <LinkItem label="Local Development" url="https://docs.orcher.io/guides/local-development/getting-started" />
              </Box>
              <Box style={{ flex: 1, minWidth: 180 }}>
                <Text style={{ fontSize: 11, color: 'var(--gray-8)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 4 }}>SDK Guides</Text>
                <LinkItem label="Rust SDK" url="https://docs.orcher.io/guides/sdk/rust" />
                <LinkItem label="TypeScript SDK" url="https://docs.orcher.io/guides/sdk/typescript" />
                <LinkItem label="Python SDK" url="https://docs.orcher.io/guides/sdk/python" />
              </Box>
              <Box style={{ flex: 1, minWidth: 180 }}>
                <Text style={{ fontSize: 11, color: 'var(--gray-8)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 4 }}>Core Concepts</Text>
                <LinkItem label="Workflows" url="https://docs.orcher.io/guides/core/workflows" />
                <LinkItem label="Tasks" url="https://docs.orcher.io/guides/core/tasks" />
                <LinkItem label="Error Handling" url="https://docs.orcher.io/guides/core/error-handling" />
                <LinkItem label="State Management" url="https://docs.orcher.io/guides/core/state-management" />
              </Box>
            </Flex>
          </SectionCard>

          {/* SDK Examples */}
          <SectionCard icon={<CodeIcon width={18} height={18} />} title="CLI Quick Reference">
            <CommandBlock label="A Rust project" command="orcher new rust my-app" />
            <CommandBlock label="A TypeScript project" command="orcher new typescript my-app && cd my-app && npm install && npm run build" />
            <CommandBlock label="A Python project" command="orcher new python my-app && cd my-app && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" />
            <CommandBlock label="Run the project's workflow end to end" command="orcher test" />
          </SectionCard>

          {/* What the dashboard shows */}
          <SectionCard icon={<LightningBoltIcon width={18} height={18} />} title="In this dashboard">
            <FeatureItem text="Overview of workflow runs, with charts" />
            <FeatureItem text="Workflow timelines by hour, day, week and month" />
            <FeatureItem text="A run's tasks, timeline, graph, journal and logs" />
            <FeatureItem text="Schedules: create, pause, resume, delete" />
            <FeatureItem text="Workers and their capacity" />
            <FeatureItem text="Namespaces, and a namespace filter across every view" />
            <FeatureItem text="Reset a workflow to an earlier point" />
          </SectionCard>

          {/* Keyboard Shortcuts */}
          <SectionCard icon={<StarIcon width={18} height={18} />} title="Tips">
            <Flex direction="column" gap="1">
              <Text style={{ fontSize: 12, color: 'var(--gray-10)' }}>
                • Use the <strong>command palette</strong> (Cmd+K) to quickly navigate anywhere
              </Text>
              <Text style={{ fontSize: 12, color: 'var(--gray-10)' }}>
                • Click the <strong>gear icon</strong> for quick settings and theme toggle
              </Text>
              <Text style={{ fontSize: 12, color: 'var(--gray-10)' }}>
                • Set a <strong>global namespace</strong> in the header to filter all views at once
              </Text>
              <Text style={{ fontSize: 12, color: 'var(--gray-10)' }}>
                • <strong>Double-click</strong> a workflow in timelines to open its detail
              </Text>
              <Text style={{ fontSize: 12, color: 'var(--gray-10)' }}>
                • Click the <strong>↗ button</strong> in the drawer to open in a full tab
              </Text>
            </Flex>
          </SectionCard>
        </Flex>

        {/* Footer */}
        <Flex justify="center" mt="5" mb="3">
          <Text style={{ fontSize: 11, color: 'var(--gray-7)' }}>
            Orcher Dashboard v{DASHBOARD_VERSION}{engineVersion ? `, engine v${engineVersion}` : ''}
          </Text>
        </Flex>
      </Box>
    </ScrollArea>
  );
}

// ============================================================================
// Version check — should Welcome be shown?
// ============================================================================

// Welcome opens again when the dashboard's version changes
const WELCOME_VERSION_KEY = 'orcher-welcome-version';

export function shouldShowWelcome(): boolean {
  if (typeof window === 'undefined') return false;
  const lastSeen = localStorage.getItem(WELCOME_VERSION_KEY);
  return lastSeen !== DASHBOARD_VERSION;
}

export function markWelcomeSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WELCOME_VERSION_KEY, DASHBOARD_VERSION);
}
