<script setup>
import DashboardView from '@/components/DashboardView.vue'
import Hhpsexport from '@/components/reports/Hhpsexport.vue'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
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
const userRole = ref('')
const selectedPurok = ref('')
const editHead = ref(null)
const showEditModal = ref(false)

const showReport = ref(false)
const reportRef = ref(null)

const openReport = () => {
  showReport.value = true
}
const closeReport = () => (showReport.value = false)

const showActionsDropdown = ref(null)

const toggleActions = (id) => {
  showActionsDropdown.value = showActionsDropdown.value === id ? null : id
}

onMounted(async () => {
  await fetchHeadRecords()
})

const filteredRecords = computed(() => {
  let records = headRecords.value
  const q = String(searchQuery.value || '').trim()
  if (q) {
    records = records.filter(r => 
      String(r.head_id).toLowerCase().includes(q.toLowerCase()) ||
      String(r.lastname).toLowerCase().includes(q.toLowerCase())
    )
  }
  if (selectedPurok.value) {
    records = records.filter(r => r.purok === selectedPurok.value)
  }
  return records
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
    const userRoleValue = user.user_metadata?.role || 'BHW' // Default to BHW if no role specified
    userRole.value = userRoleValue

    if (!userBarangay) throw new Error('No barangay assigned')

    const { data, error: err } = await supabase
      .from('household_heads')
      .select('*')
      .eq('barangay', userBarangay)
      .eq('is_archived', false)
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

// Edit Record
const editRecord = (record) => {
  editHead.value = { ...record }
  showEditModal.value = true
}

const saveEdit = async () => {
  try {
    const { error } = await supabase
      .from('household_heads')
      .update({
        purok: editHead.value.purok,
        lastname: editHead.value.lastname,
        firstname: editHead.value.firstname,
        middlename: editHead.value.middlename,
        suffix: editHead.value.suffix,
        no_of_families: editHead.value.no_of_families,
        population: editHead.value.population,
        female_count: editHead.value.female_count,
        male_count: editHead.value.male_count
      })
      .eq('head_id', editHead.value.head_id)

    if (error) throw error

    alert('Record updated successfully.')
    showEditModal.value = false
    await fetchHeadRecords()
  } catch (e) {
    console.error(e)
    alert('Error updating record.')
  }
}

// Export PDF function
const exportPdf = async () => {
  const element = document.querySelector('.large-table')
  if (!element) {
    alert('Table not found.')
    return
  }

  try {
    // Temporarily expand the container to show all content
    const wrapper = element.closest('.table-wrapper')
    let originalHeight = ''
    let originalOverflow = ''
    if (wrapper) {
      originalHeight = wrapper.style.height
      originalOverflow = wrapper.style.overflow
      wrapper.style.height = 'auto'
      wrapper.style.overflow = 'visible'
    }

    const table = element.querySelector('table')
    let originalTableHeight = ''
    if (table) {
      originalTableHeight = table.style.height
      table.style.height = 'auto'
    }

    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff'
    })

    // Restore styles
    if (wrapper) {
      wrapper.style.height = originalHeight
      wrapper.style.overflow = originalOverflow
    }
    if (table) {
      table.style.height = originalTableHeight
    }

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4') // A4 size

    const imgWidth = 210 // A4 width in mm
    const pageHeight = 295 // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    pdf.save('household_report.pdf')
  } catch (error) {
    console.error('Error generating PDF:', error)
    alert('Error generating PDF. Please try again.')
  }
}
const exportreportPdf = async () => {
  if (!reportRef.value) return
  const element = reportRef.value

  // temporarily remove max-height/overflow so entire content is captured
  const originalOverflow = element.style.overflow
  const originalMaxHeight = element.style.maxHeight
  element.style.overflow = 'visible'
  element.style.maxHeight = 'none'

  // Temporarily reduce logo sizes for PDF export
  const logos = element.querySelectorAll('img[alt="Province Logo"], img[alt="Barangay Logo"]')
  const originalSizes = []
  const originalMargins = []
  logos.forEach(img => {
    originalSizes.push(img.style.height)
    img.style.height = '80px'
    if (img.alt === 'Province Logo') {
      originalMargins.push(img.style.right)
      img.style.position = 'relative'
      img.style.right = '-130px'
    }
  })

  // Render element to canvas at higher scale for better quality
  const canvas = await html2canvas(element, { scale: 2, useCORS: true })
  const imgData = canvas.toDataURL('image/png')

  // Restore logo sizes
  logos.forEach((img, index) => {
    img.style.height = originalSizes[index]
    if (img.alt === 'Province Logo') {
      img.style.right = originalMargins[index] || ''
      img.style.position = ''
    }
  })

  // A4 size in mm
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // Convert canvas pixel size to mm for jsPDF
  const pxPerMm = canvas.width / (pageWidth * (window.devicePixelRatio || 1))
  const imgWidthMm = pageWidth
  const imgHeightMm = (canvas.height / pxPerMm) / (window.devicePixelRatio || 1)

  let remainingHeight = imgHeightMm
  let position = 0

  // Add image slices per page
  while (remainingHeight > 0) {
    pdf.addImage(imgData, 'PNG', 0, position, imgWidthMm, imgHeightMm)
    remainingHeight -= pageHeight
    if (remainingHeight > 0) pdf.addPage()
    // next page position: shift the image up by pageHeight (negative)
    position -= pageHeight
  }

  pdf.save('report.pdf')

  // restore styles
  element.style.overflow = originalOverflow
  element.style.maxHeight = originalMaxHeight
}
</script>


