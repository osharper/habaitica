# Reward Actions Implementation Task List

This document provides a step-by-step task breakdown for implementing the Reward Actions feature. Tasks are organized by implementation phase and component.

---

## Phase 1: Core Foundation (Backend)

### Task 1: Data Model Implementation

**File**: `website/server/models/task.js`

**Steps**:
1. Add new fields to RewardSchema:
   - `actionEnabled: Boolean`
   - `actionType: String` (enum)
   - `actionConfig: Object` (with nested structure for clientAction, webhook, apiPolling)
   - `lastPurchased: Date`
   - `lastPurchasedBy: String`
   - `purchaseHistory: Array`
   - `webhookLogs: Array`

2. Add default values in schema definition
3. Add validation for actionType enum values
4. Add validation for actionConfig structure based on actionType

**Expected Outcome**: Reward documents can store action configuration data

**Testing**:
- Create reward with actionEnabled = true
- Verify all fields save correctly
- Test enum validation for actionType

---

### Task 2: Update Task Defaults

**File**: `website/common/script/libs/taskDefaults.js`

**Steps**:
1. Add default values for new reward fields:
   ```javascript
   if (task.type === 'reward') {
     defaults(task, {
       actionEnabled: false,
       actionType: null,
       actionConfig: {
         clientAction: { devices: [] },
         webhook: { enabled: false, method: 'POST', headers: {}, body: {} },
         apiPolling: { enabled: false },
       },
       purchaseHistory: [],
     });
   }
   ```

**Expected Outcome**: New rewards have proper default values for action fields

---

### Task 3: API Polling Endpoint

**File**: `website/server/controllers/api-v4/tasks.js` (new file or add to existing)

**Steps**:
1. Create new endpoint handler:
   ```javascript
   api.getRewardPurchaseStatus = {
     method: 'GET',
     url: '/rewards/:rewardId/purchase-status',
     async handler(req, res) {
       // Implementation
     }
   };
   ```

2. Implement handler logic:
   - Validate rewardId parameter
   - Get userId from query parameter or auth
   - Fetch reward from database
   - Check if reward has actionEnabled
   - Calculate purchasedToday based on user's dayStart
   - Calculate minutesSincePurchase
   - Build response object

3. Add authentication (API token or user session)

4. Add rate limiting

**Expected Outcome**: External systems can poll endpoint to check reward purchase status

**API Response Example**:
```json
{
  "success": true,
  "data": {
    "reward": {
      "_id": "reward-uuid",
      "text": "1 Hour Internet"
    },
    "lastPurchased": "2025-11-22T14:30:00.000Z",
    "purchasedToday": true,
    "minutesSincePurchase": 45,
    "actionConfig": { "duration": 60 }
  }
}
```

**Testing**:
- Test endpoint with valid reward ID
- Test purchasedToday calculation with different dayStart values
- Test with reward not yet purchased
- Test authentication
- Test rate limiting

---

### Task 4: Purchase Tracking in scoreTask

**File**: `website/server/libs/tasks/index.js`

**Steps**:
1. Locate the scoreTask function where rewards are purchased (direction = 'down')

2. After successful purchase validation, add:
   ```javascript
   if (task.type === 'reward' && task.actionEnabled && direction === 'down') {
     const purchaseTimestamp = new Date();

     // Update purchase tracking
     task.lastPurchased = purchaseTimestamp;
     task.lastPurchasedBy = user._id;

     // Add to purchase history (keep last 10)
     if (!task.purchaseHistory) task.purchaseHistory = [];
     task.purchaseHistory.unshift({
       timestamp: purchaseTimestamp,
       userId: user._id,
     });
     task.purchaseHistory = task.purchaseHistory.slice(0, 10);

     await task.save();
   }
   ```

3. Initialize response object for action results

**Expected Outcome**: Reward purchases update lastPurchased and purchaseHistory

**Testing**:
- Purchase reward multiple times
- Verify lastPurchased updates
- Verify purchaseHistory contains last 10 purchases
- Verify only action-enabled rewards trigger tracking

---

### Task 5: Basic Frontend - Task Modal Structure

**File**: `website/client/src/components/tasks/taskModal.vue`

**Steps**:
1. Add "Reward Actions" section to modal (for reward type only)

2. Add toggle switch for actionEnabled:
   ```vue
   <div class="custom-control custom-switch">
     <input
       id="action-enabled-switch"
       v-model="task.actionEnabled"
       type="checkbox"
       class="custom-control-input"
     >
     <label for="action-enabled-switch" class="custom-control-label">
       {{ $t('enableRewardActions') }}
     </label>
   </div>
   ```

3. Add conditional section that shows when actionEnabled is true

4. Add action type selector:
   ```vue
   <select v-model="task.actionType" class="form-control">
     <option value="client_action">{{ $t('clientAppAction') }}</option>
     <option value="webhook">{{ $t('webhook') }}</option>
     <option value="api_polling">{{ $t('apiPolling') }}</option>
     <option value="multiple">{{ $t('multipleActions') }}</option>
   </select>
   ```

5. Add placeholder divs for each action type configuration (will implement in later tasks)

6. Add watcher to initialize actionConfig when actionEnabled is toggled

**Expected Outcome**: Task modal shows reward actions section with toggle and action type selector

---

### Task 6: Translation Keys (Phase 1)

**File**: `website/common/locales/en/tasks.json`

