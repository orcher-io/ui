import {
  ServiceTokens,
  type ICommandExtensionPoint,
  type IConfigurationExtensionPoint,
  type PluginActivationContext,
  type PluginModule,
} from '@orcher/workbench-plugin-api';

import { orcherConnectionDefinition } from './definition';

export interface OrcherConnectionState {
  serverUrl: string;
  namespace: string;
  connected: boolean;
}

let connectionState: OrcherConnectionState = {
  serverUrl: 'http://localhost:50051',
  namespace: 'default',
  connected: false,
};

export function getConnectionState(): OrcherConnectionState {
  return connectionState;
}

export const orcherConnectionModule: PluginModule = {
  activate(ctx: PluginActivationContext) {
    // Both the configuration store and the command registry are resolved from
    // the plugin's DI scope now rather than hanging off the context. tryResolve
    // preserves what `ctx.configuration?` and `ctx.commands?` did before: carry
    // on without them rather than refuse to activate.
    const configuration = ctx.container.tryResolve<IConfigurationExtensionPoint>(
      ServiceTokens.ConfigurationExtensionPoint,
    );
    const commands = ctx.container.tryResolve<ICommandExtensionPoint>(
      ServiceTokens.CommandExtensionPoint,
    );

    // get() takes the fallback itself, so the ?? here is for the case where
    // there is no configuration service at all — not for a missing key.
    const serverUrl =
      configuration?.get<string>('orcher.serverUrl', 'http://localhost:50051') ??
      'http://localhost:50051';
    const namespace =
      configuration?.get<string>('orcher.namespace', 'default') ?? 'default';

    connectionState = {
      serverUrl: String(serverUrl),
      namespace: String(namespace),
      connected: false,
    };

    // Registration returns a Disposable that subscriptions now owns; without
    // pushing it the handler outlives the plugin.
    const disposable = commands?.registerHandler(
      'orcher.connection.status',
      () => connectionState,
      orcherConnectionDefinition.id,
    );
    if (disposable) ctx.subscriptions.push(disposable);
  },

  deactivate() {
    connectionState.connected = false;
  },
};
