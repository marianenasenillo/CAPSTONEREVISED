<script setup>
import { ref, computed, onMounted } from 'vue'
import DashboardView from '@/components/DashboardView.vue'
import toolsApi from '@/utils/tools'
import medicineApi from '@/utils/medicine'
import { supabase } from '@/utils/supabase'

// Tools list (loaded from DB)
const tools = ref([])
const newTool = ref({ name: '', quantity: 1 })

// Medicine list (loaded from DB)
const medicine = ref([])
const newMedicine = ref({ name: '', quantity: 1 })

// User role
const userRole = ref(null)

// Modal state for availing tool
const showAvailModal = ref(false)
const availForm = ref({ name: '', purok: '', quantity: 1, expectedtoreturn: '' })
const selectedTool = ref(null)

// Modal state for availing medicine
const showAvailMedicineModal = ref(false)
const availMedicineForm = ref({ name: '', purok: '', quantity: 1, expectedtoreturn: '' })
const selectedMedicine = ref(null)

// Computed: only show tools with quantity > 0
const availableTools = computed(() =>
  tools.value.filter(tool => tool.quantity > 0)
)

// Computed: only show medicine with quantity > 0
const availableMedicine = computed(() =>
  medicine.value.filter(med => med.quantity > 0)
)

// Avail a tool (open modal)
const availTool = (tool) => {
  selectedTool.value = tool
  availForm.value = { name: '', purok: '', quantity: 1, expectedtoreturn: '' }
  showAvailModal.value = true
}

// Avail a medicine (open modal)
const availMedicine = (med) => {
  selectedMedicine.value = med
  availMedicineForm.value = { name: '', purok: '', quantity: 1, expectedtoreturn: '' }
  showAvailMedicineModal.value = true
}

// Confirm avail (decrement stock)
const confirmAvail = async () => {
  if (
    !availForm.value.name || !availForm.value.purok || !(availForm.value.quantity > 0)
  ) {
    alert('Please fill all fields')
    return
  }

  try {
    // selectedTool is expected to come from DB and include tool_id
    if (!selectedTool.value?.tool_id) throw new Error('Tool not recognized')

    // convert date input to ISO timestamp if provided
    let expected = availForm.value.expectedtoreturn
    if (expected) {
      expected = new Date(expected).toISOString()
    }

    await toolsApi.availTool({
      tool_id: selectedTool.value.tool_id,
      name: availForm.value.name,
      purok: availForm.value.purok,
      quantity: availForm.value.quantity,
      expectedtoreturn: expected,
    })

    // refresh list from DB
    tools.value = await toolsApi.listTools()
    showAvailModal.value = false
  } catch (err) {
    console.error('Failed to avail tool', err)
    alert('Failed to avail tool: ' + (err.message || err))
  }
}

// Confirm avail medicine (decrement stock)
const confirmAvailMedicine = async () => {
  if (
    !availMedicineForm.value.name || !availMedicineForm.value.purok || !(availMedicineForm.value.quantity > 0)
  ) {
    alert('Please fill all fields')
    return
  }

  try {
    // selectedMedicine is expected to come from DB and include medicine_id
    if (!selectedMedicine.value?.medicine_id) throw new Error('Medicine not recognized')
    // convert date input to ISO timestamp if provided
    let expected = availMedicineForm.value.expectedtoreturn
    if (expected) expected = new Date(expected).toISOString()

    await medicineApi.availMedicine({
      medicine_id: selectedMedicine.value.medicine_id,
      name: availMedicineForm.value.name,
      purok: availMedicineForm.value.purok,
      quantity: availMedicineForm.value.quantity,
      expectedtoreturn: expected,
    })

    // refresh list from DB
    medicine.value = await medicineApi.listMedicine()
    showAvailMedicineModal.value = false
  } catch (err) {
    console.error('Failed to avail medicine', err)
    alert('Failed to avail medicine: ' + (err.message || err))
  }
}

// Add new tool
// (deprecated) local-only addTool removed; use modal flow below

// Add tool modal
const showAddToolModal = ref(false)
const addToolForm = ref({ name: '', quantity: 1 })

const openAddToolModal = () => {
  addToolForm.value = { name: '', quantity: 1 }
  showAddToolModal.value = true
}

const confirmAddTool = async () => {
  if (!addToolForm.value.name || !(addToolForm.value.quantity > 0)) {
    alert('Please provide a valid name and quantity')
    return
  }

  try {
    const created = await toolsApi.createTool({ name: addToolForm.value.name, quantity: addToolForm.value.quantity })
    // refresh list
    tools.value = await toolsApi.listTools()
    showAddToolModal.value = false
  } catch (err) {
    console.error('Failed to create tool', err)
    alert('Failed to add tool: ' + (err.message || err))
  }
}

