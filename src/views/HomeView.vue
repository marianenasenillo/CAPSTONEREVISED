<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase'
import { Pie, Bar, Line } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from 'chart.js'
import medicineApi from '@/utils/medicine'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler)

const router = useRouter()

const userRole = ref(null)
const userName = ref('')
const userBarangay = ref('')
const loading = ref(true)

const stats = ref({
  households: 0,
  population: 0,
  maleCount: 0,
  femaleCount: 0,
  wra: 0,
  childcare: 0,
  familyPlanning: 0,
  deworming: 0,
  events: 0,
  medicineTypes: 0,
  lowStockCount: 0,
  servicesThisMonth: 0,
  upcomingEvents: 0,
})

const ageDistribution = ref({})
const monthlyServices = ref({})
const populationByPurok = ref({})
const medicineTrend = ref({})
const allMedicine = ref([])
const upcomingEventsList = ref([])

const notifications = ref([])

const pieOptions = { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } } } }
const barOptions = { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
const lineOptions = { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { y: { beginAtZero: true } } }

const genderChartData = computed(() => ({
  labels: ['Male', 'Female'],
  datasets: [{
    data: [stats.value.maleCount, stats.value.femaleCount],
    backgroundColor: ['#2563eb', '#dc2626'],
    borderWidth: 0,
  }]
}))

const quickActions = [
  { label: 'Household Profiling', icon: 'mdi-home-group', path: '/householdprofile', desc: 'Add new households' },
  { label: 'Maternal Services', icon: 'mdi-mother-nurse', path: '/maternalservices', desc: 'WRA & Cervical screening' },
  { label: 'Child Care', icon: 'mdi-baby-face-outline', path: '/childcare', desc: 'Vitamin A supplementation' },
  { label: 'Family Planning', icon: 'mdi-account-heart', path: '/familyplanning', desc: 'Responsible parenthood' },
  { label: 'Preventive Health', icon: 'mdi-shield-plus', path: '/preventivehealthservices', desc: 'Deworming program' },
  { label: 'Calendar', icon: 'mdi-calendar-month-outline', path: '/calendar', desc: 'Events & schedules' },
]

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  userRole.value = user?.user_metadata?.role || null
  userName.value = user?.user_metadata?.full_name || 'User'
  userBarangay.value = user?.user_metadata?.barangay || ''
  const barangay = userBarangay.value

  try {
    const [hhRes, membersRes, wraRes, ccRes, fpRes, dwRes, evRes, medData] = await Promise.all([
      supabase.from('household_heads').select('*').eq('barangay', barangay).eq('is_archived', false),
      supabase.from('household_members').select('sex, age, age_group, created_at').eq('barangay', barangay),
      supabase.from('wra_records').select('id, created_at', { count: 'exact', head: true }).eq('is_archived', false),
      supabase.from('childcare_vitamina_records').select('id, created_at', { count: 'exact', head: true }).eq('is_archived', false),
      supabase.from('family_planning_records').select('id, created_at', { count: 'exact', head: true }).eq('is_archived', false),
      supabase.from('deworming_records').select('id, created_at', { count: 'exact', head: true }).eq('is_archived', false),
      supabase.from('events').select('*').order('start', { ascending: true }),
      medicineApi.listMedicine(),
    ])

    const heads = hhRes.data || []
    const members = membersRes.data || []
    const events = evRes.data || []
    allMedicine.value = medData || []

    const totalPop = heads.reduce((s, h) => s + (h.population || 0), 0)
    const totalMale = heads.reduce((s, h) => s + (h.male_count || 0), 0)
    const totalFemale = heads.reduce((s, h) => s + (h.female_count || 0), 0)
    const lowStock = allMedicine.value.filter(m => m.quantity > 0 && m.quantity <= 5)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const servicesThisMonth = [wraRes, ccRes, fpRes, dwRes].reduce((sum, r) => sum + (r.count || 0), 0)

    const todayStr = new Date().toISOString().slice(0, 10)
    const upcoming = events.filter(e => e.start >= todayStr)
    upcomingEventsList.value = upcoming.slice(0, 5)

    stats.value = {
      households: heads.length,
      population: totalPop,
      maleCount: totalMale,
      femaleCount: totalFemale,
      wra: wraRes.count || 0,
      childcare: ccRes.count || 0,
      familyPlanning: fpRes.count || 0,
      deworming: dwRes.count || 0,
      events: events.length,
      medicineTypes: allMedicine.value.length,
      lowStockCount: lowStock.length,
      servicesThisMonth,
      upcomingEvents: upcoming.length,
    }

    const ageGroups = { '0-4': 0, '5-9': 0, '10-14': 0, '15-19': 0, '20-39': 0, '40-59': 0, '60+': 0 }
    members.forEach(m => {
      const a = m.age || 0
      if (a <= 4) ageGroups['0-4']++
      else if (a <= 9) ageGroups['5-9']++
      else if (a <= 14) ageGroups['10-14']++
      else if (a <= 19) ageGroups['15-19']++
      else if (a <= 39) ageGroups['20-39']++
      else if (a <= 59) ageGroups['40-59']++
      else ageGroups['60+']++
    })
    ageDistribution.value = {
      labels: Object.keys(ageGroups),
      datasets: [{ data: Object.values(ageGroups), backgroundColor: ['#4a7a1a', '#6b9e34', '#2563eb', '#3b82f6', '#ca8a04', '#dc2626', '#71717a'], borderWidth: 0 }]
    }

    const purokMap = {}
    heads.forEach(h => {
      const p = h.purok || 'Unknown'
      purokMap[p] = (purokMap[p] || 0) + (h.population || 0)
    })
    const purokLabels = Object.keys(purokMap).sort()
    populationByPurok.value = {
      labels: purokLabels,
      datasets: [{ label: 'Population', data: purokLabels.map(l => purokMap[l]), backgroundColor: '#4a7a1a', borderRadius: 4 }]
    }

    const months = []
    const wraByMonth = []
    const ccByMonth = []
    const fpByMonth = []
    const dwByMonth = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en', { month: 'short', year: '2-digit' })
      months.push(label)
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 7)
      wraByMonth.push(0); ccByMonth.push(0); fpByMonth.push(0); dwByMonth.push(0)
    }
    monthlyServices.value = {
      labels: ['Households', 'WRA', 'Child Care', 'Family Planning', 'Deworming'],
      datasets: [{ label: 'Total Records', data: [heads.length, wraRes.count || 0, ccRes.count || 0, fpRes.count || 0, dwRes.count || 0], backgroundColor: ['#4a7a1a', '#dc2626', '#ca8a04', '#71717a', '#2563eb'], borderRadius: 4 }]
    }

    const notifs = []
    if (lowStock.length > 0) {
      notifs.push({ id: 'low-stock', icon: 'mdi-alert-circle', text: `${lowStock.length} medicine(s) are running low on stock`, time: 'Now', type: 'warning', link: '/inventory' })
    }
    if (upcoming.length > 0) {
      notifs.push({ id: 'events', icon: 'mdi-calendar-check', text: `${upcoming.length} upcoming event(s) scheduled`, time: 'Today', type: 'info', link: '/calendar' })
    }
    notifications.value = notifs

  } catch (err) {
    console.error('Dashboard data error:', err)
  } finally {
    loading.value = false
  }
})

