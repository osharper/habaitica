# Habaitica Custom Features Implementation Guide

This document provides a comprehensive guide to the custom features added to your Habitica fork (Habaitica).

## Features Implemented

### 1. AI-Powered Task Assessment
Dailies and todos can now be assessed by AI. Users must submit proof (text summary, photo, etc.) through a chat interface, and the AI will verify completion.

### 2. Task-Locked Rewards
Rewards can now be locked behind specific dailies or todos. The reward can only be purchased after all linked tasks are completed.

---

## Backend Implementation (COMPLETED ✓)

### Database Models

#### Task Model (`website/server/models/task.js`)

**AI Assessment Fields (for dailies/todos):**
- `aiEnabled`: Boolean - Whether AI assessment is enabled
- `aiChatMessages`: Array - Chat history with AI
  - `role`: 'user' | 'assistant'
  - `content`: String
  - `timestamp`: Date
  - `attachments`: Array of URLs
- `aiAssessmentStatus`: 'pending' | 'approved' | 'rejected' | 'needs_revision'

**Reward Lock Fields:**
- `requiredTasks`: Array of task UUIDs that must be completed to unlock the reward

### AI Service

**File:** `website/server/libs/ai/taskAssessment.js`

Uses Vercel AI SDK with Google Gemini (gemini-1.5-flash model).

**Functions:**
- `assessTaskCompletion(task, userMessage, attachments, previousMessages)` - Assesses if user has completed the task
- `generateChatResponse(task, chatHistory, userMessage)` - General chat support

**Configuration Required:**
Set `GOOGLE_API_KEY` in your environment/config.

### API Endpoints

**Task Chat Endpoints (`website/server/controllers/api-v3/tasks.js`):**

1. **POST `/api/v3/tasks/:taskId/chat`**
   - Send a message for AI assessment
   - Body: `{ message: string, attachments?: string[] }`
   - Returns: Updated task with AI response

2. **GET `/api/v3/tasks/:taskId/chat`**
   - Get chat history for a task
   - Returns: Array of chat messages

3. **PUT `/api/v3/tasks/:taskId/ai-enable`**
   - Enable/disable AI assessment
   - Body: `{ aiEnabled: boolean }`
   - Returns: Updated task

### Reward Lock Validation

**File:** `website/server/libs/tasks/index.js`

When scoring a reward (purchasing it), the system checks:
1. If `requiredTasks` array exists and has items
2. Queries all required tasks from database
3. Verifies all are completed
4. Throws `NotAuthorized` error if any are incomplete

### Frontend Store Actions (COMPLETED ✓)

**File:** `website/client/src/store/actions/tasks.js`

New actions added:
- `sendTaskChatMessage({ taskId, message, attachments })`
- `getTaskChatMessages(taskId)`
- `toggleTaskAI({ taskId, aiEnabled })`

---

## Frontend Implementation (NEEDS COMPLETION)

### 1. Update Task Modal for Reward Locks

**File:** `website/client/src/components/tasks/taskModal.vue`

**Location:** After the cost field (around line 136)

**Add this section for rewards:**

```vue
<div
  v-if="task.type === 'reward'"
  class="option mt-3"
>
  <div class="form-group">
    <label class="mb-1">{{ $t('requiredTasks') }}</label>
    <p class="small text-muted">
      Select tasks that must be completed before this reward can be purchased
    </p>
    <select
      v-model="task.requiredTasks"
      class="form-control"
      multiple
    >
      <option
        v-for="userTask in availableTasksForLocking"
        :key="userTask._id"
        :value="userTask._id"
      >
        {{ userTask.text }}
      </option>
    </select>
  </div>
</div>
```

**In the component's computed properties, add:**

```javascript
availableTasksForLocking() {
  const allTasks = [
    ...(this.$store.state.tasks.data.dailys || []),
    ...(this.$store.state.tasks.data.todos || [])
  ];
  return allTasks.filter(t => !t.completed);
}
```

**Make sure `requiredTasks` is initialized in the data section:**

```javascript
if (!this.task.requiredTasks) {
  this.task.requiredTasks = [];
}
```

### 2. Update Task Modal for AI Assessment Toggle

**File:** `website/client/src/components/tasks/taskModal.vue`

**Location:** In the section where `task.type !== 'reward'` (around line 204)

**Add this toggle for todos/dailies:**

