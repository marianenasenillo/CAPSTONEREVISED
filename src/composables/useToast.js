import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

export function useToast() {
  function addToast({ message, type = 'info', duration = 4000, icon = '' }) {
    const id = ++toastId
    const iconMap = {
      success: 'mdi-check-circle-outline',
      error: 'mdi-alert-circle-outline',
      warning: 'mdi-alert-outline',
      info: 'mdi-information-outline',
    }
    toasts.value.push({
      id,
      message,
      type,
      icon: icon || iconMap[type] || iconMap.info,
      removing: false,
    })
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    return id
  }

  function removeToast(id) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      toasts.value[idx].removing = true
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id)
      }, 280)
    }
  }

  function success(message, duration) {
    return addToast({ message, type: 'success', duration })
  }

  function error(message, duration) {
    return addToast({ message, type: 'error', duration: duration || 5000 })
  }

  function warning(message, duration) {
    return addToast({ message, type: 'warning', duration })
  }

  function info(message, duration) {
    return addToast({ message, type: 'info', duration })
  }

  return { toasts, addToast, removeToast, success, error, warning, info }
}
