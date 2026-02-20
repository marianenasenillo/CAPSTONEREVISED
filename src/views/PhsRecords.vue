<script setup>
import DashboardView from '@/components/DashboardView.vue'
import PhsExport from '@/components/reports/PhsExport.vue'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'
import { usePagination } from '@/composables/usePagination'

const router = useRouter()
const goBack = () => router.back()

const loading = ref(true)
const error = ref(null)
const dewormingRecords = ref([])
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
  await fetchDewormingRecords()
})

const filteredRecords = computed(() => {
  let records = dewormingRecords.value
  const q = String(searchQuery.value || '').trim()
  if (q) {
    records = records.filter(r =>
      String(r.firstname).toLowerCase().includes(q.toLowerCase()) ||
      String(r.lastname).toLowerCase().includes(q.toLowerCase())
    )
  }
  if (selectedPurok.value) {
    records = records.filter(r => r.purok === selectedPurok.value)
  }
  return records
})

const { currentPage, itemsPerPage, itemsPerPageOptions, totalItems, totalPages, paginatedData, startIndex, endIndex, visiblePages, goToPage, nextPage, prevPage, firstPage, lastPage, resetPage } = usePagination(filteredRecords)

watch([searchQuery, selectedPurok], () => resetPage())

const sexDisplay = (sex) => sex === 'F' ? 'Female' : sex === 'M' ? 'Male' : sex

const handleSearch = () => {
  const el = document.querySelector('.table-responsive.large-table')
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
    const userRoleValue = user.user_metadata?.role || 'BHW' // Default to BHW if no role specified
    userRole.value = userRoleValue

    if (!userBarangay) throw new Error('No barangay assigned')

    const { data, error: err } = await supabase
      .from('deworming_records')
      .select('*')
      .eq('is_archived', false)
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
  if (!confirm(`Are you sure you want to delete the deworming record for "${record.firstname} ${record.lastname}"? This action cannot be undone.`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('deworming_records')
      .delete()
      .eq('id', record.id)

    if (error) throw error

    alert('Record deleted successfully.')
    await fetchDewormingRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    alert('Error deleting record.')
  }
}

const editRecordFunc = (record) => {
  editRecord.value = { ...record }
  showEditModal.value = true
}

const saveEdit = async () => {
  try {
    const { error } = await supabase
      .from('deworming_records')
      .update({
        lastname: editRecord.value.lastname,
        firstname: editRecord.value.firstname,
        middlename: editRecord.value.middlename,
        mother_name: editRecord.value.mother_name,
        sex: editRecord.value.sex,
        birthday: editRecord.value.birthday,
        age: editRecord.value.age,
        purok: editRecord.value.purok
      })
      .eq('id', editRecord.value.id)

    if (error) throw error

    alert('Record updated successfully.')
    showEditModal.value = false
    await fetchDewormingRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    alert('Error updating record.')
  }
}

const archiveRecord = async (record) => {
  if (!confirm(`Are you sure you want to archive the deworming record for "${record.firstname} ${record.lastname}"?`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('deworming_records')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString()
      })
      .eq('id', record.id)

    if (error) throw error

    alert('Record archived successfully.')
    await fetchDewormingRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    alert('Error archiving record.')
  }
}

