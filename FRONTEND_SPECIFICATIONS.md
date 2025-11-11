# Frontend Implementation Specifications
## Habaitica Custom Features

Version: 1.0
Last Updated: 2025-01-11

---

## Table of Contents

1. [Overview](#overview)
2. [Feature 1: Task-Locked Rewards](#feature-1-task-locked-rewards)
3. [Feature 2: AI-Powered Task Assessment](#feature-2-ai-powered-task-assessment)
4. [Technical Architecture](#technical-architecture)
5. [API Reference](#api-reference)
6. [UI/UX Guidelines](#uiux-guidelines)
7. [Testing Requirements](#testing-requirements)

---

## Overview

This document specifies the frontend implementation requirements for two major features in Habaitica:

1. **Task-Locked Rewards**: Rewards that can only be purchased after completing specific tasks
2. **AI-Powered Task Assessment**: Tasks that require AI verification through a chat interface

### Tech Stack
- **Framework**: Vue.js 2.x
- **State Management**: Vuex
- **HTTP Client**: Axios
- **UI Framework**: Bootstrap 4
- **Styling**: SCSS

---

## Feature 1: Task-Locked Rewards

### Business Requirements

Users can configure rewards to be "locked" behind specific tasks (dailies or todos). The reward becomes purchasable only when ALL linked tasks are completed.

### User Stories

1. **As a user**, I want to add required tasks to a reward so that I can't purchase it until I complete those tasks
2. **As a user**, I want to see which rewards are locked and what tasks I need to complete
3. **As a user**, I want to see a celebration when a reward unlocks after completing a task
4. **As a user**, I want to see which tasks are blocking a reward from being purchased

### Component Changes

#### 1.1 Task Modal (`website/client/src/components/tasks/taskModal.vue`)

**Location**: After the reward cost field (around line 137)

**Purpose**: Allow users to select which tasks must be completed before purchasing this reward

**Implementation**:

```vue
<!-- Add this section for rewards -->
<div
  v-if="task.type === 'reward'"
  class="option mt-3"
>
  <div class="form-group">
    <label class="mb-1">
      {{ $t('requiredTasks') }}
    </label>
    <p class="small text-muted mb-2">
      {{ $t('requiredTasksDescription') }}
    </p>
    <div class="required-tasks-selector">
      <!-- Multi-select for required tasks -->
      <div
        v-for="taskType in ['dailys', 'todos']"
        :key="taskType"
        class="task-type-group mb-3"
      >
        <h6 class="text-muted mb-2">
          {{ $t(taskType) }}
        </h6>
        <div
          v-if="availableTasksForLocking[taskType].length === 0"
          class="small text-muted"
        >
          {{ $t('noTasksAvailable') }}
        </div>
        <div
          v-for="availableTask in availableTasksForLocking[taskType]"
          :key="availableTask._id"
          class="custom-control custom-checkbox mb-2"
        >
          <input
            :id="`req-task-${availableTask._id}`"
            v-model="task.requiredTasks"
            type="checkbox"
            class="custom-control-input"
            :value="availableTask._id"
          >
          <label
            class="custom-control-label"
            :for="`req-task-${availableTask._id}`"
          >
            {{ availableTask.text }}
            <span
              v-if="availableTask.completed"
              class="badge badge-success ml-2"
            >
              {{ $t('completed') }}
            </span>
          </label>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Computed Properties to Add**:

```javascript
computed: {
  availableTasksForLocking() {
    return {
      dailys: (this.$store.state.tasks.data.dailys || [])
        .filter(t => t._id !== this.task._id),
      todos: (this.$store.state.tasks.data.todos || [])
        .filter(t => t._id !== this.task._id && !t.completed),
    };
  },
}
```

**Data Initialization**:

```javascript
// In mounted() or when task is loaded
if (!this.task.requiredTasks) {
  this.$set(this.task, 'requiredTasks', []);
}
```

**Styling**:

```scss
.required-tasks-selector {
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fafafa;

  .task-type-group {
    h6 {
      font-weight: 600;
      text-transform: capitalize;
    }
  }

  .custom-control-label {
    cursor: pointer;
    user-select: none;
  }
}
```

#### 1.2 Task Display Component (`website/client/src/components/tasks/task.vue`)

**Purpose**: Show lock status on rewards and disable purchase button when locked

**Visual States**:
- **Locked**: Gray overlay, lock icon, disabled purchase button, text showing how many tasks need completion
- **Unlocked**: Normal appearance, enabled purchase button

**Implementation**:

```vue
<!-- Add lock overlay for locked rewards -->
<div
  v-if="task.type === 'reward'"
  class="reward-container"
  :class="{ 'reward-locked': isRewardLocked }"
>
  <!-- Existing reward content -->

  <!-- Lock overlay -->
  <div
    v-if="isRewardLocked"
    class="lock-overlay"
  >
    <div class="lock-content">
      <div
        class="svg-icon lock-icon mb-2"
        v-html="icons.lock"
      ></div>
      <div class="lock-text">
        {{ $t('rewardLocked', { count: incompletedRequiredTasks.length }) }}
      </div>
      <button
        class="btn btn-sm btn-outline-secondary mt-2"
        @click="showRequiredTasks"
      >
        {{ $t('viewRequiredTasks') }}
      </button>
    </div>
  </div>

  <!-- Purchase button (existing, add disabled state) -->
  <button
    class="btn btn-primary purchase-btn"
    :disabled="isRewardLocked"
    @click="scoreTask('up')"
  >
    <div class="svg-icon gold mr-1" v-html="icons.gold"></div>
    {{ task.value }}
  </button>
</div>
```

**Computed Properties**:

```javascript
computed: {
  isRewardLocked() {
    if (this.task.type !== 'reward' || !this.task.requiredTasks || this.task.requiredTasks.length === 0) {
      return false;
    }
    return this.incompletedRequiredTasks.length > 0;
  },

  incompletedRequiredTasks() {
    if (!this.task.requiredTasks || this.task.requiredTasks.length === 0) {
      return [];
    }

    const allTasks = [
      ...(this.$store.state.tasks.data.dailys || []),
      ...(this.$store.state.tasks.data.todos || []),
    ];

    return this.task.requiredTasks.filter(requiredId => {
      const reqTask = allTasks.find(t => t._id === requiredId);
      return reqTask && !reqTask.completed;
    });
  },

  completedRequiredTasks() {
    if (!this.task.requiredTasks || this.task.requiredTasks.length === 0) {
      return [];
    }

    const allTasks = [
      ...(this.$store.state.tasks.data.dailys || []),
      ...(this.$store.state.tasks.data.todos || []),
    ];

    return this.task.requiredTasks.filter(requiredId => {
      const reqTask = allTasks.find(t => t._id === requiredId);
      return reqTask && reqTask.completed;
    });
  },
}
```

**Methods**:

```javascript
methods: {
  showRequiredTasks() {
    this.$root.$emit('bv::show::modal', 'required-tasks-modal');
    this.$root.$emit('show-required-tasks', {
      reward: this.task,
      incompleted: this.incompletedRequiredTasks,
      completed: this.completedRequiredTasks,
    });
  },
}
```

**Styling**:

```scss
.reward-container {
  position: relative;

  &.reward-locked {
    opacity: 0.7;

    .purchase-btn {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }
}

.lock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  z-index: 10;
  backdrop-filter: blur(2px);

  .lock-content {
    text-align: center;
    padding: 1rem;

    .lock-icon {
      width: 32px;
      height: 32px;
      color: #999;
    }

    .lock-text {
      font-size: 0.875rem;
      color: #666;
      font-weight: 500;
    }
  }
}
```

#### 1.3 Required Tasks Modal (NEW COMPONENT)

**File**: `website/client/src/components/tasks/requiredTasksModal.vue`

**Purpose**: Show detailed view of which tasks are required and their completion status

```vue
<template>
  <b-modal
    id="required-tasks-modal"
    :title="$t('requiredTasksFor', { reward: rewardName })"
    size="md"
    :hide-footer="true"
  >
    <div v-if="reward" class="required-tasks-details">
      <div class="reward-info mb-4">
        <h5>{{ reward.text }}</h5>
        <div class="d-flex align-items-center">
          <div class="svg-icon gold mr-1" v-html="icons.gold"></div>
          <span>{{ reward.value }}</span>
        </div>
      </div>

      <div class="progress mb-4">
        <div
          class="progress-bar"
          :style="{ width: progressPercentage + '%' }"
        >
          {{ completedCount }} / {{ totalCount }}
        </div>
      </div>

      <div v-if="incompleted.length > 0" class="task-section mb-4">
        <h6 class="text-danger">
          {{ $t('incompletedTasks') }}
        </h6>
        <div
          v-for="task in incompleted"
          :key="task._id"
          class="task-item incomplete"
        >
          <div class="svg-icon mr-2" v-html="icons.unchecked"></div>
          <span>{{ task.text }}</span>
          <span class="badge badge-secondary ml-auto">
            {{ $t(task.type) }}
          </span>
        </div>
      </div>

      <div v-if="completed.length > 0" class="task-section">
        <h6 class="text-success">
          {{ $t('completedTasks') }}
        </h6>
        <div
          v-for="task in completed"
          :key="task._id"
          class="task-item complete"
        >
          <div class="svg-icon mr-2 text-success" v-html="icons.checked"></div>
          <span>{{ task.text }}</span>
          <span class="badge badge-secondary ml-auto">
            {{ $t(task.type) }}
          </span>
        </div>
      </div>

      <div v-if="incompleted.length === 0" class="alert alert-success mt-3">
        {{ $t('allTasksCompleted') }}
      </div>
    </div>
  </b-modal>
</template>

<script>
import goldIcon from '@/assets/svg/gold.svg';
import checkIcon from '@/assets/svg/check.svg';
import uncheckIcon from '@/assets/svg/uncheck.svg';

export default {
  name: 'RequiredTasksModal',
  data() {
    return {
      reward: null,
      incompleted: [],
      completed: [],
      icons: {
        gold: goldIcon,
        checked: checkIcon,
        unchecked: uncheckIcon,
      },
    };
  },
  computed: {
    rewardName() {
      return this.reward ? this.reward.text : '';
    },
    totalCount() {
      return this.incompleted.length + this.completed.length;
    },
    completedCount() {
      return this.completed.length;
    },
    progressPercentage() {
      if (this.totalCount === 0) return 0;
      return Math.round((this.completedCount / this.totalCount) * 100);
    },
  },
  mounted() {
    this.$root.$on('show-required-tasks', this.handleShowRequiredTasks);
  },
  beforeDestroy() {
    this.$root.$off('show-required-tasks', this.handleShowRequiredTasks);
  },
  methods: {
    handleShowRequiredTasks(data) {
      this.reward = data.reward;
      this.incompleted = data.incompleted;
      this.completed = data.completed;
    },
  },
};
</script>

<style scoped lang="scss">
.required-tasks-details {
  .reward-info {
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 4px;
    text-align: center;

    h5 {
      margin-bottom: 0.5rem;
    }
  }

  .task-section {
    h6 {
      font-weight: 600;
      margin-bottom: 0.75rem;
    }
  }

  .task-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 4px;
    background: #f8f9fa;

    &.incomplete {
      border-left: 3px solid #dc3545;
    }

    &.complete {
      border-left: 3px solid #28a745;
      opacity: 0.8;
    }

    .svg-icon {
      width: 20px;
      height: 20px;
    }
  }
}
</style>
```

#### 1.4 Reward Unlock Notification (NEW COMPONENT)

**File**: `website/client/src/components/notifications/rewardUnlockedNotification.vue`

**Purpose**: Show a celebration modal when rewards are unlocked

```vue
<template>
  <b-modal
    id="reward-unlocked-modal"
    :title="$t('rewardsUnlocked')"
    size="md"
    centered
    @hidden="clearUnlockedRewards"
  >
    <div class="rewards-unlocked-content">
      <div class="celebration-icon mb-3">
        🎉
      </div>
      <h4 class="mb-3">
        {{ $t('congratulations') }}!
      </h4>
      <p class="text-muted mb-4">
        {{ $t('rewardsUnlockedMessage', { count: unlockedRewards.length }) }}
      </p>

      <div class="unlocked-rewards-list">
        <div
          v-for="reward in unlockedRewards"
          :key="reward._id"
          class="reward-card"
        >
          <div class="reward-name">{{ reward.text }}</div>
          <div class="reward-cost">
            <div class="svg-icon gold mr-1" v-html="icons.gold"></div>
            {{ reward.value }}
          </div>
        </div>
      </div>
    </div>

    <template #modal-footer>
      <button
        class="btn btn-primary"
        @click="closeModal"
      >
        {{ $t('awesome') }}!
      </button>
    </template>
  </b-modal>
</template>

<script>
import goldIcon from '@/assets/svg/gold.svg';

export default {
  name: 'RewardUnlockedNotification',
  data() {
    return {
      unlockedRewards: [],
      icons: {
        gold: goldIcon,
      },
    };
  },
  mounted() {
    this.$root.$on('rewards-unlocked', this.handleRewardsUnlocked);
  },
  beforeDestroy() {
    this.$root.$off('rewards-unlocked', this.handleRewardsUnlocked);
  },
  methods: {
    handleRewardsUnlocked(rewards) {
      this.unlockedRewards = rewards;
      this.$root.$emit('bv::show::modal', 'reward-unlocked-modal');
    },
    closeModal() {
      this.$root.$emit('bv::hide::modal', 'reward-unlocked-modal');
    },
    clearUnlockedRewards() {
      this.unlockedRewards = [];
    },
  },
};
</script>

<style scoped lang="scss">
.rewards-unlocked-content {
  text-align: center;

  .celebration-icon {
    font-size: 4rem;
    animation: bounce 0.6s ease-in-out;
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-20px);
    }
  }

  .unlocked-rewards-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .reward-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    margin-bottom: 0.5rem;
    background: #f8f9fa;
    border-radius: 8px;
    border: 2px solid #ffc107;

    .reward-name {
      font-weight: 500;
    }

    .reward-cost {
      display: flex;
      align-items: center;
      font-weight: 600;
      color: #ffc107;

      .svg-icon {
        width: 20px;
        height: 20px;
      }
    }
  }
}
</style>
```

#### 1.5 Task Scoring Handler Update

**File**: `website/client/src/components/tasks/task.vue`

**Purpose**: Handle unlocked rewards when scoring a task

**In the `scoreTask` method**, add:

```javascript
async scoreTask(direction) {
  try {
    const response = await this.$store.dispatch('tasks:score', {
      taskId: this.task._id,
      direction,
    });

    // Check if any rewards were unlocked
    if (response.data && response.data.unlockedRewards && response.data.unlockedRewards.length > 0) {
      // Show unlock notification
      this.$root.$emit('rewards-unlocked', response.data.unlockedRewards);
    }

    // Existing success handling...
  } catch (error) {
    // Existing error handling...
  }
}
```

---

## Feature 2: AI-Powered Task Assessment

### Business Requirements

Users can enable AI assessment on todos and dailies. Instead of just checking off the task, users must submit proof (text or images) through a chat interface. An AI reviews the submission and either approves, rejects, or asks for more information.

### User Stories

1. **As a user**, I want to enable AI assessment on a task so that I have accountability
2. **As a user**, I want to chat with AI about my task and submit proof of completion
3. **As a user**, I want to receive feedback from the AI on my submission
4. **As a user**, I want the task to auto-complete when the AI approves my submission
5. **As a user**, I want to see the assessment status (pending/approved/rejected) on my tasks

### Component Changes

#### 2.1 Task Modal - AI Toggle (`website/client/src/components/tasks/taskModal.vue`)

**Location**: In the section where `task.type !== 'reward'` (around line 204)

**Purpose**: Add a toggle to enable/disable AI assessment

```vue
<div
  v-if="task.type === 'todo' || task.type === 'daily'"
  class="option mt-3"
>
  <div class="form-group">
    <div class="custom-control custom-switch">
      <input
        id="ai-enabled-switch"
        v-model="task.aiEnabled"
        type="checkbox"
        class="custom-control-input"
      >
      <label
        class="custom-control-label"
        for="ai-enabled-switch"
      >
        <strong>{{ $t('enableAIAssessment') }}</strong>
      </label>
    </div>
    <div class="ai-assessment-info mt-2">
      <div class="d-flex align-items-start">
        <div class="svg-icon ai-icon mr-2" v-html="icons.ai"></div>
        <div>
          <p class="small text-muted mb-1">
            {{ $t('aiAssessmentDescription') }}
          </p>
          <ul class="small text-muted mb-0 pl-3">
            <li>{{ $t('aiAssessmentBenefit1') }}</li>
            <li>{{ $t('aiAssessmentBenefit2') }}</li>
            <li>{{ $t('aiAssessmentBenefit3') }}</li>
          </ul>
        </div>
      </div>
      <div
        v-if="task.aiEnabled"
        class="alert alert-info mt-2 mb-0"
      >
        <small>
          <strong>{{ $t('note') }}:</strong> {{ $t('aiAssessmentNote') }}
        </small>
      </div>
    </div>
  </div>
</div>
```

**Styling**:

```scss
.ai-assessment-info {
  padding: 0.75rem;
  background: #f0f7ff;
  border-radius: 4px;
  border-left: 3px solid #4299e1;

  .ai-icon {
    width: 24px;
    height: 24px;
    color: #4299e1;
    flex-shrink: 0;
  }

  ul {
    list-style-type: disc;
  }
}
```

#### 2.2 Task Display - AI Badge and Chat Button

**File**: `website/client/src/components/tasks/task.vue`

**Purpose**: Show AI assessment status and provide access to chat

```vue
<!-- Add AI badge for AI-enabled tasks -->
<div
  v-if="task.aiEnabled && (task.type === 'todo' || task.type === 'daily')"
  class="task-ai-container"
>
  <div class="ai-badge-container">
    <span
      class="badge ai-badge"
      :class="aiStatusClass"
    >
      <div class="svg-icon mr-1" v-html="icons.ai"></div>
      {{ $t(`aiStatus_${task.aiAssessmentStatus || 'pending'}`) }}
    </span>
  </div>

  <button
    class="btn btn-sm btn-outline-primary ai-chat-btn"
    @click="openAIChat"
  >
    <div class="svg-icon mr-1" v-html="icons.chat"></div>
    {{ $t('submitProof') }}
  </button>

  <!-- Override normal check button for AI-enabled tasks -->
  <div v-if="!task.completed" class="ai-completion-note">
    <small class="text-muted">
      {{ $t('aiCompletionRequired') }}
    </small>
  </div>
</div>
```

**Computed Properties**:

```javascript
computed: {
  aiStatusClass() {
    const statusMap = {
      pending: 'badge-secondary',
      approved: 'badge-success',
      rejected: 'badge-danger',
      needs_revision: 'badge-warning',
    };
    return statusMap[this.task.aiAssessmentStatus] || 'badge-secondary';
  },
}
```

**Methods**:

```javascript
methods: {
  openAIChat() {
    this.$root.$emit('bv::show::modal', 'task-ai-chat-modal');
    this.$root.$emit('open-ai-chat', this.task);
  },
}
```

**Styling**:

```scss
.task-ai-container {
  margin-top: 0.5rem;

  .ai-badge-container {
    margin-bottom: 0.5rem;
  }

  .ai-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;

    .svg-icon {
      width: 14px;
      height: 14px;
    }
  }

  .ai-chat-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    .svg-icon {
      width: 16px;
      height: 16px;
    }
  }

  .ai-completion-note {
    margin-top: 0.5rem;
    text-align: center;
  }
}
```

#### 2.3 AI Chat Modal (NEW COMPONENT)

**File**: `website/client/src/components/tasks/taskAIChatModal.vue`

**Purpose**: Provide chat interface for AI assessment

```vue
<template>
  <b-modal
    id="task-ai-chat-modal"
    :title="chatTitle"
    size="lg"
    :hide-footer="true"
    @hidden="onHidden"
  >
    <div v-if="task" class="ai-chat-container">
      <!-- Task Info Header -->
      <div class="task-info-header">
        <h5>{{ task.text }}</h5>
        <p v-if="task.notes" class="text-muted small">
          {{ task.notes }}
        </p>
        <div class="status-badge">
          <span
            class="badge"
            :class="statusBadgeClass"
          >
            {{ $t(`aiStatus_${task.aiAssessmentStatus || 'pending'}`) }}
          </span>
        </div>
      </div>

      <!-- Chat Messages -->
      <div ref="messagesContainer" class="chat-messages">
        <div
          v-if="!chatMessages || chatMessages.length === 0"
          class="empty-chat"
        >
          <div class="svg-icon ai-icon mb-2" v-html="icons.ai"></div>
          <p class="text-muted">
            {{ $t('aiChatWelcome') }}
          </p>
          <p class="small text-muted">
            {{ $t('aiChatInstructions') }}
          </p>
        </div>

        <div
          v-for="(message, index) in chatMessages"
          :key="index"
          class="message"
          :class="message.role"
        >
          <div class="message-avatar">
            <div v-if="message.role === 'assistant'" class="svg-icon" v-html="icons.ai"></div>
            <div v-else class="user-avatar">{{ userInitial }}</div>
          </div>
          <div class="message-bubble">
            <div class="message-content">
              {{ message.content }}
            </div>
            <div class="message-time">
              {{ formatTime(message.timestamp) }}
            </div>
          </div>
        </div>

        <div v-if="isLoading" class="message assistant">
          <div class="message-avatar">
            <div class="svg-icon" v-html="icons.ai"></div>
          </div>
          <div class="message-bubble">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Image Upload Preview -->
      <div v-if="uploadedImages.length > 0" class="image-preview-container">
        <div
          v-for="(image, index) in uploadedImages"
          :key="index"
          class="image-preview"
        >
          <img :src="image" alt="Uploaded proof">
          <button
            class="remove-image"
            @click="removeImage(index)"
          >
            ×
          </button>
        </div>
      </div>

      <!-- Input Area -->
      <div class="chat-input-container">
        <div class="input-actions mb-2">
          <button
            class="btn btn-sm btn-outline-secondary"
            @click="triggerImageUpload"
          >
            <div class="svg-icon mr-1" v-html="icons.image"></div>
            {{ $t('addImage') }}
          </button>
          <input
            ref="imageInput"
            type="file"
            accept="image/*"
            multiple
            style="display: none"
            @change="handleImageUpload"
          >
        </div>
        <textarea
          ref="messageInput"
          v-model="newMessage"
          class="form-control message-input"
          :placeholder="$t('submitProofPlaceholder')"
          rows="3"
          :disabled="isLoading"
          @keydown.ctrl.enter="sendMessage"
          @keydown.meta.enter="sendMessage"
        ></textarea>
        <div class="d-flex justify-content-between align-items-center mt-2">
          <small class="text-muted">
            {{ $t('ctrlEnterToSend') }}
          </small>
          <button
            class="btn btn-primary"
            :disabled="!canSend"
            @click="sendMessage"
          >
            <span v-if="!isLoading">{{ $t('submit') }}</span>
            <span v-else>
              <span class="spinner-border spinner-border-sm mr-1"></span>
              {{ $t('processing') }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </b-modal>
</template>

<script>
import aiIcon from '@/assets/svg/ai.svg';
import chatIcon from '@/assets/svg/chat.svg';
import imageIcon from '@/assets/svg/image.svg';

export default {
  name: 'TaskAIChatModal',
  data() {
    return {
      task: null,
      chatMessages: [],
      newMessage: '',
      isLoading: false,
      uploadedImages: [],
      icons: {
        ai: aiIcon,
        chat: chatIcon,
        image: imageIcon,
      },
    };
  },
  computed: {
    chatTitle() {
      return this.task ? this.$t('aiAssessmentFor', { task: this.task.text }) : this.$t('aiAssessment');
    },
    statusBadgeClass() {
      const statusMap = {
        pending: 'badge-secondary',
        approved: 'badge-success',
        rejected: 'badge-danger',
        needs_revision: 'badge-warning',
      };
      return statusMap[this.task?.aiAssessmentStatus] || 'badge-secondary';
    },
    userInitial() {
      const userName = this.$store.state.user?.data?.profile?.name || 'U';
      return userName.charAt(0).toUpperCase();
    },
    canSend() {
      return !this.isLoading && this.newMessage.trim().length > 0;
    },
  },
  mounted() {
    this.$root.$on('open-ai-chat', this.handleOpenChat);
  },
  beforeDestroy() {
    this.$root.$off('open-ai-chat', this.handleOpenChat);
  },
  methods: {
    async handleOpenChat(task) {
      this.task = task;
      await this.loadMessages();
      this.$nextTick(() => {
        this.scrollToBottom();
        this.$refs.messageInput?.focus();
      });
    },

    async loadMessages() {
      try {
        this.chatMessages = await this.$store.dispatch('tasks:getTaskChatMessages', this.task._id);
      } catch (error) {
        console.error('Failed to load messages:', error);
        this.$root.$emit('habitica::error', this.$t('errorLoadingChat'));
      }
    },

    async sendMessage() {
      if (!this.canSend) return;

      const message = this.newMessage.trim();
      const attachments = [...this.uploadedImages];

      this.newMessage = '';
      this.uploadedImages = [];
      this.isLoading = true;

      try {
        const updatedTask = await this.$store.dispatch('tasks:sendTaskChatMessage', {
          taskId: this.task._id,
          message,
          attachments,
        });

        this.chatMessages = updatedTask.aiChatMessages || [];
        this.task = updatedTask;

        this.$nextTick(() => {
          this.scrollToBottom();
        });

        // If approved, show success message and close modal
        if (updatedTask.aiAssessmentStatus === 'approved') {
          setTimeout(() => {
            this.$root.$emit('habitica::success', this.$t('aiApprovedTask'));
            this.$root.$emit('bv::hide::modal', 'task-ai-chat-modal');
          }, 1500);
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        this.$root.$emit('habitica::error', this.$t('errorSendingMessage'));
        // Restore message
        this.newMessage = message;
        this.uploadedImages = attachments;
      } finally {
        this.isLoading = false;
      }
    },

    triggerImageUpload() {
      this.$refs.imageInput.click();
    },

    handleImageUpload(event) {
      const files = Array.from(event.target.files);
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = e => {
            this.uploadedImages.push(e.target.result);
          };
          reader.readAsDataURL(file);
        }
      });
      // Reset input
      event.target.value = '';
    },

    removeImage(index) {
      this.uploadedImages.splice(index, 1);
    },

    formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    scrollToBottom() {
      const container = this.$refs.messagesContainer;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    onHidden() {
      this.task = null;
      this.chatMessages = [];
      this.newMessage = '';
      this.uploadedImages = [];
      this.isLoading = false;
    },
  },
};
</script>

<style scoped lang="scss">
.ai-chat-container {
  display: flex;
  flex-direction: column;
  height: 600px;
}

.task-info-header {
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  margin-bottom: 1rem;

  h5 {
    margin-bottom: 0.5rem;
    color: white;
  }

  .status-badge {
    margin-top: 0.5rem;

    .badge {
      font-size: 0.75rem;
    }
  }
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1rem;

  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;

    .ai-icon {
      width: 48px;
      height: 48px;
      color: #667eea;
    }
  }
}

