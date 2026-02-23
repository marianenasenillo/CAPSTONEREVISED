/**
 * Service Detection Composable
 *
 * Automatically detects applicable health services based on person data
 * (age, sex, civil status, pregnancy, etc.) and manages dynamic form fields
 * for each detected service table.
 *
 * Used in Household Head and Household Member forms to:
 *  1. Detect which services are applicable
 *  2. Render additional fields per service (only fields NOT already in the base form)
 *  3. Build insert payloads for each service table on form submission
 */
import { ref, reactive } from 'vue'
import { getEligibleServices } from '@/utils/serviceEligibility'

/**
 * Configuration for each target service table.
 * Defines the extra fields needed (beyond the base form), labels, icons,
 * and how to build the insert payload.
 */
const SERVICE_TABLE_CONFIG = {
  childcare_vitamina_records: {
    label: 'Childcare / Vitamin A',
    icon: 'mdi-baby-face-outline',
    color: '#FF9800',
    extraFields: [
      { key: 'mother_name', label: "Mother's Name", type: 'text' },
    ],
    buildPayload(base, extra) {
      return {
        purok: base.purok || '',
        lastname: base.lastname || '',
        firstname: base.firstname || '',
        middlename: base.middlename || '',
        suffix: base.suffix || '',
        age: base.age != null && base.age !== '' ? parseInt(base.age) : null,
        birthdate: base.birthdate || null,
        gender: base.sex || '',
        mother_name: extra.mother_name || '',
      }
    },
  },

  deworming_records: {
    label: 'Deworming / Preventive Health',
    icon: 'mdi-medical-bag',
    color: '#4CAF50',
    extraFields: [
      {
        key: 'mother_name',
        label: "Mother's Name",
        type: 'text',
        showIf: (base) => base.age != null && parseInt(base.age) < 18,
      },
    ],
    buildPayload(base, extra) {
      return {
        purok: base.purok || '',
        lastname: base.lastname || '',
        firstname: base.firstname || '',
        middlename: base.middlename || '',
        sex: base.sex || '',
        birthday: base.birthdate || null,
        age: base.age != null && base.age !== '' ? parseInt(base.age) : null,
        mother_name: extra.mother_name || null,
      }
    },
  },

  wra_records: {
    label: 'WRA / Maternal Care',
    icon: 'mdi-human-female',
    color: '#E91E63',
    extraFields: [
      { key: 'se_status', label: 'SE Status', type: 'select', options: ['P', 'NP'] },
      { key: 'plano_manganak', label: 'Plano Manganak', type: 'text' },
      { key: 'karun', label: 'Karun', type: 'checkbox', default: false },
      { key: 'spacing', label: 'Spacing', type: 'checkbox', default: false },
      { key: 'limiting', label: 'Limiting', type: 'checkbox', default: false },
      { key: 'fecund', label: 'Fecund', type: 'checkbox', default: false },
      { key: 'infecund', label: 'Infecund', type: 'checkbox', default: false },
      { key: 'fb_method', label: 'FB Method', type: 'text' },
      { key: 'fb_type', label: 'FB Type', type: 'text' },
      { key: 'fb_date', label: 'FB Date', type: 'date' },
      { key: 'change_method', label: 'Change Method', type: 'text' },
    ],
    buildPayload(base, extra) {
      return {
        purok: base.purok || '',
        lastname: base.lastname || '',
        firstname: base.firstname || '',
        middlename: base.middlename || '',
        suffix: base.suffix || '',
        age: base.age != null && base.age !== '' ? parseInt(base.age) : null,
        birthdate: base.birthdate || null,
        se_status: extra.se_status || '',
        civil_status: base.civil_status || '',
        plano_manganak: extra.plano_manganak || '',
        karun: extra.karun || false,
        spacing: extra.spacing || false,
        limiting: extra.limiting || false,
        fecund: extra.fecund || false,
        infecund: extra.infecund || false,
        fb_method: extra.fb_method || '',
        fb_type: extra.fb_type || '',
        fb_date: extra.fb_date || null,
        change_method: extra.change_method || '',
      }
    },
  },

  cervical_screening_records: {
    label: 'Cervical Cancer Screening',
    icon: 'mdi-ribbon',
    color: '#9C27B0',
    extraFields: [
      { key: 'screened', label: 'Screened', type: 'select', options: ['Yes', 'No'] },
    ],
    buildPayload(base, extra) {
      return {
        purok: base.purok || '',
        lastname: base.lastname || '',
        firstname: base.firstname || '',
        middlename: base.middlename || '',
        suffix: base.suffix || '',
        age: base.age != null && base.age !== '' ? parseInt(base.age) : null,
        birthdate: base.birthdate || null,
        screened: extra.screened || '',
      }
    },
  },

  family_planning_records: {
    label: 'Family Planning',
    icon: 'mdi-account-group',
    color: '#2196F3',
    extraFields: [
      { key: 'mother_name', label: "Mother's Name", type: 'text' },
    ],
    buildPayload(base, extra) {
      return {
        purok: base.purok || '',
        surname: base.lastname || '',
        firstname: base.firstname || '',
        mother_name: extra.mother_name || '',
        sex: base.sex || '',
        birthday: base.birthdate || null,
        age: base.age != null && base.age !== '' ? parseInt(base.age) : null,
      }
    },
  },
}

