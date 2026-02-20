<script setup>
import { DayPilot, DayPilotMonth } from '@daypilot/daypilot-lite-vue'
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/utils/supabase'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const monthRef = ref(null)
const startDate = ref("2026-10-01")
const currentMonth = ref(1)
const currentYear = ref(2026)
const events = ref([])
const showEventModal = ref(false)
const modalMode = ref('add') // 'add' or 'edit'
const modalEvent = ref({ text: '', description: '', start: '', end: '' })
const isAdmin = ref(false)
const filterType = ref('')

const colors = {
  event: "#4a7a1a",
  task: "#2563eb",
  reminder: "#ca8a04",
  holiday: "#dc2626",
}

const onEventMoved = async (args) => {
  try {
    if (!isAdmin.value) return
    const ev = args.e.data
    if (!ev?.id) return
    await supabase.from('events').update({ start: ev.start, end: ev.end }).eq('id', ev.id)
  } catch (err) {
    console.error('Failed to persist moved event', err)
  }
}

const onEventResized = async (args) => {
  try {
    if (!isAdmin.value) return
    const ev = args.e.data
    if (!ev?.id) return
    await supabase.from('events').update({ start: ev.start, end: ev.end }).eq('id', ev.id)
  } catch (err) {
    console.error('Failed to persist resized event', err)
  }
}

const onTimeRangeSelected = async (args) => {
  if (!isAdmin.value) {
    toast.warning('Only Admin users can add events.')
    args.control.clearSelection()
    return
  }
  openAddEventModal(args.start, args.end)
  args.control.clearSelection()
}

const onEventClicked = async (args) => {
  if (isAdmin.value) {
    openEditEventModal(args.e.data)
  } else {
    modalMode.value = 'view'
    modalEvent.value = { ...args.e.data }
    showEventModal.value = true
  }
}

function openAddEventModal(start, end) {
  modalMode.value = 'add'
  modalEvent.value = { text: '', description: '', start, end }
  showEventModal.value = true
}

function openEditEventModal(event) {
  modalMode.value = 'edit'
  modalEvent.value = { ...event }
  showEventModal.value = true
}

function closeEventModal() {
  showEventModal.value = false
}

async function saveEventModal() {
  try {
    if (!isAdmin.value) {
      toast.warning('Only Admin can save events.')
      return
    }
    if (modalMode.value === 'add') {
      const payload = {
        text: modalEvent.value.text,
        description: modalEvent.value.description,
        start: modalEvent.value.start,
        end: modalEvent.value.end,
        type: modalEvent.value.type || 'event',
      }
      const { data, error } = await supabase.from('events').insert(payload).select()
      if (error) throw error
      const r = data[0]
      events.value.push({ id: r.id, start: r.start, end: r.end, text: r.text, description: r.description, type: r.type, locked: r.locked })
    } else {
      const payload = {
        text: modalEvent.value.text,
        description: modalEvent.value.description,
        start: modalEvent.value.start,
        end: modalEvent.value.end,
        type: modalEvent.value.type || 'event',
        locked: modalEvent.value.locked || false,
      }
      const { error } = await supabase.from('events').update(payload).eq('id', modalEvent.value.id)
      if (error) throw error
      const idx = events.value.findIndex(e => e.id === modalEvent.value.id)
      if (idx !== -1) events.value[idx] = { ...modalEvent.value }
    }
    closeEventModal()
  } catch (err) {
    console.error('Failed to save event', err)
    toast.error('Failed to save event: ' + (err.message || err))
  }
}

