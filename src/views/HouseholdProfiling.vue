<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { supabase } from '@/utils/supabase.js'
import { calculateAge, getAgeGroupLabel } from '@/utils/ageClassification'
import { useServiceDetection } from '@/composables/useServiceDetection'
import { getEligibleServices } from '@/utils/serviceEligibility'

const toast = useToast()
const router = useRouter()
const showRecords = ref(false)
const activeMenu = ref('')
const showModal = ref(false)
const modalType = ref('')
const userRole = ref('')
const userBarangay = ref('')

const profilingTab = ref('services')

const householdHeads = ref([])
const selectedHeadId = ref('')
const headSearchQuery = ref('')
const showHeadDropdown = ref(false)
const loadingHeads = ref(false)

const barangay = ref('')
const purok = ref('')
const lastname = ref('')
const firstname = ref('')
const middlename = ref('')
const suffix = ref('')
const age = ref('')
const birthdate = ref('')
const civilStatus = ref('')

const headBarangay = ref('')
const headPurok = ref('')
const headLastname = ref('')
const headFirstname = ref('')
const headMiddlename = ref('')
const headSuffix = ref('')
const headFamilyCount = ref('')
const headBirthdate = ref('')
const headAge = ref('')
const headSex = ref('')
const headCivilStatus = ref('')
const headContactNumber = ref('')
const headOccupation = ref('')

const dateVisit = ref('')
const householdNo = ref('')
const relationship = ref('')
const sex = ref('')
const education = ref('')
const religion = ref('')
const ethnicity = ref('')
const is4psMember = ref('')
const householdId4ps = ref('')
const philhealthId = ref('')
const membershipType = ref('')
const philhealthCategory = ref('')
const medicalHistory = ref('')
const ageGroup = ref('')
const lmp = ref('')
const usingFpMethod = ref('')
const fpMethodUsed = ref('')
const fpStatus = ref('')
const waterSource = ref('')
const toiletFacility = ref('')

const members = ref([
  {
    barangay: '',
    purok: '',
    dateVisit: '',
    householdNo: '',
    lastname: '',
    firstname: '',
    middlename: '',
    suffix: '',
    relationship: '',
    birthdate: '',
    age: '',
    sex: '',
    civilStatus: '',
    education: '',
    religion: '',
    ethnicity: '',
    is4psMember: '',
    householdId4ps: '',
    philhealthId: '',
    membershipType: '',
    philhealthCategory: '',
    medicalHistory: '',
    ageGroup: '',
    lmp: '',
    usingFpMethod: '',
    fpMethodUsed: '',
    fpStatus: '',
    waterSource: '',
    toiletFacility: ''
  }
])

// Service detection composables
const memberDetection = useServiceDetection()
const headDetection = useServiceDetection()

// Additional member form fields for service detection
const isPregnant = ref(false)

// Computed: purok from selected household head (for member service inserts)
const selectedHeadPurok = computed(() => {
  if (!selectedHeadId.value) return ''
  const head = householdHeads.value.find(h => h.head_id === selectedHeadId.value)
  return head?.purok || ''
})

// Member form watchers — auto-calculate age, classify, and detect services
watch(birthdate, (newVal) => {
  if (newVal) {
    const calculatedAge = calculateAge(newVal)
    age.value = calculatedAge !== null && calculatedAge >= 0 ? calculatedAge : ''
    ageGroup.value = getAgeGroupLabel(newVal)
    memberDetection.detectServices({
      birthdate: newVal,
      sex: sex.value,
      civil_status: civilStatus.value,
      lmp: lmp.value,
      is_pregnant: isPregnant.value,
    })
  } else {
    age.value = ''
    ageGroup.value = ''
    memberDetection.resetDetection()
  }
})

watch([sex, civilStatus, lmp, isPregnant], () => {
  if (birthdate.value) {
    memberDetection.detectServices({
      birthdate: birthdate.value,
      sex: sex.value,
      civil_status: civilStatus.value,
      lmp: lmp.value,
      is_pregnant: isPregnant.value,
    })
  }
})

// Head form watchers — auto-calculate age and detect services
watch(() => headBirthdate.value, (newVal) => {
  if (newVal) {
    const calc = calculateAge(newVal)
    headAge.value = calc !== null && calc >= 0 ? calc : ''
    headDetection.detectServices({
      birthdate: newVal,
      sex: headSex.value,
      civil_status: headCivilStatus.value,
    })
  } else {
    headAge.value = ''
    headDetection.resetDetection()
  }
})

watch([headSex, headCivilStatus], () => {
  if (headBirthdate.value) {
    headDetection.detectServices({
      birthdate: headBirthdate.value,
      sex: headSex.value,
      civil_status: headCivilStatus.value,
    })
  }
})

const filteredHeads = computed(() => {
  if (!headSearchQuery.value) return householdHeads.value
  const q = headSearchQuery.value.toLowerCase()
  return householdHeads.value.filter((h) => {
    const label = `${h.lastname}, ${h.firstname} — ${h.purok || 'N/A'} (Head ID: ${h.head_id})`
    return label.toLowerCase().includes(q)
  })
})

const selectedHeadLabel = computed(() => {
  if (!selectedHeadId.value) return ''
  const head = householdHeads.value.find((h) => h.head_id === selectedHeadId.value)
  if (!head) return ''
  return `${head.lastname}, ${head.firstname} — ${head.purok || 'N/A'} (Head ID: ${head.head_id})`
})

const fetchHouseholdHeads = async () => {
  loadingHeads.value = true
  try {
    const { data, error } = await supabase
      .from('household_heads')
      .select('head_id, lastname, firstname, purok, barangay')
      .eq('barangay', userBarangay.value)
      .eq('is_archived', false)
      .order('lastname', { ascending: true })

    if (error) throw error
    householdHeads.value = data || []
  } catch (err) {
    console.error('Error fetching household heads:', err)
    householdHeads.value = []
  } finally {
    loadingHeads.value = false
  }
}

const selectHead = (head) => {
  selectedHeadId.value = head.head_id
  headSearchQuery.value = `${head.lastname}, ${head.firstname} — ${head.purok || 'N/A'} (Head ID: ${head.head_id})`
  showHeadDropdown.value = false
}

const clearHeadSelection = () => {
  selectedHeadId.value = ''
  headSearchQuery.value = ''
  showHeadDropdown.value = false
}

const onHeadSearchFocus = () => {
  showHeadDropdown.value = true
  if (selectedHeadId.value) {
    headSearchQuery.value = ''
  }
}

const onHeadSearchBlur = () => {
  setTimeout(() => {
    showHeadDropdown.value = false
    if (selectedHeadId.value && !headSearchQuery.value) {
      headSearchQuery.value = selectedHeadLabel.value
    }
  }, 200)
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  userRole.value = user?.user_metadata?.role || ''
  userBarangay.value = user?.user_metadata?.barangay || ''
  barangay.value = userBarangay.value
  headBarangay.value = userBarangay.value
  // Admin defaults to directory tab (no services tab for admin)
  if (userRole.value === 'Admin') {
    profilingTab.value = 'directory'
  }
})

const goPrevPage = () => router.push('/home')
const goNextPage = () => router.push('/maternalservices')
const toggleRecords = () => (showRecords.value = !showRecords.value)
const openMenu = (type) => (activeMenu.value = type)
const closeMenu = () => (activeMenu.value = '')
const fillIn = async (type) => {
  modalType.value = type
  showModal.value = true
  closeMenu()

  if (type === 'household') {
    await fetchHouseholdHeads()
  }
}
const viewRecords = (type) => {
  if (type === 'head') router.push('/hhpsrecords')
  closeMenu()
}
const closeModal = () => {
  showModal.value = false
  showHeadDropdown.value = false
}

// Normalize sex value to single character for DB char(1) column
const normalizeSex = (val) => {
  if (!val) return null
  const v = val.toString().trim().toLowerCase()
  if (v === 'male' || v === 'm') return 'M'
  if (v === 'female' || v === 'f') return 'F'
  return val
}

const saveHead = async () => {
  try {
    const headPayload = {
      barangay: headBarangay.value,
      purok: headPurok.value,
      lastname: headLastname.value,
      firstname: headFirstname.value,
      middlename: headMiddlename.value,
      suffix: headSuffix.value,
      no_of_families: headFamilyCount.value ? parseInt(headFamilyCount.value) : null,
      birthdate: headBirthdate.value || null,
      age: headAge.value ? parseInt(headAge.value) : null,
      sex: normalizeSex(headSex.value),
      civil_status: headCivilStatus.value || null,
      contact_number: headContactNumber.value || null,
      occupation: headOccupation.value || null,
      population: null,
      female_count: null,
      male_count: null,
    }

    const { data, error } = await supabase.from('household_heads').insert([headPayload])

    if (error) {
      console.error('[saveHead] Supabase error:', error.code, error.message, '\nPayload:', JSON.stringify(headPayload, null, 2))
      throw error
    }

    // Insert detected service records
    const baseData = {
      purok: headPurok.value,
      lastname: headLastname.value,
      firstname: headFirstname.value,
      middlename: headMiddlename.value,
      suffix: headSuffix.value,
      birthdate: headBirthdate.value,
      age: headAge.value,
      sex: headSex.value,
      civil_status: headCivilStatus.value,
    }
    const servicePayloads = headDetection.buildPayloads(baseData)
    const serviceErrors = []

    for (const sp of servicePayloads) {
      const { error: svcErr } = await supabase.from(sp.table).insert([sp.payload])
      if (svcErr) {
        console.error(`Failed to insert ${sp.label}:`, svcErr)
        serviceErrors.push(sp.label)
      }
    }

    if (serviceErrors.length > 0) {
      toast.warning(`Head saved, but some service records failed: ${serviceErrors.join(', ')}`)
    } else if (servicePayloads.length > 0) {
      toast.success(`Household head saved with ${servicePayloads.length} service record(s)!`)
    } else {
      toast.success('Household head saved successfully!')
    }

    // Notify admin about new household head
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const bhwName = user?.user_metadata?.full_name || 'A BHW'
      await supabase.from('notifications').insert([{
        target_role: 'Admin',
        type: 'bhw_creation',
        title: `New household head: ${headFirstname.value} ${headLastname.value}`,
        message: `${bhwName} registered a new household head in ${headBarangay.value}`,
        icon: 'mdi-account-plus',
        color: 'var(--hs-success)',
        link: '/hhpsrecords',
        created_by: user?.id || null,
      }])
    } catch { /* non-critical */ }

    closeModal()
    headDetection.resetDetection()

    headBarangay.value = userBarangay.value
    headPurok.value = ''
    headLastname.value = ''
    headFirstname.value = ''
    headMiddlename.value = ''
    headSuffix.value = ''
    headFamilyCount.value = ''
    headBirthdate.value = ''
    headAge.value = ''
    headSex.value = ''
    headCivilStatus.value = ''
    headContactNumber.value = ''
    headOccupation.value = ''
  } catch (err) {
    console.error('[saveHead] Error:', err?.code, err?.message, err)
    toast.error(`Error saving household head: ${err?.message || 'Unknown error'}`)
  }
}

