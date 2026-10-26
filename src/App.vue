<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  Plus, X, Trophy, Users, Search, Camera, ShieldCheck, HeartHandshake,
  Award, ChevronDown, Medal, Dumbbell, Check, Pencil, Trash2, AlertCircle, LogOut, LockKeyhole
} from 'lucide-vue-next'
import { useStudentsStore } from './stores/students'
import { supabase as supabaseClient } from './lib/supabase'

const store = useStudentsStore()
const session = ref(null)
const authReady = ref(false)
const authEmail = ref('')
const authPassword = ref('')
const authError = ref('')
const authBusy = ref(false)
const selectedGroup = ref('18:00')
const search = ref('')
const modalOpen = ref(false)
const editingId = ref(null)
const activeTab = ref('main')
const photoFile = ref(null)
const photoPreview = ref('')
const saving = ref(false)
const formError = ref('')
const notice = ref('')

const blankForm = () => ({
  first_name: '', last_name: '', group_time: selectedGroup.value,
  attendance: 85, behavior: 5, performance: 4, photo_url: '', note: ''
})
const form = ref(blankForm())

const groupStudents = computed(() => store.ranked.filter(s => s.group_time === selectedGroup.value))
const leaders = computed(() => groupStudents.value.slice(0, 3))
const filteredRanked = computed(() => groupStudents.value.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.value.toLowerCase())))
const totalStudents = computed(() => groupStudents.value.length)
const averageAttendance = computed(() => totalStudents.value ? Math.round(groupStudents.value.reduce((sum, s) => sum + Number(s.attendance || 0), 0) / totalStudents.value) : 0)

function openAdd() {
  editingId.value = null
  form.value = blankForm()
  photoFile.value = null
  photoPreview.value = ''
  activeTab.value = 'main'
  formError.value = ''
  modalOpen.value = true
}
function openEdit(student) {
  editingId.value = student.id
  form.value = { ...blankForm(), ...student }
  photoFile.value = null
  photoPreview.value = student.photo_url || ''
  activeTab.value = 'main'
  formError.value = ''
  modalOpen.value = true
}
function choosePhoto(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { formError.value = 'Выберите файл изображения.'; return }
  if (file.size > 5 * 1024 * 1024) { formError.value = 'Размер фото не должен превышать 5 МБ.'; return }
  photoFile.value = file
  photoPreview.value = URL.createObjectURL(file)
}
async function signIn() {
  authError.value = ''
  if (!supabaseClient) { authError.value = 'Сначала настройте переменные Supabase в файле .env.'; return }
  authBusy.value = true
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: authEmail.value.trim(), password: authPassword.value })
    if (error) throw error
    session.value = data.session
    await store.load()
  } catch (e) { authError.value = 'Не удалось войти. Проверьте email и пароль тренера.' }
  finally { authBusy.value = false }
}
async function signOut() {
  if (supabaseClient) await supabaseClient.auth.signOut()
  session.value = null
  store.students = []
}
async function saveStudent() {
  formError.value = ''
  if (!form.value.first_name.trim() || !form.value.last_name.trim()) {
    formError.value = 'Укажите имя и фамилию ученика.'
    activeTab.value = 'main'
    return
  }
  saving.value = true
  try {
    await store.save(form.value, editingId.value, photoFile.value)
    modalOpen.value = false
    notice.value = editingId.value ? 'Данные ученика обновлены' : 'Ученик добавлен в группу'
    setTimeout(() => notice.value = '', 3000)
  } catch (e) {
    formError.value = e.message || 'Не удалось сохранить ученика. Проверьте настройки Supabase.'
  } finally {
    saving.value = false
  }
}
async function deleteStudent(student) {
  if (!confirm(`Удалить ученика ${student.first_name} ${student.last_name}?`)) return
  try {
    await store.remove(student.id)
    notice.value = 'Ученик удалён'
    setTimeout(() => notice.value = '', 3000)
  } catch (e) {
    notice.value = `Ошибка удаления: ${e.message}`
    setTimeout(() => notice.value = '', 4000)
  }
}
function points(s) {
  return Math.round((Number(s.attendance || 0) / 100) * 50 + (Number(s.behavior || 0) / 5) * 25 + (Number(s.performance || 0) / 5) * 25)
}
function initials(s) {
  return `${s.first_name?.[0] || ''}${s.last_name?.[0] || ''}`.toUpperCase()
}
onMounted(async () => {
  if (!supabaseClient) { authReady.value = true; authError.value = 'Supabase не настроен. Заполните .env, чтобы включить защищённый вход.'; return }
  const { data } = await supabaseClient.auth.getSession()
  session.value = data.session
  supabaseClient.auth.onAuthStateChange((_event, nextSession) => { session.value = nextSession })
  authReady.value = true
  if (session.value) await store.load()
})
</script>

