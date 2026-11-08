import type { PluginDefinition } from '@orcher/workbench-plugin-api';

export const orcherWorkflowsDefinition: PluginDefinition = {
  id: 'orcher.workflows',
  name: 'Orcher Workflows',
  version: '0.1.0',
  description: 'Workflow explorer and execution detail views',
  activationEvents: ['onStartup'],
  contributes: {
    views: {
      explorer: [
        {
          id: 'orcher.workflows.tree',
          name: 'Workflows',
        },
      ],
    },
    editors: [
      {
        id: 'orcher.workflow-detail',
        name: 'Workflow Detail',
        selector: { filenamePattern: 'workflow:*' },
      },
    ],
  },
};
