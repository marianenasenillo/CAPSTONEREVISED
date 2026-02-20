<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/utils/supabase'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const route = useRoute()
const toast = useToast()

const userRole = ref(null)
const userData = ref({})
const showUserMenu = ref(false)
const editDialog = ref(false)
const uploading = ref(false)
const newAvatar = ref(null)
const showNotifications = ref(false)
const notifications = ref([])
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

async function fetchNotifications() {
  const items = []
  try {
    const { data: meds } = await supabase.from('medicine').select('name, quantity').lte('quantity', 5)
    if (meds) {
      meds.forEach(m => {
        items.push({
          id: 'med-' + m.name,
          icon: 'mdi-pill',
          color: m.quantity === 0 ? 'var(--hs-danger)' : 'var(--hs-warning)',
          title: m.quantity === 0 ? `${m.name} is out of stock` : `${m.name} is low stock (${m.quantity} left)`,
          time: 'Inventory',
          read: false,
        })
      })
    }
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const { data: evts } = await supabase.from('events').select('text, start').gte('start', now.toISOString().slice(0, 10)).lte('start', weekLater.toISOString().slice(0, 10)).order('start', { ascending: true }).limit(5)
    if (evts) {
      evts.forEach(e => {
        items.push({
          id: 'evt-' + e.start + e.text,
          icon: 'mdi-calendar-alert',
          color: 'var(--hs-info)',
          title: e.text,
          time: `Upcoming: ${new Date(e.start).toLocaleDateString()}`,
          read: false,
        })
      })
    }
  } catch (err) {
    console.error('Failed to fetch notifications', err)
  }
  notifications.value = items
}

function toggleNotifications() {
  showNotifications.value = !showNotifications.value
  showUserMenu.value = false
}

function markAllRead() {
  notifications.value.forEach(n => (n.read = true))
}

const sidebarCollapsed = ref(localStorage.getItem('hs_sidebar') === 'collapsed')
const mobileOpen = ref(false)
const expandedGroups = ref(['services', 'records'])
const windowWidth = ref(window.innerWidth)

const isMobile = computed(() => windowWidth.value < 1024)

function onResize() {
  windowWidth.value = window.innerWidth
  if (!isMobile.value) mobileOpen.value = false
}