**Steps**:
1. Add basic translation keys:
   ```json
   {
     "rewardActions": "Reward Actions",
     "enableRewardActions": "Enable Reward Actions",
     "rewardActionsTooltip": "Configure actions that execute when this reward is purchased",
     "actionType": "Action Type",
     "clientAppAction": "Client App Action",
     "webhook": "Webhook",
     "apiPolling": "API Polling",
     "multipleActions": "Multiple Actions",
     "clientActionDescription": "Execute actions in your connected apps",
     "webhookDescription": "Send HTTP request to external URL",
     "apiPollingDescription": "Allow external systems to check purchase status",
     "multipleActionsDescription": "Combine multiple action types"
   }
   ```

**Expected Outcome**: UI has proper translations for basic reward actions

---

### Task 7: Vuex Store Actions (Placeholder)

**File**: `website/client/src/store/actions/tasks.js`

**Steps**:
1. Add placeholder action for testing webhooks (will implement fully in Phase 2):
   ```javascript
   export async function testWebhook(store, { webhook }) {
     // Placeholder for now
     console.log('Test webhook:', webhook);
     return { success: true, statusCode: 200 };
   }
   ```

**Expected Outcome**: Store action exists for future webhook testing

---

## Phase 2: API Polling Implementation

### Task 8: API Polling UI Configuration

**File**: `website/client/src/components/tasks/taskModal.vue`

**Steps**:
1. Create `showApiPollingConfig` computed property:
   ```javascript
   showApiPollingConfig() {
     return this.task.actionType === 'api_polling' ||
            this.task.actionType === 'multiple';
   }
   ```

2. Implement API Polling configuration panel:
   ```vue
   <div v-if="showApiPollingConfig" class="action-config-panel">
     <h6>{{ $t('apiPollingConfiguration') }}</h6>

     <!-- API Endpoint Display -->
     <div class="alert alert-info">
       <strong>{{ $t('apiPollingEndpoint') }}:</strong>
       <div class="input-group mt-2">
         <input
           :value="apiPollingEndpoint"
           type="text"
           class="form-control font-monospace small"
           readonly
         >
         <div class="input-group-append">
           <button
             class="btn btn-outline-secondary"
             type="button"
             @click="copyApiEndpoint"
           >
             {{ endpointCopied ? $t('copied') : $t('copy') }}
           </button>
         </div>
       </div>
     </div>

     <!-- Last Purchased Display -->
     <div class="mt-3">
       <label><strong>{{ $t('lastPurchased') }}:</strong></label>
       <p v-if="task.lastPurchased">
         {{ formatLastPurchased(task.lastPurchased) }}
       </p>
       <p v-else class="text-muted">{{ $t('notPurchasedYet') }}</p>
     </div>

     <!-- Example Usage -->
     <div class="mt-3">
       <label><strong>{{ $t('exampleUsage') }}:</strong></label>
       <pre class="bg-light p-3 small">{{ apiPollingExample }}</pre>
     </div>
   </div>
   ```

3. Add computed property for API endpoint:
   ```javascript
   apiPollingEndpoint() {
     if (!this.task._id) return this.$t('saveRewardFirst');
     const baseUrl = window.location.origin;
     const userId = this.$store.state.user.data._id;
     return `${baseUrl}/api/v4/rewards/${this.task._id}/purchase-status?userId=${userId}`;
   }
   ```

4. Add computed property for example code:
   ```javascript
   apiPollingExample() {
     return `# OpenWrt router script example
#!/bin/sh
ENDPOINT="${this.apiPollingEndpoint}"
PURCHASED=$(curl -s "$ENDPOINT" | jq -r '.data.purchasedToday')

if [ "$PURCHASED" = "true" ]; then
  # Unblock internet access
  iptables -D FORWARD -s 192.168.1.100 -j DROP
  logger "Internet access granted via Habitica reward"
fi`;
   }
   ```

5. Implement copyApiEndpoint method:
   ```javascript
   async copyApiEndpoint() {
     try {
       await navigator.clipboard.writeText(this.apiPollingEndpoint);
       this.endpointCopied = true;
       setTimeout(() => { this.endpointCopied = false; }, 2000);
     } catch (error) {
       console.error('Failed to copy:', error);
     }
   }
   ```

6. Add data properties: `endpointCopied: false`

**Expected Outcome**: Users can see and copy their API polling endpoint with usage examples

**Testing**:
- Create reward with API polling enabled
- Verify endpoint URL is generated correctly
- Test copy button functionality
- Verify example code displays correctly

---

### Task 9: API Polling Translation Keys

**File**: `website/common/locales/en/tasks.json`

**Steps**:
1. Add API polling-specific keys:
   ```json
   {
     "apiPollingConfiguration": "API Polling Configuration",
     "apiPollingEndpoint": "API Endpoint",
     "copy": "Copy",
     "copied": "Copied!",
     "lastPurchased": "Last Purchased",
     "notPurchasedYet": "Not purchased yet",
     "exampleUsage": "Example Usage",
     "saveRewardFirst": "Save reward to generate endpoint"
   }
   ```

**Expected Outcome**: API polling UI has proper translations

---

### Task 10: Purchase Status Endpoint Testing

**Steps**:
1. Create test reward with actionType = 'api_polling'
2. Purchase the reward
3. Test API endpoint:
   ```bash
   curl "http://localhost:3000/api/v4/rewards/REWARD_ID/purchase-status?userId=USER_ID"
   ```
4. Verify response structure matches specification
5. Test purchasedToday calculation
6. Test with reward not purchased

