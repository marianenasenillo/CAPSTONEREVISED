<script setup>
import HouseholdExport from '@/components/reports/HouseholdExport.vue'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { calculateAge } from '@/utils/ageClassification'
import { useServiceDetection } from '@/composables/useServiceDetection'

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

// Service detection for add member form
const memberDetection = useServiceDetection()

const initNewMember = () => {
  if (!selectedHead.value) return
  memberDetection.resetDetection()
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

    // Insert detected service records
    const baseData = {
      purok: newMember.value.purok || selectedHead.value?.purok || '',
      lastname: newMember.value.lastname,
      firstname: newMember.value.firstname,
      middlename: newMember.value.middlename,
      suffix: newMember.value.suffix,
      birthdate: newMember.value.birthdate,
      age: newMember.value.age,
      sex: newMember.value.sex,
      civil_status: newMember.value.civil_status,
    }
    const servicePayloads = memberDetection.buildPayloads(baseData)
    const serviceErrors = []
    for (const sp of servicePayloads) {
      const { error: svcErr } = await supabase.from(sp.table).insert([sp.payload])
      if (svcErr) {
        console.error(`Failed to insert ${sp.label}:`, svcErr)
        serviceErrors.push(sp.label)
      }
    }

    if (serviceErrors.length > 0) {
      toast.warning(`Member added, but some service records failed: ${serviceErrors.join(', ')}`)
    } else if (servicePayloads.length > 0) {
      toast.success(`Member added with ${servicePayloads.length} service record(s)!`)
    } else {
      toast.success('Member added successfully.')
    }
    showAddMemberModal.value = false
    memberDetection.resetDetection()
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

// Auto-calculate age from birthdate for new member & detect services
watch(() => newMember.value.birthdate, (val) => {
  if (val) {
    const calc = calculateAge(val)
    newMember.value.age = calc !== null && calc >= 0 ? calc : ''
    memberDetection.detectServices({
      birthdate: val,
      sex: newMember.value.sex,
      civil_status: newMember.value.civil_status,
    })
  } else {
    newMember.value.age = ''
    memberDetection.resetDetection()
  }
})

// Re-detect services when sex or civil_status changes
watch([() => newMember.value.sex, () => newMember.value.civil_status], () => {
  if (newMember.value.birthdate) {
    memberDetection.detectServices({
      birthdate: newMember.value.birthdate,
      sex: newMember.value.sex,
      civil_status: newMember.value.civil_status,
    })
  }
})

// Auto-calculate age from birthdate for editing member
watch(() => editingMember.value?.birthdate, (val) => {
  if (val && editingMember.value) {
    const calc = calculateAge(val)
    editingMember.value.age = calc !== null && calc >= 0 ? calc : ''
  }
})

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

function downloadCsv(headers, rows, filename) {
  const esc = v => { if (v === null || v === undefined) return ''; const s = String(v); return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

const exportCsv = () => {
  const headers = ['Head ID','Purok','Last Name','First Name','Middle Name','Suffix','Birthdate','Age','Sex','Civil Status','Contact','Occupation','No. of Families','Population','Female','Male']
  const rows = filteredRecords.value.map(r => [r.head_id, r.purok, r.lastname, r.firstname, r.middlename, r.suffix, r.birthdate, r.age, r.sex, r.civil_status, r.contact_number, r.occupation, r.no_of_families, r.population, r.female_count, r.male_count])
  downloadCsv(headers, rows, 'household_records.csv')
}

const exportMembersCsv = () => {
  const headName = selectedHead.value ? `${selectedHead.value.lastname}_${selectedHead.value.firstname}` : 'members'
  const headers = ['Last Name','First Name','Middle Name','Relationship','Birthdate','Age','Sex','Civil Status','Education','Religion','Ethnicity','PhilHealth ID','4Ps Member','FP Method','Medical History','Water Source','Toilet Facility']
  const rows = filteredModalMembers.value.map(m => [
    m.lastname, m.firstname, m.middlename, m.relationship, m.birthdate, m.age,
    m.sex === 'M' ? 'Male' : m.sex === 'F' ? 'Female' : m.sex,
    m.civil_status, m.education, m.religion, m.ethnicity,
    m.philhealth_id || '', m.is_4ps_member ? 'Yes' : 'No',
    m.fp_method_used || '', m.medical_history || '', m.water_source || '', m.toilet_facility || ''
  ])
  downloadCsv(headers, rows, `${headName}_members.csv`)
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
          <button class="hs-btn hs-btn-primary" @click="exportCsv"><span class="mdi mdi-file-delimited-outline"></span> Export CSV</button>
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
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary hs-btn-sm" @click="initNewMember">
                <span class="mdi mdi-plus"></span> Add Member
              </button>
              <button class="hs-btn hs-btn-primary hs-btn-sm" @click="exportMembersCsv" title="Export members as CSV">
                <span class="mdi mdi-file-delimited-outline"></span> Export CSV
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
                        <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary hs-btn-sm" @click="editMemberRecord(m)" title="Edit">
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
                  <input v-model.number="newMember.age" type="number" class="hs-input hs-input--readonly" min="0" readonly>
                  <small v-if="newMember.birthdate" class="hs-form-hint" style="color: var(--hs-success);">
                    <span class="mdi mdi-check-circle"></span> Auto-calculated from birthdate
                  </small>
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
                  <select v-model="newMember.education" class="hs-select">
                    <option value="">Select</option>
                    <option value="Elementary">Elementary</option>
                    <option value="High School">High School</option>
                    <option value="College">College</option>
                    <option value="Vocational">Vocational</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Religion</label>
                  <select v-model="newMember.religion" class="hs-select">
                    <option value="">Select</option>
                    <option value="Catholic">Catholic</option>
                    <option value="Islam">Islam</option>
                    <option value="Protestant">Protestant</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Ethnicity</label>
                  <select v-model="newMember.ethnicity" class="hs-select">
                    <option value="">Select</option>
                    <option value="IP">IP</option>
                    <option value="Non-IP">Non-IP</option>
                  </select>
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
                  <select v-model="newMember.medical_history" class="hs-select">
                    <option value="">Select</option>
                    <option value="None">None</option>
                    <option value="HPN">Hypertension (HPN)</option>
                    <option value="DM">Diabetes Mellitus (DM)</option>
                    <option value="TB">Tuberculosis (TB)</option>
                    <option value="O">Others</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">FP Method Used</label>
                  <input v-model="newMember.fp_method_used" type="text" class="hs-input" placeholder="e.g. Pills, IUD...">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Water Source</label>
                  <select v-model="newMember.water_source" class="hs-select">
                    <option value="">Select</option>
                    <option value="Piped/Faucet">Piped/Faucet</option>
                    <option value="Well">Well</option>
                    <option value="Spring">Spring</option>
                    <option value="Rain">Rain</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Toilet Facility</label>
                  <select v-model="newMember.toilet_facility" class="hs-select">
                    <option value="">Select</option>
                    <option value="Water-sealed">Water-sealed</option>
                    <option value="Open pit">Open pit</option>
                    <option value="None">None</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <!-- Auto-Detected Eligible Services -->
              <div v-if="memberDetection.detectedTables.value.length > 0" class="svc-detection-panel" style="margin-top:16px;">
                <div class="svc-detection-header">
                  <span class="mdi mdi-clipboard-check-outline"></span>
                  <div>
                    <strong>Eligible Services (Auto-Detected)</strong>
                    <span class="svc-detection-hint">Based on age, sex, and civil status. Uncheck any you do not wish to enroll.</span>
                  </div>
                </div>
                <div v-for="tbl in memberDetection.detectedTables.value" :key="tbl.table" class="svc-table-card" :class="{ 'svc-table-card--disabled': !memberDetection.selectedTables[tbl.table] }">
                  <div class="svc-table-card-header" @click="memberDetection.toggleTable(tbl.table)">
                    <input type="checkbox" :checked="memberDetection.selectedTables[tbl.table]" @click.stop="memberDetection.toggleTable(tbl.table)" class="svc-table-check" />
                    <span class="mdi" :class="tbl.icon" :style="{ color: tbl.color, fontSize: '18px' }"></span>
                    <strong>{{ tbl.label }}</strong>
                    <span class="svc-table-badges">
                      <span v-for="svc in tbl.services" :key="svc.key" class="svc-badge">{{ svc.label }}</span>
                    </span>
                  </div>
                  <div v-if="memberDetection.selectedTables[tbl.table]" class="svc-table-card-body">
                    <template v-if="memberDetection.getVisibleFields(tbl.table, { age: newMember.age, sex: newMember.sex }).length > 0">
                      <div class="hs-form-row">
                        <template v-for="field in memberDetection.getVisibleFields(tbl.table, { age: newMember.age, sex: newMember.sex })" :key="field.key">
                          <div v-if="field.type === 'text'" class="hs-form-group">
                            <label class="hs-label">{{ field.label }}</label>
                            <input v-model="memberDetection.serviceFormData[tbl.table][field.key]" type="text" class="hs-input" />
                          </div>
                          <div v-else-if="field.type === 'date'" class="hs-form-group">
                            <label class="hs-label">{{ field.label }}</label>
                            <input v-model="memberDetection.serviceFormData[tbl.table][field.key]" type="date" class="hs-input" />
                          </div>
                          <div v-else-if="field.type === 'select'" class="hs-form-group">
                            <label class="hs-label">{{ field.label }}</label>
                            <select v-model="memberDetection.serviceFormData[tbl.table][field.key]" class="hs-select">
                              <option value="">Select</option>
                              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                            </select>
                          </div>
                          <div v-else-if="field.type === 'checkbox'" class="hs-form-group" style="display:flex;align-items:flex-end;padding-bottom:10px;">
                            <label class="hs-checkbox-label">
                              <input type="checkbox" v-model="memberDetection.serviceFormData[tbl.table][field.key]" />
                              {{ field.label }}
                            </label>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>
                </div>
              </div>

              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showAddMemberModal = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary">
                  <span class="mdi mdi-plus"></span> Add Member
                  <span v-if="memberDetection.detectedTables.value.length > 0" style="font-size:11px;opacity:0.85;margin-left:4px;">
                    + {{ memberDetection.detectedTables.value.filter(t => memberDetection.selectedTables[t.table]).length }} service(s)
                  </span>
                </button>
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
                  <input v-model.number="editingMember.age" type="number" class="hs-input hs-input--readonly" readonly>
                  <small v-if="editingMember.birthdate" class="hs-form-hint" style="color: var(--hs-success);">
                    <span class="mdi mdi-check-circle"></span> Auto-calculated from birthdate
                  </small>
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
                  <select v-model="editingMember.education" class="hs-select">
                    <option value="">Select</option>
                    <option value="Elementary">Elementary</option>
                    <option value="High School">High School</option>
                    <option value="College">College</option>
                    <option value="Vocational">Vocational</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Religion</label>
                  <select v-model="editingMember.religion" class="hs-select">
                    <option value="">Select</option>
                    <option value="Catholic">Catholic</option>
                    <option value="Islam">Islam</option>
                    <option value="Protestant">Protestant</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Ethnicity</label>
                  <select v-model="editingMember.ethnicity" class="hs-select">
                    <option value="">Select</option>
                    <option value="IP">IP</option>
                    <option value="Non-IP">Non-IP</option>
                  </select>
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
                  <select v-model="editingMember.medical_history" class="hs-select">
                    <option value="">Select</option>
                    <option value="None">None</option>
                    <option value="HPN">Hypertension (HPN)</option>
                    <option value="DM">Diabetes Mellitus (DM)</option>
                    <option value="TB">Tuberculosis (TB)</option>
                    <option value="O">Others</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">FP Method Used</label>
                  <input v-model="editingMember.fp_method_used" type="text" class="hs-input" placeholder="e.g. Pills, IUD...">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Water Source</label>
                  <select v-model="editingMember.water_source" class="hs-select">
                    <option value="">Select</option>
                    <option value="Piped/Faucet">Piped/Faucet</option>
                    <option value="Well">Well</option>
                    <option value="Spring">Spring</option>
                    <option value="Rain">Rain</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Toilet Facility</label>
                  <select v-model="editingMember.toilet_facility" class="hs-select">
                    <option value="">Select</option>
                    <option value="Water-sealed">Water-sealed</option>
                    <option value="Open pit">Open pit</option>
                    <option value="None">None</option>
                    <option value="Other">Other</option>
                  </select>
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

/* Service Detection Panel */
.svc-detection-panel { margin: 16px 0; padding: 16px; background: linear-gradient(135deg, #f0f7ff 0%, #f5f0ff 100%); border-radius: 10px; border: 1px solid #d0e3ff; }
.svc-detection-header { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; color: var(--hs-primary); }
.svc-detection-header > .mdi { font-size: 20px; margin-top: 1px; }
.svc-detection-header strong { display: block; font-size: 13px; margin-bottom: 2px; }
.svc-detection-hint { display: block; font-size: 11px; color: var(--hs-gray-500); font-weight: 400; }
.svc-table-card { background: var(--hs-white); border: 1px solid var(--hs-gray-100); border-radius: var(--hs-radius-lg); margin-bottom: 8px; overflow: hidden; transition: opacity 150ms ease, border-color 150ms ease; }
.svc-table-card:last-child { margin-bottom: 0; }
.svc-table-card--disabled { opacity: 0.55; border-color: var(--hs-gray-100); }
.svc-table-card-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; user-select: none; transition: background 100ms ease; }
.svc-table-card-header:hover { background: var(--hs-gray-50); }
.svc-table-card-header strong { font-size: var(--hs-font-size-sm); color: var(--hs-gray-800); }
.svc-table-check { width: 16px; height: 16px; cursor: pointer; accent-color: var(--hs-primary); flex-shrink: 0; }
.svc-table-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-left: auto; }
.svc-badge { display: inline-block; padding: 2px 8px; background: var(--hs-primary-bg); color: var(--hs-primary); border-radius: 10px; font-size: 10px; font-weight: 500; white-space: nowrap; }
.svc-table-card-body { padding: 8px 14px 14px; border-top: 1px solid var(--hs-gray-100); background: var(--hs-gray-50); }
</style>
