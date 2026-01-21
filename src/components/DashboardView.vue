<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase'

const router = useRouter()

// State
const userRole = ref(null)
const userData = ref({})
const showUserMenu = ref(false)
const mobileDrawer = ref(false)
const editDialog = ref(false)
const uploading = ref(false)
const newAvatar = ref(null)

onMounted(async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    userRole.value = user.user_metadata?.role || null
    userData.value = {
      id: user.id, // keep for naming file
      full_name: user.user_metadata?.full_name || 'No name provided',
      email: user.email,
      role: user.user_metadata?.role || 'Unknown',
      barangay: user.user_metadata?.barangay || 'N/A',
      purok: user.user_metadata?.purok || 'N/A',
      avatar_url: user.user_metadata?.avatar_url || '/images/avatar.jpg',
    }
  } else {
    router.push('/')
  }
})

async function logout() {
  await supabase.auth.signOut()
  router.push('/')
}

async function uploadAvatar(event) {
  try {
    const file = event.target.files?.[0]
    if (!file) return
    uploading.value = true

    // Ensure authenticated user (so storage RLS can match owner)
    const { data: userResp, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userResp?.user) throw new Error('Not authenticated')
    const uid = userResp.user.id

    // Generate unique filename and include user id
    const fileExt = file.name.split('.').pop()
    const fileName = `avatars/${uid}-${Date.now()}.${fileExt}`
    const filePath = fileName

    // Delete old avatar if it exists (except default)
    const oldAvatarUrl = userData.value.avatar_url
    if (oldAvatarUrl && !oldAvatarUrl.includes('/images/avatar.jpg')) {
      const oldPath = oldAvatarUrl.split('/').pop()
      if (oldPath) {
        await supabase.storage
          .from('profile-pictures')
          .remove([`avatars/${oldPath}`])
      }
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      console.error('Upload error', uploadError)
      throw uploadError
    }

    // Get public URL and update both local state and user metadata
    const { data } = supabase.storage.from('profile-pictures').getPublicUrl(filePath)
    const publicUrl = data?.publicUrl || data?.public_url || ''
    
    if (publicUrl) {
      newAvatar.value = publicUrl
      userData.value.avatar_url = publicUrl
      
      // Update user metadata immediately
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: publicUrl
        }
      })
      
      if (updateError) throw updateError
    }
  } catch (error) {
    console.error('Error uploading avatar:', error?.message || error)
    // RLS will return messages like "new row violates row-level security policy"
    if ((error?.message || '').toLowerCase().includes('row-level security')) {
      alert('Upload blocked by Storage Row-Level Security (RLS). Ensure the storage policy allows your user to insert files or that the path includes the authenticated user id.')
    } else {
      alert('Failed to upload avatar: ' + (error?.message || String(error)))
    }
  } finally {
    uploading.value = false
  }
}

async function saveProfile() {
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: {
        full_name: userData.value.full_name,
        barangay: userData.value.barangay,
        purok: userData.value.purok,
        avatar_url: newAvatar.value || userData.value.avatar_url,
      },
    })

    if (error) throw error

    // Update local user data with the new values
    if (data?.user) {
      userData.value = {
        ...userData.value,
        full_name: data.user.user_metadata?.full_name,
        barangay: data.user.user_metadata?.barangay,
        purok: data.user.user_metadata?.purok,
        avatar_url: data.user.user_metadata?.avatar_url,
      }
    }

    // Reset newAvatar since it's now saved
    newAvatar.value = null
    editDialog.value = false
    alert('Profile updated successfully!')
  } catch (error) {
    console.error('Error updating profile:', error.message)
    alert('Failed to update profile.')
  }
}
</script>

