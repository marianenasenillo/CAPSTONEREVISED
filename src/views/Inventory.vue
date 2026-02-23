<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import toolsApi from '@/utils/tools'
import medicineApi from '@/utils/medicine'
import { supabase } from '@/utils/supabase'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const activeTab = ref('medicine')
const medSearchQuery = ref('')
const toolSearchQuery = ref('')
const logSearchQuery = ref('')

const tools = ref([])
const medicine = ref([])
const medTransactions = ref([])
const toolTransactions = ref([])
const loading = ref(true)
const userRole = ref(null)

const showDetailModal = ref(false)
const detailItem = ref(null)
const detailType = ref('medicine')
const openDetail = (item, type) => { detailItem.value = item; detailType.value = type; showDetailModal.value = true }

const totalMedicineItems = computed(() => medicine.value.length)
const totalTools = computed(() => tools.value.length)
const totalMedicineStock = computed(() => medicine.value.reduce((s, m) => s + (m.quantity || 0), 0))
const totalToolStock = computed(() => tools.value.reduce((s, t) => s + (t.quantity || 0), 0))
const lowStockMedicine = computed(() => medicine.value.filter(m => m.quantity > 0 && m.quantity <= 5))
const outOfStockMedicine = computed(() => medicine.value.filter(m => m.quantity <= 0))
const lowStockTools = computed(() => tools.value.filter(t => t.quantity > 0 && t.quantity <= 5))
const outOfStockTools = computed(() => tools.value.filter(t => t.quantity <= 0))
const lowStockCount = computed(() => lowStockMedicine.value.length + lowStockTools.value.length)
const outOfStockCount = computed(() => outOfStockMedicine.value.length + outOfStockTools.value.length)
const totalDistributed = computed(() => medTransactions.value.length + toolTransactions.value.length)

const getStockLevel = (qty) => {
  if (qty <= 0) return { label: 'Out of Stock', color: 'danger', percent: 0 }
  if (qty <= 5) return { label: 'Critical', color: 'danger', percent: Math.min(qty / 50 * 100, 100) }
  if (qty <= 15) return { label: 'Low', color: 'warning', percent: Math.min(qty / 50 * 100, 100) }
  return { label: 'In Stock', color: 'success', percent: Math.min(qty / 50 * 100, 100) }
}

const filteredMedicine = computed(() => {
  if (!medSearchQuery.value.trim()) return medicine.value
  const q = medSearchQuery.value.toLowerCase()
  return medicine.value.filter(med => med.name.toLowerCase().includes(q))
})
const filteredTools = computed(() => {
  if (!toolSearchQuery.value.trim()) return tools.value
  const q = toolSearchQuery.value.toLowerCase()
  return tools.value.filter(tool => tool.name.toLowerCase().includes(q))
})