**Expected Outcome**: API endpoint returns correct purchase status

---

### Task 11: API Polling Documentation

**File**: Create `docs/reward-actions-api-polling.md`

**Steps**:
1. Document API endpoint:
   - URL structure
   - Query parameters
   - Response format
   - Authentication options

2. Provide integration examples:
   - OpenWrt router script
   - Python polling script
   - Shell script for cron jobs

3. Add troubleshooting section

**Expected Outcome**: Developers have clear documentation for integrating with API polling

---

## Phase 3: Webhook Implementation

### Task 12: Webhook Executor Service

**File**: `website/server/libs/rewards/webhookExecutor.js` (NEW)

**Steps**:
1. Create new service file with core structure:
   ```javascript
   import axios from 'axios';

   export async function executeRewardWebhook(reward, user, purchaseTimestamp) {
     // Implementation
   }

   function substituteVariables(obj, context) {
     // Template variable substitution
   }

   async function logWebhookExecution(reward, success, statusCode, error) {
     // Logging implementation
   }
   ```

2. Implement variable substitution:
   ```javascript
   function substituteVariables(obj, context) {
     if (typeof obj === 'string') {
       return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
         return context[key] !== undefined ? context[key] : match;
       });
     }
     if (Array.isArray(obj)) {
       return obj.map(item => substituteVariables(item, context));
     }
     if (typeof obj === 'object' && obj !== null) {
       const result = {};
       for (const [key, value] of Object.entries(obj)) {
         result[key] = substituteVariables(value, context);
       }
       return result;
     }
     return obj;
   }
   ```

3. Implement webhook execution:
   ```javascript
   export async function executeRewardWebhook(reward, user, purchaseTimestamp) {
     const { webhook } = reward.actionConfig;

     if (!webhook || !webhook.enabled) return null;

     // Build template context
     const context = {
       userId: user._id,
       userName: user.profile.name,
       userEmail: user.auth.local?.email,
       rewardId: reward._id,
       rewardName: reward.text,
       timestamp: purchaseTimestamp.toISOString(),
       apiToken: user.apiToken, // Use with caution
     };

     // Process template variables
     const processedUrl = substituteVariables(webhook.url, context);
     const processedHeaders = substituteVariables(webhook.headers, context);
     const processedBody = substituteVariables(webhook.body, context);

     try {
       const response = await axios({
         method: webhook.method || 'POST',
         url: processedUrl,
         headers: processedHeaders,
         data: processedBody,
         timeout: webhook.timeout || 5000,
         validateStatus: (status) => status < 500,
       });

       await logWebhookExecution(reward, true, response.status, null);

       return {
         success: true,
         statusCode: response.status,
         data: response.data,
       };
     } catch (error) {
       await logWebhookExecution(reward, false, null, error.message);

       return {
         success: false,
         error: error.message,
       };
     }
   }
   ```

4. Implement logging:
   ```javascript
   async function logWebhookExecution(reward, success, statusCode, error) {
     if (!reward.webhookLogs) reward.webhookLogs = [];

     reward.webhookLogs.unshift({
       timestamp: new Date(),
       success,
       statusCode,
       error,
     });

     // Keep last 20 logs
     reward.webhookLogs = reward.webhookLogs.slice(0, 20);

     await reward.save();
   }
   ```

**Expected Outcome**: Service can execute webhooks with template variable substitution

**Testing**:
- Test with RequestBin or webhook.site to capture requests
- Test variable substitution
- Test different HTTP methods
- Test timeout handling
- Test error cases

---

### Task 13: Integrate Webhook Execution into scoreTask

**File**: `website/server/libs/tasks/index.js`

**Steps**:
1. Import webhook executor at top of file:
   ```javascript
   import { executeRewardWebhook } from '../rewards/webhookExecutor.js';
   ```

2. In scoreTask function, after purchase tracking (from Task 4), add:
   ```javascript
   // Execute webhook if configured
   if (task.actionType === 'webhook' || task.actionType === 'multiple') {
     if (task.actionConfig?.webhook?.enabled) {
       const webhookResult = await executeRewardWebhook(task, user, purchaseTimestamp);

       if (!response.rewardAction) response.rewardAction = {};
       response.rewardAction.webhookStatus = webhookResult;
     }
   }
   ```

**Expected Outcome**: Webhooks execute automatically when rewards with webhook actions are purchased

**Testing**:
- Purchase reward with webhook configured
- Verify webhook is called with correct data
- Verify response includes webhook status
- Test webhook failures

---

### Task 14: Webhook Configuration UI

**File**: `website/client/src/components/tasks/taskModal.vue`

**Steps**:
1. Add computed property:
   ```javascript
   showWebhookConfig() {
     return this.task.actionType === 'webhook' ||
            this.task.actionType === 'multiple';
   }
   ```

2. Add data properties:
   ```javascript
   data() {
     return {
       webhookBodyJson: '',
       webhookHeaders: [],
       showHeadersEditor: false,
       testingWebhook: false,
       webhookTestResult: null,
     };
   }
   ```

