<script setup>
import { useToast } from '@/composables/useToast'

const { toasts, removeToast } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="hs-toast-container" aria-live="polite">
      <TransitionGroup name="hs-toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="hs-toast"
          :class="['hs-toast--' + toast.type, { 'hs-toast--removing': toast.removing }]"
          role="alert"
        >
          <span class="hs-toast-icon mdi" :class="toast.icon"></span>
          <span class="hs-toast-msg">{{ toast.message }}</span>
          <button class="hs-toast-close" @click="removeToast(toast.id)" aria-label="Close">
            <span class="mdi mdi-close"></span>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.hs-toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 420px;
  width: 100%;
  pointer-events: none;
}

.hs-toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: var(--hs-radius-lg);
  background: var(--hs-white);
  border: 1px solid var(--hs-border);
  box-shadow: var(--hs-shadow-xl);
  font-family: var(--hs-font-family);
  font-size: var(--hs-font-size-base);
  color: var(--hs-gray-800);
  pointer-events: auto;
  animation: hs-toast-in 280ms ease;
}

.hs-toast--removing {
  animation: hs-toast-out 280ms ease forwards;
}

.hs-toast-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.hs-toast-msg {
  flex: 1;
  line-height: 1.5;
  font-weight: 500;
}

.hs-toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: none;
  border-radius: var(--hs-radius-sm);
  color: var(--hs-gray-400);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 120ms ease;
  font-size: 16px;
}

.hs-toast-close:hover {
  background: var(--hs-gray-100);
  color: var(--hs-gray-700);
}

/* Toast type variants */
.hs-toast--success {
  background: var(--hs-success-bg);
  border-color: var(--hs-success-border);
}
.hs-toast--success .hs-toast-icon {
  color: var(--hs-success);
}

.hs-toast--error {
  background: var(--hs-danger-bg);
  border-color: var(--hs-danger-border);
}
.hs-toast--error .hs-toast-icon {
  color: var(--hs-danger);
}

.hs-toast--warning {
  background: var(--hs-warning-bg);
  border-color: #fde68a;
}
.hs-toast--warning .hs-toast-icon {
  color: var(--hs-warning);
}

.hs-toast--info {
  background: var(--hs-info-bg);
  border-color: #bfdbfe;
}
.hs-toast--info .hs-toast-icon {
  color: var(--hs-primary);
}

@keyframes hs-toast-in {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes hs-toast-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(30px);
  }
}

@media (max-width: 480px) {
  .hs-toast-container {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
}
</style>
