import { useState } from 'react'
import Breadcrumb from './Breadcrumb'
import './Aide.css'

const MAPS_URL = 'https://www.google.com/maps?q=46.52627,6.58332'

const FAQ = [
  {
    q: 'Comment pointer mon arrivée et mon départ ?',
    a: "Rendez-vous dans l'onglet \"Pointage\". Cliquez sur \"Arriver\" pour enregistrer votre heure d'arrivée, puis sur \"Partir\" en fin de journée. Sur mobile, utilisez les grands boutons verts et rouges de l'écran de pointage.",
  },
  {
    q: 'Comment demander un congé ou des vacances ?',
    a: "Dans l'onglet \"Congés\", cliquez sur \"Nouvelle demande\". Choisissez le type (vacances, maladie, formation…), les dates de début et de fin, puis envoyez votre demande. Le Dr Bezioune la validera ou la refusera, et vous recevrez une notification.",
  },
  {
    q: 'Comment voir mes soldes d\'heures et de vacances ?',
    a: "L'onglet \"Mon Solde\" affiche vos jauges de solde d'heures et de vacances en temps réel. Les heures supplémentaires y sont indiquées ainsi que les jours de congé pris et restants.",
  },
  {
    q: 'Comment soumettre une note de frais ?',
    a: "Dans l'onglet \"Notes de frais\", cliquez sur \"Ajouter une note\". Renseignez la date, le montant, la catégorie (repas, transport, matériel, autre) et une description. Votre note sera soumise à validation par le Dr Bezioune.",
  },
  {
    q: "Que faire si j'ai oublié de pointer ou si l'heure est incorrecte ?",
    a: "Contactez directement le Dr Bezioune par message (onglet \"Messages\") ou par téléphone. En tant qu'administrateur, il peut modifier ou corriger un pointage depuis la page \"Pointages\".",
  },
]

export default function Aide() {
  const [open, setOpen] = useState(null)

  return (
    <div className="aide-wrap">
      <Breadcrumb items={['Cabinet Médical', 'Aide & Support']} />

      <div className="aide-grid">
        {/* Contact Dr Bezioune */}
        <div className="card aide-section">
          <h2 className="section-title">Contact</h2>
          <div className="aide-contact-card">
            <div className="aide-contact-avatar">B</div>
            <div className="aide-contact-info">
              <span className="aide-contact-name">Dr. Bezioune</span>
              <span className="aide-contact-role">Médecin généraliste · Administrateur</span>
              <a className="aide-contact-link aide-contact-tel" href="tel:+41791000004">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.89 12 19.79 19.79 0 0 1 1.84 3.37 2 2 0 0 1 3.81 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.93 5.93l.99-.99a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                +41 79 100 00 04
              </a>
              <a className="aide-contact-link aide-contact-mail" href="mailto:dr.bezioune@cabinet-bezioune.ch">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                dr.bezioune@cabinet-bezioune.ch
              </a>
            </div>
          </div>
        </div>

        {/* Info Cabinet */}
        <div className="card aide-section">
          <h2 className="section-title">Le Cabinet</h2>
          <div className="aide-cabinet">
            <div className="aide-cabinet-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="aide-cabinet-info">
              <span className="aide-cabinet-name">Centre Médical Dr Bezioune</span>
              <span className="aide-cabinet-addr">Lausanne, Vaud — Suisse</span>
              <a
                className="aide-map-link"
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                Voir sur Google Maps
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="card aide-faq-card">
        <h2 className="section-title">Questions fréquentes</h2>
        <div className="aide-faq-list">
          {FAQ.map((item, i) => (
            <div key={i} className={`aide-faq-item${open === i ? ' open' : ''}`}>
              <button
                className="aide-faq-question"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="aide-faq-num">{i + 1}</span>
                <span className="aide-faq-q-text">{item.q}</span>
                <svg
                  className="aide-faq-chevron"
                  width="16" height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d={open === i ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
                </svg>
              </button>
              {open === i && (
                <div className="aide-faq-answer">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
