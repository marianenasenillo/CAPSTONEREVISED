<script setup>
// BorrowerProfiling — manage borrower profiles, medicine requests, and tool borrows
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/utils/supabase'
import { useToast } from '@/composables/useToast'
import { usePagination } from '@/composables/usePagination'
import {
  getOrCreateBorrowerProfile,
  getBorrowerWithHistory,
  listBorrowerProfiles,
  createMedicineTransaction,
  createToolBorrowTransaction,
  returnTool,
  getMostRequestedMedicines,
  getMostBorrowedTools,
  getMonthlyUsageTrends,
  listToolTransactions,
} from '@/utils/borrowerProfiling'

const toast = useToast()

// Notify helper — inserts a notification row targeting a role
async function notifyRole(targetRole, { type, title, message, icon, color, link }) {
  try {
    await supabase.from('notifications').insert({ target_role: targetRole, type, title, message, icon: icon || 'mdi-bell', color: color || 'var(--hs-info)', link: link || '/borrowers' })
  } catch (e) { console.error('Failed to send notification', e) }
}

const loading = ref(true)
const activeTab = ref('borrowers') // 'borrowers' | 'medicine_log' | 'tool_log' | 'analytics'
const userBarangay = ref('')
const userFullName = ref('')

const borrowers = ref([])
const searchQuery = ref('')
const selectedBorrower = ref(null)
const showBorrowerDetail = ref(false)

const householdMembers = ref([])
const memberSearchQuery = ref('')

const medicines = ref([])
const tools = ref([])

const showMedicineForm = ref(false)
const showToolForm = ref(false)
const showAddBorrowerForm = ref(false)

const medicineForm = ref({
  borrower_id: '',
  medicine_id: '',
  quantity: 1,
  purpose: '',
  prescribed_by: '',
})

const toolForm = ref({
  borrower_id: '',
  tool_id: '',
  quantity: 1,
  purpose: '',
  expected_return_date: '',
})

const addBorrowerForm = ref({
  member_id: '',
  firstname: '',
  lastname: '',
  middlename: '',
  suffix: '',
  purok: '',
})

const topMedicines = ref([])
const topTools = ref([])
const monthlyTrends = ref({ medicine: [], tools: [] })

const activeBorrows = ref([])

const filteredBorrowers = computed(() => {
  if (!searchQuery.value) return borrowers.value
  const q = searchQuery.value.toLowerCase()
  return borrowers.value.filter(b =>
    `${b.firstname} ${b.lastname} ${b.purok}`.toLowerCase().includes(q)
  )
})

const filteredMembers = computed(() => {
  if (!memberSearchQuery.value) return householdMembers.value.slice(0, 20)
  const q = memberSearchQuery.value.toLowerCase()
  return householdMembers.value.filter(m =>
    `${m.firstname} ${m.lastname}`.toLowerCase().includes(q)
  ).slice(0, 20)
})

const { paginatedData: paginatedBorrowers, ...borrowerPagination } = usePagination(filteredBorrowers)

async function loadData() {
  try {
    loading.value = true

    const { data: { user } } = await supabase.auth.getUser()
    userBarangay.value = user?.user_metadata?.barangay || ''
    userFullName.value = user?.user_metadata?.full_name || ''

    const [borrowerData, medData, toolData, memberData] = await Promise.all([
      listBorrowerProfiles({ barangay: userBarangay.value }),
      supabase.from('medicine').select('*').order('name'),
      supabase.from('tools').select('*').order('name'),
      supabase.from('household_members').select('member_id, head_id, firstname, lastname, middlename, suffix, sex, birthdate, barangay, household_heads(purok)').eq('barangay', userBarangay.value),
    ])

    borrowers.value = borrowerData || []
    medicines.value = medData.data || []
    tools.value = toolData.data || []
    householdMembers.value = (memberData.data || []).map(m => ({ ...m, purok: m.household_heads?.purok || '', household_heads: undefined }))

  } catch (err) {
    console.error('Failed to load borrower data:', err)
    toast.error('Failed to load data')
  } finally {
    loading.value = false
  }
}

