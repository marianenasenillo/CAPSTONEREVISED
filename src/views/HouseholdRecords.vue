<script setup>
import HouseholdExport from '@/components/reports/HouseholdExport.vue'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const sexDisplay = (v) => v === 'M' ? 'Male' : v === 'F' ? 'Female' : (v || '—')
import { ref, onMounted, computed, watch } from 'vue'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'

const toast = useToast()
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
const selectedSex = ref('')
const selectedCivilStatus = ref('')
const editHead = ref(null)
const showEditModal = ref(false)

const editingMember = ref(null)
const showEditMemberModal = ref(false)

const memberSearchQuery = ref('')
const showAddMemberModal = ref(false)
const newMember = ref({})

const initNewMember = () => {
  if (!selectedHead.value) return
  newMember.value = {
    head_id: selectedHead.value.head_id,
    barangay: selectedHead.value.barangay || '',
    purok: selectedHead.value.purok || '',
    lastname: '',
    firstname: '',
    middlename: '',
    suffix: '',
    relationship: '',
    birthdate: '',
    age: '',
    sex: '',
    civil_status: '',
    education: '',
    religion: '',
    ethnicity: '',
    is_4ps_member: false,
    philhealth_id: '',
    medical_history: '',
    fp_method_used: '',
    water_source: '',
    toilet_facility: '',
  }
  showAddMemberModal.value = true
}

const saveNewMember = async () => {
  if (!newMember.value.firstname || !newMember.value.lastname) {
    toast.warning('First name and last name are required.')
    return
  }
  try {
    const payload = { ...newMember.value }
    if (payload.age !== '' && payload.age != null) payload.age = parseInt(payload.age)
    else payload.age = null
    if (!payload.birthdate) payload.birthdate = null
    // Normalize sex for char(1) column
    if (payload.sex === 'Male') payload.sex = 'M'
    else if (payload.sex === 'Female') payload.sex = 'F'

    const { error } = await supabase.from('household_members').insert(payload)
    if (error) {
      console.error('[addMember] Supabase error:', error.code, error.message, '\nPayload:', JSON.stringify(payload, null, 2))
      throw error
    }

    toast.success('Member added successfully.')
    showAddMemberModal.value = false
    if (selectedHead.value) await viewMembers(selectedHead.value)
  } catch (e) {
    console.error('[addMember] Error:', e?.code, e?.message, e)
    toast.error(`Error adding member: ${e?.message || e}`)
  }
}

const deleteMember = async (member) => {
  if (!confirm(`Delete member "${member.firstname} ${member.lastname}"? This action cannot be undone.`)) return
  try {
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('member_id', member.member_id)
    if (error) throw error

    toast.success('Member deleted successfully.')
    if (selectedHead.value) await viewMembers(selectedHead.value)
  } catch (e) {
    console.error(e)
    toast.error('Error deleting member: ' + (e.message || e))
  }
}

const archiveMember = async (member) => {
  if (!confirm(`Archive member "${member.firstname} ${member.lastname}"?`)) return
  try {
    const { error } = await supabase
      .from('household_members')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('member_id', member.member_id)
    if (error) throw error

    toast.success('Member archived successfully.')
    if (selectedHead.value) await viewMembers(selectedHead.value)
  } catch (e) {
    console.error(e)
    toast.error('Error archiving member: ' + (e.message || e))
  }
}

const filteredModalMembers = computed(() => {
  if (!memberSearchQuery.value.trim()) return members.value
  const q = memberSearchQuery.value.toLowerCase()
  return members.value.filter(m =>
    (m.lastname && m.lastname.toLowerCase().includes(q)) ||
    (m.firstname && m.firstname.toLowerCase().includes(q)) ||
    (m.middlename && m.middlename.toLowerCase().includes(q)) ||
    (m.relationship && m.relationship.toLowerCase().includes(q))
  )
})

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
  const q = String(searchQuery.value || '').trim().toLowerCase()
  if (q) {
    records = records.filter(r =>
      String(r.head_id).toLowerCase().includes(q) ||
      String(r.lastname).toLowerCase().includes(q) ||
      String(r.firstname).toLowerCase().includes(q)
    )
  }
  if (selectedPurok.value) {
    records = records.filter(r => r.purok === selectedPurok.value)
  }
  if (selectedSex.value) {
    records = records.filter(r => r.sex === selectedSex.value)
  }
  if (selectedCivilStatus.value) {
    records = records.filter(r => r.civil_status === selectedCivilStatus.value)
  }
  return records
})