3. Implement webhook configuration panel:
   ```vue
   <div v-if="showWebhookConfig" class="action-config-panel">
     <h6>{{ $t('webhookConfiguration') }}</h6>

     <!-- URL Input -->
     <div class="form-group">
       <label>{{ $t('webhookUrl') }}</label>
       <input
         v-model="task.actionConfig.webhook.url"
         type="url"
         class="form-control"
         placeholder="https://example.com/api/webhook"
       >
       <small class="form-text text-muted">
         {{ $t('webhookUrlHint') }}
       </small>
     </div>

     <!-- Method Selector -->
     <div class="form-group">
       <label>{{ $t('method') }}</label>
       <select v-model="task.actionConfig.webhook.method" class="form-control">
         <option value="GET">GET</option>
         <option value="POST">POST</option>
         <option value="PUT">PUT</option>
       </select>
     </div>

     <!-- Headers Editor (collapsible) -->
     <div class="form-group">
       <label>
         {{ $t('headers') }}
         <button
           type="button"
           class="btn btn-sm btn-link"
           @click="showHeadersEditor = !showHeadersEditor"
         >
           {{ showHeadersEditor ? $t('hide') : $t('edit') }}
         </button>
       </label>
       <div v-if="showHeadersEditor" class="headers-editor">
         <div
           v-for="(header, index) in webhookHeaders"
           :key="index"
           class="input-group mb-2"
         >
           <input
             v-model="header.key"
             type="text"
             class="form-control"
             placeholder="Header-Name"
           >
           <input
             v-model="header.value"
             type="text"
             class="form-control"
             placeholder="Header value"
           >
           <div class="input-group-append">
             <button
               class="btn btn-outline-danger"
               type="button"
               @click="removeHeader(index)"
             >×</button>
           </div>
         </div>
         <button
           type="button"
           class="btn btn-sm btn-secondary"
           @click="addHeader"
         >
           {{ $t('addHeader') }}
         </button>
       </div>
     </div>

     <!-- Request Body -->
     <div class="form-group">
       <label>
         {{ $t('requestBody') }} (JSON)
         <small class="text-muted">{{ $t('supportsVariables') }}</small>
       </label>
       <textarea
         v-model="webhookBodyJson"
         class="form-control font-monospace"
         rows="6"
         placeholder='{"user": "{{userName}}", "timestamp": "{{timestamp}}"}'
       ></textarea>
       <small class="form-text text-muted">
         {{ $t('availableVariables') }}:
         <code>{{userName}}</code>, <code>{{userId}}</code>,
         <code>{{timestamp}}</code>, <code>{{rewardName}}</code>
       </small>
     </div>

     <!-- Test Button -->
     <button
       type="button"
       class="btn btn-outline-primary btn-sm"
       @click="testWebhook"
       :disabled="testingWebhook"
     >
       <span v-if="!testingWebhook">{{ $t('testWebhook') }}</span>
       <span v-else>
         <span class="spinner-border spinner-border-sm mr-2"></span>
         {{ $t('testing') }}
       </span>
     </button>

     <!-- Test Result -->
     <div v-if="webhookTestResult" class="mt-2">
       <div
         class="alert"
         :class="webhookTestResult.success ? 'alert-success' : 'alert-danger'"
       >
         {{ webhookTestResult.message }}
       </div>
     </div>
   </div>
   ```

4. Implement methods:
   ```javascript
   methods: {
     addHeader() {
       this.webhookHeaders.push({ key: '', value: '' });
     },

     removeHeader(index) {
       this.webhookHeaders.splice(index, 1);
     },

     async testWebhook() {
       this.testingWebhook = true;
       this.webhookTestResult = null;

       try {
         // Convert headers array to object
         const headers = {};
         this.webhookHeaders.forEach(h => {
           if (h.key) headers[h.key] = h.value;
         });

         // Parse JSON body
         let body = {};
         try {
           body = JSON.parse(this.webhookBodyJson || '{}');
         } catch (e) {
           throw new Error('Invalid JSON in request body');
         }

         const response = await this.$store.dispatch('tasks:testWebhook', {
           webhook: {
             url: this.task.actionConfig.webhook.url,
             method: this.task.actionConfig.webhook.method,
             headers,
             body,
           },
         });

         this.webhookTestResult = {
           success: true,
           message: this.$t('webhookTestSuccess', {
             statusCode: response.statusCode
           }),
         };
       } catch (error) {
         this.webhookTestResult = {
           success: false,
           message: this.$t('webhookTestFailed', { error: error.message }),
         };
       } finally {
         this.testingWebhook = false;
       }
     },
   }
   ```

5. Add watchers to sync headers and body between UI and model:
   ```javascript
   watch: {
     webhookHeaders: {
       deep: true,
       handler(headers) {
         const headerObj = {};
         headers.forEach(h => {
           if (h.key) headerObj[h.key] = h.value;
         });
         this.$set(this.task.actionConfig.webhook, 'headers', headerObj);
       },
     },

     webhookBodyJson(json) {
       try {
         const body = JSON.parse(json || '{}');
         this.$set(this.task.actionConfig.webhook, 'body', body);
       } catch (e) {
         // Invalid JSON, don't update
       }
     },

     // Initialize from existing data
     'task.actionConfig.webhook.headers': {
       immediate: true,
       handler(headers) {
         if (!headers) return;
         this.webhookHeaders = Object.entries(headers).map(([key, value]) => ({
           key, value
         }));
       },
     },

     'task.actionConfig.webhook.body': {
       immediate: true,
       handler(body) {
         if (!body) return;
         this.webhookBodyJson = JSON.stringify(body, null, 2);
       },
     },
   }
   ```

**Expected Outcome**: Users can configure webhooks with URL, method, headers, and body

