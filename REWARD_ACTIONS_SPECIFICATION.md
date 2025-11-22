# Reward Actions Feature Specification

## Overview

This feature extends Habitica rewards with configurable actions that execute when a reward is purchased. This enables real-world automation scenarios like screen time control, smart home integration, and external service triggers.

## Use Cases

1. **Screen Time Control**: Purchase "30 minutes gaming" reward → unblock gaming app/device for 30 minutes
2. **Internet Access Control**: Purchase "1 hour internet" reward → OpenWrt router allows internet access for 1 hour (via API polling)
3. **Smart Home Integration**: Purchase "Movie time" reward → webhook to Home Assistant to dim lights and start TV
4. **External Service Integration**: Purchase "Coffee break" reward → webhook to Slack/Discord to update status
5. **Custom Automations**: Any service that can poll an API or receive webhooks

## Architecture

### Three Action Types

1. **Client App Actions** - Push notifications sent to native mobile apps (iOS/Android) that execute actions with OS-level permissions (screen time control, device unlocking)
2. **Webhooks** - HTTP requests sent to external URLs when reward is purchased (executed server-side)
3. **API Polling** - External systems poll Habitica API to check if reward was purchased (e.g., routers, custom services)

### Execution Model

**IMPORTANT**: Actions are executed differently depending on the client:

- **Native Mobile Apps (iOS/Android)**: Receive push notifications with action payload and execute actions with OS permissions (screen time management, device controls)
- **Web Client**: Displays informational notifications only - does NOT execute actions (web browsers lack OS-level permissions for device control)
- **Webhooks**: Execute immediately on server when reward is purchased
- **API Polling**: External systems detect purchase and execute their own logic

**Multiple Actions**: A single reward can trigger multiple action types simultaneously (e.g., webhook + client action + API polling)

---

## 1. Data Model

### Reward Schema Extensions (website/server/models/task.js)

```javascript
// Add to RewardSchema
actionEnabled: {
  type: Boolean,
  default: false,
},

actionType: {
  type: String,
  enum: ['client_action', 'webhook', 'api_polling', 'multiple'],
  // 'multiple' allows combining action types
},

// Flexible configuration object for different action types
actionConfig: {
  // Client Action Configuration
  clientAction: {
    action: {
      type: String,
      enum: ['unblock_device', 'notification', 'custom'],
    },
    duration: Number, // in minutes
    devices: [String], // device identifiers
    customPayload: Schema.Types.Mixed, // for extensibility
  },

  // Webhook Configuration
  webhook: {
    enabled: Boolean,
    url: String,
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT'],
      default: 'POST',
    },
    headers: Schema.Types.Mixed, // { "Authorization": "Bearer {{apiToken}}", ... }
    body: Schema.Types.Mixed, // Request body template with variable substitution
    timeout: {
      type: Number,
      default: 5000, // milliseconds
    },
  },

  // API Polling Configuration
  apiPolling: {
    enabled: Boolean,
    // No additional config needed - endpoint is standard
  },
},

// Purchase tracking
lastPurchased: Date,
lastPurchasedBy: {
  type: String,
  ref: 'User',
},

// Optional: Keep limited purchase history
purchaseHistory: [{
  timestamp: { type: Date, default: Date.now },
  userId: String,
  _id: false,
}],

// Webhook execution logs (for debugging)
webhookLogs: [{
  timestamp: { type: Date, default: Date.now },
  success: Boolean,
  statusCode: Number,
  error: String,
  _id: false,
}],
```

### Example Reward Documents