.message {
  display: flex;
  margin-bottom: 1rem;
  animation: slideIn 0.3s ease-out;

  &.user {
    flex-direction: row-reverse;

    .message-bubble {
      background: #667eea;
      color: white;
      margin-right: 0.5rem;
    }
  }

  &.assistant {
    .message-bubble {
      background: white;
      border: 1px solid #e0e0e0;
      margin-left: 0.5rem;
    }
  }

  .message-avatar {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #667eea;

    .svg-icon {
      width: 20px;
      height: 20px;
      color: white;
    }

    .user-avatar {
      color: white;
      font-weight: 600;
      font-size: 1rem;
    }
  }

  .message-bubble {
    max-width: 70%;
    padding: 0.75rem 1rem;
    border-radius: 12px;

    .message-content {
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .message-time {
      font-size: 0.7rem;
      opacity: 0.7;
      margin-top: 0.25rem;
    }
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;

  span {
    width: 8px;
    height: 8px;
    background: #999;
    border-radius: 50%;
    animation: typing 1.4s infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }

    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-8px);
  }
}

.image-preview-container {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  overflow-x: auto;

  .image-preview {
    position: relative;
    width: 100px;
    height: 100px;
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 4px;
    }

    .remove-image {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #dc3545;
      color: white;
      border: 2px solid white;
      cursor: pointer;
      font-size: 1.2rem;
      line-height: 1;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: #c82333;
      }
    }
  }
}

