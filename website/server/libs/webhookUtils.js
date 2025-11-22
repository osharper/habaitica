import logger from './logger';

// Rate limiting storage: userId -> { minute: count, day: count, lastMinuteReset, lastDayReset }
const rateLimits = new Map();

// Rate limit constants
const MAX_WEBHOOKS_PER_MINUTE = 10;
const MAX_WEBHOOKS_PER_DAY = 100;

/**
 * Check if user has exceeded rate limits
 * @param {String} userId - User ID
 * @returns {Object} { allowed: Boolean, reason: String }
 */
function checkRateLimit (userId) {
  const now = Date.now();
  let userLimits = rateLimits.get(userId);

  if (!userLimits) {
    userLimits = {
      minute: 0,
      day: 0,
      lastMinuteReset: now,
      lastDayReset: now,
    };
    rateLimits.set(userId, userLimits);
  }

  // Reset minute counter if a minute has passed
  if (now - userLimits.lastMinuteReset >= 60000) {
    userLimits.minute = 0;
    userLimits.lastMinuteReset = now;
  }

  // Reset day counter if a day has passed
  if (now - userLimits.lastDayReset >= 86400000) {
    userLimits.day = 0;
    userLimits.lastDayReset = now;
  }

  // Check limits
  if (userLimits.minute >= MAX_WEBHOOKS_PER_MINUTE) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: Maximum ${MAX_WEBHOOKS_PER_MINUTE} webhooks per minute`,
    };
  }

  if (userLimits.day >= MAX_WEBHOOKS_PER_DAY) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: Maximum ${MAX_WEBHOOKS_PER_DAY} webhooks per day`,
    };
  }

  return { allowed: true };
}

/**
 * Increment rate limit counters for user
 * @param {String} userId - User ID
 */
function incrementRateLimit (userId) {
  const userLimits = rateLimits.get(userId);
  if (userLimits) {
    userLimits.minute += 1;
    userLimits.day += 1;
  }
}

/**
 * Substitute template variables in a string
 * Supported variables: {{userName}}, {{userId}}, {{rewardName}}, {{timestamp}}
 *
 * @param {String} template - Template string with variables
 * @param {Object} context - Context object containing variable values
 * @param {Object} context.user - User object
 * @param {Object} context.reward - Reward object
 * @returns {String} String with variables substituted
 */
function substituteVariables (template, context) {
  if (!template || typeof template !== 'string') return template;

  const { user, reward } = context;
  const timestamp = new Date().toISOString();

  return template
    .replace(/\{\{userName\}\}/g, user?.profile?.name || 'Unknown')
    .replace(/\{\{userId\}\}/g, user?._id || '')
    .replace(/\{\{rewardName\}\}/g, reward?.text || '')
    .replace(/\{\{timestamp\}\}/g, timestamp);
}

/**
 * Substitute variables in an object (headers, body)
 *
 * @param {Object} obj - Object with string values that may contain template variables
 * @param {Object} context - Context object for variable substitution
 * @returns {Object} New object with variables substituted
 */
function substituteObjectVariables (obj, context) {
  if (!obj || typeof obj !== 'object') return obj;

  const result = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string') {
      result[key] = substituteVariables(value, context);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = substituteObjectVariables(value, context);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Execute a webhook with template variable substitution and rate limiting
 *
 * @param {Object} webhookConfig - Webhook configuration
 * @param {Object} context - Context for variable substitution
 * @param {Object} options - Options
 * @param {Boolean} options.skipRateLimit - Skip rate limiting (for testing)
 * @returns {Promise<Object>} Response from webhook
 */
export async function executeWebhook (webhookConfig, context, options = {}) {
  const axios = require('axios');
  const { user } = context;

  // Check rate limit unless explicitly skipped (e.g., for testing)
  if (!options.skipRateLimit && user) {
    const rateLimitCheck = checkRateLimit(user._id);
    if (!rateLimitCheck.allowed) {
      logger.warn(`Webhook rate limit exceeded for user ${user._id}`);
      return {
        success: false,
        statusCode: 429,
        error: rateLimitCheck.reason,
      };
    }
  }

  // Substitute variables in URL
  const url = substituteVariables(webhookConfig.url, context);

  // Substitute variables in headers
  const headers = substituteObjectVariables(webhookConfig.headers || {}, context);

  // Substitute variables in body
  let body = substituteObjectVariables(webhookConfig.body || {}, context);

  const requestConfig = {
    method: webhookConfig.method || 'POST',
    url,
    headers,
    timeout: webhookConfig.timeout || 5000,
  };

  // Add body for POST and PUT requests
  if (requestConfig.method !== 'GET' && body) {
    requestConfig.data = body;
  }

  try {
    const response = await axios(requestConfig);

    // Increment rate limit counter on successful execution
    if (user && !options.skipRateLimit) {
      incrementRateLimit(user._id);
    }

    return {
      success: true,
      statusCode: response.status,
      data: response.data,
    };
  } catch (error) {
    logger.error(error, 'Webhook execution error');

    // Still increment rate limit on failed attempts to prevent spam
    if (user && !options.skipRateLimit) {
      incrementRateLimit(user._id);
    }

    return {
      success: false,
      statusCode: error.response?.status || 0,
      error: error.message,
    };
  }
}

export {
  substituteVariables,
  substituteObjectVariables,
};
