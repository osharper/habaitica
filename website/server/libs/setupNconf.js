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

  // AI / Gemini task-assessment defaults. Override in config.json or env.
  if (!nconfInstance.get('GEMINI_MODEL')) {
    nconfInstance.set('GEMINI_MODEL', 'gemini-3-flash-lite');
  }
  if (!nconfInstance.get('GEMINI_THINKING_LEVEL')) {
    nconfInstance.set('GEMINI_THINKING_LEVEL', 'low');
  }

  // we need this in common and can't use nconf on the client.
  process.env.CONTENT_SWITCHOVER_TIME_OFFSET = nconfInstance.get('CONTENT_SWITCHOVER_TIME_OFFSET') || 0;
}
