// PINs par défaut — peuvent être modifiés par l'admin via localStorage
const DEFAULT_USERS = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Imene',        pin: '0503', role: 'assistant' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Dessa',        pin: '2002', role: 'assistant' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Laëla',        pin: '2003', role: 'assistant' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Dr. Bezioune', pin: '1234', role: 'admin'     },
]

const getCustomPins = () => {
  try { return JSON.parse(localStorage.getItem('cabinet_pins') || '{}') }
  catch { return {} }
}

// Retourne les utilisateurs avec les PINs potentiellement personnalisés
export const getUsers = () => {
  const custom = getCustomPins()
  return DEFAULT_USERS.map(u => ({ ...u, pin: custom[u.id] ?? u.pin }))
}

export const updateUserPin = (userId, newPin) => {
  const pins = getCustomPins()
  pins[userId] = newPin
  localStorage.setItem('cabinet_pins', JSON.stringify(pins))
}

export const getAssistants = () => getUsers().filter(u => u.role === 'assistant')
export const getUserById   = (id) => getUsers().find(u => u.id === id)
