<script setup>
import ChildcareExport from '@/components/reports/ChildcareExport.vue'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const sexDisplay = (v) => v === 'M' ? 'Male' : v === 'F' ? 'Female' : (v || '—')
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const toast = useToast()
const goBack = () => router.back()

const loading = ref(true)
const error = ref(null)
const vitaminARecords = ref([])
const searchQuery = ref('')

const userRole = ref('')
const selectedPurok = ref('')
const selectedGender = ref('')
const selectedAgeRange = ref('')
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
  await fetchVitaminARecords()
})

const filteredRecords = computed(() => {
  let records = vitaminARecords.value
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
  if (selectedGender.value) {
    records = records.filter(r => r.gender === selectedGender.value)
  }
  if (selectedAgeRange.value) {
    const [min, max] = selectedAgeRange.value.split('-').map(Number)
    records = records.filter(r => {
      const a = Number(r.age)
      return !isNaN(a) && a >= min && a <= max
    })
  }
  return records
})

const { currentPage, itemsPerPage, itemsPerPageOptions, totalItems, totalPages, paginatedData, startIndex, endIndex, visiblePages, goToPage, nextPage, prevPage, firstPage, lastPage, resetPage } = usePagination(filteredRecords)

watch([searchQuery, selectedPurok, selectedGender, selectedAgeRange], () => resetPage())

const handleSearch = () => {
  const el = document.querySelector('.hs-table-scroll')
  if (el) el.scrollTop = 0
}

const fetchVitaminARecords = async () => {
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
      .from('childcare_vitamina_records')
      .select('*')
      .eq('is_archived', false)
      .order('lastname', { ascending: true })

    if (err) throw err
    vitaminARecords.value = data.map(record => ({
      id: record.id,
      purok: record.purok,
      lastname: record.lastname,
      firstname: record.firstname,
      middlename: record.middlename,
      suffix: record.suffix,
      age: record.age,
      birthdate: record.birthdate ? record.birthdate.slice(0, 10) : '',
      gender: record.gender,
      motherName: record.mother_name
    }))
  } catch (e) {
    console.error(e)
    error.value = 'Failed to load Vitamin A records.'
  } finally {
    loading.value = false
  }
}

const deleteRecord = async (record) => {
  if (!confirm(`Are you sure you want to delete the Vitamin A record for "${record.firstname} ${record.lastname}"? This action cannot be undone.`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('childcare_vitamina_records')
      .delete()
      .eq('id', record.id)

    if (error) throw error

    toast.success('Record deleted successfully.')
    await fetchVitaminARecords() // Refresh the list
  } catch (e) {
    console.error(e)
    toast.error('Error deleting record.')
  }
}

const editRecordFunc = (record) => {
  editRecord.value = { ...record }
  showEditModal.value = true
}

const saveEdit = async () => {
  try {
    const { error } = await supabase
      .from('childcare_vitamina_records')
      .update({
        purok: editRecord.value.purok,
        lastname: editRecord.value.lastname,
        firstname: editRecord.value.firstname,
        middlename: editRecord.value.middlename,
        suffix: editRecord.value.suffix,
        age: editRecord.value.age,
        birthdate: editRecord.value.birthdate,
        gender: editRecord.value.gender,
        mother_name: editRecord.value.motherName
      })
      .eq('id', editRecord.value.id)

    if (error) throw error

    toast.success('Record updated successfully.')
    showEditModal.value = false
    await fetchVitaminARecords()
  } catch (e) {
    console.error(e)
    toast.error('Error updating record.')
  }
}

const archiveRecord = async (record) => {
  if (!confirm(`Are you sure you want to archive the Vitamin A record for "${record.firstname} ${record.lastname}"?`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('childcare_vitamina_records')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString()
      })
      .eq('id', record.id)

    if (error) throw error

    toast.success('Record archived successfully.')
    await fetchVitaminARecords() // Refresh the list
  } catch (e) {
    console.error(e)
    toast.error('Error archiving record.')
  }
}

