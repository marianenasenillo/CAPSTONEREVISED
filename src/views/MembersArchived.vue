<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { supabase } from '@/utils/supabase.js'

const sexDisplay = (v) => v === 'M' ? 'Male' : v === 'F' ? 'Female' : (v || '—')
const toast = useToast()
const router = useRouter()
const goBack = () => router.back()

const loading = ref(true)
const error = ref(null)
const memberRecords = ref([])
const searchQuery = ref('')
const selectedPurok = ref('')

onMounted(async () => {
  await fetchArchivedMembers()
})

const filteredRecords = computed(() => {
  let data = memberRecords.value
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

const fetchArchivedMembers = async () => {
  loading.value = true
  error.value = null
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Not authenticated')

    const userBarangay = user.user_metadata?.barangay
    if (!userBarangay) throw new Error('No barangay assigned')

    const { data, error: err } = await supabase
      .from('household_members')
      .select('*')
      .eq('barangay', userBarangay)
      .eq('is_archived', true)
      .order('archived_at', { ascending: false })

    if (err) throw err
    memberRecords.value = data
  } catch (e) {
    console.error(e)
    error.value = 'Failed to load archived members.'
  } finally {
    loading.value = false
  }
}

const restoreRecord = async (record) => {
  if (!confirm(`Restore member "${record.firstname} ${record.lastname}"?`)) return
  try {
    const { error } = await supabase
      .from('household_members')
      .update({ is_archived: false, archived_at: null })
      .eq('member_id', record.member_id)
    if (error) throw error
    toast.success('Member restored successfully.')
    await fetchArchivedMembers()
  } catch (e) {
    console.error(e)
    toast.error('Error restoring member.')
  }
}

const deleteRecord = async (record) => {
  if (!confirm(`Permanently delete member "${record.firstname} ${record.lastname}"? This action cannot be undone.`)) return
  try {
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('member_id', record.member_id)
    if (error) throw error
    toast.success('Member deleted permanently.')
    await fetchArchivedMembers()
  } catch (e) {
    console.error(e)
    toast.error('Error deleting member.')
  }
}
</script>

<template>
    <div class="service-page">
      <div class="hs-page-header">
        <div class="hs-breadcrumb">
          <a href="#" @click.prevent="goBack">Records</a>
          <span class="separator">/</span>
          <span class="current">Archived Members</span>
        </div>
        <h1>Household Members - Archived</h1>
        <p class="hs-module-desc">Manage archived household members. Restore or permanently delete records.</p>
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
                <th>Relationship</th>
                <th>Birthdate</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Civil Status</th>
                <th>Archived At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in paginatedData" :key="record.member_id">
                <td>{{ record.head_id }}</td>
                <td>{{ record.purok }}</td>
                <td>{{ record.lastname }}</td>
                <td>{{ record.firstname }}</td>
                <td>{{ record.middlename }}</td>
                <td>{{ record.suffix }}</td>
                <td>{{ record.relationship || '-' }}</td>
                <td>{{ record.birthdate || '-' }}</td>
                <td>{{ record.age ?? '-' }}</td>
                <td>{{ sexDisplay(record.sex) }}</td>
                <td>{{ record.civil_status || '-' }}</td>
                <td>{{ record.archived_at ? new Date(record.archived_at).toLocaleDateString() : '-' }}</td>
                <td>
                  <button class="hs-btn hs-btn-primary" @click="restoreRecord(record)"><span class="mdi mdi-restore"></span> Restore</button>
                  <button class="hs-btn hs-btn-danger" @click="deleteRecord(record)"><span class="mdi mdi-delete"></span> Delete</button>
                </td>
              </tr>
              <tr v-if="paginatedData.length === 0">
                <td colspan="13" class="hs-table-empty">No archived members found.</td>
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
