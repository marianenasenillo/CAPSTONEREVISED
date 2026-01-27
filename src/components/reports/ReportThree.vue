<script setup>
import { ref, onMounted } from 'vue'
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

onMounted(async () => {
  // Get current user barangay
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

  // Destroy existing charts
  if (barangayChart) barangayChart.destroy()
  if (genderChart) genderChart.destroy()

  // Create new charts
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

  if (purokLabels.length > 0) {
    text += `the highest number of households in ${purokLabels[purokData.indexOf(Math.max(...purokData))] || 'unknown'} (${Math.max(...purokData) || 0} households). `
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
                  Reporting Period: September 2025
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
               <button class="btn btn-secondary exclude-from-pdf" @click="$emit('prev')">&larr; Back</button>
              </div>
            </template>

<style scoped>
canvas {
  height: 300px !important;
  width: 100% !important;
}
</style>