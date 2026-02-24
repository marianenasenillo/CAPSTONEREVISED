<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase'
import { getAgeDistribution } from '@/utils/ageClassification'

const router = useRouter()
const loading = ref(true)

const events = ref([])
const medicine = ref([])
const tools = ref([])
const householdHeads = ref([])
const householdMembers = ref([])
const stats = ref({ households: 0, population: 0, events: 0, medicineTypes: 0, maleCount: 0, femaleCount: 0 })

const genderDistribution = computed(() => {
  const male = stats.value.maleCount || 0
  const female = stats.value.femaleCount || 0
  const total = male + female
  return {
    male,
    female,
    total,
    malePercent: total > 0 ? ((male / total) * 100).toFixed(1) : 0,
    femalePercent: total > 0 ? ((female / total) * 100).toFixed(1) : 0,
  }
})

const ageDistribution = computed(() => {
  return getAgeDistribution(householdMembers.value)
})

const classificationSummary = computed(() => {
  const counts = { '4ps': 0, 'senior_only': 0, 'with_pregnant': 0, 'with_under_five': 0, 'indigent': 0 }
  for (const h of householdHeads.value) {
    const classifications = h.classifications || []
    for (const key of Object.keys(counts)) {
      if (classifications.includes(key)) counts[key]++
    }
  }
  return [
    { key: '4ps', label: '4Ps Beneficiary', icon: 'mdi-hand-heart', color: '#4CAF50', count: counts['4ps'] },
    { key: 'senior_only', label: 'Senior-Only', icon: 'mdi-account-clock', color: '#FF9800', count: counts['senior_only'] },
    { key: 'with_pregnant', label: 'With Pregnant', icon: 'mdi-baby-carriage', color: '#E91E63', count: counts['with_pregnant'] },
    { key: 'with_under_five', label: 'With Under-5', icon: 'mdi-baby-face-outline', color: '#2196F3', count: counts['with_under_five'] },
    { key: 'indigent', label: 'Indigent', icon: 'mdi-home-alert', color: '#795548', count: counts['indigent'] },
  ]
})

const upcomingEvents = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return events.value
    .filter(e => e.start >= today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 8)
})

const availableMedicine = computed(() => medicine.value.filter(m => m.quantity > 0))
const availableTools = computed(() => tools.value.filter(t => t.quantity > 0))
const lowStockMedicine = computed(() => medicine.value.filter(m => m.quantity > 0 && m.quantity <= 5))

const eventTypeColor = (type) => {
  const map = { event: 'var(--hs-success)', task: 'var(--hs-primary)', reminder: 'var(--hs-warning)', holiday: 'var(--hs-danger)' }
  return map[type] || 'var(--hs-success)'
}

const eventTypeIcon = (type) => {
  const map = { event: 'mdi-calendar-star', task: 'mdi-checkbox-marked-circle-outline', reminder: 'mdi-bell-ring-outline', holiday: 'mdi-palm-tree' }
  return map[type] || 'mdi-calendar'
}

