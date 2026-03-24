import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/utils/supabase'

import LoginView from '@/views/LoginView.vue'
import AdminRegister from '@/views/AdminRegister.vue'

const MainLayout = () => import('@/components/DashboardView.vue')
const PublicDashboard = () => import('@/views/PublicDashboard.vue')
const HomeView = () => import('@/views/HomeView.vue')
const HouseholdProfiling = () => import('@/views/HouseholdProfiling.vue')
const MaternalServices = () => import('@/views/MaternalServices.vue')
const ChildcareServices = () => import('@/views/ChildcareServices.vue')
const PreventiveHealth = () => import('@/views/PreventiveHealth.vue')
const Calendar = () => import('@/views/Calendar.vue')
const Inventory = () => import('@/views/Inventory.vue')
const ReportGeneration = () => import('@/views/ReportGeneration.vue')
const HouseholdRecords = () => import('@/views/HouseholdRecords.vue')
const WraRecords = () => import('@/views/WraRecords.vue')
const CervicalScreeningRecords = () => import('@/views/CervicalScreeningRecords.vue')
const ChildcareRecords = () => import('@/views/ChildcareRecords.vue')
const PreventiveHealthRecords = () => import('@/views/PreventiveHealthRecords.vue')
const BhwRegistration = () => import('@/views/BhwRegistration.vue')
const BhwManagement = () => import('@/views/BhwManagement.vue')
const HouseholdExport = () => import('@/components/reports/HouseholdExport.vue')
const BorrowerProfiling = () => import('@/views/BorrowerProfiling.vue')
const ServiceEligibility = () => import('@/views/ServiceEligibility.vue')

// Normalize role string: "Admin" → "admin", "BHW" → "bhw"
function normalizeRole(role) {
  if (!role) return 'public'
  const r = role.toLowerCase().replace(/\s+/g, '_')
  if (r === 'admin') return 'admin'
  if (r === 'bhw') return 'bhw'
  return 'public'
}

const ROLE_LEVELS = {
  public: 0,
  bhw: 1,
  admin: 2,
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Guest / Public routes
    { path: '/', name: 'PublicDashboard', component: PublicDashboard, meta: { public: true } },
    { path: '/admin', name: 'Login', component: LoginView, meta: { guest: true } },
    { path: '/adminregister', name: 'adminregister', component: AdminRegister, meta: { guest: true } },

    // Authenticated routes
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        { path: 'home', name: 'Homeview', component: HomeView },
        { path: 'dashboard', name: 'Dashboard', redirect: '/home' },

        // Health Services (BHW + Admin)
        { path: 'householdprofile', name: 'householdprofiling', component: HouseholdProfiling },
        { path: 'maternalservices', name: 'maternalservices', component: MaternalServices, meta: { minRole: 'bhw' } },
        { path: 'childcare', name: 'childcare', component: ChildcareServices, meta: { minRole: 'bhw' } },
        { path: 'preventivehealthservices', name: 'preventivehealthservices', component: PreventiveHealth, meta: { minRole: 'bhw' } },

        // Borrower & Patient Profiling
        { path: 'borrowers', name: 'borrowers', component: BorrowerProfiling, meta: { minRole: 'bhw' } },

        // Service Eligibility
        { path: 'eligibility', name: 'eligibility', component: ServiceEligibility, meta: { minRole: 'bhw' } },

        // Shared
        { path: 'calendar', name: 'calendar', component: Calendar },
        { path: 'inventory', name: 'inventory', component: Inventory },

        // Records
        { path: 'hhpsrecords', name: 'hhpsrecords', component: HouseholdRecords },
        { path: 'maternalwrarecords', name: 'maternalwrarecords', component: WraRecords },
        { path: 'maternalccsrecords', name: 'maternalccsrecords', component: CervicalScreeningRecords },
        { path: 'childcarerecords', name: 'childcarerecords', component: ChildcareRecords },
        { path: 'phsrecords', name: 'phsrecords', component: PreventiveHealthRecords },

        // Administration (Admin)
        { path: 'reports', name: 'reports', component: ReportGeneration, meta: { requiresAdmin: true, minRole: 'admin' } },
        { path: 'register', name: 'register', component: BhwRegistration, meta: { requiresAdmin: true, minRole: 'admin' } },
        { path: 'bhw', name: 'bhw', component: BhwManagement },
        { path: 'hhpsexport', name: 'hhpsexport', component: HouseholdExport },
      ],
    },

    { path: '/:pathMatch(.*)*', redirect: '/admin' },
  ],
})

// Navigation Guard
router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession()

  const isPublicRoute = to.matched.some(r => r.meta.public)
  const isGuest = to.matched.some(r => r.meta.guest)
  const needsAuth = to.matched.some(r => r.meta.requiresAuth)
  const needsAdmin = to.matched.some(r => r.meta.requiresAdmin)
  const minRole = to.matched.reduce((acc, r) => r.meta.minRole || acc, null)

  if (isPublicRoute) {
    return next()
  }

  if (isGuest && session) {
    return next('/home')
  }

  if (needsAuth && !session) {
    return next('/admin')
  }

  if (session) {
    const rawRole = session.user?.user_metadata?.role
    const userRole = normalizeRole(rawRole)
    const userLevel = ROLE_LEVELS[userRole] || 0

    if (needsAdmin) {
      if (userLevel < ROLE_LEVELS.admin) {
        return next('/home')
      }
    }

    if (minRole) {
      const requiredLevel = ROLE_LEVELS[normalizeRole(minRole)] || 0
      if (userLevel < requiredLevel) {
        return next('/home')
      }
    }
  }

  next()
})

export default router
