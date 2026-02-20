<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/utils/supabase'
import { useToast } from '@/composables/useToast'
import {
  requiredValidator,
  emailValidator,
  passwordValidator,
  confirmedValidator,
} from '@/utils/validators.js'

const toast = useToast()

const bhwList = ref([])
const selectedBhw = ref(null)
const currentUser = ref(null)
const isEditing = ref(false)
const editingBhw = ref(null)
const searchQuery = ref('')
const scheduleOptions = [
  'Morning (8AM-12PM)',
  'Afternoon (1PM-5PM)',
  'Whole Day (8AM-5PM)',
  'Not Available'
]

const showRegisterModal = ref(false)
const regLoading = ref(false)
const regForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  role: 'BHW',
  barangay: '',
  purok: '',
  password: '',
  confirmPassword: '',
})
const regErrors = ref({})
const purokOptions = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4']
const roleOptions = ['BHW', 'Admin']

function openRegisterModal() {
  regForm.value = {
    firstName: '',
    lastName: '',
    email: '',
    role: 'BHW',
    barangay: currentUser.value?.user_metadata?.barangay || '',
    purok: '',
    password: '',
    confirmPassword: '',
  }
  regErrors.value = {}
  showRegisterModal.value = true
}

function closeRegisterModal() {
  showRegisterModal.value = false
}

function validateRegForm() {
  const errs = {}
  const fv = requiredValidator(regForm.value.firstName)
  if (fv !== true) errs.firstName = fv
  const lv = requiredValidator(regForm.value.lastName)
  if (lv !== true) errs.lastName = lv
  const ev = requiredValidator(regForm.value.email)
  if (ev !== true) errs.email = ev
  else {
    const emv = emailValidator(regForm.value.email)
    if (emv !== true) errs.email = emv
  }
  const pv = requiredValidator(regForm.value.purok)
  if (pv !== true) errs.purok = pv
  const pwv = requiredValidator(regForm.value.password)
  if (pwv !== true) errs.password = pwv
  else {
    const pwvv = passwordValidator(regForm.value.password)
    if (pwvv !== true) errs.password = pwvv
  }
  const cpv = confirmedValidator(regForm.value.confirmPassword, regForm.value.password)
  if (cpv !== true) errs.confirmPassword = cpv
  regErrors.value = errs
  return Object.keys(errs).length === 0
}

async function handleRegister() {
  if (!validateRegForm()) return
  regLoading.value = true
  try {
    const { error } = await supabase.auth.signUp({
      email: regForm.value.email,
      password: regForm.value.password,
      options: {
        data: {
          full_name: `${regForm.value.firstName} ${regForm.value.lastName}`,
          role: regForm.value.role,
          barangay: regForm.value.barangay,
          purok: regForm.value.purok,
        },
      },
    })
    if (error) throw error
    toast.success('Account registered! A confirmation email has been sent.')
    showRegisterModal.value = false
    await fetchUsers()
  } catch (err) {
    console.error(err)
    toast.error(err.message || 'Registration failed.')
  } finally {
    regLoading.value = false
  }
}

const canEditAllFields = computed(() => {
  return currentUser.value?.user_metadata?.role === 'Admin'
})

const canEditBasicFields = computed(() => {
  return currentUser.value?.id === selectedBhw.value?.id &&
         currentUser.value?.user_metadata?.role === 'BHW'
})

const filteredBhwList = computed(() => {
  if (!searchQuery.value.trim()) return bhwList.value
  const q = searchQuery.value.toLowerCase()
  return bhwList.value.filter(b =>
    (b.name || '').toLowerCase().includes(q) ||
    (b.role || '').toLowerCase().includes(q)
  )
})

function startEdit() {
  if (!canEditAllFields.value && !canEditBasicFields.value) return
  editingBhw.value = { ...selectedBhw.value }
  isEditing.value = true
}

function cancelEdit() {
  editingBhw.value = null
  isEditing.value = false
}