onMounted(async () => {
  try {
    const [evRes, medRes, toolRes, hhRes, membersRes] = await Promise.all([
      supabase.from('events').select('*').order('start', { ascending: true }),
      supabase.from('medicine').select('*').order('created_at', { ascending: false }),
      supabase.from('tools').select('*').order('created_at', { ascending: false }),
      supabase.from('household_heads').select('head_id, population, male_count, female_count, classifications', { count: 'exact', head: false }).eq('is_archived', false),
      supabase.from('household_members').select('birthdate, sex, age, age_group'),
    ])

    events.value = evRes.data || []
    medicine.value = medRes.data || []
    tools.value = toolRes.data || []
    householdHeads.value = hhRes.data || []
    householdMembers.value = membersRes.data || []

    const totalPop = (hhRes.data || []).reduce((sum, h) => sum + (h.population || 0), 0)
    const totalMale = (hhRes.data || []).reduce((sum, h) => sum + (h.male_count || 0), 0)
    const totalFemale = (hhRes.data || []).reduce((sum, h) => sum + (h.female_count || 0), 0)
    stats.value = {
      households: hhRes.count || 0,
      population: totalPop,
      events: events.value.length,
      medicineTypes: medicine.value.length,
      maleCount: totalMale,
      femaleCount: totalFemale,
    }
  } catch (err) {
    console.error('Failed to load public data:', err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="public-page">
    <!-- Hero Header -->
    <header class="public-hero">
      <div class="public-hero-bg"></div>
      <div class="public-hero-content">
        <div class="public-hero-top">
          <div class="public-brand">
            <img src="/images/logo.png" alt="HealthSync" class="public-logo" />
            <div>
              <h1 class="public-title">Buenavista HealthSync</h1>
              <p class="public-subtitle">Municipality of Buenavista, Agusan del Norte</p>
            </div>
          </div>
          <button class="hs-btn hs-btn-primary" @click="router.push('/admin')">
            <span class="mdi mdi-login"></span> Sign In
          </button>
        </div>
      </div>
    </header>

    <!-- Page Intro -->
    <div class="public-intro" style="margin-bottom: 20px;">
      <h2 class="public-intro-title">Public Health Dashboard</h2>
      <p class="public-intro-desc">Stay informed about community health programs, upcoming events, and available medical resources in our barangay.</p>
    </div>

    <main class="public-main">
      <!-- Loading -->
      <div v-if="loading" class="hs-empty-state public-loading">
        <div class="hs-spinner"></div>
        <p>Loading public data...</p>
      </div>

      <template v-else>
        <!-- Summary Stats -->
        <section class="public-section">
          <div class="public-stats-grid">
            <div class="public-stat-card public-stat-households">
              <div class="public-stat-icon-wrap">
                <span class="mdi mdi-home-group"></span>
              </div>
              <div class="public-stat-body">
                <div class="public-stat-value">{{ stats.households }}</div>
                <div class="public-stat-label">Registered Households</div>
              </div>
            </div>
            <div class="public-stat-card public-stat-population">
              <div class="public-stat-icon-wrap">
                <span class="mdi mdi-account-multiple"></span>
              </div>
              <div class="public-stat-body">
                <div class="public-stat-value">{{ stats.population }}</div>
                <div class="public-stat-label">Total Population</div>
              </div>
            </div>
            <div class="public-stat-card public-stat-events">
              <div class="public-stat-icon-wrap">
                <span class="mdi mdi-calendar-check"></span>
              </div>
              <div class="public-stat-body">
                <div class="public-stat-value">{{ stats.events }}</div>
                <div class="public-stat-label">Upcoming Events</div>
              </div>
            </div>
            <div class="public-stat-card public-stat-medicine">
              <div class="public-stat-icon-wrap">
                <span class="mdi mdi-pill"></span>
              </div>
              <div class="public-stat-body">
                <div class="public-stat-value">{{ stats.medicineTypes }}</div>
                <div class="public-stat-label">Medicine Types</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Population Insights — Gender & Age Distribution -->
        <section class="public-section">
          <h2 class="public-section-title"><span class="mdi mdi-chart-pie"></span> Population Insights</h2>
          <p class="public-section-desc">Demographic breakdown of the barangay population.</p>

          <div class="public-two-col">
            <!-- Gender Distribution -->
            <div class="public-card">
              <h3 class="public-card-title"><span class="mdi mdi-gender-male-female"></span> Gender Distribution</h3>
              <div class="public-gender-chart">
                <div class="public-gender-bar">
                  <div
                    class="public-gender-bar-male"
                    :style="{ width: genderDistribution.malePercent + '%' }"
                  ></div>
                  <div
                    class="public-gender-bar-female"
                    :style="{ width: genderDistribution.femalePercent + '%' }"
                  ></div>
                </div>
                <div class="public-gender-legend">
                  <div class="public-gender-legend-item">
                    <span class="public-gender-dot" style="background: #1976D2;"></span>
                    <span>Male: <strong>{{ genderDistribution.male }}</strong> ({{ genderDistribution.malePercent }}%)</span>
                  </div>
                  <div class="public-gender-legend-item">
                    <span class="public-gender-dot" style="background: #E91E63;"></span>
                    <span>Female: <strong>{{ genderDistribution.female }}</strong> ({{ genderDistribution.femalePercent }}%)</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Age Distribution -->
            <div class="public-card">
              <h3 class="public-card-title"><span class="mdi mdi-account-group"></span> Age Groups</h3>
              <div class="public-age-distribution">
                <div
                  v-for="group in ageDistribution"
                  :key="group.key"
                  class="public-age-row"
                >
                  <div class="public-age-label">{{ group.label }}</div>
                  <div class="public-age-bar-wrap">
                    <div
                      class="public-age-bar-fill"
                      :style="{
                        width: (stats.population > 0 ? (group.count / stats.population) * 100 : 0) + '%',
                        background: group.color
                      }"
                    ></div>
                  </div>
                  <div class="public-age-count">{{ group.count }}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Household Classification Summary -->
        <section class="public-section">
          <h2 class="public-section-title"><span class="mdi mdi-tag-multiple"></span> Household Classifications</h2>
          <p class="public-section-desc">Summary of household categories in the barangay.</p>
          <div class="public-classification-grid">
            <div
              v-for="cls in classificationSummary"
              :key="cls.key"
              class="public-classification-card"
            >
              <div class="public-classification-icon" :style="{ color: cls.color }">
                <span :class="'mdi ' + cls.icon"></span>
              </div>
              <div class="public-classification-body">
                <div class="public-classification-count">{{ cls.count }}</div>
                <div class="public-classification-label">{{ cls.label }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Health Programs -->
        <section class="public-section">
          <h2 class="public-section-title"><span class="mdi mdi-medical-bag"></span> Health Programs</h2>
          <p class="public-section-desc">Our barangay provides the following health services to all residents.</p>
          <div class="public-programs-grid">
            <div class="public-program-card">
              <div class="public-program-icon" style="background: #e8f5e9; color: #2e7d32;">
                <span class="mdi mdi-home-group"></span>
              </div>
              <h3>Household Profiling</h3>
              <p>Comprehensive household and population tracking across all puroks</p>
            </div>
            <div class="public-program-card">
              <div class="public-program-icon" style="background: #fce4ec; color: #c62828;">
                <span class="mdi mdi-mother-nurse"></span>
              </div>
              <h3>Maternal Services</h3>
              <p>Women of Reproductive Age monitoring &amp; Cervical Cancer Screening</p>
            </div>
            <div class="public-program-card">
              <div class="public-program-icon" style="background: #e3f2fd; color: #1565c0;">
                <span class="mdi mdi-baby-face-outline"></span>
              </div>
              <h3>Child Care</h3>
              <p>Vitamin A supplementation program for children ages 1-4</p>
            </div>
            <div class="public-program-card">
              <div class="public-program-icon" style="background: #f3e5f5; color: #6a1b9a;">
                <span class="mdi mdi-account-heart"></span>
              </div>
              <h3>Family Planning</h3>
              <p>Responsible parenthood and family planning services</p>
            </div>
            <div class="public-program-card">
              <div class="public-program-icon" style="background: #fff3e0; color: #e65100;">
                <span class="mdi mdi-shield-plus"></span>
              </div>
              <h3>Preventive Health</h3>
              <p>Mass deworming program for children and adolescents ages 10-19</p>
            </div>
          </div>
        </section>

        <div class="public-two-col">
          <!-- Upcoming Events -->
          <section class="public-section">
            <h2 class="public-section-title"><span class="mdi mdi-calendar-month-outline"></span> Upcoming Events</h2>
            <div class="public-card">
              <div v-if="upcomingEvents.length === 0" class="hs-empty-state">
                <span class="mdi mdi-calendar-blank-outline" style="font-size: 40px; color: var(--hs-gray-300);"></span>
                <p>No upcoming events scheduled</p>
              </div>
              <div v-else class="public-events-list">
                <div v-for="ev in upcomingEvents" :key="ev.id" class="public-event-item">
                  <div class="public-event-date">
                    <div class="public-event-month">{{ new Date(ev.start).toLocaleDateString('en', { month: 'short' }) }}</div>
                    <div class="public-event-day">{{ new Date(ev.start).getDate() }}</div>
                  </div>
                  <div class="public-event-info">
                    <div class="public-event-title">{{ ev.text }}</div>
                    <div class="public-event-meta">
                      <span class="public-event-badge" :style="{ background: eventTypeColor(ev.type) + '18', color: eventTypeColor(ev.type) }">
                        <span :class="'mdi ' + eventTypeIcon(ev.type)"></span> {{ ev.type }}
                      </span>
                      <span v-if="ev.description" class="public-event-desc">{{ ev.description }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Inventory -->
          <section class="public-section">
            <h2 class="public-section-title"><span class="mdi mdi-pill"></span> Medicine Availability</h2>
            <div class="public-card">
              <div v-if="availableMedicine.length === 0" class="hs-empty-state">
                <span class="mdi mdi-pill" style="font-size: 40px; color: var(--hs-gray-300);"></span>
                <p>No medicine in stock</p>
              </div>
              <div v-else>
                <div v-if="lowStockMedicine.length > 0" class="public-low-stock-banner">
                  <span class="mdi mdi-alert-circle-outline"></span>
                  {{ lowStockMedicine.length }} medicine(s) running low on stock
                </div>
                <table class="hs-table">
                  <thead>
                    <tr><th>Medicine</th><th>Stock</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="m in availableMedicine" :key="m.medicine_id">
                      <td>{{ m.name }}</td>
                      <td>{{ m.quantity }}</td>
                      <td>
                        <span v-if="m.quantity <= 5" class="hs-badge hs-badge-danger">Low Stock</span>
                        <span v-else-if="m.quantity <= 20" class="hs-badge hs-badge-warning">Moderate</span>
                        <span v-else class="hs-badge hs-badge-success">Available</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <h2 class="public-section-title" style="margin-top: 24px;"><span class="mdi mdi-wrench"></span> Tools &amp; Equipment</h2>
            <div class="public-card">
              <div v-if="availableTools.length === 0" class="hs-empty-state">
                <span class="mdi mdi-wrench" style="font-size: 40px; color: var(--hs-gray-300);"></span>
                <p>No tools available</p>
              </div>
              <table v-else class="hs-table">
                <thead>
                  <tr><th>Tool</th><th>Available</th></tr>
                </thead>
                <tbody>
                  <tr v-for="t in availableTools" :key="t.tool_id">
                    <td>{{ t.name }}</td>
                    <td><span class="hs-badge hs-badge-info">{{ t.quantity }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </template>
    </main>

    <!-- Footer -->
    <footer class="public-footer">
      <div class="public-footer-inner">
        <img src="/images/logo.png" alt="HealthSync" class="public-footer-logo" />
        <p>&copy; 2025 Buenavista HealthSync &mdash; Municipality of Buenavista, Agusan del Norte. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.public-page {
  min-height: 100vh;
  background: var(--hs-gray-50);
}

/* Hero Header */
.public-hero {
  position: relative;
  background: linear-gradient(135deg, #ffffff 0%, #e8f5e9 45%, #c8e6c9 100%);
  padding: 0;
  overflow: hidden;
  border-bottom: 2px solid #a5d6a7;
}
.public-hero-bg {
  position: absolute;
  inset: 0;
  background: url('/images/logo.png') center/20% no-repeat;
  opacity: 0.06;
}
.public-hero-content {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 24px;
}
.public-hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
}
.public-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}
.public-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
  background: #ffffff;
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 2px 10px rgba(46, 125, 50, 0.18);
}
.public-title {
  font-size: var(--hs-font-size-lg);
  font-weight: 700;
  color: #1b5e20;
  margin: 0;
  line-height: 1.2;
}
.public-subtitle {
  font-size: var(--hs-font-size-xs);
  color: #388e3c;
  margin: 0;
}
.public-hero-text {
  max-width: 600px;
  display: none;
}
.public-hero-text h2 {
  font-size: var(--hs-font-size-3xl);
  font-weight: 700;
  color: #1b5e20;
  margin: 0 0 10px;
  letter-spacing: -0.02em;
}
.public-hero-text p {
  font-size: var(--hs-font-size-base);
  color: #2e7d32;
  line-height: 1.7;
  margin: 0;
}
.public-intro {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px 0;
}
.public-intro-title {
  font-size: var(--hs-font-size-2xl);
  font-weight: 700;
  color: var(--hs-gray-900);
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}
.public-intro-desc {
  font-size: var(--hs-font-size-base);
  color: var(--hs-gray-500);
  margin: 0;
  line-height: 1.7;
}

/* Main */
.public-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px 28px;
  position: relative;
  z-index: 1;
}

/* Sections */
.public-section {
  margin-bottom: 28px;
}
.public-section-title {
  font-size: var(--hs-font-size-lg);
  font-weight: 600;
  color: var(--hs-gray-900);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: -0.01em;
}
.public-section-title .mdi {
  color: var(--hs-primary);
  font-size: 22px;
}
.public-section-desc {
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-500);
  margin-bottom: 16px;
}

/* Stats Grid */
.public-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.public-stat-card {
  background: var(--hs-white);
  border-radius: var(--hs-radius-xl);
  padding: 22px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--hs-border);
  box-shadow: var(--hs-shadow-sm);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.public-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--hs-shadow-md);
}
.public-stat-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}
.public-stat-households .public-stat-icon-wrap { background: #e8f5e9; color: #2e7d32; }
.public-stat-population .public-stat-icon-wrap { background: #e3f2fd; color: #1565c0; }
.public-stat-events .public-stat-icon-wrap { background: #fff3e0; color: #e65100; }
.public-stat-medicine .public-stat-icon-wrap { background: #f3e5f5; color: #6a1b9a; }
.public-stat-body {
  min-width: 0;
}
.public-stat-value {
  font-size: var(--hs-font-size-2xl);
  font-weight: 700;
  color: var(--hs-gray-900);
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.public-stat-label {
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-500);
  margin-top: 2px;
}

/* Programs Grid */
.public-programs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.public-program-card {
  background: var(--hs-white);
  border-radius: var(--hs-radius-xl);
  padding: 28px 24px;
  text-align: center;
  border: 1px solid var(--hs-border);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.public-program-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--hs-shadow-md);
}
.public-program-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  margin-bottom: 12px;
}
.public-program-card h3 {
  font-size: var(--hs-font-size-base);
  font-weight: 600;
  color: var(--hs-gray-900);
  margin: 0 0 6px;
}
.public-program-card p {
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-500);
  line-height: 1.5;
  margin: 0;
}

/* Two Column */
.public-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

/* Shared card */
.public-card {
  background: var(--hs-white);
  border: 1px solid var(--hs-border);
  border-radius: var(--hs-radius-xl);
  overflow: hidden;
  padding: 20px;
}
.public-card .public-card-title {
  padding: 18px 20px 0;
}

/* Events */
.public-events-list {
  max-height: 420px;
  overflow-y: auto;
}
.public-event-item {
  display: flex;
  gap: 14px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--hs-gray-100);
  align-items: flex-start;
  transition: background 100ms ease;
}
.public-event-item:hover {
  background: var(--hs-gray-50);
}
.public-event-item:last-child {
  border-bottom: none;
}
.public-event-date {
  background: var(--hs-primary-bg);
  border-radius: var(--hs-radius-md);
  padding: 6px 12px;
  text-align: center;
  min-width: 52px;
}
.public-event-month {
  font-size: 10px;
  font-weight: 600;
  color: var(--hs-primary);
  text-transform: uppercase;
}
.public-event-day {
  font-size: var(--hs-font-size-xl);
  font-weight: 700;
  color: var(--hs-primary-dark);
  line-height: 1;
}
.public-event-info {
  flex: 1;
}
.public-event-title {
  font-weight: 600;
  font-size: var(--hs-font-size-base);
  color: var(--hs-gray-900);
  margin-bottom: 4px;
}
.public-event-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.public-event-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  text-transform: capitalize;
}
.public-event-desc {
  color: var(--hs-gray-500);
  font-size: var(--hs-font-size-xs);
}

