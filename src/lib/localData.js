// PINs par défaut — peuvent être modifiés par l'admin via localStorage
const DEFAULT_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Imene', pin: '0503', role: 'manager',
    poste: 'Responsable médicale', phone: '+41 79 100 00 01',
    email: 'imene@cabinet-bezioune.ch', date_entree: '2021-03-15',
    taux_activite: 100, heures_hebdo: 42, type_contrat: 'CDI',
    color: '#4f8ef7',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Dessa', pin: '2002', role: 'manager',
    poste: 'Coordinatrice médicale', phone: '+41 79 100 00 02',
    email: 'dessa@cabinet-bezioune.ch', date_entree: '2020-09-01',
    taux_activite: 80, heures_hebdo: 33.6, type_contrat: 'CDI',
    color: '#8b5cf6',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Laëla', pin: '2003', role: 'assistant',
    poste: 'Assistante médicale', phone: '+41 79 100 00 03',
    email: 'laela@cabinet-bezioune.ch', date_entree: '2023-02-06',
    taux_activite: 60, heures_hebdo: 25.2, type_contrat: 'CDI',
    color: '#0891b2',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Dr. Bezioune', pin: '1234', role: 'admin',
    poste: 'Médecin généraliste', phone: '+41 79 100 00 04',
    email: 'dr.bezioune@cabinet-bezioune.ch', date_entree: '2018-01-15',
    taux_activite: 100, heures_hebdo: 50, type_contrat: 'Indépendant',
    color: '#059669',
  },
]

const getCustomPins = () => {
  try { return JSON.parse(localStorage.getItem('cabinet_pins') || '{}') }
  catch { return {} }
}

export const getUsers      = () => {
  const custom = getCustomPins()
  return DEFAULT_USERS.map(u => ({ ...u, pin: custom[u.id] ?? u.pin }))
}

export const updateUserPin = (userId, newPin) => {
  const pins = getCustomPins()
  pins[userId] = newPin
  localStorage.setItem('cabinet_pins', JSON.stringify(pins))
}

export const getAssistants = () => getUsers().filter(u => u.role === 'assistant')
export const getManagers   = () => getUsers().filter(u => u.role === 'manager')
export const getUserById   = (id) => getUsers().find(u => u.id === id)

// Helpers rôles
export const isAdmin   = (user) => user?.role === 'admin'
export const isManager = (user) => user?.role === 'manager' || user?.role === 'admin'
export const canManage = (user) => user?.role === 'manager' || user?.role === 'admin'
