<script setup>
import DashboardView from '@/components/DashboardView.vue'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'

const router = useRouter()
const goBack = () => router.back()

const loading = ref(true)
const error = ref(null)
const wraRecords = ref([])
const searchQuery = ref('')

onMounted(async () => {
  await fetchWraRecords()
})

const filteredRecords = computed(() => {
  const q = String(searchQuery.value || '').trim()
  if (!q) return wraRecords.value
  return wraRecords.value.filter(r =>
    String(r.lastname).toLowerCase().includes(q.toLowerCase()) ||
    String(r.firstname).toLowerCase().includes(q.toLowerCase())
  )
})

const handleSearch = () => {
  // computed `filteredRecords` will react to `searchQuery`; keep placeholder for possible analytics or focus behavior
  // we can also scroll table to top when searching
  const el = document.querySelector('.table-responsive.large-table')
  if (el) el.scrollTop = 0
}

const fetchWraRecords = async () => {
  loading.value = true
  error.value = null
  try {
    // Get current user
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

// Restore Record
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

    // Remove from local records
    wraRecords.value = wraRecords.value.filter(r => r.id !== record.id)
    alert('Record restored successfully!')
  } catch (error) {
    console.error('Error restoring record:', error)
    alert('Failed to restore record. Please try again.')
  }
}
</script>

<template>
  <DashboardView>
    <div class="maternal-bg">
      <div class="container">
        <div class="records-top d-flex align-items-center mb-2">
          <button class="btn btn-outline-secondary me-3" @click="goBack">← Back</button>
          <h3 class="mb-0">Archived Women of Reproductive Age Records</h3>
          <div class="ms-auto search-box">
            <div class="input-group">
              <input v-model="searchQuery" @keyup.enter="handleSearch" type="search" class="form-control search-input" placeholder="Search by Last Name or First Name..." aria-label="Search by Last Name or First Name">
              <button class="btn btn-primary search-btn" @click="handleSearch">Search</button>
              <button class="btn btn-outline-secondary ms-2" v-if="searchQuery" @click="searchQuery = ''">Clear</button>
            </div>
          </div>
        </div>

        <div v-if="loading" class="text-center my-4">
          <div class="spinner-border text-primary" role="status"></div>
          <p>Loading records...</p>
        </div>

        <div v-else-if="error" class="alert alert-danger">
          {{ error }}
        </div>

        <div v-else>
          <div class="table-wrapper">
            <div class="table-responsive large-table">
              <table class="table table-bordered table-striped mb-0">
                <thead class="table-light">
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
                  <tr v-for="record in filteredRecords" :key="record.id">
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
                      <button class="btn btn-success btn-sm" @click="restoreRecord(record)">Restore</button>
                    </td>
                  </tr>

                  <tr v-if="filteredRecords.length === 0">
                    <td colspan="20" class="text-center">No archived records found.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
.maternal-bg {
  background: url('/images/maternal.jpg') no-repeat center center;
  background-size: cover;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal { overflow-y: auto }

.records-top { align-items: center }
.search-box { max-width: 540px }
.search-input { border-radius: 28px 0 0 28px }
.search-btn { border-radius: 0 28px 28px 0 }
.table-wrapper { border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.95); }
/* Make the table-wrapper take the remaining vertical space and keep internal scrolling in the table only */
.table-wrapper { height: calc(100vh - 260px); display: flex; flex-direction: column; }
.table-responsive.large-table { flex: 1 1 auto; height: 100%; overflow: auto; }
.large-table table { font-size: 1.05rem; margin-bottom: 0 }
.large-table thead th { padding: 1rem; font-size: 1rem; position: sticky; top: 0; background: #fff; z-index: 5 }
.large-table tbody td { padding: 0.9rem }

@media (max-width: 768px) {
  .search-box { max-width: 100% }
  .large-table thead th { font-size: 0.95rem }
}
</style>