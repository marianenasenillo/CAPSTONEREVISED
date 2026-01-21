<script setup>
import DashboardView from '@/components/DashboardView.vue'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'

const router = useRouter()
const goBack = () => router.back()

const loading = ref(true)
const error = ref(null)
const headRecords = ref([])
const searchQuery = ref('')

const selectedHead = ref(null)
const showMembersModal = ref(false)
const members = ref([])

onMounted(async () => {
  await fetchHeadRecords()
})

const filteredRecords = computed(() => {
  const q = String(searchQuery.value || '').trim()
  if (!q) return headRecords.value
  return headRecords.value.filter(r => String(r.head_id).toLowerCase().includes(q.toLowerCase()))
})

const handleSearch = () => {
  // computed `filteredRecords` will react to `searchQuery`; keep placeholder for possible analytics or focus behavior
  // we can also scroll table to top when searching
  const el = document.querySelector('.table-responsive.large-table')
  if (el) el.scrollTop = 0
}

const fetchHeadRecords = async () => {
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

// View Members
const viewMembers = async (head) => {
  selectedHead.value = head
  showMembersModal.value = true
  members.value = []
  try {
    // ✅ Adjust this based on your real column name
    const { data, error: err } = await supabase
      .from('household_members')
      .select('*')
      .eq('head_id', head.head_id) // if your PK is head_id instead of id

    if (err) throw err
    members.value = data
  } catch (e) {
    console.error(e)
    alert('Error loading household members.')
  }
}

// Delete Record
const deleteRecord = async (record) => {
  if (!confirm(`Are you sure you want to delete the household head "${record.firstname} ${record.lastname}" and all associated members? This action cannot be undone.`)) {
    return
  }

  try {
    // First delete all members
    const { error: membersError } = await supabase
      .from('household_members')
      .delete()
      .eq('head_id', record.head_id)

    if (membersError) throw membersError

    // Then delete the head
    const { error: headError } = await supabase
      .from('household_heads')
      .delete()
      .eq('head_id', record.head_id)

    if (headError) throw headError

    alert('Record and associated members deleted successfully.')
    await fetchHeadRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    alert('Error deleting record.')
  }
}

// Archive Record
const archiveRecord = async (record) => {
  if (!confirm(`Are you sure you want to archive the household head "${record.firstname} ${record.lastname}"?`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('household_heads')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString()
      })
      .eq('head_id', record.head_id)

    if (error) throw error

    alert('Record archived successfully.')
    await fetchHeadRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    alert('Error archiving record.')
  }
}

// Restore Record
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

    alert('Record restored successfully.')
    await fetchHeadRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    alert('Error restoring record.')
  }
}
</script>


<template>
  <DashboardView>
    <div class="hps-bg">
      <div class="container">
        <div class="records-top d-flex align-items-center mb-2">
          <button class="btn btn-outline-secondary me-3" @click="goBack">← Back</button>
          <h3 class="mb-0">Archived Household Head Profiling Records</h3>
          <div class="ms-auto search-box">
            <div class="input-group">
              <input v-model="searchQuery" @keyup.enter="handleSearch" type="search" class="form-control search-input" placeholder="Search by Head ID..." aria-label="Search by Head ID">
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
                  <tr v-for="record in filteredRecords" :key="record.head_id">
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
                      <button class="btn btn-success btn-sm" @click="restoreRecord(record)">Restore</button>
                    </td>
                  </tr>

                  <tr v-if="filteredRecords.length === 0">
                    <td colspan="11" class="text-center">No records found.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Modal for Members -->
        <div class="modal fade show d-block" tabindex="-1" v-if="showMembersModal" style="background: rgba(0,0,0,0.6)">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Members of: {{ selectedHead.firstname }} {{ selectedHead.lastname }}</h5>
                <button type="button" class="btn-close" @click="showMembersModal = false"></button>
              </div>
              <div class="modal-body">
                <div v-if="members.length === 0" class="text-center py-3">
                  <p>No members found for this head.</p>
                </div>

                <div v-else class="table-responsive">
                  <table class="table table-bordered mb-0">
                    <thead class="table-light">
                      <tr>
                        <th>Last Name</th>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>Relationship</th>
                        <th>Birthdate</th>
                        <th>Age</th>
                        <th>Sex</th>
                        <th>Civil Status</th>
                        <th>Education</th>
                        <th>Religion</th>
                        <th>Ethnicity</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="m in members" :key="m.id">
                        <td>{{ m.lastname }}</td>
                        <td>{{ m.firstname }}</td>
                        <td>{{ m.middlename }}</td>
                        <td>{{ m.relationship }}</td>
                        <td>{{ m.birthdate }}</td>
                        <td>{{ m.age }}</td>
                        <td>{{ m.sex }}</td>
                        <td>{{ m.civil_status }}</td>
                        <td>{{ m.education }}</td>
                        <td>{{ m.religion }}</td>
                        <td>{{ m.ethnicity }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" @click="showMembersModal = false">Close</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
.hps-bg {
  background: url('/images/householdprofiling.jpg') no-repeat center center;
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