onMounted(async () => {
  window.addEventListener('resize', onResize)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    userRole.value = user.user_metadata?.role || null
    userData.value = {
      id: user.id,
      full_name: user.user_metadata?.full_name || 'No name provided',
      email: user.email,
      role: user.user_metadata?.role || 'Unknown',
      barangay: user.user_metadata?.barangay || 'N/A',
      purok: user.user_metadata?.purok || 'N/A',
      avatar_url: user.user_metadata?.avatar_url || '/images/avatar.jpg',
    }
    fetchNotifications()
  } else {
    router.push('/')
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('hs_sidebar', sidebarCollapsed.value ? 'collapsed' : 'expanded')
}

function toggleGroup(group) {
  const idx = expandedGroups.value.indexOf(group)
  if (idx >= 0) expandedGroups.value.splice(idx, 1)
  else expandedGroups.value.push(group)
}

function isGroupExpanded(group) {
  return expandedGroups.value.includes(group)
}

function isActive(path) {
  return route.path === path
}

function navigateTo(path) {
  router.push(path)
  if (isMobile.value) mobileOpen.value = false
}

const navServices = [
  { label: 'Household Profiling', icon: 'mdi-home-group', path: '/householdprofile' },
  { label: 'Maternal Services', icon: 'mdi-mother-nurse', path: '/maternalservices' },
  { label: 'Child Care', icon: 'mdi-baby-face-outline', path: '/childcare' },
  { label: 'Family Planning', icon: 'mdi-account-heart', path: '/familyplanning' },
  { label: 'Preventive Health', icon: 'mdi-shield-plus', path: '/preventivehealthservices' },
]

const navRecords = [
  { label: 'Household Records', icon: 'mdi-file-document-outline', path: '/hhpsrecords' },
  { label: 'WRA Records', icon: 'mdi-file-account-outline', path: '/maternalwrarecords' },
  { label: 'Cervical Screening', icon: 'mdi-file-chart-outline', path: '/maternalccsrecords' },
  { label: 'Child Care Records', icon: 'mdi-file-document-outline', path: '/childcarerecords' },
  { label: 'Family Planning Records', icon: 'mdi-file-account-outline', path: '/fpsrecords' },
  { label: 'Deworming Records', icon: 'mdi-file-document-outline', path: '/phsrecords' },
]

async function logout() {
  await supabase.auth.signOut()
  router.push('/')
}

async function uploadAvatar(event) {
  try {
    const file = event.target.files?.[0]
    if (!file) return
    uploading.value = true

    const { data: userResp, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userResp?.user) throw new Error('Not authenticated')
    const uid = userResp.user.id

    const fileExt = file.name.split('.').pop()
    const fileName = `avatars/${uid}-${Date.now()}.${fileExt}`
    const filePath = fileName

    const oldAvatarUrl = userData.value.avatar_url
    if (oldAvatarUrl && !oldAvatarUrl.includes('/images/avatar.jpg')) {
      const oldPath = oldAvatarUrl.split('/').pop()
      if (oldPath) {
        await supabase.storage
          .from('profile-pictures')
          .remove([`avatars/${oldPath}`])
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      console.error('Upload error', uploadError)
      throw uploadError
    }

    const { data } = supabase.storage.from('profile-pictures').getPublicUrl(filePath)
    const publicUrl = data?.publicUrl || data?.public_url || ''

    if (publicUrl) {
      newAvatar.value = publicUrl
      userData.value.avatar_url = publicUrl

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      })
      if (updateError) throw updateError
    }
  } catch (error) {
    console.error('Error uploading avatar:', error?.message || error)
    if ((error?.message || '').toLowerCase().includes('row-level security')) {
      toast.error('Upload blocked: storage policy does not allow this operation.')
    } else {
      toast.error('Failed to upload avatar: ' + (error?.message || String(error)))
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

    if (data?.user) {
      userData.value = {
        ...userData.value,
        full_name: data.user.user_metadata?.full_name,
        barangay: data.user.user_metadata?.barangay,
        purok: data.user.user_metadata?.purok,
        avatar_url: data.user.user_metadata?.avatar_url,
      }
    }

    newAvatar.value = null
    editDialog.value = false
    toast.success('Profile updated successfully!')
  } catch (error) {
    console.error('Error updating profile:', error.message)
    toast.error('Failed to update profile.')
  }
}
</script>

<template>
  <div class="hs-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed && !isMobile }">
    <!-- MOBILE OVERLAY -->
    <div v-if="mobileOpen && isMobile" class="hs-sidebar-overlay" @click="mobileOpen = false"></div>

    <!-- SIDEBAR -->
    <aside
      class="hs-sidebar"
      :class="{
        collapsed: sidebarCollapsed && !isMobile,
        'mobile-open': mobileOpen && isMobile,
      }"
    >
      <!-- Sidebar Header -->
      <div class="hs-sidebar-header">
        <router-link to="/home" class="hs-logo-link">
          <img src="/images/logo.png" alt="HealthSync" class="hs-logo-img" />
          <span v-if="!sidebarCollapsed || isMobile" class="hs-logo-text">HealthSync</span>
        </router-link>
      </div>

      <!-- Sidebar Nav -->
      <nav class="hs-sidebar-nav">
        <!-- GENERAL section -->
        <div v-if="!sidebarCollapsed || isMobile" class="hs-nav-section-label">General</div>

        <!-- Dashboard -->
        <button
          class="hs-nav-item"
          :class="{ active: isActive('/home') || isActive('/dashboard') }"
          @click="navigateTo('/home')"
        >
          <span class="mdi mdi-view-dashboard-outline hs-nav-icon"></span>
          <span v-if="!sidebarCollapsed || isMobile" class="hs-nav-label">Dashboard</span>
        </button>

        <!-- Health Services Group (BHW only) -->
        <div v-if="userRole === 'BHW'" class="hs-nav-group">
          <div v-if="!sidebarCollapsed || isMobile" class="hs-nav-section-label" style="margin-top: 6px;">Services</div>
          <button
            class="hs-nav-group-toggle"
            @click="toggleGroup('services')"
            :title="sidebarCollapsed && !isMobile ? 'Health Services' : ''"
          >
            <span class="mdi mdi-medical-bag hs-nav-icon"></span>
            <template v-if="!sidebarCollapsed || isMobile">
              <span class="hs-nav-label">Health Services</span>
              <span
                class="mdi hs-nav-chevron"
                :class="isGroupExpanded('services') ? 'mdi-chevron-up' : 'mdi-chevron-down'"
              ></span>
            </template>
          </button>
          <div
            v-if="isGroupExpanded('services') && (!sidebarCollapsed || isMobile)"
            class="hs-nav-subitems"
          >
            <button
              v-for="item in navServices"
              :key="item.path"
              class="hs-nav-item sub"
              :class="{ active: isActive(item.path) }"
              @click="navigateTo(item.path)"
            >
              <span :class="'mdi ' + item.icon + ' hs-nav-icon'"></span>
              <span class="hs-nav-label">{{ item.label }}</span>
            </button>
          </div>
        </div>

        <!-- Service Eligibility (BHW standalone) -->
        <button
          v-if="userRole === 'BHW'"
          class="hs-nav-item"
          :class="{ active: isActive('/eligibility') }"
          @click="navigateTo('/eligibility')"
        >
          <span class="mdi mdi-clipboard-check-outline hs-nav-icon"></span>
          <span v-if="!sidebarCollapsed || isMobile" class="hs-nav-label">Service Eligibility</span>
        </button>

        <!-- Borrower Profiling (BHW standalone) -->
        <button
          v-if="userRole === 'BHW'"
          class="hs-nav-item"
          :class="{ active: isActive('/borrowers') }"
          @click="navigateTo('/borrowers')"
        >
          <span class="mdi mdi-account-cash-outline hs-nav-icon"></span>
          <span v-if="!sidebarCollapsed || isMobile" class="hs-nav-label">Borrower Profiling</span>
        </button>

        <!-- Records Group -->
        <div class="hs-nav-group">
          <div v-if="!sidebarCollapsed || isMobile" class="hs-nav-section-label" style="margin-top: 6px;">Records</div>
          <button
            class="hs-nav-group-toggle"
            @click="toggleGroup('records')"
            :title="sidebarCollapsed && !isMobile ? 'Records' : ''"
          >
            <span class="mdi mdi-folder-open-outline hs-nav-icon"></span>
            <template v-if="!sidebarCollapsed || isMobile">
              <span class="hs-nav-label">Records</span>
              <span
                class="mdi hs-nav-chevron"
                :class="isGroupExpanded('records') ? 'mdi-chevron-up' : 'mdi-chevron-down'"
              ></span>
            </template>
          </button>
          <div
            v-if="isGroupExpanded('records') && (!sidebarCollapsed || isMobile)"
            class="hs-nav-subitems"
          >
            <button
              v-for="item in navRecords"
              :key="item.path"
              class="hs-nav-item sub"
              :class="{ active: isActive(item.path) }"
              @click="navigateTo(item.path)"
            >
              <span :class="'mdi ' + item.icon + ' hs-nav-icon'"></span>
              <span class="hs-nav-label">{{ item.label }}</span>
            </button>
          </div>
        </div>

        <!-- Calendar -->
        <button
          class="hs-nav-item"
          :class="{ active: isActive('/calendar') }"
          @click="navigateTo('/calendar')"
        >
          <span class="mdi mdi-calendar-month-outline hs-nav-icon"></span>
          <span v-if="!sidebarCollapsed || isMobile" class="hs-nav-label">Calendar</span>
        </button>

        <!-- Inventory -->
        <button
          class="hs-nav-item"
          :class="{ active: isActive('/inventory') }"
          @click="navigateTo('/inventory')"
        >
          <span class="mdi mdi-package-variant-closed hs-nav-icon"></span>
          <span v-if="!sidebarCollapsed || isMobile" class="hs-nav-label">Inventory</span>
        </button>

        <!-- Admin-only items -->
        <template v-if="userRole === 'Admin'">
          <div class="hs-nav-divider"></div>
          <div v-if="!sidebarCollapsed || isMobile" class="hs-nav-section-label">Administration</div>
          <button
            class="hs-nav-item"
            :class="{ active: isActive('/bhw') }"
            @click="navigateTo('/bhw')"
          >
            <span class="mdi mdi-account-group-outline hs-nav-icon"></span>
            <span v-if="!sidebarCollapsed || isMobile" class="hs-nav-label">BHW Management</span>
          </button>
          <button
            class="hs-nav-item"
            :class="{ active: isActive('/reports') }"
            @click="navigateTo('/reports')"
          >
            <span class="mdi mdi-chart-bar hs-nav-icon"></span>
            <span v-if="!sidebarCollapsed || isMobile" class="hs-nav-label">Reports</span>
          </button>
        </template>
      </nav>

      <!-- Sidebar Footer -->
      <div class="hs-sidebar-footer">
        <button class="hs-nav-item hs-nav-item--danger" @click="logout">
          <span class="mdi mdi-logout hs-nav-icon"></span>
          <span v-if="!sidebarCollapsed || isMobile" class="hs-nav-label">Log out</span>
        </button>
      </div>
    </aside>

    <!-- MAIN AREA -->
    <div class="hs-main-wrapper">
      <!-- TOP NAVBAR -->
      <header class="hs-navbar">
        <div class="hs-navbar-left">
          <!-- Mobile hamburger -->
          <button class="hs-btn-icon hs-mobile-toggle" @click="mobileOpen = !mobileOpen">
            <span class="mdi mdi-menu"></span>
          </button>
          <!-- Desktop collapse toggle -->
          <button class="hs-btn-icon hs-desktop-toggle" @click="toggleSidebar">
            <span class="mdi" :class="sidebarCollapsed ? 'mdi-menu' : 'mdi-menu-open'"></span>
          </button>
        </div>

        <div class="hs-navbar-right">
          <!-- Notification Bell -->
          <div class="hs-notification-bell" @click.stop="toggleNotifications">
            <span class="mdi mdi-bell-outline"></span>
            <span v-if="unreadCount > 0" class="hs-notification-count">{{ unreadCount }}</span>
          </div>

          <!-- Notification Dropdown -->
          <div v-if="showNotifications" class="hs-notification-dropdown" @click.stop>
            <div class="hs-notification-dropdown-header">
              <strong>Notifications</strong>
              <button v-if="unreadCount > 0" class="hs-btn hs-btn-ghost hs-btn-sm" @click="markAllRead">Mark all read</button>
            </div>
            <div class="notification-scroll">
              <div v-for="n in notifications" :key="n.id" class="hs-notification-item" :class="{ unread: !n.read }" @click="n.read = true">
                <span class="mdi" :class="n.icon" :style="{ color: n.color }"></span>
                <div class="hs-notification-item-text">
                  <strong>{{ n.title }}</strong>
                  <span>{{ n.time }}</span>
                </div>
              </div>
              <div v-if="notifications.length === 0" class="hs-empty-state">
                <p>No notifications</p>
              </div>
            </div>
          </div>

          <!-- User info + avatar -->
          <div class="hs-user-menu" @click.stop="showUserMenu = !showUserMenu">
            <div class="hs-user-info">
              <span class="hs-user-name">{{ userData.full_name }}</span>
              <span class="hs-user-role">{{ userData.role }}</span>
            </div>
            <div class="hs-avatar">
              <img :src="userData.avatar_url" alt="Avatar" />
            </div>
            <span class="mdi mdi-chevron-down hs-text-muted chevron-icon"></span>
          </div>

          <!-- Dropdown -->
          <div v-if="showUserMenu" class="hs-user-dropdown" @click.stop>
            <div class="hs-user-dropdown-header">
              <div class="hs-avatar lg">
                <img :src="userData.avatar_url" alt="Avatar" />
              </div>
              <div>
                <div class="hs-font-bold dropdown-name">{{ userData.full_name }}</div>
                <div class="hs-text-sm hs-text-muted">{{ userData.email }}</div>
              </div>
            </div>
            <div class="hs-user-dropdown-body">
              <div class="hs-user-detail">
                <span class="mdi mdi-shield-account-outline"></span>
                <span>{{ userData.role }}</span>
              </div>
              <div class="hs-user-detail">
                <span class="mdi mdi-map-marker-outline"></span>
                <span>{{ userData.barangay }}, Purok {{ userData.purok }}</span>
              </div>
            </div>
            <div class="hs-user-dropdown-actions">
              <button class="hs-dropdown-item" @click="editDialog = true; showUserMenu = false;">
                <span class="mdi mdi-account-edit-outline"></span>
                Edit Profile
              </button>
              <div class="hs-dropdown-divider"></div>
              <button class="hs-dropdown-item hs-dropdown-item-danger" @click="logout">
                <span class="mdi mdi-logout"></span>
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- PAGE CONTENT -->
      <main class="hs-content">
        <router-view />
      </main>
    </div>

    <!-- Click-away for user menu / notifications -->
    <div v-if="showUserMenu || showNotifications" class="hs-click-away" @click="showUserMenu = false; showNotifications = false"></div>

    <!-- EDIT PROFILE MODAL -->
    <div v-if="editDialog" class="hs-modal-overlay" @click.self="editDialog = false">
      <div class="hs-modal hs-modal-sm">
        <div class="hs-modal-header">
          <h3>Edit Profile</h3>
          <button class="hs-modal-close" @click="editDialog = false">&times;</button>
        </div>
        <div class="hs-modal-body">
          <div class="hs-form-group">
            <label class="hs-label">Full Name</label>
            <input v-model="userData.full_name" type="text" class="hs-input" placeholder="Full Name" />
          </div>
          <div class="hs-form-group">
            <label class="hs-label">Barangay</label>
            <input v-model="userData.barangay" type="text" class="hs-input" placeholder="Barangay" />
          </div>
          <div class="hs-form-group">
            <label class="hs-label">Purok</label>
            <input v-model="userData.purok" type="text" class="hs-input" placeholder="Purok" />
          </div>
          <div class="hs-form-group">
            <label class="hs-label">Avatar</label>
            <input
              type="file"
              accept="image/*"
              class="hs-input"
              @change="uploadAvatar"
              :disabled="uploading"
            />
            <div v-if="uploading" class="upload-status">
              <span class="hs-spinner"></span>
              <span class="hs-text-sm hs-text-muted">Uploading...</span>
            </div>
          </div>
          <div class="avatar-preview">
            <div class="hs-avatar lg hs-mx-auto">
              <img :src="newAvatar || userData.avatar_url" alt="Preview" />
            </div>
          </div>
        </div>
        <div class="hs-modal-footer">
          <button class="hs-btn hs-btn-secondary" @click="editDialog = false">Cancel</button>
          <button class="hs-btn hs-btn-primary" @click="saveProfile">Save Changes</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* LAYOUT SHELL */
