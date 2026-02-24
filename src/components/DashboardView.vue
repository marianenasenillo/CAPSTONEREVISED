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
const avatarError = ref(false)
const showNotifications = ref(false)
const notifications = ref([])
const notifPage = ref(1)
const notifPageSize = 10
const hasMoreNotifs = ref(false)
const loadingNotifs = ref(false)
const unreadCount = ref(0)
const notifSearchQuery = ref('')

const filteredNotifications = computed(() => {
  const q = notifSearchQuery.value.trim().toLowerCase()
  if (!q) return notifications.value
  return notifications.value.filter(n => {
    const title = (n.title || '').toLowerCase()
    const message = (n.message || '').toLowerCase()
    const type = (n.type || '').toLowerCase()
    const dateStr = n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toLowerCase() : ''
    const relTime = formatNotifTime(n.created_at).toLowerCase()
    return title.includes(q) || message.includes(q) || type.includes(q) || dateStr.includes(q) || relTime.includes(q)
  })
})

async function fetchUnreadCount() {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('target_role', userRole.value || 'Admin')
      .eq('is_read', false)
    if (!error) unreadCount.value = count || 0
  } catch { /* ignore */ }
}

async function syncLowStockNotifications() {
  try {
    const { data: meds } = await supabase.from('medicine').select('name, quantity').lte('quantity', 5)
    if (!meds || meds.length === 0) return

    const role = userRole.value || 'Admin'
    // Check ALL notifications of this type in the last 24 hours (regardless of read state)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('notifications')
      .select('title')
      .eq('type', 'low_stock')
      .eq('target_role', role)
      .gte('created_at', since)
    const existingTitles = new Set((existing || []).map(n => n.title))

    const newNotifs = []
    for (const m of meds) {
      const title = m.quantity === 0
        ? `${m.name} is out of stock`
        : `${m.name} is low stock (${m.quantity} left)`
      if (!existingTitles.has(title)) {
        newNotifs.push({
          target_role: role,
          type: 'low_stock',
          title,
          message: `Current quantity: ${m.quantity}`,
          icon: 'mdi-pill',
          color: m.quantity === 0 ? 'var(--hs-danger)' : 'var(--hs-warning)',
          link: '/inventory',
        })
      }
    }
    if (newNotifs.length > 0) {
      await supabase.from('notifications').insert(newNotifs)
    }
  } catch (err) {
    console.error('Failed to sync low stock notifications', err)
  }
}

async function syncUpcomingEventNotifications() {
  try {
    const role = userRole.value || 'Admin'
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const { data: evts } = await supabase
      .from('events')
      .select('id, text, start')
      .gte('start', now.toISOString().slice(0, 10))
      .lte('start', weekLater.toISOString().slice(0, 10))
      .order('start', { ascending: true })
      .limit(10)

    if (!evts || evts.length === 0) return

    // Check ALL notifications of this type in the last 24 hours (regardless of read state)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('notifications')
      .select('title')
      .eq('type', 'upcoming_event')
      .eq('target_role', role)
      .gte('created_at', since)
    const existingTitles = new Set((existing || []).map(n => n.title))

    const newNotifs = []
    for (const e of evts) {
      const eventDate = new Date(e.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const title = `Upcoming: ${e.text}`
      if (!existingTitles.has(title)) {
        newNotifs.push({
          target_role: role,
          type: 'upcoming_event',
          title,
          message: `Scheduled for ${eventDate}`,
          icon: 'mdi-calendar-alert',
          color: 'var(--hs-info)',
          link: '/calendar',
        })
      }
    }
    if (newNotifs.length > 0) {
      await supabase.from('notifications').insert(newNotifs)
    }
  } catch (err) {
    console.error('Failed to sync event notifications', err)
  }
}

async function fetchNotifications(loadMore = false) {
  loadingNotifs.value = true
  try {
    const page = loadMore ? notifPage.value + 1 : 1
    const from = (page - 1) * notifPageSize
    const to = from + notifPageSize - 1

    if (!loadMore) {
      await syncLowStockNotifications()
      await syncUpcomingEventNotifications()
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('target_role', userRole.value || 'Admin')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    if (loadMore) {
      notifications.value.push(...(data || []))
    } else {
      notifications.value = data || []
    }
    notifPage.value = page
    hasMoreNotifs.value = (data || []).length === notifPageSize
    await fetchUnreadCount()
  } catch (err) {
    console.error('Failed to fetch notifications', err)
  }
  loadingNotifs.value = false
}

function toggleNotifications() {
  showNotifications.value = !showNotifications.value
  showUserMenu.value = false
  if (showNotifications.value) {
    notifPage.value = 1
    fetchNotifications()
  }
}

async function markAllRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('target_role', userRole.value || 'Admin')
    .eq('is_read', false)
  if (!error) {
    notifications.value.forEach(n => (n.is_read = true))
    unreadCount.value = 0
  }
}

async function markOneRead(n) {
  if (n.is_read) return
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', n.id)
  if (!error) {
    n.is_read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
}

function loadMoreNotifications() {
  fetchNotifications(true)
}

function formatNotifTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return d.toLocaleDateString()
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

let notifInterval = null

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
      avatar_url: user.user_metadata?.avatar_url || '',
    }
    avatarError.value = !userData.value.avatar_url
    fetchNotifications()
    // Refresh unread count every 60 seconds
    notifInterval = setInterval(fetchUnreadCount, 60000)
  } else {
    router.push('/')
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (notifInterval) clearInterval(notifInterval)
})

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('hs_sidebar', sidebarCollapsed.value ? 'collapsed' : 'expanded')
}

