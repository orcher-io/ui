import type { PluginDefinition } from '@orcher/workbench-plugin-api';

export const orcherJournalDefinition: PluginDefinition = {
  id: 'orcher.journal',
  name: 'Orcher Journal',
  version: '0.1.0',
  description: 'Execution journal timeline viewer for debugging and inspection',
  activationEvents: ['onStartup'],
  contributes: {
    editors: [
      {
        id: 'orcher.journal-viewer',
        name: 'Journal Timeline',
        selector: { filenamePattern: 'journal:*' },
      },
    ],
  },
};