<template>
  <DashboardView>
    <div class="hps-bg">
      <div class="container">
        <div class="records-top d-flex align-items-center mb-2">
          <button class="btn btn-outline-secondary me-3" style="background-color: #5b841e; color: white; border-color: #5b841e;" @click="goBack">← Back</button>
          <h3 class="mb-0">Household Head Profiling Records</h3>
          <div class="ms-auto search-box">
            <div class="input-group">
              <button class="btn btn-primary export-btn" @click="exportPdf">Export</button>
              <input v-model="searchQuery" @keyup.enter="handleSearch" type="search" class="form-control search-input" placeholder="Search by Head ID or Last Name..." aria-label="Search by Head ID or Last Name">
              <button class="btn btn-primary search-btn" @click="handleSearch">Search</button>
              <button class="btn btn-outline-secondary ms-2" v-if="searchQuery" @click="searchQuery = ''">Clear</button>
              <button v-if="userRole === 'Admin'" class="btn btn-warning report-btn" @click="router.push('/hhpsarchived')">Archived</button>
              <button v-if="userRole === 'Admin'" class="btn view-btn btn-primary report-btn" @click="openReport" >Report</button>
            </div>
            <div v-if="showReport" class="records-overlay">
        <div class="records-box d-flex flex-column align-items-center">
          <!-- back button (left) and a compact export button (top-right) positioned absolutely so they don't affect layout -->
          <button class="back-btn align-self-start" @click="closeReport">← back</button>
          <button class="export-small-btn" @click="exportreportPdf" title="Export PDF">⤓</button>
          <div ref="reportRef" class="report-container py-4 bg-white shadow rounded">
            <Hhpsexport/>
            
          </div>
        </div>
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
                    <th><select v-model="selectedPurok" class="form-select me-2" style="max-width: 150px;">
                <option value="">Purok</option>
                <option value="Purok 1">Purok 1</option>
                <option value="Purok 2">Purok 2</option>
                <option value="Purok 3">Purok 3</option>
                <option value="Purok 4">Purok 4</option>
              </select></th>
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
                      <v-menu :model-value="showActionsDropdown === record.head_id" @update:model-value="val => val ? showActionsDropdown = record.head_id : showActionsDropdown = null" offset-y>
                        <template #activator="{ props }">
                          <v-btn icon v-bind="props" size="small">
                            <v-icon>mdi-dots-vertical</v-icon>
                          </v-btn>
                        </template>
                        <v-list>
                          <v-list-item @click="viewMembers(record)">View Members</v-list-item>
                          <v-list-item v-if="userRole === 'BHW'" @click="editRecord(record)">Edit</v-list-item>
                          <v-list-item v-if="userRole === 'Admin'" @click="deleteRecord(record)">Delete</v-list-item>
                          <v-list-item v-if="userRole === 'Admin'" @click="archiveRecord(record)">Archive</v-list-item>
                        </v-list>
                      </v-menu>
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
          <div class="modal-dialog modal-xl" style="max-width: 95vw; top: 100px;">
            <div class="modal-content" style="max-width: 95vw;">
              <div class="modal-header">
                <h5 class="modal-title">Members of: {{ selectedHead.firstname }} {{ selectedHead.lastname }}</h5>
                <button type="button" class="btn-close" @click="showMembersModal = false"></button>
              </div>
              <div class="modal-body">
                <div v-if="members.length === 0" class="text-center py-3">
                  <p>No members found for this head.</p>
                </div>

                <div v-else class="table-responsive">
                  <table class="table table-bordered table-sm mb-0">
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
                        <th>PhilHealth ID</th>
                        <th>4PS Member</th>
                        <th>FP Method</th>
                        <th>Medical History</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="m in members" :key="m.member_id">
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
                        <td>{{ m.philhealth_id || '-' }}</td>
                        <td>{{ m.is_4ps_member ? 'Yes' : 'No' }}</td>
                        <td>{{ m.fp_method_used || '-' }}</td>
                        <td>{{ m.medical_history || '-' }}</td>
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

        <!-- Modal for Editing Head -->
        <div class="modal fade show d-block" tabindex="-1" v-if="showEditModal" style="background: rgba(0,0,0,0.6)">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Edit Household Head: {{ editHead.firstname }} {{ editHead.lastname }}</h5>
                <button type="button" class="btn-close" @click="showEditModal = false"></button>
              </div>
              <div class="modal-body">
                <form @submit.prevent="saveEdit">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label>Purok</label>
                      <select v-model="editHead.purok" class="form-control" required>
                        <option value="Purok 1">Purok 1</option>
                        <option value="Purok 2">Purok 2</option>
                        <option value="Purok 3">Purok 3</option>
                        <option value="Purok 5">Purok 5</option>
                      </select>
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Last Name</label>
                      <input v-model="editHead.lastname" type="text" class="form-control" required>
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>First Name</label>
                      <input v-model="editHead.firstname" type="text" class="form-control" required>
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Middle Name</label>
                      <input v-model="editHead.middlename" type="text" class="form-control">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Suffix</label>
                      <input v-model="editHead.suffix" type="text" class="form-control">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>No. of Families</label>
                      <input v-model.number="editHead.no_of_families" type="number" class="form-control">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Population</label>
                      <input v-model.number="editHead.population" type="number" class="form-control">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Female Count</label>
                      <input v-model.number="editHead.female_count" type="number" class="form-control">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Male Count</label>
                      <input v-model.number="editHead.male_count" type="number" class="form-control">
                    </div>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="showEditModal = false">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                  </div>
                </form>
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

