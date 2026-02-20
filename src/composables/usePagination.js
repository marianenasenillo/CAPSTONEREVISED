import { ref, computed, watch } from 'vue'

/**
 * Reusable pagination composable for table views.
 *
 * @param {import('vue').Ref<Array>} sourceData — reactive array of ALL records
 * @returns pagination state + paginatedData computed
 */
export function usePagination(sourceData) {
  const currentPage = ref(1)
  const itemsPerPage = ref(10)
  const itemsPerPageOptions = [10, 25, 50, 100]

  const totalItems = computed(() => sourceData.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / itemsPerPage.value)))

  watch([() => sourceData.value.length, itemsPerPage], () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value
    }
  })

  const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value
    return sourceData.value.slice(start, start + itemsPerPage.value)
  })

  const startIndex = computed(() => {
    if (totalItems.value === 0) return 0
    return (currentPage.value - 1) * itemsPerPage.value + 1
  })

  const endIndex = computed(() => {
    return Math.min(currentPage.value * itemsPerPage.value, totalItems.value)
  })

  const visiblePages = computed(() => {
    const total = totalPages.value
    const current = currentPage.value
    const pages = []
    let start = Math.max(1, current - 2)
    let end = Math.min(total, start + 4)
    start = Math.max(1, end - 4)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  })

  function goToPage(page) {
    if (page >= 1 && page <= totalPages.value) currentPage.value = page
  }
  function nextPage() { goToPage(currentPage.value + 1) }
  function prevPage() { goToPage(currentPage.value - 1) }
  function firstPage() { goToPage(1) }
  function lastPage() { goToPage(totalPages.value) }

  function resetPage() { currentPage.value = 1 }

  return {
    currentPage,
    itemsPerPage,
    itemsPerPageOptions,
    totalItems,
    totalPages,
    paginatedData,
    startIndex,
    endIndex,
    visiblePages,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    resetPage,
  }
}