function getAnalyticsDateRange() {
  const y = analyticsYear.value
  const m = analyticsMonth.value
  if (m) {
    const startDate = `${y}-${String(m).padStart(2, '0')}-01T00:00:00`
    const lastDay = new Date(y, m, 0).getDate()
    const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}T23:59:59`
    return { startDate, endDate }
  }
  return { startDate: `${y}-01-01T00:00:00`, endDate: `${y}-12-31T23:59:59` }
}

async function loadAnalytics() {
  try {
    const range = getAnalyticsDateRange()
    const [topMed, topTool, trends, borrows] = await Promise.all([
      getMostRequestedMedicines(10, range),
      getMostBorrowedTools(10, range),
      getMonthlyUsageTrends(12, range),
      listToolTransactions({ status: 'borrowed' }),
    ])
    topMedicines.value = topMed
    topTools.value = topTool
    monthlyTrends.value = trends
    activeBorrows.value = borrows
  } catch (err) {
    console.error('Failed to load analytics:', err)
  }
}

async function openBorrowerDetail(borrower) {
  try {
    const detail = await getBorrowerWithHistory(borrower.borrower_id)
    selectedBorrower.value = detail
    showBorrowerDetail.value = true
  } catch (err) {
    toast.error('Failed to load borrower details')
    console.error(err)
  }
}

function closeBorrowerDetail() {
  showBorrowerDetail.value = false
  selectedBorrower.value = null
}

async function addBorrowerFromMember(member) {
  try {
    const profile = await getOrCreateBorrowerProfile({
      member_id: member.member_id,
      head_id: member.head_id,
      firstname: member.firstname,
      lastname: member.lastname,
      middlename: member.middlename || '',
      suffix: member.suffix || '',
      purok: member.purok || '',
      barangay: member.barangay || userBarangay.value,
    })
    toast.success(`Borrower profile created for ${member.firstname} ${member.lastname}`)
    showAddBorrowerForm.value = false
    await loadData()
    return profile
  } catch (err) {
    toast.error('Failed to create borrower profile: ' + err.message)
    console.error(err)
  }
}

async function addBorrowerManual() {
  try {
    if (!addBorrowerForm.value.firstname || !addBorrowerForm.value.lastname) {
      return toast.warning('First name and last name are required')
    }
    const profile = await getOrCreateBorrowerProfile({
      ...addBorrowerForm.value,
      barangay: userBarangay.value,
    })
    toast.success('Borrower profile created')
    showAddBorrowerForm.value = false
    addBorrowerForm.value = { member_id: '', firstname: '', lastname: '', middlename: '', suffix: '', purok: '' }
    await loadData()
    return profile
  } catch (err) {
    toast.error('Failed to create borrower profile: ' + err.message)
  }
}

function openMedicineForm(borrower) {
  medicineForm.value = {
    borrower_id: borrower.borrower_id,
    medicine_id: '',
    quantity: 1,
    purpose: '',
    prescribed_by: userFullName.value || '',
  }
  showMedicineForm.value = true
}

async function submitMedicineRequest() {
  try {
    if (!medicineForm.value.medicine_id) return toast.warning('Select a medicine')
    if (!medicineForm.value.quantity || medicineForm.value.quantity < 1) return toast.warning('Quantity must be at least 1')

    await createMedicineTransaction(medicineForm.value)
    toast.success('Medicine provided successfully')
    showMedicineForm.value = false
    // Notify Admin about medicine provision
    const med = medicines.value.find(m => m.medicine_id === medicineForm.value.medicine_id)
    notifyRole('Admin', { type: 'borrower_activity', title: `Medicine provided: ${med?.name || 'Unknown'}`, message: `Qty: ${medicineForm.value.quantity}`, icon: 'mdi-pill', color: 'var(--hs-success)', link: '/inventory' })
    await Promise.all([loadData(), loadAnalytics()])
  } catch (err) {
    toast.error(err.message || 'Failed to provide medicine')
    console.error(err)
  }
}

function openToolForm(borrower) {
  toolForm.value = {
    borrower_id: borrower.borrower_id,
    tool_id: '',
    quantity: 1,
    purpose: '',
    expected_return_date: '',
  }
  showToolForm.value = true
}

async function submitToolBorrow() {
  try {
    if (!toolForm.value.tool_id) return toast.warning('Select a tool')
    if (!toolForm.value.quantity || toolForm.value.quantity < 1) return toast.warning('Quantity must be at least 1')

    await createToolBorrowTransaction(toolForm.value)
    toast.success('Tool borrowed successfully')
    showToolForm.value = false
    // Notify Admin about tool borrow
    const tool = tools.value.find(t => t.tool_id === toolForm.value.tool_id)
    notifyRole('Admin', { type: 'borrower_activity', title: `Tool borrowed: ${tool?.name || 'Unknown'}`, message: `Qty: ${toolForm.value.quantity}`, icon: 'mdi-wrench', color: 'var(--hs-warning)', link: '/inventory' })
    await Promise.all([loadData(), loadAnalytics()])
  } catch (err) {
    toast.error(err.message || 'Failed to borrow tool')
    console.error(err)
  }
}

async function handleReturnTool(tx) {
  try {
    await returnTool(tx.transaction_id)
    toast.success('Tool returned successfully')
    // Notify Admin about tool return
    notifyRole('Admin', { type: 'borrower_activity', title: `Tool returned: ${tx.tool_name || 'Unknown'}`, message: `Transaction #${tx.transaction_id}`, icon: 'mdi-wrench', color: 'var(--hs-info)', link: '/inventory' })
    await loadAnalytics()
  } catch (err) {
    toast.error(err.message || 'Failed to return tool')
    console.error(err)
  }
}

