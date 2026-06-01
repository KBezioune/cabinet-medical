const DEFAULT_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Imene', pin: '0503', role: 'manager',
    poste: 'Responsable médicale', phone: '+41 79 100 00 01',
    email: 'imene@horizons-medical.ch', date_entree: '2021-03-15',
    taux_activite: 100, heures_hebdo: 24, type_contrat: 'CDI',
    color: '#4f8ef7',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Dessa', pin: '2002', role: 'admin',
    badge: 'Manager · Admin',
    poste: 'Coordinatrice médicale', phone: '+41 79 100 00 02',
    email: 'dessa@horizons-medical.ch', date_entree: '2020-09-01',
    taux_activite: 80, heures_hebdo: 19.2, type_contrat: 'CDI',
    color: '#8b5cf6',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Talya', pin: '2003', role: 'assistant',
    poste: 'Assistante médicale', phone: '+41 79 100 00 03',
    email: 'talya@horizons-medical.ch', date_entree: '2023-02-06',
    taux_activite: 60, heures_hebdo: 14.4, type_contrat: 'CDI',
    color: '#0891b2',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Dr. Bezioune', pin: '1234', role: 'admin',
    badge: 'Médecin · Admin',
    poste: 'Médecin généraliste', phone: '+41 79 100 00 04',
    email: 'contact@horizons-medical.ch', date_entree: '2018-01-15',
    taux_activite: 100, heures_hebdo: 50, type_contrat: 'Indépendant',
    color: '#059669',
  },
]

const PALETTE = ['#4f8ef7','#8b5cf6','#0891b2','#059669','#f59e0b','#ef4444','#ec4899','#10b981','#f97316','#06b6d4']

// Utilisateur test secret — invisible dans toute l'UI normale
export const TEST_USER_ID = '00000000-0000-0000-0000-000000000099'
const TEST_USER = {
  id: TEST_USER_ID, name: 'Test Admin', pin: 'test2024', role: 'admin',
  poste: 'Mode test', email: '', phone: '', date_entree: '',
  color: '#dc2626', _isTestUser: true,
}

const rd = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || fallback) } catch { return JSON.parse(fallback) } }
const wr = (key, val) => localStorage.setItem(key, JSON.stringify(val))

const getCustomPins  = () => rd('cabinet_pins',         '{}')
const getUserPatches = () => rd('cabinet_user_patches', '{}')
const getDeletedIds  = () => rd('cabinet_deleted_ids',  '[]')
const getExtraUsers  = () => rd('cabinet_extra_users',  '[]')

export const getUsers = () => {
  const pins    = getCustomPins()
  const patches = getUserPatches()
  const deleted = getDeletedIds()
  const extras  = getExtraUsers()

  const apply = u => ({ ...u, ...(patches[u.id] || {}), pin: pins[u.id] ?? u.pin })

  return [
    ...DEFAULT_USERS.filter(u => !deleted.includes(u.id)).map(apply),
    ...extras.filter(u => !deleted.includes(u.id)).map(apply),
  ]
}

export const updateUserPin = (userId, newPin) => {
  const pins = getCustomPins()
  pins[userId] = newPin
  wr('cabinet_pins', pins)
}

export const addLocalUser = (user) => {
  const extras = getExtraUsers()
  extras.push(user)
  wr('cabinet_extra_users', extras)
}

export const patchLocalUser = (id, data) => {
  const { pin, ...rest } = data
  if (pin !== undefined && pin !== '') updateUserPin(id, pin)
  const patches = getUserPatches()
  patches[id] = { ...(patches[id] || {}), ...rest }
  wr('cabinet_user_patches', patches)
}

export const removeLocalUser = (id) => {
  const deleted = getDeletedIds()
  if (!deleted.includes(id)) deleted.push(id)
  wr('cabinet_deleted_ids', deleted)
  wr('cabinet_extra_users', getExtraUsers().filter(u => u.id !== id))
}

export const pickColor = (idx) => PALETTE[idx % PALETTE.length]

// Pour l'auth uniquement — inclut le test user caché
export const getUsersForAuth = () => {
  const pins = rd('cabinet_pins', '{}')
  return [...getUsers(), { ...TEST_USER, pin: pins[TEST_USER_ID] ?? TEST_USER.pin }]
}

export const getAssistants = () => getUsers().filter(u => u.role === 'assistant')
export const getManagers   = () => getUsers().filter(u => u.role === 'manager')
export const getUserById   = (id) => getUsers().find(u => u.id === id)

export const isAdmin   = (user) => user?.role === 'admin'
export const isManager = (user) => user?.role === 'manager' || user?.role === 'admin'
export const canManage = (user) => user?.role === 'manager' || user?.role === 'admin'
