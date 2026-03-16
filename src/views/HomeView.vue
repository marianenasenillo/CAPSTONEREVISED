<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase'
import { Pie, Bar } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const router = useRouter()

const userRole = ref(null)
const userName = ref('')
const userBarangay = ref('')
const loading = ref(true)

// Year filter — dynamic, defaults to current year
const currentSystemYear = new Date().getFullYear()
const selectedYear = ref(currentSystemYear)
const availableYears = computed(() => {
  const years = []
  for (let y = 2024; y <= currentSystemYear + 1; y++) years.push(y)
  return years
})

const stats = ref({
  households: 0,
  population: 0,
  maleCount: 0,
  femaleCount: 0,
})

const ageDistribution = ref({})
const populationByPurok = ref({})

// Report-style summary text
const reportSummary = ref('')

const pieOptions = { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } } } }
const barOptions = { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }

const genderChartData = computed(() => ({
  labels: ['Male', 'Female'],
  datasets: [{
    data: [stats.value.maleCount, stats.value.femaleCount],
    backgroundColor: ['#2563eb', '#dc2626'],
    borderWidth: 0,
  }]
}))

let barangay = ''

async function loadDashboardData() {
  loading.value = true
  const year = selectedYear.value
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  try {
    const [hhRes, membersRes] = await Promise.all([
      supabase.from('household_heads').select('*').eq('barangay', barangay).lte('created_at', yearEnd + 'T23:59:59').eq('is_archived', false),
      supabase.from('household_members').select('sex, age, age_group, created_at').eq('barangay', barangay).lte('created_at', yearEnd + 'T23:59:59'),
    ])

    const heads = hhRes.data || []
    const members = membersRes.data || []

    const totalPop = heads.reduce((s, h) => s + (h.population || 0), 0)
    const totalMale = heads.reduce((s, h) => s + (h.male_count || 0), 0)
    const totalFemale = heads.reduce((s, h) => s + (h.female_count || 0), 0)

    stats.value = {
      households: heads.length,
      population: totalPop,
      maleCount: totalMale,
      femaleCount: totalFemale,
    }

    // Age distribution
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

    // Population by Purok
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

    // Build report-style summary
    reportSummary.value = `As of ${year}, Barangay ${barangay} has a total population of ${totalPop.toLocaleString()} individuals across ${heads.length.toLocaleString()} households. ` +
      `The population is composed of ${totalMale.toLocaleString()} males and ${totalFemale.toLocaleString()} females. ` +
      (purokLabels.length > 0 ? `The population is distributed across ${purokLabels.length} purok(s): ${purokLabels.join(', ')}.` : '')

  } catch (err) {
    console.error('Dashboard data error:', err)
  } finally {
    loading.value = false
  }
}

watch(selectedYear, () => loadDashboardData())

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  userRole.value = user?.user_metadata?.role || null
  userName.value = user?.user_metadata?.full_name || 'User'
  userBarangay.value = user?.user_metadata?.barangay || ''
  barangay = userBarangay.value
  await loadDashboardData()
})

const showAbout = ref(false)
</script>

<template>
    <div class="home-page">
      <!-- Page Header -->
      <div class="hs-page-header">
        <div class="home-header-row">
          <div>
            <h1>Welcome, {{ userName }}</h1>
            <p>{{ userBarangay }} &mdash; {{ userRole }} Dashboard</p>
            <p class="hs-module-desc">Overview of barangay health statistics and population data.</p>
          </div>
          <div class="year-filter">
            <label class="hs-label">As of</label>
            <select v-model="selectedYear" class="hs-input year-select">
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <template v-if="loading">
        <div class="hs-stats-grid">
          <div v-for="n in 4" :key="n" class="hs-stat-card"><div class="hs-skeleton lg" style="height:80px;"></div></div>
        </div>
      </template>

      <template v-else>
        <!-- Year Indicator -->
        <div class="year-indicator">
          <span class="mdi mdi-calendar-outline"></span> As of {{ selectedYear }}
        </div>

        <!-- Primary Stat Cards — 4 core metrics -->
        <div class="hs-stats-grid">
          <div class="hs-stat-card">
            <div class="hs-stat-icon hs-stat-icon-info"><span class="mdi mdi-account-multiple"></span></div>
            <div class="hs-stat-info">
              <div class="hs-stat-label">Total Population</div>
              <div class="hs-stat-value">{{ stats.population.toLocaleString() }}</div>
            </div>
          </div>
          <div class="hs-stat-card">
            <div class="hs-stat-icon hs-stat-icon-primary"><span class="mdi mdi-home-group"></span></div>
            <div class="hs-stat-info">
              <div class="hs-stat-label">Total Households</div>
              <div class="hs-stat-value">{{ stats.households.toLocaleString() }}</div>
            </div>
          </div>
          <div class="hs-stat-card">
            <div class="hs-stat-icon hs-stat-icon-info"><span class="mdi mdi-gender-female"></span></div>
            <div class="hs-stat-info">
              <div class="hs-stat-label">Female</div>
              <div class="hs-stat-value">{{ stats.femaleCount.toLocaleString() }}</div>
            </div>
          </div>
          <div class="hs-stat-card">
            <div class="hs-stat-icon hs-stat-icon-success"><span class="mdi mdi-gender-male"></span></div>
            <div class="hs-stat-info">
              <div class="hs-stat-label">Male</div>
              <div class="hs-stat-value">{{ stats.maleCount.toLocaleString() }}</div>
            </div>
          </div>
        </div>

        <!-- Report Summary Section -->
        <div class="hs-card hs-mt-4">
          <div class="hs-card-header">
            <span><span class="mdi mdi-text-box-outline hs-text-primary"></span> Summary Report</span>
          </div>
          <div class="hs-card-body">
            <p class="report-summary-text">{{ reportSummary }}</p>
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

.home-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
}

.year-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.year-select {
  width: 100px;
  padding: 6px 10px;
  font-size: var(--hs-font-size-sm);
  font-weight: 500;
}

.year-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--hs-primary-bg);
  color: var(--hs-primary);
  border-radius: var(--hs-radius-md);
  font-size: var(--hs-font-size-sm);
  font-weight: 500;
  margin-bottom: 16px;
}

.report-summary-text {
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-600);
  line-height: 1.7;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--hs-space-4);
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
}
</style>
