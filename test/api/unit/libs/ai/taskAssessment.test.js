import nconf from 'nconf';
import {
  _internals,
  assessTaskCompletion,
  AssessmentSchema,
} from '../../../../../website/server/libs/ai/taskAssessment';

describe('libs/ai/taskAssessment', () => {
  let generateObjectStub;
  let nconfGetStub;

  beforeEach(() => {
    nconfGetStub = sandbox.stub(nconf, 'get');
    nconfGetStub.withArgs('GOOGLE_API_KEY').returns('test-api-key');
    nconfGetStub.withArgs('GEMINI_MODEL').returns('gemini-3-flash-lite');
    nconfGetStub.withArgs('GEMINI_THINKING_LEVEL').returns('low');
    nconfGetStub.callThrough();

    generateObjectStub = sandbox.stub(_internals, 'generateObject');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('AssessmentSchema', () => {
    it('accepts a minimal approved verdict', () => {
      const parsed = AssessmentSchema.parse({
        verdict: 'approved',
        rationale: 'Looks good.',
      });
      expect(parsed.verdict).to.equal('approved');
    });

    it('rejects an unknown verdict value', () => {
      expect(() => AssessmentSchema.parse({
        verdict: 'maybe',
        rationale: 'unclear',
      })).to.throw();
    });

    it('rejects empty rationale', () => {
      expect(() => AssessmentSchema.parse({
        verdict: 'approved',
        rationale: '',
      })).to.throw();
    });

    it('accepts missingEvidence and suggestedActions arrays', () => {
      const parsed = AssessmentSchema.parse({
        verdict: 'needs_revision',
        rationale: 'Need a clearer photo.',
        missingEvidence: ['A photo of the completed work'],
        suggestedActions: ['Retake the photo in better light'],
      });
      expect(parsed.missingEvidence).to.have.lengthOf(1);
      expect(parsed.suggestedActions).to.have.lengthOf(1);
    });
  });

  describe('assessTaskCompletion', () => {
    const task = { _id: 't1', text: 'Read for 30 minutes', notes: '' };

    it('throws if GOOGLE_API_KEY is not configured', async () => {
      nconfGetStub.withArgs('GOOGLE_API_KEY').returns(undefined);
      await expect(assessTaskCompletion(task, 'I did it')).to.be.rejectedWith(/GOOGLE_API_KEY/);
      expect(generateObjectStub).to.not.have.been.called;
    });

    it('returns the structured verdict from generateObject with the configured model id', async () => {
      generateObjectStub.resolves({
        object: {
          verdict: 'approved',
          rationale: 'Your summary clearly reflects 30 minutes of reading.',
        },
      });

      const result = await assessTaskCompletion(task, 'I read chapter 3 of the book.');

      expect(generateObjectStub).to.have.been.calledOnce;
      const args = generateObjectStub.firstCall.args[0];
      expect(args).to.have.property('schema', AssessmentSchema);
      expect(args).to.have.property('schemaName', 'TaskAssessment');
      expect(args.messages[0]).to.have.property('role', 'system');
      expect(args.messages[0].content).to.include('Read for 30 minutes');
      expect(args.providerOptions.google.thinkingConfig).to.deep.equal({ thinkingBudget: 256 });

      expect(result).to.include({
        verdict: 'approved',
        modelId: 'gemini-3-flash-lite',
      });
    });

    it('surfaces missingEvidence on needs_revision verdicts', async () => {
      generateObjectStub.resolves({
        object: {
          verdict: 'needs_revision',
          rationale: 'Good start but need more detail.',
          missingEvidence: ['Which chapter did you read?'],
        },
      });

      const result = await assessTaskCompletion(task, 'I read today.');
      expect(result.verdict).to.equal('needs_revision');
      expect(result.missingEvidence).to.deep.equal(['Which chapter did you read?']);
    });

    it('respects GEMINI_THINKING_LEVEL=high', async () => {
      nconfGetStub.withArgs('GEMINI_THINKING_LEVEL').returns('high');
      generateObjectStub.resolves({
        object: { verdict: 'approved', rationale: 'ok' },
      });

      await assessTaskCompletion(task, 'done');

      const args = generateObjectStub.firstCall.args[0];
      expect(args.providerOptions.google.thinkingConfig).to.deep.equal({ thinkingBudget: 4096 });
    });

    it('carries previous chat messages into the request', async () => {
      generateObjectStub.resolves({
        object: { verdict: 'approved', rationale: 'ok' },
      });

      const previousMessages = [
        { role: 'user', content: 'Can I submit a summary instead of a photo?' },
        { role: 'assistant', content: 'Yes, a summary is fine.' },
      ];

      await assessTaskCompletion(task, 'Here is my summary.', [], previousMessages);

      const args = generateObjectStub.firstCall.args[0];
      // system + 2 previous + 1 current = 4
      expect(args.messages).to.have.lengthOf(4);
      expect(args.messages[1]).to.deep.equal(previousMessages[0]);
      expect(args.messages[3]).to.deep.equal({ role: 'user', content: 'Here is my summary.' });
    });

    it('mentions attachment references in the user message', async () => {
      generateObjectStub.resolves({
        object: { verdict: 'approved', rationale: 'ok' },
      });

      await assessTaskCompletion(task, 'See attached', ['photo1.jpg']);

      const args = generateObjectStub.firstCall.args[0];
      expect(args.messages[1].content).to.include('photo1.jpg');
    });

    it('wraps generateObject errors with a task-level message', async () => {
      generateObjectStub.rejects(new Error('upstream 500'));
      await expect(assessTaskCompletion(task, 'done'))
        .to.be.rejectedWith(/Failed to assess task.*upstream 500/);
    });
  });
});