/**
 * Composable for automatic service detection and dynamic form management.
 *
 * Usage:
 *   const { detectedServices, detectedTables, selectedTables, serviceFormData,
 *           detectServices, getVisibleFields, buildPayloads, resetDetection } = useServiceDetection()
 *
 *   // In watcher:
 *   detectServices({ birthdate, sex, civil_status, lmp, is_pregnant })
 *
 *   // In template: iterate detectedTables for UI
 *   // On submit: buildPayloads(baseData) returns array of { table, label, payload }
 */
export function useServiceDetection() {
  const detectedServices = ref([])
  const detectedTables = ref([])
  const selectedTables = reactive({}) // { tableName: true/false }
  const serviceFormData = reactive({}) // { tableName: { fieldKey: value } }

  /**
   * Detect eligible services from person data and update state.
   * @param {Object} personData - { birthdate, sex, civil_status, lmp, is_pregnant }
   */
  function detectServices(personData) {
    const services = getEligibleServices(personData)
    detectedServices.value = services

    // Deduplicate by target table — multiple services can map to the same table
    const tableSet = new Set()
    for (const svc of services) {
      if (svc.table && SERVICE_TABLE_CONFIG[svc.table]) {
        tableSet.add(svc.table)
      }
    }

    const tables = Array.from(tableSet).map((tableName) => {
      const config = SERVICE_TABLE_CONFIG[tableName]
      const matchingServices = services.filter((s) => s.table === tableName)
      return {
        table: tableName,
        label: config.label,
        icon: config.icon,
        color: config.color,
        services: matchingServices,
        extraFields: config.extraFields || [],
      }
    })

    detectedTables.value = tables

    // Initialize form data and selected state for new tables
    for (const t of tables) {
      if (!(t.table in selectedTables)) {
        selectedTables[t.table] = true // auto-selected by default
      }
      if (!serviceFormData[t.table]) {
        const formDefaults = {}
        for (const field of t.extraFields) {
          formDefaults[field.key] = field.default !== undefined ? field.default : ''
        }
        serviceFormData[t.table] = formDefaults
      }
    }

    // Remove tables that are no longer detected
    for (const key of Object.keys(selectedTables)) {
      if (!tableSet.has(key)) {
        delete selectedTables[key]
        delete serviceFormData[key]
      }
    }
  }

  /**
   * Get the visible extra fields for a specific table, filtered by showIf conditions.
   * @param {string} tableName
   * @param {Object} baseData - base form data to evaluate showIf conditions
   * @returns {Array} visible extra field definitions
   */
  function getVisibleFields(tableName, baseData) {
    const config = SERVICE_TABLE_CONFIG[tableName]
    if (!config) return []
    return config.extraFields.filter((f) => {
      if (f.showIf && typeof f.showIf === 'function') {
        return f.showIf(baseData)
      }
      return true
    })
  }

  /**
   * Toggle whether a specific service table is selected for enrollment.
   * @param {string} tableName
   */
  function toggleTable(tableName) {
    selectedTables[tableName] = !selectedTables[tableName]
  }

  /**
   * Build insert payloads for all selected service tables.
   * @param {Object} baseData - { purok, lastname, firstname, middlename, suffix, birthdate, age, sex, civil_status }
   * @returns {Array<{ table: string, label: string, payload: Object }>}
   */
  function buildPayloads(baseData) {
    const payloads = []
    for (const t of detectedTables.value) {
      if (!selectedTables[t.table]) continue

      const config = SERVICE_TABLE_CONFIG[t.table]
      if (!config) continue

      const extra = serviceFormData[t.table] || {}
      const payload = config.buildPayload(baseData, extra)

      payloads.push({
        table: t.table,
        label: t.label,
        payload,
      })
    }
    return payloads
  }

  /**
   * Reset all detection state (services, tables, selections, form data).
   */
  function resetDetection() {
    detectedServices.value = []
    detectedTables.value = []
    for (const key of Object.keys(selectedTables)) {
      delete selectedTables[key]
    }
    for (const key of Object.keys(serviceFormData)) {
      delete serviceFormData[key]
    }
  }

  return {
    detectedServices,
    detectedTables,
    selectedTables,
    serviceFormData,
    detectServices,
    getVisibleFields,
    toggleTable,
    buildPayloads,
    resetDetection,
    SERVICE_TABLE_CONFIG,
  }
}