// Delete borrower profile (not their medicine/tool transactions)
async function deleteBorrower(borrower) {
  if (!confirm(`Delete borrower profile for ${borrower.firstname} ${borrower.lastname}? This will NOT delete their medicine/tool transaction history.`)) return
  try {
    const { error } = await supabase.from('borrower_profiles').delete().eq('borrower_id', borrower.borrower_id)
    if (error) throw error
    toast.success('Borrower profile deleted')
    await loadData()
  } catch (err) {
    toast.error('Failed to delete: ' + (err.message || err))
    console.error(err)
  }
}

// Analytics filters
const analyticsYear = ref(new Date().getFullYear())
const analyticsMonth = ref('')
const analyticsAvailableYears = computed(() => {
  const years = new Set()
  years.add(new Date().getFullYear())
  for (let y = 2024; y <= new Date().getFullYear(); y++) years.add(y)
  return [...years].sort((a, b) => b - a)
})
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

watch(activeTab, (tab) => {
  if (tab === 'analytics') {
    loadAnalytics()
  }
})

watch([analyticsYear, analyticsMonth], () => {
  loadAnalytics()
})

onMounted(async () => {
  await loadData()
  loadAnalytics()
})
</script>

<template>
  <div class="hs-page">
    <div class="hs-page-header">
      <div>
        <h1 class="hs-page-title"><span class="mdi mdi-account-cash-outline"></span> Borrower Profiling</h1>
        <p class="hs-page-subtitle">Manage borrower profiles, medicine requests, and tool borrow records</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="hs-tabs">
      <button class="hs-tab" :class="{ active: activeTab === 'borrowers' }" @click="activeTab = 'borrowers'">
        <span class="mdi mdi-account-group"></span> Borrowers
      </button>
      <button class="hs-tab" :class="{ active: activeTab === 'active_borrows' }" @click="activeTab = 'active_borrows'">
        <span class="mdi mdi-swap-horizontal"></span> Active Borrows
      </button>
      <button class="hs-tab" :class="{ active: activeTab === 'analytics' }" @click="activeTab = 'analytics'">
        <span class="mdi mdi-chart-bar"></span> Analytics
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="hs-empty-state" style="padding: 80px 0;">
      <div class="hs-spinner"></div>
      <p>Loading borrower data...</p>
    </div>

    <template v-else>
      <!-- BORROWERS TAB -->
      <div v-if="activeTab === 'borrowers'">
        <!-- Toolbar -->
        <div class="hs-toolbar">
          <div class="hs-search-box">
            <span class="mdi mdi-magnify"></span>
            <input v-model="searchQuery" placeholder="Search borrowers..." />
          </div>
          <button class="hs-btn hs-btn-primary" @click="showAddBorrowerForm = true">
            <span class="mdi mdi-plus"></span> Add Borrower
          </button>
        </div>

        <!-- Borrower Table -->
        <div v-if="filteredBorrowers.length === 0" class="hs-empty-state" style="padding: 60px 0;">
          <span class="mdi mdi-account-off-outline" style="font-size: 48px; color: var(--hs-gray-300);"></span>
          <p>No borrower profiles found</p>
          <button class="hs-btn hs-btn-primary" @click="showAddBorrowerForm = true">
            <span class="mdi mdi-plus"></span> Create First Borrower
          </button>
        </div>

        <div v-else class="hs-card hs-card--flush">
          <div class="hs-table-scroll">
            <table class="hs-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Purok</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in paginatedBorrowers" :key="b.borrower_id">
                  <td>
                    <div class="bp-table-name">
                      <div class="bp-avatar-sm"><span class="mdi mdi-account"></span></div>
                      <strong>{{ b.lastname }}, {{ b.firstname }} {{ b.middlename }} {{ b.suffix }}</strong>
                    </div>
                  </td>
                  <td>{{ b.purok || 'N/A' }}</td>
                  <td>
                    <div class="bp-table-actions">
                      <button class="hs-btn hs-btn-ghost hs-btn-sm" @click="openBorrowerDetail(b)" title="View Details">
                        <span class="mdi mdi-eye"></span> View
                      </button>
                      <button class="hs-btn hs-btn-ghost hs-btn-sm" @click="openMedicineForm(b)" title="Provide Medicine">
                        <span class="mdi mdi-pill"></span> Medicine
                      </button>
                      <button class="hs-btn hs-btn-ghost hs-btn-sm" @click="openToolForm(b)" title="Borrow Tool">
                        <span class="mdi mdi-wrench"></span> Borrow
                      </button>
                      <button class="hs-btn hs-btn-ghost hs-btn-sm" style="color:var(--hs-danger)" @click="deleteBorrower(b)" title="Delete Profile">
                        <span class="mdi mdi-delete-outline"></span> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="borrowerPagination.totalPages.value > 1" class="hs-pagination">
          <button class="hs-btn hs-btn-ghost hs-btn-sm" :disabled="borrowerPagination.currentPage.value === 1" @click="borrowerPagination.prevPage()">
            <span class="mdi mdi-chevron-left"></span>
          </button>
          <span class="hs-pagination-info">Page {{ borrowerPagination.currentPage.value }} of {{ borrowerPagination.totalPages.value }}</span>
          <button class="hs-btn hs-btn-ghost hs-btn-sm" :disabled="borrowerPagination.currentPage.value >= borrowerPagination.totalPages.value" @click="borrowerPagination.nextPage()">
            <span class="mdi mdi-chevron-right"></span>
          </button>
        </div>
      </div>

      <!-- ACTIVE BORROWS TAB -->
      <div v-if="activeTab === 'active_borrows'">
        <div v-if="activeBorrows.length === 0" class="hs-empty-state" style="padding: 60px 0;">
          <span class="mdi mdi-check-circle-outline" style="font-size: 48px; color: var(--hs-success);"></span>
          <p>No active tool borrows</p>
        </div>

        <div v-else class="hs-table-wrap">
          <table class="hs-table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Borrower</th>
                <th>Quantity</th>
                <th>Purpose</th>
                <th>Borrowed On</th>
                <th>Expected Return</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tx in activeBorrows" :key="tx.transaction_id">
                <td><strong>{{ tx.tool_name }}</strong></td>
                <td>{{ tx.borrower_profiles ? `${tx.borrower_profiles.lastname}, ${tx.borrower_profiles.firstname}` : 'N/A' }}</td>
                <td>{{ tx.quantity }}</td>
                <td>{{ tx.purpose || '—' }}</td>
                <td>{{ tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—' }}</td>
                <td>
                  <span :class="{ 'text-danger': tx.expected_return_date && new Date(tx.expected_return_date) < new Date() }">
                    {{ tx.expected_return_date ? new Date(tx.expected_return_date).toLocaleDateString() : '—' }}
                  </span>
                </td>
                <td>
                  <button class="hs-btn hs-btn-primary hs-btn-sm" @click="handleReturnTool(tx)">
                    <span class="mdi mdi-undo"></span> Return
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ANALYTICS TAB -->
      <div v-if="activeTab === 'analytics'" class="bp-analytics">
        <!-- Year / Month Filter -->
        <div class="hs-toolbar" style="margin-bottom:16px;">
          <div style="display:flex;gap:8px;align-items:center;">
            <select v-model.number="analyticsYear" class="hs-select hs-w-auto">
              <option v-for="y in analyticsAvailableYears" :key="y" :value="y">{{ y }}</option>
            </select>
            <select v-model="analyticsMonth" class="hs-select hs-w-auto">
              <option value="">All Months</option>
              <option v-for="(name, idx) in monthNames" :key="idx" :value="idx + 1">{{ name }}</option>
            </select>
          </div>
        </div>

        <!-- Summary Stats -->
        <div class="bp-analytics-summary">
          <div class="bp-summary-card">
            <div class="bp-summary-icon bp-summary-icon--primary"><span class="mdi mdi-account-group"></span></div>
            <div class="bp-summary-info">
              <div class="bp-summary-value">{{ borrowers.length }}</div>
              <div class="bp-summary-label">Total Borrowers</div>
            </div>
          </div>
          <div class="bp-summary-card">
            <div class="bp-summary-icon bp-summary-icon--success"><span class="mdi mdi-pill"></span></div>
            <div class="bp-summary-info">
              <div class="bp-summary-value">{{ topMedicines.reduce((s, m) => s + m.total_quantity, 0) }}</div>
              <div class="bp-summary-label">Medicine Provided</div>
            </div>
          </div>
          <div class="bp-summary-card">
            <div class="bp-summary-icon bp-summary-icon--info"><span class="mdi mdi-wrench"></span></div>
            <div class="bp-summary-info">
              <div class="bp-summary-value">{{ topTools.reduce((s, t) => s + t.total_quantity, 0) }}</div>
              <div class="bp-summary-label">Tools Borrowed</div>
            </div>
          </div>
          <div class="bp-summary-card">
            <div class="bp-summary-icon bp-summary-icon--warning"><span class="mdi mdi-swap-horizontal"></span></div>
            <div class="bp-summary-info">
              <div class="bp-summary-value">{{ activeBorrows.length }}</div>
              <div class="bp-summary-label">Active Borrows</div>
            </div>
          </div>
        </div>

        <div class="bp-analytics-grid">
          <!-- Most Requested Medicine -->
          <div class="bp-analytics-card">
            <div class="bp-analytics-card-header">
              <span class="bp-analytics-card-icon bp-analytics-card-icon--success"><span class="mdi mdi-pill"></span></span>
              <h3>Most Requested Medicines</h3>
            </div>
            <div v-if="topMedicines.length === 0" class="hs-empty-state" style="padding: 30px;">
              <p>No medicine transaction data yet</p>
            </div>
            <div v-else class="bp-rank-list">
              <div v-for="(med, idx) in topMedicines" :key="med.medicine_id" class="bp-rank-item">
                <span class="bp-rank-num" :class="{ 'bp-rank-num--gold': idx === 0, 'bp-rank-num--silver': idx === 1, 'bp-rank-num--bronze': idx === 2 }">{{ idx + 1 }}</span>
                <div class="bp-rank-info">
                  <div class="bp-rank-name">{{ med.medicine_name }}</div>
                  <div class="bp-rank-meta">{{ med.request_count }} requests &middot; {{ med.total_quantity }} total provided</div>
                </div>
                <div class="bp-rank-bar-wrap">
                  <div class="bp-rank-bar" :style="{ width: (topMedicines[0].total_quantity > 0 ? (med.total_quantity / topMedicines[0].total_quantity) * 100 : 0) + '%', background: 'var(--hs-success)' }"></div>
                </div>
                <span class="bp-rank-qty">{{ med.total_quantity }}</span>
              </div>
            </div>
          </div>

          <!-- Most Borrowed Tools -->
          <div class="bp-analytics-card">
            <div class="bp-analytics-card-header">
              <span class="bp-analytics-card-icon bp-analytics-card-icon--info"><span class="mdi mdi-wrench"></span></span>
              <h3>Most Borrowed Tools</h3>
            </div>
            <div v-if="topTools.length === 0" class="hs-empty-state" style="padding: 30px;">
              <p>No tool borrow data yet</p>
            </div>
            <div v-else class="bp-rank-list">
              <div v-for="(tool, idx) in topTools" :key="tool.tool_id" class="bp-rank-item">
                <span class="bp-rank-num" :class="{ 'bp-rank-num--gold': idx === 0, 'bp-rank-num--silver': idx === 1, 'bp-rank-num--bronze': idx === 2 }">{{ idx + 1 }}</span>
                <div class="bp-rank-info">
                  <div class="bp-rank-name">{{ tool.tool_name }}</div>
                  <div class="bp-rank-meta">{{ tool.borrow_count }} borrows &middot; {{ tool.total_quantity }} total units</div>
                </div>
                <div class="bp-rank-bar-wrap">
                  <div class="bp-rank-bar" :style="{ width: (topTools[0].total_quantity > 0 ? (tool.total_quantity / topTools[0].total_quantity) * 100 : 0) + '%', background: 'var(--hs-info)' }"></div>
                </div>
                <span class="bp-rank-qty">{{ tool.total_quantity }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Monthly Trends -->
        <div class="bp-analytics-card" style="margin-top: 20px;">
          <div class="bp-analytics-card-header">
            <span class="bp-analytics-card-icon bp-analytics-card-icon--primary"><span class="mdi mdi-chart-timeline-variant"></span></span>
            <h3>Monthly Usage Trends</h3>
          </div>
          <div class="bp-trends-grid">
            <div>
              <h4><span class="mdi mdi-pill" style="color: var(--hs-success); margin-right: 4px;"></span> Medicine Requests</h4>
              <div v-if="monthlyTrends.medicine.length === 0" class="bp-trend-empty">No data yet</div>
              <div v-else class="bp-trend-list">
                <div v-for="m in monthlyTrends.medicine" :key="m.month" class="bp-trend-item">
                  <span class="bp-trend-month">{{ m.month }}</span>
                  <div class="bp-trend-bar-wrap">
                    <div
                      class="bp-trend-bar"
                      :style="{ width: (monthlyTrends.medicine[0].total_quantity > 0 ? (m.total_quantity / Math.max(...monthlyTrends.medicine.map(x => x.total_quantity))) * 100 : 0) + '%', background: 'var(--hs-success)' }"
                    ></div>
                  </div>
                  <span class="bp-trend-count">{{ m.total_quantity }}</span>
                </div>
              </div>
            </div>
            <div>
              <h4><span class="mdi mdi-wrench" style="color: var(--hs-info); margin-right: 4px;"></span> Tool Borrows</h4>
              <div v-if="monthlyTrends.tools.length === 0" class="bp-trend-empty">No data yet</div>
              <div v-else class="bp-trend-list">
                <div v-for="t in monthlyTrends.tools" :key="t.month" class="bp-trend-item">
                  <span class="bp-trend-month">{{ t.month }}</span>
                  <div class="bp-trend-bar-wrap">
                    <div
                      class="bp-trend-bar"
                      :style="{ width: (monthlyTrends.tools[0].total_quantity > 0 ? (t.total_quantity / Math.max(...monthlyTrends.tools.map(x => x.total_quantity))) * 100 : 0) + '%', background: 'var(--hs-info)' }"
                    ></div>
                  </div>
                  <span class="bp-trend-count">{{ t.total_quantity }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- MODALS -->

    <!-- Add Borrower Modal -->
    <div v-if="showAddBorrowerForm" class="hs-modal-overlay" @click.self="showAddBorrowerForm = false">
      <div class="hs-modal" style="max-width: 600px;">
        <div class="hs-modal-header">
          <h2><span class="mdi mdi-account-plus"></span> Add Borrower Profile</h2>
          <button class="hs-btn-icon" @click="showAddBorrowerForm = false"><span class="mdi mdi-close"></span></button>
        </div>
        <div class="hs-modal-body">
          <!-- From household member -->
          <div class="bp-add-section">
            <h3>From Household Member</h3>
            <p class="hs-text-muted">Search for an existing household member to create a linked borrower profile.</p>
            <div class="hs-search-box" style="margin: 12px 0;">
              <span class="mdi mdi-magnify"></span>
              <input v-model="memberSearchQuery" placeholder="Search by name..." />
            </div>
            <div class="bp-member-list">
              <div
                v-for="m in filteredMembers"
                :key="m.member_id"
                class="bp-member-item"
                @click="addBorrowerFromMember(m)"
              >
                <span class="mdi mdi-account-outline"></span>
                <div>
                  <strong>{{ m.lastname }}, {{ m.firstname }} {{ m.middlename }}</strong>
                  <div class="hs-text-muted">{{ m.purok || 'No purok' }}</div>
                </div>
                <span class="mdi mdi-plus-circle" style="margin-left: auto; color: var(--hs-primary);"></span>
              </div>
              <div v-if="filteredMembers.length === 0" class="hs-text-muted" style="padding: 12px; text-align: center;">
                No members found
              </div>
            </div>
          </div>

          <div class="bp-divider">
            <span>OR</span>
          </div>

          <!-- Manual entry -->
          <div class="bp-add-section">
            <h3>Manual Entry</h3>
            <p class="hs-text-muted">Create a borrower profile without linking to a household member.</p>
            <div class="hs-form-grid">
              <div class="hs-form-group">
                <label>First Name *</label>
                <input v-model="addBorrowerForm.firstname" class="hs-input" placeholder="First name" />
              </div>
              <div class="hs-form-group">
                <label>Last Name *</label>
                <input v-model="addBorrowerForm.lastname" class="hs-input" placeholder="Last name" />
              </div>
              <div class="hs-form-group">
                <label>Middle Name</label>
                <input v-model="addBorrowerForm.middlename" class="hs-input" placeholder="Middle name" />
              </div>
              <div class="hs-form-group">
                <label>Purok</label>
                <input v-model="addBorrowerForm.purok" class="hs-input" placeholder="Purok" />
              </div>
            </div>
            <button class="hs-btn hs-btn-primary" style="margin-top: 12px;" @click="addBorrowerManual">
              <span class="mdi mdi-check"></span> Create Profile
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Medicine Request Modal -->
    <div v-if="showMedicineForm" class="hs-modal-overlay" @click.self="showMedicineForm = false">
      <div class="hs-modal" style="max-width: 480px;">
        <div class="hs-modal-header">
          <h2><span class="mdi mdi-pill"></span> Provide Medicine</h2>
          <button class="hs-btn-icon" @click="showMedicineForm = false"><span class="mdi mdi-close"></span></button>
        </div>
        <div class="hs-modal-body">
          <div class="hs-form-group">
            <label>Medicine *</label>
            <select v-model="medicineForm.medicine_id" class="hs-input">
              <option value="">— Select Medicine —</option>
              <option v-for="m in medicines.filter(m => m.quantity > 0)" :key="m.medicine_id" :value="m.medicine_id">
                {{ m.name }} ({{ m.quantity }} available)
              </option>
            </select>
          </div>
          <div class="hs-form-group">
            <label>Quantity *</label>
            <input v-model.number="medicineForm.quantity" type="number" min="1" class="hs-input" />
          </div>
          <div class="hs-form-group">
            <label>Purpose</label>
            <input v-model="medicineForm.purpose" class="hs-input" placeholder="Reason for request" />
          </div>
          <div class="hs-form-group">
            <label>Prescribed By</label>
            <input v-model="medicineForm.prescribed_by" class="hs-input" placeholder="Doctor/BHW name" />
          </div>
        </div>
        <div class="hs-modal-footer">
          <button class="hs-btn hs-btn-ghost" @click="showMedicineForm = false">Cancel</button>
          <button class="hs-btn hs-btn-primary" @click="submitMedicineRequest">
            <span class="mdi mdi-check"></span> Confirm
          </button>
        </div>
      </div>
    </div>

    <!-- Tool Borrow Modal -->
    <div v-if="showToolForm" class="hs-modal-overlay" @click.self="showToolForm = false">
      <div class="hs-modal" style="max-width: 480px;">
        <div class="hs-modal-header">
          <h2><span class="mdi mdi-wrench"></span> Borrow Tool</h2>
          <button class="hs-btn-icon" @click="showToolForm = false"><span class="mdi mdi-close"></span></button>
        </div>
        <div class="hs-modal-body">
          <div class="hs-form-group">
            <label>Tool *</label>
            <select v-model="toolForm.tool_id" class="hs-input">
              <option value="">— Select Tool —</option>
              <option v-for="t in tools.filter(t => t.quantity > 0)" :key="t.tool_id" :value="t.tool_id">
                {{ t.name }} ({{ t.quantity }} available)
              </option>
            </select>
          </div>
          <div class="hs-form-group">
            <label>Quantity *</label>
            <input v-model.number="toolForm.quantity" type="number" min="1" class="hs-input" />
          </div>
          <div class="hs-form-group">
            <label>Purpose</label>
            <input v-model="toolForm.purpose" class="hs-input" placeholder="Reason for borrowing" />
          </div>
          <div class="hs-form-group">
            <label>Expected Return Date</label>
            <input v-model="toolForm.expected_return_date" type="date" class="hs-input" />
          </div>
        </div>
        <div class="hs-modal-footer">
          <button class="hs-btn hs-btn-ghost" @click="showToolForm = false">Cancel</button>
          <button class="hs-btn hs-btn-primary" @click="submitToolBorrow">
            <span class="mdi mdi-check"></span> Borrow
          </button>
        </div>
      </div>
    </div>

    <!-- Borrower Detail Modal -->
    <div v-if="showBorrowerDetail && selectedBorrower" class="hs-modal-overlay" @click.self="closeBorrowerDetail">
      <div class="hs-modal" style="max-width: 700px;">
        <div class="hs-modal-header">
          <h2><span class="mdi mdi-account-details"></span> {{ selectedBorrower.lastname }}, {{ selectedBorrower.firstname }}</h2>
          <button class="hs-btn-icon" @click="closeBorrowerDetail"><span class="mdi mdi-close"></span></button>
        </div>
        <div class="hs-modal-body">
          <div class="bp-detail-info">
            <div><strong>Purok:</strong> {{ selectedBorrower.purok || 'N/A' }}</div>
            <div><strong>Barangay:</strong> {{ selectedBorrower.barangay || 'N/A' }}</div>
            <div><strong>Linked Member:</strong> {{ selectedBorrower.member_id ? 'Yes' : 'No' }}</div>
          </div>

          <h3 style="margin-top: 20px;"><span class="mdi mdi-pill"></span> Medicine History ({{ selectedBorrower.medicine_transactions.length }})</h3>
          <div v-if="selectedBorrower.medicine_transactions.length === 0" class="hs-text-muted" style="padding: 12px;">
            No medicine transactions
          </div>
          <div v-else class="bp-tx-list">
            <div v-for="tx in selectedBorrower.medicine_transactions" :key="tx.transaction_id" class="bp-tx-item">
              <span class="mdi mdi-pill" style="color: #4CAF50;"></span>
              <div class="bp-tx-info">
                <strong>{{ tx.medicine_name }}</strong> &times; {{ tx.quantity }}
                <div class="hs-text-muted">{{ tx.purpose || 'No purpose specified' }} &middot; {{ new Date(tx.created_at).toLocaleDateString() }}</div>
              </div>
            </div>
          </div>

          <h3 style="margin-top: 20px;"><span class="mdi mdi-wrench"></span> Tool History ({{ selectedBorrower.tool_transactions.length }})</h3>
          <div v-if="selectedBorrower.tool_transactions.length === 0" class="hs-text-muted" style="padding: 12px;">
            No tool transactions
          </div>
          <div v-else class="bp-tx-list">
            <div v-for="tx in selectedBorrower.tool_transactions" :key="tx.transaction_id" class="bp-tx-item">
              <span class="mdi mdi-wrench" :style="{ color: tx.status === 'returned' ? '#4CAF50' : '#FF9800' }"></span>
              <div class="bp-tx-info">
                <strong>{{ tx.tool_name }}</strong> &times; {{ tx.quantity }}
                <span class="bp-status-badge" :class="tx.status === 'returned' ? 'bp-status-returned' : 'bp-status-borrowed'">
                  {{ tx.status || 'borrowed' }}
                </span>
                <div class="hs-text-muted">{{ tx.purpose || 'No purpose' }} &middot; {{ new Date(tx.created_at).toLocaleDateString() }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Borrower Profiling Styles */
.bp-table-name {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bp-avatar-sm {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--hs-primary-bg, #e3f2fd);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bp-avatar-sm .mdi {
  font-size: 16px;
  color: var(--hs-primary);
}
.bp-table-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.hs-card--flush { overflow: hidden; min-width: 0; max-width: 100%; }
.hs-card--flush .hs-table-scroll { overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 340px); }
.hs-card--flush .hs-table { min-width: 500px; table-layout: auto; }

/* Add borrower */
.bp-add-section h3 {
  font-size: var(--hs-font-size-base);
  font-weight: 600;
  margin-bottom: 4px;
}
.bp-member-list {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--hs-border);
  border-radius: var(--hs-radius-md);
}
.bp-member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid var(--hs-border);
}
.bp-member-item:last-child {
  border-bottom: none;
}
.bp-member-item:hover {
  background: var(--hs-gray-50);
}
.bp-divider {
  text-align: center;
  margin: 20px 0;
  position: relative;
}
.bp-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  border-top: 1px solid var(--hs-border);
}
.bp-divider span {
  background: var(--hs-white);
  padding: 0 12px;
  position: relative;
  color: var(--hs-gray-400);
  font-size: var(--hs-font-size-sm);
}

/* Detail modal */
.bp-detail-info {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  padding: 12px 0;
  border-bottom: 1px solid var(--hs-border);
}

.bp-tx-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.bp-tx-item {
  display: flex;
  align-items: start;
  gap: 10px;
  padding: 10px;
  background: var(--hs-gray-50);
  border-radius: var(--hs-radius-md);
}
.bp-tx-info {
  flex: 1;
}
.bp-status-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  margin-left: 8px;
}
.bp-status-borrowed {
  background: #FFF3E0;
  color: #E65100;
}
.bp-status-returned {
  background: #E8F5E9;
  color: #2E7D32;
}

/* Analytics */
.bp-analytics-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.bp-summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--hs-white);
  border: 1px solid var(--hs-border);
  border-radius: var(--hs-radius-lg);
}
.bp-summary-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--hs-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.bp-summary-icon--primary { background: var(--hs-primary-bg); color: var(--hs-primary); }
.bp-summary-icon--success { background: var(--hs-success-bg); color: var(--hs-success); }
.bp-summary-icon--info { background: var(--hs-info-bg); color: var(--hs-info); }
.bp-summary-icon--warning { background: var(--hs-warning-bg); color: var(--hs-warning); }
.bp-summary-value {
  font-size: var(--hs-font-size-xl);
  font-weight: 700;
  color: var(--hs-gray-800);
  line-height: 1;
}
.bp-summary-label {
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-500);
  margin-top: 2px;
}

