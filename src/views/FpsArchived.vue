<script setup>
import DashboardView from '@/components/DashboardView.vue'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'

const router = useRouter()
const goBack = () => router.back()

const loading = ref(true)
const error = ref(null)
const familyPlanningRecords = ref([])
const searchQuery = ref('')

onMounted(async () => {
  await fetchFamilyPlanningRecords()
})

const filteredRecords = computed(() => {
  const q = String(searchQuery.value || '').trim()
  if (!q) return familyPlanningRecords.value
  return familyPlanningRecords.value.filter(r =>
    String(r.surname).toLowerCase().includes(q.toLowerCase()) ||
    String(r.firstname).toLowerCase().includes(q.toLowerCase())
  )
})

const handleSearch = () => {
  // computed `filteredRecords` will react to `searchQuery`; keep placeholder for possible analytics or focus behavior
  // we can also scroll table to top when searching
  const el = document.querySelector('.table-responsive.large-table')
  if (el) el.scrollTop = 0
}

const fetchFamilyPlanningRecords = async () => {
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
      .from('family_planning_records')
      .select('*')
      .eq('is_archived', true)
      .order('created_at', { ascending: false })

    if (err) throw err
    familyPlanningRecords.value = data
  } catch (e) {
    console.error(e)
    error.value = 'Failed to load family planning records.'
  } finally {
    loading.value = false
  }
}

// Delete Record
const deleteRecord = async (record) => {
  if (!confirm(`Are you sure you want to delete the family planning record for "${record.firstname} ${record.surname}"? This action cannot be undone.`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('family_planning_records')
      .delete()
      .eq('id', record.id)

    if (error) throw error

    alert('Record deleted successfully.')
    await fetchFamilyPlanningRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    alert('Error deleting record.')
  }
}

// Restore Record
const restoreRecord = async (record) => {
  if (!confirm(`Are you sure you want to restore the family planning record for "${record.firstname} ${record.surname}"?`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('family_planning_records')
      .update({
        is_archived: false,
        archived_at: null
      })
      .eq('id', record.id)

    if (error) throw error

    alert('Record restored successfully.')
    await fetchFamilyPlanningRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    alert('Error restoring record.')
  }
}
</script>

<template>
  <DashboardView>
    <div class="family-bg">
      <div class="container">
        <div class="records-top d-flex align-items-center mb-2">
          <button class="btn btn-outline-secondary me-3" @click="goBack">← Back</button>
          <h3 class="mb-0">Archived Responsible Parenthood and Planning Records</h3>
          <div class="ms-auto search-box">
            <div class="input-group">
              <input v-model="searchQuery" @keyup.enter="handleSearch" type="search" class="form-control search-input" placeholder="Search by Surname or First Name..." aria-label="Search by Surname or First Name">
              <button class="btn btn-primary search-btn" @click="handleSearch">Search</button>
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
                    <th>Surname</th>
                    <th>First Name</th>
                    <th>Name of Mother</th>
                    <th>Sex</th>
                    <th>Birthday</th>
                    <th>Age in years</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="record in filteredRecords" :key="record.id">
                    <td>{{ record.purok }}</td>
                    <td>{{ record.surname }}</td>
                    <td>{{ record.firstname }}</td>
                    <td>{{ record.mother_name }}</td>
                    <td>{{ record.sex }}</td>
                    <td>{{ record.birthday }}</td>
                    <td>{{ record.age }}</td>
                    <td>
                      <button class="btn btn-success btn-sm" @click="restoreRecord(record)">Restore</button>
                    </td>
                  </tr>

                  <tr v-if="filteredRecords.length === 0">
                    <td colspan="8" class="text-center">No records found.</td>
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
.family-bg {
  background: url('/images/familyplanning-bg.jpg') no-repeat center center;
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
.modal {
  overflow-y: auto;
}

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