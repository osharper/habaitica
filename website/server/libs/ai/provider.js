import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import nconf from 'nconf';

// Provider seam for roadmap 01 / PR 1.5. The single assessment path in
// `taskAssessment.js` calls `getModel()` + `getThinkingOptions()` instead
// of importing a provider SDK directly, so swapping Gemini for
// OpenRouter or a local Ollama box is one nconf key away.
//
// Supported providers today:
//   - google     → @ai-sdk/google            (default)
//   - openrouter → @openrouter/ai-sdk-provider
//   - ollama     → ollama-ai-provider-v2 (ai-sdk v6 compatible)
//
// The streaming path that lands in PR 2 must stay behind this seam —
// do not reach for a provider SDK directly from assessment / chat code.

const SUPPORTED_PROVIDERS = ['google', 'openrouter', 'ollama'];

const DEFAULTS = {
  google: { model: 'gemini-3-flash-lite' },
  openrouter: { model: 'google/gemini-3-flash-lite' },
  ollama: {
    model: 'llama3.1:8b',
    baseURL: 'http://localhost:11434/api',
  },
};

export function getProviderName () {
  const raw = nconf.get('AI_PROVIDER');
  if (!raw) return 'google';
  const name = String(raw).toLowerCase();
  if (!SUPPORTED_PROVIDERS.includes(name)) {
    throw new Error(
      `Unknown AI_PROVIDER "${raw}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
    );
  }
  return name;
}

// Indirection for tests. Factories are read through _internals so specs
// can stub them without touching the real provider modules (which would
// require network / local Ollama).
export const _internals = {
  google: (...args) => google(...args),
  createGoogleGenerativeAI: opts => createGoogleGenerativeAI(opts),
  createOpenRouter: opts => createOpenRouter(opts),
  createOllama: opts => createOllama(opts),
};

function getGoogleModel () {
  if (!nconf.get('GOOGLE_API_KEY')) {
    throw new Error('GOOGLE_API_KEY not configured');
  }
  const modelId = nconf.get('GEMINI_MODEL') || DEFAULTS.google.model;
  return { model: _internals.google(modelId), modelId };
}

function getOpenRouterModel () {
  const apiKey = nconf.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }
  const modelId = nconf.get('OPENROUTER_MODEL') || DEFAULTS.openrouter.model;
  const openrouter = _internals.createOpenRouter({ apiKey });
  return { model: openrouter(modelId), modelId };
}

function getOllamaModel () {
  const modelId = nconf.get('OLLAMA_MODEL') || DEFAULTS.ollama.model;
  const baseURL = nconf.get('OLLAMA_BASE_URL') || DEFAULTS.ollama.baseURL;
  const ollama = _internals.createOllama({ baseURL });
  return { model: ollama(modelId), modelId };
}

/**
 * Resolve the active provider into an AI-SDK-compatible language model.
 *
 * @returns {{ model: import('ai').LanguageModel, modelId: string,
 *             provider: 'google'|'openrouter'|'ollama' }}
 */
export function getModel () {
  const provider = getProviderName();
  switch (provider) {
    case 'google': return { ...getGoogleModel(), provider };
    case 'openrouter': return { ...getOpenRouterModel(), provider };
    case 'ollama': return { ...getOllamaModel(), provider };
    default: throw new Error(`Unknown AI_PROVIDER: ${provider}`);
  }
}

// Gemini accepts a numeric thinkingBudget in tokens. We map the
// user-facing "off/low/medium/high/dynamic" knob to recommended token
// caps per the Gemini 3 docs. Using -1 ("dynamic") stays available to
// callers that set GEMINI_THINKING_LEVEL=dynamic.
export function thinkingBudgetFor (level) {
  if (level === 'dynamic') return -1;
  if (level === 'high') return 4096;
  if (level === 'medium') return 1024;
  if (level === 'off') return 0;
  return 256;
}

/**
 * Return the `providerOptions` blob appropriate for the active provider
 * so callers can forward it to `generateObject` / `generateText` /
 * `streamText` verbatim. Keeps provider-specific knobs (Gemini's
 * `thinkingConfig`, OpenRouter's `reasoning`, …) behind one seam.
 *
 * @param {string} [provider] Explicit provider override; otherwise
 *   falls back to `getProviderName()`.
 */
export function getThinkingOptions (provider = getProviderName()) {
  const level = nconf.get('GEMINI_THINKING_LEVEL') || 'low';

  if (provider === 'google') {
    return {
      google: {
        thinkingConfig: { thinkingBudget: thinkingBudgetFor(level) },
      },
    };
  }

  if (provider === 'openrouter') {
    // OpenRouter surfaces reasoning through a `reasoning` object on the
    // provider-options payload; only models that actually support
    // thinking will honour it. Off-level users get `{}` so we don't pay
    // for the reasoning round-trip when they explicitly opted out.
    if (level === 'off') return {};
    return {
      openrouter: {
        reasoning: { effort: level === 'dynamic' ? 'medium' : level },
      },
    };
  }

  // Ollama: thinking surfaces per-model via the `think` option. Only
  // reasoning-capable models (e.g. deepseek-r1, qwen3-thinking) honour
  // it; everything else ignores it gracefully.
  if (provider === 'ollama') {
    if (level === 'off') return { ollama: { think: false } };
    return { ollama: { think: true } };
  }

  return {};
}

// Exposed for tests that want to assert on default config without
// hard-coding literals.
export const _defaults = DEFAULTS;
export const _supportedProviders = SUPPORTED_PROVIDERS;