```vue
<div
  v-if="task.type === 'todo' || task.type === 'daily'"
  class="option mt-3"
>
  <div class="form-group">
    <div class="custom-control custom-checkbox">
      <input
        id="ai-enabled-checkbox"
        v-model="task.aiEnabled"
        type="checkbox"
        class="custom-control-input"
      >
      <label
        class="custom-control-label"
        for="ai-enabled-checkbox"
      >
        {{ $t('enableAIAssessment') }}
      </label>
    </div>
    <p class="small text-muted mt-2">
      When enabled, you'll need to provide proof and get AI approval to complete this task
    </p>
  </div>
</div>
```

### 3. Update Task Display to Show Locked Rewards

**File:** `website/client/src/components/tasks/task.vue`

**Find the reward section and add lock indicator:**

```vue
<div v-if="task.type === 'reward' && isRewardLocked" class="reward-locked">
  <div class="svg-icon lock-icon" v-html="icons.lock"></div>
  <small class="text-muted">
    Complete {{ incompletedRequiredTasks.length }} task(s) to unlock
  </small>
</div>
```

**In computed properties:**

```javascript
computed: {
  isRewardLocked() {
    if (this.task.type !== 'reward' || !this.task.requiredTasks || this.task.requiredTasks.length === 0) {
      return false;
    }
    return this.incompletedRequiredTasks.length > 0;
  },

  incompletedRequiredTasks() {
    if (!this.task.requiredTasks) return [];

    const allTasks = [
      ...(this.$store.state.tasks.data.dailys || []),
      ...(this.$store.state.tasks.data.todos || [])
    ];

    return this.task.requiredTasks.filter(requiredId => {
      const reqTask = allTasks.find(t => t._id === requiredId);
      return reqTask && !reqTask.completed;
    });
  }
}
```

**Disable purchase button when locked:**

```vue
<button
  class="btn btn-primary"
  :disabled="isRewardLocked"
  @click="scoreTask('up')"
>
  {{ $t('purchase') }}
</button>
```

### 4. Create Task Chat Component

**File:** `website/client/src/components/tasks/taskChat.vue` (NEW FILE)

```vue
<template>
  <div class="task-chat-container">
    <div class="chat-header">
      <h4>{{ task.text }}</h4>
      <p class="text-muted small">{{ $t('aiAssessment') }}</p>
    </div>

    <div class="chat-messages" ref="messagesContainer">
      <div
        v-for="(message, index) in chatMessages"
        :key="index"
        class="message"
        :class="message.role"
      >
        <div class="message-content">
          {{ message.content }}
        </div>
        <div class="message-time">
          {{ formatTime(message.timestamp) }}
        </div>
      </div>
    </div>

    <div class="chat-input">
      <textarea
        v-model="newMessage"
        class="form-control"
        :placeholder="$t('submitProof')"
        @keydown.ctrl.enter="sendMessage"
      ></textarea>
      <button
        class="btn btn-primary mt-2"
        :disabled="!newMessage.trim()"
        @click="sendMessage"
      >
        {{ $t('submit') }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TaskChat',
  props: {
    task: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      newMessage: '',
      chatMessages: [],
    };
  },
  async mounted() {
    await this.loadMessages();
  },
  methods: {
    async loadMessages() {
      this.chatMessages = await this.$store.dispatch('tasks:getTaskChatMessages', this.task._id);
    },

    async sendMessage() {
      if (!this.newMessage.trim()) return;

      const message = this.newMessage;
      this.newMessage = '';

      try {
        const updatedTask = await this.$store.dispatch('tasks:sendTaskChatMessage', {
          taskId: this.task._id,
          message,
          attachments: [],
        });

        this.chatMessages = updatedTask.aiChatMessages || [];

        // Scroll to bottom
        this.$nextTick(() => {
          const container = this.$refs.messagesContainer;
          container.scrollTop = container.scrollHeight;
        });

        // Show notification if approved
        if (updatedTask.aiAssessmentStatus === 'approved') {
          this.$root.$emit('bv::show::modal', 'task-approved-modal');
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        this.$root.$emit('bv::show::modal', 'error-modal');
      }
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    },
  },
};
</script>

<style scoped>
.task-chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 600px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: #f8f9fa;
}

.message {
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  background: #4f2a93;
  color: white;
  margin-left: auto;
}

.message.assistant {
  background: white;
  border: 1px solid #ddd;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: 0.25rem;
}

.chat-input {
  padding: 1rem;
  border-top: 1px solid #ddd;
}
</style>
```

### 5. Add AI Chat Button to Tasks

**File:** `website/client/src/components/tasks/task.vue`

**Add button for AI-enabled tasks:**

```vue
<button
  v-if="task.aiEnabled && (task.type === 'todo' || task.type === 'daily')"
  class="btn btn-sm btn-outline-primary"
  @click="openAIChat"
>
  <div class="svg-icon" v-html="icons.chat"></div>
  {{ $t('aiChat') }}
</button>
```

