import type { PluginDefinition } from '@orcher/workbench-plugin-api';

export const orcherConnectionDefinition: PluginDefinition = {
  id: 'orcher.connection',
  name: 'Orcher Connection',
  version: '0.1.0',
  description: 'Manages connection to the Orcher orchestrator server',
  activationEvents: ['onStartup'],
  contributes: {
    // A list now, not a single section, so a plugin can contribute more than
    // one. The id is newly required — it is what a section is addressed by.
    configuration: [
      {
        id: 'orcher.connection',
        title: 'Orcher Connection',
        properties: {
          'orcher.serverUrl': {
            type: 'string',
            default: 'http://localhost:50051',
            description: 'Orcher orchestrator gRPC server URL',
          },
          'orcher.namespace': {
            type: 'string',
            default: 'benchmark',
            description: 'Default namespace for workflow operations',
          },
        },
      },
    ],
  },
};
