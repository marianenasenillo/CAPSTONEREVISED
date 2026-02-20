<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/utils/supabase'

const emit = defineEmits(['next'])

const selectedBarangay = ref('')
const stats = ref({
  householdStats: {
    totalHouseholds: 0,
    avgHouseholdSize: 0,
    totalPopulation: 0,
    genderDistribution: {
      male: 0,
      female: 0
    },
    civilStatus: {},
    education: {},
    purokDistribution: {},
    livelihoodDistribution: {}
  },
  dewormingStats: {
    totalDewormed: 0,
    coverageRate: 0,
    purokParticipation: {}
  },
  vitaminAStats: {
    totalSupplemented: 0,
    coverageRate: 0,
    highestPurok: '',
    highestRate: 0,
    lowestPurok: '',
    lowestRate: 100
  },
  toolStats: {
    totalTools: 0,
    purokDistribution: {},
    usageByType: {}
  }
})

const fetchDewormingStats = async () => {
  try {
    const { data: dewormingData } = await supabase
      .from('deworming_records')
      .select('*')

    if (dewormingData) {
      stats.value.dewormingStats.totalDewormed = dewormingData.length
      stats.value.dewormingStats.coverageRate = Math.round((dewormingData.length / 356) * 100) // 356 is target population

      const purokCounts = {}
      dewormingData.forEach(record => {
        purokCounts[record.purok] = (purokCounts[record.purok] || 0) + 1
      })
      stats.value.dewormingStats.purokParticipation = purokCounts
    }
  } catch (error) {
    console.error('Error fetching deworming stats:', error)
  }
}

const fetchVitaminAStats = async () => {
  try {
    const { data: vitaminAData } = await supabase
      .from('childcare_vitamina_records')
      .select('*')

    if (vitaminAData) {
      stats.value.vitaminAStats.totalSupplemented = vitaminAData.length

      const purokCoverage = {}
      vitaminAData.forEach(record => {
        purokCoverage[record.purok] = (purokCoverage[record.purok] || 0) + 1
      })

      let highestRate = 0
      let lowestRate = 100
      let highestPurok = ''
      let lowestPurok = ''

      Object.entries(purokCoverage).forEach(([purok, count]) => {
        const rate = Math.round((count / vitaminAData.length) * 100)
        if (rate > highestRate) {
          highestRate = rate
          highestPurok = purok
        }
        if (rate < lowestRate) {
          lowestRate = rate
          lowestPurok = purok
        }
      })

      stats.value.vitaminAStats.coverageRate = Math.round((vitaminAData.length / 145) * 100) // 145 is target population
      stats.value.vitaminAStats.highestPurok = highestPurok
      stats.value.vitaminAStats.highestRate = highestRate
      stats.value.vitaminAStats.lowestPurok = lowestPurok
      stats.value.vitaminAStats.lowestRate = lowestRate
    }
  } catch (error) {
    console.error('Error fetching vitamin A stats:', error)
  }
}

const fetchToolStats = async () => {
  try {
    const { data: toolsData } = await supabase
      .from('tool_transactions')
      .select('*')

    if (toolsData) {
      stats.value.toolStats.totalTools = toolsData.reduce((sum, record) => sum + record.quantity, 0)

      const purokDist = {}
      toolsData.forEach(record => {
        const p = record.recipient_purok || 'Unknown'
        purokDist[p] = (purokDist[p] || 0) + record.quantity
      })
      stats.value.toolStats.purokDistribution = purokDist

      const usageByType = {}
      toolsData.forEach(record => {
        const toolName = record.tool_name || 'Unknown'
        usageByType[toolName] = (usageByType[toolName] || 0) + record.quantity
      })
      stats.value.toolStats.usageByType = usageByType
    }
  } catch (error) {
    console.error('Error fetching tools stats:', error)
  }
}

const fetchHouseholdStats = async () => {
  try {
    const { data: householdHeads } = await supabase
      .from('household_heads')
      .select('*, household_members(*)')
      .eq('barangay', selectedBarangay.value)

    if (householdHeads) {
      stats.value.householdStats.totalHouseholds = householdHeads.length
      const totalPopulation = householdHeads.reduce((sum, head) => sum + (head.population || 0), 0)
      stats.value.householdStats.totalPopulation = totalPopulation

      stats.value.householdStats.avgHouseholdSize = householdHeads.length > 0 ? Number((totalPopulation / householdHeads.length).toFixed(1)) : 0

      const maleCount = householdHeads.reduce((sum, head) => sum + (head.male_count || 0), 0)
      const femaleCount = householdHeads.reduce((sum, head) => sum + (head.female_count || 0), 0)
      const totalCount = maleCount + femaleCount
      stats.value.householdStats.genderDistribution = {
        male: totalCount > 0 ? Math.round((maleCount / totalCount) * 100) : 0,
        female: totalCount > 0 ? Math.round((femaleCount / totalCount) * 100) : 0
      }

      const purokDist = {}
      householdHeads.forEach(head => {
        if (head.purok) {
          purokDist[head.purok] = (purokDist[head.purok] || 0) + 1
        }
      })
      stats.value.householdStats.purokDistribution = purokDist

      const allMembers = householdHeads.flatMap(head => head.household_members || [])

      const educationDist = {}
      allMembers.forEach(member => {
        if (member.education) {
          educationDist[member.education] = (educationDist[member.education] || 0) + 1
        }
      })
      stats.value.householdStats.education = educationDist

      const civilStatusDist = {}
      allMembers.forEach(member => {
        if (member.civil_status) {
          civilStatusDist[member.civil_status] = (civilStatusDist[member.civil_status] || 0) + 1
        }
      })
      stats.value.householdStats.civilStatus = civilStatusDist
    }
  } catch (error) {
    console.error('Error fetching household stats:', error)
  }
}