// Export PDF: capture the visible table and exclude the Actions column
const exportPdf = async () => {
  const containerEl = document.querySelector('.large-table')
  if (!containerEl) {
    alert('Table not found.')
    return
  }

  const wrapper = containerEl.closest('.table-wrapper')
  // temporarily expand wrapper so full table is rendered
  const originalWrapperHeight = wrapper ? wrapper.style.height : ''
  const originalWrapperOverflow = wrapper ? wrapper.style.overflow : ''
  if (wrapper) {
    wrapper.style.height = 'auto'
    wrapper.style.overflow = 'visible'
  }

  const table = containerEl.querySelector('table')
  if (!table) {
    if (wrapper) {
      wrapper.style.height = originalWrapperHeight
      wrapper.style.overflow = originalWrapperOverflow
    }
    alert('Table element not found for export.')
    return
  }

  // find Actions column index and hide it during export
  const headers = Array.from(table.querySelectorAll('thead th'))
  let actionsIndex = -1
  headers.forEach((th, idx) => {
    if (th.textContent && th.textContent.trim().toLowerCase() === 'actions') actionsIndex = idx
  })

  const hiddenElements = []
  if (actionsIndex >= 0) {
    const th = headers[actionsIndex]
    hiddenElements.push({ el: th, display: th.style.display })
    th.style.display = 'none'

    const rows = Array.from(table.querySelectorAll('tbody tr'))
    rows.forEach(row => {
      const cells = row.querySelectorAll('td')
      if (cells[actionsIndex]) {
        hiddenElements.push({ el: cells[actionsIndex], display: cells[actionsIndex].style.display })
        cells[actionsIndex].style.display = 'none'
      }
    })
  }

  try {
    await new Promise(r => setTimeout(r, 200))

    const canvas = await html2canvas(containerEl, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgWidth = 210
    const pageHeight = 295
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

    pdf.save('deworming-report.pdf')
  } catch (err) {
    console.error('Error generating PDF:', err)
    alert('Error generating PDF. Please try again.')
  } finally {
    hiddenElements.forEach(({ el, display }) => { el.style.display = display || '' })
    if (wrapper) {
      wrapper.style.height = originalWrapperHeight
      wrapper.style.overflow = originalWrapperOverflow
    }
  }
}
const exportreportPdf = async () => {
  if (!reportRef.value) return
  const element = reportRef.value

  const originalOverflow = element.style.overflow
  const originalMaxHeight = element.style.maxHeight
  element.style.overflow = 'visible'
  element.style.maxHeight = 'none'

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

  const canvas = await html2canvas(element, { scale: 2, useCORS: true })
  const imgData = canvas.toDataURL('image/png')

  logos.forEach((img, index) => {
    img.style.height = originalSizes[index]
    if (img.alt === 'Province Logo') {
      img.style.right = originalMargins[index] || ''
      img.style.position = ''
    }
  })

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const pxPerMm = canvas.width / (pageWidth * (window.devicePixelRatio || 1))
  const imgWidthMm = pageWidth
  const imgHeightMm = (canvas.height / pxPerMm) / (window.devicePixelRatio || 1)

  let remainingHeight = imgHeightMm
  let position = 0

  while (remainingHeight > 0) {
    pdf.addImage(imgData, 'PNG', 0, position, imgWidthMm, imgHeightMm)
    remainingHeight -= pageHeight
    if (remainingHeight > 0) pdf.addPage()
    position -= pageHeight
  }

  pdf.save('report.pdf')

  element.style.overflow = originalOverflow
  element.style.maxHeight = originalMaxHeight
}
</script>

<template>
  <DashboardView>
    <div class="service-page">
      <div class="hs-page-header">
        <div class="hs-breadcrumb">Dashboard / Preventive Health / Records</div>
        <h1>Deworming Records (10-19 yrs old)</h1>
      </div>

      <div class="hs-toolbar">
        <div class="hs-toolbar-left">
          <button class="hs-btn hs-btn-secondary" @click="goBack"><span class="mdi mdi-arrow-left"></span> Back</button>
          <select v-model="selectedPurok" class="hs-select" style="width:auto;">
            <option value="">Purok</option>
            <option value="Purok 1">Purok 1</option>
            <option value="Purok 2">Purok 2</option>
            <option value="Purok 3">Purok 3</option>
            <option value="Purok 4">Purok 4</option>
            <option value="Purok 5">Purok 5</option>
          </select>
        </div>
        <div class="hs-toolbar-right">
          <div class="hs-search-box">
              <span class="mdi mdi-magnify"></span>
              <input v-model="searchQuery" type="search" placeholder="Search..." />
            </div>
          <button class="hs-btn hs-btn-primary" @click="exportPdf"><span class="mdi mdi-file-export-outline"></span> Export</button>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-warning" @click="router.push('/phsarchived')"><span class="mdi mdi-archive-outline"></span> Archived</button>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-secondary" @click="openReport"><span class="mdi mdi-chart-bar"></span> Report</button>
        </div>
      </div>

      <div v-if="loading" class="hs-empty-state"><div class="hs-spinner"></div><p>Loading records...</p></div>
      <div v-else-if="error" class="hs-card" style="border-left:4px solid var(--hs-danger);padding:16px;color:var(--hs-danger);">{{ error }}</div>
      <div v-else class="hs-card" style="padding:0;overflow:hidden;">
        <div style="overflow-x:auto;max-height:calc(100vh - 320px);">
          <table class="hs-table">
            <thead>
              <tr>
                <th>Purok</th>
                <th>Lastname</th>
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
                <td>{{ record.lastname }}</td>
                <td>{{ record.firstname }}</td>
                <td>{{ record.middlename }}</td>
                <td>{{ record.mother_name }}</td>
                <td>{{ sexDisplay(record.sex) }}</td>
                <td>{{ record.birthday }}</td>
                <td>{{ record.age }}</td>
                <td>
                  <v-menu :model-value="showActionsDropdown === record.id" @update:model-value="val => val ? showActionsDropdown = record.id : showActionsDropdown = null" offset-y>
                    <template #activator="{ props }"><v-btn icon v-bind="props" size="small"><v-icon>mdi-dots-vertical</v-icon></v-btn></template>
                    <v-list>
                      <v-list-item v-if="userRole === 'BHW'" @click="editRecordFunc(record)">Edit</v-list-item>
                      <v-list-item v-if="userRole === 'Admin'" @click="deleteRecord(record)">Delete</v-list-item>
                      <v-list-item v-if="userRole === 'Admin'" @click="archiveRecord(record)">Archive</v-list-item>
                    </v-list>
                  </v-menu>
                </td>
              </tr>
              <tr v-if="filteredRecords.length === 0"><td colspan="9" style="text-align:center;padding:32px;color:var(--hs-gray-400);">No records found.</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
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

      <!-- Edit Modal -->
      <div v-if="showEditModal" class="hs-modal-overlay" @click.self="showEditModal = false">
        <div class="hs-modal hs-modal-lg">
          <div class="hs-modal-header">
            <h3>Edit Deworming Record: {{ editRecord.firstname }} {{ editRecord.lastname }}</h3>
            <button class="hs-modal-close" @click="showEditModal = false">&times;</button>
          </div>
          <div class="hs-modal-body">
            <form @submit.prevent="saveEdit">
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Purok</label>
                  <select v-model="editRecord.purok" class="hs-select" required>
                    <option value="">Select Purok</option>
                    <option value="Purok 1">Purok 1</option>
                    <option value="Purok 2">Purok 2</option>
                    <option value="Purok 3">Purok 3</option>
                    <option value="Purok 4">Purok 4</option>
                    <option value="Purok 5">Purok 5</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Last Name</label>
                  <input v-model="editRecord.lastname" type="text" class="hs-input" required>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">First Name</label>
                  <input v-model="editRecord.firstname" type="text" class="hs-input" required>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Middle Name</label>
                  <input v-model="editRecord.middlename" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Name of Mother</label>
                  <input v-model="editRecord.mother_name" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Sex</label>
                  <select v-model="editRecord.sex" class="hs-select">
                    <option value="">Select</option>
                    <option value="F">Female</option>
                    <option value="M">Male</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Birthday</label>
                  <input v-model="editRecord.birthday" type="date" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Age</label>
                  <input v-model.number="editRecord.age" type="number" class="hs-input">
                </div>
              </div>
              <div class="hs-modal-footer" style="border:none;padding:var(--hs-space-4) 0 0;">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showEditModal = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Report overlay -->
      <div v-if="showReport" class="hs-modal-overlay">
        <div class="report-wrapper">
          <div class="report-actions">
            <button class="hs-btn hs-btn-secondary" @click="closeReport"><span class="mdi mdi-arrow-left"></span> Back</button>
            <button class="hs-btn hs-btn-primary" @click="exportreportPdf"><span class="mdi mdi-download"></span> Export PDF</button>
          </div>
          <div ref="reportRef" class="report-container">
            <PhsExport/>
          </div>
        </div>
      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
.service-page { max-width: var(--hs-content-max-width); }
.report-wrapper { background: var(--hs-white); border-radius: var(--hs-radius-lg); max-width: 1200px; width: 95%; max-height: 90vh; overflow-y: auto; padding: 24px; }
.report-actions { display: flex; justify-content: space-between; margin-bottom: 16px; }
.report-container { max-width: 1100px; margin: 0 auto; }
</style>