const saveHousehold = async () => {
  try {
    if (!selectedHeadId.value) {
      toast.warning('Please select a Household Head from the dropdown.')
      return
    }

    const memberPayload = {
      head_id: selectedHeadId.value,
      barangay: barangay.value,
      date_visit: dateVisit.value || null,
      relationship: relationship.value,
      lastname: lastname.value,
      firstname: firstname.value,
      middlename: middlename.value,
      suffix: suffix.value,
      birthdate: birthdate.value || null,
      age: age.value !== '' ? parseInt(age.value) : null,
      sex: normalizeSex(sex.value),
      civil_status: civilStatus.value,
      education: education.value,
      religion: religion.value,
      ethnicity: ethnicity.value,
      is_4ps_member: is4psMember.value === 'Yes',
      household_id_4ps: householdId4ps.value,
      philhealth_id: philhealthId.value,
      membership_type: membershipType.value,
      philhealth_category: philhealthCategory.value,
      medical_history: medicalHistory.value,
      age_group: ageGroup.value,
      lmp: lmp.value || null,
      using_fp_method: usingFpMethod.value === 'Yes',
      fp_method_used: fpMethodUsed.value,
      fp_status: fpStatus.value,
      water_source: waterSource.value,
      toilet_facility: toiletFacility.value,
      is_pregnant: isPregnant.value,
    }

    const { data, error } = await supabase.from('household_members').insert([memberPayload])

    if (error) {
      console.error('[saveMember] Supabase error:', error.code, error.message, '\nPayload:', JSON.stringify(memberPayload, null, 2))
      throw error
    }

    // Insert detected service records
    const memberPurok = selectedHeadPurok.value || purok.value || ''
    const baseData = {
      purok: memberPurok,
      lastname: lastname.value,
      firstname: firstname.value,
      middlename: middlename.value,
      suffix: suffix.value,
      birthdate: birthdate.value,
      age: age.value,
      sex: sex.value,
      civil_status: civilStatus.value,
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
      toast.warning(`Member saved, but some service records failed: ${serviceErrors.join(', ')}`)
    } else if (servicePayloads.length > 0) {
      toast.success(`Household member saved with ${servicePayloads.length} service record(s)!`)
    } else {
      toast.success('Household member saved successfully!')
    }

    // Notify admin about new household member
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const bhwName = currentUser?.user_metadata?.full_name || 'A BHW'
      await supabase.from('notifications').insert([{
        target_role: 'Admin',
        type: 'bhw_creation',
        title: `New member: ${firstname.value} ${lastname.value}`,
        message: `${bhwName} added a new household member in ${barangay.value}`,
        icon: 'mdi-account-plus-outline',
        color: 'var(--hs-primary)',
        link: '/hhpsrecords',
        created_by: currentUser?.id || null,
      }])
    } catch { /* non-critical */ }

    closeModal()
    memberDetection.resetDetection()

    selectedHeadId.value = ''
    headSearchQuery.value = ''
    dateVisit.value = ''
    householdNo.value = ''
    barangay.value = userBarangay.value
    purok.value = ''
    lastname.value = ''
    firstname.value = ''
    middlename.value = ''
    suffix.value = ''
    relationship.value = ''
    birthdate.value = ''
    age.value = ''
    sex.value = ''
    civilStatus.value = ''
    education.value = ''
    religion.value = ''
    ethnicity.value = ''
    is4psMember.value = ''
    householdId4ps.value = ''
    philhealthId.value = ''
    membershipType.value = ''
    philhealthCategory.value = ''
    medicalHistory.value = ''
    ageGroup.value = ''
    lmp.value = ''
    usingFpMethod.value = ''
    fpMethodUsed.value = ''
    fpStatus.value = ''
    waterSource.value = ''
    toiletFacility.value = ''
    isPregnant.value = false
  } catch (err) {
    console.error('[saveMember] Error:', err?.code, err?.message, err)
    toast.error(`Error saving member: ${err?.message || 'Unknown error'}`)
  }
}

// Directory Tab
const directoryHeads = ref([])
const directoryMembers = ref({})
const expandedHeadIds = ref([])
const loadingDirectory = ref(false)
const directorySearch = ref('')

const filteredDirectoryHeads = computed(() => {
  if (!directorySearch.value.trim()) return directoryHeads.value
  const q = directorySearch.value.toLowerCase()
  return directoryHeads.value.filter(h => {
    const text = `${h.head_id} ${h.lastname} ${h.firstname} ${h.middlename || ''} ${h.purok || ''}`.toLowerCase()
    if (text.includes(q)) return true
    const members = directoryMembers.value[h.head_id] || []
    return members.some(m => `${m.lastname} ${m.firstname} ${m.middlename || ''}`.toLowerCase().includes(q))
  })
})

// Flat list of members matching search (shown when searching)
const filteredDirectoryMembersList = computed(() => {
  if (!directorySearch.value.trim()) return []
  const q = directorySearch.value.toLowerCase()
  const results = []
  for (const h of directoryHeads.value) {
    const members = directoryMembers.value[h.head_id] || []
    for (const m of members) {
      if (`${m.lastname} ${m.firstname} ${m.middlename || ''}`.toLowerCase().includes(q)) {
        results.push({ ...m, _head: h })
      }
    }
  }
  return results
})

const isDirectorySearchActive = computed(() => !!directorySearch.value.trim())

const loadDirectory = async () => {
  loadingDirectory.value = true
  try {
    const { data: heads, error: hErr } = await supabase.from('household_heads')
      .select('*')
      .eq('barangay', userBarangay.value)
      .eq('is_archived', false)
      .order('lastname', { ascending: true })
    if (hErr) throw hErr
    directoryHeads.value = heads || []

    const headIds = directoryHeads.value.map(h => h.head_id)
    if (headIds.length > 0) {
      const { data: members, error: mErr } = await supabase.from('household_members')
        .select('*')
        .in('head_id', headIds)
        .order('lastname', { ascending: true })
      if (mErr) throw mErr
      const grouped = {}
      for (const m of members || []) {
        if (!grouped[m.head_id]) grouped[m.head_id] = []
        grouped[m.head_id].push(m)
      }
      directoryMembers.value = grouped
    }

    // Load enrolled records for duplicate detection
    await loadEnrolledRecords()
  } catch (err) {
    console.error('Failed to load directory', err)
    toast.error('Failed to load directory data.')
  } finally {
    loadingDirectory.value = false
  }
}

const toggleHead = (headId) => {
  const idx = expandedHeadIds.value.indexOf(headId)
  if (idx >= 0) expandedHeadIds.value.splice(idx, 1)
  else expandedHeadIds.value.push(headId)
}

// View Details modals
const showHeadDetailModal = ref(false)
const headDetailItem = ref(null)
const showMemberDetailModal = ref(false)
const memberDetailItem = ref(null)
const memberDetailHead = ref(null)

