import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import nconf from 'nconf';

/**
 * Assess a task completion using AI based on user's proof/submission
 * @param {Object} task - The task to assess
 * @param {String} userMessage - User's submission/proof message
 * @param {Array} attachments - Optional array of attachment URLs (images, etc.)
 * @param {Array} previousMessages - Previous chat messages for context
 * @returns {Object} { assessment: 'approved'|'rejected'|'needs_revision', feedback: string }
 */
export async function assessTaskCompletion (task, userMessage, attachments = [], previousMessages = []) {
  const apiKey = nconf.get('GOOGLE_API_KEY');

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not configured');
  }

  // Build the conversation history
  const messages = [
    {
      role: 'system',
      content: `You are an AI assistant helping users stay accountable to their goals in Habitica.
Your role is to assess whether a user has completed their task based on their submission.

Task: ${task.text}
Description: ${task.notes || 'No description provided'}

Guidelines:
- Be encouraging but honest
- If the user provides clear evidence of completion, approve it
- If the evidence is unclear or insufficient, ask for more details or clarification
- If the user clearly hasn't completed the task, kindly reject it and explain why
- For photo evidence: check if it shows what was claimed
- For written summaries: check if it demonstrates understanding/effort

Respond with:
1. Your assessment: APPROVED, REJECTED, or NEEDS_REVISION
2. Constructive feedback (be encouraging!)

Format your response starting with the assessment keyword, followed by your feedback.`,
    },
  ];

  // Add previous conversation history
  previousMessages.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  });

  // Add current user message
  let currentContent = userMessage;
  if (attachments && attachments.length > 0) {
    currentContent += '\n\nAttachments: ' + attachments.join(', ');
  }

  messages.push({
    role: 'user',
    content: currentContent,
  });

  try {
    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      messages,
      temperature: 0.7,
      maxTokens: 500,
    });

    // Parse the response to extract assessment and feedback
    let assessment = 'needs_revision'; // default
    let feedback = text;

    if (text.toUpperCase().includes('APPROVED')) {
      assessment = 'approved';
      feedback = text.replace(/APPROVED:?/i, '').trim();
    } else if (text.toUpperCase().includes('REJECTED')) {
      assessment = 'rejected';
      feedback = text.replace(/REJECTED:?/i, '').trim();
    } else if (text.toUpperCase().includes('NEEDS_REVISION') || text.toUpperCase().includes('NEEDS REVISION')) {
      assessment = 'needs_revision';
      feedback = text.replace(/NEEDS[_\s]REVISION:?/i, '').trim();
    }

    return {
      assessment,
      feedback,
      fullResponse: text,
    };
  } catch (error) {
    console.error('AI Assessment Error:', error);
    throw new Error('Failed to assess task: ' + error.message);
  }
}

/**
 * Generate a chat response for task assessment conversation
 * @param {Object} task - The task being discussed
 * @param {Array} chatHistory - Array of previous messages
 * @param {String} userMessage - New message from user
 * @returns {String} AI response
 */
export async function generateChatResponse (task, chatHistory, userMessage) {
  const apiKey = nconf.get('GOOGLE_API_KEY');

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not configured');
  }

  const messages = [
    {
      role: 'system',
      content: `You are an AI assistant in Habitica helping a user with their task: "${task.text}".
${task.notes ? `Description: ${task.notes}` : ''}

Be helpful, encouraging, and supportive. Answer questions about the task and help the user complete it.`,
    },
  ];

  // Add chat history
  chatHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  });

  // Add new user message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  try {
    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      messages,
      temperature: 0.8,
      maxTokens: 300,
    });

    return text;
  } catch (error) {
    console.error('Chat Generation Error:', error);
    throw new Error('Failed to generate chat response: ' + error.message);
  }
}
