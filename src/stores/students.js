import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

// const demoStudents = [
//   { id: 'demo-1', first_name: 'Иван', last_name: 'Петров', group_time: '18:00', attendance: 85, behavior: 5, performance: 5, photo_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=320&h=420&fit=crop', note: '' },
//   { id: 'demo-2', first_name: 'Александр', last_name: 'Кузнецов', group_time: '18:00', attendance: 90, behavior: 4, performance: 5, photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=320&h=420&fit=crop', note: '' },
//   { id: 'demo-3', first_name: 'Дмитрий', last_name: 'Смирнов', group_time: '18:00', attendance: 80, behavior: 5, performance: 4, photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=320&h=420&fit=crop', note: '' },
//   { id: 'demo-4', first_name: 'Максим', last_name: 'Волков', group_time: '18:00', attendance: 78, behavior: 4, performance: 4, photo_url: '', note: '' },
//   { id: 'demo-5', first_name: 'Артём', last_name: 'Соколов', group_time: '18:00', attendance: 75, behavior: 4, performance: 4, photo_url: '', note: '' },
//   { id: 'demo-6', first_name: 'Никита', last_name: 'Фёдоров', group_time: '18:00', attendance: 72, behavior: 5, performance: 3, photo_url: '', note: '' },
//   { id: 'demo-7', first_name: 'Егор', last_name: 'Иванов', group_time: '18:00', attendance: 70, behavior: 4, performance: 3, photo_url: '', note: '' },
//   { id: 'demo-8', first_name: 'Илья', last_name: 'Кузнецов', group_time: '18:00', attendance: 68, behavior: 4, performance: 3, photo_url: '', note: '' },
//   { id: 'demo-9', first_name: 'Роман', last_name: 'Павлов', group_time: '18:00', attendance: 65, behavior: 3, performance: 4, photo_url: '', note: '' },
//   { id: 'demo-10', first_name: 'Даниил', last_name: 'Соколов', group_time: '18:00', attendance: 60, behavior: 4, performance: 3, photo_url: '', note: '' }
// ]

const LOCAL_KEY = 'sambo-club-students-v1'
const score = s => Math.round((Number(s.attendance || 0) / 100) * 50 + (Number(s.behavior || 0) / 5) * 25 + (Number(s.performance || 0) / 5) * 25)

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Не удалось прочитать фотографию.'))
    reader.readAsDataURL(file)
  })
}

function persistLocalStudents(list) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)) }
  catch { throw new Error('Не удалось сохранить фото в браузере. Попробуйте изображение меньшего размера или подключите Supabase Storage.') }
}

export const useStudentsStore = defineStore('students', () => {
  const students = ref([])
  const loading = ref(false)
  const error = ref('')
  const usingDemo = ref(!isSupabaseConfigured)

  async function withPhotoUrls(rows) {
    return Promise.all((rows || []).map(async row => {
      const path = row.photo_path || ''
      if (!path || !isSupabaseConfigured) return { ...row, photo_url: row.photo_url || '' }
      const { data, error } = await supabase.storage.from('student-photos').createSignedUrl(path, 60 * 60)
      return { ...row, photo_url: error ? '' : data.signedUrl }
    }))
  }

  const ranked = computed(() => students.value
    .map(s => ({ ...s, points: score(s) }))
    .sort((a, b) => b.points - a.points || a.last_name.localeCompare(b.last_name, 'ru')))

  async function load() {
    loading.value = true
    error.value = ''
    try {
      if (!isSupabaseConfigured) {
        usingDemo.value = true
        if (!students.value.length) {
          try {
            const saved = localStorage.getItem(LOCAL_KEY)
            students.value = saved ? JSON.parse(saved) : demoStudents.map(s => ({ ...s }))
          } catch { students.value = demoStudents.map(s => ({ ...s })) }
        }
        return
      }
      const { data, error: queryError } = await supabase.from('students').select('*').order('last_name')
      if (queryError) throw queryError
      students.value = await withPhotoUrls(data || [])
      usingDemo.value = false
    } catch (e) {
      error.value = e.message || 'Не удалось загрузить данные'
      if (!students.value.length) {
        students.value = demoStudents.map(s => ({ ...s }))
        usingDemo.value = true
      }
    } finally {
      loading.value = false
    }
  }

  async function save(payload, id = null, photoFile = null) {
    let photo_path = payload.photo_path || ''
    let photo_url = payload.photo_url || ''
    if (photoFile && !isSupabaseConfigured) {
      photo_url = await fileToDataUrl(photoFile)
    }
    if (isSupabaseConfigured && photoFile) {
      const safeName = `${Date.now()}-${photoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      const { error: uploadError } = await supabase.storage.from('student-photos').upload(safeName, photoFile, { upsert: true, contentType: photoFile.type })
      if (uploadError) throw uploadError
      photo_path = safeName
      const { data, error: signedError } = await supabase.storage.from('student-photos').createSignedUrl(safeName, 60 * 60)
      if (signedError) throw signedError
      photo_url = data.signedUrl
    }
    const record = {
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      group_time: payload.group_time,
      attendance: Number(payload.attendance),
      behavior: Number(payload.behavior),
      performance: Number(payload.performance),
      photo_path,
      photo_url: isSupabaseConfigured ? '' : photo_url,
      note: payload.note?.trim() || ''
    }

    if (isSupabaseConfigured) {
      const result = id
        ? await supabase.from('students').update(record).eq('id', id).select().single()
        : await supabase.from('students').insert(record).select().single()
      if (result.error) throw result.error
      const [displayRecord] = await withPhotoUrls([result.data])
      if (id) students.value = students.value.map(s => s.id === id ? displayRecord : s)
      else students.value.push(displayRecord)
      usingDemo.value = false
    } else if (id) {
      students.value = students.value.map(s => s.id === id ? { ...s, ...record } : s)
      persistLocalStudents(students.value)
    } else {
      students.value.push({ ...record, id: `local-${Date.now()}` })
      persistLocalStudents(students.value)
    }
  }

  async function remove(id) {
    if (isSupabaseConfigured && !String(id).startsWith('demo-') && !String(id).startsWith('local-')) {
      const { error: deleteError } = await supabase.from('students').delete().eq('id', id)
      if (deleteError) throw deleteError
    }
    students.value = students.value.filter(s => s.id !== id)
    if (!isSupabaseConfigured) persistLocalStudents(students.value)
  }

  return { students, ranked, loading, error, usingDemo, load, save, remove }
})
