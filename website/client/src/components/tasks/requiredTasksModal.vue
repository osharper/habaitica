<template>
  <b-modal
    id="required-tasks-modal"
    :title="$t('requiredTasksForReward')"
    size="md"
    :hide-footer="true"
  >
    <div v-if="reward" class="required-tasks-modal-content">
      <!-- Reward Info -->
      <div class="reward-info mb-4">
        <h5 class="reward-name">{{ reward.text }}</h5>
        <p v-if="reward.notes" class="reward-notes text-muted">
          {{ reward.notes }}
        </p>
        <div class="reward-value d-flex align-items-center">
          <div class="svg-icon gold-icon mr-2" v-html="icons.gold"></div>
          <strong>{{ reward.value }}</strong>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-section mb-4">
        <div class="d-flex justify-content-between mb-2">
          <span class="progress-label">{{ $t('progress') }}</span>
          <span class="progress-percentage">{{ progressPercentage }}%</span>
        </div>
        <b-progress
          :value="progressPercentage"
          :max="100"
          class="mb-2"
        />
        <p class="small text-muted">
          {{ $t('tasksCompletedCount', { completed: completedTasks.length, total: totalTasks }) }}
        </p>
      </div>

      <!-- Incomplete Tasks -->
      <div v-if="incompletedTasks.length > 0" class="tasks-section mb-4">
        <h6 class="section-title">
          <div class="svg-icon lock-icon mr-2" v-html="icons.lock"></div>
          {{ $t('tasksToComplete') }}
        </h6>
        <ul class="task-list">
          <li
            v-for="task in incompletedTasks"
            :key="task._id"
            class="task-item incomplete"
          >
            <div class="custom-control custom-checkbox">
              <input
                :id="`task-${task._id}`"
                type="checkbox"
                class="custom-control-input"
                disabled
                :checked="false"
              >
              <label
                :for="`task-${task._id}`"
                class="custom-control-label"
              >
                {{ task.text }}
              </label>
            </div>
            <span class="task-type-badge badge badge-secondary ml-2">
              {{ $t(task.type) }}
            </span>
          </li>
        </ul>
      </div>

      <!-- Completed Tasks -->
      <div v-if="completedTasks.length > 0" class="tasks-section">
        <h6 class="section-title">
          <div class="svg-icon check-icon mr-2" v-html="icons.check"></div>
          {{ $t('completedTasks') }}
        </h6>
        <ul class="task-list">
          <li
            v-for="task in completedTasks"
            :key="task._id"
            class="task-item completed"
          >
            <div class="custom-control custom-checkbox">
              <input
                :id="`task-${task._id}`"
                type="checkbox"
                class="custom-control-input"
                disabled
                :checked="true"
              >
              <label
                :for="`task-${task._id}`"
                class="custom-control-label"
              >
                {{ task.text }}
              </label>
            </div>
            <span class="task-type-badge badge badge-success ml-2">
              {{ $t(task.type) }}
            </span>
          </li>
        </ul>
      </div>

      <!-- All Complete Message -->
      <div v-if="incompletedTasks.length === 0" class="all-complete-message">
        <div class="svg-icon check-icon-large mb-2" v-html="icons.check"></div>
        <h5 class="text-success">{{ $t('allTasksComplete') }}</h5>
        <p class="text-muted">{{ $t('rewardNowAvailable') }}</p>
      </div>
    </div>
  </b-modal>
</template>

<style lang="scss" scoped>
  @import '@/assets/scss/colors.scss';

  .required-tasks-modal-content {
    padding: 8px;
  }

  .reward-info {
    padding: 16px;
    background-color: $gray-700;
    border-radius: 8px;

    .reward-name {
      font-size: 18px;
      font-weight: 600;
      color: $gray-10;
      margin-bottom: 8px;
    }

    .reward-notes {
      font-size: 14px;
      margin-bottom: 12px;
    }

    .reward-value {
      font-size: 16px;
      color: $yellow-10;

      .gold-icon {
        width: 20px;
        height: 20px;
      }
    }
  }

  .progress-section {
    .progress-label {
      font-weight: 600;
      color: $gray-10;
    }

    .progress-percentage {
      font-weight: 600;
      color: $green-10;
    }
  }

  .tasks-section {
    .section-title {
      display: flex;
      align-items: center;
      font-weight: 600;
      color: $gray-10;
      margin-bottom: 12px;

      .svg-icon {
        width: 16px;
        height: 16px;
      }

      .lock-icon {
        color: $orange-100;
      }

      .check-icon {
        color: $green-10;
      }
    }

    .task-list {
      list-style: none;
      padding: 0;
      margin: 0;

      .task-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        margin-bottom: 8px;
        border-radius: 4px;
        background-color: $gray-700;

        &.incomplete {
          border-left: 3px solid $orange-100;
        }

        &.completed {
          border-left: 3px solid $green-10;
          opacity: 0.7;

          .custom-control-label {
            text-decoration: line-through;
            color: $gray-200;
          }
        }

        .custom-control {
          flex-grow: 1;
        }

        .task-type-badge {
          font-size: 10px;
          padding: 4px 8px;
          text-transform: capitalize;
        }
      }
    }
  }

  .all-complete-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    text-align: center;

    .check-icon-large {
      width: 48px;
      height: 48px;
      color: $green-10;
    }

    h5 {
      margin-bottom: 8px;
    }
  }
</style>

<script>
import goldIcon from '@/assets/svg/gold.svg?raw';
import lockIcon from '@/assets/svg/lock.svg?raw';
import checkIcon from '@/assets/svg/check.svg?raw';

export default {
  data () {
    return {
      reward: null,
      incompletedTasks: [],
      completedTasks: [],
      icons: Object.freeze({
        gold: goldIcon,
        lock: lockIcon,
        check: checkIcon,
      }),
    };
  },
  computed: {
    totalTasks () {
      return this.incompletedTasks.length + this.completedTasks.length;
    },
    progressPercentage () {
      if (this.totalTasks === 0) return 0;
      return Math.round((this.completedTasks.length / this.totalTasks) * 100);
    },
  },
  mounted () {
    this.$root.$on('show-required-tasks', this.handleShowRequiredTasks);
  },
  beforeDestroy () {
    this.$root.$off('show-required-tasks', this.handleShowRequiredTasks);
  },
  methods: {
    handleShowRequiredTasks (data) {
      this.reward = data.reward;
      this.incompletedTasks = this.getTaskDetails(data.incompleted);
      this.completedTasks = this.getTaskDetails(data.completed);
    },
    getTaskDetails (taskIds) {
      if (!taskIds || taskIds.length === 0) return [];

      const allTasks = [
        ...(this.$store.state.tasks?.data?.dailys || []),
        ...(this.$store.state.tasks?.data?.todos || []),
      ];

      return taskIds.map(taskId => {
        const task = allTasks.find(t => t._id === taskId);
        return task || { _id: taskId, text: 'Unknown task', type: 'unknown' };
      });
    },
  },
};
</script>