**Testing**:
- Test URL input
- Test method selection
- Test adding/removing headers
- Test JSON body editing
- Test variable documentation display

---

### Task 15: Webhook Test Endpoint

**File**: `website/server/controllers/api-v3/tasks.js`

**Steps**:
1. Add new test endpoint:
   ```javascript
   api.testRewardWebhook = {
     method: 'POST',
     url: '/tasks/test-webhook',
     middlewares: [authWithHeaders()],
     async handler(req, res) {
       const { webhook } = req.body;
       const { user } = res.locals;

       // Validate webhook config
       if (!webhook || !webhook.url) {
         throw new BadRequest('Webhook URL is required');
       }

       // Create test reward object
       const testReward = {
         _id: 'test',
         text: 'Test Reward',
         actionConfig: { webhook },
       };

       // Execute webhook
       const { executeRewardWebhook } = await import('../../libs/rewards/webhookExecutor.js');
       const result = await executeRewardWebhook(testReward, user, new Date());

       res.respond(200, result);
     },
   };
   ```

**Expected Outcome**: Users can test webhooks from the UI before saving

**Testing**:
- Test with valid webhook URL (use webhook.site)
- Test with invalid URL
- Test timeout scenarios

---

### Task 16: Webhook Translation Keys

**File**: `website/common/locales/en/tasks.json`

**Steps**:
1. Add webhook-specific keys:
   ```json
   {
     "webhookConfiguration": "Webhook Configuration",
     "webhookUrl": "Webhook URL",
     "webhookUrlPlaceholder": "https://example.com/api/webhook",
     "webhookUrlHint": "The URL that will receive the HTTP request",
     "method": "HTTP Method",
     "headers": "Headers",
     "requestBody": "Request Body",
     "webhookBodyPlaceholder": "{\"user\": \"{{userName}}\"}",
     "supportsVariables": "Supports template variables",
     "availableVariables": "Available variables",
     "testWebhook": "Test Webhook",
     "testing": "Testing...",
     "webhookTestSuccess": "Webhook test successful! Status: {statusCode}",
     "webhookTestFailed": "Webhook test failed: {error}",
     "addHeader": "Add Header",
     "headerName": "Header Name",
     "headerValue": "Header Value",
     "hide": "Hide",
     "edit": "Edit"
   }
   ```

**Expected Outcome**: Webhook UI has proper translations

---

### Task 17: Webhook Store Action

**File**: `website/client/src/store/actions/tasks.js`

**Steps**:
1. Replace placeholder from Task 7 with real implementation:
   ```javascript
   export async function testWebhook(store, { webhook }) {
     const response = await axios.post('/api/v3/tasks/test-webhook', {
       webhook,
     });
     return response.data.data;
   }
   ```

**Expected Outcome**: Test webhook button works correctly

---

### Task 18: Webhook Security & Rate Limiting

**File**: `website/server/middlewares/rateLimiter.js` (or create new)

**Steps**:
1. Create rate limiter for webhook executions:
   ```javascript
   import rateLimit from 'express-rate-limit';

   export const webhookRateLimit = rateLimit({
     windowMs: 60 * 1000, // 1 minute
     max: 10, // 10 requests per minute
     message: 'Too many webhook executions, please try again later',
     keyGenerator: (req) => req.user._id,
   });
   ```

2. Apply to test webhook endpoint

3. Add per-user webhook execution tracking in webhookExecutor:
   ```javascript
   // Check daily limit
   const today = moment().startOf('day');
   const executionsToday = await getWebhookExecutionCount(user._id, today);
   if (executionsToday >= 100) {
     throw new Error('Daily webhook execution limit reached (100)');
   }
   ```

**Expected Outcome**: Webhook executions are rate limited

---

## Phase 4: Client Actions Implementation

### Task 19: Client Action Broadcaster Service

**File**: `website/server/libs/rewards/clientActionBroadcaster.js` (NEW)

**Steps**:
1. Create new service file:
   ```javascript
   import { sendNotification } from '../pushNotifications';

   export async function broadcastClientAction(reward, user) {
     const { clientAction } = reward.actionConfig;

     if (!clientAction) return null;

     const actionPayload = {
       rewardId: reward._id,
       rewardName: reward.text,
       actionType: 'client_action',
       action: clientAction.action,
       duration: clientAction.duration,
       devices: clientAction.devices,
       customPayload: clientAction.customPayload,
       timestamp: new Date().toISOString(),
     };

     // Send push notification to all user's registered mobile devices
     await sendNotification(user, {
       title: 'Reward Claimed',
       message: `${reward.text} - Action triggered`,
       identifier: 'rewardAction',
       category: 'rewardAction',
       payload: actionPayload,
     });

     return actionPayload;
   }
   ```

**Expected Outcome**: Push notifications sent to user's native mobile apps (iOS/Android) with action payload

**Note**: Uses existing Firebase Cloud Messaging (FCM) and Apple Push Notification (APN) infrastructure

---

### Task 20: Integrate Client Action Broadcasting into scoreTask

**File**: `website/server/libs/tasks/index.js`

**Steps**:
1. Import broadcaster:
   ```javascript
   import { broadcastClientAction } from '../rewards/clientActionBroadcaster.js';
   ```

2. In scoreTask, after webhook execution, add:
   ```javascript
   // Broadcast client action if configured
   if (task.actionType === 'client_action' || task.actionType === 'multiple') {
     if (task.actionConfig?.clientAction) {
       const clientActionResult = await broadcastClientAction(task, user);

       if (!response.rewardAction) response.rewardAction = {};
       response.rewardAction.clientAction = clientActionResult;
     }
   }
   ```

