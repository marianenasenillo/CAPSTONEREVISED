<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePagination } from '@/composables/usePagination'
import { supabase } from '@/utils/supabase.js'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const toast = useToast()
const goBack = () => router.back()

const loading = ref(true)
const error = ref(null)
const wraRecords = ref([])
const searchQuery = ref('')
const selectedPurok = ref('')

onMounted(async () => {
  await fetchWraRecords()
})

const filteredRecords = computed(() => {
  let data = wraRecords.value
  const q = String(searchQuery.value || '').trim().toLowerCase()
  if (q) {
    data = data.filter(r =>
      String(r.lastname).toLowerCase().includes(q) ||
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

const fetchWraRecords = async () => {
  loading.value = true
  error.value = null
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Not authenticated')

    const userBarangay = user.user_metadata?.barangay
    if (!userBarangay) throw new Error('No barangay assigned')

    const { data, error: err } = await supabase
      .from('wra_records')
      .select('*')
      .eq('is_archived', true)
      .order('archived_at', { ascending: false })

    if (err) throw err
    wraRecords.value = data.map(record => ({
      id: record.id,
      purok: record.purok,
      lastname: record.lastname,
      firstname: record.firstname,
      middlename: record.middlename,
      suffix: record.suffix,
      age: record.age,
      birthdate: record.birthdate,
      seStatus: record.se_status,
      civilStatus: record.civil_status,
      planoManganak: record.plano_manganak,
      karun: record.karun,
      spacing: record.spacing,
      limiting: record.limiting,
      fecund: record.fecund,
      infecund: record.infecund,
      fbMethod: record.fb_method,
      fbType: record.fb_type,
      fbDate: record.fb_date,
      changeMethod: record.change_method
    }))
  } catch (e) {
    console.error(e)
    error.value = 'Failed to load archived WRA records.'
  } finally {
    loading.value = false
  }
}

const restoreRecord = async (record) => {
  if (!confirm('Are you sure you want to restore this record?')) return

  try {
    const { error } = await supabase
      .from('wra_records')
      .update({
        is_archived: false,
        archived_at: null
      })
      .eq('id', record.id)

    if (error) throw error

    wraRecords.value = wraRecords.value.filter(r => r.id !== record.id)
    toast.success('Record restored successfully!')
  } catch (error) {
    console.error('Error restoring record:', error)
    toast.error('Failed to restore record. Please try again.')
  }
}

const deleteRecord = async (record) => {
  if (!confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) return

  try {
    const { error } = await supabase
      .from('wra_records')
      .delete()
      .eq('id', record.id)

    if (error) throw error

    wraRecords.value = wraRecords.value.filter(r => r.id !== record.id)
    toast.success('Record deleted permanently!')
  } catch (error) {
    console.error('Error deleting record:', error)
    toast.error('Failed to delete record. Please try again.')
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
        <h1>Women of Reproductive Age - Archived</h1>
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
                <th>Last Name</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Suffix</th>
                <th>Age</th>
                <th>Birthdate</th>
                <th>SE Status</th>
                <th>Civil Status</th>
                <th>Nag plano manganak</th>
                <th>Karun</th>
                <th>Spacing</th>
                <th>Limiting</th>
                <th>Fecund</th>
                <th>Infecund</th>
                <th>FB method used</th>
                <th>Type</th>
                <th>Date</th>
                <th>Gusto mo balhin ug Method</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in paginatedData" :key="record.id">
                <td>{{ record.purok }}</td>
                <td>{{ record.lastname }}</td>
                <td>{{ record.firstname }}</td>
                <td>{{ record.middlename }}</td>
                <td>{{ record.suffix }}</td>
                <td>{{ record.age }}</td>
                <td>{{ record.birthdate }}</td>
                <td>{{ record.seStatus }}</td>
                <td>{{ record.civilStatus }}</td>
                <td>{{ record.planoManganak }}</td>
                <td>{{ record.karun ? '✔' : '' }}</td>
                <td>{{ record.spacing ? '✔' : '' }}</td>
                <td>{{ record.limiting ? '✔' : '' }}</td>
                <td>{{ record.fecund ? '✔' : '' }}</td>
                <td>{{ record.infecund ? '✔' : '' }}</td>
                <td>{{ record.fbMethod }}</td>
                <td>{{ record.fbType }}</td>
                <td>{{ record.fbDate }}</td>
                <td>{{ record.changeMethod }}</td>
                <td>
                  <button class="hs-btn hs-btn-primary" @click="restoreRecord(record)"><span class="mdi mdi-restore"></span> Restore</button>
                  <button class="hs-btn hs-btn-danger" @click="deleteRecord(record)"><span class="mdi mdi-delete"></span> Delete</button>
                </td>
              </tr>
              <tr v-if="paginatedData.length === 0">
                <td colspan="20" class="hs-table-empty">No archived records found.</td>
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