.chat-input-container {
  border-top: 1px solid #e0e0e0;
  padding-top: 1rem;

  .message-input {
    resize: none;
    font-size: 0.9rem;

    &:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
    }
  }

  .input-actions {
    display: flex;
    gap: 0.5rem;

    .svg-icon {
      width: 16px;
      height: 16px;
    }
  }
}
</style>
```

---

## Technical Architecture

### State Management

**Store Module**: `website/client/src/store/actions/tasks.js`

Already implemented actions:
- `sendTaskChatMessage({ taskId, message, attachments })`
- `getTaskChatMessages(taskId)`
- `toggleTaskAI({ taskId, aiEnabled })`

### Component Registration

Add new components to the main app:

```javascript
// In website/client/src/main.js or appropriate registration file
import RequiredTasksModal from '@/components/tasks/requiredTasksModal.vue';
import RewardUnlockedNotification from '@/components/notifications/rewardUnlockedNotification.vue';
import TaskAIChatModal from '@/components/tasks/taskAIChatModal.vue';

Vue.component('required-tasks-modal', RequiredTasksModal);
Vue.component('reward-unlocked-notification', RewardUnlockedNotification);
Vue.component('task-ai-chat-modal', TaskAIChatModal);
```

### Icons Required

Ensure these SVG icons are available:
- Lock icon (`lock.svg`)
- AI icon (`ai.svg` or `robot.svg`)
- Chat icon (`chat.svg`)
- Image icon (`image.svg`)
- Check/Uncheck icons (already exist)

---

## API Reference

### Task-Locked Rewards

**Scoring API Response** (when completing a task):
```javascript
POST /api/v3/tasks/:taskId/score/:direction