.hs-layout {
  display: flex;
  min-height: 100vh;
  background: var(--hs-gray-50);
}

/* SIDEBAR */
.hs-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--hs-sidebar-width);
  background: var(--hs-gray-900);
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: width var(--hs-transition-normal), transform var(--hs-transition-normal);
  overflow: hidden;
}

.hs-sidebar.collapsed {
  width: var(--hs-sidebar-collapsed);
}

.hs-sidebar-header {
  display: flex;
  align-items: center;
  height: var(--hs-navbar-height);
  padding: 0 16px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.hs-logo-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  overflow: hidden;
}

.hs-logo-img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  flex-shrink: 0;
}

.hs-logo-text {
  font-size: var(--hs-font-size-md);
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  letter-spacing: -0.02em;
}

/* Sidebar Nav */
.hs-sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
}

.hs-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: var(--hs-radius-md);
  color: rgba(255,255,255,0.5);
  font-family: var(--hs-font-family);
  font-size: var(--hs-font-size-sm);
  font-weight: 400;
  cursor: pointer;
  transition: background-color 80ms ease, color 80ms ease;
  text-align: left;
  white-space: nowrap;
  margin-bottom: 1px;
}

.hs-nav-item:hover {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.85);
}

.hs-nav-item.active {
  background: var(--hs-primary);
  color: #ffffff;
  font-weight: 500;
}