const openHeadDetail = (head) => {
  headDetailItem.value = head
  showHeadDetailModal.value = true
}
const openMemberDetail = (member, head) => {
  memberDetailItem.value = member
  memberDetailHead.value = head || null
  showMemberDetailModal.value = true
}
const fmtDetailDate = (val) => {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Edit modals for directory
const showEditHeadModal = ref(false)
const editHeadForm = ref({})
const showEditMemberModal = ref(false)
const editMemberForm = ref({})
const editMemberHeadRef = ref(null)

const openEditHead = (head) => {
  editHeadForm.value = { ...head }
  showEditHeadModal.value = true
}
const openEditMember = (member, head) => {
  editMemberForm.value = { ...member }
  editMemberHeadRef.value = head || null
  showEditMemberModal.value = true
}

// Auto-calculate age for edit head form
watch(() => editHeadForm.value.birthdate, (val) => {
  if (val && showEditHeadModal.value) {
    const calc = calculateAge(val)
    editHeadForm.value.age = calc !== null && calc >= 0 ? calc : editHeadForm.value.age
  }
})
// Auto-calculate age for edit member form
watch(() => editMemberForm.value.birthdate, (val) => {
  if (val && showEditMemberModal.value) {
    const calc = calculateAge(val)
    editMemberForm.value.age = calc !== null && calc >= 0 ? calc : editMemberForm.value.age
  }
})

const saveEditHead = async () => {
  try {
    if (!editHeadForm.value.firstname || !editHeadForm.value.lastname) {
      toast.warning('First name and last name are required.')
      return
    }
    const { head_id, created_at: _ca, is_archived: _ia, archived_at: _aa, ...updates } = editHeadForm.value
    // Normalize sex
    if (updates.sex === 'Male') updates.sex = 'M'
    else if (updates.sex === 'Female') updates.sex = 'F'
    if (updates.age !== '' && updates.age != null) updates.age = parseInt(updates.age)
    else updates.age = null
    if (!updates.birthdate) updates.birthdate = null
    if (updates.no_of_families) updates.no_of_families = parseInt(updates.no_of_families)

    const { error } = await supabase.from('household_heads').update(updates).eq('head_id', head_id)
    if (error) throw error

    toast.success('Household head updated.')
    showEditHeadModal.value = false
    await loadDirectory()
  } catch (e) {
    console.error(e)
    toast.error('Error updating head: ' + (e.message || e))
  }
}

const saveEditMember = async () => {
  try {
    if (!editMemberForm.value.firstname || !editMemberForm.value.lastname) {
      toast.warning('First name and last name are required.')
      return
    }
    const { member_id, created_at: _ca2, is_archived: _ia2, archived_at: _aa2, head_id: _hid, ...updates } = editMemberForm.value
    // Normalize sex
    if (updates.sex === 'Male') updates.sex = 'M'
    else if (updates.sex === 'Female') updates.sex = 'F'
    if (updates.age !== '' && updates.age != null) updates.age = parseInt(updates.age)
    else updates.age = null
    if (!updates.birthdate) updates.birthdate = null

    const { error } = await supabase.from('household_members').update(updates).eq('member_id', member_id)
    if (error) throw error

    toast.success('Member updated.')
    showEditMemberModal.value = false
    await loadDirectory()
  } catch (e) {
    console.error(e)
    toast.error('Error updating member: ' + (e.message || e))
  }
}

watch(profilingTab, (val) => {
  if (val === 'directory' && directoryHeads.value.length === 0) {
    loadDirectory()
  }
})

// Quick-Add Record
const showRecordSelector = ref(false)
const quickAddPerson = ref(null)
const selectedRecordType = ref('')
const showQuickAddForm = ref(false)
const quickAddForm = ref({})
const savingQuickAdd = ref(false)

const recordTypeOptions = [
  { value: 'wra', label: 'WRA Record', icon: 'mdi-human-female', desc: 'Women of Reproductive Age', table: 'wra_records' },
  { value: 'cervical', label: 'Cervical Screening', icon: 'mdi-shield-check', desc: 'Cervical Cancer Screening', table: 'cervical_screening_records' },
  { value: 'familyplanning', label: 'Family Planning', icon: 'mdi-account-heart', desc: 'Family Planning Services', table: 'family_planning_records' },
  { value: 'childcare', label: 'Childcare (Vitamin A)', icon: 'mdi-baby-face-outline', desc: 'Vitamin A Supplementation', table: 'childcare_vitamina_records' },
  { value: 'deworming', label: 'Deworming', icon: 'mdi-medical-bag', desc: 'Preventive Health / Deworming', table: 'deworming_records' },
]

// Enrolled-record lookup (same pattern as ServiceEligibility.vue)
const enrolledLookup = ref(new Set())

function makeEnrolledKey(firstname, lastname, table) {
  return `${(firstname || '').trim().toLowerCase()}|${(lastname || '').trim().toLowerCase()}|${table}`
}

function isRecordEnrolled(person, table) {
  const fn = person.firstname || person.data?.firstname || ''
  const ln = person.lastname || person.data?.lastname || ''
  return enrolledLookup.value.has(makeEnrolledKey(fn, ln, table))
}

async function loadEnrolledRecords() {
  const lookup = new Set()
  const tableConfigs = [
    { table: 'childcare_vitamina_records', fnCol: 'firstname', lnCol: 'lastname' },
    { table: 'deworming_records', fnCol: 'firstname', lnCol: 'lastname' },
    { table: 'wra_records', fnCol: 'firstname', lnCol: 'lastname' },
    { table: 'cervical_screening_records', fnCol: 'firstname', lnCol: 'lastname' },
    { table: 'family_planning_records', fnCol: 'firstname', lnCol: 'surname' },
  ]
  const queries = tableConfigs.map(async ({ table, fnCol, lnCol }) => {
    try {
      const { data, error } = await supabase.from(table).select(`${fnCol}, ${lnCol}`)
      if (error) { console.warn(`[enrolled] ${table}:`, error.message); return }
      for (const row of data || []) {
        lookup.add(makeEnrolledKey(row[fnCol], row[lnCol], table))
      }
    } catch (err) { console.warn(`[enrolled] ${table}:`, err) }
  })
  await Promise.all(queries)
  enrolledLookup.value = lookup
}

// Compute eligible record types for the currently selected person
const eligibleRecordTypes = ref([])

function computeEligibleRecordTypes(person) {
  const eligible = getEligibleServices(person)
  // Map eligible service tables → record type option values
  const eligibleTables = new Set(eligible.map(e => e.table))
  eligibleRecordTypes.value = recordTypeOptions.filter(opt => eligibleTables.has(opt.table))
}

function onRecordTypeClick(opt) {
  if (isRecordEnrolled(quickAddPerson.value?.data, opt.table)) {
    toast.warning(`${quickAddPerson.value?.data?.firstname} ${quickAddPerson.value?.data?.lastname} already has a ${opt.label} record.`)
    return
  }
  selectedRecordType.value = opt.value
}

const openRecordSelector = (person, type, headPurok) => {
  quickAddPerson.value = { type, data: { ...person }, headPurok: headPurok || person.purok || '' }
  selectedRecordType.value = ''
  computeEligibleRecordTypes(person)
  showRecordSelector.value = true
}

const proceedToForm = () => {
  if (!selectedRecordType.value) { toast.warning('Please select a record type.'); return }
  showRecordSelector.value = false

  const p = quickAddPerson.value.data
  const purok = quickAddPerson.value.headPurok

  if (selectedRecordType.value === 'wra') {
    quickAddForm.value = {
      purok: purok, lastname: p.lastname || '', firstname: p.firstname || '',
      middlename: p.middlename || '', suffix: p.suffix || '',
      age: p.age != null ? p.age : '', birthdate: p.birthdate || '',
      seStatus: '', civilStatus: p.civil_status || '',
      planoManganak: '', karun: false, spacing: false, limiting: false,
      fecund: false, infecund: false,
      fbMethod: '', fbType: '', fbDate: '', changeMethod: ''
    }
  } else if (selectedRecordType.value === 'cervical') {
    quickAddForm.value = {
      purok: purok, lastname: p.lastname || '', firstname: p.firstname || '',
      middlename: p.middlename || '', suffix: p.suffix || '',
      age: p.age != null ? p.age : '', birthdate: p.birthdate || '',
      screened: ''
    }
  } else if (selectedRecordType.value === 'familyplanning') {
    quickAddForm.value = {
      purok: purok, surname: p.lastname || '', firstname: p.firstname || '',
      motherName: '', sex: p.sex || '', birthday: p.birthdate || '',
      age: p.age != null ? p.age : ''
    }
  } else if (selectedRecordType.value === 'childcare') {
    quickAddForm.value = {
      purok: purok, lastname: p.lastname || '', firstname: p.firstname || '',
      middlename: p.middlename || '', suffix: p.suffix || '',
      age: p.age != null ? p.age : '', birthdate: p.birthdate || '',
      gender: p.sex || '', motherName: ''
    }
  } else if (selectedRecordType.value === 'deworming') {
    quickAddForm.value = {
      purok: purok, lastname: p.lastname || '', firstname: p.firstname || '',
      middlename: p.middlename || '', motherName: '',
      sex: p.sex || '', birthday: p.birthdate || '',
      age: p.age != null ? p.age : ''
    }
  }

  showQuickAddForm.value = true
}

const saveQuickAddRecord = async () => {
  savingQuickAdd.value = true
  const labels = { wra: 'WRA', cervical: 'Cervical Screening', familyplanning: 'Family Planning', childcare: 'Childcare', deworming: 'Deworming' }
  try {
    const f = quickAddForm.value
    let table, payload

    if (selectedRecordType.value === 'wra') {
      table = 'wra_records'
      payload = {
        purok: f.purok, lastname: f.lastname, firstname: f.firstname,
        middlename: f.middlename, suffix: f.suffix,
        age: f.age !== '' ? parseInt(f.age) : null,
        birthdate: f.birthdate || null, se_status: f.seStatus,
        civil_status: f.civilStatus, plano_manganak: f.planoManganak,
        karun: f.karun, spacing: f.spacing, limiting: f.limiting,
        fecund: f.fecund, infecund: f.infecund,
        fb_method: f.fbMethod, fb_type: f.fbType,
        fb_date: f.fbDate || null, change_method: f.changeMethod
      }
    } else if (selectedRecordType.value === 'cervical') {
      table = 'cervical_screening_records'
      payload = {
        purok: f.purok, lastname: f.lastname, firstname: f.firstname,
        middlename: f.middlename, suffix: f.suffix,
        age: f.age !== '' ? parseInt(f.age) : null,
        birthdate: f.birthdate || null, screened: f.screened
      }
    } else if (selectedRecordType.value === 'familyplanning') {
      table = 'family_planning_records'
      payload = {
        purok: f.purok, surname: f.surname, firstname: f.firstname,
        mother_name: f.motherName, sex: normalizeSex(f.sex),
        birthday: f.birthday || null,
        age: f.age !== '' ? parseInt(f.age) : null
      }
    } else if (selectedRecordType.value === 'childcare') {
      table = 'childcare_vitamina_records'
      payload = {
        purok: f.purok, lastname: f.lastname, firstname: f.firstname,
        middlename: f.middlename, suffix: f.suffix,
        age: f.age !== '' ? parseInt(f.age) : null,
        birthdate: f.birthdate || null, gender: f.gender,
        mother_name: f.motherName
      }
    } else if (selectedRecordType.value === 'deworming') {
      table = 'deworming_records'
      payload = {
        purok: f.purok, lastname: f.lastname, firstname: f.firstname,
        middlename: f.middlename, mother_name: f.motherName,
        sex: f.sex, birthday: f.birthday || null,
        age: f.age !== '' ? parseInt(f.age) : null
      }
    }

    // Duplicate check before insert
    const personData = quickAddPerson.value?.data
    if (personData && isRecordEnrolled(personData, table)) {
      toast.warning(`This person already has a ${labels[selectedRecordType.value]} record. Duplicate not allowed.`)
      savingQuickAdd.value = false
      return
    }

    const { error } = await supabase.from(table).insert([payload])
    if (error) {
      console.error(`[quickAdd] Supabase error for ${table}:`, error.code, error.message, '\nPayload:', JSON.stringify(payload, null, 2))
      throw error
    }

    // Update enrolled lookup so repeating the add will show gray
    const fn = personData?.firstname || f.firstname || ''
    const ln = personData?.lastname || f.lastname || f.surname || ''
    enrolledLookup.value.add(makeEnrolledKey(fn, ln, table))

    toast.success(`${labels[selectedRecordType.value]} record saved successfully!`)
    showQuickAddForm.value = false
  } catch (err) {
    console.error('[quickAdd] Error:', err?.code, err?.message, err)
    toast.error(`Failed to save record: ${err?.message || err}`)
  } finally {
    savingQuickAdd.value = false
  }
}
</script>

<template>
    <div class="service-page">
      <!-- Page Header -->
      <div class="hs-page-header">
        <div class="hs-breadcrumb">
          <a href="#" @click.prevent="goPrevPage">Dashboard</a>
          <span class="separator">/</span>
          <span class="current">Household Profiling</span>
        </div>
        <h1>Household Profiling Services</h1>
        <p class="hs-module-desc">Manage household head information and family members within the barangay.</p>
        <p>Gather and organize essential information about families in the community</p>
      </div>

      <!-- Tab Navigation -->
      <div class="hs-tabs">
        <button v-if="userRole === 'BHW'" class="hs-tab" :class="{ active: profilingTab === 'services' }" @click="profilingTab = 'services'">
          <span class="mdi mdi-clipboard-text-outline"></span> Services
        </button>
        <button class="hs-tab" :class="{ active: profilingTab === 'directory' }" @click="profilingTab = 'directory'">
          <span class="mdi mdi-account-group"></span> Members &amp; Heads Directory
        </button>
      </div>

      <!-- Services Tab -->
      <div v-if="profilingTab === 'services'">
      <!-- Action Cards -->
      <div class="service-cards">
        <div class="hs-card service-action-card">
          <div class="hs-card-body svc-hero">
            <div class="hs-stat-icon hs-stat-icon-primary svc-hero-icon">
              <span class="mdi mdi-account-multiple-plus"></span>
            </div>
            <h3 class="svc-hero-title">Household Member Profiling</h3>
            <p class="svc-hero-desc">Add individual household member records and profiling data</p>
            <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary" @click="fillIn('household')">
              <span class="mdi mdi-plus"></span> Fill In Form
            </button>
          </div>
        </div>

        <div class="hs-card service-action-card">
          <div class="hs-card-body svc-hero">
            <div class="hs-stat-icon hs-stat-icon-info svc-hero-icon">
              <span class="mdi mdi-home-account"></span>
            </div>
            <h3 class="svc-hero-title">Household Head Profiling</h3>
            <p class="svc-hero-desc">Register and manage household head information</p>
            <div class="svc-hero-actions">
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary" @click="fillIn('head')">
                <span class="mdi mdi-plus"></span> Fill In
              </button>
              <button class="hs-btn hs-btn-secondary" @click="viewRecords('head')">
                <span class="mdi mdi-eye-outline"></span> View Records
              </button>
            </div>
          </div>
        </div>
      </div>
      </div><!-- end services tab -->

      <!-- Directory Tab -->
      <div v-if="profilingTab === 'directory'">
        <div class="inv-toolbar">
          <div class="inv-toolbar-left">
            <div class="hs-search-box">
              <span class="mdi mdi-magnify"></span>
              <input v-model="directorySearch" type="search" placeholder="Search..." />
            </div>
          </div>
          <div class="inv-toolbar-right">
            <span class="inv-count-label">{{ isDirectorySearchActive ? filteredDirectoryMembersList.length + ' member(s)' : filteredDirectoryHeads.length + ' household(s)' }}</span>
            <button class="hs-btn hs-btn-secondary" @click="loadDirectory">
              <span class="mdi mdi-refresh"></span> Refresh
            </button>
          </div>
        </div>

        <div v-if="loadingDirectory" class="dir-loading">
          <span class="mdi mdi-loading mdi-spin"></span> Loading directory...
        </div>

        <!-- Flat member search results -->
        <div v-else-if="isDirectorySearchActive">
          <div v-if="filteredDirectoryMembersList.length === 0" class="dir-empty">
            <span class="mdi mdi-account-search-outline"></span>
            <p>No members found matching "{{ directorySearch }}".</p>
          </div>
          <div v-else class="dir-list">
            <div class="dir-search-count">{{ filteredDirectoryMembersList.length }} member(s) found</div>
            <div v-for="item in filteredDirectoryMembersList" :key="item.member_id" class="dir-member-row dir-member-search-result">
              <div class="dir-member-icon"><span class="mdi mdi-account"></span></div>
              <div class="dir-member-info">
                <strong>{{ item.lastname }}, {{ item.firstname }} {{ item.middlename || '' }}</strong>
                <span class="dir-member-meta">
                  {{ (item.sex === 'M' ? 'Male' : item.sex === 'F' ? 'Female' : item.sex) || '—' }} &bull; Age: {{ item.age ?? '—' }} &bull; {{ item.relationship || '—' }} &bull; {{ item.civil_status || '—' }}
                </span>
                <span class="dir-member-head-label">Head: {{ item._head.lastname }}, {{ item._head.firstname }} ({{ item._head.purok || 'No Purok' }})</span>
              </div>
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-sm hs-btn-primary" @click.stop="openRecordSelector(item, 'member', item._head.purok)" title="Quick Add Record">
                <span class="mdi mdi-plus-circle-outline"></span> Add Record
              </button>
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-sm hs-btn-ghost" @click.stop="openEditMember(item, item._head)" title="Edit">
                <span class="mdi mdi-pencil-outline"></span>
              </button>
              <button class="hs-btn hs-btn-sm hs-btn-ghost" @click.stop="openMemberDetail(item, item._head)" title="View Details">
                <span class="mdi mdi-eye-outline"></span>
              </button>
            </div>
          </div>
        </div>

        <!-- Normal directory (no search) -->
        <div v-else-if="filteredDirectoryHeads.length === 0" class="dir-empty">
          <span class="mdi mdi-account-group-outline"></span>
          <p>No household heads found.</p>
        </div>

        <div v-else class="dir-list">
          <div v-for="head in filteredDirectoryHeads" :key="head.head_id" class="dir-head-card">
            <div class="dir-head-row" @click="toggleHead(head.head_id)">
              <span class="mdi" :class="expandedHeadIds.includes(head.head_id) ? 'mdi-chevron-down' : 'mdi-chevron-right'" style="font-size:18px;color:var(--hs-gray-400);"></span>
              <div class="dir-head-icon"><span class="mdi mdi-home-account"></span></div>
              <div class="dir-head-info">
                <strong>{{ head.lastname }}, {{ head.firstname }} {{ head.middlename || '' }} {{ head.suffix || '' }}</strong>
                <span class="dir-head-meta">{{ head.purok || 'No Purok' }} &bull; Head ID: {{ head.head_id }} &bull; {{ (directoryMembers[head.head_id] || []).length }} member(s)</span>
              </div>
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-sm hs-btn-primary" @click.stop="openRecordSelector(head, 'head', head.purok)" title="Quick Add Record">
                <span class="mdi mdi-plus-circle-outline"></span> Add Record
              </button>
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-sm hs-btn-ghost" @click.stop="openEditHead(head)" title="Edit">
                <span class="mdi mdi-pencil-outline"></span>
              </button>
              <button class="hs-btn hs-btn-sm hs-btn-ghost" @click.stop="openHeadDetail(head)" title="View Details">
                <span class="mdi mdi-eye-outline"></span>
              </button>
            </div>

            <div v-if="expandedHeadIds.includes(head.head_id)" class="dir-members">
              <div v-if="!directoryMembers[head.head_id] || directoryMembers[head.head_id].length === 0" class="dir-member-empty">
                No members registered under this household head.
              </div>
              <div v-for="member in (directoryMembers[head.head_id] || [])" :key="member.member_id" class="dir-member-row">
                <div class="dir-member-icon"><span class="mdi mdi-account"></span></div>
                <div class="dir-member-info">
                  <strong>{{ member.lastname }}, {{ member.firstname }} {{ member.middlename || '' }}</strong>
                  <span class="dir-member-meta">
                    {{ (member.sex === 'M' ? 'Male' : member.sex === 'F' ? 'Female' : member.sex) || '—' }} &bull; Age: {{ member.age ?? '—' }} &bull; {{ member.relationship || '—' }} &bull; {{ member.civil_status || '—' }}
                  </span>
                </div>
                <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-sm hs-btn-primary" @click.stop="openRecordSelector(member, 'member', head.purok)" title="Quick Add Record">
                  <span class="mdi mdi-plus-circle-outline"></span> Add Record
                </button>
                <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-sm hs-btn-ghost" @click.stop="openEditMember(member, head)" title="Edit">
                  <span class="mdi mdi-pencil-outline"></span>
                </button>
                <button class="hs-btn hs-btn-sm hs-btn-ghost" @click.stop="openMemberDetail(member, head)" title="View Details">
                  <span class="mdi mdi-eye-outline"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Record Type Selector Modal -->
      <div v-if="showRecordSelector" class="hs-modal-overlay" @click.self="showRecordSelector = false">
        <div class="hs-modal hs-modal-md">
          <div class="hs-modal-header">
            <h3>Select Record Type</h3>
            <button class="hs-modal-close" @click="showRecordSelector = false">&times;</button>
          </div>
          <div class="hs-modal-body">
            <p class="hs-text-sm" style="margin-bottom:12px;color:var(--hs-gray-500);">
              Adding record for: <strong>{{ quickAddPerson?.data?.lastname }}, {{ quickAddPerson?.data?.firstname }}</strong>
            </p>
            <div v-if="eligibleRecordTypes.length === 0" class="dir-empty" style="padding:24px 0;">
              <span class="mdi mdi-alert-circle-outline" style="font-size:36px;color:var(--hs-gray-400);"></span>
              <p style="margin-top:8px;color:var(--hs-gray-500);">This person is not eligible for any record types based on their age, sex, and civil status.</p>
            </div>
            <div v-else class="record-type-grid">
              <div v-for="opt in eligibleRecordTypes" :key="opt.value"
                class="record-type-option"
                :class="{
                  'record-type-option--active': selectedRecordType === opt.value,
                  'record-type-option--enrolled': isRecordEnrolled(quickAddPerson?.data, opt.table)
                }"
                @click="onRecordTypeClick(opt)">
                <span class="mdi" :class="opt.icon" style="font-size:24px;"></span>
                <strong>{{ opt.label }}</strong>
                <span class="record-type-desc">{{ opt.desc }}</span>
                <span v-if="isRecordEnrolled(quickAddPerson?.data, opt.table)" class="record-type-enrolled-badge">
                  <span class="mdi mdi-check-circle"></span> Already Registered
                </span>
              </div>
            </div>
          </div>
          <div class="hs-modal-footer">
            <button class="hs-btn hs-btn-secondary" @click="showRecordSelector = false">Cancel</button>
            <button class="hs-btn hs-btn-primary" :disabled="!selectedRecordType" @click="proceedToForm">
              <span class="mdi mdi-arrow-right"></span> Proceed
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Add Form Modal -->
      <div v-if="showQuickAddForm" class="hs-modal-overlay" @click.self="showQuickAddForm = false">
        <div class="hs-modal hs-modal-xl">
          <div class="hs-modal-header">
            <h3>
              {{ selectedRecordType === 'wra' ? 'WRA Record' :
                 selectedRecordType === 'cervical' ? 'Cervical Screening' :
                 selectedRecordType === 'familyplanning' ? 'Family Planning' :
                 selectedRecordType === 'childcare' ? 'Childcare (Vitamin A)' : 'Deworming' }}
              — Quick Add
            </h3>
            <button class="hs-modal-close" @click="showQuickAddForm = false">&times;</button>
          </div>
          <div class="hs-modal-body hs-modal-body--scroll">

            <!-- WRA Form -->
            <form v-if="selectedRecordType === 'wra'" @submit.prevent="saveQuickAddRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input v-model="quickAddForm.purok" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input v-model="quickAddForm.lastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input v-model="quickAddForm.firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input v-model="quickAddForm.middlename" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Suffix</label><input v-model="quickAddForm.suffix" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Age</label><input v-model.number="quickAddForm.age" type="number" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Birthdate</label><input v-model="quickAddForm.birthdate" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">SE Status</label>
                  <select v-model="quickAddForm.seStatus" class="hs-select"><option value="">Select</option><option value="P">P</option><option value="NP">NP</option></select>
                </div>
                <div class="hs-form-group"><label class="hs-label">Civil Status</label>
                  <select v-model="quickAddForm.civilStatus" class="hs-select"><option value="">Select</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option><option value="Live-in">Live-in</option></select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Plano Manganak</label><input v-model="quickAddForm.planoManganak" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">FB Method</label><input v-model="quickAddForm.fbMethod" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">FB Type</label><input v-model="quickAddForm.fbType" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">FB Date</label><input v-model="quickAddForm.fbDate" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Change Method</label><input v-model="quickAddForm.changeMethod" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-checkbox-label"><input type="checkbox" v-model="quickAddForm.karun" /> Karun</label></div>
                <div class="hs-form-group"><label class="hs-checkbox-label"><input type="checkbox" v-model="quickAddForm.spacing" /> Spacing</label></div>
                <div class="hs-form-group"><label class="hs-checkbox-label"><input type="checkbox" v-model="quickAddForm.limiting" /> Limiting</label></div>
                <div class="hs-form-group"><label class="hs-checkbox-label"><input type="checkbox" v-model="quickAddForm.fecund" /> Fecund</label></div>
                <div class="hs-form-group"><label class="hs-checkbox-label"><input type="checkbox" v-model="quickAddForm.infecund" /> Infecund</label></div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showQuickAddForm = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary" :disabled="savingQuickAdd"><span class="mdi mdi-content-save"></span> Save WRA Record</button>
              </div>
            </form>

            <!-- Cervical Form -->
            <form v-else-if="selectedRecordType === 'cervical'" @submit.prevent="saveQuickAddRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input v-model="quickAddForm.purok" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input v-model="quickAddForm.lastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input v-model="quickAddForm.firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input v-model="quickAddForm.middlename" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Suffix</label><input v-model="quickAddForm.suffix" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Age</label><input v-model.number="quickAddForm.age" type="number" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Birthdate</label><input v-model="quickAddForm.birthdate" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Screened</label>
                  <select v-model="quickAddForm.screened" class="hs-select"><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select>
                </div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showQuickAddForm = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary" :disabled="savingQuickAdd"><span class="mdi mdi-content-save"></span> Save Cervical Record</button>
              </div>
            </form>

            <!-- Family Planning Form -->
            <form v-else-if="selectedRecordType === 'familyplanning'" @submit.prevent="saveQuickAddRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input v-model="quickAddForm.purok" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Surname</label><input v-model="quickAddForm.surname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input v-model="quickAddForm.firstname" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Mother Name</label><input v-model="quickAddForm.motherName" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Sex</label>
                  <select v-model="quickAddForm.sex" class="hs-select"><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select>
                </div>
                <div class="hs-form-group"><label class="hs-label">Birthday</label><input v-model="quickAddForm.birthday" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Age</label><input v-model.number="quickAddForm.age" type="number" class="hs-input" /></div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showQuickAddForm = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary" :disabled="savingQuickAdd"><span class="mdi mdi-content-save"></span> Save Family Planning Record</button>
              </div>
            </form>

            <!-- Childcare Form -->
            <form v-else-if="selectedRecordType === 'childcare'" @submit.prevent="saveQuickAddRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input v-model="quickAddForm.purok" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input v-model="quickAddForm.lastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input v-model="quickAddForm.firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input v-model="quickAddForm.middlename" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Suffix</label><input v-model="quickAddForm.suffix" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Age</label><input v-model.number="quickAddForm.age" type="number" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Birthdate</label><input v-model="quickAddForm.birthdate" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Gender</label>
                  <select v-model="quickAddForm.gender" class="hs-select"><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select>
                </div>
                <div class="hs-form-group"><label class="hs-label">Mother Name</label><input v-model="quickAddForm.motherName" class="hs-input" /></div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showQuickAddForm = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary" :disabled="savingQuickAdd"><span class="mdi mdi-content-save"></span> Save Childcare Record</button>
              </div>
            </form>

            <!-- Deworming Form -->
            <form v-else-if="selectedRecordType === 'deworming'" @submit.prevent="saveQuickAddRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input v-model="quickAddForm.purok" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input v-model="quickAddForm.lastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input v-model="quickAddForm.firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input v-model="quickAddForm.middlename" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Mother Name</label><input v-model="quickAddForm.motherName" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Sex</label>
                  <select v-model="quickAddForm.sex" class="hs-select"><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select>
                </div>
                <div class="hs-form-group"><label class="hs-label">Birthday</label><input v-model="quickAddForm.birthday" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Age</label><input v-model.number="quickAddForm.age" type="number" class="hs-input" /></div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showQuickAddForm = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary" :disabled="savingQuickAdd"><span class="mdi mdi-content-save"></span> Save Deworming Record</button>
              </div>
            </form>

          </div>
        </div>
      </div>

      <!-- Modal for Fill In Form -->
      <div v-if="showModal" class="hs-modal-overlay" @click.self="closeModal">
        <div class="hs-modal hs-modal-xl">
          <div class="hs-modal-header">
            <h3>{{ modalType === 'household' ? 'Household Member Profiling' : 'Household Head Profiling' }}</h3>
            <button class="hs-modal-close" @click="closeModal">&times;</button>
          </div>

          <!-- Government Header -->
          <div class="hs-gov-header">
            <img src="/images/agusanlogo.png" alt="Agusan" class="gov-logo" />
            <div class="hs-gov-header-text">
              Republic of the Philippines<br />Province of Agusan del Norte<br />Municipality of Buenavista
              <div class="hs-gov-header-title">
                {{ modalType === 'household' ? 'Household Profiling' : 'Household Head Profiling' }}
              </div>
            </div>
            <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" class="gov-logo" />
            <img v-else src="/images/barangay6.png" alt="Barangay 6" class="gov-logo" />
          </div>

          <div class="hs-modal-body hs-modal-body--scroll">
            <!-- Household Member Form -->
            <template v-if="modalType === 'household'">
              <form @submit.prevent="saveHousehold">

                <!-- SECTION: Household Head -->
                <div class="form-section">
                  <div class="form-section-label">
                    <span class="mdi mdi-home-account form-section-icon form-section-icon--primary"></span>
                    <div>
                      <strong>Household Head</strong>
                      <span>Select the household head this member belongs to</span>
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group form-group-full">
                      <label class="hs-label">Household Head <span class="hs-text-danger">*</span></label>
                      <div class="head-search-wrapper">
                        <div class="head-search-input-row">
                          <input
                            type="text"
                            v-model="headSearchQuery"
                            class="hs-input"
                            placeholder="Search household head by name or purok..."
                            @focus="onHeadSearchFocus"
                            @blur="onHeadSearchBlur"
                            autocomplete="off"
                          />
                          <button
                            v-if="selectedHeadId"
                            type="button"
                            class="head-clear-btn"
                            @click="clearHeadSelection"
                            title="Clear selection"
                          >&times;</button>
                        </div>
                        <div v-if="selectedHeadId && !showHeadDropdown" class="head-selected-badge">
                          <span class="mdi mdi-check-circle hs-text-success"></span>
                          {{ selectedHeadLabel }}
                        </div>
                        <div v-if="showHeadDropdown" class="head-dropdown">
                          <div v-if="loadingHeads" class="head-dropdown-item head-dropdown-empty">
                            Loading household heads...
                          </div>
                          <div v-else-if="filteredHeads.length === 0" class="head-dropdown-item head-dropdown-empty">
                            No household heads found. Register one first.
                          </div>
                          <div
                            v-else
                            v-for="head in filteredHeads"
                            :key="head.head_id"
                            class="head-dropdown-item"
                            :class="{ 'head-dropdown-item-active': head.head_id === selectedHeadId }"
                            @mousedown.prevent="selectHead(head)"
                          >
                            <span class="mdi mdi-account hs-text-muted"></span>
                            {{ head.lastname }}, {{ head.firstname }} &mdash; {{ head.purok || 'N/A' }}
                            <span class="purok-label">
                              Head ID: {{ head.head_id }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- SECTION: Visit & Location -->
                <div class="form-section">
                  <div class="form-section-label">
                    <span class="mdi mdi-map-marker-outline form-section-icon form-section-icon--info"></span>
                    <div>
                      <strong>Visit &amp; Location</strong>
                      <span>Date of visit and barangay/purok assignment</span>
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">Date of Visit</label>
                      <input type="date" v-model="dateVisit" class="hs-input" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Barangay</label>
                      <input type="text" v-model="barangay" class="hs-input hs-input--readonly" readonly />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Purok</label>
                      <select v-model="purok" class="hs-select">
                        <option value="">Select Purok</option>
                        <option value="Purok 1">Purok 1</option>
                        <option value="Purok 2">Purok 2</option>
                        <option value="Purok 3">Purok 3</option>
                        <option value="Purok 4">Purok 4</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- SECTION: Personal Information -->
                <div class="form-section">
                  <div class="form-section-label">
                    <span class="mdi mdi-account-outline form-section-icon form-section-icon--primary"></span>
                    <div>
                      <strong>Personal Information</strong>
                      <span>Basic identity and demographic details of the member</span>
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">Last Name</label>
                      <input type="text" v-model="lastname" class="hs-input" placeholder="e.g. Dela Cruz" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">First Name</label>
                      <input type="text" v-model="firstname" class="hs-input" placeholder="e.g. Juan" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Middle Name</label>
                      <input type="text" v-model="middlename" class="hs-input" placeholder="Optional" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Suffix</label>
                      <input type="text" v-model="suffix" class="hs-input" placeholder="Jr, Sr, III..." />
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">Relationship to HH Head</label>
                      <select v-model="relationship" class="hs-select">
                        <option value="">Select</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Son">Son</option>
                        <option value="Daughter">Daughter</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Date of Birth</label>
                      <input type="date" v-model="birthdate" class="hs-input" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Age</label>
                      <input type="number" v-model="age" class="hs-input hs-input--readonly" min="0" readonly />
                      <span class="hs-form-hint"><span class="mdi mdi-auto-fix"></span> Auto-calculated</span>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Sex</label>
                      <select v-model="sex" class="hs-select">
                        <option value="">Select</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Civil Status</label>
                      <select v-model="civilStatus" class="hs-select">
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
                      <label class="hs-label">Education</label>
                      <select v-model="education" class="hs-select">
                        <option value="">Select</option>
                        <option value="Elementary">Elementary</option>
                        <option value="High School">High School</option>
                        <option value="College">College</option>
                        <option value="Vocational">Vocational</option>
                        <option value="None">None</option>
                      </select>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Religion</label>
                      <select v-model="religion" class="hs-select">
                        <option value="">Select</option>
                        <option value="Catholic">Catholic</option>
                        <option value="Islam">Islam</option>
                        <option value="Protestant">Protestant</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Ethnicity</label>
                      <select v-model="ethnicity" class="hs-select">
                        <option value="">Select</option>
                        <option value="IP">IP</option>
                        <option value="Non-IP">Non-IP</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- SECTION: Government Programs & Insurance -->
                <div class="form-section">
                  <div class="form-section-label">
                    <span class="mdi mdi-shield-check-outline form-section-icon form-section-icon--success"></span>
                    <div>
                      <strong>Government Programs &amp; Insurance</strong>
                      <span>4Ps membership and PhilHealth coverage details</span>
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">4Ps Member</label>
                      <select v-model="is4psMember" class="hs-select">
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">4Ps Household ID</label>
                      <input type="text" v-model="householdId4ps" class="hs-input" placeholder="If applicable" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">PhilHealth ID No.</label>
                      <input type="text" v-model="philhealthId" class="hs-input" />
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">Membership Type</label>
                      <select v-model="membershipType" class="hs-select">
                        <option value="">Select</option>
                        <option value="M-member">M &mdash; Member</option>
                        <option value="D-dependent">D &mdash; Dependent</option>
                      </select>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">PhilHealth Category</label>
                      <select v-model="philhealthCategory" class="hs-select">
                        <option value="">Select</option>
                        <option value="DC">Direct Contributor (DC)</option>
                        <option value="IC">Indirect Contributor (IC)</option>
                        <option value="U">Unknown (U)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- SECTION: Health Information -->
                <div class="form-section">
                  <div class="form-section-label">
                    <span class="mdi mdi-heart-pulse form-section-icon form-section-icon--danger"></span>
                    <div>
                      <strong>Health Information</strong>
                      <span>Medical history, risk group, reproductive health, and living conditions</span>
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">Medical History</label>
                      <select v-model="medicalHistory" class="hs-select">
                        <option value="">Select</option>
                        <option value="None">None</option>
                        <option value="HPN">Hypertension (HPN)</option>
                        <option value="DM">Diabetes Mellitus (DM)</option>
                        <option value="TB">Tuberculosis (TB)</option>
                        <option value="O">Others</option>
                      </select>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Age/Health Risk Group</label>
                      <input type="text" v-model="ageGroup" class="hs-input hs-input--readonly" readonly />
                      <small v-if="ageGroup" class="hs-form-hint" style="color: var(--hs-success);">
                        <span class="mdi mdi-check-circle"></span> Auto-classified from birthdate
                      </small>
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">LMP (Last Menstrual Period)</label>
                      <input type="date" v-model="lmp" class="hs-input" />
                    </div>
                    <div class="hs-form-group" style="display: flex; align-items: flex-end; padding-bottom: 10px;">
                      <label class="hs-checkbox-label">
                        <input type="checkbox" v-model="isPregnant" />
                        Currently Pregnant
                      </label>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Using FP Method?</label>
                      <select v-model="usingFpMethod" class="hs-select">
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">FP Method Used</label>
                      <input type="text" v-model="fpMethodUsed" class="hs-input" placeholder="e.g. Pills, IUD..." />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">FP Status</label>
                      <input type="text" v-model="fpStatus" class="hs-input" />
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">Water Source</label>
                      <input type="text" v-model="waterSource" class="hs-input" placeholder="e.g. Piped, Well..." />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Toilet Facility</label>
                      <input type="text" v-model="toiletFacility" class="hs-input" placeholder="e.g. Water-sealed, Open pit..." />
                    </div>
                  </div>
                </div>

                <!-- SECTION: Auto-Detected Services -->
                <div v-if="memberDetection.detectedTables.value.length > 0" class="form-section">
                  <div class="svc-detection-panel">
                    <div class="svc-detection-header">
                      <span class="mdi mdi-clipboard-check-outline"></span>
                      <div>
                        <strong>Eligible Services (Auto-Detected)</strong>
                        <span class="svc-detection-hint">Based on the entered data, this member qualifies for the services below. Uncheck any you do not wish to enroll.</span>
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
                        <template v-if="memberDetection.getVisibleFields(tbl.table, { age: age, sex: sex }).length > 0">
                          <div class="hs-form-row">
                            <template v-for="field in memberDetection.getVisibleFields(tbl.table, { age: age, sex: sex })" :key="field.key">
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
                        <p v-else class="svc-no-extra"><span class="mdi mdi-check-circle-outline"></span> No additional fields required &mdash; data will be taken from the form above.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="hs-modal-footer hs-modal-footer--flat">
                  <button type="button" class="hs-btn hs-btn-secondary" @click="closeModal">
                    <span class="mdi mdi-close"></span> Cancel
                  </button>
                  <button type="submit" class="hs-btn hs-btn-primary">
                    <span class="mdi mdi-plus"></span> Add Member
                    <span v-if="memberDetection.detectedTables.value.length > 0" class="btn-service-count">
                      + {{ memberDetection.detectedTables.value.filter(t => memberDetection.selectedTables[t.table]).length }} service(s)
                    </span>
                  </button>
                </div>
              </form>
            </template>

            <!-- Household Head Form -->
            <template v-else-if="modalType === 'head'">
              <form @submit.prevent="saveHead">

                <!-- SECTION: Location -->
                <div class="form-section">
                  <div class="form-section-label">
                    <span class="mdi mdi-map-marker-outline form-section-icon form-section-icon--info"></span>
                    <div>
                      <strong>Location</strong>
                      <span>Barangay and purok assignment for this household</span>
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">Barangay</label>
                      <input v-model="headBarangay" type="text" class="hs-input hs-input--readonly" readonly />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Purok</label>
                      <select v-model="headPurok" class="hs-select">
                        <option value="">Select Purok</option>
                        <option value="Purok 1">Purok 1</option>
                        <option value="Purok 2">Purok 2</option>
                        <option value="Purok 3">Purok 3</option>
                        <option value="Purok 4">Purok 4</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- SECTION: Personal Information -->
                <div class="form-section">
                  <div class="form-section-label">
                    <span class="mdi mdi-account-outline form-section-icon form-section-icon--primary"></span>
                    <div>
                      <strong>Personal Information</strong>
                      <span>Full name, birthdate, sex, and civil status of the household head</span>
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">Last Name</label>
                      <input v-model="headLastname" type="text" class="hs-input" placeholder="e.g. Dela Cruz" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">First Name</label>
                      <input v-model="headFirstname" type="text" class="hs-input" placeholder="e.g. Juan" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Middle Name</label>
                      <input v-model="headMiddlename" type="text" class="hs-input" placeholder="Optional" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Suffix</label>
                      <input v-model="headSuffix" type="text" class="hs-input" placeholder="Jr, Sr, III..." />
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">Birthdate</label>
                      <input v-model="headBirthdate" type="date" class="hs-input" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Age</label>
                      <input v-model.number="headAge" type="number" class="hs-input hs-input--readonly" min="0" readonly />
                      <span class="hs-form-hint"><span class="mdi mdi-auto-fix"></span> Auto-calculated</span>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Sex</label>
                      <select v-model="headSex" class="hs-select">
                        <option value="">Select</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Civil Status</label>
                      <select v-model="headCivilStatus" class="hs-select">
                        <option value="">Select</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Separated">Separated</option>
                        <option value="Live-in">Live-in</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- SECTION: Contact & Household -->
                <div class="form-section">
                  <div class="form-section-label">
                    <span class="mdi mdi-phone-outline form-section-icon form-section-icon--success"></span>
                    <div>
                      <strong>Contact &amp; Household Details</strong>
                      <span>Phone number, occupation, and number of families in the household</span>
                    </div>
                  </div>
                  <div class="hs-form-row">
                    <div class="hs-form-group">
                      <label class="hs-label">Contact Number</label>
                      <input v-model="headContactNumber" type="text" class="hs-input" placeholder="e.g. 09xxxxxxxxx" />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">Occupation</label>
                      <input v-model="headOccupation" type="text" class="hs-input" placeholder="e.g. Farmer, Teacher..." />
                    </div>
                    <div class="hs-form-group">
                      <label class="hs-label">No. of Families</label>
                      <input v-model="headFamilyCount" type="number" class="hs-input" min="0" placeholder="0" />
                    </div>
                  </div>
                  <div class="auto-calc-note">
                    <span class="mdi mdi-information-outline" style="margin-right: 6px; font-size: 16px;"></span>
                    <div>
                      <strong>Population, Female Count, and Male Count</strong> are automatically calculated from the household members added under this head.
                    </div>
                  </div>
                </div>

                <!-- SECTION: Auto-Detected Services -->
                <div v-if="headDetection.detectedTables.value.length > 0" class="form-section">
                  <div class="svc-detection-panel">
                    <div class="svc-detection-header">
                      <span class="mdi mdi-clipboard-check-outline"></span>
                      <div>
                        <strong>Eligible Services (Auto-Detected)</strong>
                        <span class="svc-detection-hint">Based on the entered data, this household head qualifies for the services below. Uncheck any you do not wish to enroll.</span>
                      </div>
                    </div>

                    <div v-for="tbl in headDetection.detectedTables.value" :key="tbl.table" class="svc-table-card" :class="{ 'svc-table-card--disabled': !headDetection.selectedTables[tbl.table] }">
                      <div class="svc-table-card-header" @click="headDetection.toggleTable(tbl.table)">
                        <input type="checkbox" :checked="headDetection.selectedTables[tbl.table]" @click.stop="headDetection.toggleTable(tbl.table)" class="svc-table-check" />
                        <span class="mdi" :class="tbl.icon" :style="{ color: tbl.color, fontSize: '18px' }"></span>
                        <strong>{{ tbl.label }}</strong>
                        <span class="svc-table-badges">
                          <span v-for="svc in tbl.services" :key="svc.key" class="svc-badge">{{ svc.label }}</span>
                        </span>
                      </div>

                      <div v-if="headDetection.selectedTables[tbl.table]" class="svc-table-card-body">
                        <template v-if="headDetection.getVisibleFields(tbl.table, { age: headAge, sex: headSex }).length > 0">
                          <div class="hs-form-row">
                            <template v-for="field in headDetection.getVisibleFields(tbl.table, { age: headAge, sex: headSex })" :key="field.key">
                              <div v-if="field.type === 'text'" class="hs-form-group">
                                <label class="hs-label">{{ field.label }}</label>
                                <input v-model="headDetection.serviceFormData[tbl.table][field.key]" type="text" class="hs-input" />
                              </div>
                              <div v-else-if="field.type === 'date'" class="hs-form-group">
                                <label class="hs-label">{{ field.label }}</label>
                                <input v-model="headDetection.serviceFormData[tbl.table][field.key]" type="date" class="hs-input" />
                              </div>
                              <div v-else-if="field.type === 'select'" class="hs-form-group">
                                <label class="hs-label">{{ field.label }}</label>
                                <select v-model="headDetection.serviceFormData[tbl.table][field.key]" class="hs-select">
                                  <option value="">Select</option>
                                  <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                                </select>
                              </div>
                              <div v-else-if="field.type === 'checkbox'" class="hs-form-group" style="display:flex;align-items:flex-end;padding-bottom:10px;">
                                <label class="hs-checkbox-label">
                                  <input type="checkbox" v-model="headDetection.serviceFormData[tbl.table][field.key]" />
                                  {{ field.label }}
                                </label>
                              </div>
                            </template>
                          </div>
                        </template>
                        <p v-else class="svc-no-extra"><span class="mdi mdi-check-circle-outline"></span> No additional fields required &mdash; data will be taken from the form above.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="hs-modal-footer hs-modal-footer--flat">
                  <button type="button" class="hs-btn hs-btn-secondary" @click="closeModal">
                    <span class="mdi mdi-close"></span> Cancel
                  </button>
                  <button type="submit" class="hs-btn hs-btn-primary">
                    <span class="mdi mdi-content-save"></span> Save Record
                    <span v-if="headDetection.detectedTables.value.length > 0" class="btn-service-count">
                      + {{ headDetection.detectedTables.value.filter(t => headDetection.selectedTables[t.table]).length }} service(s)
                    </span>
                  </button>
                </div>
              </form>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Household Head Detail Modal -->
    <div v-if="showHeadDetailModal && headDetailItem" class="hs-modal-overlay" @click.self="showHeadDetailModal = false">
      <div class="hs-modal hs-modal-md">
        <div class="hs-modal-header">
          <h3>Household Head Details</h3>
          <button class="hs-modal-close" @click="showHeadDetailModal = false">&times;</button>
        </div>
        <div class="hs-modal-body">
          <div class="prof-detail-top">
            <div class="prof-detail-avatar"><span class="mdi mdi-home-account"></span></div>
            <div>
              <h4 class="prof-detail-name">{{ headDetailItem.lastname }}, {{ headDetailItem.firstname }} {{ headDetailItem.middlename || '' }} {{ headDetailItem.suffix || '' }}</h4>
              <span class="prof-detail-tag">Household Head</span>
            </div>
          </div>
          <div class="prof-detail-grid">
            <div class="prof-detail-field"><span class="prof-detail-label">Head ID</span><span class="prof-detail-value">{{ headDetailItem.head_id }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Barangay</span><span class="prof-detail-value">{{ headDetailItem.barangay || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Purok</span><span class="prof-detail-value">{{ headDetailItem.purok || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Sex</span><span class="prof-detail-value">{{ headDetailItem.sex === 'M' ? 'Male' : headDetailItem.sex === 'F' ? 'Female' : headDetailItem.sex || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Birthdate</span><span class="prof-detail-value">{{ fmtDetailDate(headDetailItem.birthdate) }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Age</span><span class="prof-detail-value">{{ headDetailItem.age ?? '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Civil Status</span><span class="prof-detail-value">{{ headDetailItem.civil_status || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Contact Number</span><span class="prof-detail-value">{{ headDetailItem.contact_number || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Occupation</span><span class="prof-detail-value">{{ headDetailItem.occupation || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">No. of Families</span><span class="prof-detail-value">{{ headDetailItem.no_of_families ?? '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Members</span><span class="prof-detail-value">{{ (directoryMembers[headDetailItem.head_id] || []).length }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Date Added</span><span class="prof-detail-value">{{ fmtDetailDate(headDetailItem.created_at) }}</span></div>
          </div>
        </div>
        <div class="hs-modal-footer">
          <button class="hs-btn hs-btn-secondary" @click="showHeadDetailModal = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Household Member Detail Modal -->
    <div v-if="showMemberDetailModal && memberDetailItem" class="hs-modal-overlay" @click.self="showMemberDetailModal = false">
      <div class="hs-modal hs-modal-md">
        <div class="hs-modal-header">
          <h3>Household Member Details</h3>
          <button class="hs-modal-close" @click="showMemberDetailModal = false">&times;</button>
        </div>
        <div class="hs-modal-body">
          <div class="prof-detail-top">
            <div class="prof-detail-avatar prof-detail-avatar--member"><span class="mdi mdi-account"></span></div>
            <div>
              <h4 class="prof-detail-name">{{ memberDetailItem.lastname }}, {{ memberDetailItem.firstname }} {{ memberDetailItem.middlename || '' }} {{ memberDetailItem.suffix || '' }}</h4>
              <span class="prof-detail-tag prof-detail-tag--member">{{ memberDetailItem.relationship || 'Member' }}</span>
            </div>
          </div>
          <div v-if="memberDetailHead" class="prof-detail-head-ref">
            <span class="mdi mdi-home-account"></span>
            <span>Under: <strong>{{ memberDetailHead.lastname }}, {{ memberDetailHead.firstname }}</strong> ({{ memberDetailHead.purok || 'No Purok' }})</span>
          </div>
          <div class="prof-detail-section-title">Personal Information</div>
          <div class="prof-detail-grid">
            <div class="prof-detail-field"><span class="prof-detail-label">Member ID</span><span class="prof-detail-value">{{ memberDetailItem.member_id }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Barangay</span><span class="prof-detail-value">{{ memberDetailItem.barangay || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Sex</span><span class="prof-detail-value">{{ memberDetailItem.sex === 'M' ? 'Male' : memberDetailItem.sex === 'F' ? 'Female' : memberDetailItem.sex || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Birthdate</span><span class="prof-detail-value">{{ fmtDetailDate(memberDetailItem.birthdate) }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Age</span><span class="prof-detail-value">{{ memberDetailItem.age ?? '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Civil Status</span><span class="prof-detail-value">{{ memberDetailItem.civil_status || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Education</span><span class="prof-detail-value">{{ memberDetailItem.education || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Religion</span><span class="prof-detail-value">{{ memberDetailItem.religion || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Ethnicity</span><span class="prof-detail-value">{{ memberDetailItem.ethnicity || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Occupation</span><span class="prof-detail-value">{{ memberDetailItem.occupation || '—' }}</span></div>
          </div>
          <div class="prof-detail-section-title">Health & Benefits</div>
          <div class="prof-detail-grid">
            <div class="prof-detail-field"><span class="prof-detail-label">4Ps Member</span><span class="prof-detail-value">{{ memberDetailItem.is_4ps_member ? 'Yes' : 'No' }}</span></div>
            <div v-if="memberDetailItem.is_4ps_member" class="prof-detail-field"><span class="prof-detail-label">4Ps Household ID</span><span class="prof-detail-value">{{ memberDetailItem.household_id_4ps || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">PhilHealth ID</span><span class="prof-detail-value">{{ memberDetailItem.philhealth_id || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Membership Type</span><span class="prof-detail-value">{{ memberDetailItem.membership_type || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">PhilHealth Category</span><span class="prof-detail-value">{{ memberDetailItem.philhealth_category || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Medical History</span><span class="prof-detail-value">{{ memberDetailItem.medical_history || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Age Group</span><span class="prof-detail-value">{{ memberDetailItem.age_group || '—' }}</span></div>
          </div>
          <div class="prof-detail-section-title">Reproductive & Household</div>
          <div class="prof-detail-grid">
            <div class="prof-detail-field"><span class="prof-detail-label">LMP</span><span class="prof-detail-value">{{ fmtDetailDate(memberDetailItem.lmp) }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Using FP Method</span><span class="prof-detail-value">{{ memberDetailItem.using_fp_method ? 'Yes' : 'No' }}</span></div>
            <div v-if="memberDetailItem.using_fp_method" class="prof-detail-field"><span class="prof-detail-label">FP Method</span><span class="prof-detail-value">{{ memberDetailItem.fp_method_used || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">FP Status</span><span class="prof-detail-value">{{ memberDetailItem.fp_status || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Water Source</span><span class="prof-detail-value">{{ memberDetailItem.water_source || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Toilet Facility</span><span class="prof-detail-value">{{ memberDetailItem.toilet_facility || '—' }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Date of Visit</span><span class="prof-detail-value">{{ fmtDetailDate(memberDetailItem.date_visit) }}</span></div>
            <div class="prof-detail-field"><span class="prof-detail-label">Date Added</span><span class="prof-detail-value">{{ fmtDetailDate(memberDetailItem.created_at) }}</span></div>
          </div>
        </div>
        <div class="hs-modal-footer">
          <button class="hs-btn hs-btn-secondary" @click="showMemberDetailModal = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Edit Household Head Modal -->
    <div v-if="showEditHeadModal" class="hs-modal-overlay" @click.self="showEditHeadModal = false">
      <div class="hs-modal hs-modal-md">
        <div class="hs-modal-header">
          <h3>Edit Household Head</h3>
          <button class="hs-modal-close" @click="showEditHeadModal = false">&times;</button>
        </div>
        <div class="hs-modal-body hs-modal-body--scroll">
          <form @submit.prevent="saveEditHead">
            <div class="form-section">
              <div class="form-section-label">
                <span class="mdi mdi-map-marker-outline form-section-icon form-section-icon--info"></span>
                <div><strong>Location</strong><span>Barangay and purok assignment</span></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Barangay</label>
                  <input v-model="editHeadForm.barangay" type="text" class="hs-input hs-input--readonly" readonly />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Purok</label>
                  <select v-model="editHeadForm.purok" class="hs-select">
                    <option value="">Select Purok</option>
                    <option value="Purok 1">Purok 1</option>
                    <option value="Purok 2">Purok 2</option>
                    <option value="Purok 3">Purok 3</option>
                    <option value="Purok 4">Purok 4</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-label">
                <span class="mdi mdi-account-outline form-section-icon form-section-icon--primary"></span>
                <div><strong>Personal Information</strong><span>Full name, birthdate, sex, and civil status</span></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Last Name <span class="hs-text-danger">*</span></label>
                  <input v-model="editHeadForm.lastname" type="text" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">First Name <span class="hs-text-danger">*</span></label>
                  <input v-model="editHeadForm.firstname" type="text" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Middle Name</label>
                  <input v-model="editHeadForm.middlename" type="text" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Suffix</label>
                  <input v-model="editHeadForm.suffix" type="text" class="hs-input" placeholder="Jr, Sr, III..." />
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Birthdate</label>
                  <input v-model="editHeadForm.birthdate" type="date" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Age</label>
                  <input v-model.number="editHeadForm.age" type="number" class="hs-input hs-input--readonly" min="0" readonly />
                  <span class="hs-form-hint"><span class="mdi mdi-auto-fix"></span> Auto-calculated</span>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Sex</label>
                  <select v-model="editHeadForm.sex" class="hs-select">
                    <option value="">Select</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Civil Status</label>
                  <select v-model="editHeadForm.civil_status" class="hs-select">
                    <option value="">Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Live-in">Live-in</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-label">
                <span class="mdi mdi-phone-outline form-section-icon form-section-icon--success"></span>
                <div><strong>Contact &amp; Household Details</strong><span>Phone, occupation, and family count</span></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Contact Number</label>
                  <input v-model="editHeadForm.contact_number" type="text" class="hs-input" placeholder="e.g. 09xxxxxxxxx" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Occupation</label>
                  <input v-model="editHeadForm.occupation" type="text" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">No. of Families</label>
                  <input v-model="editHeadForm.no_of_families" type="number" class="hs-input" min="0" />
                </div>
              </div>
            </div>

            <div class="hs-modal-footer hs-modal-footer--flat">
              <button type="button" class="hs-btn hs-btn-secondary" @click="showEditHeadModal = false">
                <span class="mdi mdi-close"></span> Cancel
              </button>
              <button type="submit" class="hs-btn hs-btn-primary">
                <span class="mdi mdi-content-save-outline"></span> Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Edit Household Member Modal -->
    <div v-if="showEditMemberModal" class="hs-modal-overlay" @click.self="showEditMemberModal = false">
      <div class="hs-modal hs-modal-lg">
        <div class="hs-modal-header">
          <h3>Edit Household Member</h3>
          <button class="hs-modal-close" @click="showEditMemberModal = false">&times;</button>
        </div>
        <div class="hs-modal-body hs-modal-body--scroll">
          <div v-if="editMemberHeadRef" class="prof-detail-head-ref" style="margin-bottom: 16px;">
            <span class="mdi mdi-home-account"></span>
            <span>Under: <strong>{{ editMemberHeadRef.lastname }}, {{ editMemberHeadRef.firstname }}</strong> ({{ editMemberHeadRef.purok || 'No Purok' }})</span>
          </div>
          <form @submit.prevent="saveEditMember">
            <div class="form-section">
              <div class="form-section-label">
                <span class="mdi mdi-account-outline form-section-icon form-section-icon--primary"></span>
                <div><strong>Personal Information</strong><span>Name, birthdate, sex, and demographics</span></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Last Name <span class="hs-text-danger">*</span></label>
                  <input v-model="editMemberForm.lastname" type="text" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">First Name <span class="hs-text-danger">*</span></label>
                  <input v-model="editMemberForm.firstname" type="text" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Middle Name</label>
                  <input v-model="editMemberForm.middlename" type="text" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Suffix</label>
                  <input v-model="editMemberForm.suffix" type="text" class="hs-input" placeholder="Jr, Sr, III..." />
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Relationship to Head</label>
                  <select v-model="editMemberForm.relationship" class="hs-select">
                    <option value="">Select</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Grandchild">Grandchild</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Birthdate</label>
                  <input v-model="editMemberForm.birthdate" type="date" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Age</label>
                  <input v-model.number="editMemberForm.age" type="number" class="hs-input hs-input--readonly" min="0" readonly />
                  <span class="hs-form-hint"><span class="mdi mdi-auto-fix"></span> Auto-calculated</span>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Sex</label>
                  <select v-model="editMemberForm.sex" class="hs-select">
                    <option value="">Select</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Civil Status</label>
                  <select v-model="editMemberForm.civil_status" class="hs-select">
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
                  <select v-model="editMemberForm.education" class="hs-select">
                    <option value="">Select</option>
                    <option value="Elementary">Elementary</option>
                    <option value="High School">High School</option>
                    <option value="College">College</option>
                    <option value="Vocational">Vocational</option>
                    <option value="None">None</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Religion</label>
                  <select v-model="editMemberForm.religion" class="hs-select">
                    <option value="">Select</option>
                    <option value="Catholic">Catholic</option>
                    <option value="Islam">Islam</option>
                    <option value="Protestant">Protestant</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Ethnicity</label>
                  <select v-model="editMemberForm.ethnicity" class="hs-select">
                    <option value="">Select</option>
                    <option value="IP">IP</option>
                    <option value="Non-IP">Non-IP</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Occupation</label>
                  <input v-model="editMemberForm.occupation" type="text" class="hs-input" />
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-label">
                <span class="mdi mdi-shield-check-outline form-section-icon form-section-icon--info"></span>
                <div><strong>Health &amp; Benefits</strong><span>4Ps, PhilHealth, medical history</span></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">4Ps Member</label>
                  <select v-model="editMemberForm.is_4ps_member" class="hs-select">
                    <option :value="false">No</option>
                    <option :value="true">Yes</option>
                  </select>
                </div>
                <div v-if="editMemberForm.is_4ps_member" class="hs-form-group">
                  <label class="hs-label">4Ps Household ID</label>
                  <input v-model="editMemberForm.household_id_4ps" type="text" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">PhilHealth ID</label>
                  <input v-model="editMemberForm.philhealth_id" type="text" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Membership Type</label>
                  <select v-model="editMemberForm.membership_type" class="hs-select">
                    <option value="">Select</option>
                    <option value="Member">Member</option>
                    <option value="Dependent">Dependent</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">PhilHealth Category</label>
                  <select v-model="editMemberForm.philhealth_category" class="hs-select">
                    <option value="">Select</option>
                    <option value="Employed">Employed</option>
                    <option value="Self-employed">Self-employed</option>
                    <option value="Voluntary">Voluntary</option>
                    <option value="Sponsored">Sponsored</option>
                    <option value="Lifetime">Lifetime</option>
                    <option value="Senior Citizen">Senior Citizen</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Medical History</label>
                  <select v-model="editMemberForm.medical_history" class="hs-select">
                    <option value="">Select</option>
                    <option value="None">None</option>
                    <option value="HPN">HPN</option>
                    <option value="DM">DM</option>
                    <option value="TB">TB</option>
                    <option value="O">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-label">
                <span class="mdi mdi-heart-outline form-section-icon form-section-icon--danger"></span>
                <div><strong>Reproductive &amp; Household</strong><span>LMP, FP, water and sanitation</span></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">LMP</label>
                  <input v-model="editMemberForm.lmp" type="date" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Using FP Method</label>
                  <select v-model="editMemberForm.using_fp_method" class="hs-select">
                    <option :value="false">No</option>
                    <option :value="true">Yes</option>
                  </select>
                </div>
                <div v-if="editMemberForm.using_fp_method" class="hs-form-group">
                  <label class="hs-label">FP Method Used</label>
                  <input v-model="editMemberForm.fp_method_used" type="text" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">FP Status</label>
                  <select v-model="editMemberForm.fp_status" class="hs-select">
                    <option value="">Select</option>
                    <option value="New Acceptor">New Acceptor</option>
                    <option value="Current User">Current User</option>
                    <option value="Dropout">Dropout</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Water Source</label>
                  <select v-model="editMemberForm.water_source" class="hs-select">
                    <option value="">Select</option>
                    <option value="Piped">Piped</option>
                    <option value="Faucet">Faucet</option>
                    <option value="Well">Well</option>
                    <option value="Spring">Spring</option>
                    <option value="Rain">Rain</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Toilet Facility</label>
                  <select v-model="editMemberForm.toilet_facility" class="hs-select">
                    <option value="">Select</option>
                    <option value="Water-sealed">Water-sealed</option>
                    <option value="Open pit">Open pit</option>
                    <option value="None">None</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="hs-modal-footer hs-modal-footer--flat">
              <button type="button" class="hs-btn hs-btn-secondary" @click="showEditMemberModal = false">
                <span class="mdi mdi-close"></span> Cancel
              </button>
              <button type="submit" class="hs-btn hs-btn-primary">
                <span class="mdi mdi-content-save-outline"></span> Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
</template>

<style scoped>
.service-page {
  max-width: var(--hs-content-max-width);
}
.service-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--hs-space-6);
}
.service-action-card {
  transition: transform var(--hs-transition-fast), box-shadow var(--hs-transition-fast);
}
.service-action-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--hs-shadow-md);
}
.svc-hero { text-align: center; padding: var(--hs-space-8); }
.svc-hero-icon { margin: 0 auto var(--hs-space-4); width: 56px; height: 56px; font-size: 28px; }
.svc-hero-title { font-size: var(--hs-font-size-md); font-weight: 600; color: var(--hs-gray-900); margin-bottom: var(--hs-space-2); }
.svc-hero-desc { font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-bottom: var(--hs-space-5); }
.svc-hero-actions { display: flex; gap: var(--hs-space-2); justify-content: center; flex-wrap: wrap; }
.gov-logo { height: 60px; }
.form-group-full { grid-column: 1 / -1; }
.hs-text-danger { color: var(--hs-danger); }
.hs-text-success { color: var(--hs-success); }
.hs-text-muted { color: var(--hs-gray-400); }
.purok-label { color: var(--hs-gray-400); margin-left: auto; font-size: var(--hs-font-size-xs); }

/* Readonly input style */
.hs-input--readonly {
  background-color: var(--hs-gray-50) !important;
  color: var(--hs-gray-600);
  cursor: default;
}

/* ── Form Section Grouping ── */
.form-section {
  margin-bottom: 20px;
  padding-bottom: 4px;
}
.form-section:last-of-type {
  margin-bottom: 8px;
}
.form-section-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--hs-gray-100);
}
.form-section-label strong {
  display: block;
  font-size: 13px;
  color: var(--hs-gray-800);
  margin-bottom: 1px;
}
.form-section-label span:not(.mdi) {
  display: block;
  font-size: 11px;
  color: var(--hs-gray-400);
  font-weight: 400;
  line-height: 1.4;
}
.form-section-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 16px;
}
.form-section-icon--primary {
  background: var(--hs-primary-bg, rgba(91, 132, 30, 0.1));
  color: var(--hs-primary);
}
.form-section-icon--info {
  background: var(--hs-info-bg, rgba(33, 150, 243, 0.1));
  color: var(--hs-info, #2196F3);
}
.form-section-icon--success {
  background: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
}
.form-section-icon--danger {
  background: rgba(244, 67, 54, 0.1);
  color: #F44336;
}

/* Submit button service count badge */
.btn-service-count {
  margin-left: 6px;
  padding: 1px 8px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

/* Searchable Head Dropdown */
.head-search-wrapper {
  position: relative;
}
.head-search-input-row {
  position: relative;
  display: flex;
  align-items: center;
}
.head-search-input-row .hs-input {
  padding-right: 36px;
}
.head-clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--hs-gray-400);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  border-radius: var(--hs-radius-sm);
  transition: color var(--hs-transition-fast);
}
.head-clear-btn:hover {
  color: var(--hs-danger);
}
.head-selected-badge {
  display: flex;
  align-items: center;
  margin-top: 5px;
  padding: 5px 8px;
  background: var(--hs-gray-50);
  border: 1px solid var(--hs-border);
  border-radius: var(--hs-radius-md);
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-700);
}
.head-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--hs-white);
  border: 1px solid var(--hs-border);
  border-radius: var(--hs-radius-md);
  box-shadow: var(--hs-shadow-md);
  max-height: 200px;
  overflow-y: auto;
  margin-top: 4px;
}
.head-dropdown-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-700);
  cursor: pointer;
  transition: background var(--hs-transition-fast);
}
.head-dropdown-item:hover {
  background: var(--hs-gray-50);
}
.head-dropdown-item-active {
  background: rgba(91, 132, 30, 0.08);
  font-weight: 500;
}
.head-dropdown-empty {
  color: var(--hs-gray-400);
  cursor: default;
  font-style: italic;
}
.head-dropdown-empty:hover {
  background: transparent;
}

/* Auto-calculation info note */
.auto-calc-note {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  margin-top: 4px;
  margin-bottom: 6px;
  background: var(--hs-info-bg);
  border: 1px solid var(--hs-info);
  border-radius: var(--hs-radius-md);
  font-size: var(--hs-font-size-xs);
  color: var(--hs-info);
  line-height: 1.5;
}

/* Directory Tab styles */
.inv-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; flex-wrap: wrap; gap: 8px; }
.inv-toolbar-left { display: flex; align-items: center; gap: 8px; }
.inv-toolbar-right { display: flex; align-items: center; gap: 10px; }
.inv-count-label { font-size: var(--hs-font-size-xs); color: var(--hs-gray-400); }

.dir-loading { text-align: center; padding: 48px 20px; color: var(--hs-gray-400); font-size: var(--hs-font-size-sm); }
.dir-loading .mdi { font-size: 24px; margin-right: 6px; }
.dir-empty { text-align: center; padding: 48px 20px; color: var(--hs-gray-400); }
.dir-empty .mdi { font-size: 40px; display: block; margin-bottom: 8px; opacity: 0.4; }
.dir-empty p { font-size: var(--hs-font-size-sm); margin: 0; }

.dir-list { display: flex; flex-direction: column; gap: 8px; }

.dir-head-card {
  background: var(--hs-white);
  border: 1px solid var(--hs-gray-100);
  border-radius: var(--hs-radius-lg);
  overflow: hidden;
}
.dir-head-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; cursor: pointer;
  transition: background 100ms ease;
}
.dir-head-row:hover { background: var(--hs-gray-50); }
.dir-head-icon {
  width: 34px; height: 34px; border-radius: var(--hs-radius-md);
  background: var(--hs-primary-bg); color: var(--hs-primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}
.dir-head-info { flex: 1; min-width: 0; }
.dir-head-info strong { display: block; font-size: var(--hs-font-size-sm); color: var(--hs-gray-800); }
.dir-head-meta { font-size: 11px; color: var(--hs-gray-400); }

.dir-members {
  border-top: 1px solid var(--hs-gray-100);
  background: var(--hs-gray-50);
  padding: 8px 16px 8px 60px;
}
.dir-member-empty {
  font-size: var(--hs-font-size-xs); color: var(--hs-gray-400);
  font-style: italic; padding: 8px 0;
}
.dir-member-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--hs-gray-100);
}
.dir-member-row:last-child { border-bottom: none; }
.dir-member-highlight {
  background: var(--hs-primary-bg, #f0f7e8);
  border-radius: var(--hs-radius-md);
  padding-left: 8px;
  padding-right: 8px;
  border-left: 3px solid var(--hs-primary);
}
.dir-member-search-result {
  background: var(--hs-white);
  border: 1px solid var(--hs-gray-200);
  border-radius: var(--hs-radius-md);
  padding: 10px 12px;
  margin-bottom: 6px;
}
.dir-member-head-label {
  font-size: 10px; color: var(--hs-primary); font-style: italic;
}
.dir-search-count {
  font-size: var(--hs-font-size-xs); color: var(--hs-gray-500);
  margin-bottom: 8px; font-weight: 500;
}
.dir-member-icon {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--hs-info-bg); color: var(--hs-info);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0;
}
.dir-member-info { flex: 1; min-width: 0; }
.dir-member-info strong { display: block; font-size: var(--hs-font-size-xs); color: var(--hs-gray-700); }
.dir-member-meta { font-size: 10px; color: var(--hs-gray-400); }

/* Record Type Selector Grid */
.record-type-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px;
}
.record-type-option {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 16px 10px; border: 2px solid var(--hs-gray-100);
  border-radius: var(--hs-radius-lg); cursor: pointer; text-align: center;
  transition: border-color 100ms, background 100ms;
}
.record-type-option:hover { border-color: var(--hs-gray-300); background: var(--hs-gray-50); }
.record-type-option--active { border-color: var(--hs-primary); background: var(--hs-primary-bg); }
.record-type-option--enrolled {
  opacity: 0.55; cursor: default; border-color: var(--hs-gray-100); background: var(--hs-gray-50);
}
.record-type-option--enrolled:hover { border-color: var(--hs-gray-100); background: var(--hs-gray-50); }
.record-type-option--enrolled .mdi:first-child { color: var(--hs-gray-400); }
.record-type-option--enrolled strong { color: var(--hs-gray-400); }
.record-type-enrolled-badge {
  display: flex; align-items: center; gap: 3px; margin-top: 2px;
  font-size: 10px; color: var(--hs-gray-400); font-weight: 600;
}
.record-type-option strong { font-size: var(--hs-font-size-xs); color: var(--hs-gray-800); }
.record-type-desc { font-size: 10px; color: var(--hs-gray-400); }

.hs-checkbox-label { display: flex; align-items: center; gap: 6px; font-size: var(--hs-font-size-sm); cursor: pointer; }
.hs-text-sm { font-size: var(--hs-font-size-sm); }

/* Service Detection Panel */
.svc-detection-panel {
  margin: 16px 0;
  padding: 16px;
  background: linear-gradient(135deg, #f0f7ff 0%, #f5f0ff 100%);
  border-radius: 10px;
  border: 1px solid #d0e3ff;
}
.svc-detection-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--hs-primary);
}
.svc-detection-header > .mdi {
  font-size: 20px;
  margin-top: 1px;
}
.svc-detection-header strong {
  display: block;
  font-size: 13px;
  margin-bottom: 2px;
}
.svc-detection-hint {
  display: block;
  font-size: 11px;
  color: var(--hs-gray-500);
  font-weight: 400;
}

.svc-table-card {
  background: var(--hs-white);
  border: 1px solid var(--hs-gray-100);
  border-radius: var(--hs-radius-lg);
  margin-bottom: 8px;
  overflow: hidden;
  transition: opacity 150ms ease, border-color 150ms ease;
}
.svc-table-card:last-child { margin-bottom: 0; }
.svc-table-card--disabled {
  opacity: 0.55;
  border-color: var(--hs-gray-100);
}
.svc-table-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 100ms ease;
}
.svc-table-card-header:hover {
  background: var(--hs-gray-50);
}
.svc-table-card-header strong {
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-800);
}
.svc-table-check {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--hs-primary);
  flex-shrink: 0;
}
.svc-table-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: auto;
}
.svc-badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--hs-primary-bg);
  color: var(--hs-primary);
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}
.svc-table-card-body {
  padding: 8px 14px 14px;
  border-top: 1px solid var(--hs-gray-100);
  background: var(--hs-gray-50);
}
.svc-no-extra {
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-400);
  font-style: italic;
  margin: 2px 0 0;
}

@media (max-width: 640px) {
  .dir-members { padding-left: 16px; }
  .record-type-grid { grid-template-columns: 1fr 1fr; }
  .inv-toolbar { flex-direction: column; align-items: stretch; }
  .svc-table-card-header { flex-wrap: wrap; }
  .svc-table-badges { margin-left: 0; margin-top: 4px; }
  .prof-detail-grid { grid-template-columns: 1fr; }
}

/* View Details Modal */
.prof-detail-top { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.prof-detail-avatar {
  width: 48px; height: 48px; border-radius: var(--hs-radius-lg);
  background: var(--hs-primary-bg); color: var(--hs-primary);
  display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;
}
.prof-detail-avatar--member { background: var(--hs-info-bg); color: var(--hs-info); }
.prof-detail-name { font-size: var(--hs-font-size-lg); font-weight: 600; color: var(--hs-gray-800); margin: 0 0 4px 0; }
.prof-detail-tag {
  display: inline-block; font-size: 10px; font-weight: 500; padding: 2px 8px;
  border-radius: 10px; background: var(--hs-primary-bg); color: var(--hs-primary);
}
.prof-detail-tag--member { background: var(--hs-info-bg); color: var(--hs-info); }
.prof-detail-head-ref {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; margin-bottom: 16px;
  background: var(--hs-gray-50); border-radius: var(--hs-radius-md);
  font-size: var(--hs-font-size-sm); color: var(--hs-gray-600);
}
.prof-detail-head-ref .mdi { font-size: 16px; color: var(--hs-primary); }
.prof-detail-section-title {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--hs-gray-400); margin: 18px 0 10px; padding-bottom: 6px;
  border-bottom: 1px solid var(--hs-gray-100);
}
.prof-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.prof-detail-field { display: flex; flex-direction: column; gap: 2px; }
.prof-detail-label { font-size: 10px; font-weight: 500; color: var(--hs-gray-400); text-transform: uppercase; letter-spacing: 0.04em; }
.prof-detail-value { font-size: var(--hs-font-size-sm); color: var(--hs-gray-700); font-weight: 500; }
</style>
