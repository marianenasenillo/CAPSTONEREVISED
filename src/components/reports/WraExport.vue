<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/utils/supabase.js'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Bar, Pie } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

const loading = ref(true)
const error = ref(null)
const wraRecords = ref([])
const userBarangay = ref('')

onMounted(async () => {
  await fetchWraRecords()
})

// Fetch WRA records from Supabase
const fetchWraRecords = async () => {
  loading.value = true
  error.value = null
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Not authenticated')

    const userBarangayValue = user.user_metadata?.barangay
    if (!userBarangayValue) throw new Error('No barangay assigned')

    userBarangay.value = userBarangayValue

    const { data, error: err } = await supabase
      .from('wra_records')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (err) throw err
    wraRecords.value = data
  } catch (e) {
    console.error('Error fetching WRA records:', e)
    error.value = 'Failed to load WRA records.'
  } finally {
    loading.value = false
  }
}

// Chart data for WRA by Purok
const purokChartData = computed(() => {
  const purokCounts = {}
  wraRecords.value.forEach(record => {
    const purok = record.purok || 'Unknown'
    purokCounts[purok] = (purokCounts[purok] || 0) + 1
  })

  return {
    labels: Object.keys(purokCounts),
    datasets: [{
      label: 'Number of WRA Records',
      data: Object.values(purokCounts),
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 205, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)',
        'rgba(153, 102, 255, 0.6)',
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 205, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
      ],
      borderWidth: 1
    }]
  }
})

// Chart data for SE Status
const seStatusChartData = computed(() => {
  const statusCounts = { Eligible: 0, 'Not Eligible': 0 }
  wraRecords.value.forEach(record => {
    const status = record.se_status || 'Not Eligible'
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })

  return {
    labels: Object.keys(statusCounts),
    datasets: [{
      data: Object.values(statusCounts),
      backgroundColor: [
        'rgba(75, 192, 192, 0.6)',
        'rgba(255, 99, 132, 0.6)',
      ],
      borderColor: [
        'rgba(75, 192, 192, 1)',
        'rgba(255, 99, 132, 1)',
      ],
      borderWidth: 1
    }]
  }
})

// Chart data for Civil Status
const civilStatusChartData = computed(() => {
  const statusCounts = {}
  wraRecords.value.forEach(record => {
    const status = record.civil_status || 'Unknown'
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })

  return {
    labels: Object.keys(statusCounts),
    datasets: [{
      label: 'Civil Status Distribution',
      data: Object.values(statusCounts),
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 205, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)',
        'rgba(153, 102, 255, 0.6)',
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 205, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
      ],
      borderWidth: 1
    }]
  }
})

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: 'WRA Records Analysis'
    }
  }
}

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    }
  }
}

// Explanations for charts
const purokExplanation = computed(() => {
  const total = wraRecords.value.length
  const labels = purokChartData.value.labels || []
  const data = purokChartData.value.datasets?.[0]?.data || []
  const maxIndex = data.length ? data.indexOf(Math.max(...data)) : -1
  const maxPurok = maxIndex >= 0 ? labels[maxIndex] : 'N/A'
  return `This bar chart shows the distribution of ${total} WRA records across puroks. The most represented purok is ${maxPurok}.`
})

const seExplanation = computed(() => {
  const total = wraRecords.value.length
  const data = seStatusChartData.value.datasets?.[0]?.data || []
  const eligible = data[0] || 0
  const notEligible = data[1] || 0
  const pct = total > 0 ? ((eligible / total) * 100).toFixed(1) : 0
  return `This pie chart illustrates SE status among ${total} WRA records: ${eligible} eligible (${pct}%), ${notEligible} not eligible.`
})

const civilExplanation = computed(() => {
  const labels = civilStatusChartData.value.labels || []
  const data = civilStatusChartData.value.datasets?.[0]?.data || []
  const maxIndex = data.length ? data.indexOf(Math.max(...data)) : -1
  const maxStatus = maxIndex >= 0 ? labels[maxIndex] : 'N/A'
  return `This chart shows civil status distribution. The most common civil status is ${maxStatus}.`
})
</script>

<template>
  <!-- FIRST REPORT CONTENT -->
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
      <h4 class="fw-bold">Data Analysis</h4>
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
          <!-- Bar Chart for Heads -->
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">WRA Records by Purok</h5>
              </div>
              <div class="card-body">
                <div style="height: 300px;">
                  <Bar :data="purokChartData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>

          <!-- Pie Chart for Members -->
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">SE Status Distribution</h5>
              </div>
              <div class="card-body">
                <div style="height: 300px;">
                  <Pie :data="seStatusChartData" :options="pieOptions" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">Civil Status Distribution</h5>
              </div>
              <div class="card-body">
                <div style="height: 300px;">
                  <Bar :data="civilStatusChartData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>

        <!-- Explanations -->
        <div class="row">
          <div class="col-md-6">
              <div class="alert alert-info">
                <h6>WRA Records by Purok</h6>
                <p>{{ purokExplanation }}</p>
              </div>
            </div>
            <div class="col-md-6">
              <div class="alert alert-info">
                <h6>SE Status Distribution</h6>
                <p>{{ seExplanation }}</p>
              </div>
            </div>
            <div class="col-md-6">
              <div class="alert alert-info">
                <h6>Civil Status Distribution</h6>
                <p>{{ civilExplanation }}</p>
              </div>
            </div>
        </div>
      </div>
    </section>

    
  </div>
</template>
