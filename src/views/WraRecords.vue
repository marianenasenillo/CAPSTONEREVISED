<script setup>
import WraExport from '@/components/reports/WraExport.vue'
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
const wraRecords = ref([])
const searchQuery = ref('')

const userRole = ref('')
const selectedPurok = ref('')
const selectedCivilStatus = ref('')
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
  await fetchWraRecords()
})

const filteredRecords = computed(() => {
  let records = wraRecords.value
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
  if (selectedCivilStatus.value) {
    records = records.filter(r => r.civilStatus === selectedCivilStatus.value)
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

watch([searchQuery, selectedPurok, selectedCivilStatus, selectedAgeRange], () => resetPage())

const handleSearch = () => {
  const el = document.querySelector('.hs-table-scroll')
  if (el) el.scrollTop = 0
}

const fetchWraRecords = async () => {
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
      .from('wra_records')
      .select('*')
      .eq('is_archived', false)
      .order('lastname', { ascending: true })

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
    error.value = 'Failed to load WRA records.'
  } finally {
    loading.value = false
  }
}

const deleteRecord = async (record) => {
  if (!confirm(`Are you sure you want to delete the WRA record for "${record.firstname} ${record.lastname}"? This action cannot be undone.`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('wra_records')
      .delete()
      .eq('id', record.id)

    if (error) throw error

    toast.success('Record deleted successfully.')
    await fetchWraRecords() // Refresh the list
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
      .from('wra_records')
      .update({
        purok: editRecord.value.purok,
        lastname: editRecord.value.lastname,
        firstname: editRecord.value.firstname,
        middlename: editRecord.value.middlename,
        suffix: editRecord.value.suffix,
        age: editRecord.value.age,
        birthdate: editRecord.value.birthdate,
        se_status: editRecord.value.seStatus,
        civil_status: editRecord.value.civilStatus,
        plano_manganak: editRecord.value.planoManganak,
        karun: editRecord.value.karun,
        spacing: editRecord.value.spacing,
        limiting: editRecord.value.limiting,
        fecund: editRecord.value.fecund,
        infecund: editRecord.value.infecund,
        fb_method: editRecord.value.fbMethod,
        fb_type: editRecord.value.fbType,
        fb_date: editRecord.value.fbDate,
        change_method: editRecord.value.changeMethod
      })
      .eq('id', editRecord.value.id)

    if (error) throw error

    toast.success('Record updated successfully.')
    showEditModal.value = false
    await fetchWraRecords()
  } catch (e) {
    console.error(e)
    toast.error('Error updating record.')
  }
}

const archiveRecord = async (record) => {
  if (!confirm(`Are you sure you want to archive the WRA record for "${record.firstname} ${record.lastname}"?`)) {
    return
  }

  try {
    const { error } = await supabase
      .from('wra_records')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString()
      })
      .eq('id', record.id)

    if (error) throw error

    toast.success('Record archived successfully.')
    await fetchWraRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    toast.error('Error archiving record.')
  }
}

function downloadCsv(headers, rows, filename) {
  const esc = v => { if (v === null || v === undefined) return ''; const s = String(v); return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

const exportCsv = () => {
  const headers = ['Purok','Last Name','First Name','Middle Name','Suffix','Age','Birthdate','SE Status','Civil Status','Nag plano manganak','Karun','Spacing','Limiting','Fecund','Infecund','FB Method Used','Type','Date','Gusto balhin Method']
  const rows = filteredRecords.value.map(r => [r.purok, r.lastname, r.firstname, r.middlename, r.suffix, r.age, r.birthdate, r.seStatus, r.civilStatus, r.planoManganak, r.karun ? 'Yes' : 'No', r.spacing ? 'Yes' : 'No', r.limiting ? 'Yes' : 'No', r.fecund ? 'Yes' : 'No', r.infecund ? 'Yes' : 'No', r.fbMethod, r.fbType, r.fbDate, r.changeMethod])
  downloadCsv(headers, rows, 'wra_records.csv')
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
        <div class="hs-breadcrumb">Dashboard / Maternal Care / WRA Records</div>
        <h1>Women of Reproductive Age Records</h1>
        <p class="hs-module-desc">View, edit, and manage Women of Reproductive Age service records.</p>
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
          <select v-model="selectedCivilStatus" class="hs-select hs-w-auto">
            <option value="">Civil Status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Widowed">Widowed</option>
            <option value="Separated">Separated</option>
            <option value="Live-in">Live-in</option>
          </select>
          <select v-model="selectedAgeRange" class="hs-select hs-w-auto">
            <option value="">Age Range</option>
            <option value="15-19">15-19</option>
            <option value="20-29">20-29</option>
            <option value="30-39">30-39</option>
            <option value="40-49">40-49</option>
          </select>
        </div>
        <div class="hs-toolbar-right">
          <div class="hs-search-box">
              <span class="mdi mdi-magnify"></span>
              <input v-model="searchQuery" type="search" placeholder="Search..." />
            </div>
          <button class="hs-btn hs-btn-primary" @click="exportCsv"><span class="mdi mdi-file-delimited-outline"></span> Export CSV</button>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-warning" @click="router.push('/wraarchived')"><span class="mdi mdi-archive-outline"></span> Archived</button>
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
              <tr v-for="record in paginatedData" :key="record.id">
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
                <td>{{ record.karun ? '\u2713' : '\u2717' }}</td>
                <td>{{ record.spacing ? '\u2713' : '\u2717' }}</td>
                <td>{{ record.limiting ? '\u2713' : '\u2717' }}</td>
                <td>{{ record.fecund ? '\u2713' : '\u2717' }}</td>
                <td>{{ record.infecund ? '\u2713' : '\u2717' }}</td>
                <td>{{ record.fbMethod }}</td>
                <td>{{ record.fbType }}</td>
                <td>{{ record.fbDate }}</td>
                <td>{{ record.changeMethod }}</td>
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
              <tr v-if="filteredRecords.length === 0"><td colspan="20" class="hs-table-empty">No records found.</td></tr>
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
            <h3>Edit WRA Record: {{ editRecord.firstname }} {{ editRecord.lastname }}</h3>
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
                  <label class="hs-label">SE Status</label>
                  <select v-model="editRecord.seStatus" class="hs-select">
                    <option value="Eligible">Eligible</option>
                    <option value="Not Eligible">Not Eligible</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Civil Status</label>
                  <select v-model="editRecord.civilStatus" class="hs-select">
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Nag plano manganak</label>
                  <select v-model="editRecord.planoManganak" class="hs-select">
                    <option value="Oo">Oo</option>
                    <option value="Dili">Dili</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Karun</label>
                  <input v-model="editRecord.karun" type="checkbox" class="hs-checkbox">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Spacing</label>
                  <input v-model="editRecord.spacing" type="checkbox" class="hs-checkbox">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Limiting</label>
                  <input v-model="editRecord.limiting" type="checkbox" class="hs-checkbox">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Fecund</label>
                  <input v-model="editRecord.fecund" type="checkbox" class="hs-checkbox">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Infecund</label>
                  <input v-model="editRecord.infecund" type="checkbox" class="hs-checkbox">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">FB Method Used</label>
                  <select v-model="editRecord.fbMethod" class="hs-select">
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Type</label>
                  <input v-model="editRecord.fbType" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Date</label>
                  <input v-model="editRecord.fbDate" type="date" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Gusto mo balhin ug Method</label>
                  <div class="radio-group">
                    <label><input type="radio" v-model="editRecord.changeMethod" value="Yes"> Yes</label>
                    <label><input type="radio" v-model="editRecord.changeMethod" value="No"> No</label>
                  </div>
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
            <WraExport/>
          </div>
        </div>
      </div>
    </div>
</template>

<style scoped>
.service-page { max-width: var(--hs-content-max-width); }

.report-wrapper {
  background: var(--hs-white);
  border-radius: var(--hs-radius-lg);
  max-width: 1200px;
  width: 95%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px;
}
.report-actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}
.report-container {
  max-width: 1100px;
  margin: 0 auto;
}

.radio-group {
  display: flex;
  gap: var(--hs-space-4);
  align-items: center;
  padding-top: var(--hs-space-2);
}
.radio-group label {
  display: flex;
  align-items: center;
  gap: var(--hs-space-2);
  font-size: var(--hs-font-size-base);
  cursor: pointer;
}
</style>