function toggleGroup(group) {
  // When sidebar is collapsed, expand it first so sub-items become visible
  if (sidebarCollapsed.value && !isMobile.value) {
    sidebarCollapsed.value = false
    localStorage.setItem('hs_sidebar', 'expanded')
    // Ensure the group is expanded after sidebar opens
    if (!expandedGroups.value.includes(group)) {
      expandedGroups.value.push(group)
    }
    return
  }
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
      avatarError.value = false

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

        <!-- Household Profiling (BHW + Admin) -->
        <button
          v-if="userRole === 'BHW' || userRole === 'Admin'"
          class="hs-nav-item"
          :class="{ active: isActive('/householdprofile') }"
          @click="navigateTo('/householdprofile')"
        >
          <span class="mdi mdi-home-group hs-nav-icon"></span>
          <span v-if="!sidebarCollapsed || isMobile" class="hs-nav-label">Household Profiling</span>
        </button>

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
            <div class="notif-search-wrap">
              <span class="mdi mdi-magnify notif-search-icon"></span>
              <input v-model="notifSearchQuery" class="notif-search-input" type="text" placeholder="Search notifications..." />
              <button v-if="notifSearchQuery" class="notif-search-clear" @click="notifSearchQuery = ''"><span class="mdi mdi-close"></span></button>
            </div>
            <div class="notification-scroll">
              <div v-if="loadingNotifs && notifications.length === 0" class="hs-empty-state">
                <p>Loading...</p>
              </div>
              <div v-for="n in filteredNotifications" :key="n.id" class="hs-notification-item" :class="{ unread: !n.is_read }" @click="markOneRead(n)">
                <div class="hs-notif-icon-wrap" :style="{ background: (n.color || 'var(--hs-info)') + '18' }">
                  <span class="mdi" :class="n.icon || 'mdi-bell'" :style="{ color: n.color || 'var(--hs-info)' }"></span>
                </div>
                <div class="hs-notification-item-text">
                  <strong>{{ n.title }}</strong>
                  <span v-if="n.message" class="hs-notif-message">{{ n.message }}</span>
                  <span class="hs-notif-time">{{ formatNotifTime(n.created_at) }}</span>
                </div>
                <span v-if="!n.is_read" class="hs-notif-dot"></span>
              </div>
              <div v-if="!loadingNotifs && filteredNotifications.length === 0 && notifSearchQuery" class="hs-empty-state">
                <p>No matching notifications</p>
              </div>
              <div v-else-if="!loadingNotifs && notifications.length === 0" class="hs-empty-state">
                <p>No notifications</p>
              </div>
              <div v-if="hasMoreNotifs" class="notif-load-more">
                <button class="hs-btn hs-btn-ghost hs-btn-sm" :disabled="loadingNotifs" @click="loadMoreNotifications">
                  {{ loadingNotifs ? 'Loading...' : 'Load more' }}
                </button>
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
              <img v-if="userData.avatar_url && !avatarError" :src="userData.avatar_url" alt="Avatar" @error="avatarError = true" />
              <span v-else class="mdi mdi-account hs-avatar-fallback"></span>
            </div>
            <span class="mdi mdi-chevron-down hs-text-muted chevron-icon"></span>
          </div>

          <!-- Dropdown -->
          <div v-if="showUserMenu" class="hs-user-dropdown" @click.stop>
            <div class="hs-user-dropdown-header">
              <div class="hs-avatar lg">
                <img v-if="userData.avatar_url && !avatarError" :src="userData.avatar_url" alt="Avatar" @error="avatarError = true" />
                <span v-else class="mdi mdi-account hs-avatar-fallback lg"></span>
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
                <span>{{ userData.barangay }}, {{ userData.purok }}</span>
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
              <img v-if="newAvatar || (userData.avatar_url && !avatarError)" :src="newAvatar || userData.avatar_url" alt="Preview" @error="avatarError = true" />
              <span v-else class="mdi mdi-account hs-avatar-fallback lg"></span>
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
  color: #ffffff;
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
  background: rgba(255,255,255,0.1);
  color: #ffffff;
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
  color: #ffffff;
}

.hs-nav-item.sub:hover {
  color: #ffffff;
  background: rgba(255,255,255,0.1);
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
  color: #ffffff;
  font-family: var(--hs-font-family);
  font-size: var(--hs-font-size-sm);
  font-weight: 400;
  cursor: pointer;
  transition: background-color 80ms ease, color 80ms ease;
  text-align: left;
  margin-bottom: 1px;
}

.hs-nav-group-toggle:hover {
  background: rgba(255,255,255,0.1);
  color: #ffffff;
}

.hs-nav-chevron {
  margin-left: auto;
  font-size: 14px;
  color: #ffffff;
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
  color: #ffffff;
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hs-gray-100);
}

.hs-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hs-avatar-fallback {
  font-size: 18px;
  color: var(--hs-gray-400);
  line-height: 1;
}

.hs-avatar-fallback.lg {
  font-size: 28px;
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
  max-height: 400px;
  overflow-y: auto;
}
.hs-notif-time {
  display: block;
  font-size: 11px;
  color: var(--hs-gray-400);
  margin-top: 2px;
}
.notif-load-more {
  text-align: center;
  padding: 10px 0;
  border-top: 1px solid var(--hs-gray-100);
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