**Expected Outcome**: Client actions broadcast when rewards are purchased

---

### Task 21: Client Action Configuration UI

**File**: `website/client/src/components/tasks/taskModal.vue`

**Steps**:
1. Add computed property:
   ```javascript
   showClientActionConfig() {
     return this.task.actionType === 'client_action' ||
            this.task.actionType === 'multiple';
   }
   ```

2. Add data properties:
   ```javascript
   data() {
     return {
       newDevice: '',
       customPayloadJson: '',
     };
   }
   ```

3. Implement client action configuration panel:
   ```vue
   <div v-if="showClientActionConfig" class="action-config-panel">
     <h6>{{ $t('clientActionConfiguration') }}</h6>

     <!-- Action Type Selector -->
     <div class="form-group">
       <label>{{ $t('action') }}</label>
       <select
         v-model="task.actionConfig.clientAction.action"
         class="form-control"
       >
         <option value="unblock_device">{{ $t('unblockDevice') }}</option>
         <option value="notification">{{ $t('notification') }}</option>
         <option value="custom">{{ $t('custom') }}</option>
       </select>
     </div>

     <!-- Duration (for unblock_device) -->
     <div
       v-if="task.actionConfig.clientAction.action === 'unblock_device'"
       class="form-group"
     >
       <label>{{ $t('duration') }} ({{ $t('minutes') }})</label>
       <input
         v-model.number="task.actionConfig.clientAction.duration"
         type="number"
         class="form-control"
         min="1"
         max="1440"
         placeholder="30"
       >
     </div>

     <!-- Devices (for unblock_device) -->
     <div
       v-if="task.actionConfig.clientAction.action === 'unblock_device'"
       class="form-group"
     >
       <label>{{ $t('devices') }}</label>

       <!-- Device Tags -->
       <div class="device-tags mb-2">
         <span
           v-for="(device, index) in task.actionConfig.clientAction.devices"
           :key="index"
           class="badge badge-primary mr-2 mb-2"
         >
           {{ device }}
           <button
             type="button"
             class="close ml-2"
             @click="removeDevice(index)"
           >×</button>
         </span>
       </div>

       <!-- Add Device Input -->
       <div class="input-group">
         <input
           v-model="newDevice"
           type="text"
           class="form-control"
           :placeholder="$t('addDevice')"
           @keydown.enter.prevent="addDevice"
         >
         <div class="input-group-append">
           <button
             class="btn btn-secondary"
             type="button"
             @click="addDevice"
           >
             {{ $t('add') }}
           </button>
         </div>
       </div>

       <small class="form-text text-muted">
         {{ $t('devicesHint') }}
       </small>
     </div>

     <!-- Custom Payload (for custom action) -->
     <div
       v-if="task.actionConfig.clientAction.action === 'custom'"
       class="form-group"
     >
       <label>{{ $t('customPayload') }} (JSON)</label>
       <textarea
         v-model="customPayloadJson"
         class="form-control font-monospace"
         rows="4"
         placeholder='{"message": "Custom action", "data": {...}}'
       ></textarea>
     </div>
   </div>
   ```

4. Implement methods:
   ```javascript
   methods: {
     addDevice() {
       if (!this.newDevice.trim()) return;

       if (!this.task.actionConfig.clientAction.devices) {
         this.$set(this.task.actionConfig.clientAction, 'devices', []);
       }

       this.task.actionConfig.clientAction.devices.push(this.newDevice.trim());
       this.newDevice = '';
     },

     removeDevice(index) {
       this.task.actionConfig.clientAction.devices.splice(index, 1);
     },
   }
   ```

5. Add watcher for custom payload:
   ```javascript
   watch: {
     customPayloadJson(json) {
       try {
         const payload = JSON.parse(json || '{}');
         this.$set(this.task.actionConfig.clientAction, 'customPayload', payload);
       } catch (e) {
         // Invalid JSON
       }
     },

     'task.actionConfig.clientAction.customPayload': {
       immediate: true,
       handler(payload) {
         if (!payload) return;
         this.customPayloadJson = JSON.stringify(payload, null, 2);
       },
     },
   }
   ```

**Expected Outcome**: Users can configure client actions with devices and durations

**Testing**:
- Test action type selection
- Test adding/removing devices
- Test duration input
- Test custom payload JSON editing

---

### Task 22: Client Action Translation Keys

**File**: `website/common/locales/en/tasks.json`

**Steps**:
1. Add client action keys:
   ```json
   {
     "clientActionConfiguration": "Client Action Configuration",
     "action": "Action",
     "unblockDevice": "Unblock Device",
     "notification": "Show Notification",
     "custom": "Custom Action",
     "duration": "Duration",
     "minutes": "minutes",
     "devices": "Devices",
     "addDevice": "Enter device identifier",
     "add": "Add",
     "devicesHint": "Add device identifiers (e.g., 'gaming_pc', 'phone'). These will be used by your client apps.",
     "customPayload": "Custom Payload",
     "customPayloadPlaceholder": "{\"message\": \"Reward claimed!\"}"
   }
   ```

**Expected Outcome**: Client action UI has proper translations

---

### Task 23: Web Client Notification Handler

**File**: `website/client/src/mixins/scoreTask.js`