```javascript
// Example 1: Screen time control
{
  text: "30 Minutes Gaming",
  value: 50,
  actionEnabled: true,
  actionType: 'client_action',
  actionConfig: {
    clientAction: {
      action: 'unblock_device',
      duration: 30,
      devices: ['gaming_pc', 'playstation'],
    }
  }
}

// Example 2: Webhook to Home Assistant
{
  text: "Movie Time",
  value: 100,
  actionEnabled: true,
  actionType: 'webhook',
  actionConfig: {
    webhook: {
      enabled: true,
      url: 'https://home-assistant.local/api/webhook/habitica-movie-time',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer {{apiToken}}',
        'Content-Type': 'application/json'
      },
      body: {
        user: '{{userName}}',
        timestamp: '{{timestamp}}',
        action: 'movie_time'
      }
    }
  }
}

// Example 3: API polling for router integration
{
  text: "1 Hour Internet",
  value: 75,
  actionEnabled: true,
  actionType: 'api_polling',
  actionConfig: {
    apiPolling: {
      enabled: true
    }
  },
  lastPurchased: "2025-11-22T14:30:00Z"
}

// Example 4: Multiple actions
{
  text: "Ultimate Reward",
  value: 200,
  actionEnabled: true,
  actionType: 'multiple',
  actionConfig: {
    clientAction: {
      action: 'notification',
      customPayload: { message: 'Reward claimed!' }
    },
    webhook: {
      enabled: true,
      url: 'https://example.com/api/reward-claimed',
      method: 'POST'
    },
    apiPolling: {
      enabled: true
    }
  }
}
```

---

## 2. Backend Implementation

### API Endpoints

#### 2.1 Extend Existing Purchase Endpoint

**`POST /api/v3/tasks/:taskId/score`** (direction = 'down' for rewards)

Enhanced response when reward has actions:

```javascript
{
  success: true,
  data: {
    // ... existing response data
    rewardAction: {
      executed: true,
      actionType: 'webhook',
      clientAction: { /* client action payload if applicable */ },
      webhookStatus: {
        success: true,
        statusCode: 200
      },
      message: 'Reward action executed successfully'
    }
  }
}
```

#### 2.2 New API Polling Endpoint

**`GET /api/v4/rewards/:rewardId/purchase-status`**

Public or token-authenticated endpoint for external polling.

**Query Parameters:**
- `userId` (required) - User ID
- `apiToken` (optional) - For authentication
- `checkToday` (optional, default: false) - Only check if purchased today

**Response:**
```javascript
{
  success: true,
  data: {
    reward: {
      _id: "reward-uuid",
      text: "1 Hour Internet",
      value: 75
    },
    lastPurchased: "2025-11-22T14:30:00.000Z",
    purchasedToday: true, // Based on user's dayStart
    minutesSincePurchase: 45,
    actionConfig: {
      duration: 60 // if applicable
    },
    apiEndpoint: "https://habitica.com/api/v4/rewards/reward-uuid/purchase-status?userId=user-uuid" // for convenience
  }
}
```

**Use Case Example (OpenWrt router script):**
```bash
#!/bin/sh
REWARD_ENDPOINT="https://habitica.com/api/v4/rewards/abc123/purchase-status?userId=user123"
RESPONSE=$(curl -s "$REWARD_ENDPOINT")
PURCHASED_TODAY=$(echo $RESPONSE | jq -r '.data.purchasedToday')

if [ "$PURCHASED_TODAY" = "true" ]; then
  # Unblock internet for this device
  iptables -D FORWARD -s 192.168.1.100 -j DROP
  logger "Habitica reward: Internet access granted"
fi
```

#### 2.3 Webhook Execution Endpoint (Internal)

**Service:** `website/server/libs/rewards/webhookExecutor.js`

