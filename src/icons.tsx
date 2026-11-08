'use client';

import React from 'react';
import {
  Settings,
  Layers,
  Workflow,
  Zap,
  Clock,
  Server,
  SquareStack,
  Rocket,
  Search,
  LayoutDashboard,
  Timer,
  FileText,
  Component,
} from 'lucide-react';

/**
 * Resolve an icon ID to a Lucide React element.
 * Used by activity bar items and tab icons across OSS and cloud dashboards.
 */
export function orcherIconResolver(iconId: string, size = 14): React.ReactElement {
  const props = { size, strokeWidth: 1.5 };
  switch (iconId) {
    case 'workflows':
      return <Workflow {...props} />;
    case 'executions':
      return <Zap {...props} />;
    case 'settings':
      return <Settings {...props} />;
    case 'journal':
      return <FileText {...props} />;
    case 'namespaces':
      return <Layers {...props} />;
    case 'dashboard':
      return <LayoutDashboard {...props} />;
    case 'timer':
      return <Timer {...props} />;
    case 'schedules':
      return <Clock {...props} />;
    case 'workers':
      return <Server {...props} />;
    case 'batch':
      return <SquareStack {...props} />;
    case 'workflow-detail':
      return <Component {...props} />;
    case 'rocket':
      return <Rocket {...props} />;
    case 'search':
      return <Search {...props} />;
    default:
      return <FileText {...props} />;
  }
}

/**
 * Get an icon element for the activity bar (18px).
 */
export function orcherActivityIcon(iconId: string): React.ReactElement {
  return orcherIconResolver(iconId, 18);
}
