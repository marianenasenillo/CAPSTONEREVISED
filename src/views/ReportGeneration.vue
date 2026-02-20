<script setup>
import ReportOne from '@/components/reports/ReportOne.vue'
import ReportTwo from '@/components/reports/ReportTwo.vue'
import ReportThree from '@/components/reports/ReportThree.vue'

import { ref } from 'vue'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const showReport = ref(false)
const step = ref(1)

const reportRef = ref(null)

const openReport = () => {
  showReport.value = true
  step.value = 1
}
const closeReport = () => (showReport.value = false)
const nextStep = () => step.value++
const prevStep = () => step.value--

// Export visible report area to PDF (A4 paginated)
const exportPdf = async () => {
  if (!reportRef.value) return
  const element = reportRef.value

  const originalOverflow = element.style.overflow
  const originalMaxHeight = element.style.maxHeight
  element.style.overflow = 'visible'
  element.style.maxHeight = 'none'

  // Temporarily hide elements that should not be in PDF
  const excludeElements = element.querySelectorAll('.exclude-from-pdf')
  const originalDisplays = []
  excludeElements.forEach(el => {
    originalDisplays.push(el.style.display)
    el.style.display = 'none'
  })

  const logos = element.querySelectorAll('img[alt="Province Logo"], img[alt="Barangay Logo"]')
  const originalSizes = []
  const originalMargins = []
  logos.forEach(img => {
    originalSizes.push(img.style.height)
    img.style.height = '80px'
    if (img.alt === 'Province Logo') {
      originalMargins.push(img.style.right)
      img.style.position = 'relative'
      img.style.right = '-130px'
    }
  })

  const canvas = await html2canvas(element, { scale: 2, useCORS: true })
  const imgData = canvas.toDataURL('image/png')

  logos.forEach((img, index) => {
    img.style.height = originalSizes[index]
    if (img.alt === 'Province Logo') {
      img.style.right = originalMargins[index] || ''
      img.style.position = ''
    }
  })

  // Restore excluded elements
  excludeElements.forEach((el, index) => {
    el.style.display = originalDisplays[index]
  })

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const pxPerMm = canvas.width / (pageWidth * (window.devicePixelRatio || 1))
  const imgWidthMm = pageWidth
  const imgHeightMm = (canvas.height / pxPerMm) / (window.devicePixelRatio || 1)

  let remainingHeight = imgHeightMm
  let position = 0

  while (remainingHeight > 0) {
    pdf.addImage(imgData, 'PNG', 0, position, imgWidthMm, imgHeightMm)
    remainingHeight -= pageHeight
    if (remainingHeight > 0) pdf.addPage()
    position -= pageHeight
  }

  pdf.save('report.pdf')

  element.style.overflow = originalOverflow
  element.style.maxHeight = originalMaxHeight
}
</script>

<template>
    <div class="service-page">
      <div class="hs-page-header">
        <h1>Health Summary Report</h1>
        <p class="hs-module-desc">Generate and export reports for barangay health programs.</p>
      </div>

      <div class="hs-card report-hero">
        <div class="hs-stat-icon hs-stat-icon-primary report-hero-icon">
          <span class="mdi mdi-chart-bar"></span>
        </div>
        <h3 class="report-hero-title">Generate Report</h3>
        <p class="report-hero-desc">View and export a comprehensive summary of all health services data</p>
        <button class="hs-btn hs-btn-primary" @click="openReport"><span class="mdi mdi-eye-outline"></span> View Report</button>
      </div>

      <div v-if="showReport" class="hs-modal-overlay">
        <div class="report-wrapper">
          <div class="report-actions">
            <button class="hs-btn hs-btn-secondary" @click="closeReport"><span class="mdi mdi-arrow-left"></span> Back</button>
            <div class="report-hero-actions">
              <button v-if="step > 1" class="hs-btn hs-btn-secondary" @click="prevStep"><span class="mdi mdi-chevron-left"></span> Previous</button>
              <button v-if="step < 3" class="hs-btn hs-btn-secondary" @click="nextStep">Next <span class="mdi mdi-chevron-right"></span></button>
              <button class="hs-btn hs-btn-primary" @click="exportPdf"><span class="mdi mdi-download"></span> Export PDF</button>
            </div>
          </div>
          <div ref="reportRef" class="report-container">
            <ReportOne v-if="step === 1" @next="nextStep" />
            <ReportTwo v-else-if="step === 2" @next="nextStep" @prev="prevStep" />
            <ReportThree v-else-if="step === 3" @prev="prevStep" />
          </div>
        </div>
      </div>
    </div>
</template>

<style scoped>
.service-page { max-width: var(--hs-content-max-width); }
.report-wrapper { background: var(--hs-white); border-radius: var(--hs-radius-lg); max-width: 1200px; width: 95%; max-height: 90vh; overflow-y: auto; padding: 24px; }
.report-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: var(--hs-space-2); }
.report-container { max-width: 1100px; margin: 0 auto; }
@media print { .report-actions { display: none; } }
.report-hero { text-align: center; padding: var(--hs-space-12); }
.report-hero-icon { margin: 0 auto var(--hs-space-4); width: 64px; height: 64px; font-size: var(--hs-font-size-3xl); }
.report-hero-title { font-size: var(--hs-font-size-lg); font-weight: 600; margin-bottom: var(--hs-space-2); }
.report-hero-desc { color: var(--hs-gray-500); margin-bottom: var(--hs-space-6); }
.report-hero-actions { display: flex; gap: var(--hs-space-2); }
</style>
