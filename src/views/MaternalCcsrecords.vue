<script setup>
import DashboardView from '@/components/DashboardView.vue'
import MaternalExport from '@/components/reports/MaternalExport.vue'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'

const router = useRouter()
const goBack = () => router.back()

const loading = ref(true)
const error = ref(null)
const cervicalRecords = ref([])
const searchQuery = ref('')

const userRole = ref('')
const selectedPurok = ref('')
const editRecord = ref(null)
const showEditModal = ref(false)

const showActionsDropdown = ref(null)

const toggleActions = (id) => {
  showActionsDropdown.value = showActionsDropdown.value === id ? null : id
}

const showReport = ref(false)
const reportRef = ref(null)

const openReport = () => {
  showReport.value = true
}
const closeReport = () => (showReport.value = false)

onMounted(async () => {
  await fetchCervicalRecords()
})

const filteredRecords = computed(() => {
  let records = cervicalRecords.value
  const q = String(searchQuery.value || '').trim()
  if (q) {
    records = records.filter(r =>
      String(r.lastname).toLowerCase().includes(q.toLowerCase()) ||
      String(r.firstname).toLowerCase().includes(q.toLowerCase())
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

const fetchCervicalRecords = async () => {
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
      .from('cervical_screening_records')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (err) throw err
    cervicalRecords.value = data
  } catch (e) {
    console.error(e)
    error.value = 'Failed to load cervical screening records.'
  } finally {
    loading.value = false
  }
}

// Delete Record
const deleteRecord = async (record) => {
  if (!confirm(`Are you sure you want to delete the cervical screening record for "${record.firstname} ${record.lastname}"? This action cannot be undone.`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('cervical_screening_records')
      .delete()
      .eq('id', record.id)

    if (error) throw error

    alert('Record deleted successfully.')
    await fetchCervicalRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    alert('Error deleting record.')
  }
}

// Edit Record
const editRecordFunc = (record) => {
  editRecord.value = { ...record }
  showEditModal.value = true
}

const saveEdit = async () => {
  try {
    const { error } = await supabase
      .from('cervical_screening_records')
      .update({
        purok: editRecord.value.purok,
        lastname: editRecord.value.lastname,
        firstname: editRecord.value.firstname,
        middlename: editRecord.value.middlename,
        suffix: editRecord.value.suffix,
        age: editRecord.value.age,
        birthdate: editRecord.value.birthdate,
        screened: editRecord.value.screened
      })
      .eq('id', editRecord.value.id)

    if (error) throw error

    alert('Record updated successfully.')
    showEditModal.value = false
    await fetchCervicalRecords()
  } catch (e) {
    console.error(e)
    alert('Error updating record.')
  }
}

// Archive Record
const archiveRecord = async (record) => {
  if (!confirm(`Are you sure you want to archive the cervical screening record for "${record.firstname} ${record.lastname}"?`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('cervical_screening_records')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString()
      })
      .eq('id', record.id)

    if (error) throw error

    alert('Record archived successfully.')
    await fetchCervicalRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    alert('Error archiving record.')
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

    // wait a moment so charts / dynamic content can finish rendering
    await new Promise(resolve => setTimeout(resolve, 300))

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

    pdf.save('maternal_report.pdf')
  } catch (err) {
    console.error('Error generating PDF:', err)
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
    <div class="maternal-bg">
      <div class="container">
        <div class="records-top d-flex align-items-center mb-2">
          <button class="btn btn-outline-secondary me-3" style="background-color: #5b841e; color: white; border-color: #5b841e;" @click="goBack">← Back</button>
          <h3 class="mb-0">Cervical Cancer Screening Records</h3>
          <div class="ms-auto search-box">
            <div class="input-group">
              <button class="btn btn-primary export-btn" @click="exportPdf">Export</button>
              <input v-model="searchQuery" @keyup.enter="handleSearch" type="search" class="form-control search-input" placeholder="Search by Last Name or First Name..." aria-label="Search by Last Name or First Name">
              <button class="btn btn-primary search-btn" @click="handleSearch">Search</button>
              <button class="btn btn-outline-secondary ms-2" v-if="searchQuery" @click="searchQuery = ''">Clear</button>
              <button v-if="userRole === 'Admin'" class="btn btn-warning report-btn" @click="router.push('/maternalarchived')">Archived</button>
              <button v-if="userRole === 'Admin'" class="btn btn-primary report-btn" @click="openReport">Report</button>
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
                    <th>Age</th>
                    <th>Birthdate</th>
                    <th>Screened</th>
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
                    <td>{{ record.screened }}</td>
                    <td>
                      <v-menu :model-value="showActionsDropdown === record.id" @update:model-value="val => val ? showActionsDropdown = record.id : showActionsDropdown = null" offset-y>
                        <template #activator="{ props }">
                          <v-btn icon v-bind="props" size="small">
                            <v-icon>mdi-dots-vertical</v-icon>
                          </v-btn>
                        </template>
                        <v-list>
                          <v-list-item v-if="userRole === 'BHW'" @click="editRecordFunc(record)">Edit</v-list-item>
                          <v-list-item v-if="userRole === 'Admin'" @click="deleteRecord(record)">Delete</v-list-item>
                          <v-list-item v-if="userRole === 'Admin'" @click="archiveRecord(record)">Archive</v-list-item>
                        </v-list>
                      </v-menu>
                    </td>
                  </tr>

                  <tr v-if="filteredRecords.length === 0">
                    <td colspan="9" class="text-center">No records found.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Modal for Editing Record -->
        <div class="modal fade show d-block" tabindex="-1" v-if="showEditModal" style="background: rgba(0,0,0,0.6)">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Edit Cervical Screening Record: {{ editRecord.firstname }} {{ editRecord.lastname }}</h5>
                <button type="button" class="btn-close" @click="showEditModal = false"></button>
              </div>
              <div class="modal-body">
                <form @submit.prevent="saveEdit">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label>Purok</label>
                      <select v-model="editRecord.purok" class="form-control" required>
                        <option value="Purok 1">Purok 1</option>
                        <option value="Purok 2">Purok 2</option>
                        <option value="Purok 3">Purok 3</option>
                        <option value="Purok 5">Purok 5</option>
                      </select>
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Last Name</label>
                      <input v-model="editRecord.lastname" type="text" class="form-control" required>
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>First Name</label>
                      <input v-model="editRecord.firstname" type="text" class="form-control" required>
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Middle Name</label>
                      <input v-model="editRecord.middlename" type="text" class="form-control">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Suffix</label>
                      <input v-model="editRecord.suffix" type="text" class="form-control">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Age</label>
                      <input v-model.number="editRecord.age" type="number" class="form-control">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Birthdate</label>
                      <input v-model="editRecord.birthdate" type="date" class="form-control">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label>Screened</label>
                      <select v-model="editRecord.screened" class="form-control">
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
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

        <div v-if="showReport" class="records-overlay">
          <div class="records-box d-flex flex-column align-items-center">
            <button class="back-btn align-self-start" @click="closeReport">← back</button>
            <button class="export-small-btn" @click="exportreportPdf" title="Export PDF">⤓</button>
            <div ref="reportRef" class="report-container py-4 bg-white shadow rounded">
              <MaternalExport/>
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
.table-wrapper { height: calc(100vh - 260px); display: flex; flex-direction: column; }
.table-responsive.large-table { flex: 1 1 auto; height: 100%; overflow: auto }
.large-table table { font-size: 1.05rem; margin-bottom: 0 }
.large-table thead th { padding: 1rem; font-size: 1rem; position: sticky; top: 0; background: #fff; z-index: 5 }
.large-table tbody td { padding: 0.9rem }

@media (max-width: 768px) {
  .search-box { max-width: 100% }
  .large-table thead th { font-size: 0.95rem }
}

.records-overlay {
  position: fixed;
  top: 56px;
  left: 0;
  width: 100%;
  height: 90%;
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
  max-height: 80vh;
  overflow-y: auto;
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