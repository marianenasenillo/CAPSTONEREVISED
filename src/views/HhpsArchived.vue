<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { supabase } from '@/utils/supabase.js'

const router = useRouter()
const toast = useToast()
const goBack = () => router.back()

const loading = ref(true)
const error = ref(null)
const headRecords = ref([])
const searchQuery = ref('')
const selectedPurok = ref('')

const selectedHead = ref(null)
const showMembersModal = ref(false)
const members = ref([])

onMounted(async () => {
  await fetchHeadRecords()
})

const filteredRecords = computed(() => {
  let data = headRecords.value
  const q = String(searchQuery.value || '').trim().toLowerCase()
  if (q) {
    data = data.filter(r =>
      String(r.lastname).toLowerCase().includes(q) ||
      String(r.firstname).toLowerCase().includes(q) ||
      String(r.head_id).toLowerCase().includes(q)
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

const fetchHeadRecords = async () => {
  loading.value = true
  error.value = null
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Not authenticated')

    const userBarangay = user.user_metadata?.barangay
    if (!userBarangay) throw new Error('No barangay assigned')

    const { data, error: err } = await supabase
      .from('household_heads')
      .select('*')
      .eq('barangay', userBarangay)
      .eq('is_archived', true)
      .order('created_at', { ascending: false })

    if (err) throw err
    headRecords.value = data
  } catch (e) {
    console.error(e)
    error.value = 'Failed to load household head records.'
  } finally {
    loading.value = false
  }
}

const viewMembers = async (head) => {
  selectedHead.value = head
  showMembersModal.value = true
  members.value = []
  try {
    const { data, error: err } = await supabase
      .from('household_members')
      .select('*')
      .eq('head_id', head.head_id)

    if (err) throw err
    members.value = data
  } catch (e) {
    console.error(e)
    toast.error('Error loading household members.')
  }
}

const deleteRecord = async (record) => {
  if (!confirm(`Are you sure you want to delete the household head "${record.firstname} ${record.lastname}" and all associated members? This action cannot be undone.`)) {
    return
  }

  try {
    const { error: membersError } = await supabase
      .from('household_members')
      .delete()
      .eq('head_id', record.head_id)

    if (membersError) throw membersError

    const { error: headError } = await supabase
      .from('household_heads')
      .delete()
      .eq('head_id', record.head_id)

    if (headError) throw headError

    toast.success('Record and associated members deleted successfully.')
    await fetchHeadRecords()
  } catch (e) {
    console.error(e)
    toast.error('Error deleting record.')
  }
}

const restoreRecord = async (record) => {
  if (!confirm(`Are you sure you want to restore the household head "${record.firstname} ${record.lastname}"?`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('household_heads')
      .update({
        is_archived: false,
        archived_at: null
      })
      .eq('head_id', record.head_id)

    if (error) throw error

    toast.success('Record restored successfully.')
    await fetchHeadRecords()
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
        <h1>Household Head Profiling - Archived</h1>
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
                <th>Head ID</th>
                <th>Purok</th>
                <th>Last Name</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Suffix</th>
                <th>No. of Families</th>
                <th>Population</th>
                <th>Female</th>
                <th>Male</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in paginatedData" :key="record.head_id">
                <td>{{ record.head_id }}</td>
                <td>{{ record.purok }}</td>
                <td>{{ record.lastname }}</td>
                <td>{{ record.firstname }}</td>
                <td>{{ record.middlename }}</td>
                <td>{{ record.suffix }}</td>
                <td>{{ record.no_of_families }}</td>
                <td>{{ record.population }}</td>
                <td>{{ record.female_count }}</td>
                <td>{{ record.male_count }}</td>
                <td>
                  <button class="hs-btn hs-btn-primary" @click="restoreRecord(record)"><span class="mdi mdi-restore"></span> Restore</button>
                  <button class="hs-btn hs-btn-danger" @click="deleteRecord(record)"><span class="mdi mdi-delete"></span> Delete</button>
                </td>
              </tr>
              <tr v-if="paginatedData.length === 0">
                <td colspan="11" class="hs-table-empty">No archived records found.</td>
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