// Distribution logs — merge medicine_transactions + tool_transactions
const distributionLogs = computed(() => {
  const medLogs = medTransactions.value.map(item => ({
    ...item,
    _type: 'Medicine',
    _item_name: item.medicine_name,
    _table: 'medicine_transactions',
  }))
  const toolLogs = toolTransactions.value.map(item => ({
    ...item,
    _type: 'Tool',
    _item_name: item.tool_name,
    _table: 'tool_transactions',
  }))
  return [...medLogs, ...toolLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
})
const filteredLogs = computed(() => {
  if (!logSearchQuery.value.trim()) return distributionLogs.value
  const q = logSearchQuery.value.toLowerCase()
  return distributionLogs.value.filter(log =>
    (log._item_name && log._item_name.toLowerCase().includes(q)) ||
    (log.recipient_name && log.recipient_name.toLowerCase().includes(q)) ||
    (log.recipient_purok && log.recipient_purok.toLowerCase().includes(q)) ||
    (log._type && log._type.toLowerCase().includes(q)) ||
    (log.purpose && log.purpose.toLowerCase().includes(q)) ||
    (log.transaction_type && log.transaction_type.toLowerCase().includes(q)) ||
    (log.notes && log.notes.toLowerCase().includes(q))
  )
})

const showNotesModal = ref(false)
const editingLog = ref(null)
const editNotesValue = ref('')
const openNotesModal = (log) => {
  editingLog.value = log
  editNotesValue.value = log.notes || ''
  showNotesModal.value = true
}
const saveNotes = async () => {
  if (!editingLog.value) return
  try {
    const txId = editingLog.value.transaction_id
    const table = editingLog.value._table
    if (!txId || !table) {
      toast.error('Cannot identify transaction to update.')
      return
    }
    if (table === 'medicine_transactions') {
      await medicineApi.updateMedicineTransaction(txId, { notes: editNotesValue.value })
    } else {
      await toolsApi.updateToolTransaction(txId, { notes: editNotesValue.value })
    }
    editingLog.value.notes = editNotesValue.value
    // Refresh local transaction data to keep in sync
    try {
      medTransactions.value = await medicineApi.listAvailedMedicine()
      toolTransactions.value = await toolsApi.listAvailedTools()
    } catch { /* non-critical refresh */ }
    showNotesModal.value = false
    toast.success('Notes updated successfully.')
  } catch (err) {
    console.error('Failed to update notes:', err)
    // Fallback: try direct supabase update
    try {
      const table = editingLog.value._table
      const txId = editingLog.value.transaction_id
      const { error: fbErr } = await supabase.from(table).update({ notes: editNotesValue.value }).eq('transaction_id', txId)
      if (fbErr) throw fbErr
      editingLog.value.notes = editNotesValue.value
      showNotesModal.value = false
      toast.success('Notes updated successfully.')
      return
    } catch { /* fallback also failed */ }
    toast.error('Failed to update notes: ' + (err.message || err))
  }
}

const showTxDetailModal = ref(false)
const txDetailItem = ref(null)
const openTxDetail = (log) => { txDetailItem.value = log; showTxDetailModal.value = true }

const {
  currentPage, itemsPerPage, itemsPerPageOptions, totalItems, totalPages,
  paginatedData: paginatedLogs, startIndex, endIndex, visiblePages,
  goToPage, nextPage, prevPage, firstPage, lastPage, resetPage,
} = usePagination(filteredLogs)
watch(logSearchQuery, () => resetPage())

const showAddMedicineModal = ref(false)
const addMedicineForm = ref({ name: '', quantity: 1, expiration: '' })
const openAddMedicineModal = () => { addMedicineForm.value = { name: '', quantity: 1, expiration: '' }; showAddMedicineModal.value = true }
const confirmAddMedicine = async () => {
  if (!addMedicineForm.value.name || !(addMedicineForm.value.quantity > 0)) { toast.warning('Please provide a valid name and quantity.'); return }

  // Duplicate check: same name + same expiration date
  const normName = addMedicineForm.value.name.trim().toLowerCase()
  const formExp = addMedicineForm.value.expiration || null
  const duplicate = medicine.value.find(m => {
    const sameName = m.name.trim().toLowerCase() === normName
    const existingExp = m.expiration ? m.expiration.split('T')[0] : null
    return sameName && existingExp === formExp
  })
  if (duplicate) {
    toast.warning(`"${duplicate.name}" with the same expiration date already exists. Use Stock In to add more quantity.`)
    return
  }

  try {
    await medicineApi.createMedicine({
      name: addMedicineForm.value.name, quantity: addMedicineForm.value.quantity,
      expiration: addMedicineForm.value.expiration ? new Date(addMedicineForm.value.expiration).toISOString() : null
    })
    medicine.value = await medicineApi.listMedicine()
    showAddMedicineModal.value = false
    toast.success('Medicine added successfully.')
  } catch (err) { console.error('Failed to create medicine', err); toast.error('Failed to add medicine: ' + (err.message || err)) }
}

const showAddToolModal = ref(false)
const addToolForm = ref({ name: '', quantity: 1 })
const openAddToolModal = () => { addToolForm.value = { name: '', quantity: 1 }; showAddToolModal.value = true }
const confirmAddTool = async () => {
  if (!addToolForm.value.name || !(addToolForm.value.quantity > 0)) { toast.warning('Please provide a valid name and quantity.'); return }

  // Duplicate check: same name (tools don't have expiration)
  const normName = addToolForm.value.name.trim().toLowerCase()
  const duplicate = tools.value.find(t => t.name.trim().toLowerCase() === normName)
  if (duplicate) {
    toast.warning(`"${duplicate.name}" already exists. Use Stock In to add more quantity.`)
    return
  }

  try {
    await toolsApi.createTool({ name: addToolForm.value.name, quantity: addToolForm.value.quantity })
    tools.value = await toolsApi.listTools()
    showAddToolModal.value = false
    toast.success('Tool added successfully.')
  } catch (err) { console.error('Failed to create tool', err); toast.error('Failed to add tool: ' + (err.message || err)) }
}

const showEditMedicineModal = ref(false)
const editMedicineForm = ref({ name: '', quantity: 0, expiration: '' })
const editingMedicine = ref(null)
const openEditMedicine = (med) => {
  editingMedicine.value = med
  editMedicineForm.value = { name: med.name, quantity: med.quantity, expiration: med.expiration ? new Date(med.expiration).toISOString().split('T')[0] : '' }
  showEditMedicineModal.value = true
}
const confirmEditMedicine = async () => {
  if (!editMedicineForm.value.name) { toast.warning('Name is required.'); return }
  try {
    await medicineApi.updateMedicine(editingMedicine.value.medicine_id, {
      name: editMedicineForm.value.name, quantity: Number(editMedicineForm.value.quantity),
      expiration: editMedicineForm.value.expiration ? new Date(editMedicineForm.value.expiration).toISOString() : null
    })
    medicine.value = await medicineApi.listMedicine()
    showEditMedicineModal.value = false; showDetailModal.value = false
    toast.success('Medicine updated successfully.')
  } catch (err) { console.error('Failed to update medicine', err); toast.error('Failed to update medicine: ' + (err.message || err)) }
}
const confirmDeleteMedicine = async (med) => {
  if (!confirm(`Delete "${med.name}"? This will also remove all related transaction records. This action cannot be undone.`)) return
  try {
    await medicineApi.deleteMedicine(med.medicine_id)
    medicine.value = await medicineApi.listMedicine()
    medTransactions.value = await medicineApi.listAvailedMedicine()
    showDetailModal.value = false
    toast.success('Medicine deleted successfully.')
  } catch (err) { console.error('Failed to delete medicine', err); toast.error('Failed to delete medicine: ' + (err.message || err)) }
}

const showEditToolModal = ref(false)
const editToolForm = ref({ name: '', quantity: 0 })
const editingTool = ref(null)
const openEditTool = (tool) => {
  editingTool.value = tool; editToolForm.value = { name: tool.name, quantity: tool.quantity }; showEditToolModal.value = true
}
const confirmEditTool = async () => {
  if (!editToolForm.value.name) { toast.warning('Name is required.'); return }
  try {
    await toolsApi.updateTool(editingTool.value.tool_id, { name: editToolForm.value.name, quantity: Number(editToolForm.value.quantity) })
    tools.value = await toolsApi.listTools()
    showEditToolModal.value = false; showDetailModal.value = false
    toast.success('Tool updated successfully.')
  } catch (err) { console.error('Failed to update tool', err); toast.error('Failed to update tool: ' + (err.message || err)) }
}
const confirmDeleteTool = async (tool) => {
  if (!confirm(`Delete "${tool.name}"? This will also remove all related transaction records. This action cannot be undone.`)) return
  try {
    await toolsApi.deleteTool(tool.tool_id)
    tools.value = await toolsApi.listTools()
    toolTransactions.value = await toolsApi.listAvailedTools()
    showDetailModal.value = false
    toast.success('Tool deleted successfully.')
  } catch (err) { console.error('Failed to delete tool', err); toast.error('Failed to delete tool: ' + (err.message || err)) }
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmtDateTime = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const isExpiringSoon = (exp) => { if (!exp) return false; const diff = (new Date(exp) - new Date()) / 864e5; return diff > 0 && diff <= 90 }
const isExpired = (exp) => exp ? new Date(exp) < new Date() : false

onMounted(async () => {
  loading.value = true
  try { tools.value = await toolsApi.listTools() } catch { tools.value = [] }
  try { medicine.value = await medicineApi.listMedicine() } catch { medicine.value = [] }
  try { medTransactions.value = await medicineApi.listAvailedMedicine() } catch { medTransactions.value = [] }
  try { toolTransactions.value = await toolsApi.listAvailedTools() } catch { toolTransactions.value = [] }
  try { const { data } = await supabase.auth.getUser(); userRole.value = data?.user?.user_metadata?.role || null } catch {}
  loading.value = false
})
</script>

<template>
  <div class="service-page">
    <div class="hs-page-header">
      <h1><span class="mdi mdi-package-variant-closed"></span> Inventory Management</h1>
      <p class="hs-module-desc">Track medicine stocks, medical tools, and distribution history.</p>
    </div>

    <!-- Summary Stats -->
    <div class="hs-stats-grid">
      <div class="hs-stat-card">
        <div class="hs-stat-icon hs-stat-icon-primary"><span class="mdi mdi-pill"></span></div>
        <div class="hs-stat-info"><div class="hs-stat-label">Medicine Units</div><div class="hs-stat-value">{{ totalMedicineStock }}</div><div class="hs-stat-desc">{{ totalMedicineItems }} items</div></div>
      </div>
      <div class="hs-stat-card">
        <div class="hs-stat-icon hs-stat-icon-info"><span class="mdi mdi-wrench"></span></div>
        <div class="hs-stat-info"><div class="hs-stat-label">Tool Units</div><div class="hs-stat-value">{{ totalToolStock }}</div><div class="hs-stat-desc">{{ totalTools }} items</div></div>
      </div>
      <div class="hs-stat-card" :class="{ 'inv-stat--alert': lowStockCount > 0 }">
        <div class="hs-stat-icon hs-stat-icon-warning"><span class="mdi mdi-alert-outline"></span></div>
        <div class="hs-stat-info"><div class="hs-stat-label">Low Stock</div><div class="hs-stat-value">{{ lowStockCount }}</div><div class="hs-stat-desc">needs restock</div></div>
      </div>
      <div class="hs-stat-card" :class="{ 'inv-stat--alert': outOfStockCount > 0 }">
        <div class="hs-stat-icon hs-stat-icon-danger"><span class="mdi mdi-close-circle-outline"></span></div>
        <div class="hs-stat-info"><div class="hs-stat-label">Out of Stock</div><div class="hs-stat-value">{{ outOfStockCount }}</div><div class="hs-stat-desc">unavailable</div></div>
      </div>
      <div class="hs-stat-card">
        <div class="hs-stat-icon hs-stat-icon-success"><span class="mdi mdi-truck-delivery-outline"></span></div>
        <div class="hs-stat-info"><div class="hs-stat-label">Distributed</div><div class="hs-stat-value">{{ totalDistributed }}</div><div class="hs-stat-desc">all time</div></div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="hs-tabs">
      <button class="hs-tab" :class="{ active: activeTab === 'medicine' }" @click="activeTab = 'medicine'">
        <span class="mdi mdi-pill"></span> Medicine
        <span v-if="lowStockMedicine.length > 0" class="hs-badge hs-badge-danger">{{ lowStockMedicine.length }}</span>
      </button>
      <button class="hs-tab" :class="{ active: activeTab === 'tools' }" @click="activeTab = 'tools'">
        <span class="mdi mdi-wrench"></span> Tools
        <span v-if="lowStockTools.length > 0" class="hs-badge hs-badge-warning">{{ lowStockTools.length }}</span>
      </button>
      <button class="hs-tab" :class="{ active: activeTab === 'logs' }" @click="activeTab = 'logs'">
        <span class="mdi mdi-clipboard-text-clock-outline"></span> Transactions
      </button>
    </div>

    <!-- Medicine Tab -->
    <div v-if="activeTab === 'medicine'">
      <div class="inv-toolbar">
        <div class="inv-toolbar-left">
          <div class="hs-search-box">
            <span class="mdi mdi-magnify"></span>
            <input v-model="medSearchQuery" type="search" placeholder="Search medicine..." />
          </div>
        </div>
        <div class="inv-toolbar-right">
          <span class="inv-count-label">{{ filteredMedicine.length }} of {{ medicine.length }} items</span>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-primary" @click="openAddMedicineModal"><span class="mdi mdi-plus"></span> Add Medicine</button>
        </div>
      </div>
      <div class="inv-grid">
        <div v-for="med in filteredMedicine" :key="med.medicine_id" class="inv-card" :class="{ 'inv-card--out': med.quantity <= 0, 'inv-card--low': med.quantity > 0 && med.quantity <= 5 }" @click="openDetail(med, 'medicine')">
          <div class="inv-card-header">
            <div class="inv-card-icon"><span class="mdi mdi-pill"></span></div>
            <div class="inv-card-title-group">
              <h4 class="inv-card-name">{{ med.name }}</h4>
              <span v-if="med.expiration" class="inv-card-exp" :class="{ 'inv-card-exp--warn': isExpiringSoon(med.expiration), 'inv-card-exp--expired': isExpired(med.expiration) }">
                <span class="mdi mdi-calendar-clock"></span> {{ isExpired(med.expiration) ? 'Expired' : 'Exp' }}: {{ fmtDate(med.expiration) }}
              </span>
              <span v-else class="inv-card-exp">No expiration set</span>
            </div>
          </div>
          <div class="inv-card-body">
            <div class="inv-stock-row">
              <span class="inv-stock-qty">{{ med.quantity }}</span>
              <span class="inv-stock-unit">units</span>
              <span class="inv-stock-badge" :class="'inv-stock-badge--' + getStockLevel(med.quantity).color">{{ getStockLevel(med.quantity).label }}</span>
            </div>
            <div class="inv-stock-bar"><div class="inv-stock-bar-fill" :class="'inv-stock-bar--' + getStockLevel(med.quantity).color" :style="{ width: getStockLevel(med.quantity).percent + '%' }"></div></div>
          </div>
          <div class="inv-card-footer">
            <span class="inv-card-date">Added {{ fmtDate(med.created_at) }}</span>
            <div class="inv-card-actions" v-if="userRole === 'Admin'">
              <button class="hs-btn hs-btn-sm hs-btn-secondary" @click.stop="openEditMedicine(med)" title="Edit"><span class="mdi mdi-pencil"></span></button>
              <button class="hs-btn hs-btn-sm hs-btn-danger" @click.stop="confirmDeleteMedicine(med)" title="Delete"><span class="mdi mdi-delete"></span></button>
            </div>
          </div>
        </div>
        <div v-if="loading" class="inv-empty-state"><span class="mdi mdi-loading mdi-spin"></span><p>Loading medicine...</p></div>
        <div v-else-if="filteredMedicine.length === 0" class="inv-empty-state"><span class="mdi mdi-pill-off"></span><p>No medicine found</p></div>
      </div>
    </div>

    <!-- Tools Tab -->
    <div v-if="activeTab === 'tools'">
      <div class="inv-toolbar">
        <div class="inv-toolbar-left">
          <div class="hs-search-box">
            <span class="mdi mdi-magnify"></span>
            <input v-model="toolSearchQuery" type="search" placeholder="Search tools..." />
          </div>
        </div>
        <div class="inv-toolbar-right">
          <span class="inv-count-label">{{ filteredTools.length }} of {{ tools.length }} items</span>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-primary" @click="openAddToolModal"><span class="mdi mdi-plus"></span> Add Tool</button>
        </div>
      </div>
      <div class="inv-grid">
        <div v-for="tool in filteredTools" :key="tool.tool_id" class="inv-card" :class="{ 'inv-card--out': tool.quantity <= 0, 'inv-card--low': tool.quantity > 0 && tool.quantity <= 5 }" @click="openDetail(tool, 'tool')">
          <div class="inv-card-header">
            <div class="inv-card-icon inv-card-icon--tool"><span class="mdi mdi-wrench"></span></div>
            <div class="inv-card-title-group">
              <h4 class="inv-card-name">{{ tool.name }}</h4>
              <span class="inv-card-exp">Medical Equipment</span>
            </div>
          </div>
          <div class="inv-card-body">
            <div class="inv-stock-row">
              <span class="inv-stock-qty">{{ tool.quantity }}</span>
              <span class="inv-stock-unit">units</span>
              <span class="inv-stock-badge" :class="'inv-stock-badge--' + getStockLevel(tool.quantity).color">{{ getStockLevel(tool.quantity).label }}</span>
            </div>
            <div class="inv-stock-bar"><div class="inv-stock-bar-fill" :class="'inv-stock-bar--' + getStockLevel(tool.quantity).color" :style="{ width: getStockLevel(tool.quantity).percent + '%' }"></div></div>
          </div>
          <div class="inv-card-footer">
            <span class="inv-card-date">Added {{ fmtDate(tool.created_at) }}</span>
            <div class="inv-card-actions" v-if="userRole === 'Admin'">
              <button class="hs-btn hs-btn-sm hs-btn-secondary" @click.stop="openEditTool(tool)" title="Edit"><span class="mdi mdi-pencil"></span></button>
              <button class="hs-btn hs-btn-sm hs-btn-danger" @click.stop="confirmDeleteTool(tool)" title="Delete"><span class="mdi mdi-delete"></span></button>
            </div>
          </div>
        </div>
        <div v-if="loading" class="inv-empty-state"><span class="mdi mdi-loading mdi-spin"></span><p>Loading tools...</p></div>
        <div v-else-if="filteredTools.length === 0" class="inv-empty-state"><span class="mdi mdi-wrench-off"></span><p>No tools found</p></div>
      </div>
    </div>

    <!-- Distribution Log Tab -->
    <div v-if="activeTab === 'logs'">
      <div class="inv-toolbar">
        <div class="inv-toolbar-left">
          <div class="hs-search-box">
            <span class="mdi mdi-magnify"></span>
            <input v-model="logSearchQuery" type="search" placeholder="Search distribution logs..." />
          </div>
        </div>
        <div class="inv-toolbar-right"><span class="inv-count-label">{{ totalItems }} total entries</span></div>
      </div>
      <div class="hs-card hs-card--flush">
        <div class="hs-table-scroll">
          <table class="hs-table">
            <thead><tr><th>Date & Time</th><th>Recipient</th><th>Item</th><th>Type</th><th>Txn Type</th><th>Qty</th><th>Purpose</th><th>Notes</th><th>Status</th><th style="width:60px;"></th></tr></thead>
            <tbody>
              <tr v-for="(log, idx) in paginatedLogs" :key="idx" class="inv-log-row" @click="openTxDetail(log)">
                <td>{{ fmtDateTime(log.created_at) }}</td>
                <td>
                  <strong>{{ log.recipient_name || '—' }}</strong>
                  <div v-if="log.recipient_purok" class="inv-log-sub">{{ log.recipient_purok }}</div>
                </td>
                <td>{{ log._item_name }}</td>
                <td><span :class="log._type === 'Medicine' ? 'hs-badge hs-badge-success' : 'hs-badge hs-badge-info'"><span :class="log._type === 'Medicine' ? 'mdi mdi-pill' : 'mdi mdi-wrench'" style="font-size:10px;margin-right:2px;"></span> {{ log._type }}</span></td>
                <td><span class="hs-badge hs-badge-secondary">{{ log.transaction_type || '—' }}</span></td>
                <td><strong>{{ log.quantity }}</strong></td>
                <td class="inv-log-purpose">{{ log.purpose || '—' }}</td>
                <td class="inv-log-notes">
                  <span v-if="log.notes" class="inv-notes-preview" :title="log.notes">{{ log.notes.length > 30 ? log.notes.slice(0, 30) + '…' : log.notes }}</span>
                  <span v-else class="inv-notes-empty">—</span>
                </td>
                <td>
                  <template v-if="log._type === 'Tool' && log.status">
                    <span :class="log.status === 'returned' ? 'hs-badge hs-badge-success' : log.status === 'borrowed' ? 'hs-badge hs-badge-warning' : 'hs-badge hs-badge-secondary'">{{ log.status }}</span>
                  </template>
                  <template v-else-if="log._type === 'Medicine' && log.prescribed_by">
                    <span class="inv-log-sub">Rx: {{ log.prescribed_by }}</span>
                  </template>
                  <span v-else>—</span>
                </td>
                <td @click.stop>
                  <button class="hs-btn hs-btn-sm hs-btn-secondary" @click="openNotesModal(log)" title="Edit Notes"><span class="mdi mdi-note-edit-outline"></span></button>
                </td>
              </tr>
              <tr v-if="paginatedLogs.length === 0"><td colspan="10" class="hs-table-empty">No transaction records found</td></tr>
            </tbody>
          </table>
        </div>
        <div class="hs-pagination">
          <div class="hs-pagination-info">
            <span>Show</span>
            <select v-model.number="itemsPerPage"><option v-for="opt in itemsPerPageOptions" :key="opt" :value="opt">{{ opt }}</option></select>
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
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetailModal && detailItem" class="hs-modal-overlay" @click.self="showDetailModal = false">
      <div class="hs-modal hs-modal-md">
        <div class="hs-modal-header"><h3>{{ detailType === 'medicine' ? 'Medicine' : 'Tool' }} Details</h3><button class="hs-modal-close" @click="showDetailModal = false">&times;</button></div>
        <div class="hs-modal-body">
          <div class="inv-detail-top">
            <div class="inv-detail-icon" :class="detailType === 'tool' ? 'inv-detail-icon--tool' : ''"><span :class="detailType === 'medicine' ? 'mdi mdi-pill' : 'mdi mdi-wrench'"></span></div>
            <div><h4 class="inv-detail-name">{{ detailItem.name }}</h4><span class="inv-stock-badge" :class="'inv-stock-badge--' + getStockLevel(detailItem.quantity).color">{{ getStockLevel(detailItem.quantity).label }}</span></div>
          </div>
          <div class="inv-detail-grid">
            <div class="inv-detail-field"><span class="inv-detail-label">Current Stock</span><span class="inv-detail-value">{{ detailItem.quantity }} units</span></div>
            <div class="inv-detail-field"><span class="inv-detail-label">Date Added</span><span class="inv-detail-value">{{ fmtDate(detailItem.created_at) }}</span></div>
            <div v-if="detailType === 'medicine' && detailItem.expiration" class="inv-detail-field">
              <span class="inv-detail-label">Expiration</span>
              <span class="inv-detail-value" :class="{ 'hs-text-danger': isExpired(detailItem.expiration), 'hs-text-warning': isExpiringSoon(detailItem.expiration) }">
                {{ fmtDate(detailItem.expiration) }}
                <span v-if="isExpired(detailItem.expiration)" class="hs-badge hs-badge-danger" style="margin-left:6px;">Expired</span>
                <span v-else-if="isExpiringSoon(detailItem.expiration)" class="hs-badge hs-badge-warning" style="margin-left:6px;">Expiring Soon</span>
              </span>
            </div>
            <div class="inv-detail-field">
              <span class="inv-detail-label">Stock Level</span>
              <div><div class="inv-stock-bar" style="width:100%;margin-top:4px;"><div class="inv-stock-bar-fill" :class="'inv-stock-bar--' + getStockLevel(detailItem.quantity).color" :style="{ width: getStockLevel(detailItem.quantity).percent + '%' }"></div></div></div>
            </div>
          </div>
        </div>
        <div class="hs-modal-footer">
          <button class="hs-btn hs-btn-secondary" @click="showDetailModal = false">Close</button>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-danger" @click="detailType === 'medicine' ? confirmDeleteMedicine(detailItem) : confirmDeleteTool(detailItem)"><span class="mdi mdi-delete"></span> Delete</button>
          <button v-if="userRole === 'Admin'" class="hs-btn hs-btn-primary" @click="detailType === 'medicine' ? openEditMedicine(detailItem) : openEditTool(detailItem)"><span class="mdi mdi-pencil"></span> Edit</button>
        </div>
      </div>
    </div>

    <!-- Add Tool Modal -->
    <div v-if="showAddToolModal" class="hs-modal-overlay" @click.self="showAddToolModal = false">
      <div class="hs-modal hs-modal-md">
        <div class="hs-modal-header"><h3>Add New Tool</h3><button class="hs-modal-close" @click="showAddToolModal = false">&times;</button></div>
        <div class="hs-modal-body">
          <form @submit.prevent="confirmAddTool">
            <div class="hs-form-group"><label class="hs-label">Tool Name</label><input v-model="addToolForm.name" class="hs-input" placeholder="Enter tool name" /></div>
            <div class="hs-form-group"><label class="hs-label">Initial Quantity</label><input v-model.number="addToolForm.quantity" type="number" class="hs-input" min="1" /></div>
            <div class="hs-modal-footer hs-modal-footer--flat"><button type="button" class="hs-btn hs-btn-secondary" @click="showAddToolModal = false">Cancel</button><button type="submit" class="hs-btn hs-btn-primary"><span class="mdi mdi-plus"></span> Add Tool</button></div>
          </form>
        </div>
      </div>
    </div>

    <!-- Add Medicine Modal -->
    <div v-if="showAddMedicineModal" class="hs-modal-overlay" @click.self="showAddMedicineModal = false">
      <div class="hs-modal hs-modal-md">
        <div class="hs-modal-header"><h3>Add New Medicine</h3><button class="hs-modal-close" @click="showAddMedicineModal = false">&times;</button></div>
        <div class="hs-modal-body">
          <form @submit.prevent="confirmAddMedicine">
            <div class="hs-form-group"><label class="hs-label">Medicine Name</label><input v-model="addMedicineForm.name" class="hs-input" placeholder="Enter medicine name" /></div>
            <div class="hs-form-row">
              <div class="hs-form-group"><label class="hs-label">Initial Quantity</label><input v-model.number="addMedicineForm.quantity" type="number" class="hs-input" min="1" /></div>
              <div class="hs-form-group"><label class="hs-label">Expiration Date</label><input v-model="addMedicineForm.expiration" type="date" class="hs-input" /></div>
            </div>
            <div class="hs-modal-footer hs-modal-footer--flat"><button type="button" class="hs-btn hs-btn-secondary" @click="showAddMedicineModal = false">Cancel</button><button type="submit" class="hs-btn hs-btn-primary"><span class="mdi mdi-plus"></span> Add Medicine</button></div>
          </form>
        </div>
      </div>
    </div>

    <!-- Edit Medicine Modal -->
    <div v-if="showEditMedicineModal" class="hs-modal-overlay" @click.self="showEditMedicineModal = false">
      <div class="hs-modal hs-modal-md">
        <div class="hs-modal-header"><h3>Edit Medicine</h3><button class="hs-modal-close" @click="showEditMedicineModal = false">&times;</button></div>
        <div class="hs-modal-body">
          <form @submit.prevent="confirmEditMedicine">
            <div class="hs-form-group"><label class="hs-label">Medicine Name</label><input v-model="editMedicineForm.name" class="hs-input" /></div>
            <div class="hs-form-row">
              <div class="hs-form-group"><label class="hs-label">Quantity</label><input v-model.number="editMedicineForm.quantity" type="number" class="hs-input" min="0" /></div>
              <div class="hs-form-group"><label class="hs-label">Expiration Date</label><input v-model="editMedicineForm.expiration" type="date" class="hs-input" /></div>
            </div>
            <div class="hs-modal-footer hs-modal-footer--flat"><button type="button" class="hs-btn hs-btn-secondary" @click="showEditMedicineModal = false">Cancel</button><button type="submit" class="hs-btn hs-btn-primary"><span class="mdi mdi-content-save"></span> Save Changes</button></div>
          </form>
        </div>
      </div>
    </div>

    <!-- Edit Tool Modal -->
    <div v-if="showEditToolModal" class="hs-modal-overlay" @click.self="showEditToolModal = false">
      <div class="hs-modal hs-modal-md">
        <div class="hs-modal-header"><h3>Edit Tool</h3><button class="hs-modal-close" @click="showEditToolModal = false">&times;</button></div>
        <div class="hs-modal-body">
          <form @submit.prevent="confirmEditTool">
            <div class="hs-form-group"><label class="hs-label">Tool Name</label><input v-model="editToolForm.name" class="hs-input" /></div>
            <div class="hs-form-group"><label class="hs-label">Quantity</label><input v-model.number="editToolForm.quantity" type="number" class="hs-input" min="0" /></div>
            <div class="hs-modal-footer hs-modal-footer--flat"><button type="button" class="hs-btn hs-btn-secondary" @click="showEditToolModal = false">Cancel</button><button type="submit" class="hs-btn hs-btn-primary"><span class="mdi mdi-content-save"></span> Save Changes</button></div>
          </form>
        </div>
      </div>
    </div>

    <!-- Edit Notes Modal -->
    <div v-if="showNotesModal && editingLog" class="hs-modal-overlay" @click.self="showNotesModal = false">
      <div class="hs-modal hs-modal-md">
        <div class="hs-modal-header">
          <h3>Edit Notes</h3>
          <button class="hs-modal-close" @click="showNotesModal = false">&times;</button>
        </div>
        <div class="hs-modal-body">
          <div class="inv-notes-context">
            <span :class="editingLog._type === 'Medicine' ? 'hs-badge hs-badge-success' : 'hs-badge hs-badge-info'">{{ editingLog._type }}</span>
            <strong>{{ editingLog._item_name }}</strong>
            <span v-if="editingLog.recipient_name"> &mdash; {{ editingLog.recipient_name }}</span>
          </div>
          <div class="hs-form-group">
            <label class="hs-label">Notes</label>
            <textarea v-model="editNotesValue" class="hs-input inv-notes-textarea" rows="4" placeholder="Add notes about this transaction..."></textarea>
          </div>
        </div>
        <div class="hs-modal-footer">
          <button class="hs-btn hs-btn-secondary" @click="showNotesModal = false">Cancel</button>
          <button class="hs-btn hs-btn-primary" @click="saveNotes"><span class="mdi mdi-content-save"></span> Save Notes</button>
        </div>
      </div>
    </div>

    <!-- Transaction Detail Modal -->
    <div v-if="showTxDetailModal && txDetailItem" class="hs-modal-overlay" @click.self="showTxDetailModal = false">
      <div class="hs-modal hs-modal-md">
        <div class="hs-modal-header">
          <h3>Transaction Details</h3>
          <button class="hs-modal-close" @click="showTxDetailModal = false">&times;</button>
        </div>
        <div class="hs-modal-body">
          <div class="inv-detail-top">
            <div class="inv-detail-icon" :class="txDetailItem._type === 'Tool' ? 'inv-detail-icon--tool' : ''">
              <span :class="txDetailItem._type === 'Medicine' ? 'mdi mdi-pill' : 'mdi mdi-wrench'"></span>
            </div>
            <div>
              <h4 class="inv-detail-name">{{ txDetailItem._item_name }}</h4>
              <span :class="txDetailItem._type === 'Medicine' ? 'hs-badge hs-badge-success' : 'hs-badge hs-badge-info'">{{ txDetailItem._type }}</span>
              <span v-if="txDetailItem.transaction_type" class="hs-badge hs-badge-secondary" style="margin-left:4px;">{{ txDetailItem.transaction_type }}</span>
            </div>
          </div>
          <div class="inv-detail-grid">
            <div class="inv-detail-field"><span class="inv-detail-label">Date</span><span class="inv-detail-value">{{ fmtDateTime(txDetailItem.created_at) }}</span></div>
            <div class="inv-detail-field"><span class="inv-detail-label">Quantity</span><span class="inv-detail-value">{{ txDetailItem.quantity }}</span></div>
            <div class="inv-detail-field"><span class="inv-detail-label">Recipient</span><span class="inv-detail-value">{{ txDetailItem.recipient_name || '—' }}</span></div>
            <div class="inv-detail-field"><span class="inv-detail-label">Purok</span><span class="inv-detail-value">{{ txDetailItem.recipient_purok || '—' }}</span></div>
            <div class="inv-detail-field"><span class="inv-detail-label">Purpose</span><span class="inv-detail-value">{{ txDetailItem.purpose || '—' }}</span></div>
            <div v-if="txDetailItem._type === 'Medicine'" class="inv-detail-field"><span class="inv-detail-label">Prescribed By</span><span class="inv-detail-value">{{ txDetailItem.prescribed_by || '—' }}</span></div>
            <div v-if="txDetailItem._type === 'Tool'" class="inv-detail-field"><span class="inv-detail-label">Status</span><span class="inv-detail-value"><span :class="txDetailItem.status === 'returned' ? 'hs-badge hs-badge-success' : txDetailItem.status === 'borrowed' ? 'hs-badge hs-badge-warning' : 'hs-badge hs-badge-secondary'">{{ txDetailItem.status || '—' }}</span></span></div>
            <div v-if="txDetailItem._type === 'Tool' && txDetailItem.expected_return_date" class="inv-detail-field"><span class="inv-detail-label">Expected Return</span><span class="inv-detail-value">{{ fmtDate(txDetailItem.expected_return_date) }}</span></div>
            <div v-if="txDetailItem._type === 'Tool' && txDetailItem.return_date" class="inv-detail-field"><span class="inv-detail-label">Returned</span><span class="inv-detail-value">{{ fmtDateTime(txDetailItem.return_date) }} ({{ txDetailItem.return_quantity }} units)</span></div>
          </div>
          <div v-if="txDetailItem.notes" class="inv-tx-notes">
            <span class="inv-detail-label">Notes</span>
            <p>{{ txDetailItem.notes }}</p>
          </div>
        </div>
        <div class="hs-modal-footer">
          <button class="hs-btn hs-btn-secondary" @click="showTxDetailModal = false">Close</button>
          <button class="hs-btn hs-btn-primary" @click="showTxDetailModal = false; openNotesModal(txDetailItem)"><span class="mdi mdi-note-edit-outline"></span> Edit Notes</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service-page { max-width: var(--hs-content-max-width); }
.inv-stat--alert { border-color: var(--hs-danger-bg); background: var(--hs-danger-bg); }

.inv-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; flex-wrap: wrap; gap: 8px; }
.inv-toolbar-left { display: flex; align-items: center; gap: 8px; }
.inv-toolbar-right { display: flex; align-items: center; gap: 10px; }
.inv-count-label { font-size: var(--hs-font-size-xs); color: var(--hs-gray-400); }

.inv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.inv-card { background: var(--hs-white); border: 1px solid var(--hs-gray-100); border-radius: var(--hs-radius-lg); padding: 14px 16px; cursor: pointer; transition: border-color 100ms ease, box-shadow 100ms ease; }
.inv-card:hover { border-color: var(--hs-gray-300); box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.inv-card--low { background: var(--hs-warning-bg); }
.inv-card--out { background: var(--hs-danger-bg); opacity: 0.75; }

.inv-card-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
.inv-card-icon { width: 34px; height: 34px; border-radius: var(--hs-radius-md); background: var(--hs-primary-bg); color: var(--hs-primary); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.inv-card-icon--tool { background: var(--hs-info-bg); color: var(--hs-info); }
.inv-card-title-group { min-width: 0; flex: 1; }
.inv-card-name { font-size: var(--hs-font-size-sm); font-weight: 500; color: var(--hs-gray-800); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.inv-card-exp { font-size: 10px; color: var(--hs-gray-400); display: flex; align-items: center; gap: 3px; margin-top: 2px; }
.inv-card-exp--warn { color: var(--hs-warning); }
.inv-card-exp--expired { color: var(--hs-danger); font-weight: 500; }

.inv-card-body { margin-bottom: 10px; }
.inv-stock-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 6px; }
.inv-stock-qty { font-size: var(--hs-font-size-xl); font-weight: 600; color: var(--hs-gray-800); }
.inv-stock-unit { font-size: var(--hs-font-size-xs); color: var(--hs-gray-400); }
.inv-stock-badge { margin-left: auto; font-size: 10px; font-weight: 500; padding: 2px 6px; border-radius: 10px; }
.inv-stock-badge--success { background: var(--hs-success-bg); color: var(--hs-success); }
.inv-stock-badge--warning { background: var(--hs-warning-bg); color: var(--hs-warning); }
.inv-stock-badge--danger { background: var(--hs-danger-bg); color: var(--hs-danger); }
.inv-stock-bar { height: 4px; background: var(--hs-gray-100); border-radius: 2px; overflow: hidden; }
.inv-stock-bar-fill { height: 100%; border-radius: 2px; transition: width 300ms ease; }
.inv-stock-bar--success { background: var(--hs-success); }
.inv-stock-bar--warning { background: var(--hs-warning); }
.inv-stock-bar--danger { background: var(--hs-danger); }

.inv-card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--hs-gray-100); }
.inv-card-date { font-size: 10px; color: var(--hs-gray-400); }
.inv-card-actions { display: flex; gap: 4px; align-items: center; }

.inv-empty-state { grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--hs-gray-400); }
.inv-empty-state .mdi { font-size: 40px; display: block; margin-bottom: 8px; opacity: 0.4; }
.inv-empty-state p { font-size: var(--hs-font-size-sm); margin: 0; }

