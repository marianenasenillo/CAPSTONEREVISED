<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'

const sexDisplay = (v) => v === 'M' ? 'Male' : v === 'F' ? 'Female' : (v || '—')
import { usePagination } from '@/composables/usePagination'
import { supabase } from '@/utils/supabase.js'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const toast = useToast()
const goBack = () => router.back()

const loading = ref(true)
const error = ref(null)
const dewormingRecords = ref([])
const searchQuery = ref('')
const selectedPurok = ref('')

onMounted(async () => {
  await fetchDewormingRecords()
})

const filteredRecords = computed(() => {
  let data = dewormingRecords.value
  const q = String(searchQuery.value || '').trim().toLowerCase()
  if (q) {
    data = data.filter(r =>
      String(r.surname).toLowerCase().includes(q) ||
      String(r.firstname).toLowerCase().includes(q)
    )
  }
  if (selectedPurok.value) {
    data = data.filter(r => r.purok === selectedPurok.value)
  }
  return data
})

const { currentPage, itemsPerPage, itemsPerPageOptions, totalItems, totalPages, paginatedData, startIndex, endIndex, visiblePages, goToPage, nextPage, prevPage, firstPage, lastPage, resetPage } = usePagination(filteredRecords)
watch([searchQuery, selectedPurok], () => resetPage())

const handleSearch = () => {
  const el = document.querySelector('.hs-table-scroll')
  if (el) el.scrollTop = 0
}

const fetchDewormingRecords = async () => {
  loading.value = true
  error.value = null
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Not authenticated')

    const userBarangay = user.user_metadata?.barangay
    if (!userBarangay) throw new Error('No barangay assigned')

    const { data, error: err } = await supabase
      .from('deworming_records')
      .select('*')
      .eq('is_archived', true)
      .order('created_at', { ascending: false })

    if (err) throw err
    dewormingRecords.value = data
  } catch (e) {
    console.error(e)
    error.value = 'Failed to load deworming records.'
  } finally {
    loading.value = false
  }
}

const deleteRecord = async (record) => {
  if (!confirm(`Are you sure you want to delete the deworming record for "${record.firstname} ${record.surname}"? This action cannot be undone.`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('deworming_records')
      .delete()
      .eq('id', record.id)

    if (error) throw error

    toast.success('Record deleted successfully.')
    await fetchDewormingRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    toast.error('Error deleting record.')
  }
}

const restoreRecord = async (record) => {
  if (!confirm(`Are you sure you want to restore the deworming record for "${record.firstname} ${record.surname}"?`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('deworming_records')
      .update({
        is_archived: false,
        archived_at: null
      })
      .eq('id', record.id)

    if (error) throw error

    toast.success('Record restored successfully.')
    await fetchDewormingRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    toast.error('Error restoring record.')
  }
}
</script>

<template>
    <div class="service-page">
      <div class="hs-page-header">
        <div class="hs-breadcrumb">
          <a href="#" @click.prevent="goBack">Records</a>
          <span class="separator">/</span>
          <span class="current">Archived</span>
        </div>
        <h1>Deworming (10–19 yrs old) - Archived</h1>
      </div>

      <div class="hs-toolbar">
        <div class="hs-toolbar-left">
          <button class="hs-btn hs-btn-secondary" @click="goBack"><span class="mdi mdi-arrow-left"></span> Back</button>
          <select v-model="selectedPurok" class="hs-select hs-w-auto">
            <option value="">All Puroks</option>
            <option value="Purok 1">Purok 1</option>
            <option value="Purok 2">Purok 2</option>
            <option value="Purok 3">Purok 3</option>
            <option value="Purok 4">Purok 4</option>
          </select>
        </div>
        <div class="hs-toolbar-right">
          <div class="hs-search-box">
              <span class="mdi mdi-magnify"></span>
              <input v-model="searchQuery" type="search" placeholder="Search..." />
            </div>
        </div>
      </div>

      <div v-if="loading" class="hs-empty-state"><div class="hs-spinner"></div><p>Loading...</p></div>
      <div v-else-if="error" class="hs-error-alert">{{ error }}</div>
      <div v-else class="hs-card hs-card--flush">
        <div class="hs-table-scroll">
          <table class="hs-table">
            <thead>
              <tr>
                <th>Purok</th>
                <th>Surname</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Name of Mother</th>
                <th>Sex</th>
                <th>Birthday</th>
                <th>Age</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in paginatedData" :key="record.id">
                <td>{{ record.purok }}</td>
                <td>{{ record.surname }}</td>
                <td>{{ record.firstname }}</td>
                <td>{{ record.middlename }}</td>
                <td>{{ record.mother_name }}</td>
                <td>{{ sexDisplay(record.sex) }}</td>
                <td>{{ record.birthday }}</td>
                <td>{{ record.age }}</td>
                <td>
                  <button class="hs-btn hs-btn-primary" @click="restoreRecord(record)"><span class="mdi mdi-restore"></span> Restore</button>
                  <button class="hs-btn hs-btn-danger" @click="deleteRecord(record)"><span class="mdi mdi-delete"></span> Delete</button>
                </td>
              </tr>
              <tr v-if="paginatedData.length === 0">
                <td colspan="9" class="hs-table-empty">No archived records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="hs-pagination">
          <div class="hs-pagination-info">
            <span>Show</span>
            <select v-model.number="itemsPerPage">
              <option v-for="opt in itemsPerPageOptions" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <span>entries &mdash; {{ startIndex }}-{{ endIndex }} of {{ totalItems }}</span>
          </div>
          <div class="hs-pagination-controls">
            <button @click="firstPage" :disabled="currentPage === 1"><span class="mdi mdi-chevron-double-left"></span></button>
            <button @click="prevPage" :disabled="currentPage === 1"><span class="mdi mdi-chevron-left"></span></button>
            <button v-for="p in visiblePages" :key="p" :class="{ active: p === currentPage }" @click="goToPage(p)">{{ p }}</button>
            <button @click="nextPage" :disabled="currentPage === totalPages"><span class="mdi mdi-chevron-right"></span></button>
            <button @click="lastPage" :disabled="currentPage === totalPages"><span class="mdi mdi-chevron-double-right"></span></button>
          </div>
        </div>
      </div>
    </div>
</template>

<style scoped>
.service-page { max-width: var(--hs-content-max-width); }
</style>
