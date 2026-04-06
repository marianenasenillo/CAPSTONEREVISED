<script setup>
import ReportOne from '@/components/reports/ReportOne.vue'
import ReportTwo from '@/components/reports/ReportTwo.vue'
import ReportThree from '@/components/reports/ReportThree.vue'

import { ref, nextTick } from 'vue'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const showReport = ref(false)
const step = ref(1)
const bulkExporting = ref(false)

const reportRef = ref(null)
const report1Ref = ref(null)
const report2Ref = ref(null)
const report3Ref = ref(null)

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

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    onclone: (clonedDoc) => {
      const origCanvases = element.querySelectorAll('canvas')
      const clonedCanvases = clonedDoc.querySelectorAll('canvas')
      clonedCanvases.forEach((cc, i) => {
        if (origCanvases[i]) {
          const img = clonedDoc.createElement('img')
          img.src = origCanvases[i].toDataURL('image/png')
          img.style.width = cc.style.width || cc.getAttribute('width') + 'px' || '100%'
          img.style.height = cc.style.height || cc.getAttribute('height') + 'px' || '300px'
          cc.parentNode.replaceChild(img, cc)
        }
      })
    },
  })
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

  const margin = 10
  const pxPerMm = canvas.width / (pageWidth * (window.devicePixelRatio || 1))
  const imgWidthMm = pageWidth - 2 * margin
  const imgHeightMm = ((canvas.height / pxPerMm) / (window.devicePixelRatio || 1)) * (imgWidthMm / pageWidth)
  const usableHeight = pageHeight - 2 * margin

  let remainingHeight = imgHeightMm
  let position = margin

  while (remainingHeight > 0) {
    pdf.addImage(imgData, 'PNG', margin, position, imgWidthMm, imgHeightMm)
    remainingHeight -= usableHeight
    if (remainingHeight > 0) pdf.addPage()
    position -= usableHeight
  }

  pdf.save('report.pdf')

  element.style.overflow = originalOverflow
  element.style.maxHeight = originalMaxHeight
}

// Helper to capture a single element to canvas
const captureElement = async (element) => {
  const origOverflow = element.style.overflow
  const origMaxHeight = element.style.maxHeight
  element.style.overflow = 'visible'
  element.style.maxHeight = 'none'

  const excludeEls = element.querySelectorAll('.exclude-from-pdf')
  const origDisplays = []
  excludeEls.forEach(el => { origDisplays.push(el.style.display); el.style.display = 'none' })

  const logos = element.querySelectorAll('img[alt="Province Logo"], img[alt="Barangay Logo"]')
  const origSizes = []
  const origMargins = []
  logos.forEach(img => {
    origSizes.push(img.style.height)
    img.style.height = '80px'
    if (img.alt === 'Province Logo') {
      origMargins.push(img.style.right)
      img.style.position = 'relative'
      img.style.right = '-130px'
    }
  })

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    onclone: (clonedDoc) => {
      const origCanvases = element.querySelectorAll('canvas')
      const clonedCanvases = clonedDoc.querySelectorAll('canvas')
      clonedCanvases.forEach((cc, i) => {
        if (origCanvases[i]) {
          const img = clonedDoc.createElement('img')
          img.src = origCanvases[i].toDataURL('image/png')
          img.style.width = cc.style.width || cc.getAttribute('width') + 'px' || '100%'
          img.style.height = cc.style.height || cc.getAttribute('height') + 'px' || '300px'
          cc.parentNode.replaceChild(img, cc)
        }
      })
    },
  })

  logos.forEach((img, i) => {
    img.style.height = origSizes[i]
    if (img.alt === 'Province Logo') { img.style.right = origMargins[i] || ''; img.style.position = '' }
  })
  excludeEls.forEach((el, i) => { el.style.display = origDisplays[i] })
  element.style.overflow = origOverflow
  element.style.maxHeight = origMaxHeight

  return canvas
}

// Bulk export all 3 report pages into a single PDF
const bulkExportPdf = async () => {
  bulkExporting.value = true
  await nextTick()
  // Wait for charts to render — longer delay for slower devices
  await new Promise(r => setTimeout(r, 3000))

  const refs = [report1Ref.value, report2Ref.value, report3Ref.value]
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const usableHeight = pageHeight - 2 * margin

  for (let i = 0; i < refs.length; i++) {
    if (!refs[i]) continue
    const canvas = await captureElement(refs[i])
    const imgData = canvas.toDataURL('image/png')

    const pxPerMm = canvas.width / (pageWidth * (window.devicePixelRatio || 1))
    const imgWidthMm = pageWidth - 2 * margin
    const imgHeightMm = ((canvas.height / pxPerMm) / (window.devicePixelRatio || 1)) * (imgWidthMm / pageWidth)

    if (i > 0) pdf.addPage()
    let remainingHeight = imgHeightMm
    let position = margin
    while (remainingHeight > 0) {
      pdf.addImage(imgData, 'PNG', margin, position, imgWidthMm, imgHeightMm)
      remainingHeight -= usableHeight
      if (remainingHeight > 0) pdf.addPage()
      position -= usableHeight
    }
  }

  pdf.save('report-complete.pdf')
  bulkExporting.value = false
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
              <button class="hs-btn hs-btn-primary" @click="bulkExportPdf" :disabled="bulkExporting"><span class="mdi mdi-file-export-outline"></span> {{ bulkExporting ? 'Exporting...' : 'Export All Pages' }}</button>
            </div>
          </div>
          <div ref="reportRef" class="report-container">
            <ReportOne v-if="step === 1" @next="nextStep" />
            <ReportTwo v-else-if="step === 2" @next="nextStep" @prev="prevStep" />
            <ReportThree v-else-if="step === 3" @prev="prevStep" />
          </div>
          <!-- Hidden container for bulk export: renders all 3 reports at once -->
          <div v-if="bulkExporting" class="bulk-export-container">
            <div ref="report1Ref"><ReportOne /></div>
            <div ref="report2Ref"><ReportTwo /></div>
            <div ref="report3Ref"><ReportThree /></div>
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
.bulk-export-container { position: fixed; left: 0; top: 0; width: 1100px; opacity: 0; pointer-events: none; z-index: -1; }
</style>