Response:
{
  "success": true,
  "data": {
    "delta": 0.9747,
    "_tmp": { ... },
    "unlockedRewards": [  // NEW: Array of newly unlocked rewards
      {
        "_id": "reward-uuid",
        "text": "Ice Cream",
        "notes": "Vanilla cone",
        "value": 20,
        "requiredTasks": ["task1-id", "task2-id"]
      }
    ],
    ...userStats
  }
}
```

### AI Assessment

**Send Chat Message**:
```javascript
POST /api/v3/tasks/:taskId/chat

Request:
{
  "message": "I finished watching the lecture...",
  "attachments": ["data:image/png;base64,..."]  // Optional
}

Response:
{
  "success": true,
  "data": {
    // Full task object with updated aiChatMessages and aiAssessmentStatus
    "_id": "task-uuid",
    "text": "Watch React lecture",
    "aiEnabled": true,
    "aiAssessmentStatus": "approved",  // or "rejected", "needs_revision", "pending"
    "aiChatMessages": [
      {
        "role": "user",
        "content": "I finished watching...",
        "timestamp": "2025-01-11T...",
        "attachments": []
      },
      {
        "role": "assistant",
        "content": "Great work! I can see...",
        "timestamp": "2025-01-11T..."
      }
    ],
    "completed": true,  // Auto-completed if approved
    ...
  }
}
```

**Get Chat History**:
```javascript
GET /api/v3/tasks/:taskId/chat

