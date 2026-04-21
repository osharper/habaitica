import nconf from 'nconf';
import {
  _internals,
  getModel,
  getProviderName,
  getThinkingOptions,
  thinkingBudgetFor,
} from '../../../../../website/server/libs/ai/provider';

describe('libs/ai/provider', () => {
  let nconfGetStub;

  beforeEach(() => {
    nconfGetStub = sandbox.stub(nconf, 'get');
    nconfGetStub.callThrough();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getProviderName', () => {
    it('defaults to google when AI_PROVIDER is unset', () => {
      nconfGetStub.withArgs('AI_PROVIDER').returns(undefined);
      expect(getProviderName()).to.equal('google');
    });

    it('normalizes case', () => {
      nconfGetStub.withArgs('AI_PROVIDER').returns('OpenRouter');
      expect(getProviderName()).to.equal('openrouter');
    });

    it('throws on an unsupported provider', () => {
      nconfGetStub.withArgs('AI_PROVIDER').returns('anthropic');
      expect(() => getProviderName()).to.throw(/Unknown AI_PROVIDER/);
    });
  });

  describe('thinkingBudgetFor', () => {
    it('maps the knob to Gemini token caps', () => {
      expect(thinkingBudgetFor('off')).to.equal(0);
      expect(thinkingBudgetFor('low')).to.equal(256);
      expect(thinkingBudgetFor('medium')).to.equal(1024);
      expect(thinkingBudgetFor('high')).to.equal(4096);
      expect(thinkingBudgetFor('dynamic')).to.equal(-1);
    });

    it('falls back to low (256) for unknown values', () => {
      expect(thinkingBudgetFor('unknown-knob')).to.equal(256);
    });
  });

  describe('getModel', () => {
    it('wires google() with GEMINI_MODEL when AI_PROVIDER=google', () => {
      nconfGetStub.withArgs('AI_PROVIDER').returns('google');
      nconfGetStub.withArgs('GOOGLE_API_KEY').returns('k');
      nconfGetStub.withArgs('GEMINI_MODEL').returns('gemini-3-flash-lite');

      const fakeModel = { __id: 'g' };
      const googleStub = sandbox.stub(_internals, 'google').returns(fakeModel);

      const result = getModel();

      expect(googleStub).to.have.been.calledWith('gemini-3-flash-lite');
      expect(result).to.deep.equal({
        model: fakeModel,
        modelId: 'gemini-3-flash-lite',
        provider: 'google',
      });
    });

    it('throws a clear error when google is selected without a key', () => {
      nconfGetStub.withArgs('AI_PROVIDER').returns('google');
      nconfGetStub.withArgs('GOOGLE_API_KEY').returns(undefined);
      expect(() => getModel()).to.throw(/GOOGLE_API_KEY/);
    });

    it('wires openrouter with OPENROUTER_MODEL + OPENROUTER_API_KEY', () => {
      nconfGetStub.withArgs('AI_PROVIDER').returns('openrouter');
      nconfGetStub.withArgs('OPENROUTER_API_KEY').returns('or-key');
      nconfGetStub.withArgs('OPENROUTER_MODEL').returns('google/gemini-3-flash-lite');

      const fakeModel = { __id: 'or' };
      const providerFn = sandbox.stub().returns(fakeModel);
      const createStub = sandbox.stub(_internals, 'createOpenRouter').returns(providerFn);

      const result = getModel();

      expect(createStub).to.have.been.calledWith({ apiKey: 'or-key' });
      expect(providerFn).to.have.been.calledWith('google/gemini-3-flash-lite');
      expect(result.modelId).to.equal('google/gemini-3-flash-lite');
      expect(result.provider).to.equal('openrouter');
      expect(result.model).to.equal(fakeModel);
    });

    it('throws when openrouter is selected without a key', () => {
      nconfGetStub.withArgs('AI_PROVIDER').returns('openrouter');
      nconfGetStub.withArgs('OPENROUTER_API_KEY').returns(undefined);
      expect(() => getModel()).to.throw(/OPENROUTER_API_KEY/);
    });

    it('wires ollama with OLLAMA_BASE_URL + OLLAMA_MODEL, key optional', () => {
      nconfGetStub.withArgs('AI_PROVIDER').returns('ollama');
      nconfGetStub.withArgs('OLLAMA_BASE_URL').returns('http://ollama.local/api');
      nconfGetStub.withArgs('OLLAMA_MODEL').returns('qwen2:7b');

      const fakeModel = { __id: 'oll' };
      const providerFn = sandbox.stub().returns(fakeModel);
      const createStub = sandbox.stub(_internals, 'createOllama').returns(providerFn);

      const result = getModel();

      expect(createStub).to.have.been.calledWith({ baseURL: 'http://ollama.local/api' });
      expect(providerFn).to.have.been.calledWith('qwen2:7b');
      expect(result.provider).to.equal('ollama');
      expect(result.modelId).to.equal('qwen2:7b');
    });

    it('falls back to default ollama base URL and model', () => {
      nconfGetStub.withArgs('AI_PROVIDER').returns('ollama');
      nconfGetStub.withArgs('OLLAMA_BASE_URL').returns(undefined);
      nconfGetStub.withArgs('OLLAMA_MODEL').returns(undefined);

      const providerFn = sandbox.stub().returns({});
      const createStub = sandbox.stub(_internals, 'createOllama').returns(providerFn);

      getModel();

      expect(createStub.firstCall.args[0].baseURL).to.equal('http://localhost:11434/api');
      expect(providerFn.firstCall.args[0]).to.equal('llama3.1:8b');
    });
  });

  describe('getThinkingOptions', () => {
    it('returns google thinkingConfig for google', () => {
      nconfGetStub.withArgs('GEMINI_THINKING_LEVEL').returns('medium');
      expect(getThinkingOptions('google')).to.deep.equal({
        google: { thinkingConfig: { thinkingBudget: 1024 } },
      });
    });

    it('returns openrouter reasoning effort for openrouter', () => {
      nconfGetStub.withArgs('GEMINI_THINKING_LEVEL').returns('high');
      expect(getThinkingOptions('openrouter')).to.deep.equal({
        openrouter: { reasoning: { effort: 'high' } },
      });
    });

    it('returns empty for openrouter when thinking is off', () => {
      nconfGetStub.withArgs('GEMINI_THINKING_LEVEL').returns('off');
      expect(getThinkingOptions('openrouter')).to.deep.equal({});
    });

    it('returns ollama think flag for ollama', () => {
      nconfGetStub.withArgs('GEMINI_THINKING_LEVEL').returns('low');
      expect(getThinkingOptions('ollama')).to.deep.equal({
        ollama: { think: true },
      });
    });

    it('turns ollama think off when level is off', () => {
      nconfGetStub.withArgs('GEMINI_THINKING_LEVEL').returns('off');
      expect(getThinkingOptions('ollama')).to.deep.equal({
        ollama: { think: false },
      });
    });
  });
});
