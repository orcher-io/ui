'use client';

import { createContext, useContext } from 'react';

export interface DrawerContextValue {
  openDrawer: (wf: { executionId: string; workflowId: string; workflowType: string }) => void;
  openScheduleDrawer: (s: { id: string; name: string }) => void;
  openWorkerDrawer: (w: { id: string; name: string }) => void;
  closeDrawer: () => void;
  activeDrawerId: string | null;
  activeDrawerType: string | null;
  activeDrawerData?: Record<string, unknown>;
}

export const DrawerContext = createContext<DrawerContextValue>({
  openDrawer: () => {},
  openScheduleDrawer: () => {},
  openWorkerDrawer: () => {},
  closeDrawer: () => {},
  activeDrawerId: null,
  activeDrawerType: null,
});

export function useDrawer() {
  return useContext(DrawerContext);
}