Response:
{
  "success": true,
  "data": [
    // Array of chat messages
  ]
}
```

**Toggle AI Assessment**:
```javascript
PUT /api/v3/tasks/:taskId/ai-enable

Request:
{
  "aiEnabled": true
}

Response:
{
  "success": true,
  "data": {
    // Updated task object
  }
}
```

---

## UI/UX Guidelines

### Design Principles

1. **Discoverability**: Features should be easy to find and understand
2. **Clarity**: Clear visual indicators for locked/unlocked states and AI status
3. **Feedback**: Immediate feedback for user actions
4. **Delight**: Celebrate achievements (reward unlocking) to increase engagement

### Color Palette

- **Primary (Habitica Purple)**: `#4a2a93`, `#667eea`
- **Success**: `#28a745`
- **Warning**: `#ffc107`
- **Danger**: `#dc3545`
- **Info**: `#4299e1`
- **Muted**: `#6c757d`
- **Light Background**: `#f8f9fa`

### Typography

- **Headings**: Bold, clear hierarchy
- **Body Text**: Readable line-height (1.5), comfortable font size (14-16px)
- **Small Text**: 12px minimum, high enough contrast

### Animations

- **Entrance**: 0.3s ease-out
- **Exit**: 0.2s ease-in
- **Interactive**: 0.15s ease-in-out
- **Celebration**: Bounce or scale effects