const onBeforeEventRender = (args) => {
  const color = colors[args.data.type] || "#4a7a1a"
  args.data.backColor = color + "55"
  args.data.borderColor = color + "44"
  args.data.barColor = color + "66"

  args.data.areas = [
    {
      right: 4,
      top: 3,
      width: 24,
      height: 24,
      padding: 2,
      fontColor: "#ffffff",
      backColor: color + "55",
      symbol: "icons/daypilot.svg#threedots-v",
      action: "ContextMenu",
      style: "border-radius: 50%",
    },
  ]

  if (args.data.locked) {
    args.data.text += " (locked)"
    args.data.areas.push({
      right: 30,
      top: 3,
      width: 24,
      height: 24,
      padding: 4,
      fontColor: "#ffffff",
      backColor: color + "55",
      symbol: "icons/daypilot.svg#padlock",
      style: "border-radius: 50%",
      onClick: async (a) => {
        const modal = await DayPilot.Modal.confirm("Do you really want to unlock this event?")
        if (modal.canceled) return
        toggleEventLock(a.source)
      },
    })

    args.data.moveDisabled = true
    args.data.resizeDisabled = true
    args.data.clickDisabled = true
    args.data.deleteDisabled = true
  }

  // if not admin, make the event read-only (can't move/resize/click/delete)
  if (!isAdmin.value && !args.data.locked) {
    args.data.moveDisabled = true
    args.data.resizeDisabled = true
    args.data.clickDisabled = false
    args.data.deleteDisabled = true
  }
}

const adminContextMenu = new DayPilot.Menu({
  items: [
    { text: "Edit...", onClick: (args) => editEvent(args.source) },
    { text: "Delete", symbol: "icons/daypilot.svg#x-4", onClick: (args) => deleteEvent(args.source) },
    { text: "Lock", symbol: "icons/daypilot.svg#padlock", onClick: (args) => toggleEventLock(args.source) },
    { text: "-" },
    { text: "Duplicate", onClick: (args) => duplicateEvent(args.source) },
    { text: "Postpone", symbol: "icons/daypilot.svg#minichevron-right-4", onClick: (args) => postponeEvent(args.source) },
    { text: "-" },
    {
      text: "Type",
      items: [
        { text: "Event", icon: "icon icon-blue", onClick: (args) => updateEventType(args.source, "event") },
        { text: "Task", icon: "icon icon-green", onClick: (args) => updateEventType(args.source, "task") },
        { text: "Reminder", icon: "icon icon-yellow", onClick: (args) => updateEventType(args.source, "reminder") },
        { text: "Holiday", icon: "icon icon-red", onClick: (args) => updateEventType(args.source, "holiday") },
      ],
    },
  ]
})

const viewerContextMenu = new DayPilot.Menu({
  items: [
    { text: "View details", onClick: (args) => {
      modalMode.value = 'view'
      modalEvent.value = { ...args.source.data }
      showEventModal.value = true
    } },
  ]
})

const contextMenu = computed(() => isAdmin.value ? adminContextMenu : viewerContextMenu)

const editEvent = async (e) => {
  if (!isAdmin.value) {
    toast.warning('Only Admin can edit events.')
    return
  }
  const form = [
    { name: "Title", id: "text" },
    { name: "Description", id: "description" }
  ]
  const modal = await DayPilot.Modal.form(form, e.data)
  if (modal.canceled) return
  monthRef.value.control.events.update(modal.result)
  try {
    const id = modal.result.id || e.data.id
    await supabase.from('events').update({ text: modal.result.text, description: modal.result.description }).eq('id', id)
  } catch (err) {
    console.error('Failed to persist editEvent', err)
  }
}

const deleteEvent = async (e) => {
  const modal = await DayPilot.Modal.confirm("Do you really want to delete this event?")
  if (modal.canceled) return
  try {
    if (!isAdmin.value) {
      toast.warning('Only Admin can delete events.')
      return
    }
    const { error } = await supabase.from('events').delete().eq('id', e.data.id)
    if (error) throw error
    monthRef.value.control.events.remove(e)
  } catch (err) {
    console.error('Failed to delete event', err)
    toast.error('Failed to delete event: ' + (err.message || err))
  }
}

