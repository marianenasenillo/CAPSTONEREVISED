<script setup>
import DashboardView from '@/components/DashboardView.vue';
import { DayPilot, DayPilotMonth } from '@daypilot/daypilot-lite-vue'
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/utils/supabase'

const monthRef = ref(null)
const startDate = ref("2026-10-01")
const currentMonth = ref(1) 
const currentYear = ref(2026)
const events = ref([])
const showEventModal = ref(false)
const modalMode = ref('add') // 'add' or 'edit'
const modalEvent = ref({ text: '', description: '', start: '', end: '' })
// role-based
const isAdmin = ref(false)

const colors = {
  event: "#3c78d8",
  task: "#6aa84f",
  reminder: "#f1c232",
  holiday: "#cc0000",
}

// Persist moves/resizes to DB
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
    // only admins can create events
    await DayPilot.Modal.alert('Only Admin users can add events.')
    args.control.clearSelection()
    return
  }
  openAddEventModal(args.start, args.end)
  args.control.clearSelection()
}

const onEventClicked = async (args) => {
  // show editable modal to admins, read-only view to non-admins
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
      alert('Only Admin can save events.')
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
    alert('Failed to save event: ' + (err.message || err))
  }
}


const onBeforeEventRender = (args) => {
  const color = colors[args.data.type] || "#3c78d8"
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
    args.data.clickDisabled = false // allow click to view details
    args.data.deleteDisabled = true
  }
}

// --- CONTEXT MENU ---
// Context menus: admin gets full menu, viewers get read-only view
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

// --- HELPERS ---
const editEvent = async (e) => {
  if (!isAdmin.value) {
    await DayPilot.Modal.alert('Only Admin can edit events.')
    return
  }
  const form = [
    { name: "Title", id: "text" },
    { name: "Description", id: "description" }
  ]
  const modal = await DayPilot.Modal.form(form, e.data)
  if (modal.canceled) return
  monthRef.value.control.events.update(modal.result)
  // persist change to DB
  try {
    const id = modal.result.id || e.data.id
    await supabase.from('events').update({ text: modal.result.text, description: modal.result.description }).eq('id', id)
  } catch (err) {
    console.error('Failed to persist editEvent', err)
    // optionally reload events or show an alert
  }
}

const deleteEvent = async (e) => {
  const modal = await DayPilot.Modal.confirm("Do you really want to delete this event?")
  if (modal.canceled) return
  try {
    if (!isAdmin.value) {
      alert('Only Admin can delete events.')
      return
    }
    const { error } = await supabase.from('events').delete().eq('id', e.data.id)
    if (error) throw error
    monthRef.value.control.events.remove(e)
  } catch (err) {
    console.error('Failed to delete event', err)
    alert('Failed to delete event: ' + (err.message || err))
  }
}

const duplicateEvent = async (e) => {
  try {
    if (!isAdmin.value) {
      alert('Only Admin can duplicate events.')
      return
    }
    // create server-side so id is generated by DB
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
    alert('Failed to duplicate event: ' + (err.message || err))
  }
}

const postponeEvent = async (e) => {
  try {
    if (!isAdmin.value) {
      alert('Only Admin can postpone events.')
      return
    }
    e.data.start = e.start().addDays(1)
    e.data.end = e.end().addDays(1)
    monthRef.value.control.events.update(e)
    // persist
    const id = e.data.id
    if (id) await supabase.from('events').update({ start: e.data.start, end: e.data.end }).eq('id', id)
  } catch (err) {
    console.error('Failed to postpone event', err)
    alert('Failed to postpone event: ' + (err.message || err))
  }
}

const updateEventType = async (e, type) => {
  try {
    if (!isAdmin.value) {
      alert('Only Admin can change event type.')
      return
    }
    e.data.type = type
    monthRef.value.control.events.update(e)
    const id = e.data.id
    if (id) await supabase.from('events').update({ type }).eq('id', id)
  } catch (err) {
    console.error('Failed to update event type', err)
    alert('Failed to update event type: ' + (err.message || err))
  }
}