**Steps**:
1. Add method to handleTaskScoreNotifications or create new method:
   ```javascript
   handleRewardAction(rewardAction) {
     const { executed, actionType, webhookStatus, clientAction, apiPolling } = rewardAction;

     if (!executed) return;

     // Display notification for client actions (executed on mobile apps)
     if (clientAction) {
       const actionMessages = {
         unblock_device: this.$t('deviceUnlockedNotification', {
           devices: clientAction.devices.join(', '),
           duration: clientAction.duration
         }),
         notification: this.$t('notificationTriggered'),
         custom: this.$t('customActionTriggered'),
       };

       this.$store.dispatch('snackbars:add', {
         title: this.$t('rewardActionExecuted'),
         text: actionMessages[clientAction.action] || this.$t('actionTriggered'),
         type: 'info',
         timeout: 5000,
       });
     }

     // Display notification for webhook execution
     if (webhookStatus) {
       if (webhookStatus.success) {
         this.$store.dispatch('snackbars:add', {
           title: this.$t('webhookExecuted'),
           text: this.$t('webhookExecutedSuccessfully'),
           type: 'success',
         });
       } else {
         this.$store.dispatch('snackbars:add', {
           title: this.$t('webhookFailed'),
           text: this.$t('webhookExecutionFailed', { error: webhookStatus.error }),
           type: 'error',
         });
       }
     }

     // Display notification for API polling
     if (apiPolling && apiPolling.enabled) {
       this.$store.dispatch('snackbars:add', {
         title: this.$t('rewardPurchased'),
         text: this.$t('apiPollingUpdated'),
         type: 'info',
       });
     }
   }
   ```

2. Call this method in handleTaskScoreNotifications:
   ```javascript
   async handleTaskScoreNotifications(tmpObject = {}) {
     // ... existing code ...

     // Handle reward actions
     if (tmpObject.rewardAction) {
       this.handleRewardAction(tmpObject.rewardAction);
     }
   }
   ```

**Expected Outcome**: Web client displays informational notifications about actions

**Note**: Web client does NOT execute actions - only shows notifications. Actions execute on native mobile apps (via push notifications) and via webhooks (server-side)

---

## Phase 5: Polish & Integration

### Task 24: Action Indicator in Task Display

**File**: `website/client/src/components/tasks/task.vue`

**Steps**:
1. Import action icon SVG (or use existing icon)

2. Add to icons section for rewards:
   ```vue
   <div
     v-if="task.type === 'reward' && task.actionEnabled"
     class="d-flex align-items-center ml-2"
   >
     <div
       v-b-tooltip.hover.bottom="actionTypeLabel"
       class="svg-icon action-icon"
       v-html="icons.lightning"
     ></div>
   </div>
   ```

3. Add computed property:
   ```javascript
   actionTypeLabel() {
     if (!this.task.actionEnabled) return '';

     const labels = {
       client_action: this.$t('hasClientAction'),
       webhook: this.$t('hasWebhook'),
       api_polling: this.$t('hasApiPolling'),
       multiple: this.$t('hasMultipleActions'),
     };

     return labels[this.task.actionType] || this.$t('hasAction');
   }
   ```

4. Add icon styling:
   ```scss
   .action-icon {
     width: 14px;
     height: 14px;
     color: $orange-100;
   }
   ```

**Expected Outcome**: Rewards with actions show a visual indicator

**Testing**:
- Create reward with each action type
- Verify icon appears
- Verify tooltip shows correct text

---

### Task 25: Purchase Success Notifications

**File**: `website/client/src/mixins/scoreTask.js`

**Steps**:
1. Enhance handleTaskScoreNotifications to handle reward actions:
   ```javascript
   async handleTaskScoreNotifications(tmpObject = {}) {
     // ... existing code ...

     // Handle reward actions
     if (tmpObject.rewardAction) {
       this.handleRewardAction(tmpObject.rewardAction);
     }
   }
   ```

2. Add new method:
   ```javascript
   methods: {
     // ... existing methods ...

     handleRewardAction(rewardAction) {
       const { executed, actionType, webhookStatus, clientAction, apiPolling } = rewardAction;

       if (!executed) return;

       // Webhook notification
       if (webhookStatus) {
         if (webhookStatus.success) {
           this.$root.$emit('habitica:notification', {
             type: 'success',
             text: this.$t('webhookExecutedSuccessfully'),
           });
         } else {
           this.$root.$emit('habitica:notification', {
             type: 'error',
             text: this.$t('webhookExecutionFailed', {
               error: webhookStatus.error
             }),
           });
         }
       }

       // Client action notification (action already broadcast)
       if (clientAction) {
         this.$root.$emit('habitica:notification', {
           type: 'info',
           text: this.$t('clientActionTriggered'),
         });
       }

       // API polling notification
       if (apiPolling) {
         this.$root.$emit('habitica:notification', {
           type: 'info',
           text: this.$t('apiPollingUpdated'),
         });
       }
     },
   }
   ```

**Expected Outcome**: Users see notifications when reward actions execute

---

### Task 26: Action Notification Translation Keys

**File**: `website/common/locales/en/tasks.json`

**Steps**:
1. Add notification keys:
   ```json
   {
     "hasClientAction": "Triggers client action",
     "hasWebhook": "Calls webhook",
     "hasApiPolling": "API polling enabled",
     "hasMultipleActions": "Multiple actions",
     "hasAction": "Has action",
     "webhookExecutedSuccessfully": "Webhook executed successfully",
     "webhookExecutionFailed": "Webhook failed: {error}",
     "clientActionTriggered": "Client action triggered",
     "apiPollingUpdated": "Reward purchased - API status updated"
   }
   ```

