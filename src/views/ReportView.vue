<script setup>
import DashboardView from '@/components/DashboardView.vue'
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

  // temporarily remove max-height/overflow so entire content is captured
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

  // Temporarily reduce logo sizes for PDF export
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

  // Render element to canvas at higher scale for better quality
  const canvas = await html2canvas(element, { scale: 2, useCORS: true })
  const imgData = canvas.toDataURL('image/png')

  // Restore logo sizes
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

  // A4 size in mm
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // Convert canvas pixel size to mm for jsPDF
  const pxPerMm = canvas.width / (pageWidth * (window.devicePixelRatio || 1))
  const imgWidthMm = pageWidth
  const imgHeightMm = (canvas.height / pxPerMm) / (window.devicePixelRatio || 1)

  let remainingHeight = imgHeightMm
  let position = 0

  // Add image slices per page
  while (remainingHeight > 0) {
    pdf.addImage(imgData, 'PNG', 0, position, imgWidthMm, imgHeightMm)
    remainingHeight -= pageHeight
    if (remainingHeight > 0) pdf.addPage()
    // next page position: shift the image up by pageHeight (negative)
    position -= pageHeight
  }

  pdf.save('report.pdf')

  // restore styles
  element.style.overflow = originalOverflow
  element.style.maxHeight = originalMaxHeight
}
</script>

<template>
  <DashboardView>
    <div class="report-bg ">
      <div class="overlay-content text-white text-start">
        <h1 class="fw-bold">Health Summary Report</h1>
        <p>Click below to view the Health Summary Report for Barangay 5.</p>
        <button class="btn view-btn mt-3 d-block mx-auto" @click="openReport">View Report</button>
      </div>

      <div v-if="showReport" class="records-overlay">
        <div class="records-box d-flex flex-column align-items-center">
          <!-- back button (left) and a compact export button (top-right) positioned absolutely so they don't affect layout -->
          <button class="back-btn align-self-start" @click="closeReport">← back</button>
          <button class="export-small-btn" @click="exportPdf" title="Export PDF">⤓</button>
          <div ref="reportRef" class="report-container py-4 bg-white shadow rounded">
            <ReportOne v-if="step === 1" @next="nextStep" />
            <ReportTwo v-else-if="step === 2" @next="nextStep" @prev="prevStep" />
            <ReportThree v-else-if="step === 3" @prev="prevStep" />
          </div>
        </div>
      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
.report-bg {
  
  background: url('/images/bg.jpg') no-repeat center center;
  background-size: cover;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rem;
}

.overlay-content {
  background: rgba(131, 189, 45, 0.65);
  padding: 2rem;
  border-radius: 1rem;
  max-width: 480px;
  margin-left: 6rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}
.view-btn {
  background-color: #ffcc00;
  color: #000;
  font-weight: 600;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 8px;
  transition: 0.3s;
  width: 50%;
}
.view-btn:hover {
  background-color: #e6b800;
}
.records-overlay {
  position: fixed;
  top: 20px;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 2rem;
}
.records-box {
  background: rgba(162, 163, 160, 0.65);
  padding: 3rem 4rem;
  border-radius: 1rem;
  max-width: 1300px;
  width: 100%;
  height: 600px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}
.back-btn {
  position: absolute;
  top: 15px;
  left: 15px;
  background: transparent;
  border: none;
  font-weight: bold;
  color: #000;
  font-size: 1.35rem;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: transform 0.2s;
}
.back-btn:hover {
  transform: scale(1.1);
}
.report-container {
  max-width: 1100px;
  padding-left: 3rem;
  padding-right: 3rem;
  max-height: 80vh;      /* NEW: limit height */
  overflow-y: auto;      /* NEW: enable vertical scroll */
}

.export-small-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background-color: rgba(43, 122, 11, 0.95);
  color: #fff;
  border: none;
  padding: 0.25rem 0.45rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.85rem;
  line-height: 1;
  min-width: 36px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.export-small-btn:hover { background-color: #236008 }

/* Prevent breaking inside important blocks when printing */
.no-break, .report-container * {
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

@media print {
  .records-overlay { background: #fff !important; }
  .records-box { box-shadow: none !important; background: #fff !important; }
  .report-container { max-height: none !important; overflow: visible !important; }
  .back-btn, .export-btn { display: none !important; }
}
</style>