<template>
  <div v-if="!authReady" class="auth-screen"><div class="auth-card"><div class="auth-mark"><Dumbbell :size="34" /></div><h1>САМБО</h1><p>Проверяем защищённое подключение…</p></div></div>
  <div v-else-if="!session" class="auth-screen"><form class="auth-card" @submit.prevent="signIn"><div class="auth-mark"><LockKeyhole :size="34" /></div><h1>Вход тренера</h1><p>Панель управления спортивным клубом</p><label>Email тренера<input v-model="authEmail" type="email" autocomplete="username" placeholder="coach@example.com" required /></label><label>Пароль<input v-model="authPassword" type="password" autocomplete="current-password" placeholder="Введите пароль" required /></label><div v-if="authError" class="auth-error">{{ authError }}</div><button class="primary-button auth-submit" type="submit" :disabled="authBusy">{{ authBusy ? 'Входим…' : 'Войти в панель' }}</button><small>Доступ только для созданных администратором учётных записей.</small></form></div>
  <div v-else class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark"><Dumbbell :size="30" stroke-width="2.5" /></div>
        <div class="brand-copy"><strong>САМБО</strong><span>СПОРТИВНЫЙ КЛУБ</span></div>
      </div>
      <div class="header-motto">СИЛА <i>✦</i> ХАРАКТЕР <i>✦</i> ПОБЕДА</div>
      <div class="group-picker">
        <span>Выбор группы</span>
        <div class="group-buttons">
          <button v-for="time in ['18:00','19:00','20:00']" :key="time" :class="{ active: selectedGroup === time }" @click="selectedGroup = time">
            {{ time }}
          </button>
        </div>
      </div>
      <button class="coach coach-logout" @click="signOut" title="Выйти из аккаунта"><span class="coach-avatar">Т</span><span>Тренер</span><LogOut :size="15" /></button>
    </header>

    <main class="dashboard">
      <section class="main-column">
        <div class="section-heading">
          <div class="heading-icon"><Trophy :size="25" /></div>
          <div class="heading-copy"><h1>Лучшие <em>спортсмены</em></h1><p>Рейтинг группы — {{ selectedGroup }}</p></div>
          <button class="primary-button add-top" @click="openAdd"><Plus :size="19" /> Добавить ученика</button>
        </div>

        <div v-if="store.usingDemo" class="demo-note"><AlertCircle :size="15" /> Демонстрационные данные. Подключите Supabase, чтобы сохранять учеников в облаке.</div>
        <div v-if="store.error" class="error-note">{{ store.error }}</div>

        <div class="leaders">
          <article v-for="(student, index) in leaders" :key="student.id" class="leader-card" :class="`place-${index + 1}`">
            <div class="place-badge"><Medal :size="23" /><b>{{ index + 1 }}</b></div>
            <img v-if="student.photo_url" :src="student.photo_url" :alt="`${student.first_name} ${student.last_name}`" class="leader-photo" />
            <div v-else class="leader-placeholder"><span>{{ initials(student) }}</span><small>ФОТО СПОРТСМЕНА</small></div>
            <div class="leader-info">
              <h2>{{ student.first_name }} {{ student.last_name }}</h2>
              <p><span>{{ index + 1 }}</span> место</p>
              <div class="leader-score">{{ points(student) }} <small>ОЧКОВ</small></div>
            </div>
            <div class="leader-actions">
              <button title="Редактировать" @click="openEdit(student)"><Pencil :size="14" /></button>
              <button title="Удалить" @click="deleteStudent(student)"><Trash2 :size="14" /></button>
            </div>
          </article>
          <div v-if="!leaders.length" class="empty-leaders">В этой группе пока нет учеников.<br />Нажмите «Добавить ученика», чтобы начать.</div>
        </div>

        <section class="stats-panel">
          <div class="stats-main"><div class="star-shield">★</div><div><strong>Общий рейтинг группы</strong><p><b>{{ totalStudents }}</b> учеников</p></div></div>
          <div class="stat"><ShieldCheck /><span>Посещаемость</span><strong>{{ averageAttendance }}<small>%</small></strong></div>
          <div class="stat"><HeartHandshake /><span>Поведение</span><strong>25<small> баллов</small></strong></div>
          <div class="stat"><Award /><span>Успеваемость</span><strong>25<small> баллов</small></strong></div>
          <div class="stats-foot">Итоговые очки = Посещаемость + Поведение + Успеваемость</div>
        </section>

        <section class="motto-banner">
          <div><strong>САМБО — ЭТО НЕ ПРОСТО СПОРТ,</strong><em>ЭТО ОБРАЗ ЖИЗНИ!</em></div>
          <Dumbbell :size="78" />
        </section>
      </section>

      <aside class="ranking-panel">
        <div class="ranking-title"><Users :size="22" /><strong>Рейтинг группы</strong><span>Все ученики</span></div>
        <label class="search-box"><Search :size="16" /><input v-model="search" placeholder="Поиск по имени..." /></label>
        <div class="table-head"><span>#</span><span>Ученик</span><span>Очки</span></div>
        <div class="ranking-list">
          <div v-for="(student, index) in filteredRanked" :key="student.id" class="ranking-row">
            <span class="rank-number" :class="{ gold: index === 0, bronze: index === 2 }">{{ groupStudents.findIndex(s => s.id === student.id) + 1 }}</span>
            <img v-if="student.photo_url" :src="student.photo_url" class="avatar" :alt="initials(student)" />
            <div v-else class="avatar avatar-placeholder">{{ initials(student) }}</div>
            <div class="row-person"><strong>{{ student.first_name }} {{ student.last_name }}</strong><div class="progress"><span :style="{ width: `${points(student)}%` }"></span></div></div>
            <strong class="row-points">{{ points(student) }}</strong>
            <div class="row-actions"><button title="Редактировать" @click="openEdit(student)"><Pencil :size="13" /></button><button title="Удалить" @click="deleteStudent(student)"><Trash2 :size="13" /></button></div>
          </div>
          <div v-if="!filteredRanked.length" class="no-results">Ученики не найдены</div>
        </div>
      </aside>
    </main>

    <div v-if="notice" class="toast"><Check :size="17" /> {{ notice }}</div>

    <Transition name="modal">
      <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false" @keydown.esc="modalOpen = false">
        <section class="student-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <header class="modal-header"><div class="modal-icon"><Plus :size="23" /></div><h2 id="modal-title">{{ editingId ? 'Редактировать ученика' : 'Добавить ученика' }}</h2><button class="icon-button" @click="modalOpen = false" aria-label="Закрыть"><X /></button></header>
          <div class="modal-tabs"><button :class="{ selected: activeTab === 'main' }" @click="activeTab = 'main'">Основная информация</button><button :class="{ selected: activeTab === 'scores' }" @click="activeTab = 'scores'">Показатели</button></div>
          <form @submit.prevent="saveStudent">
            <div v-show="activeTab === 'main'" class="modal-body">
              <div class="photo-and-name">
                <label class="photo-upload">
                  <img v-if="photoPreview" :src="photoPreview" alt="Предпросмотр фотографии" />
                  <template v-else><Camera :size="29" /><strong>Загрузить фото</strong><small>JPG, PNG (до 5 МБ)</small></template>
                  <input type="file" accept="image/*" @change="choosePhoto" />
                </label>
                <div class="name-fields">
                  <label>Имя <b>*</b><input v-model="form.first_name" placeholder="Введите имя" required maxlength="80" /></label>
                  <label>Фамилия <b>*</b><input v-model="form.last_name" placeholder="Введите фамилию" required maxlength="80" /></label>
                </div>
              </div>
              <label class="field-label">Группа<select v-model="form.group_time"><option>18:00</option><option>19:00</option><option>20:00</option></select></label>
            </div>
            <div v-show="activeTab === 'scores'" class="modal-body score-body">
              <div class="score-cards">
                <label class="score-card"><span>Посещаемость</span><strong>{{ form.attendance }}%</strong><input v-model.number="form.attendance" type="range" min="0" max="100" step="5" /></label>
                <label class="score-card"><span>Поведение</span><strong>{{ form.behavior }}/5</strong><input v-model.number="form.behavior" type="range" min="1" max="5" step="1" /></label>
                <label class="score-card"><span>Успеваемость</span><strong>{{ form.performance }}/5</strong><input v-model.number="form.performance" type="range" min="1" max="5" step="1" /></label>
              </div>
              <div class="score-preview"><span>Предварительный рейтинг</span><strong>{{ points(form) }} <small>очков из 100</small></strong></div>
            </div>
            <div class="modal-body note-body"><label class="field-label">Примечание <small>(необязательно)</small><textarea v-model="form.note" rows="3" placeholder="Дополнительная информация..."></textarea></label></div>
            <p v-if="formError" class="form-error">{{ formError }}</p>
            <footer class="modal-footer"><button type="button" class="secondary-button" @click="modalOpen = false">Отмена</button><button type="submit" class="primary-button" :disabled="saving">{{ saving ? 'Сохранение...' : 'Сохранить' }}</button></footer>
          </form>
        </section>
      </div>
    </Transition>
  </div>
</template>