.records-overlay {
  position: fixed;
  top: 20px;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 2rem;
}
.records-box {
  background: rgba(162, 163, 160, 0.65);
  padding: 3rem 4rem;
  border-radius: 1rem;
  max-width: 1300px;
  width: 100%;
  height: 600px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}
.back-btn {
  position: absolute;
  top: 100px;
  left: -50px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ccc;
  border-radius: 6px;
  font-weight: bold;
  color: #000;
  font-size: 1.35rem;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: transform 0.2s;
  z-index: 2001;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.back-btn:hover {
  transform: scale(1.1);
}
.report-container {
  max-width: 1100px;
  padding-left: 3rem;
  padding-right: 3rem;
  max-height: 80vh;      /* NEW: limit height */
  overflow-y: auto;      /* NEW: enable vertical scroll */
}

.export-small-btn {
  position: absolute;
  top: 100px;
  right: 12px;
  background-color: rgba(43, 122, 11, 0.95);
  color: #fff;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  font-size: 1rem;
  line-height: 1;
  min-width: 48px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 2001;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.export-small-btn:hover { background-color: #236008 }

/* Prevent breaking inside important blocks when printing */
.no-break, .report-container * {
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}



@media print {
  .records-overlay { background: #fff !important; }
  .records-box { box-shadow: none !important; background: #fff !important; }
  .report-container { max-height: none !important; overflow: visible !important; }
  .back-btn, .export-btn { display: none !important; }
}
</style>