.hs-nav-item.active .hs-nav-icon {
  color: #ffffff;
}

.hs-nav-item.sub {
  padding-left: 38px;
  font-size: var(--hs-font-size-xs);
  padding-top: 6px;
  padding-bottom: 6px;
  color: rgba(255,255,255,0.4);
}

.hs-nav-item.sub:hover {
  color: rgba(255,255,255,0.8);
  background: rgba(255,255,255,0.06);
}

.hs-nav-item.sub.active {
  background: rgba(74, 122, 26, 0.3);
  color: var(--hs-primary-lighter);
  font-weight: 500;
}

.hs-nav-icon {
  font-size: 17px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
  color: inherit;
}

.hs-nav-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hs-nav-group-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: var(--hs-radius-md);
  color: rgba(255,255,255,0.5);
  font-family: var(--hs-font-family);
  font-size: var(--hs-font-size-sm);
  font-weight: 400;
  cursor: pointer;
  transition: background-color 80ms ease, color 80ms ease;
  text-align: left;
  margin-bottom: 1px;
}

.hs-nav-group-toggle:hover {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.85);
}

.hs-nav-chevron {
  margin-left: auto;
  font-size: 14px;
  color: rgba(255,255,255,0.25);
}

.hs-nav-subitems {
  margin-top: 1px;
  margin-bottom: 2px;
}

