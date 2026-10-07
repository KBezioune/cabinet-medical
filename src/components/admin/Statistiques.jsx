import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { getUsers } from '../../lib/localData'
import { getPointagesByDateRange, getAllConges } from '../../lib/db'
import { plannedMinutesFor, worksOn, isOnApprovedLeave, computeVacances } from '../../utils/horaires'
import Breadcrumb from '../shared/Breadcrumb'
import './Statistiques.css'

const PIE_COLORS = ['#4f8ef7', '#e2e8f0']
const PRESENCE_COLOR = '#4f8ef7'
const WORKED_COLOR   = '#059669'
const PLANNED_COLOR  = '#e2e8f0'

const round1 = n => Math.round(n * 10) / 10

export default function Statistiques() {
  const now      = new Date()
  const year     = now.getFullYear()
  const month    = now.getMonth() + 1
  const users    = getUsers().filter(u => u.role !== 'admin')

  const [loading,    setLoading]    = useState(true)
  const [presence,   setPresence]   = useState([])
  const [heures,     setHeures]     = useState([])
  const [congesPie,  setCongesPie]  = useState([])
  const [globalTaux, setGlobalTaux] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const ids        = users.map(u => u.id)
        const monthStart = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd')
        const monthEnd   = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd')

        const [pointages, conges] = await Promise.all([
          getPointagesByDateRange(ids, monthStart, monthEnd),
          getAllConges(),
        ])

        // Jours écoulés du mois (jusqu'à aujourd'hui inclus)
        const today   = format(new Date(), 'yyyy-MM-dd')
        const elapsed = eachDayOfInterval({ start: new Date(year, month - 1, 1), end: new Date(year, month, 0) })
          .filter(d => format(d, 'yyyy-MM-dd') <= today)

        const perUser = users.map(u => {
          const pts = pointages.filter(p => p.user_id === u.id)
          const dueDays = elapsed.filter(d => worksOn(u.id, d) && !isOnApprovedLeave(u.id, format(d, 'yyyy-MM-dd'), conges))
          const plannedMin = dueDays.reduce((acc, d) => acc + plannedMinutesFor(u.id, d), 0)
          const workedMin  = pts.reduce((acc, p) => acc + (p.duree_minutes || 0), 0)
          const presentDays = new Set(pts.filter(p => p.heure_arrivee).map(p => p.date)).size
          return { u, plannedMin, workedMin, presentDays, dueDays: dueDays.length }
        })

        // Taux de présence : jours pointés / jours dus selon les horaires officiels
        setPresence(perUser.map(r => ({
          name: r.u.name.split(' ')[0],
          taux: r.dueDays > 0 ? Math.min(100, Math.round((r.presentDays / r.dueDays) * 100)) : 0,
          color: r.u.color,
        })))

        // Heures travaillées vs planifiées (depuis le début du mois)
        setHeures(perUser.map(r => ({
          name: r.u.name.split(' ')[0],
          travaillées: round1(r.workedMin / 60),
          planifiées:  round1(r.plannedMin / 60),
        })))

        // Congés de l'année — même calcul que Soldes / Dashboard RH
        let totalPris = 0, totalDroit = 0
        users.forEach(u => {
          const v = computeVacances(u.id, conges, year)
          totalPris  += v.consomme
          totalDroit += v.quota
        })
        setCongesPie([
          { name: 'Pris', value: totalPris },
          { name: 'Restants', value: Math.max(0, totalDroit - totalPris) },
        ])

        // Taux d'activité global : heures travaillées / heures dues
        const totPlanned = perUser.reduce((a, r) => a + r.plannedMin, 0)
        const totWorked  = perUser.reduce((a, r) => a + r.workedMin, 0)
        setGlobalTaux(totPlanned > 0 ? Math.round((totWorked / totPlanned) * 100) : 0)
      } catch (err) {
        console.error('[Statistiques]', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })

  if (loading) {
    return (
      <div className="stats-wrap">
        <Breadcrumb items={['Centre Médical Dorigny', 'Statistiques']} />
        <div className="loading-center" style={{ padding: '3rem' }}><div className="spinner" /></div>
      </div>
    )
  }

  const CustomBar = (props) => {
    const { x, y, width, height, fill, index } = props
    const user = users[index]
    return <rect x={x} y={y} width={width} height={height} fill={user?.color || fill} rx={4} />
  }

  return (
    <div className="stats-wrap">
      <Breadcrumb items={['Centre Médical Dorigny', 'Statistiques']} />

      <div className="stats-kpi-row">
        <div className="card stats-kpi">
          <span className="stats-kpi-label">Taux d'activité équipe</span>
          <span className="stats-kpi-value">{globalTaux} %</span>
          <span className="stats-kpi-sub">heures travaillées / dues · {monthLabel}</span>
        </div>
        <div className="card stats-kpi">
          <span className="stats-kpi-label">Présence moyenne</span>
          <span className="stats-kpi-value">
            {presence.length > 0
              ? Math.round(presence.reduce((a, p) => a + p.taux, 0) / presence.length)
              : 0} %
          </span>
          <span className="stats-kpi-sub">{monthLabel}</span>
        </div>
        <div className="card stats-kpi">
          <span className="stats-kpi-label">Congés pris / An</span>
          <span className="stats-kpi-value">
            {congesPie[0]?.value ?? 0} j
          </span>
          <span className="stats-kpi-sub">sur {(congesPie[0]?.value ?? 0) + (congesPie[1]?.value ?? 0)} j de droit</span>
        </div>
      </div>

      <div className="stats-charts-grid">
        {/* Taux de présence */}
        <div className="card stats-chart-card">
          <h3 className="stats-chart-title">Taux de présence — {monthLabel}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={presence} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`${v} %`, 'Présence']} />
              <Bar dataKey="taux" radius={[4, 4, 0, 0]} shape={<CustomBar />} name="Taux de présence">
                {presence.map((_, i) => (
                  <Cell key={i} fill={users[i]?.color || PRESENCE_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Heures travaillées vs planifiées */}
        <div className="card stats-chart-card">
          <h3 className="stats-chart-title">Heures travaillées vs dues — {monthLabel}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={heures} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [`${v} h`, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="planifiées" fill={PLANNED_COLOR} radius={[4, 4, 0, 0]} name="Planifiées" />
              <Bar dataKey="travaillées" fill={WORKED_COLOR} radius={[4, 4, 0, 0]} name="Travaillées" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Congés camembert */}
        <div className="card stats-chart-card stats-chart-pie">
          <h3 className="stats-chart-title">Congés équipe — {year}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={congesPie}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => value > 0 ? `${name}: ${value}j` : ''}
                labelLine={false}
              >
                {congesPie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} jours`, n]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  )
}
