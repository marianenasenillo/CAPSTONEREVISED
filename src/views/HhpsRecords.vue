<script setup>
import DashboardView from '@/components/DashboardView.vue'
import Hhpsexport from '@/components/reports/Hhpsexport.vue'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { ref, onMounted, computed, watch } from 'vue'
import { usePagination } from '@/composables/usePagination'
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

const { currentPage, itemsPerPage, itemsPerPageOptions, totalItems, totalPages, paginatedData, startIndex, endIndex, visiblePages, goToPage, nextPage, prevPage, firstPage, lastPage, resetPage } = usePagination(filteredRecords)

watch([searchQuery, selectedPurok], () => resetPage())

const handleSearch = () => {
  const el = document.querySelector('.table-responsive.large-table')
  if (el) el.scrollTop = 0
}

const fetchHeadRecords = async () => {
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

const viewMembers = async (head) => {
  selectedHead.value = head
  showMembersModal.value = true
  members.value = []
  try {
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

const deleteRecord = async (record) => {
  if (!confirm(`Are you sure you want to delete the household head "${record.firstname} ${record.lastname}" and all associated members? This action cannot be undone.`)) {
    return
  }

  try {
    const { error: membersError } = await supabase
      .from('household_members')
      .delete()
      .eq('head_id', record.head_id)

    if (membersError) throw membersError

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

const exportPdf = async () => {
  const element = document.querySelector('.large-table')
  if (!element) {
    alert('Table not found.')
    return
  }

  try {
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
        <div class="hs-breadcrumb">Dashboard / Household Profiling / Records</div>
        <h1>Household Head Records</h1>
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
          </select>
        </div>
        <div class="hs-toolbar-right">
          <div class="hs-search-box">
              <span class="mdi mdi-magnify"></span>
              <input v-model="searchQuery" type="search" placeholder="Search..." />
            </div>
          <button class="hs-btn hs-btn-primary" @click="exportPdf"><span class="mdi mdi-file-export-outline"></span> Export</button>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-warning" @click="router.push('/hhpsarchived')"><span class="mdi mdi-archive-outline"></span> Archived</button>
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
              <tr v-for="record in paginatedData" :key="record.head_id">
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
                    <template #activator="{ props }"><v-btn icon v-bind="props" size="small"><v-icon>mdi-dots-vertical</v-icon></v-btn></template>
                    <v-list>
                      <v-list-item @click="viewMembers(record)">View Members</v-list-item>
                      <v-list-item v-if="userRole === 'BHW'" @click="editRecord(record)">Edit</v-list-item>
                      <v-list-item v-if="userRole === 'Admin'" @click="deleteRecord(record)">Delete</v-list-item>
                      <v-list-item v-if="userRole === 'Admin'" @click="archiveRecord(record)">Archive</v-list-item>
                    </v-list>
                  </v-menu>
                </td>
              </tr>
              <tr v-if="filteredRecords.length === 0"><td colspan="11" style="text-align:center;padding:32px;color:var(--hs-gray-400);">No records found.</td></tr>
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

      <!-- Members Modal -->
      <div v-if="showMembersModal" class="hs-modal-overlay" @click.self="showMembersModal = false">
        <div class="hs-modal" style="max-width:95vw;">
          <div class="hs-modal-header">
            <h3>Members of: {{ selectedHead.firstname }} {{ selectedHead.lastname }}</h3>
            <button class="hs-modal-close" @click="showMembersModal = false">&times;</button>
          </div>
          <div class="hs-modal-body">
            <div v-if="members.length === 0" style="text-align:center;padding:24px;">
              <p>No members found for this head.</p>
            </div>
            <div v-else style="overflow-x:auto;">
              <table class="hs-table">
                <thead>
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
                    <th>4Ps Member</th>
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
          <div class="hs-modal-footer">
            <button class="hs-btn hs-btn-secondary" @click="showMembersModal = false">Close</button>
          </div>
        </div>
      </div>

      <!-- Edit Modal -->
      <div v-if="showEditModal" class="hs-modal-overlay" @click.self="showEditModal = false">
        <div class="hs-modal hs-modal-lg">
          <div class="hs-modal-header">
            <h3>Edit Household Head: {{ editHead.firstname }} {{ editHead.lastname }}</h3>
            <button class="hs-modal-close" @click="showEditModal = false">&times;</button>
          </div>
          <div class="hs-modal-body">
            <form @submit.prevent="saveEdit">
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Purok</label>
                  <select v-model="editHead.purok" class="hs-select" required>
                    <option value="Purok 1">Purok 1</option>
                    <option value="Purok 2">Purok 2</option>
                    <option value="Purok 3">Purok 3</option>
                    <option value="Purok 5">Purok 5</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Last Name</label>
                  <input v-model="editHead.lastname" type="text" class="hs-input" required>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">First Name</label>
                  <input v-model="editHead.firstname" type="text" class="hs-input" required>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Middle Name</label>
                  <input v-model="editHead.middlename" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Suffix</label>
                  <input v-model="editHead.suffix" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">No. of Families</label>
                  <input v-model.number="editHead.no_of_families" type="number" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Population</label>
                  <input v-model.number="editHead.population" type="number" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Female Count</label>
                  <input v-model.number="editHead.female_count" type="number" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Male Count</label>
                  <input v-model.number="editHead.male_count" type="number" class="hs-input">
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
            <Hhpsexport/>
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
