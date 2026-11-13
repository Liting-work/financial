export function PageHeader({ eyebrow, title, subtitle, aside }) {
  return (
    <section className="subpage-hero">
      <div className="subpage-copy">
        <p className="eyebrow">
          <span className="eyebrow-line" />
          {eyebrow}
        </p>
        <h1>{title}</h1>
        {subtitle && <p className="subpage-sub">{subtitle}</p>}
      </div>
      {aside && <div className="subpage-aside">{aside}</div>}
    </section>
  )
}

export function PageStats({ items }) {
  return (
    <div className="page-stat-row">
      {items.map((item) => (
        <div className="page-stat" key={item.label}>
          <span>{item.label}</span>
          <strong>
            {item.value}
            {item.unit && <em>{item.unit}</em>}
          </strong>
        </div>
      ))}
    </div>
  )
}