### Responsive Design

- **Mobile**: Stack elements vertically, larger touch targets (44px min)
- **Tablet**: Optimize layout for medium screens
- **Desktop**: Take advantage of horizontal space

---

## Testing Requirements

### Unit Tests

For each component, test:
1. **Props handling**: Verify all props are processed correctly
2. **Computed properties**: Test all computed values
3. **Methods**: Test each method with various inputs
4. **Events**: Verify events are emitted correctly

### Integration Tests

1. **Task Modal**:
   - Creating a reward with required tasks
   - Editing required tasks
   - Saving changes
   - Enabling/disabling AI assessment

2. **Task Display**:
   - Locked reward display
   - Unlock detection
   - AI status badge display
   - Chat button functionality

3. **AI Chat**:
   - Sending messages
   - Receiving responses
   - Image upload
   - Auto-completion on approval

4. **Reward Unlock Flow**:
   - Complete task → Check for unlocked rewards → Show notification

### E2E Tests

1. **Complete User Flow - Task-Locked Rewards**:
   ```
   1. Create a daily task "Morning Exercise"
   2. Create a reward "Ice Cream" with "Morning Exercise" as required task
   3. Verify reward is locked
   4. Complete "Morning Exercise"
   5. Verify reward is unlocked
   6. Verify unlock notification appears
   7. Purchase reward successfully
   ```