// Add medicine modal
const showAddMedicineModal = ref(false)
const addMedicineForm = ref({ name: '', quantity: 1 })

const openAddMedicineModal = () => {
  addMedicineForm.value = { name: '', quantity: 1 }
  showAddMedicineModal.value = true
}

const confirmAddMedicine = async () => {
  if (!addMedicineForm.value.name || !(addMedicineForm.value.quantity > 0)) {
    alert('Please provide a valid name and quantity')
    return
  }

  try {
    const created = await medicineApi.createMedicine({ name: addMedicineForm.value.name, quantity: addMedicineForm.value.quantity })
    // refresh list
    medicine.value = await medicineApi.listMedicine()
    showAddMedicineModal.value = false
  } catch (err) {
    console.error('Failed to create medicine', err)
    alert('Failed to add medicine: ' + (err.message || err))
  }
}

// Load tools on mount
onMounted(async () => {
  try {
    tools.value = await toolsApi.listTools()
  } catch (err) {
    console.error('Failed to load tools', err)
    tools.value = []
  }
  try {
    medicine.value = await medicineApi.listMedicine()
  } catch (err) {
    console.error('Failed to load medicine', err)
    medicine.value = []
  }
  try {
    const { data } = await supabase.auth.getUser()
    userRole.value = data?.user?.user_metadata?.role || null
  } catch (err) {
    console.error('Failed to get user role', err)
  }
})
</script>

<template>
  <DashboardView>
    <div class="inventory-bg">
      <div class="inventory-card">
        <h2 class="text-center">Medicine Stocks</h2>
        <div class="scrollable-content">
          <div class="medicine-list">
            <div 
              v-for="med in availableMedicine" 
              :key="med.medicine_id" 
              class="medicine-item"
            >
              <div style="display:flex; align-items:center; justify-content:space-between; width:100%">
                <div>{{ med.name }} ({{ med.quantity }})</div>
                <div>
                  <!-- BHW users can avail medicine -->
                  <button v-if="userRole === 'BHW'" class="avail-btn" @click="availMedicine(med)">Avail</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="medicine-input">
          <!-- Only Admin can add medicine -->
          <button v-if="userRole === 'Admin'" class="add-medicine-btn" @click="openAddMedicineModal">Add Medicine</button>
        </div>
      </div>

      <div class="inventory-card">
        <h2 class="text-center">Tools Available</h2>
        <div class="scrollable-content">
          <div class="tools-list">
            <div 
              v-for="tool in availableTools" 
              :key="tool.name" 
              class="tool-item"
            >
              <div style="display:flex; align-items:center; justify-content:space-between; width:100%">
                <div>{{ tool.name }} ({{ tool.quantity }})</div>
                <div>
                  <!-- BHW users can avail tools -->
                  <button v-if="userRole === 'BHW'" class="avail-btn" @click="availTool(tool)">Avail</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="tools-input">
          <!-- Only Admin can add tools -->
          <button v-if="userRole === 'Admin'" class="add-tool-btn" @click="openAddToolModal">Add Tool</button>
        </div>
        
      </div>

      <!-- Avail Modal -->
      <div v-if="showAvailModal" class="modal-overlay">
        <div class="modal-content">
          <button class="modal-close" @click="showAvailModal = false" v-if="showAvailModal">&times;</button>
          <h3>Avail Tool: {{ selectedTool?.name }}</h3>
          <label>
            Name:
            <input v-model="availForm.name" placeholder="Your Name" />
          </label>
          <label>
            Purok:
            <input v-model="availForm.purok" placeholder="Purok" />
          </label>
          <label>
            Quantity:
            <input v-model.number="availForm.quantity" type="number" min="1" :max="selectedTool?.quantity" />
          </label>
          <label>
            Expected to Return:
            <input v-model="availForm.expectedtoreturn" type="date" />
          </label>
          <div class="modal-actions">
            <button @click="confirmAvail">Confirm</button>
            <button @click="showAvailModal = false">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Add Tool Modal -->
      <div v-if="showAddToolModal" class="modal-overlay">
        <div class="modal-content">
          <button class="modal-close" @click="showAddToolModal = false" v-if="showAddToolModal">&times;</button>
          <h3>Add Tool</h3>
          <label>
            Tool Name:
            <input v-model="addToolForm.name" placeholder="Tool Name" />
          </label>
          <label>
            Quantity:
            <input v-model.number="addToolForm.quantity" type="number" min="1" placeholder="Quantity" />
          </label>
          <div class="modal-actions">
            <button @click="confirmAddTool">Confirm</button>
            <button @click="showAddToolModal = false">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Avail Medicine Modal -->
      <div v-if="showAvailMedicineModal" class="modal-overlay">
        <div class="modal-content">
          <button class="modal-close" @click="showAvailMedicineModal = false" v-if="showAvailMedicineModal">&times;</button>
          <h3>Avail Medicine: {{ selectedMedicine?.name }}</h3>
          <label>
            Name:
            <input v-model="availMedicineForm.name" placeholder="Your Name" />
          </label>
          <label>
            Purok:
            <input v-model="availMedicineForm.purok" placeholder="Purok" />
          </label>
          <label>
            Quantity:
            <input v-model.number="availMedicineForm.quantity" type="number" min="1" :max="selectedMedicine?.quantity" />
          </label>
          <label>
            Expected to Return:
            <input v-model="availMedicineForm.expectedtoreturn" type="date" />
          </label>
          <div class="modal-actions">
            <button @click="confirmAvailMedicine">Confirm</button>
            <button @click="showAvailMedicineModal = false">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Add Medicine Modal -->
      <div v-if="showAddMedicineModal" class="modal-overlay">
        <div class="modal-content">
          <button class="modal-close" @click="showAddMedicineModal = false" v-if="showAddMedicineModal">&times;</button>
          <h3>Add Medicine</h3>
          <label>
            Medicine Name:
            <input v-model="addMedicineForm.name" placeholder="Medicine Name" />
          </label>
          <label>
            Quantity:
            <input v-model.number="addMedicineForm.quantity" type="number" min="1" placeholder="Quantity" />
          </label>
          <div class="modal-actions">
            <button @click="confirmAddMedicine">Confirm</button>
            <button @click="showAddMedicineModal = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
