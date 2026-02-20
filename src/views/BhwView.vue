<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import DashboardView from '@/components/DashboardView.vue'
import { supabase } from '@/utils/supabase'

const router = useRouter()

const bhwList = ref([])
const selectedBhw = ref(null)
const currentUser = ref(null)
const isEditing = ref(false)
const editingBhw = ref(null)
const scheduleOptions = [
  'Morning (8AM-12PM)',
  'Afternoon (1PM-5PM)',
  'Whole Day (8AM-5PM)',
  'Not Available'
]

const canEditAllFields = computed(() => {
  return currentUser.value?.user_metadata?.role === 'Admin'
})

const canEditBasicFields = computed(() => {
  return currentUser.value?.id === selectedBhw.value?.id &&
         currentUser.value?.user_metadata?.role === 'BHW'
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
    // For non-admin BHWs allow only birthdate and contact to be updated
    const updateData = {
      birthdate: editingBhw.value.birthdate,
      contact: editingBhw.value.contact
    }

    if (canEditAllFields.value) {
      updateData.name = editingBhw.value.name
      updateData.purok = editingBhw.value.purok
      updateData.schedule = editingBhw.value.schedule
      updateData.role = editingBhw.value.role
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    if (canEditAllFields.value && currentUser.value?.id !== editingBhw.value.id) {
      // Admin updating other BHW's info via stored procedure
      const { error } = await supabase.rpc('update_user_metadata', {
        p_user_id: editingBhw.value.id,
        p_metadata: updateData
      })

      if (error) {
        throw error
      }
    } else {
      const { error } = await supabase.auth.updateUser({
        data: updateData
      })
      if (error) throw error
    }

    const index = bhwList.value.findIndex(b => b.id === editingBhw.value.id)
    if (index !== -1) {
      bhwList.value[index] = { ...bhwList.value[index], ...updateData }
      if (selectedBhw.value?.id === editingBhw.value.id) {
        selectedBhw.value = { ...selectedBhw.value, ...updateData }
      }
    }

    isEditing.value = false
    editingBhw.value = null
    alert('Profile updated successfully!')
  } catch (err) {
    console.error('Error updating BHW:', err.message)
    alert('Failed to update BHW: ' + err.message)
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

    if (bhwList.value.length > 0) {
      selectedBhw.value = bhwList.value[0]
    } else {
      selectedBhw.value = null
    }

    alert('Account deleted successfully!')
  } catch (err) {
    console.error('Error deleting BHW:', err.message)
    alert('Failed to delete account: ' + err.message)
  }
}

onMounted(async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    currentUser.value = user

    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(
      'https://hzmhjjvobhugsebwbwqn.supabase.co/functions/v1/get-bhw-users',
      {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      }
    )

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const users = await response.json()

    bhwList.value = users.map(u => ({
  id: u.id,
  name: u.name || 'Unnamed',
  birthdate: u.birthdate || 'N/A',
  contact: u.contact || 'N/A',
  purok: u.purok || 'N/A',
  schedule: u.schedule || 'N/A',
  photo: u.photo || '/images/default-avatar.png',
  role: u.role || 'N/A',
  barangay: u.barangay || 'N/A'
}))

    const userBarangay = currentUser.value?.user_metadata?.barangay
    if (userBarangay) {
      bhwList.value = bhwList.value.filter(u => u.barangay === userBarangay)
    }

    if (bhwList.value.length > 0) {
      selectedBhw.value = bhwList.value[0]
    }

  } catch (err) {
    console.error('Error fetching BHW users:', err.message)
  }
})

function selectBhw(bhw) {
  selectedBhw.value = bhw
}

function goToRegister() {
  router.push('/register')
}
</script>