const toggleEventLock = async (e) => {
  try {
    if (!isAdmin.value) {
      alert('Only Admin can lock/unlock events.')
      return
    }
    e.data.locked = !e.data.locked
    monthRef.value.control.events.update(e)
    const id = e.data.id
    if (id) await supabase.from('events').update({ locked: e.data.locked }).eq('id', id)
  } catch (err) {
    console.error('Failed to toggle event lock', err)
    alert('Failed to toggle lock: ' + (err.message || err))
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

const eventList = computed(() => events.value)

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
  try {
    // fetch current user and set role
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
  <DashboardView>
    <div class="calendar-bg gap-4">
      <div class="calendar-box" style="height: 70vh;">
        <!-- Calendar Navigation -->
        <div class="calendar-nav">
          <button @click="previousMonth" class="nav-btn">&larr;</button>
          <div class="month-year-display">
            <select v-model="currentMonth" @change="updateStartDate" class="month-select">
              <option v-for="(month, index) in monthNames" :key="index" :value="index + 1">
                {{ month }}
              </option>
            </select>
            <input v-model.number="currentYear" @change="updateStartDate" type="number" class="year-input" min="2000" max="2030">
          </div>
          <button @click="nextMonth" class="nav-btn">&rarr;</button>
        </div>

        <DayPilotMonth
          ref="monthRef"
          :startDate="startDate"
          :eventHeight="37"   
          :cellHeight="70"    
          :events="events"
          :contextMenu="contextMenu"
          @eventMoved="onEventMoved"
          @eventResized="onEventResized"
          @eventClicked="onEventClicked"
          @timeRangeSelected="onTimeRangeSelected"
          @beforeEventRender="onBeforeEventRender"
        />
      </div>

      <!-- Event list sidebar -->
      <div class="event-list-container" style="height: 70vh;" ref="scrollContainer">
        <h3>Events</h3>
        <div class="event-list-scroll">
          <div v-for="event in eventList" :key="event.id" class="event-item" :style="{ borderLeft: '6px solid ' + (colors[event.type] || '#3c78d8') }">
            <strong :style="{ color: colors[event.type] || '#3c78d8' }">{{ event.text }}</strong><br/>
            <span>{{ event.description }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modern Event Modal -->
    <div v-if="showEventModal" class="modal-overlay">
      <div class="modal-content">
        <button class="modal-close" @click="closeEventModal">&times;</button>
        <h3>
          {{ modalMode === 'add' ? 'Add Event' : (modalMode === 'view' ? 'Event Details' : 'Edit Event') }}
        </h3>
        <label>
          Title:
          <input v-model="modalEvent.text" placeholder="Event Title" :disabled="modalMode === 'view' || !isAdmin" />
        </label>
        <label>
          Description:
          <textarea v-model="modalEvent.description" placeholder="Description" :disabled="modalMode === 'view' || !isAdmin"></textarea>
        </label>
        <div class="modal-actions">
          <button v-if="isAdmin && modalMode !== 'view'" @click="saveEventModal">{{ modalMode === 'add' ? 'Add' : 'Save' }}</button>
          <button @click="closeEventModal">Close</button>
        </div>
      </div>
    </div>
  </DashboardView>
</template>

<style>
.calendar-bg {
  background: url('/images/health.jpg') no-repeat center center;
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


.calendar-box {
  width: 1000px;
  height: 450px; /* fixed height */
  padding: 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%);
  box-shadow: 0 12px 32px rgba(30,41,59,0.13), 0 1.5px 6px rgba(30,41,59,0.10);
  border: 1px solid #e2e8f0;
  font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
  overflow: auto; /* scrolls if content exceeds */
  display: flex;
  flex-direction: column;
}

.calendar-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px 0;
  border-bottom: 1px solid #e2e8f0;
}

.nav-btn {
  background: #3c78d8;
  color: white;
  border: none;
  border-radius: 6px;
  width: 35px;
  height: 35px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}

.nav-btn:hover {
  background: #2c5aa0;
}

.month-year-display {
  display: flex;
  align-items: center;
  gap: 10px;
}

.month-select {
  padding: 5px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 16px;
  font-weight: 600;
  color: #334155;
}

.year-input {
  padding: 5px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 16px;
  font-weight: 600;
  color: #334155;
  width: 80px;
  text-align: center;
}

.event-list-container {
  width: 400px;
  height: 450px; /* fixed height */
  padding: 20px;
  border-radius: 12px;
   background: linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%);
  box-shadow: 0 12px 32px rgba(30,41,59,0.10), 0 1.5px 6px rgba(30,41,59,0.08);
  border: 1px solid #e2e8f0;
  font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* prevents stretching */
}

.event-list-container h3 {
  font-size: 1.3rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 1.2rem;
  letter-spacing: 0.5px;
}

.event-list-scroll {
  flex: 1;
  overflow-y: auto; /* makes event list scrollable */
}

.event-item {
  margin-bottom: 1rem;
  padding: 12px 10px;
  border-radius: 12px;
  border-bottom: none;
  background: #f1f5f9;
  box-shadow: 0 2px 8px rgba(30,41,59,0.04);
  transition: box-shadow 0.2s, background 0.2s;
}

.event-item:hover {
  background: #e0e7ef;
  box-shadow: 0 4px 16px rgba(30,41,59,0.08);
}

.event-item strong {
  font-size: 1.08rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.event-item span {
  color: #64748b;
  font-size: 0.98rem;
}

.month_default_event_inner {
  border-radius: 18px;
  padding-left: 25px;
  font-size: 1rem;
  font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
  background: #f1f5f9;
  box-shadow: 0 2px 8px rgba(30,41,59,0.07);
}

.month_default_event_bar_inner {
  width: 20px;
  border-radius: 16px;
  box-shadow: 0 1px 4px rgba(30,41,59,0.10);
}

/* Optional: subtle hover effect for calendar events */
.month_default_event:hover .month_default_event_inner {
  background: #e0e7ef;
  box-shadow: 0 4px 16px rgba(30,41,59,0.10);
}

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(30, 41, 59, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.modal-content {
  background: linear-gradient(135deg, #f8fafc 0%, #e6f4ea 100%);
  border-radius: 18px;
  min-width: 320px;
  max-width: 95vw;
  width: 100%;
  box-shadow: 0 12px 32px rgba(30,41,59,0.18), 0 1.5px 6px rgba(30,41,59,0.10);
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
  position: relative;
  animation: modalPop 0.3s;
}
@keyframes modalPop {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.modal-content h3 {
  font-size: 1.35rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 0.5rem;
}
.modal-content label {
  display: flex;
  flex-direction: column;
  font-size: 1rem;
  color: #475569;
  gap: 0.3rem;
}
.modal-content input,
.modal-content textarea {
  padding: 0.6rem 1rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-size: 1rem;
  background: #f1f5f9;
  transition: border 0.2s;
  outline: none;
}
.modal-content input:focus,
.modal-content textarea:focus {
  border: 1.5px solid #5b841e;
  background: #fff;
}
.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}
.modal-actions button {
  padding: 0.6rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.modal-actions button:first-child {
  background: #5b841e;
  color: #fff;
}
.modal-actions button:last-child {
  background: #e2e8f0;
  color: #334155;
}
.modal-actions button:hover {
  opacity: 0.85;
}
.modal-close {
  position: absolute;
  top: 1.2rem;
  right: 1.2rem;
  font-size: 1.3rem;
  color: #64748b;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}
.modal-close:hover {
  color: #5b841e;
}
@media (min-width: 500px) {
  .modal-content {
    max-width: 400px;
  }
}
</style>
