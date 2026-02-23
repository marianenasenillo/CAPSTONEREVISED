<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/utils/supabase'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PieController, BarController } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PieController, BarController)

const emit = defineEmits(['prev', 'next'])

const selectedBarangay = ref('')

const genderPieCanvas = ref(null)
const purokBarCanvas = ref(null)
const purokPieCanvas = ref(null)

const genderChartData = ref({})
const purokChartData = ref({})
const purokPieChartData = ref({})

const discussionText = ref('')

const reportingPeriod = computed(() => {
  const now = new Date()
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

onMounted(async () => {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('Error getting user:', userError)
    return
  }
  const userBarangay = user.user_metadata?.barangay
  if (!userBarangay) {
    console.error('No barangay assigned to user')
    return
  }
  selectedBarangay.value = userBarangay

  await fetchGenderDistribution()
  await fetchPurokComparison()
  await fetchPurokPie()

  generateDiscussion()

  if (genderPieCanvas.value) {
    new ChartJS(genderPieCanvas.value, {
      type: 'pie',
      data: genderChartData.value,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: `Gender Distribution - ${selectedBarangay.value}` }
        }
      }
    })
  }

  if (purokBarCanvas.value) {
    new ChartJS(purokBarCanvas.value, {
      type: 'bar',
      data: purokChartData.value,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: `Population per Purok - ${selectedBarangay.value}` }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    })
  }

  if (purokPieCanvas.value) {
    new ChartJS(purokPieCanvas.value, {
      type: 'pie',
      data: purokPieChartData.value,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: `Comparative Population per Purok - ${selectedBarangay.value}` }
        }
      }
    })
  }
})

const fetchGenderDistribution = async () => {
  try {
    const { data, error } = await supabase
      .from('household_heads')
      .select('male_count, female_count')
      .eq('barangay', selectedBarangay.value)
      .eq('is_archived', false)
      .not('male_count', 'is', null)
      .not('female_count', 'is', null)

    if (error) throw error

    let totalMale = 0
    let totalFemale = 0
    data.forEach(item => {
      totalMale += item.male_count || 0
      totalFemale += item.female_count || 0
    })

    genderChartData.value = {
      labels: ['Male', 'Female'],
      datasets: [{
        label: 'Gender Distribution',
        data: [totalMale, totalFemale],
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)'
        ],
        borderWidth: 1
      }]
    }
  } catch (err) {
    console.error('Error fetching gender distribution:', err)
  }
}

const fetchPurokComparison = async () => {
  try {
    const { data, error } = await supabase
      .from('household_heads')
      .select('purok, population')
      .eq('barangay', selectedBarangay.value)
      .not('population', 'is', null)

    if (error) throw error

    const purokData = {}
    data.forEach(item => {
      const key = item.purok
      if (!purokData[key]) purokData[key] = 0
      purokData[key] += item.population
    })

    purokChartData.value = {
      labels: Object.keys(purokData),
      datasets: [{
        label: 'Population',
        data: Object.values(purokData),
        backgroundColor: 'rgba(255, 206, 86, 0.6)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1
      }]
    }
  } catch (err) {
    console.error('Error fetching purok comparison:', err)
  }
}

const fetchPurokPie = async () => {
  try {
    const { data, error } = await supabase
      .from('household_heads')
      .select('purok, population')
      .eq('barangay', selectedBarangay.value)
      .not('population', 'is', null)

    if (error) throw error

    const purokData = {}
    data.forEach(item => {
      const key = item.purok
      if (!purokData[key]) purokData[key] = 0
      purokData[key] += item.population
    })

    purokPieChartData.value = {
      labels: Object.keys(purokData),
      datasets: [{
        label: 'Population',
        data: Object.values(purokData),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }]
    }
  } catch (err) {
    console.error('Error fetching purok pie:', err)
  }
}

const generateDiscussion = () => {
  const genderData = genderChartData.value.datasets?.[0]?.data || []
  const purokLabels = purokChartData.value.labels || []
  const purokData = purokChartData.value.datasets?.[0]?.data || []

  let text = `<h4>Discussion</h4>
<p>For ${selectedBarangay.value}, `

  if (genderData.length > 0) {
    text += `the gender distribution shows ${genderData[0] || 0} males and ${genderData[1] || 0} females. `
  }

  if (purokLabels.length > 0 && purokData.length > 0) {
    const maxIdx = purokData.indexOf(Math.max(...purokData))
    const topPurok = maxIdx >= 0 ? (purokLabels[maxIdx] || 'N/A') : 'N/A'
    text += `Population per purok varies, with the highest in ${topPurok} (${Math.max(...purokData) || 0} residents). `
  }

  text += `This data supports planning for equitable resource allocation within the barangay.</p>`

  discussionText.value = text
}
</script>

