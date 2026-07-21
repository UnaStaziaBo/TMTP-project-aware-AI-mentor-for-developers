import * as vscode from 'vscode';
import type { AIProviderId } from '@tmpt/ai';

const SECRET_KEY_PREFIX = 'tmtp.ai.apiKey.';
const GLOBAL_STATE_KEY = 'tmtp.ai.config';

export interface StoredAIConfig {
  provider: AIProviderId;
  model: string;
}

export interface ResolvedAIConfig {
  config: StoredAIConfig;
  apiKey: string;
}

/**
 * The API key lives only in VS Code's encrypted SecretStorage. The non-secret
 * provider/model choice lives in globalState (extension-private storage, not
 * settings.json). Neither is ever sent to the webview.
 */
export async function getAIConfig(context: vscode.ExtensionContext): Promise<ResolvedAIConfig | undefined> {
  const config = context.globalState.get<StoredAIConfig>(GLOBAL_STATE_KEY);
  if (!config) return undefined;

  const apiKey = await context.secrets.get(SECRET_KEY_PREFIX + config.provider);
  if (!apiKey) return undefined;

  return { config, apiKey };
}

export async function saveAIConfig(
  context: vscode.ExtensionContext,
  provider: AIProviderId,
  model: string,
  apiKey: string,
): Promise<void> {
  await context.secrets.store(SECRET_KEY_PREFIX + provider, apiKey);
  await context.globalState.update(GLOBAL_STATE_KEY, { provider, model } satisfies StoredAIConfig);
}
