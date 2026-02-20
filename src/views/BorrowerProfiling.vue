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

const loading = ref(true)
const activeTab = ref('borrowers') // 'borrowers' | 'medicine_log' | 'tool_log' | 'analytics'
const userBarangay = ref('')

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

async function loadAnalytics() {
  try {
    const [topMed, topTool, trends, borrows] = await Promise.all([
      getMostRequestedMedicines(10),
      getMostBorrowedTools(10),
      getMonthlyUsageTrends(6),
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
    prescribed_by: '',
  }
  showMedicineForm.value = true
}

async function submitMedicineRequest() {
  try {
    if (!medicineForm.value.medicine_id) return toast.warning('Select a medicine')
    if (!medicineForm.value.quantity || medicineForm.value.quantity < 1) return toast.warning('Quantity must be at least 1')

    await createMedicineTransaction(medicineForm.value)
    toast.success('Medicine dispensed successfully')
    showMedicineForm.value = false
    await Promise.all([loadData(), loadAnalytics()])
  } catch (err) {
    toast.error(err.message || 'Failed to dispense medicine')
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
    await loadAnalytics()
  } catch (err) {
    toast.error(err.message || 'Failed to return tool')
    console.error(err)
  }
}

watch(activeTab, (tab) => {
  if (tab === 'analytics') {
    loadAnalytics()
  }
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
        <h1 class="hs-page-title"><span class="mdi mdi-account-cash-outline"></span> Borrower & Patient Profiling</h1>
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

        <!-- Borrower Cards -->
        <div v-if="filteredBorrowers.length === 0" class="hs-empty-state" style="padding: 60px 0;">
          <span class="mdi mdi-account-off-outline" style="font-size: 48px; color: var(--hs-gray-300);"></span>
          <p>No borrower profiles found</p>
          <button class="hs-btn hs-btn-primary" @click="showAddBorrowerForm = true">
            <span class="mdi mdi-plus"></span> Create First Borrower
          </button>
        </div>

        <div v-else class="bp-grid">
          <div v-for="b in paginatedBorrowers" :key="b.borrower_id" class="bp-card">
            <div class="bp-card-header">
              <div class="bp-avatar">
                <span class="mdi mdi-account"></span>
              </div>
              <div class="bp-card-info">
                <div class="bp-card-name">{{ b.lastname }}, {{ b.firstname }} {{ b.middlename }} {{ b.suffix }}</div>
                <div class="bp-card-meta">
                  <span class="mdi mdi-map-marker"></span> {{ b.purok || 'N/A' }}
                </div>
              </div>
            </div>
            <div class="bp-card-actions">
              <button class="hs-btn hs-btn-ghost hs-btn-sm" @click="openBorrowerDetail(b)" title="View Details">
                <span class="mdi mdi-eye"></span> View
              </button>
              <button class="hs-btn hs-btn-ghost hs-btn-sm" @click="openMedicineForm(b)" title="Dispense Medicine">
                <span class="mdi mdi-pill"></span> Medicine
              </button>
              <button class="hs-btn hs-btn-ghost hs-btn-sm" @click="openToolForm(b)" title="Borrow Tool">
                <span class="mdi mdi-wrench"></span> Borrow
              </button>
            </div>
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
        <div class="bp-analytics-grid">
          <!-- Most Requested Medicine -->
          <div class="hs-card" style="padding: 24px;">
            <h3 class="hs-card-title"><span class="mdi mdi-pill"></span> Most Requested Medicines</h3>
            <div v-if="topMedicines.length === 0" class="hs-empty-state" style="padding: 30px;">
              <p>No medicine transaction data yet</p>
            </div>
            <div v-else class="bp-rank-list">
              <div v-for="(med, idx) in topMedicines" :key="med.medicine_id" class="bp-rank-item">
                <span class="bp-rank-num">{{ idx + 1 }}</span>
                <div class="bp-rank-info">
                  <div class="bp-rank-name">{{ med.medicine_name }}</div>
                  <div class="bp-rank-meta">{{ med.request_count }} requests &middot; {{ med.total_quantity }} total dispensed</div>
                </div>
                <div class="bp-rank-bar-wrap">
                  <div class="bp-rank-bar" :style="{ width: (topMedicines[0].total_quantity > 0 ? (med.total_quantity / topMedicines[0].total_quantity) * 100 : 0) + '%', background: '#4CAF50' }"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Most Borrowed Tools -->
          <div class="hs-card" style="padding: 24px;">
            <h3 class="hs-card-title"><span class="mdi mdi-wrench"></span> Most Borrowed Tools</h3>
            <div v-if="topTools.length === 0" class="hs-empty-state" style="padding: 30px;">
              <p>No tool borrow data yet</p>
            </div>
            <div v-else class="bp-rank-list">
              <div v-for="(tool, idx) in topTools" :key="tool.tool_id" class="bp-rank-item">
                <span class="bp-rank-num">{{ idx + 1 }}</span>
                <div class="bp-rank-info">
                  <div class="bp-rank-name">{{ tool.tool_name }}</div>
                  <div class="bp-rank-meta">{{ tool.borrow_count }} borrows &middot; {{ tool.total_quantity }} total units</div>
                </div>
                <div class="bp-rank-bar-wrap">
                  <div class="bp-rank-bar" :style="{ width: (topTools[0].total_quantity > 0 ? (tool.total_quantity / topTools[0].total_quantity) * 100 : 0) + '%', background: '#2196F3' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Monthly Trends -->
        <div class="hs-card" style="margin-top: 20px; padding: 24px;">
          <h3 class="hs-card-title"><span class="mdi mdi-chart-timeline-variant"></span> Monthly Usage Trends</h3>
          <div class="bp-trends-grid">
            <div>
              <h4>Medicine Requests</h4>
              <div v-if="monthlyTrends.medicine.length === 0" class="bp-trend-empty">No data yet</div>
              <div v-else class="bp-trend-list">
                <div v-for="m in monthlyTrends.medicine" :key="m.month" class="bp-trend-item">
                  <span class="bp-trend-month">{{ m.month }}</span>
                  <div class="bp-trend-bar-wrap">
                    <div
                      class="bp-trend-bar"
                      :style="{ width: (monthlyTrends.medicine[0].total_quantity > 0 ? (m.total_quantity / Math.max(...monthlyTrends.medicine.map(x => x.total_quantity))) * 100 : 0) + '%', background: '#4CAF50' }"
                    ></div>
                  </div>
                  <span class="bp-trend-count">{{ m.total_quantity }}</span>
                </div>
              </div>
            </div>
            <div>
              <h4>Tool Borrows</h4>
              <div v-if="monthlyTrends.tools.length === 0" class="bp-trend-empty">No data yet</div>
              <div v-else class="bp-trend-list">
                <div v-for="t in monthlyTrends.tools" :key="t.month" class="bp-trend-item">
                  <span class="bp-trend-month">{{ t.month }}</span>
                  <div class="bp-trend-bar-wrap">
                    <div
                      class="bp-trend-bar"
                      :style="{ width: (monthlyTrends.tools[0].total_quantity > 0 ? (t.total_quantity / Math.max(...monthlyTrends.tools.map(x => x.total_quantity))) * 100 : 0) + '%', background: '#2196F3' }"
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
          <h2><span class="mdi mdi-pill"></span> Dispense Medicine</h2>
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
            <span class="mdi mdi-check"></span> Dispense
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
.bp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.bp-card {
  background: var(--hs-white);
  border-radius: var(--hs-radius-lg);
  border: 1px solid var(--hs-border);
  padding: 16px;
  transition: box-shadow 0.2s;
}
.bp-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.bp-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.bp-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--hs-primary-bg, #e3f2fd);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bp-avatar .mdi {
  font-size: 22px;
  color: var(--hs-primary);
}
.bp-card-name {
  font-weight: 600;
  font-size: var(--hs-font-size-base);
  color: var(--hs-gray-900);
}
.bp-card-meta {
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-500);
  display: flex;
  align-items: center;
  gap: 4px;
}

.bp-card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  border-top: 1px solid var(--hs-border);
  padding-top: 12px;
}

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
  .bp-grid {
    grid-template-columns: 1fr;
  }
  .bp-analytics-grid {
    grid-template-columns: 1fr;
  }
  .bp-trends-grid {
    grid-template-columns: 1fr;
  }
}
</style>