<template>
              <!-- SECOND REPORT CONTENT -->
              <div class="mb-4">
                <div class="row align-items-center">
                  <div class="col-3 text-end">
                    <img src="/images/agusanlogo.png" alt="Province Logo" height="80" />
                  </div>
                  <div class="col-6 text-center">
                    <h5 class="fw-bold mb-1">Republic of the Philippines</h5>
                    <h6 class="mb-0">
                      Province of Agusan del Norte <br />
                      Municipality of Buenavista <br />
                      <strong>{{ selectedBarangay }}</strong>
                    </h6>
                  </div>
                  <div class="col-3 text-start">
                    <img v-if="selectedBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 80px;" />
          <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 80px;" />
                  </div>
                </div>
              </div>
              <hr class="my-4" />
              <div class="text-center mb-4">
                <h4 class="fw-bold">Comparative Report</h4>
                <p>
                  {{ selectedBarangay }} – Municipality of Buenavista, Agusan del Norte <br />
                  Reporting Period: {{ reportingPeriod }}
                </p>
              </div>
              <div class="container py-4">
    <div class="row">
      <!-- Gender Pie Chart -->
      <div class="col-md-6 mb-4">
        <div class="card p-3 shadow-sm">
          <h5 class="text-center mb-3">Gender Distribution</h5>
          <canvas ref="genderPieCanvas"></canvas>
        </div>
      </div>

      <!-- Purok Comparison Chart -->
      <div class="col-md-6 mb-4">
        <div class="card p-3 shadow-sm">
          <h5 class="text-center mb-3">Population per Purok</h5>
          <canvas ref="purokBarCanvas"></canvas>
        </div>
      </div>

      <!-- Comparative Population per Purok Pie Chart -->
      <div class="col-md-6 mb-4">
        <div class="card p-3 shadow-sm">
          <h5 class="text-center mb-3">Comparative Population per Purok</h5>
          <canvas ref="purokPieCanvas"></canvas>
        </div>
      </div>
    </div>
  </div>
  <section v-html="discussionText"></section>

              <div class="d-flex justify-content-between mt-4">
               <button class="hs-btn hs-btn-secondary exclude-from-pdf" @click="$emit('prev')">&larr; Back</button>
      <button class="hs-btn hs-btn-primary exclude-from-pdf" @click="$emit('next')">Next &rarr;</button>
              </div>
            </template>

<style scoped>
canvas {
  height: 300px !important;
  width: 100% !important;
}
.report-content { font-family: var(--hs-font-family); color: var(--hs-gray-800); }
.row { display: flex; flex-wrap: wrap; margin-left: -12px; margin-right: -12px; }
.col-3 { flex: 0 0 25%; max-width: 25%; padding: 0 12px; }
.col-6 { flex: 0 0 50%; max-width: 50%; padding: 0 12px; }
.col-md-6 { flex: 0 0 50%; max-width: 50%; padding: 0 12px; }
.container { max-width: 100%; padding: 0 var(--hs-space-4); }
.card { background: var(--hs-white); border: 1px solid var(--hs-border); border-radius: var(--hs-radius-lg); }
.shadow-sm { box-shadow: var(--hs-shadow-sm); }
.p-3 { padding: var(--hs-space-4); }
.py-4 { padding-top: var(--hs-space-4); padding-bottom: var(--hs-space-4); }
.mb-0 { margin-bottom: 0; }
.mb-1 { margin-bottom: var(--hs-space-1); }
.mb-3 { margin-bottom: var(--hs-space-3); }
.mb-4 { margin-bottom: var(--hs-space-4); }
.my-4 { margin-top: var(--hs-space-4); margin-bottom: var(--hs-space-4); }
.mt-4 { margin-top: var(--hs-space-4); }
.text-center { text-align: center; }
.text-end { text-align: right; }
.text-start { text-align: left; }
.fw-bold { font-weight: 600; }
.d-flex { display: flex; }
.justify-content-end { justify-content: flex-end; }
.justify-content-between { justify-content: space-between; }
.align-items-center { align-items: center; }
</style>
