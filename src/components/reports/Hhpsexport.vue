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
const headRecords = ref([])
const membersData = ref([])
const selectedHead = ref(null)
const showMembersModal = ref(false)
const members = ref([])
const userBarangay = ref('')

// Chart data for heads (bar chart by purok)
const headsChartData = computed(() => {
  const purokCounts = {}
  headRecords.value.forEach(head => {
    const purok = head.purok || 'Unknown'
    purokCounts[purok] = (purokCounts[purok] || 0) + 1
  })
  return {
    labels: Object.keys(purokCounts),
    datasets: [{
      label: 'Number of Household Heads',
      data: Object.values(purokCounts),
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  }
})

// Chart data for members (pie chart by sex)
const membersChartData = computed(() => {
  const sexCounts = { Male: 0, Female: 0 }
  membersData.value.forEach(member => {
    const sex = member.sex || 'Unknown'
    if (sex === 'M' || sex === 'Male') sexCounts.Male++
    else if (sex === 'F' || sex === 'Female') sexCounts.Female++
  })
  return {
    labels: Object.keys(sexCounts),
    datasets: [{
      label: 'Household Members by Sex',
      data: Object.values(sexCounts),
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

// Computed explanations
const headsExplanation = computed(() => {
  const totalHeads = headRecords.value.length
  const labels = headsChartData.value.labels
  const data = headsChartData.value.datasets[0].data
  
  // Find the index of the maximum value
  const maxIndex = data.indexOf(Math.max(...data))
  const maxPurok = labels[maxIndex]
  
  return `This bar chart shows the distribution of ${totalHeads} household heads across different puroks in your barangay. The purok with the highest number of household heads is ${maxPurok}, indicating the most densely populated area.`
})

const membersExplanation = computed(() => {
  const totalMembers = membersData.value.length
  const maleCount = membersChartData.value.datasets[0].data[0] || 0
  const femaleCount = membersChartData.value.datasets[0].data[1] || 0
  const malePercentage = totalMembers > 0 ? ((maleCount / totalMembers) * 100).toFixed(1) : 0
  const femalePercentage = totalMembers > 0 ? ((femaleCount / totalMembers) * 100).toFixed(1) : 0
  
  return `This pie chart illustrates the gender distribution among ${totalMembers} household members. There are ${maleCount} males (${malePercentage}%) and ${femaleCount} females (${femalePercentage}%) in the recorded households.`
})

const fetchHeadRecords = async () => {
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
      .from('household_heads')
      .select('*')
      .eq('barangay', userBarangayValue)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (err) throw err
    headRecords.value = data

    // Fetch all members for the heads
    const { data: allMembers, error: membersError } = await supabase
      .from('household_members')
      .select('*')
      .in('head_id', data.map(h => h.head_id))

    if (membersError) throw membersError
    membersData.value = allMembers

  } catch (e) {
    console.error(e)
    error.value = 'Failed to load household head records.'
  } finally {
    loading.value = false
  }
}

// View Members
const viewMembers = async (head) => {
  selectedHead.value = head
  showMembersModal.value = true
  members.value = []
  try {
    const { data, error: err } = await supabase
      .from('household_members')
      .select('*')
      .eq('head_id', head.head_id)

    if (err) throw err
    members.value = data
  } catch (e) {
    console.error(e)
    alert('Error loading household members.')
  }
}

onMounted(async () => {
  await fetchHeadRecords()
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
      <h4 class="fw-bold">Overall Household Report</h4>
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
                <h5 class="card-title mb-0">Household Heads Distribution by Purok</h5>
              </div>
              <div class="card-body">
                <div style="height: 300px;">
                  <Bar :data="headsChartData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>

          <!-- Pie Chart for Members -->
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">Household Members by Gender</h5>
              </div>
              <div class="card-body">
                <div style="height: 300px;">
                  <Pie :data="membersChartData" :options="chartOptions" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Explanations -->
        <div class="row">
          <div class="col-md-6">
            <div class="alert alert-info">
              <h6>Household Heads Analysis:</h6>
              <p>{{ headsExplanation }}</p>
            </div>
          </div>
          <div class="col-md-6">
            <div class="alert alert-info">
              <h6>Household Members Analysis:</h6>
              <p>{{ membersExplanation }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    
  </div>
</template>