onMounted(() => {
  const getUserBarangay = async () => {
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
  }

  getUserBarangay().then(() => {
    fetchDewormingStats()
    fetchVitaminAStats()
    fetchToolStats()
    fetchHouseholdStats()
  })
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
      <h4 class="fw-bold">Health Summary Report</h4>
      <p>
        {{ selectedBarangay }} – Municipality of Buenavista, Agusan del Norte <br />
        Reporting Period: September 2025
      </p>
    </div>

    <section class="mb-4">
      <h5 class="fw-bold">Executive Summary</h5>
      <p>
        This report presents a comprehensive summary of the household profiling, health initiatives, and community development activities conducted in {{ selectedBarangay }} during the reporting period. It highlights the collective performance and participation of residents across all four puroks in various health and social programs. The findings cover key areas such as household demographics, deworming coverage, Vitamin A supplementation, and tool distribution, reflecting the barangay’s overall engagement and commitment to improving public health and community welfare.
      </p>
    </section>

    <section class="mb-4">
      <h5 class="fw-bold">Key Findings</h5>
      <ol>
        <li class="mb-3">
          <strong>Household Profiling & Household Head Profile</strong>
          <ul>
              <li>Total Households Profiled: {{ stats.householdStats.totalHouseholds }}</li>
              <li>Total Population: {{ stats.householdStats.totalPopulation }}</li>
              <li>Average Household Size: {{ stats.householdStats.avgHouseholdSize }} members</li>
              <li>Gender Distribution: {{ stats.householdStats.genderDistribution.male }}% male, {{ stats.householdStats.genderDistribution.female }}% female</li>
              <li>Distribution by Purok:
                <span v-for="(count, purok) in stats.householdStats.purokDistribution" :key="purok">
                  {{ purok }}: {{ count }} households,
                </span>
              </li>
              <li>Educational Attainment:
                <span v-for="(count, level) in stats.householdStats.education" :key="level">
                  {{ level }}: {{ Math.round((count / stats.householdStats.totalPopulation) * 100) }}%,
                </span>
              </li>
              <li>Civil Status:
                <span v-for="(count, status) in stats.householdStats.civilStatus" :key="status">
                  {{ status }}: {{ Math.round((count / stats.householdStats.totalPopulation) * 100) }}%,
                </span>
              </li>
          </ul>
        </li>
        <li class="mb-3">
          <strong>Deworming Records</strong>
          <ul>
            <li>Children Dewormed (Ages 1–14): {{ stats.dewormingStats.totalDewormed }}</li>
            <li>Coverage Rate: {{ stats.dewormingStats.coverageRate }}%</li>
            <li>Purok Participation:
              <span v-for="(count, purok) in stats.dewormingStats.purokParticipation" :key="purok">
                {{ purok }}: {{ count }} children,
              </span>
            </li>
          </ul>
        </li>
        <li class="mb-3">
          <strong>Vitamin A Supplementation Records</strong>
          <ul>
            <li>Children 6–59 months Supplemented: {{ stats.vitaminAStats.totalSupplemented }}</li>
            <li>Coverage Rate: {{ stats.vitaminAStats.coverageRate }}%</li>
            <li>Highest Coverage: {{ stats.vitaminAStats.highestPurok }} ({{ stats.vitaminAStats.highestRate }}%)</li>
            <li>Lowest Coverage: {{ stats.vitaminAStats.lowestPurok }} ({{ stats.vitaminAStats.lowestRate }}%)</li>
          </ul>
        </li>
        <li class="mb-3">
          <strong>Tool Distribution Records</strong>
          <ul>
            <li>Total Tools Distributed: {{ stats.toolStats.totalTools }}</li>
            <li>Distribution by Purok:
              <span v-for="(count, purok) in stats.toolStats.purokDistribution" :key="purok">
                {{ purok }}: {{ count }} tools,
              </span>
            </li>
            <li>Distribution by Tool Type:
              <span v-for="(count, type) in stats.toolStats.usageByType" :key="type">
                {{ type }}: {{ count }},
              </span>
            </li>
          </ul>
        </li>
      </ol>
    </section>

    <div class="d-flex justify-content-end mt-4">
      <button class="hs-btn hs-btn-primary exclude-from-pdf" @click="$emit('next')">Next &rarr;</button>
    </div>
  </div>
</template>
<style scoped>
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