.hs-nav-divider {
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 8px 10px;
}

.hs-nav-section-label {
  padding: 16px 10px 4px;
  font-size: 10px;
  font-weight: 500;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.hs-sidebar-footer {
  border-top: 1px solid rgba(255,255,255,0.08);
  padding: 10px;
  flex-shrink: 0;
}

/* MAIN WRAPPER */
.hs-main-wrapper {
  flex: 1;
  margin-left: var(--hs-sidebar-width);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-width: 0;
  overflow-x: hidden;
  transition: margin-left var(--hs-transition-normal);
}

.sidebar-collapsed .hs-main-wrapper {
  margin-left: var(--hs-sidebar-collapsed);
}

/* NAVBAR */
.hs-navbar {
  position: sticky;
  top: 0;
  height: var(--hs-navbar-height);
  background: var(--hs-white);
  border-bottom: 1px solid var(--hs-gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  z-index: 90;
  flex-shrink: 0;
}

.hs-navbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hs-navbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}

.hs-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: var(--hs-radius-md);
  color: var(--hs-gray-500);
  font-size: 18px;
  cursor: pointer;
  transition: background-color 80ms ease;
}

.hs-btn-icon:hover {
  background: var(--hs-gray-100);
  color: var(--hs-gray-700);
}

.hs-mobile-toggle {
  display: none;
}