async function updateBhw() {
  try {
    const updateData = {
      birthdate: editingBhw.value.birthdate,
      contact: editingBhw.value.contact
    }

    if (canEditAllFields.value) {
      updateData.full_name = editingBhw.value.name
      updateData.purok = editingBhw.value.purok
      updateData.schedule = editingBhw.value.schedule
      updateData.role = editingBhw.value.role
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    if (canEditAllFields.value && currentUser.value?.id !== editingBhw.value.id) {
      const { error } = await supabase.rpc('update_user_metadata', {
        p_user_id: editingBhw.value.id,
        p_metadata: updateData
      })
      if (error) throw error
    } else {
      const { error } = await supabase.auth.updateUser({ data: updateData })
      if (error) throw error
    }

    const index = bhwList.value.findIndex(b => b.id === editingBhw.value.id)
    if (index !== -1) {
      bhwList.value[index] = { ...bhwList.value[index], ...updateData, name: updateData.full_name || bhwList.value[index].name }
      if (selectedBhw.value?.id === editingBhw.value.id) {
        selectedBhw.value = { ...selectedBhw.value, ...updateData, name: updateData.full_name || selectedBhw.value.name }
      }
    }

    isEditing.value = false
    editingBhw.value = null
    toast.success('Profile updated successfully!')
  } catch (err) {
    console.error('Error updating BHW:', err.message)
    toast.error('Failed to update: ' + err.message)
  }
}

async function deleteBhw() {
  if (!confirm('Are you sure you want to delete this account?')) return

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await fetch(
      'https://hzmhjjvobhugsebwbwqn.supabase.co/functions/v1/delete-bhw-user',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId: selectedBhw.value.id })
      }
    )

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const result = await response.json()
    if (result.error) throw new Error(result.error)

    bhwList.value = bhwList.value.filter(b => b.id !== selectedBhw.value.id)
    selectedBhw.value = bhwList.value.length > 0 ? bhwList.value[0] : null
    toast.success('Account deleted successfully!')
  } catch (err) {
    console.error('Error deleting BHW:', err.message)
    toast.error('Failed to delete: ' + err.message)
  }
}

async function fetchUsers() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    currentUser.value = user

    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(
      'https://hzmhjjvobhugsebwbwqn.supabase.co/functions/v1/get-bhw-users',
      {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      }
    )

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const users = await response.json()

    bhwList.value = users.map(u => ({
      id: u.id,
      name: u.name || u.full_name || 'Unnamed',
      birthdate: u.birthdate || 'N/A',
      contact: u.contact || 'N/A',
      purok: u.purok || 'N/A',
      schedule: u.schedule || 'N/A',
      avatar_url: u.avatar_url || u.photo || '',
      role: u.role || 'N/A',
      barangay: u.barangay || 'N/A'
    }))

    const userBarangay = currentUser.value?.user_metadata?.barangay
    if (userBarangay) {
      bhwList.value = bhwList.value.filter(u => u.barangay === userBarangay)
    }

    if (bhwList.value.length > 0 && !selectedBhw.value) {
      selectedBhw.value = bhwList.value[0]
    }
  } catch (err) {
    console.error('Error fetching users:', err.message)
  }
}

onMounted(fetchUsers)

function selectBhw(bhw) {
  selectedBhw.value = bhw
  isEditing.value = false
  editingBhw.value = null
}
</script>

