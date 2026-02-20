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
const familyPlanningRecords = ref([])
const userBarangay = ref('')

const purokChartData = computed(() => {
  const purokCounts = {}
  familyPlanningRecords.value.forEach(record => {
    const purok = record.purok || 'Unknown'
    purokCounts[purok] = (purokCounts[purok] || 0) + 1
  })
  return {
    labels: Object.keys(purokCounts),
    datasets: [{
      label: 'Number of Individuals',
      data: Object.values(purokCounts),
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  }
})

const genderChartData = computed(() => {
  const genderCounts = { Male: 0, Female: 0 }
  familyPlanningRecords.value.forEach(record => {
    const gender = record.sex || 'Unknown'
    if (gender === 'Male') genderCounts.Male++
    else if (gender === 'Female') genderCounts.Female++
  })
  return {
    labels: Object.keys(genderCounts),
    datasets: [{
      label: 'Individuals by Gender',
      data: Object.values(genderCounts),
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
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false
}

const purokExplanation = computed(() => {
  const totalIndividuals = familyPlanningRecords.value.length
  const puroks = Object.keys(purokChartData.value.labels)
  const maxPurok = puroks.reduce((max, purok) =>
    purokChartData.value.datasets[0].data[puroks.indexOf(purok)] > purokChartData.value.datasets[0].data[puroks.indexOf(max)] ? purok : max, puroks[0])

  return `This bar chart shows the distribution of ${totalIndividuals} individuals in the family planning program across different puroks in your barangay. The purok with the highest number of participants is ${maxPurok}, indicating the area with the most active family planning engagement.`
})

const genderExplanation = computed(() => {
  const totalIndividuals = familyPlanningRecords.value.length
  const maleCount = genderChartData.value.datasets[0].data[0] || 0
  const femaleCount = genderChartData.value.datasets[0].data[1] || 0
  const malePercentage = totalIndividuals > 0 ? ((maleCount / totalIndividuals) * 100).toFixed(1) : 0
  const femalePercentage = totalIndividuals > 0 ? ((femaleCount / totalIndividuals) * 100).toFixed(1) : 0

  return `This pie chart illustrates the gender distribution among ${totalIndividuals} individuals in the family planning program. There are ${maleCount} males (${malePercentage}%) and ${femaleCount} females (${femalePercentage}%) participating in the program.`
})

const fetchFamilyPlanningRecords = async () => {
  loading.value = true
  error.value = null
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Not authenticated')

    const userBarangayValue = user.user_metadata?.barangay
    if (!userBarangayValue) throw new Error('No barangay assigned')

    userBarangay.value = userBarangayValue || 'All Barangays'

    const { data, error: err } = await supabase
      .from('family_planning_records')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (err) throw err
    familyPlanningRecords.value = data

  } catch (e) {
    console.error(e)
    error.value = 'Failed to load family planning records.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchFamilyPlanningRecords()
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
      <h4 class="fw-bold">Responsible Parenthood and Family Planning Report</h4>
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
          <!-- Bar Chart for Purok Distribution -->
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">Participants Distribution by Purok</h5>
              </div>
              <div class="card-body">
                <div style="height: 300px;">
                  <Bar :data="purokChartData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>

          <!-- Pie Chart for Gender Distribution -->
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">Participants by Gender</h5>
              </div>
              <div class="card-body">
                <div style="height: 300px;">
                  <Pie :data="genderChartData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Explanations -->
        <div class="row">
          <div class="col-md-6">
            <div class="alert alert-info">
              <h6>Purok Distribution Analysis:</h6>
              <p>{{ purokExplanation }}</p>
            </div>
          </div>
          <div class="col-md-6">
            <div class="alert alert-info">
              <h6>Gender Distribution Analysis:</h6>
              <p>{{ genderExplanation }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.card {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
}

.card-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  padding: 0.75rem 1.25rem;
}

.card-body {
  padding: 1.25rem;
}

.table th, .table td {
  padding: 0.5rem;
  font-size: 0.875rem;
}

.alert {
  border-radius: 0.375rem;
}

@media print {
  .card {
    break-inside: avoid;
  }
  .table {
    font-size: 0.75rem;
  }
}
</style>