const { currentPage, itemsPerPage, itemsPerPageOptions, totalItems, totalPages, paginatedData, startIndex, endIndex, visiblePages, goToPage, nextPage, prevPage, firstPage, lastPage, resetPage } = usePagination(filteredRecords)

watch([searchQuery, selectedPurok, selectedSex, selectedCivilStatus], () => resetPage())

const handleSearch = () => {
  const el = document.querySelector('.hs-table-scroll')
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
      .order('lastname', { ascending: true })

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
      .eq('head_id', head.head_id)
      .eq('is_archived', false)

    if (err) throw err
    members.value = data
  } catch (e) {
    console.error(e)
    toast.error('Error loading household members.')
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

    toast.success('Record and associated members deleted successfully.')
    await fetchHeadRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    toast.error('Error deleting record.')
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

    toast.success('Record archived successfully.')
    await fetchHeadRecords() // Refresh the list
  } catch (e) {
    console.error(e)
    toast.error('Error archiving record.')
  }
}

const editRecord = (record) => {
  editHead.value = { ...record }
  showEditModal.value = true
}

const saveEdit = async () => {
  try {
    // Normalize sex for char(1) column
    const sexVal = editHead.value.sex
    const normalizedSex = (sexVal === 'Male') ? 'M' : (sexVal === 'Female') ? 'F' : (sexVal || null)

    const headPayload = {
      purok: editHead.value.purok,
      lastname: editHead.value.lastname,
      firstname: editHead.value.firstname,
      middlename: editHead.value.middlename,
      suffix: editHead.value.suffix,
      birthdate: editHead.value.birthdate || null,
      age: editHead.value.age !== '' && editHead.value.age != null ? parseInt(editHead.value.age) : null,
      sex: normalizedSex,
      civil_status: editHead.value.civil_status || null,
      contact_number: editHead.value.contact_number || null,
      occupation: editHead.value.occupation || null,
      no_of_families: editHead.value.no_of_families,
      population: editHead.value.population,
      female_count: editHead.value.female_count,
      male_count: editHead.value.male_count
    }

    const { error } = await supabase
      .from('household_heads')
      .update(headPayload)
      .eq('head_id', editHead.value.head_id)

    if (error) {
      console.error('[editHead] Supabase error:', error.code, error.message, '\nPayload:', JSON.stringify(headPayload, null, 2))
      throw error
    }

    toast.success('Record updated successfully.')
    showEditModal.value = false
    await fetchHeadRecords()
  } catch (e) {
    console.error('[editHead] Error:', e?.code, e?.message, e)
    toast.error(`Error updating record: ${e?.message || e}`)
  }
}

const editMemberRecord = (member) => {
  editingMember.value = { ...member }
  showEditMemberModal.value = true
}

