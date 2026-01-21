<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import DashboardView from '@/components/DashboardView.vue'
import { supabase } from '@/utils/supabase'

const router = useRouter()

// state
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

// Check if user can edit all fields (Admin)
const canEditAllFields = computed(() => {
  return currentUser.value?.user_metadata?.role === 'Admin'
})

// Check if user can edit basic fields (own profile for BHW)
const canEditBasicFields = computed(() => {
  return currentUser.value?.id === selectedBhw.value?.id &&
         currentUser.value?.user_metadata?.role === 'BHW'
})

// Function to start editing
function startEdit() {
  if (!canEditAllFields.value && !canEditBasicFields.value) return
  editingBhw.value = { ...selectedBhw.value }
  isEditing.value = true
}

// Function to cancel editing
function cancelEdit() {
  editingBhw.value = null
  isEditing.value = false
}

// Function to update BHW
async function updateBhw() {
  try {
    // For non-admin BHWs allow only birthdate and contact to be updated
    const updateData = {
      birthdate: editingBhw.value.birthdate,
      contact: editingBhw.value.contact
    }

    // Admins can update name and other fields
    if (canEditAllFields.value) {
      updateData.name = editingBhw.value.name
      updateData.purok = editingBhw.value.purok
      updateData.schedule = editingBhw.value.schedule
      updateData.role = editingBhw.value.role
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    // Update based on user role
    if (canEditAllFields.value && currentUser.value?.id !== editingBhw.value.id) {
      // For Admin updating other BHW's info: call the stored procedure via supabase.rpc
      const { error } = await supabase.rpc('update_user_metadata', {
        p_user_id: editingBhw.value.id,
        p_metadata: updateData
      })

      if (error) {
        // If the RPC returns an error, surface it
        throw error
      }
    } else {
      // For users updating their own info
      const { error } = await supabase.auth.updateUser({
        data: updateData
      })
      if (error) throw error
    }

    // Update local data
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

// Function to delete BHW
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

    // Remove from list
    bhwList.value = bhwList.value.filter(b => b.id !== selectedBhw.value.id)

    // Select another or none
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


// ✅ Fetch BHW users and current user from Supabase Edge Function
onMounted(async () => {
  try {
    // Get current user
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

    // ✅ use user_metadata (same as your profile fetch)
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

    // Filter BHW list based on current user's barangay
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

// select bhw
function selectBhw(bhw) {
  selectedBhw.value = bhw
}

// navigate to register
function goToRegister() {
  router.push('/register')
}
</script>



<template>
  <DashboardView>
    <div class="home-bg d-flex" style="height: 100%; background-color: #5e7d2b;">
      <!-- LEFT PANEL -->
      <div class="flex-grow-1 p-3 d-flex justify-content-center align-items-center">
        <div
          v-if="selectedBhw"
          class="bg-white bg-opacity-75 p-4 rounded shadow"
          style="width: 350px;"
        >
          <!-- View Mode -->
          <div v-if="!isEditing">
            <div class="text-center mb-3">
              <img
                :src="selectedBhw.photo"
                alt="Profile photo"
                class="img-thumbnail mb-2"
                style="width: 150px; height: 180px; object-fit: cover;"
              />
            </div>
            <p><b>Full name:</b> {{ selectedBhw.name }}</p>
            <p><b>Birthdate:</b> {{ selectedBhw.birthdate }}</p>
            <p><b>Contact number:</b> {{ selectedBhw.contact }}</p>
            <p><b>Assigned Purok:</b> {{ selectedBhw.purok }}</p>
            <p><b>Duty Schedule:</b> {{ selectedBhw.schedule }}</p>
            <p><b>Role:</b> {{ selectedBhw.role }}</p>
            
            <!-- Edit button - show only for admin or if it's the user's own profile -->
            <div v-if="canEditAllFields || canEditBasicFields" class="mt-3">
              <button class="btn btn-primary me-2" @click="startEdit">Edit</button>
              <button v-if="canEditAllFields" class="btn btn-danger" @click="deleteBhw">Delete</button>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else class="edit-form">
            <div class="mb-3">
              <label class="form-label">Full name:</label>
              <template v-if="canEditAllFields">
                <input v-model="editingBhw.name" class="form-control">
              </template>
              <template v-else>
                <p class="form-control-plaintext">{{ editingBhw.name }}</p>
              </template>
            </div>
            <div class="mb-3">
              <label class="form-label">Birthdate:</label>
              <input v-model="editingBhw.birthdate" type="date" class="form-control">
            </div>
            <div class="mb-3">
              <label class="form-label">Contact number:</label>
              <input v-model="editingBhw.contact" class="form-control">
            </div>
            
            <!-- Admin-only fields -->
            <template v-if="canEditAllFields">
              <div class="mb-3">
                <label class="form-label">Assigned Purok:</label>
                <input v-model="editingBhw.purok" class="form-control">
              </div>
              <div class="mb-3">
                <label class="form-label">Duty Schedule:</label>
                <select v-model="editingBhw.schedule" class="form-select">
                  <option value="">Select schedule</option>
                  <option v-for="option in scheduleOptions" :key="option" :value="option">
                    {{ option }}
                  </option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Role:</label>
                <input v-model="editingBhw.role" class="form-control">
              </div>
            </template>

            <div class="d-flex gap-2 mt-3">
              <button class="btn btn-success" @click="updateBhw">Save</button>
              <button class="btn btn-secondary" @click="cancelEdit">Cancel</button>
            </div>
          </div>
        </div>

        <div v-else class="text-white text-center p-4">
          <p>Loading BHW data...</p>
        </div>
      </div>

      <!-- RIGHT PANEL -->
      <div
        class="bg-white bg-opacity-75 p-3 rounded-start overflow-auto"
        style="width: 350px; position: relative;"
      >
        <div class="d-flex flex-column gap-2 mb-5">
          <button
            v-for="bhw in bhwList"
            :key="bhw.id"
            class="btn btn-light border text-start"
            @click="selectBhw(bhw)"
          >
            {{ bhw.name }}
          </button>
        </div>
        <button
          class="btn btn-light border rounded-circle position-absolute bottom-0 end-0 mb-3 me-3"
          style="width: 50px; height: 50px; font-size: 24px;"
          @click="goToRegister"
        >
          +
        </button>
      </div>
    </div>

  </DashboardView>
</template>

<style scoped>
.home-bg {
  background: url('/images/bg.jpg') no-repeat center center;
  background-size: cover;
  min-height: calc(120vh - 319px);
  width: 100%;
}
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-thumb {
  background-color: #bbb;
  border-radius: 4px;
}
</style>