```javascript
export async function executeRewardWebhook(reward, user, purchaseTimestamp) {
  const { webhook } = reward.actionConfig;

  if (!webhook || !webhook.enabled) return null;

  // Template variable substitution
  const context = {
    userId: user._id,
    userName: user.profile.name,
    userEmail: user.auth.local?.email,
    rewardId: reward._id,
    rewardName: reward.text,
    timestamp: purchaseTimestamp.toISOString(),
    apiToken: user.apiToken, // Only if user wants to include it
  };

  const processedUrl = substituteVariables(webhook.url, context);
  const processedHeaders = substituteVariables(webhook.headers, context);
  const processedBody = substituteVariables(webhook.body, context);

  try {
    const response = await axios({
      method: webhook.method,
      url: processedUrl,
      headers: processedHeaders,
      data: processedBody,
      timeout: webhook.timeout || 5000,
      validateStatus: (status) => status < 500, // Don't throw on 4xx
    });

    // Log success
    await logWebhookExecution(reward, true, response.status);

    return {
      success: true,
      statusCode: response.status,
      data: response.data,
    };
  } catch (error) {
    // Log failure
    await logWebhookExecution(reward, false, null, error.message);

    return {
      success: false,
      error: error.message,
    };
  }
}

function substituteVariables(obj, context) {
  if (typeof obj === 'string') {
    return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => context[key] || match);
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

#### 2.4 Client Action Broadcasting

**Service:** `website/server/libs/rewards/clientActionBroadcaster.js`

Uses existing Firebase Cloud Messaging (FCM) and Apple Push Notification (APN) infrastructure to send push notifications to native mobile apps:

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

  // Send push notification to all user's registered mobile devices (iOS + Android)
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

**Note**: This sends push notifications ONLY to native mobile apps (iOS/Android). The web client receives action data in the API response for display purposes only.

### Updated scoreTask Function

**File:** `website/server/libs/tasks/index.js`

```javascript
async function scoreTask(options) {
  // ... existing code ...

  // If reward with actions is purchased
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

    // Execute actions based on type
    const actionResults = {
      executed: true,
      actionType: task.actionType,
    };

    // Client Action
    if (task.actionType === 'client_action' || task.actionType === 'multiple') {
      const { broadcastClientAction } = await import('../rewards/clientActionBroadcaster.js');
      actionResults.clientAction = await broadcastClientAction(task, user);
    }

    // Webhook
    if (task.actionType === 'webhook' || task.actionType === 'multiple') {
      const { executeRewardWebhook } = await import('../rewards/webhookExecutor.js');
      actionResults.webhookStatus = await executeRewardWebhook(task, user, purchaseTimestamp);
    }

    // API Polling (no active execution needed, just tracking)
    if (task.actionType === 'api_polling' || task.actionType === 'multiple') {
      actionResults.apiPolling = {
        enabled: true,
        endpoint: `/api/v4/rewards/${task._id}/purchase-status?userId=${user._id}`,
      };
    }

    // Add to response
    response.rewardAction = actionResults;
  }

  // ... existing code ...
  return response;
}
```

---

## 3. Frontend Implementation

### 3.1 Task Modal Extension (taskModal.vue)

Add new section for Reward Actions (shown only for reward type):

```vue
<template>
  <!-- ... existing reward fields ... -->

  <!-- Reward Actions Section -->
  <div v-if="task.type === 'reward'" class="form-group mt-4">
    <div class="reward-actions-header d-flex align-items-center justify-content-between">
      <div>
        <label class="mb-0">
          <strong>{{ $t('rewardActions') }}</strong>
          <b-tooltip target="reward-actions-info" triggers="hover">
            {{ $t('rewardActionsTooltip') }}
          </b-tooltip>
          <span id="reward-actions-info" class="svg-icon info-icon ml-1" v-html="icons.info"></span>
        </label>
      </div>
      <div class="custom-control custom-switch">
        <input
          id="action-enabled-switch"
          v-model="task.actionEnabled"
          type="checkbox"
          class="custom-control-input"
        >
        <label for="action-enabled-switch" class="custom-control-label"></label>
      </div>
    </div>

    <!-- Action Configuration (shown when enabled) -->
    <div v-if="task.actionEnabled" class="reward-actions-config mt-3">
      <!-- Action Type Selector -->
      <div class="form-group">
        <label>{{ $t('actionType') }}</label>
        <select v-model="task.actionType" class="form-control">
          <option value="client_action">{{ $t('clientAppAction') }}</option>
          <option value="webhook">{{ $t('webhook') }}</option>
          <option value="api_polling">{{ $t('apiPolling') }}</option>
          <option value="multiple">{{ $t('multipleActions') }}</option>
        </select>
        <small class="form-text text-muted">{{ actionTypeDescription }}</small>
      </div>

      <!-- Client Action Configuration -->
      <div v-if="showClientActionConfig" class="action-config-panel">
        <h6>{{ $t('clientActionConfiguration') }}</h6>

        <div class="form-group">
          <label>{{ $t('action') }}</label>
          <select v-model="task.actionConfig.clientAction.action" class="form-control">
            <option value="unblock_device">{{ $t('unblockDevice') }}</option>
            <option value="notification">{{ $t('notification') }}</option>
            <option value="custom">{{ $t('custom') }}</option>
          </select>
        </div>

        <div v-if="task.actionConfig.clientAction.action === 'unblock_device'" class="form-group">
          <label>{{ $t('duration') }} ({{ $t('minutes') }})</label>
          <input
            v-model.number="task.actionConfig.clientAction.duration"
            type="number"
            class="form-control"
            min="1"
            max="1440"
          >
        </div>

        <div v-if="task.actionConfig.clientAction.action === 'unblock_device'" class="form-group">
          <label>{{ $t('devices') }}</label>
          <div class="device-tags">
            <span
              v-for="(device, index) in task.actionConfig.clientAction.devices"
              :key="index"
              class="badge badge-primary mr-2 mb-2"
            >
              {{ device }}
              <button type="button" class="close ml-2" @click="removeDevice(index)">×</button>
            </span>
          </div>
          <div class="input-group">
            <input
              v-model="newDevice"
              type="text"
              class="form-control"
              :placeholder="$t('addDevice')"
              @keydown.enter.prevent="addDevice"
            >
            <div class="input-group-append">
              <button class="btn btn-secondary" type="button" @click="addDevice">
                {{ $t('add') }}
              </button>
            </div>
          </div>
          <small class="form-text text-muted">{{ $t('devicesHint') }}</small>
        </div>

        <div v-if="task.actionConfig.clientAction.action === 'custom'" class="form-group">
          <label>{{ $t('customPayload') }} (JSON)</label>
          <textarea
            v-model="customPayloadJson"
            class="form-control"
            rows="4"
            :placeholder="$t('customPayloadPlaceholder')"
          ></textarea>
        </div>
      </div>

      <!-- Webhook Configuration -->
      <div v-if="showWebhookConfig" class="action-config-panel">
        <h6>{{ $t('webhookConfiguration') }}</h6>

        <div class="form-group">
          <label>{{ $t('webhookUrl') }}</label>
          <input
            v-model="task.actionConfig.webhook.url"
            type="url"
            class="form-control"
            :placeholder="$t('webhookUrlPlaceholder')"
          >
          <small class="form-text text-muted">{{ $t('webhookUrlHint') }}</small>
        </div>

        <div class="form-group">
          <label>{{ $t('method') }}</label>
          <select v-model="task.actionConfig.webhook.method" class="form-control">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
          </select>
        </div>

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
              v-for="(value, key, index) in task.actionConfig.webhook.headers"
              :key="index"
              class="input-group mb-2"
            >
              <input
                v-model="webhookHeaders[index].key"
                type="text"
                class="form-control"
                :placeholder="$t('headerName')"
              >
              <input
                v-model="webhookHeaders[index].value"
                type="text"
                class="form-control"
                :placeholder="$t('headerValue')"
              >
              <div class="input-group-append">
                <button
                  class="btn btn-outline-danger"
                  type="button"
                  @click="removeHeader(index)"
                >
                  ×
                </button>
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" @click="addHeader">
              {{ $t('addHeader') }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>
            {{ $t('requestBody') }} (JSON)
            <small class="text-muted">{{ $t('supportsVariables') }}</small>
          </label>
          <textarea
            v-model="webhookBodyJson"
            class="form-control font-monospace"
            rows="6"
            :placeholder="$t('webhookBodyPlaceholder')"
          ></textarea>
          <small class="form-text text-muted">
            {{ $t('availableVariables') }}:
            <code>{{userName}}</code>, <code>{{userId}}</code>,
            <code>{{timestamp}}</code>, <code>{{rewardName}}</code>
          </small>
        </div>

        <!-- Test Webhook Button -->
        <button type="button" class="btn btn-outline-primary btn-sm" @click="testWebhook">
          <span v-if="!testingWebhook">{{ $t('testWebhook') }}</span>
          <span v-else>
            <span class="spinner-border spinner-border-sm mr-2"></span>
            {{ $t('testing') }}
          </span>
        </button>
        <div v-if="webhookTestResult" class="mt-2">
          <div
            class="alert"
            :class="webhookTestResult.success ? 'alert-success' : 'alert-danger'"
          >
            {{ webhookTestResult.message }}
          </div>
        </div>
      </div>

      <!-- API Polling Configuration -->
      <div v-if="showApiPollingConfig" class="action-config-panel">
        <h6>{{ $t('apiPollingConfiguration') }}</h6>

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
                <span v-if="!endpointCopied">{{ $t('copy') }}</span>
                <span v-else>{{ $t('copied') }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="mt-3">
          <label><strong>{{ $t('lastPurchased') }}:</strong></label>
          <p v-if="task.lastPurchased" class="mb-1">
            {{ formatLastPurchased(task.lastPurchased) }}
          </p>
          <p v-else class="text-muted">
            {{ $t('notPurchasedYet') }}
          </p>
        </div>

        <div class="mt-3">
          <label><strong>{{ $t('exampleUsage') }}:</strong></label>
          <pre class="bg-light p-3 small">{{ apiPollingExample }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      newDevice: '',
      customPayloadJson: '',
      webhookBodyJson: '',
      webhookHeaders: [],
      showHeadersEditor: false,
      testingWebhook: false,
      webhookTestResult: null,
      endpointCopied: false,
    };
  },
  computed: {
    showClientActionConfig() {
      return this.task.actionType === 'client_action' || this.task.actionType === 'multiple';
    },
    showWebhookConfig() {
      return this.task.actionType === 'webhook' || this.task.actionType === 'multiple';
    },
    showApiPollingConfig() {
      return this.task.actionType === 'api_polling' || this.task.actionType === 'multiple';
    },
    actionTypeDescription() {
      const descriptions = {
        client_action: this.$t('clientActionDescription'),
        webhook: this.$t('webhookDescription'),
        api_polling: this.$t('apiPollingDescription'),
        multiple: this.$t('multipleActionsDescription'),
      };
      return descriptions[this.task.actionType] || '';
    },
    apiPollingEndpoint() {
      if (!this.task._id) return this.$t('saveRewardFirst');
      return `${window.location.origin}/api/v4/rewards/${this.task._id}/purchase-status?userId=${this.$store.state.user.data._id}`;
    },
    apiPollingExample() {
      return `# Example: OpenWrt router script
#!/bin/sh
curl -s "${this.apiPollingEndpoint}" | \\
  jq -r '.data.purchasedToday' | \\
  grep -q "true" && iptables -D FORWARD -s 192.168.1.100 -j DROP`;
    },
  },
  methods: {
    addDevice() {
      if (!this.newDevice.trim()) return;
      if (!this.task.actionConfig.clientAction.devices) {
        this.task.actionConfig.clientAction.devices = [];
      }
      this.task.actionConfig.clientAction.devices.push(this.newDevice.trim());
      this.newDevice = '';
    },
    removeDevice(index) {
      this.task.actionConfig.clientAction.devices.splice(index, 1);
    },
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
        // Call backend test endpoint
        const response = await this.$store.dispatch('tasks:testWebhook', {
          webhook: this.task.actionConfig.webhook,
        });

        this.webhookTestResult = {
          success: true,
          message: this.$t('webhookTestSuccess', { statusCode: response.statusCode }),
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
    async copyApiEndpoint() {
      await navigator.clipboard.writeText(this.apiPollingEndpoint);
      this.endpointCopied = true;
      setTimeout(() => {
        this.endpointCopied = false;
      }, 2000);
    },
    formatLastPurchased(date) {
      return this.$moment(date).format('MMMM Do YYYY, h:mm a');
    },
  },
  watch: {
    'task.actionEnabled'(enabled) {
      if (enabled && !this.task.actionType) {
        this.task.actionType = 'client_action';
      }
      if (enabled && !this.task.actionConfig) {
        this.$set(this.task, 'actionConfig', {
          clientAction: { devices: [] },
          webhook: { enabled: false, method: 'POST', headers: {}, body: {} },
          apiPolling: { enabled: false },
        });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.action-config-panel {
  background-color: $gray-700;
  padding: 16px;
  border-radius: 8px;
  margin-top: 12px;

  h6 {
    font-weight: 600;
    margin-bottom: 16px;
  }
}

.device-tags {
  min-height: 32px;
}

.font-monospace {
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.headers-editor {
  border: 1px solid $gray-400;
  border-radius: 4px;
  padding: 12px;
  background-color: $gray-600;
}
</style>
```

### 3.2 Task Display Enhancement (task.vue)

Add indicator for rewards with actions:

```vue
<!-- In icons section for rewards -->
<div
  v-if="task.type === 'reward' && task.actionEnabled"
  class="d-flex align-items-center"
>
  <div
    v-b-tooltip.hover.bottom="actionTypeLabel"
    class="svg-icon action-icon"
    v-html="icons.action"
  ></div>
</div>
```

```javascript
computed: {
  actionTypeLabel() {
    if (!this.task.actionEnabled) return '';
    const labels = {
      client_action: this.$t('hasClientAction'),
      webhook: this.$t('hasWebhook'),
      api_polling: this.$t('hasApiPolling'),
      multiple: this.$t('hasMultipleActions'),
    };
    return labels[this.task.actionType] || this.$t('hasAction');
  },
}
```

### 3.3 Purchase Success Handling

Add to scoreTask mixin or task component:

```javascript
async handleRewardPurchase(response) {
  // ... existing code ...

  if (response.data.data.rewardAction) {
    const { rewardAction } = response.data.data;

    // Show success notification
    if (rewardAction.webhookStatus?.success) {
      this.$root.$emit('habitica:notification', {
        type: 'success',
        message: this.$t('webhookExecutedSuccessfully'),
      });
    }

    if (rewardAction.clientAction) {
      // Client action was broadcast, show notification
      this.$root.$emit('habitica:notification', {
        type: 'info',
        message: this.$t('clientActionTriggered'),
      });
    }

    if (rewardAction.apiPolling) {
      // Show API endpoint update notification
      this.$root.$emit('habitica:notification', {
        type: 'info',
        message: this.$t('apiPollingUpdated'),
      });
    }
  }
}
```

### 3.4 Web Client Notification Display

**File:** `website/client/src/mixins/scoreTask.js`

The web client ONLY displays informational notifications about executed actions. It does NOT execute the actions themselves.

```javascript
async handleRewardAction(rewardAction) {
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

**IMPORTANT**: The web client cannot execute device control actions (unblock_device, etc.) because web browsers lack the necessary OS-level permissions. These actions are executed by native mobile apps (iOS/Android) which receive push notifications with the action payload.

---

## 4. Translation Keys

Add to `website/common/locales/en/tasks.json`:

```json
{
  "rewardActions": "Reward Actions",
  "rewardActionsTooltip": "Configure actions that execute when this reward is purchased, such as webhooks, device unlocking, or API polling for external integrations.",
  "actionType": "Action Type",
  "clientAppAction": "Client App Action",
  "webhook": "Webhook",
  "apiPolling": "API Polling",
  "multipleActions": "Multiple Actions",
  "clientActionDescription": "Send actions to your native mobile apps (iOS/Android) with OS-level permissions for device control and screen time management",
  "webhookDescription": "Send HTTP request to external URL when reward is purchased (e.g., Home Assistant, IFTTT)",
  "apiPollingDescription": "Allow external systems to poll an API endpoint to check if reward was purchased (e.g., OpenWrt router)",
  "multipleActionsDescription": "Combine multiple action types for this reward",
  "clientActionConfiguration": "Client Action Configuration",
  "action": "Action",
  "unblockDevice": "Unblock Device",
  "notification": "Show Notification",
  "custom": "Custom Action",
  "duration": "Duration",
  "minutes": "minutes",
  "devices": "Devices",
  "addDevice": "Add device identifier",
  "devicesHint": "Enter device identifiers (e.g., 'gaming_pc', 'phone', 'tablet'). These will be used by your client apps.",
  "customPayload": "Custom Payload",
  "customPayloadPlaceholder": "{\"message\": \"Reward claimed!\", \"action\": \"custom_action\"}",
  "webhookConfiguration": "Webhook Configuration",
  "webhookUrl": "Webhook URL",
  "webhookUrlPlaceholder": "https://example.com/api/webhook",
  "webhookUrlHint": "The URL that will receive the HTTP request when reward is purchased",
  "method": "HTTP Method",
  "headers": "Headers",
  "requestBody": "Request Body",
  "webhookBodyPlaceholder": "{\"user\": \"{{userName}}\", \"reward\": \"{{rewardName}}\", \"timestamp\": \"{{timestamp}}\"}",
  "supportsVariables": "Supports template variables",
  "availableVariables": "Available variables",
  "testWebhook": "Test Webhook",
  "testing": "Testing...",
  "webhookTestSuccess": "Webhook test successful! Status code: {statusCode}",
  "webhookTestFailed": "Webhook test failed: {error}",
  "addHeader": "Add Header",
  "headerName": "Header Name",
  "headerValue": "Header Value",
  "apiPollingConfiguration": "API Polling Configuration",
  "apiPollingEndpoint": "API Endpoint",
  "copy": "Copy",
  "copied": "Copied!",
  "lastPurchased": "Last Purchased",
  "notPurchasedYet": "Not purchased yet",
  "exampleUsage": "Example Usage",
  "saveRewardFirst": "Save reward to generate endpoint",
  "hasClientAction": "Has client action",
  "hasWebhook": "Has webhook",
  "hasApiPolling": "Has API polling",
  "hasMultipleActions": "Has multiple actions",
  "hasAction": "Has action",
  "webhookExecutedSuccessfully": "Webhook executed successfully",
  "webhookExecuted": "Webhook Executed",
  "webhookFailed": "Webhook Failed",
  "clientActionTriggered": "Client action triggered",
  "apiPollingUpdated": "API polling endpoint updated",
  "rewardActionExecuted": "Reward Action Executed",
  "actionTriggered": "Action triggered on your mobile devices",
  "deviceUnlockedNotification": "{devices} unlocked for {duration} minutes on your mobile devices",
  "notificationTriggered": "Notification sent to your mobile devices",
  "customActionTriggered": "Custom action sent to your mobile devices",
  "rewardPurchased": "Reward Purchased"
}
```

---

## 5. Security Considerations

### 5.1 Webhook Security

1. **Rate Limiting**: Limit webhook executions to prevent abuse
   - Max 10 webhook calls per minute per user
   - Max 100 webhook calls per day per user

2. **Timeout**: Enforce timeout (default 5s, max 30s) to prevent hanging requests

3. **URL Validation**:
   - Validate URL format
   - Optionally block private IP ranges (127.0.0.1, 192.168.x.x, etc.) unless explicitly allowed
   - Block URLs with credentials in them (http://user:pass@example.com)

4. **SSRF Protection**:
   - Validate redirect responses
   - Block internal service URLs

5. **Logging**: Log all webhook executions for debugging and security auditing

### 5.2 API Polling Security

1. **Authentication Options**:
   - Option 1: Include user ID in URL (public but requires knowing user ID)
   - Option 2: Require API token authentication
   - Option 3: Generate special polling token for each reward

2. **Rate Limiting**: Standard API rate limits apply

3. **Data Exposure**: Only expose necessary data (reward purchase status, not sensitive user info)

### 5.3 Client Action Security

1. **Event Validation**: Validate action payload structure
2. **Device Whitelist**: User must explicitly configure allowed devices
3. **Client Verification**: Client apps should verify authenticity of events

---

## 6. Testing Requirements

### Backend Tests

1. **Webhook Execution**:
   - Test successful webhook execution
   - Test webhook failure handling
   - Test variable substitution in headers/body
   - Test timeout handling
   - Test rate limiting

2. **API Polling Endpoint**:
   - Test purchase status retrieval
   - Test "purchasedToday" logic with different dayStart values
   - Test authentication
   - Test rate limiting

3. **Client Action Broadcasting**:
   - Test push notification sending (FCM + APN)
   - Test payload structure
   - Verify notifications reach registered mobile devices

4. **Purchase Tracking**:
   - Test lastPurchased update
   - Test purchase history tracking

### Frontend Tests

1. **Task Modal**:
   - Test action type switching
   - Test configuration UI for each action type
   - Test webhook testing functionality
   - Test API endpoint copying

2. **Action Indicators**:
   - Test action icon display on rewards
   - Test tooltips

3. **Purchase Handling**:
   - Test success notifications for each action type
   - Test error handling

---

## 7. Documentation

### User Documentation Sections

1. **Getting Started with Reward Actions**
2. **Screen Time Control Setup Guide**
3. **Webhook Integration Guide** (with examples for popular services)
4. **API Polling Guide** (with router integration examples)
5. **Client App Integration Guide**
6. **Troubleshooting**

### Developer Documentation

1. **API Reference** for polling endpoint
2. **Webhook Payload Reference**
3. **Client Event Reference**
4. **Integration Examples**:
   - OpenWrt router script
   - Home Assistant automation
   - IFTTT integration
   - Custom client app integration

---

## 8. Future Enhancements

1. **Pre-built Integrations**: UI templates for popular services (Home Assistant, IFTTT, Zapier)
2. **Webhook Response Actions**: Execute follow-up actions based on webhook response
3. **Conditional Actions**: Only execute action if certain conditions are met
4. **Action Templates**: Save and reuse action configurations
5. **Action History**: View log of executed actions
6. **OAuth Integration**: Built-in OAuth for secure webhook authentication
7. **Action Scheduling**: Delay action execution or schedule for specific time

---

## Implementation Priority

### Phase 1 (Core)
- [ ] Data model
- [ ] API polling endpoint
- [ ] Purchase tracking
- [ ] Basic UI in task modal

### Phase 2 (Webhooks)
- [ ] Webhook executor service
- [ ] Webhook configuration UI
- [ ] Test webhook functionality
- [ ] Webhook logging

### Phase 3 (Client Actions)
- [ ] Client action broadcaster
- [ ] Real-time event handling
- [ ] Client-side action handler
- [ ] Device management UI

### Phase 4 (Polish)
- [ ] Security hardening
- [ ] Rate limiting
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] User guides

---

This specification provides a solid foundation for implementing flexible, powerful reward actions while maintaining security and usability.