const saveMemberEdit = async () => {
  try {
    // Normalize sex for char(1) column
    const sexVal = editingMember.value.sex
    const normalizedSex = (sexVal === 'Male') ? 'M' : (sexVal === 'Female') ? 'F' : sexVal

    const memberPayload = {
      lastname: editingMember.value.lastname,
      firstname: editingMember.value.firstname,
      middlename: editingMember.value.middlename,
      suffix: editingMember.value.suffix,
      relationship: editingMember.value.relationship,
      birthdate: editingMember.value.birthdate || null,
      age: editingMember.value.age !== '' ? parseInt(editingMember.value.age) : null,
      sex: normalizedSex,
      civil_status: editingMember.value.civil_status,
      education: editingMember.value.education,
      religion: editingMember.value.religion,
      ethnicity: editingMember.value.ethnicity,
      is_4ps_member: editingMember.value.is_4ps_member,
      philhealth_id: editingMember.value.philhealth_id,
      medical_history: editingMember.value.medical_history,
      fp_method_used: editingMember.value.fp_method_used,
      water_source: editingMember.value.water_source,
      toilet_facility: editingMember.value.toilet_facility,
    }

    const { error } = await supabase
      .from('household_members')
      .update(memberPayload)
      .eq('member_id', editingMember.value.member_id)

    if (error) {
      console.error('[editMember] Supabase error:', error.code, error.message, '\nPayload:', JSON.stringify(memberPayload, null, 2))
      throw error
    }

    toast.success('Member updated successfully.')
    showEditMemberModal.value = false
    if (selectedHead.value) await viewMembers(selectedHead.value)
  } catch (e) {
    console.error('[editMember] Error:', e?.code, e?.message, e)
    toast.error(`Error updating member: ${e?.message || e}`)
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

    pdf.save('household_report.pdf')
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
        <div class="hs-breadcrumb">Dashboard / Household Profiling / Records</div>
        <h1>Household Head Records</h1>
        <p class="hs-module-desc">View, edit, archive, and export household profiling records.</p>
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
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
          <select v-model="selectedCivilStatus" class="hs-select hs-w-auto">
            <option value="">Civil Status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Widowed">Widowed</option>
            <option value="Separated">Separated</option>
            <option value="Live-in">Live-in</option>
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
      <div v-else-if="error" class="hs-error-alert">{{ error }}</div>
      <div v-else class="hs-card hs-card--flush">
        <div class="hs-table-scroll">
          <table class="hs-table">
            <thead>
              <tr>
                <th>Head ID</th>
                <th>Purok</th>
                <th>Last Name</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Suffix</th>
                <th>Birthdate</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Civil Status</th>
                <th>Contact</th>
                <th>Occupation</th>
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
                <td>{{ record.birthdate || '-' }}</td>
                <td>{{ record.age ?? '-' }}</td>
                <td>{{ sexDisplay(record.sex) }}</td>
                <td>{{ record.civil_status || '-' }}</td>
                <td>{{ record.contact_number || '-' }}</td>
                <td>{{ record.occupation || '-' }}</td>
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
              <tr v-if="filteredRecords.length === 0"><td colspan="17" class="hs-table-empty">No records found.</td></tr>
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
        <div class="hs-modal members-modal">
          <div class="hs-modal-header">
            <h3>Members of: {{ selectedHead.firstname }} {{ selectedHead.lastname }}</h3>
            <button class="hs-modal-close" @click="showMembersModal = false">&times;</button>
          </div>
          <div class="hs-modal-body">
            <!-- Search & Add toolbar -->
            <div class="members-toolbar">
              <div class="hs-search-box">
                <span class="mdi mdi-magnify"></span>
                <input v-model="memberSearchQuery" type="search" placeholder="Search members..." />
              </div>
              <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-warning hs-btn-sm" @click="router.push('/membersarchived')">
                <span class="mdi mdi-archive-outline"></span> Archived
              </button>
              <button class="hs-btn hs-btn-primary hs-btn-sm" @click="initNewMember">
                <span class="mdi mdi-plus"></span> Add Member
              </button>
            </div>

            <div v-if="members.length === 0" class="members-empty">
              <p>No members found for this head.</p>
            </div>
            <div v-else class="members-scroll">
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in filteredModalMembers" :key="m.member_id">
                    <td>{{ m.lastname }}</td>
                    <td>{{ m.firstname }}</td>
                    <td>{{ m.middlename }}</td>
                    <td>{{ m.relationship }}</td>
                    <td>{{ m.birthdate }}</td>
                    <td>{{ m.age }}</td>
                    <td>{{ sexDisplay(m.sex) }}</td>
                    <td>{{ m.civil_status }}</td>
                    <td>{{ m.education }}</td>
                    <td>{{ m.religion }}</td>
                    <td>{{ m.ethnicity }}</td>
                    <td>{{ m.philhealth_id || '-' }}</td>
                    <td>{{ m.is_4ps_member ? 'Yes' : 'No' }}</td>
                    <td>{{ m.fp_method_used || '-' }}</td>
                    <td>{{ m.medical_history || '-' }}</td>
                    <td>
                      <div class="member-action-btns">
                        <button class="hs-btn hs-btn-primary hs-btn-sm" @click="editMemberRecord(m)" title="Edit">
                          <span class="mdi mdi-pencil-outline"></span>
                        </button>
                        <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-warning hs-btn-sm" @click="archiveMember(m)" title="Archive">
                          <span class="mdi mdi-archive-outline"></span>
                        </button>
                        <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-danger hs-btn-sm" @click="deleteMember(m)" title="Delete">
                          <span class="mdi mdi-delete-outline"></span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="filteredModalMembers.length === 0 && members.length > 0">
                    <td colspan="16" class="hs-table-empty">No members match your search.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="hs-modal-footer">
            <span class="hs-text-muted" style="font-size: var(--hs-font-size-xs);">{{ members.length }} member(s)</span>
            <button class="hs-btn hs-btn-secondary" @click="showMembersModal = false">Close</button>
          </div>
        </div>
      </div>

      <!-- Add Member Modal -->
      <div v-if="showAddMemberModal" class="hs-modal-overlay" style="z-index: 9100;" @click.self="showAddMemberModal = false">
        <div class="hs-modal hs-modal-lg">
          <div class="hs-modal-header">
            <h3>Add Member to: {{ selectedHead?.firstname }} {{ selectedHead?.lastname }}</h3>
            <button class="hs-modal-close" @click="showAddMemberModal = false">&times;</button>
          </div>
          <div class="hs-modal-body">
            <form @submit.prevent="saveNewMember">
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Last Name <span class="hs-text-danger">*</span></label>
                  <input v-model="newMember.lastname" type="text" class="hs-input" required>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">First Name <span class="hs-text-danger">*</span></label>
                  <input v-model="newMember.firstname" type="text" class="hs-input" required>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Middle Name</label>
                  <input v-model="newMember.middlename" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Suffix</label>
                  <input v-model="newMember.suffix" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Relationship</label>
                  <select v-model="newMember.relationship" class="hs-select">
                    <option value="">Select</option>
                    <option value="Wife">Wife</option>
                    <option value="Husband">Husband</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Grandchild">Grandchild</option>
                    <option value="Relative">Relative</option>
                    <option value="Non-relative">Non-relative</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Birthdate</label>
                  <input v-model="newMember.birthdate" type="date" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Age</label>
                  <input v-model.number="newMember.age" type="number" class="hs-input" min="0">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Sex</label>
                  <select v-model="newMember.sex" class="hs-select">
                    <option value="">Select</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Civil Status</label>
                  <select v-model="newMember.civil_status" class="hs-select">
                    <option value="">Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Live-in">Live-in</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Education</label>
                  <input v-model="newMember.education" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Religion</label>
                  <input v-model="newMember.religion" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Ethnicity</label>
                  <input v-model="newMember.ethnicity" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">PhilHealth ID</label>
                  <input v-model="newMember.philhealth_id" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">4Ps Member</label>
                  <select v-model="newMember.is_4ps_member" class="hs-select">
                    <option :value="false">No</option>
                    <option :value="true">Yes</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Medical History</label>
                  <input v-model="newMember.medical_history" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">FP Method Used</label>
                  <input v-model="newMember.fp_method_used" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Water Source</label>
                  <input v-model="newMember.water_source" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Toilet Facility</label>
                  <input v-model="newMember.toilet_facility" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showAddMemberModal = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary"><span class="mdi mdi-plus"></span> Add Member</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Edit Member Modal -->
      <div v-if="showEditMemberModal && editingMember" class="hs-modal-overlay" style="z-index: 9100;" @click.self="showEditMemberModal = false">
        <div class="hs-modal hs-modal-lg">
          <div class="hs-modal-header">
            <h3>Edit Member: {{ editingMember.firstname }} {{ editingMember.lastname }}</h3>
            <button class="hs-modal-close" @click="showEditMemberModal = false">&times;</button>
          </div>
          <div class="hs-modal-body">
            <form @submit.prevent="saveMemberEdit">
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Last Name</label>
                  <input v-model="editingMember.lastname" type="text" class="hs-input" required>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">First Name</label>
                  <input v-model="editingMember.firstname" type="text" class="hs-input" required>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Middle Name</label>
                  <input v-model="editingMember.middlename" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Suffix</label>
                  <input v-model="editingMember.suffix" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Relationship</label>
                  <select v-model="editingMember.relationship" class="hs-select">
                    <option value="Wife">Wife</option>
                    <option value="Husband">Husband</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Grandchild">Grandchild</option>
                    <option value="Relative">Relative</option>
                    <option value="Non-relative">Non-relative</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Birthdate</label>
                  <input v-model="editingMember.birthdate" type="date" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Age</label>
                  <input v-model.number="editingMember.age" type="number" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Sex</label>
                  <select v-model="editingMember.sex" class="hs-select">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Civil Status</label>
                  <select v-model="editingMember.civil_status" class="hs-select">
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Live-in">Live-in</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Education</label>
                  <input v-model="editingMember.education" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Religion</label>
                  <input v-model="editingMember.religion" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Ethnicity</label>
                  <input v-model="editingMember.ethnicity" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">PhilHealth ID</label>
                  <input v-model="editingMember.philhealth_id" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">4Ps Member</label>
                  <select v-model="editingMember.is_4ps_member" class="hs-select">
                    <option :value="true">Yes</option>
                    <option :value="false">No</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Medical History</label>
                  <input v-model="editingMember.medical_history" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">FP Method Used</label>
                  <input v-model="editingMember.fp_method_used" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Water Source</label>
                  <input v-model="editingMember.water_source" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Toilet Facility</label>
                  <input v-model="editingMember.toilet_facility" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showEditMemberModal = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary">Save Changes</button>
              </div>
            </form>
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
                    <option value="Purok 4">Purok 4</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Last Name</label>
                  <input v-model="editHead.lastname" type="text" class="hs-input" required>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">First Name</label>
                  <input v-model="editHead.firstname" type="text" class="hs-input" required>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Middle Name</label>
                  <input v-model="editHead.middlename" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Suffix</label>
                  <input v-model="editHead.suffix" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Birthdate</label>
                  <input v-model="editHead.birthdate" type="date" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Age</label>
                  <input v-model.number="editHead.age" type="number" class="hs-input" min="0">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Sex</label>
                  <select v-model="editHead.sex" class="hs-select">
                    <option value="">Select</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Civil Status</label>
                  <select v-model="editHead.civil_status" class="hs-select">
                    <option value="">Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Live-in">Live-in</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Contact Number</label>
                  <input v-model="editHead.contact_number" type="text" class="hs-input" placeholder="e.g. 09xxxxxxxxx">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Occupation</label>
                  <input v-model="editHead.occupation" type="text" class="hs-input">
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
                <div class="hs-form-group">
                  <label class="hs-label">Male Count</label>
                  <input v-model.number="editHead.male_count" type="number" class="hs-input">
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
            <HouseholdExport/>
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
.members-modal { max-width: 95vw; }
.members-empty { text-align: center; padding: 24px; }
.members-scroll { overflow-x: auto; }
.members-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.members-toolbar .hs-search-box { flex: 1; max-width: 320px; }
.member-action-btns { display: flex; gap: 4px; }
.hs-modal-footer--flat { border-top: none; padding-top: 8px; }
</style>