**Add method:**

```javascript
methods: {
  openAIChat() {
    this.$root.$emit('bv::show::modal', 'task-ai-chat-modal');
    this.$root.$emit('task:ai-chat', this.task);
  }
}
```

### 6. Add Translation Keys

**File:** `website/common/locales/en/*.json` (multiple language files)

Add these translation keys:

```json
{
  "requiredTasks": "Required Tasks",
  "enableAIAssessment": "Enable AI Assessment",
  "aiAssessment": "AI Assessment",
  "submitProof": "Submit proof of completion...",
  "aiChat": "AI Chat",
  "rewardLockedByTasks": "This reward is locked until you complete all required tasks."
}
```

---

## Configuration

### Environment Variables

Add to your `.env` or config file:

```bash
GOOGLE_API_KEY=your_google_api_key_here
```

### Getting Google API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your configuration

---

## Testing

### Backend Testing

1. **Test Reward Locking:**
   ```bash
   # Create a daily task
   POST /api/v3/tasks/user
   { "type": "daily", "text": "Morning Exercise" }

   # Create a reward with required task
   POST /api/v3/tasks/user
   {
     "type": "reward",
     "text": "Ice Cream",
     "value": 20,
     "requiredTasks": ["<daily-task-id>"]
   }

   # Try to purchase (should fail)
   POST /api/v3/tasks/<reward-id>/score/up

   # Complete the daily
   POST /api/v3/tasks/<daily-id>/score/up

   # Now purchase reward (should succeed)
   POST /api/v3/tasks/<reward-id>/score/up
   ```

2. **Test AI Assessment:**
   ```bash
   # Create a todo with AI enabled
   POST /api/v3/tasks/user
   { "type": "todo", "text": "Watch lecture on React", "aiEnabled": true }

   # Send chat message
   POST /api/v3/tasks/<task-id>/chat
   { "message": "I watched the lecture. Here's what I learned about hooks..." }

   # Check response for AI feedback and assessment status
   ```

### Frontend Testing

1. Create rewards and link them to tasks
2. Try purchasing locked rewards (should show disabled state)
3. Complete required tasks and verify reward unlocks
4. Enable AI assessment on a todo
5. Test the chat interface
6. Submit proof and verify AI response

---

## Next Steps

1. Complete the frontend components as described above
2. Add proper error handling and loading states
3. Add internationalization for all new UI text
4. Style the components to match Habitica's design system
5. Add unit tests for new functionality
6. Test thoroughly with real users
7. Document the features in user-facing help/wiki

---

## Architecture Notes

### Why Vercel AI SDK?

- Provider-agnostic: Easy to switch between OpenAI, Anthropic, Google, etc.
- Streaming support for better UX
- Built-in error handling
- TypeScript support

### Why Gemini?

- Cost-effective
- Good performance for task assessment
- Vision support (can analyze uploaded images)
- Fast response times

### Alternative Approaches Considered

1. **Rule-based validation** - Too rigid, wouldn't handle varied submissions
2. **OpenAI GPT-4** - More expensive, overkill for this use case
3. **Local LLM** - Too resource intensive for most deployments

---

## Troubleshooting

### Common Issues

1. **"GOOGLE_API_KEY not configured"**
   - Make sure the API key is set in your environment
   - Restart the server after adding it

2. **Reward still purchasable despite locks**
   - Check that `requiredTasks` array is properly saved
   - Verify the required tasks are not marked as completed

3. **AI not responding**
   - Check Google API quota
   - Verify API key has correct permissions
   - Check server logs for detailed errors

4. **Chat messages not displaying**
   - Verify the task has `aiEnabled: true`
   - Check that messages are being saved to `aiChatMessages` array
   - Inspect browser console for errors

---

## Future Enhancements

Potential features to add:

1. **Image Upload Support** - Allow users to upload photos as proof
2. **Custom AI Prompts** - Let users customize the AI assessment criteria
3. **Assessment History** - Track all past assessments for analytics
4. **Reward Unlocking Ceremonies** - Celebration animation when reward unlocks
5. **AI Difficulty Levels** - Strict/Lenient assessment modes
6. **Batch Assessment** - Assess multiple tasks at once
7. **Voice Input** - Submit proof via voice messages
8. **Integration with other AI models** - Support Claude, GPT-4, etc.

---

## Credits

Built on top of [Habitica](https://github.com/HabitRPG/habitica) - An open source habit building program.

Custom features implemented for Habaitica fork.
