/* eslint-disable import/no-commonjs */
import nconfDefault from 'nconf';
import { join, resolve } from 'path';

const PATH_TO_CONFIG = join(resolve(__dirname, '../../../config.json'));

export default function setupNconf (file, nconfInstance = nconfDefault) {
  const configFile = file || PATH_TO_CONFIG;

  nconfInstance
    .argv()
    .env()
    .file('user', configFile);

  nconfInstance.set('IS_PROD', nconfInstance.get('NODE_ENV') === 'production');
  nconfInstance.set('IS_DEV', nconfInstance.get('NODE_ENV') === 'development');
  nconfInstance.set('IS_TEST', nconfInstance.get('NODE_ENV') === 'test');

  // AI task-assessment defaults. Override in config.json or env.
  // AI_PROVIDER selects the backend: google (default) | openrouter | ollama.
  // Each provider pulls its own env keys through website/server/libs/ai/provider.js.
  if (!nconfInstance.get('AI_PROVIDER')) {
    nconfInstance.set('AI_PROVIDER', 'google');
  }
  if (!nconfInstance.get('GEMINI_MODEL')) {
    nconfInstance.set('GEMINI_MODEL', 'gemini-3-flash-lite');
  }
  if (!nconfInstance.get('GEMINI_THINKING_LEVEL')) {
    nconfInstance.set('GEMINI_THINKING_LEVEL', 'low');
  }
  if (!nconfInstance.get('OPENROUTER_MODEL')) {
    nconfInstance.set('OPENROUTER_MODEL', 'google/gemini-3-flash-lite');
  }
  if (!nconfInstance.get('OLLAMA_BASE_URL')) {
    nconfInstance.set('OLLAMA_BASE_URL', 'http://localhost:11434/api');
  }
  if (!nconfInstance.get('OLLAMA_MODEL')) {
    nconfInstance.set('OLLAMA_MODEL', 'llama3.1:8b');
  }

  // we need this in common and can't use nconf on the client.
  process.env.CONTENT_SWITCHOVER_TIME_OFFSET = nconfInstance.get('CONTENT_SWITCHOVER_TIME_OFFSET') || 0;
}