.hs-card--flush { overflow: hidden; min-width: 0; max-width: 100%; }
.hs-card--flush .hs-table-scroll { overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 300px); }
.hs-card--flush .hs-table { min-width: 900px; table-layout: auto; }

.inv-detail-top { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.inv-detail-icon { width: 48px; height: 48px; border-radius: var(--hs-radius-lg); background: var(--hs-primary-bg); color: var(--hs-primary); display: flex; align-items: center; justify-content: center; font-size: 22px; }
.inv-detail-icon--tool { background: var(--hs-info-bg); color: var(--hs-info); }
.inv-detail-name { font-size: var(--hs-font-size-lg); font-weight: 600; color: var(--hs-gray-800); margin: 0 0 4px 0; }
.inv-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.inv-detail-field { display: flex; flex-direction: column; gap: 2px; }
.inv-detail-label { font-size: 10px; font-weight: 500; color: var(--hs-gray-400); text-transform: uppercase; letter-spacing: 0.04em; }
.inv-detail-value { font-size: var(--hs-font-size-sm); color: var(--hs-gray-700); font-weight: 500; }

@media (max-width: 640px) { .inv-grid { grid-template-columns: 1fr; } .inv-detail-grid { grid-template-columns: 1fr; } .inv-toolbar { flex-direction: column; align-items: stretch; } .inv-toolbar-right { justify-content: space-between; } }

.inv-log-row { cursor: pointer; transition: background 80ms ease; }
.inv-log-row:hover { background: var(--hs-gray-50); }
.inv-log-sub { font-size: 11px; color: var(--hs-gray-400); }
.inv-log-purpose { max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.inv-log-notes { max-width: 160px; }
.inv-notes-preview { font-size: var(--hs-font-size-xs); color: var(--hs-gray-600); }
.inv-notes-empty { color: var(--hs-gray-300); }
.inv-notes-context { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding: 10px 12px; background: var(--hs-gray-50); border-radius: var(--hs-radius-md); font-size: var(--hs-font-size-sm); }
.inv-notes-textarea { resize: vertical; min-height: 80px; font-family: inherit; line-height: 1.5; }
.inv-tx-notes { margin-top: 16px; padding: 12px; background: var(--hs-gray-50); border-radius: var(--hs-radius-md); }
.inv-tx-notes p { margin: 4px 0 0; font-size: var(--hs-font-size-sm); color: var(--hs-gray-700); white-space: pre-wrap; }
.hs-badge-secondary { background: var(--hs-gray-100); color: var(--hs-gray-600); }
</style>
