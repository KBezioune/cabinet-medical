export default function Breadcrumb({ items }) {
  return (
    <nav className="bc" aria-label="Fil d'ariane">
      {items.map((item, i) => (
        <span key={i} className="bc-wrap">
          {i > 0 && <span className="bc-sep" aria-hidden="true">›</span>}
          <span className={i === items.length - 1 ? 'bc-current' : 'bc-item'}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  )
}
