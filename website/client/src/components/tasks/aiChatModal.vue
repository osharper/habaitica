<template>
  <b-modal
    id="task-ai-chat-modal"
    :title="$t('aiTaskAssessment')"
    size="lg"
    :hide-footer="true"
    modal-class="ai-chat-modal-wrapper"
    @shown="onModalShown"
  >
    <div v-if="task" class="ai-chat-content">
      <!-- Task Info Header -->
      <div class="task-info-header mb-3">
        <div class="d-flex align-items-start justify-content-between">
          <div class="task-details flex-grow-1">
            <h5 class="task-title">{{ task.text }}</h5>
            <p v-if="task.notes" class="task-notes text-muted small">
              {{ task.notes }}
            </p>
          </div>
          <span
            class="badge assessment-status-badge ml-3"
            :class="assessmentStatusClass"
          >
            {{ $t(`aiStatus_${task.aiAssessmentStatus}`) }}
          </span>
        </div>
      </div>

      <!-- Chat Messages Area -->
      <div ref="chatMessages" class="chat-messages-container">
        <!-- Welcome Message -->
        <div v-if="messages.length === 0" class="welcome-message">
          <div class="svg-icon ai-icon-large mb-3" v-html="icons.ai"></div>
          <h6>{{ $t('aiChatWelcome') }}</h6>
          <p class="text-muted small">{{ $t('aiChatInstructions') }}</p>
        </div>

        <!-- Message List -->
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="message-wrapper"
          :class="message.role"
        >
          <div class="message-bubble">
            <div class="message-header">
              <div class="svg-icon message-icon" v-html="message.role === 'user' ? icons.user : icons.ai"></div>
              <span class="message-sender">{{ message.role === 'user' ? $t('you') : $t('aiAssistant') }}</span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
            <div class="message-content">
              <p>{{ message.content }}</p>
              <!-- Image Attachments -->
              <div v-if="message.attachments && message.attachments.length > 0" class="message-attachments mt-2">
                <div
                  v-for="(attachment, attIndex) in message.attachments"
                  :key="attIndex"
                  class="attachment-item"
                >
                  <div class="svg-icon image-icon" v-html="icons.image"></div>
                  <span class="attachment-label">{{ $t('imageAttachment') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Typing Indicator -->
        <div v-if="isAITyping" class="message-wrapper assistant typing-indicator">
          <div class="message-bubble">
            <div class="message-header">
              <div class="svg-icon message-icon" v-html="icons.ai"></div>
              <span class="message-sender">{{ $t('aiAssistant') }}</span>
            </div>
            <div class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Assessment Result Banner -->
      <div
        v-if="task.aiAssessmentStatus !== 'pending'"
        class="assessment-result-banner"
        :class="assessmentStatusClass"
      >
        <div class="svg-icon banner-icon" v-html="getBannerIcon()"></div>
        <div class="banner-content">
          <strong>{{ getAssessmentBannerTitle() }}</strong>
          <p class="mb-0">{{ getAssessmentBannerMessage() }}</p>
        </div>
      </div>

      <!-- Input Area -->
      <div class="chat-input-area">
        <div class="input-wrapper">
          <textarea
            ref="messageInput"
            v-model="newMessage"
            class="form-control message-input"
            :placeholder="$t('typeYourMessage')"
            rows="3"
            :disabled="isSending || task.aiAssessmentStatus === 'approved'"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.enter.shift.exact="newMessage += '\n'"
          ></textarea>

          <!-- Image Upload Button -->
          <div class="input-actions">
            <label
              class="image-upload-btn"
              :class="{ disabled: isSending || task.aiAssessmentStatus === 'approved' }"
            >
              <input
                ref="imageInput"
                type="file"
                accept="image/*"
                multiple
                class="d-none"
                :disabled="isSending || task.aiAssessmentStatus === 'approved'"
                @change="handleImageUpload"
              >
              <div class="svg-icon" v-html="icons.image"></div>
              <span class="small">{{ $t('attachImage') }}</span>
            </label>

            <!-- Selected Images Preview -->
            <div v-if="selectedImages.length > 0" class="selected-images-preview">
              <div
                v-for="(image, index) in selectedImages"
                :key="index"
                class="selected-image-item"
              >
                <span class="image-name">{{ image.name }}</span>
                <button
                  class="btn-remove"
                  @click="removeImage(index)"
                >
                  ×
                </button>
              </div>
            </div>

            <!-- Send Button -->
            <button
              class="btn btn-primary send-btn"
              :disabled="!canSendMessage"
              @click="sendMessage"
            >
              <span v-if="!isSending">{{ $t('send') }}</span>
              <span v-else>
                <span class="spinner-border spinner-border-sm mr-2"></span>
                {{ $t('sending') }}
              </span>
            </button>
          </div>
        </div>

        <!-- Hints -->
        <div class="input-hints small text-muted">
          <div>{{ $t('aiChatHint') }}</div>
          <div>{{ $t('pressEnterToSend') }}</div>
        </div>
      </div>
    </div>
  </b-modal>
</template>

<style lang="scss" scoped>
  @import '@/assets/scss/colors.scss';

  .ai-chat-content {
    display: flex;
    flex-direction: column;
    height: 70vh;
    max-height: 600px;
  }

  .task-info-header {
    padding: 16px;
    background-color: $gray-700;
    border-radius: 8px;
    flex-shrink: 0;

    .task-title {
      font-size: 18px;
      font-weight: 600;
      color: $gray-10;
      margin-bottom: 4px;
    }

    .task-notes {
      font-size: 13px;
      margin-bottom: 0;
    }

    .assessment-status-badge {
      font-size: 12px;
      padding: 6px 12px;
      white-space: nowrap;
      font-weight: 600;

      &.badge-success {
        background-color: $green-10;
        color: white;
      }

      &.badge-danger {
        background-color: $red-10;
        color: white;
      }

      &.badge-warning {
        background-color: $orange-100;
        color: white;
      }

      &.badge-secondary {
        background-color: $gray-200;
        color: white;
      }
    }
  }

  .chat-messages-container {
    flex-grow: 1;
    overflow-y: auto;
    padding: 16px;
    background-color: $gray-700;
    border-radius: 8px;
    margin-bottom: 16px;
    min-height: 200px;
    max-height: 400px;

    .welcome-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      color: $gray-100;

      .ai-icon-large {
        width: 48px;
        height: 48px;
        color: $purple-300;
      }

      h6 {
        font-weight: 600;
        color: $gray-50;
      }
    }

    .message-wrapper {
      margin-bottom: 16px;
      display: flex;

      &.user {
        justify-content: flex-end;

        .message-bubble {
          background-color: $purple-300;
          color: white;
          border-bottom-right-radius: 4px;
        }
      }

      &.assistant {
        justify-content: flex-start;

        .message-bubble {
          background-color: $white;
          color: $gray-10;
          border-bottom-left-radius: 4px;
        }
      }

      .message-bubble {
        max-width: 75%;
        padding: 12px;
        border-radius: 12px;
        box-shadow: 0 2px 4px rgba($black, 0.1);

        .message-header {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
          font-size: 12px;

          .message-icon {
            width: 16px;
            height: 16px;
            margin-right: 6px;
          }

          .message-sender {
            font-weight: 600;
            margin-right: 8px;
          }

          .message-time {
            opacity: 0.7;
            font-size: 11px;
          }
        }

        .message-content {
          p {
            margin-bottom: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.5;
          }

          .message-attachments {
            .attachment-item {
              display: inline-flex;
              align-items: center;
              padding: 4px 8px;
              background-color: rgba($black, 0.1);
              border-radius: 4px;
              margin-right: 8px;

              .image-icon {
                width: 14px;
                height: 14px;
                margin-right: 4px;
              }

              .attachment-label {
                font-size: 11px;
              }
            }
          }
        }
      }

      &.typing-indicator {
        .message-bubble {
          padding: 12px 20px;
        }

        .typing-dots {
          display: flex;
          align-items: center;
          gap: 4px;

          span {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: $gray-200;
            animation: typingBounce 1.4s infinite ease-in-out;

            &:nth-child(1) {
              animation-delay: 0s;
            }

            &:nth-child(2) {
              animation-delay: 0.2s;
            }

            &:nth-child(3) {
              animation-delay: 0.4s;
            }
          }
        }
      }
    }
  }

  @keyframes typingBounce {
    0%, 60%, 100% {
      transform: translateY(0);
    }
    30% {
      transform: translateY(-8px);
    }
  }

  .assessment-result-banner {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;

    &.badge-success {
      background-color: rgba($green-10, 0.1);
      border: 2px solid $green-10;
      color: $green-10;
    }

    &.badge-danger {
      background-color: rgba($red-10, 0.1);
      border: 2px solid $red-10;
      color: $red-10;
    }

    &.badge-warning {
      background-color: rgba($orange-100, 0.1);
      border: 2px solid $orange-100;
      color: $orange-100;
    }

    .banner-icon {
      width: 24px;
      height: 24px;
      margin-right: 12px;
      flex-shrink: 0;
    }

    .banner-content {
      strong {
        display: block;
        font-size: 14px;
        margin-bottom: 2px;
      }

      p {
        font-size: 12px;
        opacity: 0.9;
      }
    }
  }

  .chat-input-area {
    flex-shrink: 0;

    .input-wrapper {
      .message-input {
        resize: none;
        border-radius: 8px;
        border: 2px solid $gray-400;
        font-size: 14px;
        transition: border-color 0.2s;

        &:focus {
          border-color: $purple-300;
          box-shadow: 0 0 0 0.2rem rgba($purple-300, 0.25);
        }

        &:disabled {
          background-color: $gray-600;
          cursor: not-allowed;
        }
      }

      .input-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 12px;

        .image-upload-btn {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background-color: $gray-600;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
          margin-bottom: 0;

          &:hover:not(.disabled) {
            background-color: $gray-500;
          }

          &.disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .svg-icon {
            width: 16px;
            height: 16px;
            margin-right: 6px;
          }

          span {
            color: $gray-100;
          }
        }

        .selected-images-preview {
          flex-grow: 1;
          margin: 0 12px;

          .selected-image-item {
            display: inline-flex;
            align-items: center;
            background-color: $gray-600;
            padding: 4px 8px;
            border-radius: 4px;
            margin-right: 8px;
            margin-bottom: 4px;

            .image-name {
              font-size: 12px;
              color: $gray-100;
              margin-right: 6px;
              max-width: 150px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .btn-remove {
              background: none;
              border: none;
              color: $red-50;
              font-size: 20px;
              line-height: 1;
              padding: 0;
              cursor: pointer;
              margin-left: 4px;

              &:hover {
                color: $red-10;
              }
            }
          }
        }

        .send-btn {
          padding: 8px 24px;
          font-weight: 600;
          border-radius: 6px;
          white-space: nowrap;

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }
    }

    .input-hints {
      margin-top: 8px;
      display: flex;
      justify-content: space-between;

      div {
        font-size: 11px;
      }
    }
  }

  // Scrollbar styling
  .chat-messages-container {
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: $gray-600;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: $gray-400;
      border-radius: 4px;

      &:hover {
        background: $gray-300;
      }
    }
  }
</style>

<style lang="scss">
  @import '@/assets/scss/colors.scss';

  .ai-chat-modal-wrapper {
    .modal-header {
      background-color: $purple-300;
      color: white;
      border-bottom: none;

      .modal-title {
        font-weight: 600;
      }

      .close {
        color: white;
        opacity: 0.9;

        &:hover {
          opacity: 1;
        }
      }
    }

    .modal-body {
      padding: 20px;
    }
  }
</style>

<script>
import moment from 'moment';
import { mapActions } from '@/libs/store';
import aiIcon from '@/assets/svg/ai.svg?raw';
import chatIcon from '@/assets/svg/chat.svg?raw';
import imageIcon from '@/assets/svg/image.svg?raw';
import checkIcon from '@/assets/svg/check.svg?raw';
import lockIcon from '@/assets/svg/lock.svg?raw';

export default {
  data () {
    return {
      task: null,
      messages: [],
      newMessage: '',
      selectedImages: [],
      isSending: false,
      isAITyping: false,
      icons: Object.freeze({
        ai: aiIcon,
        chat: chatIcon,
        image: imageIcon,
        check: checkIcon,
        lock: lockIcon,
        user: chatIcon, // Using chat icon for user, can be replaced with a user icon
      }),
    };
  },
  computed: {
    canSendMessage () {
      return (
        !this.isSending
        && this.task
        && this.task.aiAssessmentStatus !== 'approved'
        && (this.newMessage.trim().length > 0 || this.selectedImages.length > 0)
      );
    },
    assessmentStatusClass () {
      const statusMap = {
        pending: 'badge-secondary',
        approved: 'badge-success',
        rejected: 'badge-danger',
        needs_revision: 'badge-warning',
      };
      return statusMap[this.task?.aiAssessmentStatus] || 'badge-secondary';
    },
  },
  mounted () {
    this.$root.$on('open-ai-chat', this.handleOpenAIChat);
  },
  beforeDestroy () {
    this.$root.$off('open-ai-chat', this.handleOpenAIChat);
  },
  methods: {
    ...mapActions({
      sendTaskChatMessage: 'tasks:sendTaskChatMessage',
      getTaskChatMessages: 'tasks:getTaskChatMessages',
    }),
    async handleOpenAIChat (task) {
      this.task = task;
      this.newMessage = '';
      this.selectedImages = [];
      this.isSending = false;
      this.isAITyping = false;

      // Load existing chat messages
      await this.loadChatMessages();
    },
    async loadChatMessages () {
      try {
        const response = await this.getTaskChatMessages(this.task._id);
        this.messages = response.aiChatMessages || [];
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      } catch (error) {
        console.error('Failed to load chat messages:', error);
        this.messages = [];
      }
    },
    onModalShown () {
      this.$nextTick(() => {
        if (this.$refs.messageInput) {
          this.$refs.messageInput.focus();
        }
        this.scrollToBottom();
      });
    },
    async sendMessage () {
      if (!this.canSendMessage) return;

      const message = this.newMessage.trim();
      const attachments = this.selectedImages.map(img => img.name); // In real implementation, upload images first

      // Add user message to UI immediately
      this.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date(),
        attachments,
      });

      // Clear input
      this.newMessage = '';
      this.selectedImages = [];

      // Scroll to bottom
      this.$nextTick(() => {
        this.scrollToBottom();
      });

      // Show typing indicator
      this.isSending = true;
      this.isAITyping = true;

      try {
        // Send to backend
        const response = await this.sendTaskChatMessage({
          taskId: this.task._id,
          message,
          attachments,
        });

        // Update task with new data
        Object.assign(this.task, response);

        // Add AI response
        if (response.aiChatMessages && response.aiChatMessages.length > 0) {
          const lastMessage = response.aiChatMessages[response.aiChatMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            this.messages.push(lastMessage);
          }
        }

        // Auto-complete task if approved
        if (response.aiAssessmentStatus === 'approved' && !this.task.completed) {
          this.task.completed = true;
          this.$emit('taskCompleted', this.task);
        }

        // Scroll to bottom
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      } catch (error) {
        console.error('Failed to send message:', error);
        // Show error message
        this.messages.push({
          role: 'assistant',
          content: this.$t('aiChatError'),
          timestamp: new Date(),
        });
      } finally {
        this.isSending = false;
        this.isAITyping = false;
      }
    },
    handleImageUpload (event) {
      const files = Array.from(event.target.files);
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          this.selectedImages.push(file);
        }
      });
      // Clear input
      event.target.value = '';
    },
    removeImage (index) {
      this.selectedImages.splice(index, 1);
    },
    scrollToBottom () {
      if (this.$refs.chatMessages) {
        this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
      }
    },
    formatTime (timestamp) {
      return moment(timestamp).format('HH:mm');
    },
    getBannerIcon () {
      const iconMap = {
        approved: this.icons.check,
        rejected: this.icons.lock,
        needs_revision: this.icons.ai,
      };
      return iconMap[this.task.aiAssessmentStatus] || this.icons.ai;
    },
    getAssessmentBannerTitle () {
      const titleMap = {
        approved: this.$t('taskApproved'),
        rejected: this.$t('taskRejected'),
        needs_revision: this.$t('needsRevision'),
      };
      return titleMap[this.task.aiAssessmentStatus] || '';
    },
    getAssessmentBannerMessage () {
      const messageMap = {
        approved: this.$t('taskApprovedMessage'),
        rejected: this.$t('taskRejectedMessage'),
        needs_revision: this.$t('needsRevisionMessage'),
      };
      return messageMap[this.task.aiAssessmentStatus] || '';
    },
  },
};
</script>