2. **Complete User Flow - AI Assessment**:
   ```
   1. Create a todo "Watch React lecture"
   2. Enable AI assessment
   3. Save task
   4. Open AI chat
   5. Submit proof of completion
   6. Receive AI feedback
   7. Verify task auto-completes if approved
   8. Verify task remains incomplete if rejected
   ```

### Manual Testing Checklist

- [ ] Reward locks when required tasks are set
- [ ] Reward unlocks when all required tasks are completed
- [ ] Unlock notification appears with correct rewards
- [ ] AI toggle enables/disables correctly
- [ ] AI chat opens and displays messages
- [ ] Messages send and receive correctly
- [ ] Task auto-completes on AI approval
- [ ] Assessment status updates correctly
- [ ] All animations work smoothly
- [ ] Mobile responsive layouts work
- [ ] Error handling works for all API failures
- [ ] Loading states display correctly

---

## Translation Keys

Add to `website/common/locales/en/*.json`:

```json
{
  "requiredTasks": "Required Tasks",
  "requiredTasksDescription": "Select tasks that must be completed before this reward can be purchased",
  "requiredTasksFor": "Required Tasks for {reward}",
  "noTasksAvailable": "No tasks available",
  "completed": "Completed",
  "rewardLocked": "Complete {count} more task(s) to unlock",
  "viewRequiredTasks": "View Required Tasks",
  "incompletedTasks": "Tasks to Complete",
  "completedTasks": "Completed Tasks",
  "allTasksCompleted": "All required tasks completed! This reward is now available.",
  "rewardsUnlocked": "Rewards Unlocked!",
  "congratulations": "Congratulations",
  "rewardsUnlockedMessage": "You've unlocked {count} new reward(s)!",
  "awesome": "Awesome",

  "enableAIAssessment": "Enable AI Assessment",
  "aiAssessmentDescription": "Require proof of completion verified by AI",
  "aiAssessmentBenefit1": "Stay accountable with AI verification",
  "aiAssessmentBenefit2": "Submit text or photo evidence",
  "aiAssessmentBenefit3": "Get helpful feedback from AI",
  "aiAssessmentNote": "You'll need to submit proof via chat to complete this task",
  "note": "Note",

  "aiStatus_pending": "Pending Assessment",
  "aiStatus_approved": "Approved",
  "aiStatus_rejected": "Needs More Work",
  "aiStatus_needs_revision": "Needs Revision",

  "submitProof": "Submit Proof",
  "aiCompletionRequired": "Submit proof in AI chat to complete",
  "aiAssessment": "AI Assessment",
  "aiAssessmentFor": "AI Assessment: {task}",
  "aiChatWelcome": "Hello! I'm here to help you stay accountable.",
  "aiChatInstructions": "Submit proof that you completed this task, and I'll verify it for you.",
  "submitProofPlaceholder": "Describe what you did, or upload a photo as proof...",
  "ctrlEnterToSend": "Ctrl/Cmd + Enter to send",
  "submit": "Submit",
  "processing": "Processing...",
  "addImage": "Add Image",
  "aiApprovedTask": "Great work! Your task has been approved and completed.",

  "errorLoadingChat": "Failed to load chat messages. Please try again.",
  "errorSendingMessage": "Failed to send message. Please try again.",
  "rewardLockedByTasks": "This reward is locked until you complete all required tasks"
}
```

