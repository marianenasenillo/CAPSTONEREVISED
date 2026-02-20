<script setup>
import FpsExport from '@/components/reports/FpsExport.vue'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
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
const responsibleRecords = ref([])
const searchQuery = ref('')

const userRole = ref('')
const selectedPurok = ref('')
const selectedSex = ref('')
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
  await fetchResponsibleRecords()
})

const filteredRecords = computed(() => {
  let records = responsibleRecords.value
  const q = String(searchQuery.value || '').trim()
  if (q) {
    records = records.filter(r =>
      String(r.surname).toLowerCase().includes(q.toLowerCase()) ||
      String(r.firstname).toLowerCase().includes(q.toLowerCase())
    )
  }
  if (selectedPurok.value) {
    records = records.filter(r => r.purok === selectedPurok.value)
  }
  if (selectedSex.value) {
    records = records.filter(r => r.sex === selectedSex.value)
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

watch([searchQuery, selectedPurok, selectedSex, selectedAgeRange], () => resetPage())

const handleSearch = () => {
  const el = document.querySelector('.hs-table-scroll')
  if (el) el.scrollTop = 0
}

const fetchResponsibleRecords = async () => {
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
      .from('family_planning_records')
      .select('*')
      .eq('is_archived', false)
      .order('surname', { ascending: true })

    if (err) throw err
    responsibleRecords.value = data
  } catch (e) {
    console.error(e)
    error.value = 'Failed to load family planning records.'
  } finally {
    loading.value = false
  }
}

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

    toast.success('Record deleted successfully.')
    await fetchResponsibleRecords() // Refresh the list
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
      .from('family_planning_records')
      .update({
        surname: editRecord.value.surname,
        firstname: editRecord.value.firstname,
        mother_name: editRecord.value.mother_name,
        sex: editRecord.value.sex,
        birthday: editRecord.value.birthday,
        age: editRecord.value.age,
        purok: editRecord.value.purok
      })
      .eq('id', editRecord.value.id)

    if (error) throw error

    toast.success('Record updated successfully.')
    showEditModal.value = false
    await fetchResponsibleRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    toast.error('Error updating record.')
  }
}

const archiveRecord = async (record) => {
  if (!confirm(`Are you sure you want to archive the family planning record for "${record.firstname} ${record.surname}"?`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('family_planning_records')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString()
      })
      .eq('id', record.id)

    if (error) throw error

    toast.success('Record archived successfully.')
    await fetchResponsibleRecords() // Refresh the list
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

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    })

    element.style.maxHeight = originalHeight
    element.style.overflow = originalOverflow
    if (table) {
      table.style.height = originalTableHeight
    }

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

    pdf.save('family-planning-report.pdf')
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
        <div class="hs-breadcrumb">Dashboard / Family Planning / Records</div>
        <h1>Responsible Parenthood Records</h1>
        <p class="hs-module-desc">View, edit, and manage family planning service records.</p>
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
          <select v-model="selectedSex" class="hs-select hs-w-auto">
            <option value="">Sex</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <select v-model="selectedAgeRange" class="hs-select hs-w-auto">
            <option value="">Age Range</option>
            <option value="0-5">0-5</option>
            <option value="6-12">6-12</option>
            <option value="13-17">13-17</option>
            <option value="18-59">18-59</option>
            <option value="60-100">60+</option>
          </select>
        </div>
        <div class="hs-toolbar-right">
          <div class="hs-search-box">
              <span class="mdi mdi-magnify"></span>
              <input v-model="searchQuery" type="search" placeholder="Search..." />
            </div>
          <button class="hs-btn hs-btn-primary" @click="exportPdf"><span class="mdi mdi-file-export-outline"></span> Export</button>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-warning" @click="router.push('/fpsarchived')"><span class="mdi mdi-archive-outline"></span> Archived</button>
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
              <tr v-for="record in paginatedData" :key="record.id">
                <td>{{ record.purok }}</td>
                <td>{{ record.surname }}</td>
                <td>{{ record.firstname }}</td>
                <td>{{ record.mother_name }}</td>
                <td>{{ record.sex }}</td>
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
              <tr v-if="filteredRecords.length === 0"><td colspan="8" class="hs-table-empty">No records found.</td></tr>
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
            <h3>Edit Record: {{ editRecord.firstname }} {{ editRecord.surname }}</h3>
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
                  <label class="hs-label">Surname</label>
                  <input v-model="editRecord.surname" type="text" class="hs-input" required>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">First Name</label>
                  <input v-model="editRecord.firstname" type="text" class="hs-input" required>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Name of Mother</label>
                  <input v-model="editRecord.mother_name" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Sex</label>
                  <select v-model="editRecord.sex" class="hs-select">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Birthday</label>
                  <input v-model="editRecord.birthday" type="date" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Age in years</label>
                  <input v-model.number="editRecord.age" type="number" class="hs-input">
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
            <FpsExport/>
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
