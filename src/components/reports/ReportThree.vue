<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/utils/supabase'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PieController, BarController } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PieController, BarController)

const emit = defineEmits(['prev'])

const selectedBarangay = ref('')

const barangayBarCanvas = ref(null)
const genderPieCanvas = ref(null)

const barangayChartData = ref({})
const genderChartData = ref({})

let barangayChart = null
let genderChart = null

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

  await updateCharts()
  generateDiscussion()
})

const updateCharts = async () => {
  await fetchHouseholdPerPurok()
  await fetchAgeDistribution()

  if (barangayChart) barangayChart.destroy()
  if (genderChart) genderChart.destroy()

  if (barangayBarCanvas.value) {
    barangayChart = new ChartJS(barangayBarCanvas.value, {
      type: 'bar',
      data: barangayChartData.value,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: `Household Per Purok - ${selectedBarangay.value}` }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    })
  }

  if (genderPieCanvas.value) {
    genderChart = new ChartJS(genderPieCanvas.value, {
      type: 'pie',
      data: genderChartData.value,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: `Age Distribution - ${selectedBarangay.value}` }
        }
      }
    })
  }
}

const fetchHouseholdPerPurok = async () => {
  try {
    const { data, error } = await supabase
      .from('household_heads')
      .select('purok')
      .eq('barangay', selectedBarangay.value)

    if (error) throw error

    const purokCount = {}
    data.forEach(item => {
      if (!purokCount[item.purok]) purokCount[item.purok] = 0
      purokCount[item.purok]++
    })

    barangayChartData.value = {
      labels: Object.keys(purokCount),
      datasets: [{
        label: 'Households',
        data: Object.values(purokCount),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    }
  } catch (err) {
    console.error('Error fetching household per purok:', err)
  }
}

const fetchAgeDistribution = async () => {
  try {
    const { data, error } = await supabase
      .from('household_members')
      .select('age')
      .eq('barangay', selectedBarangay.value)
      .not('age', 'is', null)

    if (error) throw error

    const ageGroups = { '0-17': 0, '18-59': 0, '60+': 0 }
    data.forEach(item => {
      if (item.age < 18) ageGroups['0-17']++
      else if (item.age < 60) ageGroups['18-59']++
      else ageGroups['60+']++
    })

    genderChartData.value = {
      labels: Object.keys(ageGroups),
      datasets: [{
        label: 'Age Distribution',
        data: Object.values(ageGroups),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)'
        ],
        borderWidth: 1
      }]
    }
  } catch (err) {
    console.error('Error fetching age distribution:', err)
  }
}

const generateDiscussion = () => {
  const purokLabels = barangayChartData.value.labels || []
  const purokData = barangayChartData.value.datasets?.[0]?.data || []
  const ageData = genderChartData.value.datasets?.[0]?.data || []

  let text = `<h4>Discussion</h4>
<p>For ${selectedBarangay.value}, the household distribution per purok shows `

  if (purokLabels.length > 0 && purokData.length > 0) {
    const maxIdx = purokData.indexOf(Math.max(...purokData))
    const topPurok = maxIdx >= 0 ? (purokLabels[maxIdx] || 'N/A') : 'N/A'
    text += `the highest number of households in ${topPurok} (${Math.max(...purokData) || 0} households). `
  }

  if (ageData.length > 0) {
    text += `The age distribution includes ${ageData[0] || 0} children (0-17), ${ageData[1] || 0} adults (18-59), and ${ageData[2] || 0} seniors (60+). `
  }

  text += `This demographic data is essential for targeted health and community services.</p>`

  discussionText.value = text
}
</script>

<template>
              <!-- THIRD REPORT CONTENT -->
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
                <h4 class="fw-bold">Household Demographic Report</h4>
                <p>
                  {{ selectedBarangay }} – Municipality of Buenavista, Agusan del Norte <br />
                  Reporting Period: {{ reportingPeriod }}
                </p>
              </div>
               <div class="container py-4">
    <div class="row">
      <!-- Barangay Comparison Chart -->
      <div class="col-md-6 mb-4">
        <div class="card p-3 shadow-sm">
          <h5 class="text-center mb-3">Household Per Purok</h5>
          <canvas ref="barangayBarCanvas"></canvas>
        </div>
      </div>

      <!-- Gender Pie Chart -->
      <div class="col-md-6 mb-4">
        <div class="card p-3 shadow-sm">
          <h5 class="text-center mb-3">Age Distribution</h5>
          <canvas ref="genderPieCanvas"></canvas>
        </div>
      </div>
    </div>
  </div>
  <section v-html="discussionText"></section>

              <div class="d-flex justify-content-between mt-4">
               <button class="hs-btn hs-btn-secondary exclude-from-pdf" @click="$emit('prev')">&larr; Back</button>
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