const duplicateEvent = async (e) => {
  try {
    if (!isAdmin.value) {
      toast.warning('Only Admin can duplicate events.')
      return
    }
    const payload = {
      text: e.data.text,
      description: e.data.description,
      start: e.data.start,
      end: e.data.end,
      type: e.data.type || 'event',
      locked: false,
    }
    const { data, error } = await supabase.from('events').insert(payload).select()
    if (error) throw error
    const r = data[0]
    monthRef.value.control.events.add({ id: r.id, start: r.start, end: r.end, text: r.text, description: r.description, type: r.type, locked: r.locked })
  } catch (err) {
    console.error('Failed to duplicate event', err)
    toast.error('Failed to duplicate event: ' + (err.message || err))
  }
}

const postponeEvent = async (e) => {
  try {
    if (!isAdmin.value) {
      toast.warning('Only Admin can postpone events.')
      return
    }
    e.data.start = e.start().addDays(1)
    e.data.end = e.end().addDays(1)
    monthRef.value.control.events.update(e)
    const id = e.data.id
    if (id) await supabase.from('events').update({ start: e.data.start, end: e.data.end }).eq('id', id)
  } catch (err) {
    console.error('Failed to postpone event', err)
    toast.error('Failed to postpone event: ' + (err.message || err))
  }
}

const updateEventType = async (e, type) => {
  try {
    if (!isAdmin.value) {
      toast.warning('Only Admin can change event type.')
      return
    }
    e.data.type = type
    monthRef.value.control.events.update(e)
    const id = e.data.id
    if (id) await supabase.from('events').update({ type }).eq('id', id)
  } catch (err) {
    console.error('Failed to update event type', err)
    toast.error('Failed to update event type: ' + (err.message || err))
  }
}

const toggleEventLock = async (e) => {
  try {
    if (!isAdmin.value) {
      toast.warning('Only Admin can lock/unlock events.')
      return
    }
    e.data.locked = !e.data.locked
    monthRef.value.control.events.update(e)
    const id = e.data.id
    if (id) await supabase.from('events').update({ locked: e.data.locked }).eq('id', id)
  } catch (err) {
    console.error('Failed to toggle event lock', err)
    toast.error('Failed to toggle lock: ' + (err.message || err))
  }
}

async function loadEvents() {
  try {
    const { data, error } = await supabase.from('events').select('*').order('start', { ascending: true })
    if (error) throw error
    events.value = data.map(r => ({ id: r.id, start: r.start, end: r.end, text: r.text, description: r.description, type: r.type, locked: r.locked }))
  } catch (err) {
    console.error('Failed to load events', err)
    events.value = []
  }
}

const eventList = computed(() => {
  if (!filterType.value) return events.value
  return events.value.filter(e => e.type === filterType.value)
})

const currentMonthEvents = computed(() => {
  const y = currentYear.value
  const m = currentMonth.value
  return events.value.filter(e => {
    const d = new Date(e.start)
    return d.getFullYear() === y && (d.getMonth() + 1) === m
  }).sort((a, b) => new Date(a.start) - new Date(b.start))
})

const eventStats = computed(() => ({
  total: events.value.length,
  events: events.value.filter(e => e.type === 'event').length,
  tasks: events.value.filter(e => e.type === 'task').length,
  reminders: events.value.filter(e => e.type === 'reminder').length,
  holidays: events.value.filter(e => e.type === 'holiday').length,
}))

const currentMonthName = computed(() => monthNames[currentMonth.value - 1])

function goToToday() {
  const now = new Date()
  currentMonth.value = now.getMonth() + 1
  currentYear.value = now.getFullYear()
  updateStartDate()
}