**Expected Outcome**: Notifications have proper translations

---

### Task 27: Styling for Action Config Panels

**File**: `website/client/src/components/tasks/taskModal.vue`

**Steps**:
1. Add SCSS styles:
   ```scss
   .action-config-panel {
     background-color: $gray-700;
     padding: 16px;
     border-radius: 8px;
     margin-top: 12px;
     border: 1px solid $gray-500;

     h6 {
       font-weight: 600;
       margin-bottom: 16px;
       color: $gray-10;
     }
   }

   .device-tags {
     min-height: 32px;

     .badge {
       font-size: 13px;
       padding: 6px 10px;

       .close {
         font-size: 18px;
         line-height: 1;
         opacity: 0.8;

         &:hover {
           opacity: 1;
         }
       }
     }
   }

   .font-monospace {
     font-family: 'Courier New', Courier, monospace;
     font-size: 12px;
     line-height: 1.5;
   }

   .headers-editor {
     border: 1px solid $gray-400;
     border-radius: 4px;
     padding: 12px;
     background-color: $gray-600;
   }

   .reward-actions-header {
     padding-bottom: 8px;
     border-bottom: 1px solid $gray-500;

     .info-icon {
       width: 16px;
       height: 16px;
       color: $gray-200;
       cursor: help;
     }
   }
   ```

**Expected Outcome**: Action configuration UI looks polished and consistent

---

### Task 28: Error Handling & Validation

**Steps**:

1. **Backend Validation** (`website/server/models/task.js`):
   ```javascript
   // Add custom validation
   RewardSchema.pre('save', function(next) {
     if (this.actionEnabled) {
       // Validate webhook URL if webhook is enabled
       if (this.actionConfig?.webhook?.enabled) {
         const url = this.actionConfig.webhook.url;
         if (!url || !url.match(/^https?:\/\/.+/)) {
           return next(new Error('Valid webhook URL is required'));
         }
       }

       // Validate client action duration
       if (this.actionConfig?.clientAction?.duration) {
         if (this.actionConfig.clientAction.duration < 1 ||
             this.actionConfig.clientAction.duration > 1440) {
           return next(new Error('Duration must be between 1 and 1440 minutes'));
         }
       }
     }
     next();
   });
   ```

2. **Frontend Validation** (`taskModal.vue`):
   ```javascript
   computed: {
     canSaveReward() {
       if (!this.task.actionEnabled) return true;

       // Webhook validation
       if (this.showWebhookConfig && this.task.actionConfig.webhook.enabled) {
         const url = this.task.actionConfig.webhook.url;
         if (!url || !url.match(/^https?:\/\/.+/)) {
           return false;
         }
       }

       // Client action validation
       if (this.showClientActionConfig) {
         if (this.task.actionConfig.clientAction.action === 'unblock_device') {
           if (!this.task.actionConfig.clientAction.duration ||
               this.task.actionConfig.clientAction.duration < 1) {
             return false;
           }
         }
       }

       return true;
     },
   }
   ```

3. **Error Messages**:
   - Show validation errors in UI
   - Handle webhook execution failures gracefully
   - Log errors for debugging

**Expected Outcome**: Invalid configurations are caught and reported

---

### Task 29: Documentation

**Files**: Create multiple documentation files

1. **User Guide** (`docs/reward-actions-user-guide.md`):
   - What are reward actions?
   - How to enable and configure
   - Use cases and examples
   - Troubleshooting

2. **API Documentation** (`docs/reward-actions-api.md`):
   - API polling endpoint reference
   - Request/response formats
   - Authentication
   - Rate limits

3. **Integration Guide** (`docs/reward-actions-integrations.md`):
   - OpenWrt router setup
   - Home Assistant integration
   - Custom client app integration
   - Webhook examples for popular services

4. **Developer Guide** (`docs/reward-actions-development.md`):
   - Architecture overview
   - Adding new action types
   - Testing guide
   - Security considerations

**Expected Outcome**: Comprehensive documentation for users and developers

---

## Testing Checklist

### Unit Tests
- [ ] Data model validation
- [ ] Variable substitution in webhooks
- [ ] Purchase tracking logic
- [ ] purchasedToday calculation

### Integration Tests
- [ ] API polling endpoint
- [ ] Webhook execution
- [ ] Client action broadcasting
- [ ] Purchase flow with actions

### UI Tests
- [ ] Task modal action configuration
- [ ] Action type switching
- [ ] Device management
- [ ] Webhook testing
- [ ] API endpoint copying

### End-to-End Tests
- [ ] Create reward with API polling → Purchase → Verify endpoint
- [ ] Create reward with webhook → Purchase → Verify webhook called
- [ ] Create reward with client action → Purchase → Verify event received
- [ ] Create reward with multiple actions → Purchase → Verify all execute

---

## Deployment Checklist

- [ ] Database migration (if needed for existing rewards)
- [ ] Environment variables for Pusher (if not already configured)
- [ ] Rate limiter configuration
- [ ] SSL certificates for webhook execution
- [ ] Documentation published
- [ ] User announcement/changelog
- [ ] Monitor webhook execution logs
- [ ] Monitor API polling endpoint performance

---

This task list provides a complete roadmap for implementing the Reward Actions feature. Each task is designed to be completed independently while building toward the complete feature.