<template>
    <div class="service-page">
      <div class="hs-page-header">
        <h1>BHW Management</h1>
        <p>View and manage Barangay Health Worker profiles</p>
      </div>

      <div class="bhw-layout">
        <!-- LEFT: User list -->
        <div class="hs-card bhw-sidebar">
          <div class="hs-card-body">
            <div class="bhw-list-header">
              <h3 class="bhw-list-title">Users</h3>
              <button class="hs-btn hs-btn-primary hs-btn-sm" @click="openRegisterModal">
                <span class="mdi mdi-plus"></span> Register
              </button>
            </div>
            <div class="hs-search-box" style="margin-bottom: var(--hs-space-2);">
              <span class="mdi mdi-magnify"></span>
              <input v-model="searchQuery" type="search" placeholder="Search users..." />
            </div>
            <div class="bhw-list-scroll">
              <button
                v-for="bhw in filteredBhwList"
                :key="bhw.id"
                class="bhw-list-item"
                :class="{ active: selectedBhw?.id === bhw.id }"
                @click="selectBhw(bhw)"
              >
                <div class="bhw-list-avatar">
                  <img v-if="bhw.avatar_url" :src="bhw.avatar_url" alt="" />
                  <span v-else class="mdi mdi-account"></span>
                </div>
                <div class="bhw-list-info">
                  <span class="bhw-list-name">{{ bhw.name }}</span>
                  <span class="bhw-list-role">{{ bhw.role }}</span>
                </div>
              </button>
              <p v-if="filteredBhwList.length === 0" class="bhw-empty">No users found</p>
            </div>
          </div>
        </div>

        <!-- RIGHT: Profile detail -->
        <div class="hs-card bhw-profile">
          <div class="hs-card-body" v-if="selectedBhw">
            <template v-if="!isEditing">
              <div class="bhw-profile-avatar">
                <img v-if="selectedBhw.avatar_url" :src="selectedBhw.avatar_url" class="bhw-avatar-img" />
                <div v-else class="bhw-avatar-placeholder"><span class="mdi mdi-account"></span></div>
                <h3 class="bhw-profile-name">{{ selectedBhw.name }}</h3>
                <span class="hs-badge hs-badge-primary">{{ selectedBhw.role }}</span>
              </div>
              <div class="profile-details">
                <div class="profile-field"><span class="mdi mdi-cake-variant"></span><strong>Birthdate:</strong> {{ selectedBhw.birthdate || 'N/A' }}</div>
                <div class="profile-field"><span class="mdi mdi-phone"></span><strong>Contact:</strong> {{ selectedBhw.contact || 'N/A' }}</div>
                <div class="profile-field"><span class="mdi mdi-map-marker"></span><strong>Purok:</strong> {{ selectedBhw.purok || 'N/A' }}</div>
                <div class="profile-field"><span class="mdi mdi-clock-outline"></span><strong>Schedule:</strong> {{ selectedBhw.schedule || 'N/A' }}</div>
              </div>
              <div class="bhw-actions">
                <button v-if="canEditAllFields || canEditBasicFields" class="hs-btn hs-btn-primary" @click="startEdit"><span class="mdi mdi-pencil"></span> Edit</button>
                <button v-if="canEditAllFields" class="hs-btn hs-btn-danger" @click="deleteBhw"><span class="mdi mdi-delete"></span> Delete</button>
              </div>
            </template>

            <template v-else>
              <h3 class="bhw-edit-title">Edit Profile</h3>
              <div class="hs-form-group">
                <label class="hs-label">Full Name</label>
                <input v-model="editingBhw.name" class="hs-input" />
              </div>
              <div class="hs-form-group">
                <label class="hs-label">Birthdate</label>
                <input v-model="editingBhw.birthdate" type="date" class="hs-input" />
              </div>
              <div class="hs-form-group">
                <label class="hs-label">Contact</label>
                <input v-model="editingBhw.contact" class="hs-input" />
              </div>
              <template v-if="canEditAllFields">
                <div class="hs-form-group">
                  <label class="hs-label">Purok</label>
                  <input v-model="editingBhw.purok" class="hs-input" />
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Schedule</label>
                  <select v-model="editingBhw.schedule" class="hs-select">
                    <option v-for="opt in scheduleOptions" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Role</label>
                  <select v-model="editingBhw.role" class="hs-select">
                    <option value="BHW">BHW</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </template>
              <div class="bhw-form-actions">
                <button class="hs-btn hs-btn-primary" @click="updateBhw">Save</button>
                <button class="hs-btn hs-btn-secondary" @click="cancelEdit">Cancel</button>
              </div>
            </template>
          </div>
          <div v-else class="hs-empty-state">
            <span class="mdi mdi-account-group"></span>
            <p>Select a user to view their profile</p>
          </div>
        </div>
      </div>

      <!-- REGISTER MODAL -->
      <div v-if="showRegisterModal" class="hs-modal-overlay" @click.self="closeRegisterModal">
        <div class="hs-modal hs-modal-md">
          <div class="hs-modal-header">
            <h3>Register New Account</h3>
            <button class="hs-modal-close" @click="closeRegisterModal">&times;</button>
          </div>
          <div class="hs-modal-body">
            <div class="hs-form-row">
              <div class="hs-form-group">
                <label class="hs-label">First Name</label>
                <input v-model="regForm.firstName" type="text" class="hs-input" placeholder="First name" />
                <span v-if="regErrors.firstName" class="hs-form-error">{{ regErrors.firstName }}</span>
              </div>
              <div class="hs-form-group">
                <label class="hs-label">Last Name</label>
                <input v-model="regForm.lastName" type="text" class="hs-input" placeholder="Last name" />
                <span v-if="regErrors.lastName" class="hs-form-error">{{ regErrors.lastName }}</span>
              </div>
            </div>
            <div class="hs-form-row">
              <div class="hs-form-group">
                <label class="hs-label">Email Address</label>
                <input v-model="regForm.email" type="email" class="hs-input" placeholder="you@example.com" />
                <span v-if="regErrors.email" class="hs-form-error">{{ regErrors.email }}</span>
              </div>
              <div class="hs-form-group">
                <label class="hs-label">Role</label>
                <select v-model="regForm.role" class="hs-select">
                  <option v-for="r in roleOptions" :key="r" :value="r">{{ r }}</option>
                </select>
              </div>
            </div>
            <div class="hs-form-row">
              <div class="hs-form-group">
                <label class="hs-label">Barangay</label>
                <input v-model="regForm.barangay" type="text" class="hs-input" readonly style="background: var(--hs-gray-50); cursor: not-allowed;" />
              </div>
              <div class="hs-form-group">
                <label class="hs-label">Purok</label>
                <select v-model="regForm.purok" class="hs-select">
                  <option value="" disabled>Select purok</option>
                  <option v-for="p in purokOptions" :key="p" :value="p">{{ p }}</option>
                </select>
                <span v-if="regErrors.purok" class="hs-form-error">{{ regErrors.purok }}</span>
              </div>
            </div>
            <div class="hs-form-row">
              <div class="hs-form-group">
                <label class="hs-label">Password</label>
                <input v-model="regForm.password" type="password" class="hs-input" placeholder="Create password" />
                <span v-if="regErrors.password" class="hs-form-error">{{ regErrors.password }}</span>
              </div>
              <div class="hs-form-group">
                <label class="hs-label">Confirm Password</label>
                <input v-model="regForm.confirmPassword" type="password" class="hs-input" placeholder="Confirm password" />
                <span v-if="regErrors.confirmPassword" class="hs-form-error">{{ regErrors.confirmPassword }}</span>
              </div>
            </div>
          </div>
          <div class="hs-modal-footer">
            <button class="hs-btn hs-btn-secondary" @click="closeRegisterModal">Cancel</button>
            <button class="hs-btn hs-btn-primary" :disabled="regLoading" @click="handleRegister">
              <span v-if="regLoading" class="hs-spinner hs-spinner-inline"></span>
              <span v-else>Register Account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