.hs-desktop-toggle {
  display: flex;
}

/* User menu */
.hs-user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--hs-radius-md);
  cursor: pointer;
  transition: background-color 80ms ease;
}

.hs-user-menu:hover {
  background: var(--hs-gray-50);
}

.hs-user-info {
  display: flex;
  flex-direction: column;
  text-align: right;
}

.hs-user-name {
  font-size: var(--hs-font-size-xs);
  font-weight: 500;
  color: var(--hs-gray-700);
  line-height: 1.2;
}

.hs-user-role {
  font-size: 10px;
  color: var(--hs-gray-400);
}

.hs-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid var(--hs-gray-200);
  flex-shrink: 0;
}

.hs-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hs-avatar.lg {
  width: 48px;
  height: 48px;
}

/* User dropdown */
.hs-user-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 280px;
  background: var(--hs-white);
  border: 1px solid var(--hs-border);
  border-radius: var(--hs-radius-lg);
  box-shadow: var(--hs-shadow-lg);
  z-index: 200;
  animation: hs-fade-in 120ms ease;
}

.hs-user-dropdown-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border-bottom: 1px solid var(--hs-border);
}

.hs-user-dropdown-body {
  padding: 10px 14px;
  border-bottom: 1px solid var(--hs-border);
}

.hs-user-detail {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-600);
  padding: 3px 0;
}

.hs-user-detail .mdi {
  font-size: 16px;
  color: var(--hs-gray-400);
  width: 18px;
  text-align: center;
}

.hs-user-dropdown-actions {
  padding: 3px;
}

.hs-click-away {
  position: fixed;
  inset: 0;
  z-index: 89;
}

/* Dashboard Utility Classes */
.hs-nav-item--danger .hs-nav-icon,
.hs-nav-item--danger .hs-nav-label {
  color: #f87171;
}
.hs-nav-item--danger:hover {
  background: rgba(248, 113, 113, 0.1);
}
.notification-scroll {
  max-height: 300px;
  overflow-y: auto;
}
.chevron-icon {
  font-size: 18px;
}
.dropdown-name {
  color: var(--hs-gray-900);
}
.upload-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.avatar-preview {
  text-align: center;
  margin-top: 12px;
}

/* CONTENT */
.hs-content {
  flex: 1;
  padding: 24px;
  overflow-x: hidden;
  min-width: 0;
}

/* MOBILE */
.hs-sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
  animation: hs-fade-in 150ms ease;
}

@media (max-width: 1023px) {
  .hs-sidebar {
    transform: translateX(-100%);
    width: var(--hs-sidebar-width);
    z-index: 200;
  }

  .hs-sidebar.mobile-open {
    transform: translateX(0);
  }

  .hs-main-wrapper {
    margin-left: 0 !important;
  }

  .hs-mobile-toggle {
    display: flex;
  }

  .hs-desktop-toggle {
    display: none;
  }

  .hs-content {
    padding: 14px;
  }

  .hs-user-info {
    display: none;
  }
}

@media (max-width: 640px) {
  .hs-content {
    padding: 10px;
  }

  .hs-navbar {
    padding: 0 10px;
  }
}

/* Dark sidebar scrollbar */
.hs-sidebar-nav::-webkit-scrollbar {
  width: 4px;
}
.hs-sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}
.hs-sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.12);
  border-radius: 4px;
}
.hs-sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.2);
}
</style>