/* Low stock banner */
.public-low-stock-banner {
  padding: 10px 18px;
  background: var(--hs-warning-bg);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--hs-font-size-sm);
  color: var(--hs-warning);
  border-bottom: 1px solid var(--hs-border);
}

/* Footer */
.public-footer {
  text-align: center;
  padding: 28px 24px;
  border-top: 1px solid var(--hs-border);
  margin-top: 20px;
  background: var(--hs-white);
}
.public-footer-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.public-footer-logo {
  width: 120px;
  height: 120px;
  object-fit: contain;
  opacity: 0.6;
}
.public-footer p {
  color: var(--hs-gray-400);
  font-size: var(--hs-font-size-xs);
  margin: 0;
}

.public-loading {
  padding: 100px 0;
}

/* Gender Distribution */
.public-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--hs-font-size-lg);
  font-weight: 600;
  color: var(--hs-gray-900);
  margin-bottom: 16px;
}
.public-card-title .mdi {
  font-size: 20px;
  color: var(--hs-primary);
}
.public-gender-chart {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.public-gender-bar {
  display: flex;
  height: 28px;
  border-radius: 14px;
  overflow: hidden;
  background: var(--hs-gray-100);
}
.public-gender-bar-male {
  background: #1976D2;
  transition: width 0.6s ease;
  min-width: 2%;
}
.public-gender-bar-female {
  background: #E91E63;
  transition: width 0.6s ease;
  min-width: 2%;
}
.public-gender-legend {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
.public-gender-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-700);
}
.public-gender-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Age Distribution */
.public-age-distribution {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.public-age-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.public-age-label {
  width: 120px;
  font-size: var(--hs-font-size-xs);
  font-weight: 500;
  color: var(--hs-gray-600);
  text-align: right;
  flex-shrink: 0;
}
.public-age-bar-wrap {
  flex: 1;
  height: 16px;
  background: var(--hs-gray-100);
  border-radius: 8px;
  overflow: hidden;
}
.public-age-bar-fill {
  height: 100%;
  border-radius: 8px;
  transition: width 0.6s ease;
  min-width: 2px;
}
.public-age-count {
  width: 40px;
  font-size: var(--hs-font-size-sm);
  font-weight: 600;
  color: var(--hs-gray-800);
  text-align: right;
}

/* Household Classification Grid */
.public-classification-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.public-classification-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--hs-white);
  border-radius: var(--hs-radius-xl);
  border: 1px solid var(--hs-border);
  box-shadow: var(--hs-shadow-sm);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.public-classification-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--hs-shadow-md);
}
.public-classification-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
  background: currentColor;
  -webkit-background-clip: text;
  background-clip: text;
}
.public-classification-body {
  flex: 1;
}
.public-classification-count {
  font-size: var(--hs-font-size-2xl);
  font-weight: 700;
  line-height: 1.1;
  color: var(--hs-gray-900);
}
.public-classification-label {
  font-size: var(--hs-font-size-xs);
  font-weight: 500;
  color: var(--hs-gray-500);
  margin-top: 2px;
}

@media (max-width: 1024px) {
  .public-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .public-two-col {
    grid-template-columns: 1fr;
  }
  .public-hero-top {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
  .public-brand {
    flex-direction: column;
  }
  .public-hero-text {
    text-align: center;
  }
  .public-hero-text h2 {
    font-size: var(--hs-font-size-2xl);
  }
  .public-main {
    padding: 0 16px 20px;
  }
  .public-stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
