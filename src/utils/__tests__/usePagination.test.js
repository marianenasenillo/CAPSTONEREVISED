import { describe, it, expect } from 'vitest'

import { ref as vueRef } from 'vue'
import { usePagination } from '../../composables/usePagination'

function makeData(count) {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1 }))
}

describe('usePagination', () => {
  it('returns paginated data (default 10 per page)', () => {
    const source = vueRef(makeData(25))
    const { paginatedData, totalItems, totalPages, currentPage } = usePagination(source)
    expect(totalItems.value).toBe(25)
    expect(totalPages.value).toBe(3)
    expect(currentPage.value).toBe(1)
    expect(paginatedData.value).toHaveLength(10)
  })

  it('paginatedData returns correct slice for page 2', () => {
    const source = vueRef(makeData(25))
    const { paginatedData, goToPage } = usePagination(source)
    goToPage(2)
    expect(paginatedData.value).toHaveLength(10)
    expect(paginatedData.value[0].id).toBe(11)
  })

  it('paginatedData returns remaining items on last page', () => {
    const source = vueRef(makeData(25))
    const { paginatedData, goToPage } = usePagination(source)
    goToPage(3)
    expect(paginatedData.value).toHaveLength(5)
    expect(paginatedData.value[0].id).toBe(21)
  })

  it('goToPage clamps to valid range', () => {
    const source = vueRef(makeData(25))
    const { currentPage, goToPage } = usePagination(source)
    goToPage(0)
    expect(currentPage.value).toBe(1)
    goToPage(99)
    expect(currentPage.value).toBe(1) // didn't change because 99 > totalPages
  })

  it('nextPage and prevPage work', () => {
    const source = vueRef(makeData(25))
    const { currentPage, nextPage, prevPage } = usePagination(source)
    expect(currentPage.value).toBe(1)
    nextPage()
    expect(currentPage.value).toBe(2)
    nextPage()
    expect(currentPage.value).toBe(3)
    nextPage() // should not go beyond
    expect(currentPage.value).toBe(3)
    prevPage()
    expect(currentPage.value).toBe(2)
    prevPage()
    expect(currentPage.value).toBe(1)
    prevPage() // should not go below 1
    expect(currentPage.value).toBe(1)
  })

  it('firstPage and lastPage work', () => {
    const source = vueRef(makeData(25))
    const { currentPage, firstPage, lastPage, goToPage } = usePagination(source)
    goToPage(2)
    firstPage()
    expect(currentPage.value).toBe(1)
    lastPage()
    expect(currentPage.value).toBe(3)
  })

  it('resetPage resets to 1', () => {
    const source = vueRef(makeData(25))
    const { currentPage, goToPage, resetPage } = usePagination(source)
    goToPage(3)
    resetPage()
    expect(currentPage.value).toBe(1)
  })

  it('startIndex and endIndex are correct', () => {
    const source = vueRef(makeData(25))
    const { startIndex, endIndex, goToPage } = usePagination(source)
    expect(startIndex.value).toBe(1)
    expect(endIndex.value).toBe(10)
    goToPage(3)
    expect(startIndex.value).toBe(21)
    expect(endIndex.value).toBe(25)
  })

  it('returns startIndex 0 for empty data', () => {
    const source = vueRef([])
    const { startIndex, endIndex, totalPages } = usePagination(source)
    expect(startIndex.value).toBe(0)
    expect(endIndex.value).toBe(0)
    expect(totalPages.value).toBe(1)
  })

  it('visiblePages returns correct window', () => {
    const source = vueRef(makeData(100))
    const { visiblePages, goToPage } = usePagination(source)
    // 100 items / 10 per page = 10 total pages
    expect(visiblePages.value).toEqual([1, 2, 3, 4, 5])
    goToPage(5)
    expect(visiblePages.value).toEqual([3, 4, 5, 6, 7])
    goToPage(10)
    expect(visiblePages.value).toEqual([6, 7, 8, 9, 10])
  })

  it('itemsPerPageOptions is exposed', () => {
    const source = vueRef([])
    const { itemsPerPageOptions } = usePagination(source)
    expect(itemsPerPageOptions).toEqual([10, 25, 50, 100])
  })
})
