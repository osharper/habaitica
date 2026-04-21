<template>
  <b-modal
    id="reward-unlocked-modal"
    :title="$t('rewardsUnlocked')"
    size="md"
    :hide-footer="true"
    modal-class="reward-unlocked-modal-wrapper"
    @shown="playAnimation"
  >
    <div class="reward-unlocked-content">
      <!-- Celebration Header -->
      <div class="celebration-header text-center mb-4">
        <div class="celebration-icon-wrapper">
          <div class="svg-icon celebration-icon" v-html="icons.gold"></div>
        </div>
        <h4 class="celebration-title">{{ $t('congratulations') }}</h4>
        <p class="celebration-subtitle">
          {{ $t('rewardsUnlockedMessage', { count: unlockedRewards.length }) }}
        </p>
      </div>

      <!-- Unlocked Rewards List -->
      <div class="unlocked-rewards-list">
        <div
          v-for="(reward, index) in unlockedRewards"
          :key="reward._id"
          class="reward-card"
          :class="{ 'animate-in': animateCards }"
          :style="{ 'animation-delay': `${index * 0.1}s` }"
        >
          <div class="reward-card-content">
            <div class="reward-header d-flex align-items-center justify-content-between">
              <div class="reward-title-section flex-grow-1">
                <h5 class="reward-title">{{ reward.text }}</h5>
                <p v-if="reward.notes" class="reward-description text-muted small">
                  {{ reward.notes }}
                </p>
              </div>
              <div class="reward-value-badge">
                <div class="svg-icon gold-icon" v-html="icons.gold"></div>
                <span class="value">{{ reward.value }}</span>
              </div>
            </div>

            <!-- Required Tasks Info -->
            <div
              v-if="reward.requiredTasks && reward.requiredTasks.length > 0"
              class="required-tasks-info mt-2"
            >
              <div class="small text-muted">
                <div class="svg-icon check-icon-small mr-1" v-html="icons.check"></div>
                {{ $t('completedRequiredTasks', { count: reward.requiredTasks.length }) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <div class="action-section text-center mt-4">
        <button
          class="btn btn-primary btn-lg"
          @click="closeModal"
        >
          {{ $t('awesome') }}
        </button>
      </div>
    </div>
  </b-modal>
</template>

<style lang="scss" scoped>
  @import '@/assets/scss/colors.scss';

  .reward-unlocked-content {
    padding: 16px;
  }

  .celebration-header {
    .celebration-icon-wrapper {
      position: relative;
      display: inline-block;
      margin-bottom: 16px;

      .celebration-icon {
        width: 64px;
        height: 64px;
        color: $yellow-10;
        animation: bounce 1s ease-in-out;
      }
    }

    .celebration-title {
      font-size: 24px;
      font-weight: 700;
      color: $green-10;
      margin-bottom: 8px;
    }

    .celebration-subtitle {
      font-size: 16px;
      color: $gray-100;
      margin-bottom: 0;
    }
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0) scale(1);
    }
    25% {
      transform: translateY(-20px) scale(1.1);
    }
    50% {
      transform: translateY(0) scale(1);
    }
    75% {
      transform: translateY(-10px) scale(1.05);
    }
  }

  .unlocked-rewards-list {
    .reward-card {
      background: linear-gradient(135deg, $purple-50 0%, $blue-50 100%);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 4px 6px rgba($black, 0.1);
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;

      &.animate-in {
        animation: slideInUp 0.5s ease-out forwards;
      }

      &:hover {
        box-shadow: 0 6px 12px rgba($black, 0.15);
        transform: translateY(-2px);
      }

      .reward-card-content {
        .reward-header {
          .reward-title-section {
            .reward-title {
              font-size: 18px;
              font-weight: 600;
              color: $white;
              margin-bottom: 4px;
            }

            .reward-description {
              font-size: 13px;
              color: rgba($white, 0.8);
              margin-bottom: 0;
            }
          }

          .reward-value-badge {
            display: flex;
            align-items: center;
            background-color: rgba($yellow-10, 0.2);
            padding: 8px 12px;
            border-radius: 20px;
            border: 2px solid $yellow-10;

            .gold-icon {
              width: 20px;
              height: 20px;
              color: $yellow-10;
              margin-right: 6px;
            }

            .value {
              font-size: 16px;
              font-weight: 700;
              color: $yellow-10;
            }
          }
        }

        .required-tasks-info {
          display: flex;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid rgba($white, 0.2);
          color: rgba($white, 0.9);

          .check-icon-small {
            width: 14px;
            height: 14px;
            color: $green-10;
            display: inline-block;
            vertical-align: middle;
          }
        }
      }
    }
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .action-section {
    .btn-primary {
      padding: 12px 32px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 24px;
      box-shadow: 0 4px 8px rgba($purple-300, 0.3);
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba($purple-300, 0.4);
      }
    }
  }
</style>

<style lang="scss">
  // Global styles for the modal wrapper to add celebration effects
  .reward-unlocked-modal-wrapper {
    .modal-content {
      border: 3px solid;
      border-image: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%) 1;
      animation: borderGlow 2s ease-in-out infinite;
    }

    .modal-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-bottom: none;

      .modal-title {
        font-weight: 700;
        font-size: 20px;
      }

      .close {
        color: white;
        opacity: 0.9;

        &:hover {
          opacity: 1;
        }
      }
    }
  }

  @keyframes borderGlow {
    0%, 100% {
      filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.5));
    }
    50% {
      filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.8));
    }
  }
</style>

<script>
import goldIcon from '@/assets/svg/gold.svg?raw';
import checkIcon from '@/assets/svg/check.svg?raw';

export default {
  data () {
    return {
      unlockedRewards: [],
      animateCards: false,
      icons: Object.freeze({
        gold: goldIcon,
        check: checkIcon,
      }),
    };
  },
  mounted () {
    this.$root.$on('show-unlocked-rewards', this.handleShowUnlockedRewards);
  },
  beforeDestroy () {
    this.$root.$off('show-unlocked-rewards', this.handleShowUnlockedRewards);
  },
  methods: {
    handleShowUnlockedRewards (unlockedRewards) {
      if (!unlockedRewards || unlockedRewards.length === 0) return;

      this.unlockedRewards = unlockedRewards;
      this.animateCards = false;

      // Show the modal
      this.$root.$emit('bv::show::modal', 'reward-unlocked-modal');
    },
    playAnimation () {
      // Trigger card animations after modal is shown
      setTimeout(() => {
        this.animateCards = true;
      }, 100);
    },
    closeModal () {
      this.$root.$emit('bv::hide::modal', 'reward-unlocked-modal');

      // Reset animation state for next time
      setTimeout(() => {
        this.animateCards = false;
      }, 300);
    },
  },
};
</script>