</template>

<style scoped>
.service-page { max-width: var(--hs-content-max-width); }

/* Layout */
.bhw-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--hs-space-4);
  align-items: start;
}

/* Sidebar list */
.bhw-sidebar .hs-card-body { padding: var(--hs-space-4); }
.bhw-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--hs-space-3);
}
.bhw-list-title {
  font-size: var(--hs-font-size-sm);
  font-weight: 600;
  margin: 0;
  color: var(--hs-gray-700);
}
.bhw-search { margin-bottom: var(--hs-space-2); }
.bhw-list-scroll {
  max-height: calc(100vh - 340px);
  overflow-y: auto;
}

/* List items - compact */
.bhw-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: none;
  border-radius: var(--hs-radius-md);
  cursor: pointer;
  text-align: left;
  font-family: 'Poppins', sans-serif;
  font-size: var(--hs-font-size-xs);
  transition: background var(--hs-transition-fast);
}
.bhw-list-item:hover { background: var(--hs-gray-50); }
.bhw-list-item.active {
  background: var(--hs-primary-lighter);
  color: var(--hs-primary-dark);
}
.bhw-list-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--hs-gray-100);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bhw-list-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.bhw-list-avatar .mdi {
  font-size: 15px;
  color: var(--hs-gray-400);
}
.bhw-list-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0;
}
.bhw-list-name {
  font-weight: 500;
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-800);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bhw-list-role {
  font-size: 10px;
  color: var(--hs-gray-400);
  line-height: 1.2;
}

/* Profile panel */
.bhw-profile-avatar {
  text-align: center;
  margin-bottom: 20px;
}
.bhw-avatar-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 50%;
  border: 3px solid var(--hs-primary-lighter);
}
.bhw-avatar-placeholder {
  width: 80px;
  height: 80px;
  background: var(--hs-gray-100);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}
.bhw-avatar-placeholder .mdi {
  font-size: 32px;
  color: var(--hs-gray-300);
}
.bhw-profile-name {
  font-size: var(--hs-font-size-lg);
  font-weight: 600;
  margin-top: 10px;
  color: var(--hs-gray-900);
}
.profile-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.profile-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-600);
}
.profile-field .mdi {
  color: var(--hs-primary-light);
  font-size: 16px;
  width: 18px;
  text-align: center;
}
.bhw-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
  justify-content: center;
}
.bhw-edit-title {
  font-size: var(--hs-font-size-md);
  font-weight: 600;
  margin-bottom: var(--hs-space-3);
  color: var(--hs-gray-800);
}
.bhw-form-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
.bhw-empty {
  text-align: center;
  color: var(--hs-gray-400);
  padding: 20px;
  font-size: var(--hs-font-size-xs);
}

@media (max-width: 768px) {
  .bhw-layout { grid-template-columns: 1fr; }
}
</style>