.inventory-bg {
  background: url('/images/inventory.jpg') no-repeat center center;
  background-size: cover;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rem;
}

.inventory-card {
  flex: 1 1 calc(50% - 1rem);
  min-width: 300px;
  max-width: calc(50% - 1rem);
  height: 450px; /* fixed height */
  background-color: rgba(255,255,255,0.9);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  position: relative;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.medicine-stock-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.stock-count {
  font-size: 2rem;
  font-weight: bold;
  margin: 0 1rem;
  text-align: center;
}

.avail-btn {
  padding: 6px 12px;
  border-radius: 6px;
  background-color: #6aa84f;
  color: white;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.tool-item {
  padding: 8px 12px;
  background-color: #f1f1f1;
  border-radius: 6px;
  user-select: none;
  transition: background 0.2s;
}

.tools-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  justify-content: flex-end;
}

.add-tool-btn {
  padding: 6px 12px;
  border-radius: 6px;
  background-color: #6aa84f;
  color: white;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

.medicine-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.medicine-item {
  padding: 8px 12px;
  background-color: #f1f1f1;
  border-radius: 6px;
  user-select: none;
  transition: background 0.2s;
}

.medicine-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  justify-content: flex-end;
}

.add-medicine-btn {
  padding: 6px 12px;
  border-radius: 6px;
  background-color: #6aa84f;
  color: white;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(30, 41, 59, 0.45); /* darken overlay */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%);
  padding: 2.5rem 2rem;
  border-radius: 18px;
  min-width: 320px;
  max-width: 95vw;
  width: 100%;
  box-shadow: 0 12px 32px rgba(30,41,59,0.18), 0 1.5px 6px rgba(30,41,59,0.10);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
  position: relative;
  animation: modalPop 0.3s;
}

/* Limit modal width for desktop */
@media (min-width: 500px) {
  .modal-content {
    max-width: 400px;
  }
}

@keyframes modalPop {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-content h3 {
  font-size: 1.35rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 0.5rem;
}

.modal-content label {
  display: flex;
  flex-direction: column;
  font-size: 1rem;
  color: #475569;
  gap: 0.3rem;
}

.modal-content input {
  padding: 0.6rem 1rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-size: 1rem;
  background: #f1f5f9;
  transition: border 0.2s;
  outline: none;
}

.modal-content input:focus {
  border: 1.5px solid #6aa84f;
  background: #fff;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.modal-actions button {
  padding: 0.6rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.modal-actions button:first-child {
  background: #6aa84f;
  color: #fff;
}

.modal-actions button:last-child {
  background: #e2e8f0;
  color: #334155;
}

.modal-actions button:hover {
  opacity: 0.85;
}

/* Optional: Close icon in modal */
.modal-close {
  position: absolute;
  top: 1.2rem;
  right: 1.2rem;
  font-size: 1.3rem;
  color: #64748b;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}
.modal-close:hover {
  color: #6aa84f;
}

/* Responsive */
@media (max-width: 900px) {
  .inventory-bg {
    flex-direction: column;
    align-items: center;
  }
  .inventory-card {
    min-width: 90%;
    max-width: 90%;
    height: 400px;
    margin-bottom: 1rem;
  }
}
</style>
