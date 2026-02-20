<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/utils/supabase'
import { Bar, Pie } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement)

const loading = ref(true)
const error = ref(null)
const cervicalRecords = ref([])
const userBarangay = ref('')

const screeningChartData = computed(() => {
  const purokCounts = {}
  cervicalRecords.value.forEach(record => {
    const purok = record.purok || 'Unknown'
    purokCounts[purok] = (purokCounts[purok] || 0) + 1
  })
  return {
    labels: Object.keys(purokCounts),
    datasets: [{
      label: 'Number of Women Screened',
      data: Object.values(purokCounts),
      backgroundColor: 'rgba(255, 99, 132, 0.6)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 1
    }]
  }
})

const statusChartData = computed(() => {
  const statusCounts = { 'Screened': 0, 'Not Screened': 0 }
  cervicalRecords.value.forEach(record => {
    const screened = record.screened === 'Yes' ? 'Screened' : 'Not Screened'
    statusCounts[screened]++
  })
  return {
    labels: Object.keys(statusCounts),
    datasets: [{
      label: 'Screening Status',
      data: Object.values(statusCounts),
      backgroundColor: [
        'rgba(75, 192, 192, 0.6)',
        'rgba(255, 206, 86, 0.6)'
      ],
      borderColor: [
        'rgba(75, 192, 192, 1)',
        'rgba(255, 206, 86, 1)'
      ],
      borderWidth: 1
    }]
  }
})

const ageChartData = computed(() => {
  const ageGroups = { '20-29': 0, '30-39': 0, '40-49': 0, '50+': 0 }
  cervicalRecords.value.forEach(record => {
    const age = record.age
    if (age >= 20 && age < 30) ageGroups['20-29']++
    else if (age >= 30 && age < 40) ageGroups['30-39']++
    else if (age >= 40 && age < 50) ageGroups['40-49']++
    else if (age >= 50) ageGroups['50+']++
  })
  return {
    labels: Object.keys(ageGroups),
    datasets: [{
      label: 'Age Distribution',
      data: Object.values(ageGroups),
      backgroundColor: 'rgba(153, 102, 255, 0.6)',
      borderColor: 'rgba(153, 102, 255, 1)',
      borderWidth: 1
    }]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false
}

const screeningExplanation = computed(() => {
  const totalScreened = cervicalRecords.value.length
  const puroks = Object.keys(screeningChartData.value.labels)
  const maxPurok = puroks.reduce((max, purok) =>
    screeningChartData.value.datasets[0].data[puroks.indexOf(purok)] > screeningChartData.value.datasets[0].data[puroks.indexOf(max)] ? purok : max, puroks[0])

  return `This bar chart shows the distribution of ${totalScreened} women screened across different puroks in your barangay. The purok with the highest number of screenings is ${maxPurok}, indicating the most active area for cervical cancer screening.`
})

const statusExplanation = computed(() => {
  const total = cervicalRecords.value.length
  const screened = statusChartData.value.datasets[0].data[0] || 0
  const notScreened = statusChartData.value.datasets[0].data[1] || 0
  const screenedPercentage = total > 0 ? ((screened / total) * 100).toFixed(1) : 0

  return `This pie chart illustrates the screening status among ${total} women in the program. ${screened} women have been screened (${screenedPercentage}%), while ${notScreened} women are yet to be screened.`
})

const ageExplanation = computed(() => {
  const ageGroups = ageChartData.value.datasets[0].data
  const maxGroup = ageChartData.value.labels[ageGroups.indexOf(Math.max(...ageGroups))]

  return `This bar chart shows the age distribution of women in the cervical screening program. The most represented age group is ${maxGroup}, which aligns with the recommended screening age range for cervical cancer.`
})

const fetchCervicalRecords = async () => {
  loading.value = true
  error.value = null
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Not authenticated')

    const userBarangayValue = user.user_metadata?.barangay
    if (!userBarangayValue) throw new Error('No barangay assigned')

    userBarangay.value = userBarangayValue

    const { data, error: err } = await supabase
      .from('cervical_screening_records')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (err) throw err
    cervicalRecords.value = data

  } catch (e) {
    console.error(e)
    error.value = 'Failed to load cervical screening records.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchCervicalRecords()
})
</script>

<template>
  <!-- MATERNAL REPORT CONTENT -->
  <div>
    <!-- HEADER -->
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
            <strong>Barangay {{ userBarangay }}</strong>
          </h6>
        </div>
        <div class="col-3 text-start">
          <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 80px;" />
          <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 80px;" />
        </div>
      </div>
    </div>

    <hr class="my-4" />

    <div class="text-center mb-4">
      <h4 class="fw-bold">Cervical Cancer Screening Report</h4>
      <p>
        Barangay {{ userBarangay }} – Municipality of Buenavista, Agusan del Norte <br />
        Reporting Period: {{ new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }}
      </p>
    </div>

    <section class="mb-4">
      <div v-if="loading" class="text-center my-4">
        <div class="spinner-border text-primary" role="status"></div>
        <p>Loading data...</p>
      </div>

      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <div v-else>
        <!-- Charts Row -->
        <div class="row mb-4">
          <!-- Bar Chart for Screening by Purok -->
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">Screening Distribution by Purok</h5>
              </div>
              <div class="card-body">
                <div style="height: 300px;">
                  <Bar :data="screeningChartData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>

          <!-- Pie Chart for Screening Status -->
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">Screening Status</h5>
              </div>
              <div class="card-body">
                <div style="height: 300px;">
                  <Pie :data="statusChartData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Age Distribution Chart -->
        <div class="row mb-4">
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">Age Distribution of Women Screened</h5>
              </div>
              <div class="card-body">
                <div style="height: 300px;">
                  <Bar :data="ageChartData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Explanations -->
        <div class="row">
          <div class="col-md-6">
            <div class="alert alert-info">
              <h6>Screening Distribution Analysis:</h6>
              <p>{{ screeningExplanation }}</p>
            </div>
          </div>
          <div class="col-md-6">
            <div class="alert alert-info">
              <h6>Screening Status Analysis:</h6>
              <p>{{ statusExplanation }}</p>
            </div>
          </div>
        </div>

        <div class="row mt-3">
          <div class="col-md-6">
            <div class="alert alert-info">
              <h6>Age Distribution Analysis:</h6>
              <p>{{ ageExplanation }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>