const exportPdf = async () => {
  const element = document.querySelector('.hs-table-scroll')
  if (!element) {
    toast.error('Table not found.')
    return
  }

  try {
    let originalHeight = element.style.maxHeight
    let originalOverflow = element.style.overflow
    element.style.maxHeight = 'none'
    element.style.overflow = 'visible'

    const table = element.querySelector('table')
    let originalTableHeight = ''
    if (table) {
      originalTableHeight = table.style.height
      table.style.height = 'auto'
    }

    await new Promise(resolve => setTimeout(resolve, 300))

    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff'
    })

    element.style.maxHeight = originalHeight
    element.style.overflow = originalOverflow
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

    pdf.save('childcare_report.pdf')
  } catch (error) {
    console.error('Error generating PDF:', error)
    toast.error('Error generating PDF. Please try again.')
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
    <div class="service-page">
      <div class="hs-page-header">
        <div class="hs-breadcrumb">Dashboard / Child Care / Records</div>
        <h1>Vitamin A Supplementation Records</h1>
        <p class="hs-module-desc">View, edit, and manage childcare immunization and health records.</p>
      </div>

      <div class="hs-toolbar">
        <div class="hs-toolbar-left">
          <button class="hs-btn hs-btn-secondary" @click="goBack"><span class="mdi mdi-arrow-left"></span> Back</button>
          <select v-model="selectedPurok" class="hs-select hs-w-auto">
            <option value="">Purok</option>
            <option value="Purok 1">Purok 1</option>
            <option value="Purok 2">Purok 2</option>
            <option value="Purok 3">Purok 3</option>
            <option value="Purok 4">Purok 4</option>
          </select>
          <select v-model="selectedGender" class="hs-select hs-w-auto">
            <option value="">Gender</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
          <select v-model="selectedAgeRange" class="hs-select hs-w-auto">
            <option value="">Age Range</option>
            <option value="0-1">0-1</option>
            <option value="2-5">2-5</option>
            <option value="6-11">6-11</option>
            <option value="12-17">12-17</option>
          </select>
        </div>
        <div class="hs-toolbar-right">
          <div class="hs-search-box">
              <span class="mdi mdi-magnify"></span>
              <input v-model="searchQuery" type="search" placeholder="Search..." />
            </div>
          <button class="hs-btn hs-btn-primary" @click="exportPdf"><span class="mdi mdi-file-export-outline"></span> Export</button>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-warning" @click="router.push('/childcarearchived')"><span class="mdi mdi-archive-outline"></span> Archived</button>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-secondary" @click="openReport"><span class="mdi mdi-chart-bar"></span> Report</button>
        </div>
      </div>

      <div v-if="loading" class="hs-empty-state"><div class="hs-spinner"></div><p>Loading records...</p></div>
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
                <th>Gender</th>
                <th>Full name of Mother</th>
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
                <td>{{ sexDisplay(record.gender) }}</td>
                <td>{{ record.motherName }}</td>
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
              <tr v-if="filteredRecords.length === 0"><td colspan="10" class="hs-table-empty">No records found.</td></tr>
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
            <h3>Edit Vitamin A Record: {{ editRecord.firstname }} {{ editRecord.lastname }}</h3>
            <button class="hs-modal-close" @click="showEditModal = false">&times;</button>
          </div>
          <div class="hs-modal-body">
            <form @submit.prevent="saveEdit">
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Purok</label>
                  <select v-model="editRecord.purok" class="hs-select" required>
                    <option value="Purok 1">Purok 1</option>
                    <option value="Purok 2">Purok 2</option>
                    <option value="Purok 3">Purok 3</option>
                    <option value="Purok 4">Purok 4</option>
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
                  <label class="hs-label">Suffix</label>
                  <input v-model="editRecord.suffix" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Age</label>
                  <input v-model.number="editRecord.age" type="number" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Birthdate</label>
                  <input v-model="editRecord.birthdate" type="date" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Gender</label>
                  <select v-model="editRecord.gender" class="hs-select">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Full name of Mother</label>
                  <input v-model="editRecord.motherName" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
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
            <ChildcareExport/>
          </div>
        </div>
      </div>
    </div>
</template>

<style scoped>
.service-page { max-width: var(--hs-content-max-width); }
.report-wrapper { background: var(--hs-white); border-radius: var(--hs-radius-lg); max-width: 1200px; width: 95%; max-height: 90vh; overflow-y: auto; padding: 24px; }
.report-actions { display: flex; justify-content: space-between; margin-bottom: 16px; }
.report-container { max-width: 1100px; margin: 0 auto; }
</style>
