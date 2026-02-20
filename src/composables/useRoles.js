// RBAC Composable — Roles: admin, bhw, public
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/utils/supabase'

const currentUser = ref(null)
const currentRole = ref(null)
const currentBarangay = ref(null)
const isLoading = ref(true)

const PERMISSIONS = {
  'household:create': ['admin', 'bhw'],
  'household:edit': ['admin', 'bhw'],
  'household:delete': ['admin'],
  'household:archive': ['admin'],
  'household:view_archived': ['admin'],

  'member:create': ['admin', 'bhw'],
  'member:edit': ['admin', 'bhw'],
  'member:delete': ['admin'],

  'service:create': ['admin', 'bhw'],
  'service:edit': ['admin', 'bhw'],
  'service:delete': ['admin'],
  'service:archive': ['admin'],
  'service:view_archived': ['admin'],

  'inventory:create': ['admin'],
  'inventory:edit': ['admin'],
  'inventory:delete': ['admin'],
  'inventory:avail': ['admin', 'bhw'],

  'reports:view': ['admin'],
  'reports:export': ['admin'],

  'bhw:register': ['admin'],
  'bhw:manage': ['admin'],
  'bhw:deactivate': ['admin'],

  'admin:manage': ['admin'],
  'admin:register': ['admin'],

  'calendar:create': ['admin', 'bhw'],
  'calendar:edit': ['admin', 'bhw'],
  'calendar:delete': ['admin'],

  'borrower:create': ['admin', 'bhw'],
  'borrower:view': ['admin', 'bhw'],
  'borrower:edit': ['admin', 'bhw'],

  'config:manage': ['admin'],
  'config:service_rules': ['admin'],
}

export const ROLE_HIERARCHY = {
  admin: 3,
  bhw: 2,
  public: 1,
}

export const ROLE_LABELS = {
  admin: 'Admin',
  bhw: 'BHW',
  public: 'Public',
}

function normalizeRole(role) {
  if (!role) return 'public'
  const r = role.toLowerCase().replace(/\s+/g, '_')
  if (r === 'admin') return 'admin'
  if (r === 'bhw') return 'bhw'
  return 'public'
}

export function useRoles() {
  async function fetchUser() {
    try {
      isLoading.value = true
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        currentUser.value = user
        currentRole.value = normalizeRole(user.user_metadata?.role)
        currentBarangay.value = user.user_metadata?.barangay || null
      } else {
        currentUser.value = null
        currentRole.value = 'public'
        currentBarangay.value = null
      }
    } catch (err) {
      console.error('Failed to fetch user for RBAC:', err)
      currentRole.value = 'public'
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    if (!currentUser.value && isLoading.value) fetchUser()
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      currentUser.value = session.user
      currentRole.value = normalizeRole(session.user.user_metadata?.role)
      currentBarangay.value = session.user.user_metadata?.barangay || null
    } else {
      currentUser.value = null
      currentRole.value = 'public'
      currentBarangay.value = null
    }
  })

  const role = computed(() => currentRole.value)
  const user = computed(() => currentUser.value)
  const barangay = computed(() => currentBarangay.value)

  const isAdmin = computed(() => currentRole.value === 'admin')
  const isBHW = computed(() => currentRole.value === 'bhw')
  const isPublic = computed(() => currentRole.value === 'public')
  const isAuthenticated = computed(() => currentRole.value !== 'public' && currentUser.value !== null)

  function hasPermission(permission) {
    if (!currentRole.value) return false
    const allowed = PERMISSIONS[permission]
    if (!allowed) return false
    return allowed.includes(currentRole.value)
  }

  function hasAllPermissions(permissions) {
    return permissions.every(p => hasPermission(p))
  }

  function hasAnyPermission(permissions) {
    return permissions.some(p => hasPermission(p))
  }

  function hasMinRole(requiredRole) {
    const requiredLevel = ROLE_HIERARCHY[normalizeRole(requiredRole)] || 0
    const currentLevel = ROLE_HIERARCHY[currentRole.value] || 0
    return currentLevel >= requiredLevel
  }

  const canCreateHousehold = computed(() => hasPermission('household:create'))
  const canEditHousehold = computed(() => hasPermission('household:edit'))
  const canDeleteHousehold = computed(() => hasPermission('household:delete'))
  const canArchive = computed(() => hasPermission('household:archive'))
  const canViewArchived = computed(() => hasPermission('household:view_archived'))
  const canManageInventory = computed(() => hasPermission('inventory:create'))
  const canAvailInventory = computed(() => hasPermission('inventory:avail'))
  const canViewReports = computed(() => hasPermission('reports:view'))
  const canManageBHW = computed(() => hasPermission('bhw:manage'))
  const canManageConfig = computed(() => hasPermission('config:manage'))

  return {
    user, role, barangay, isLoading,
    isAdmin, isBHW, isPublic, isAuthenticated,
    hasPermission, hasAllPermissions, hasAnyPermission, hasMinRole,
    canCreateHousehold, canEditHousehold, canDeleteHousehold,
    canArchive, canViewArchived, canManageInventory, canAvailInventory,
    canViewReports, canManageBHW, canManageConfig,
    fetchUser, normalizeRole,
  }
}