const updateStartDate = () => {
  startDate.value = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`
}

const previousMonth = () => {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
  updateStartDate()
}

const nextMonth = () => {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
  updateStartDate()
}

const goToMonth = (month, year) => {
  currentMonth.value = month
  currentYear.value = year
  updateStartDate()
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

onMounted(async () => {
  const now = new Date()
  currentMonth.value = now.getMonth() + 1
  currentYear.value = now.getFullYear()
  updateStartDate()

  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error && data?.user) {
      const role = data.user.user_metadata?.role || data.user?.role
      isAdmin.value = (role === 'Admin')
    }
  } catch (err) {
    console.error('Failed to fetch user role', err)
  }

  loadEvents()
})

</script>

<template>
    <div class="service-page">
      <div class="hs-page-header">
        <h1>Calendar</h1>
        <p>Manage events, tasks, reminders and holidays</p>
        <p class="hs-module-desc">Schedule and manage barangay health events, reminders, and tasks.</p>
      </div>

      <!-- Stats row -->
      <div class="cal-stats-row">
        <div class="cal-stat-chip" style="--chip-color: var(--hs-primary);">
          <span class="mdi mdi-calendar"></span> {{ eventStats.total }} Total
        </div>
        <div class="cal-stat-chip" style="--chip-color: var(--hs-info);">
          <span class="mdi mdi-calendar-star"></span> {{ eventStats.events }} Events
        </div>
        <div class="cal-stat-chip" style="--chip-color: var(--hs-success);">
          <span class="mdi mdi-checkbox-marked-circle-outline"></span> {{ eventStats.tasks }} Tasks
        </div>
        <div class="cal-stat-chip" style="--chip-color: var(--hs-warning);">
          <span class="mdi mdi-bell-outline"></span> {{ eventStats.reminders }} Reminders
        </div>
        <div class="cal-stat-chip" style="--chip-color: var(--hs-danger);">
          <span class="mdi mdi-flag-outline"></span> {{ eventStats.holidays }} Holidays
        </div>
      </div>

      <div class="hs-legend">
        <div class="hs-legend-item"><span class="hs-legend-dot hs-legend-dot--success"></span> Event</div>
        <div class="hs-legend-item"><span class="hs-legend-dot hs-legend-dot--info"></span> Task</div>
        <div class="hs-legend-item"><span class="hs-legend-dot hs-legend-dot--warning"></span> Reminder</div>
        <div class="hs-legend-item"><span class="hs-legend-dot hs-legend-dot--danger"></span> Holiday</div>
      </div>

      <div class="calendar-layout">
        <div class="calendar-main">
          <div class="hs-card cal-panel">
            <div class="calendar-nav">
              <div class="cal-toolbar-group">
                <button class="hs-btn hs-btn-secondary" @click="previousMonth" title="Previous Month"><span class="mdi mdi-chevron-left"></span></button>
                <select v-model="currentMonth" @change="updateStartDate" class="hs-select hs-w-auto">
                  <option v-for="(name, idx) in monthNames" :key="idx" :value="idx + 1">{{ name }}</option>
                </select>
                <input type="number" v-model="currentYear" @change="updateStartDate" class="hs-input cal-year-input" />
                <button class="hs-btn hs-btn-secondary" @click="nextMonth" title="Next Month"><span class="mdi mdi-chevron-right"></span></button>
                <button class="hs-btn hs-btn-primary" @click="goToToday"><span class="mdi mdi-calendar-today"></span> Today</button>
              </div>
              <div class="cal-toolbar-group">
                <select v-model="filterType" class="hs-select hs-w-auto">
                  <option value="">All Types</option>
                  <option value="event">Events</option>
                  <option value="task">Tasks</option>
                  <option value="reminder">Reminders</option>
                  <option value="holiday">Holidays</option>
                </select>
              </div>
            </div>
            <h2 class="cal-month-title">{{ currentMonthName }} {{ currentYear }}</h2>
            <DayPilotMonth
              :config="{
                startDate,
                events: eventList,
                eventHeight: 30,
                cellHeaderHeight: 25,
                onEventMoved,
                onEventResized,
                onTimeRangeSelected,
                onEventClicked,
                onBeforeEventRender,
                contextMenu
              }"
              ref="monthRef"
            />
            <!-- Color Legend -->
            <div class="cal-legend">
              <div class="cal-legend-item"><span class="cal-legend-dot cal-legend-dot--info"></span> Event</div>
              <div class="cal-legend-item"><span class="cal-legend-dot cal-legend-dot--success"></span> Task</div>
              <div class="cal-legend-item"><span class="cal-legend-dot cal-legend-dot--warning"></span> Reminder</div>
              <div class="cal-legend-item"><span class="cal-legend-dot cal-legend-dot--danger"></span> Holiday</div>
            </div>
          </div>
        </div>

        <div class="calendar-sidebar">
          <!-- This Month's Events -->
          <div class="hs-card cal-panel">
            <h3 class="cal-sidebar-title">{{ currentMonthName }} Events</h3>
            <p class="cal-sidebar-count">{{ currentMonthEvents.length }} event{{ currentMonthEvents.length !== 1 ? 's' : '' }} this month</p>
            <div class="event-list-scroll">
              <div v-for="event in currentMonthEvents" :key="event.id" class="event-item" :style="{ borderLeftColor: colors[event.type] || colors.event }">
                <div class="cal-event-header">
                  <strong>{{ event.text }}</strong>
                  <span class="cal-type-badge" :style="{ background: (colors[event.type] || colors.event) + '22', color: colors[event.type] || colors.event }">{{ event.type || 'event' }}</span>
                </div>
                <p v-if="event.description" class="cal-event-desc">{{ event.description }}</p>
                <p class="cal-event-time">
                  <span class="mdi mdi-clock-outline"></span> {{ new Date(event.start).toLocaleDateString() }}
                  <span v-if="event.locked" class="mdi mdi-lock-outline cal-lock-icon"></span>
                </p>
              </div>
              <p v-if="currentMonthEvents.length === 0" class="cal-no-events">No events this month</p>
            </div>
          </div>

          <!-- Quick Add (Admin only) -->
          <div v-if="isAdmin" class="hs-card cal-panel hs-mt-4">
            <h3 class="cal-quick-add-title"><span class="mdi mdi-plus-circle-outline"></span> Quick Add</h3>
            <p class="cal-quick-add-desc">Click any date on the calendar to create a new event, or use the context menu on existing events.</p>
          </div>
        </div>
      </div>

      <div v-if="showEventModal" class="hs-modal-overlay" @click.self="closeEventModal">
        <div class="hs-modal hs-modal-md">
          <div class="hs-modal-header">
            <h3>{{ modalMode === 'add' ? 'Add Event' : modalMode === 'edit' ? 'Edit Event' : 'View Event' }}</h3>
            <button class="hs-modal-close" @click="closeEventModal">&times;</button>
          </div>
          <div class="hs-modal-body">
            <div class="hs-form-group">
              <label class="hs-label">Title</label>
              <input v-model="modalEvent.text" class="hs-input" :disabled="modalMode === 'view' && !isAdmin" />
            </div>
            <div class="hs-form-group">
              <label class="hs-label">Description</label>
              <textarea v-model="modalEvent.description" class="hs-input" rows="3" :disabled="modalMode === 'view' && !isAdmin"></textarea>
            </div>
            <div class="hs-form-row">
              <div class="hs-form-group">
                <label class="hs-label">Start</label>
                <input v-model="modalEvent.start" type="date" class="hs-input" :disabled="modalMode === 'view' && !isAdmin" />
              </div>
              <div class="hs-form-group">
                <label class="hs-label">End</label>
                <input v-model="modalEvent.end" type="date" class="hs-input" :disabled="modalMode === 'view' && !isAdmin" />
              </div>
            </div>
            <div class="hs-form-group">
              <label class="hs-label">Type</label>
              <select v-model="modalEvent.type" class="hs-select" :disabled="modalMode === 'view' && !isAdmin">
                <option value="event">Event</option>
                <option value="task">Task</option>
                <option value="reminder">Reminder</option>
                <option value="holiday">Holiday</option>
              </select>
            </div>
            <div class="hs-modal-footer hs-modal-footer--flat">
              <button class="hs-btn hs-btn-secondary" @click="closeEventModal">Close</button>
              <button v-if="modalMode !== 'view' || isAdmin" class="hs-btn hs-btn-primary" @click="saveEventModal">Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>

<style scoped>
.calendar-layout { display: grid; grid-template-columns: 1fr 320px; gap: var(--hs-space-4); align-items: start; }
.calendar-nav { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.event-list-scroll { max-height: calc(100vh - 400px); overflow-y: auto; }
.event-item { padding: 8px 10px; background: var(--hs-primary-bg); border: 1px solid var(--hs-primary-lighter); border-radius: var(--hs-radius-md); margin-bottom: 6px; transition: background 0.15s; }
.event-item:hover { background: var(--hs-gray-100); }
.event-item strong { font-size: var(--hs-font-size-sm); }
.cal-legend { display: flex; gap: 12px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--hs-border); flex-wrap: wrap; }
.cal-legend-item { display: flex; align-items: center; gap: 5px; font-size: var(--hs-font-size-xs); color: var(--hs-gray-600); }
.cal-legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.cal-type-badge { font-size: 10px; padding: 1px 7px; border-radius: 10px; text-transform: capitalize; font-weight: 500; white-space: nowrap; }
.cal-stat-chip { display: flex; align-items: center; gap: 5px; padding: 5px 12px; background: var(--hs-white); border: 1px solid var(--hs-border); border-radius: 20px; font-size: var(--hs-font-size-xs); font-weight: 500; color: var(--chip-color, var(--hs-gray-700)); }
.cal-stat-chip .mdi { font-size: 14px; }
@media (max-width: 900px) { .calendar-layout { grid-template-columns: 1fr; } }
.cal-stats-row { display: flex; gap: var(--hs-space-3); flex-wrap: wrap; margin-bottom: var(--hs-space-5); }
.cal-panel { padding: var(--hs-space-4); }
.cal-toolbar-group { display: flex; align-items: center; gap: var(--hs-space-2); }
.cal-year-input { width: 90px; }
.cal-month-title { font-size: var(--hs-font-size-xl); font-weight: 600; color: var(--hs-gray-800); margin-bottom: var(--hs-space-3); }
.cal-legend-dot--info { background: var(--hs-info); }
.cal-legend-dot--success { background: var(--hs-success); }
.cal-legend-dot--warning { background: var(--hs-warning); }
.cal-legend-dot--danger { background: var(--hs-danger); }
.cal-sidebar-title { font-size: var(--hs-font-size-md); font-weight: 600; margin-bottom: var(--hs-space-1); }
.cal-sidebar-count { font-size: var(--hs-font-size-base); color: var(--hs-gray-400); margin-bottom: var(--hs-space-3); }
.cal-event-header { display: flex; justify-content: space-between; align-items: start; }
.cal-event-desc { margin: 4px 0 0; font-size: var(--hs-font-size-base); color: var(--hs-gray-500); }
.cal-event-time { margin: 4px 0 0; font-size: var(--hs-font-size-sm); color: var(--hs-gray-400); }
.cal-lock-icon { margin-left: var(--hs-space-1); color: var(--hs-warning); }
.cal-no-events { color: var(--hs-gray-400); text-align: center; padding: var(--hs-space-5); font-size: var(--hs-font-size-md); }
.cal-quick-add-title { font-size: var(--hs-font-size-md); font-weight: 600; margin-bottom: var(--hs-space-3); }
.cal-quick-add-desc { font-size: var(--hs-font-size-base); color: var(--hs-gray-500); margin-bottom: var(--hs-space-2); }
</style>