const showAbout = ref(false)
</script>

<template>
    <div class="home-page">
      <!-- Page Header -->
      <div class="hs-page-header">
        <h1>Welcome, {{ userName }}</h1>
        <p>{{ userBarangay }} &mdash; {{ userRole }} Dashboard</p>
        <p class="hs-module-desc">Overview of barangay health statistics, services, and recent activity.</p>
      </div>

      <!-- Loading state -->
      <template v-if="loading">
        <div class="hs-stats-grid">
          <div v-for="n in 6" :key="n" class="hs-stat-card"><div class="hs-skeleton lg" style="height:80px;"></div></div>
        </div>
      </template>

      <template v-else>
        <!-- Primary Stat Cards -->
        <div class="hs-stats-grid">
          <div class="hs-stat-card">
            <div class="hs-stat-icon hs-stat-icon-primary"><span class="mdi mdi-home-group"></span></div>
            <div class="hs-stat-info">
              <div class="hs-stat-label">Households</div>
              <div class="hs-stat-value">{{ stats.households }}</div>
            </div>
          </div>
          <div class="hs-stat-card">
            <div class="hs-stat-icon hs-stat-icon-info"><span class="mdi mdi-account-multiple"></span></div>
            <div class="hs-stat-info">
              <div class="hs-stat-label">Total Population</div>
              <div class="hs-stat-value">{{ stats.population }}</div>
            </div>
          </div>
          <div class="hs-stat-card">
            <div class="hs-stat-icon hs-stat-icon-info"><span class="mdi mdi-gender-male"></span></div>
            <div class="hs-stat-info">
              <div class="hs-stat-label">Male</div>
              <div class="hs-stat-value">{{ stats.maleCount }}</div>
            </div>
          </div>
          <div class="hs-stat-card">
            <div class="hs-stat-icon hs-stat-icon-danger"><span class="mdi mdi-gender-female"></span></div>
            <div class="hs-stat-info">
              <div class="hs-stat-label">Female</div>
              <div class="hs-stat-value">{{ stats.femaleCount }}</div>
            </div>
          </div>
          <div class="hs-stat-card">
            <div class="hs-stat-icon hs-stat-icon-success"><span class="mdi mdi-pill"></span></div>
            <div class="hs-stat-info">
              <div class="hs-stat-label">Medicine Types</div>
              <div class="hs-stat-value">{{ stats.medicineTypes }}</div>
            </div>
          </div>
        </div>

        <!-- Service summary row -->
        <div class="hs-stats-grid hs-mt-4">
          <div class="hs-stat-card hs-stat-card--clickable" @click="router.push('/maternalwrarecords')">
            <div class="hs-stat-icon hs-stat-icon-danger"><span class="mdi mdi-account-heart"></span></div>
            <div class="hs-stat-info"><div class="hs-stat-label">WRA Records</div><div class="hs-stat-value">{{ stats.wra }}</div></div>
          </div>
          <div class="hs-stat-card hs-stat-card--clickable" @click="router.push('/childcarerecords')">
            <div class="hs-stat-icon hs-stat-icon-warning"><span class="mdi mdi-baby-face-outline"></span></div>
            <div class="hs-stat-info"><div class="hs-stat-label">Child Care</div><div class="hs-stat-value">{{ stats.childcare }}</div></div>
          </div>
          <div class="hs-stat-card hs-stat-card--clickable" @click="router.push('/fpsrecords')">
            <div class="hs-stat-icon hs-stat-icon-primary"><span class="mdi mdi-account-heart"></span></div>
            <div class="hs-stat-info"><div class="hs-stat-label">Family Planning</div><div class="hs-stat-value">{{ stats.familyPlanning }}</div></div>
          </div>
          <div class="hs-stat-card hs-stat-card--clickable" @click="router.push('/phsrecords')">
            <div class="hs-stat-icon hs-stat-icon-info"><span class="mdi mdi-shield-plus"></span></div>
            <div class="hs-stat-info"><div class="hs-stat-label">Deworming</div><div class="hs-stat-value">{{ stats.deworming }}</div></div>
          </div>
          <div class="hs-stat-card hs-stat-card--clickable" @click="router.push('/calendar')">
            <div class="hs-stat-icon hs-stat-icon-info"><span class="mdi mdi-calendar-check"></span></div>
            <div class="hs-stat-info"><div class="hs-stat-label">Upcoming Events</div><div class="hs-stat-value">{{ stats.upcomingEvents }}</div></div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-grid hs-mt-6">
          <!-- Gender Distribution Pie -->
          <div class="hs-chart-card" v-if="stats.maleCount + stats.femaleCount > 0">
            <h3><span class="mdi mdi-chart-pie hs-text-primary"></span> Gender Distribution</h3>
            <div class="hs-chart-centered">
              <Pie :data="genderChartData" :options="pieOptions" />
            </div>
          </div>

          <!-- Age Distribution Pie -->
          <div class="hs-chart-card" v-if="ageDistribution.labels">
            <h3><span class="mdi mdi-chart-donut hs-text-primary"></span> Age Group Distribution</h3>
            <div class="hs-chart-centered">
              <Pie :data="ageDistribution" :options="pieOptions" />
            </div>
          </div>

          <!-- Population by Purok Bar -->
          <div class="hs-chart-card" v-if="populationByPurok.labels">
            <h3><span class="mdi mdi-chart-bar hs-text-primary"></span> Population by Purok</h3>
            <Bar :data="populationByPurok" :options="barOptions" />
          </div>

          <!-- Services Overview Bar -->
          <div class="hs-chart-card" v-if="monthlyServices.labels">
            <h3><span class="mdi mdi-chart-bar hs-text-primary"></span> Services Overview</h3>
            <Bar :data="monthlyServices" :options="barOptions" />
          </div>
        </div>

        <!-- Bottom Section: Quick Actions + Events + Low Stock -->
        <div class="home-bottom-grid">
          <!-- Quick Actions -->
          <div class="hs-card">
            <div class="hs-card-header"><span><span class="mdi mdi-lightning-bolt hs-text-primary"></span> Quick Actions</span></div>
            <div class="hs-card-body">
              <div class="hs-quick-actions">
                <div v-for="action in quickActions" :key="action.path" class="hs-quick-action hs-tooltip" :data-tooltip="action.desc" @click="router.push(action.path)">
                  <span :class="'mdi ' + action.icon"></span>
                  <span>{{ action.label }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Upcoming Events -->
          <div class="hs-card">
            <div class="hs-card-header">
              <span><span class="mdi mdi-calendar-star hs-text-primary"></span> Upcoming Events</span>
              <button class="hs-btn hs-btn-ghost hs-btn-sm" @click="router.push('/calendar')">View All</button>
            </div>
            <div class="hs-card-body hs-p-0">
              <div v-if="upcomingEventsList.length === 0" class="hs-empty-state">
                <span class="mdi mdi-calendar-blank-outline"></span>
                <p>No upcoming events</p>
              </div>
              <div v-for="ev in upcomingEventsList" :key="ev.id" class="upcoming-event-row">
                <div class="event-date-badge">
                  <span class="month">{{ new Date(ev.start).toLocaleDateString('en', { month: 'short' }) }}</span>
                  <span class="day">{{ new Date(ev.start).getDate() }}</span>
                </div>
                <div>
                  <div class="event-text">{{ ev.text }}</div>
                  <span class="hs-badge" :style="{ background: ev.type === 'holiday' ? 'var(--hs-danger-bg)' : ev.type === 'task' ? 'var(--hs-info-bg)' : 'var(--hs-success-bg)', color: ev.type === 'holiday' ? 'var(--hs-danger)' : ev.type === 'task' ? 'var(--hs-info)' : 'var(--hs-success)', fontSize: 'var(--hs-font-size-xs)' }">{{ ev.type }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- About Section -->
        <div class="hs-card hs-mt-6">
          <div class="hs-card-header">
            <span>About HealthSync</span>
            <button class="hs-btn hs-btn-ghost hs-btn-sm" @click="showAbout = !showAbout">
              <span class="mdi" :class="showAbout ? 'mdi-chevron-up' : 'mdi-chevron-down'"></span>
            </button>
          </div>
          <div class="hs-card-body">
            <p class="about-intro">
              <strong>Buenavista HealthSync (BHS)</strong> is a digital health platform designed to
              transform barangay healthcare services through secure online record management.
            </p>
            <div v-if="showAbout">
              <div class="about-section">
                <h4>Mission</h4>
                <p>To empower barangay healthcare workers with a secure, efficient platform for managing community health data and improving service delivery.</p>
              </div>
              <div class="about-section">
                <h4>Vision</h4>
                <p>To be the leading digital health platform for barangays, promoting data-driven, accessible, and sustainable healthcare.</p>
              </div>
              <div class="about-section">
                <h4>Key Features</h4>
                <div class="features-grid">
                  <div class="feature-item"><span class="mdi mdi-check-circle hs-text-success"></span> Secure Data Entry</div>
                  <div class="feature-item"><span class="mdi mdi-check-circle hs-text-success"></span> Digital Records</div>
                  <div class="feature-item"><span class="mdi mdi-check-circle hs-text-success"></span> Real-Time Access</div>
                  <div class="feature-item"><span class="mdi mdi-check-circle hs-text-success"></span> Smart Archiving</div>
                  <div class="feature-item"><span class="mdi mdi-check-circle hs-text-success"></span> Reports & Analytics</div>
                  <div class="feature-item"><span class="mdi mdi-check-circle hs-text-success"></span> Role-Based Access</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
</template>

<style scoped>
.home-page { max-width: var(--hs-content-max-width); }

.hs-stat-card--danger {
  background: var(--hs-danger-bg);
  border-color: var(--hs-danger-border);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--hs-space-4);
}

.home-bottom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--hs-space-4);
  margin-top: var(--hs-space-5);
}