<template>
  <v-responsive>
    <v-app>
      <!-- TOP NAVIGATION -->
      <v-app-bar app color="#5b841e" height="90" class="d-flex align-center px-4">
        <router-link to="/home" class="logo-link">
          <img src="/images/logo.png" alt="logo" class="header-logo ml-16" />
        </router-link>

        <v-spacer></v-spacer>

        <!-- Mobile hamburger -->
        <v-btn icon class="mobile-only" @click="mobileDrawer = true">
          <v-icon color="white">mdi-menu</v-icon>
        </v-btn>

        <!-- COMMON BUTTONS -->
        <v-btn class="desktop-only" text to="/home">Home</v-btn>

        <!-- ADMIN BUTTONS -->
        <v-btn class="desktop-only" v-if="userRole === 'Admin'" text to="/bhw">BHW</v-btn>
        <v-btn class="desktop-only" v-if="userRole === 'Admin'" text to="/reports">Reports</v-btn>

        <!-- SHARED BUTTONS -->
        <v-btn class="desktop-only" text to="/calendar">Calendar</v-btn>
        <v-btn class="desktop-only" text to="/inventory">Inventory</v-btn>

        <!-- LOGOUT (moved to avatar menu) -->

        <!-- USER AVATAR MENU -->
        <v-menu v-model="showUserMenu" offset-y transition="scale-transition" min-width="320">
          <template #activator="{ props }">
            <v-avatar
              v-bind="props"
              size="40"
              class="ml-3 cursor-pointer"
              style="border: 2px solid white;"
            >
              <v-img :src="userData.avatar_url" alt="User avatar" />
            </v-avatar>
          </template>

          <v-card
            elevation="8"
            color="#fff9c4"
            class="pa-5"
            style="width: 350px; border-radius: 16px;"
          >
            <v-card-text class="text-center">
              <v-avatar size="100" class="mb-4" style="border: 3px solid #5b841e;">
                <v-img :src="userData.avatar_url" />
              </v-avatar>

              <div class="font-weight-bold mb-1" style="font-size: 18px; color: #2e4e1f;">
                {{ userData.full_name }}
              </div>
              <div style="color: #2e4e1f; font-size: 15px;">
                {{ userData.role }}
              </div>

              <v-divider class="my-4"></v-divider>

              <div class="text-left mx-4" style="color: #2e4e1f; font-size: 15px;">
                <p><strong>Email:</strong> {{ userData.email }}</p>
                <p><strong>Barangay:</strong> {{ userData.barangay }}</p>
                <p><strong>Purok:</strong> {{ userData.purok }}</p>
              </div>

              <!-- EDIT PROFILE BUTTON -->
              <v-btn color="#5b841e" class="mt-4 text-white" @click="editDialog = true">
                <v-icon left>mdi-account-edit</v-icon>
                Edit Profile
              </v-btn>

              <v-divider class="my-4"></v-divider>

              <v-card-actions class="justify-center">
                <v-btn class="logout-btn text-white" @click="logout">
                  <v-icon left>mdi-logout</v-icon>
                  Log out
                </v-btn>
              </v-card-actions>
            </v-card-text>
          </v-card>
        </v-menu>
      </v-app-bar>

      <!-- MOBILE NAV DRAWER -->
      <v-navigation-drawer v-model="mobileDrawer" temporary right class="mobile-drawer" elevation="6">
        <v-list dense>
          <v-list-item to="/home" @click="mobileDrawer = false">
            <v-list-item-title>Home</v-list-item-title>
          </v-list-item>
          <v-list-item v-if="userRole === 'Admin'" to="/bhw" @click="mobileDrawer = false">
            <v-list-item-title>BHW</v-list-item-title>
          </v-list-item>
          <v-list-item v-if="userRole === 'Admin'" to="/reports" @click="mobileDrawer = false">
            <v-list-item-title>Reports</v-list-item-title>
          </v-list-item>
          <v-list-item to="/calendar" @click="mobileDrawer = false">
            <v-list-item-title>Calendar</v-list-item-title>
          </v-list-item>
          <v-list-item to="/inventory" @click="mobileDrawer = false">
            <v-list-item-title>Inventory</v-list-item-title>
          </v-list-item>
          <v-list-item @click="() => { mobileDrawer = false; logout(); }">
            <v-list-item-title>Log out</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-navigation-drawer>

      <!-- MAIN CONTENT -->
      <v-main class="d-flex align-items-center justify-content-start">
        <slot />
      </v-main>

      <!-- FOOTER -->
      <v-footer app color="#5b841e" height="50" class="d-flex align-center justify-center">
        <span class="text-white text-decoration-underline">
          2025 All Rights Reserved
        </span>
      </v-footer>

      <!-- EDIT PROFILE DIALOG -->
      <v-dialog v-model="editDialog" max-width="500">
  <v-card>
    <v-card-title class="text-h6 font-weight-bold">Edit Profile</v-card-title>

    <v-card-text style="max-height: 70vh; overflow-y: auto;">
      <v-form>
        <v-text-field v-model="userData.full_name" label="Full Name" outlined dense />
        <v-text-field v-model="userData.barangay" label="Barangay" outlined dense />
        <v-text-field v-model="userData.purok" label="Purok" outlined dense />
        <v-file-input
          label="Change Avatar"
          accept="image/*"
          prepend-icon="mdi-camera"
          @change="uploadAvatar"
          :loading="uploading"
          outlined
          dense
        ></v-file-input>

        <v-avatar size="80" class="mt-3">
          <v-img :src="newAvatar || userData.avatar_url" />
        </v-avatar>
      </v-form>
    </v-card-text>

    <v-card-actions class="justify-end" style="background: white; position: sticky; bottom: 0;">
      <v-btn text @click="editDialog = false">Cancel</v-btn>
      <v-btn class="save-btn text-black" @click="saveProfile">Save</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>

    </v-app>
  </v-responsive>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.logo-link {
  display: inline-block;
}
.header-logo {
  height: 70px;
  display: block;
}
.save-btn:hover {
  background-color: #5b841e !important;
  color: white !important;
}
@media (max-width: 1024px) {
  .header-logo {
    height: 48px;
  }
}
@media (max-width: 767px) {
  .header-logo {
    height: 56px;
  }
}
.desktop-only {
  display: inline-flex;
}
.mobile-only {
  display: none;
}
@media (max-width: 1280px) {
  .desktop-only {
    display: none !important;
  }
  .mobile-only {
    display: inline-flex !important;
  }
}
:deep(.mobile-drawer) {
  background: #5b841e !important;
  color: white !important;
}

:deep(.mobile-drawer .v-list-item-title) {
  color: white !important;
}

.logout-btn {
  padding: 10px 20px;
  border-radius: 8px;
  background: #e53935 !important;
  color: #ffffff !important;
  box-shadow: 0 2px 6px rgba(0,0,0,0.14);
  transition: background 150ms ease, transform 80ms ease;
}

.logout-btn:hover {
  background: #c62828 !important;
  transform: translateY(-1px);
}

.logout-btn:active {
  transform: translateY(0);
}


</style>