.bp-analytics-card {
  background: var(--hs-white);
  border: 1px solid var(--hs-border);
  border-radius: var(--hs-radius-lg);
  padding: 24px;
}
.bp-analytics-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.bp-analytics-card-header h3 {
  font-size: var(--hs-font-size-base);
  font-weight: 600;
  color: var(--hs-gray-800);
  margin: 0;
}
.bp-analytics-card-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--hs-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.bp-analytics-card-icon--success { background: var(--hs-success-bg); color: var(--hs-success); }
.bp-analytics-card-icon--info { background: var(--hs-info-bg); color: var(--hs-info); }
.bp-analytics-card-icon--primary { background: var(--hs-primary-bg); color: var(--hs-primary); }
.bp-analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}
.bp-rank-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bp-rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bp-rank-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--hs-gray-100);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  color: var(--hs-gray-600);
  flex-shrink: 0;
}
.bp-rank-num--gold { background: #FFF8E1; color: #F9A825; }
.bp-rank-num--silver { background: #ECEFF1; color: #78909C; }
.bp-rank-num--bronze { background: #FBE9E7; color: #BF360C; }
.bp-rank-qty {
  font-size: var(--hs-font-size-sm);
  font-weight: 700;
  color: var(--hs-gray-700);
  min-width: 32px;
  text-align: right;
}
.bp-rank-info {
  flex: 1;
  min-width: 0;
}
.bp-rank-name {
  font-weight: 600;
  font-size: var(--hs-font-size-sm);
}
.bp-rank-meta {
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-500);
}
.bp-rank-bar-wrap {
  width: 80px;
  height: 8px;
  background: var(--hs-gray-100);
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}
.bp-rank-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
}

/* Trends */
.bp-trends-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.bp-trends-grid h4 {
  margin-bottom: 10px;
  font-size: var(--hs-font-size-sm);
  font-weight: 600;
  color: var(--hs-gray-700);
}
.bp-trend-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bp-trend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bp-trend-month {
  width: 60px;
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-600);
  flex-shrink: 0;
}
.bp-trend-bar-wrap {
  flex: 1;
  height: 12px;
  background: var(--hs-gray-100);
  border-radius: 6px;
  overflow: hidden;
}
.bp-trend-bar {
  height: 100%;
  border-radius: 6px;
  transition: width 0.6s ease;
}
.bp-trend-count {
  width: 36px;
  text-align: right;
  font-size: var(--hs-font-size-xs);
  font-weight: 600;
  color: var(--hs-gray-800);
}
.bp-trend-empty {
  padding: 20px;
  text-align: center;
  color: var(--hs-gray-400);
  font-size: var(--hs-font-size-sm);
}

.text-danger {
  color: var(--hs-danger, #e53935);
  font-weight: 600;
}

@media (max-width: 768px) {
  .bp-analytics-grid {
    grid-template-columns: 1fr;
  }
  .bp-analytics-summary {
    grid-template-columns: repeat(2, 1fr);
  }
  .bp-trends-grid {
    grid-template-columns: 1fr;
  }
}
</style>