<template>
  <DashboardView>
    <div class="service-page">
      <div class="hs-page-header">
        <h1>BHW Management</h1>
        <p>View and manage Barangay Health Worker profiles</p>
      </div>

      <div class="bhw-layout">
        <div class="hs-card bhw-sidebar">
          <div class="hs-card-body">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--hs-space-4);">
              <h3 style="font-size:var(--hs-font-size-md);font-weight:600;margin:0;">BHW List</h3>
              <button class="hs-btn hs-btn-primary" @click="goToRegister" style="padding:var(--hs-space-2) var(--hs-space-4);font-size:var(--hs-font-size-md);"><span class="mdi mdi-plus"></span> Register</button>
            </div>
            <div class="bhw-list-scroll">
              <button v-for="bhw in bhwList" :key="bhw.id" class="bhw-list-item" :class="{ active: selectedBhw?.id === bhw.id }" @click="selectBhw(bhw)">
                <span class="mdi mdi-account-circle" style="font-size:var(--hs-font-size-2xl);margin-right:var(--hs-space-2);"></span>
                {{ bhw.fullname || 'Unknown' }}
              </button>
              <p v-if="bhwList.length === 0" style="text-align:center;color:var(--hs-gray-400);padding:20px;">No BHW records</p>
            </div>
          </div>
        </div>

        <div class="hs-card bhw-profile">
          <div class="hs-card-body" v-if="selectedBhw">
            <template v-if="!isEditing">
              <div style="text-align:center;margin-bottom:24px;">
                <img v-if="selectedBhw.avatar_url" :src="selectedBhw.avatar_url" style="width:120px;height:140px;object-fit:cover;border-radius:var(--hs-radius-md);border:3px solid var(--hs-primary);" />
                <div v-else style="width:120px;height:140px;background:var(--hs-gray-100);border-radius:var(--hs-radius-md);display:flex;align-items:center;justify-content:center;margin:0 auto;"><span class="mdi mdi-account" style="font-size:var(--hs-font-size-3xl);color:var(--hs-gray-300);"></span></div>
                <h3 style="font-size:var(--hs-font-size-lg);font-weight:600;margin-top:12px;">{{ selectedBhw.fullname }}</h3>
                <span class="hs-badge hs-badge-primary">{{ selectedBhw.role }}</span>
              </div>
              <div class="profile-details">
                <div class="profile-field"><span class="mdi mdi-cake-variant"></span><strong>Birthdate:</strong> {{ selectedBhw.birthdate || 'N/A' }}</div>
                <div class="profile-field"><span class="mdi mdi-phone"></span><strong>Contact:</strong> {{ selectedBhw.contact || 'N/A' }}</div>
                <div class="profile-field"><span class="mdi mdi-map-marker"></span><strong>Purok:</strong> {{ selectedBhw.purok || 'N/A' }}</div>
                <div class="profile-field"><span class="mdi mdi-clock-outline"></span><strong>Schedule:</strong> {{ selectedBhw.schedule || 'N/A' }}</div>
              </div>
              <div style="display:flex;gap:8px;margin-top:24px;justify-content:center;">
                <button v-if="canEditAllFields || canEditBasicFields" class="hs-btn hs-btn-primary" @click="startEdit"><span class="mdi mdi-pencil"></span> Edit</button>
                <button v-if="canEditAllFields" class="hs-btn hs-btn-danger" @click="deleteBhw(selectedBhw)"><span class="mdi mdi-delete"></span> Delete</button>
              </div>
            </template>

            <template v-else>
              <h3 style="font-size:var(--hs-font-size-md);font-weight:600;margin-bottom:var(--hs-space-4);">Edit Profile</h3>
              <div class="hs-form-group">
                <label class="hs-label">Full Name</label>
                <input v-model="editingBhw.fullname" class="hs-input" />
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
                  <input v-model="editingBhw.role" class="hs-input" />
                </div>
              </template>
              <div style="display:flex;gap:8px;margin-top:16px;">
                <button class="hs-btn hs-btn-primary" @click="updateBhw">Save</button>
                <button class="hs-btn hs-btn-secondary" @click="cancelEdit">Cancel</button>
              </div>
            </template>
          </div>
          <div v-else class="hs-empty-state">
            <span class="mdi mdi-account-group" style="font-size:var(--hs-font-size-3xl);color:var(--hs-gray-300);"></span>
            <p>Select a BHW to view their profile</p>
          </div>
        </div>
      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
.service-page { max-width: var(--hs-content-max-width); }
.bhw-layout { display: grid; grid-template-columns: 280px 1fr; gap: var(--hs-space-4); align-items: start; }
.bhw-list-scroll { max-height: calc(100vh - 320px); overflow-y: auto; }
.bhw-list-item { display: flex; align-items: center; width: 100%; padding: 8px 10px; border: none; background: none; border-radius: var(--hs-radius-sm); cursor: pointer; text-align: left; font-size: var(--hs-font-size-sm); transition: background var(--hs-transition-fast); }
.bhw-list-item:hover { background: var(--hs-gray-50); }
.bhw-list-item.active { background: rgba(91, 132, 30, 0.1); color: var(--hs-primary); font-weight: 600; }
.profile-details { display: flex; flex-direction: column; gap: 10px; }
.profile-field { display: flex; align-items: center; gap: 7px; font-size: var(--hs-font-size-sm); color: var(--hs-gray-700); }
.profile-field .mdi { color: var(--hs-primary); font-size: var(--hs-font-size-md); }
@media (max-width: 768px) { .bhw-layout { grid-template-columns: 1fr; } }
</style>