/* Events */
.upcoming-event-row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--hs-gray-50);
  transition: background var(--hs-transition-fast);
}
.upcoming-event-row:last-child { border-bottom: none; }
.upcoming-event-row:hover { background: var(--hs-gray-50); }
.event-date-badge {
  background: var(--hs-primary-bg);
  border-radius: var(--hs-radius-md);
  padding: 4px 10px;
  text-align: center;
  min-width: 44px;
}
.event-date-badge .month {
  display: block;
  font-size: 10px;
  font-weight: 500;
  color: var(--hs-primary);
  text-transform: uppercase;
}
.event-date-badge .day {
  display: block;
  font-size: var(--hs-font-size-lg);
  font-weight: 600;
  color: var(--hs-primary-dark);
  line-height: 1;
}
.event-text {
  font-weight: 400;
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-600);
}

/* About */
.about-intro {
  color: var(--hs-gray-600);
  font-size: var(--hs-font-size-sm);
  margin-bottom: 14px;
  line-height: 1.6;
}
.about-section { margin-bottom: 14px; }
.about-section h4 {
  font-size: var(--hs-font-size-sm);
  font-weight: 500;
  color: var(--hs-gray-700);
  margin-bottom: 4px;
}
.about-section p {
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-600);
  line-height: 1.6;
}
.features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.feature-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-700);
}

@media (max-width: 1024px) {
  .charts-grid { grid-template-columns: 1fr; }
  .home-bottom-grid { grid-template-columns: 1fr; }
}
</style>