---

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Load AI chat modal only when needed
2. **Debouncing**: Debounce search/filter operations
3. **Virtual Scrolling**: For long chat histories
4. **Image Optimization**: Compress images before upload
5. **Caching**: Cache task data to reduce API calls

### Bundle Size

- Keep AI chat modal code-split
- Lazy load icons that aren't immediately visible
- Use tree-shaking for utilities

---

## Accessibility

### Requirements

1. **Keyboard Navigation**: All interactive elements accessible via keyboard
2. **Screen Readers**: Proper ARIA labels and roles
3. **Focus Management**: Clear focus indicators
4. **Color Contrast**: WCAG AA compliance minimum
5. **Alt Text**: All images have descriptive alt text

### Implementation

```vue
<!-- Example: Accessible checkbox -->
<div class="custom-control custom-checkbox">
  <input
    :id="`req-task-${task._id}`"
    v-model="selectedTasks"
    type="checkbox"
    class="custom-control-input"
    :value="task._id"
    :aria-label="$t('selectRequiredTask', { task: task.text })"
  >
  <label
    class="custom-control-label"
    :for="`req-task-${task._id}`"
  >
    {{ task.text }}
  </label>
</div>
```

---

## Browser Support

- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions
- **Mobile Safari**: iOS 13+
- **Mobile Chrome**: Latest 2 versions

---

## Error Handling

### API Errors

Handle these scenarios:
1. **Network errors**: Show retry option
2. **Validation errors**: Display field-specific messages
3. **Authentication errors**: Redirect to login
4. **Server errors**: Show user-friendly message

### Example Error Handler:

```javascript
async sendMessage() {
  try {
    // API call
  } catch (error) {
    if (error.response) {
      // Server responded with error
      const message = error.response.data.message || this.$t('errorSendingMessage');
      this.$root.$emit('habitica::error', message);
    } else if (error.request) {
      // No response received
      this.$root.$emit('habitica::error', this.$t('networkError'));
    } else {
      // Other errors
      this.$root.$emit('habitica::error', this.$t('unexpectedError'));
    }
  }
}
```

---

## Future Enhancements

Ideas for v2.0:
1. Reward unlock animations with confetti
2. AI chat voice input
3. Batch AI assessment
4. Custom AI assessment criteria per task
5. Assessment history and analytics
6. Reward unlock scheduling
7. Social sharing of achievements

---

## Questions & Support

For questions about implementation, consult:
- `IMPLEMENTATION_GUIDE.md` for backend details
- Habitica's existing component patterns
- Vue.js 2.x documentation
- Bootstrap 4 documentation

---

## Sign-off Checklist

Before considering the frontend complete:

- [ ] All components created and registered
- [ ] All translations added
- [ ] All API integrations working
- [ ] All manual tests passing
- [ ] Responsive design verified
- [ ] Accessibility requirements met
- [ ] Browser compatibility verified
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Success/failure feedback working
- [ ] Code reviewed and approved
- [ ] Documentation updated
