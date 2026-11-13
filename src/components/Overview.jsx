import { useId, useMemo, useState } from 'react'
import { Icon } from './Icons.jsx'
import { TYPE_FILTERS, getTypeMeta } from '../lib/data.js'
import {
  compactMoney,
  formatMoney,
  formatPercent,
  formatRange,
  formatShortDateTime,
  splitMoney,
} from '../lib/format.js'

export function Hero({ meta, onRefresh, refreshing, onExport }) {
  const updated = formatShortDateTime(new Date(meta.fetchedAt).getTime())
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="eyebrow-line" />
          FINANCE OVERVIEW <span className="eyebrow-slash">/</span> 财务数据视界
        </p>
        <h1>
          报销<span className="hero-title-mark">全景</span>
        </h1>
        <p className="hero-sub">从每一笔支出，看清项目与人的行动轨迹。</p>
        <div className="hero-meta">
          <span>
            <Icon name="calendar" size={14} />
            {formatRange(meta.periodStart, meta.periodEnd)}
          </span>
          <span className="meta-dot" />
          <span>
            <strong>{meta.count.toLocaleString('zh-CN')}</strong> 笔单据
          </span>
          <span className="meta-dot" />
          <span className="hero-snapshot">实时读取 {updated}</span>
        </div>
      </div>
      <div className="hero-side">
        <div className="hero-fiscal">
          <span>FY / 2026</span>
          <strong>NOV</strong>
          <small>每刻 · 只读数据</small>
        </div>
        <div className="hero-actions">
          <button type="button" className="button button-ghost" onClick={onExport}>
            <Icon name="download" size={16} />
            导出 CSV
          </button>
          <button
            type="button"
            className={`button button-primary ${refreshing ? 'is-busy' : ''}`}
            onClick={onRefresh}
            disabled={refreshing}
          >
            <Icon name="refresh" size={16} />
            {refreshing ? '同步中…' : '刷新数据'}
          </button>
        </div>
      </div>
    </section>
  )
}

export function TypeSwitch({ forms, value, onChange, note = '指标、图表与明细同步筛选' }) {
  const counts = useMemo(() => {
    const result = { ALL: forms.length }
    for (const form of forms) {
      result[form.formSubTypeName] = (result[form.formSubTypeName] || 0) + 1
    }
    return result
  }, [forms])

  return (
    <div className="type-deck">
      <div className="type-switch" role="group" aria-label="按单据类型筛选">
        {TYPE_FILTERS.map((filter) => {
          const meta = filter.key === 'ALL' ? null : getTypeMeta(filter.key)
          const active = value === filter.key
          return (
            <button
              type="button"
              key={filter.key}
              className={`type-option ${active ? 'is-active' : ''}`}
              onClick={() => onChange(filter.key)}
              aria-pressed={active}
            >
              <span
                className="type-option-dot"
                style={{ background: meta?.color || '#D7E67C' }}
              />
              <span>{filter.label}</span>
              <em>{counts[filter.key] || 0}</em>
            </button>
          )
        })}
      </div>
      <span className="type-deck-note">
        <Icon name="layers" size={14} />
        {note}
      </span>
    </div>
  )
}

function Sparkline({ points }) {
  const id = useId().replace(/:/g, '')
  const width = 146
  const height = 42
  const max = Math.max(...points, 1)
  const count = points.length || 1
  const coords = points.map((value, index) => {
    const x = count === 1 ? width : (index / (count - 1)) * width
    const y = height - 4 - (value / max) * (height - 10)
    return [x, y]
  })
  const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const last = coords[coords.length - 1] || [width, height]
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D6ED72" stopOpacity=".34" />
          <stop offset="100%" stopColor="#D6ED72" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke="#D6ED72" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill="#D6ED72" />
    </svg>
  )
}

function CompletionRing({ value }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(Math.max(value / 100, 0), 1))
  return (
    <svg className="completion-ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={radius} fill="none" stroke="#ECE9DF" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke="#246451"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 32 32)"
      />
      <path d="m23.5 32 5.5 5.5L41 27" fill="none" stroke="#246451" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MoneyValue({ value, compact = false }) {
  const { integer, cents } = splitMoney(value)
  return (
    <span className={`money-value ${compact ? 'is-compact' : ''}`}>
      <span className="money-symbol">¥</span>
      <strong>{integer}</strong>
      <span className="money-cents">.{cents}</span>
    </span>
  )
}

export function KpiGrid({ metrics }) {
  const sparkPoints = metrics.daily.map((day) => day.amount)
  return (
    <section className="kpi-grid" aria-label="核心指标">
      <article className="kpi-card kpi-total">
        <div className="kpi-orbit kpi-orbit-one" aria-hidden="true" />
        <div className="kpi-orbit kpi-orbit-two" aria-hidden="true" />
        <div className="kpi-head">
          <span className="kpi-label">
            <i className="kpi-label-dot" />
            单据总额
          </span>
          <span className="kpi-icon kpi-icon-dark">
            <Icon name="wallet" size={18} />
          </span>
        </div>
        <p className="kpi-en">TOTAL VALUE / CNY</p>
        <div className="kpi-total-value">
          <MoneyValue value={metrics.total} />
        </div>
        <div className="kpi-total-foot">
          <div>
            <span>共 {metrics.count.toLocaleString('zh-CN')} 笔单据</span>
            <strong>覆盖全部状态</strong>
          </div>
          <Sparkline points={sparkPoints} />
        </div>
      </article>

      <article className="kpi-card">
        <div className="kpi-head">
          <span className="kpi-label">
            <i className="kpi-label-dot kpi-dot-amber" />
            待处理
          </span>
          <span className="kpi-icon">
            <Icon name="clock" size={18} />
          </span>
        </div>
        <p className="kpi-en">IN REVIEW</p>
        <div className="kpi-number-row">
          <strong className="kpi-number">{metrics.pendingCount}</strong>
          <span className="kpi-unit">笔</span>
          <span className="kpi-ratio">{formatPercent(metrics.pendingRatio)}</span>
        </div>
        <div className="kpi-progress" aria-hidden="true">
          <i style={{ width: `${Math.min(metrics.pendingRatio, 100)}%` }} />
        </div>
        <div className="kpi-foot">
          <span>待处理金额</span>
          <strong>¥{formatMoney(metrics.pendingAmount)}</strong>
        </div>
      </article>

      <article className="kpi-card">
        <div className="kpi-head">
          <span className="kpi-label">
            <i className="kpi-label-dot kpi-dot-green" />
            已完成
          </span>
          <span className="kpi-icon">
            <Icon name="check" size={18} />
          </span>
        </div>
        <p className="kpi-en">COMPLETION RATE</p>
        <div className="kpi-number-row kpi-number-with-ring">
          <div>
            <strong className="kpi-number">{metrics.completionRate.toFixed(1)}</strong>
            <span className="kpi-unit">%</span>
          </div>
          <CompletionRing value={metrics.completionRate} />
        </div>
        <div className="kpi-foot">
          <span>{metrics.completedCount} 笔已完成</span>
          <strong>{metrics.rejected} 笔驳回</strong>
        </div>
      </article>

      <article className="kpi-card">
        <div className="kpi-head">
          <span className="kpi-label">
            <i className="kpi-label-dot kpi-dot-blue" />
            笔均金额
          </span>
          <span className="kpi-icon">
            <Icon name="coins" size={18} />
          </span>
        </div>
        <p className="kpi-en">AVERAGE TICKET</p>
        <div className="kpi-average-value">
          <MoneyValue value={metrics.average} compact />
        </div>
        <div className="kpi-foot kpi-foot-stacked">
          <span>
            中位金额 <strong>¥{formatMoney(metrics.medianAmount)}</strong>
          </span>
          <span>
            最高一笔 <strong>¥{compactMoney(metrics.highest?.baseAmount || 0)}</strong>
          </span>
        </div>
      </article>
    </section>
  )
}

export function TrendPanel({ metrics }) {
  const [unit, setUnit] = useState('amount')
  const [hover, setHover] = useState(null)
  const values = metrics.daily.map((day) => (unit === 'amount' ? day.amount : day.count))
  const max = Math.max(...values, 1)
  const ticks = [1, 0.66, 0.33, 0]
  const peakIndex = values.reduce((best, value, index) => (value > values[best] ? index : best), 0)
  const activeDays = metrics.daily.filter((day) => day.count > 0).length
  const hovered = hover == null ? null : metrics.daily[hover]

  return (
    <section className="panel trend-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-eyebrow">
            <span className="eyebrow-tick" />
            FLOW / 提交节奏
          </p>
          <h2>单据提交趋势</h2>
          <p className="panel-sub">按创建日期观察单据与金额的起伏</p>
        </div>
        <div className="mini-switch" role="group" aria-label="趋势单位">
          <button
            type="button"
            className={unit === 'amount' ? 'is-active' : ''}
            onClick={() => setUnit('amount')}
          >
            金额
          </button>
          <button
            type="button"
            className={unit === 'count' ? 'is-active' : ''}
            onClick={() => setUnit('count')}
          >
            单据数
          </button>
        </div>
      </div>

      <div className="trend-chart">
        <div className="trend-y-axis">
          {ticks.map((tick) => (
            <span key={tick}>{compactMoney(max * tick, true)}</span>
          ))}
        </div>
        <div className="trend-main">
          <div className="trend-grid" aria-hidden="true">
            {ticks.map((tick) => (
              <i key={tick} />
            ))}
          </div>
          <div className="trend-bars" onMouseLeave={() => setHover(null)}>
            {metrics.daily.map((day, index) => {
              const value = unit === 'amount' ? day.amount : day.count
              const height = Math.max((value / max) * 100, 2)
              return (
                <div
                  key={day.key}
                  className={`trend-col ${hover === index ? 'is-active' : ''} ${
                    index === peakIndex ? 'is-peak' : ''
                  }`}
                  onMouseEnter={() => setHover(index)}
                >
                  <div className="trend-bar-space">
                    <div className="trend-bar" style={{ height: `${height}%` }}>
                      <span className="trend-bar-cap" />
                    </div>
                  </div>
                  {index === peakIndex && <span className="peak-notch">峰值</span>}
                </div>
              )
            })}
            {hovered && (
              <div
                className="chart-tooltip"
                style={{ left: `${((hover + 0.5) / metrics.daily.length) * 100}%` }}
              >
                <span>{hovered.label} · 创建</span>
                <strong>¥{formatMoney(hovered.amount)}</strong>
                <em>{hovered.count} 笔单据</em>
              </div>
            )}
          </div>
          <div className="trend-x-axis">
            {metrics.daily.map((day) => (
              <span key={day.key}>{day.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-foot">
        <div>
          <span>单日峰值</span>
          <strong>
            {metrics.peak?.label || '—'} <em>¥{compactMoney(metrics.peak?.amount || 0)}</em>
          </strong>
        </div>
        <div>
          <span>日均金额</span>
          <strong>¥{compactMoney(metrics.dailyAverage)}</strong>
        </div>
        <div>
          <span>有单天数</span>
          <strong>
            {activeDays}
            <em> / {metrics.daily.length} 天</em>
          </strong>
        </div>
      </div>
    </section>
  )
}

export function StatusPanel({ metrics }) {
  const [hover, setHover] = useState(null)
  const segments = metrics.statusSegments
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1
  const radius = 55
  const circumference = 2 * Math.PI * radius
  let offset = 0

  const arcs = segments.map((segment) => {
    const length = (segment.value / total) * circumference
    const dash = Math.max(length - 3, segment.value > 0 ? 1.5 : 0)
    const arc = {
      ...segment,
      dash,
      gap: circumference - dash,
      offset,
      length,
    }
    offset += length
    return arc
  })

  return (
    <section className="panel status-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-eyebrow">
            <span className="eyebrow-tick" />
            STATUS / 审批进度
          </p>
          <h2>状态构成</h2>
          <p className="panel-sub">每一张单据现在走到哪里</p>
        </div>
        <span className="panel-count">{metrics.count}</span>
      </div>

      <div className="donut-wrap">
        <svg viewBox="0 0 150 150" className="donut" aria-hidden="true">
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#F0EEE5" strokeWidth="15" />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={hover === arc.key ? 18 : 14}
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={-arc.offset}
              transform="rotate(-90 75 75)"
              className="donut-arc"
              onMouseEnter={() => setHover(arc.key)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="donut-center">
          <strong>{hover ? metrics.statusSegments.find((s) => s.key === hover)?.value : metrics.count}</strong>
          <span>{hover ? metrics.statusSegments.find((s) => s.key === hover)?.label : '全部单据'}</span>
        </div>
      </div>

      <ul className="status-legend">
        {segments.map((segment) => (
          <li
            key={segment.key}
            className={hover === segment.key ? 'is-hovered' : ''}
            onMouseEnter={() => setHover(segment.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="legend-dot" style={{ background: segment.color }} />
            <div>
              <span>{segment.label}</span>
              <em>{formatPercent(segment.percent)}</em>
            </div>
            <strong>{segment.value}</strong>
          </li>
        ))}
      </ul>

      <div className="donut-foot">
        <span>待处理金额</span>
        <strong>¥{formatMoney(metrics.pendingAmount)}</strong>
        <em>{formatPercent(metrics.pendingAmountRatio)} 占总额</em>
      </div>
    </section>
  )
}

export function OverviewPage({
  meta,
  forms,
  typeFilter,
  onTypeChange,
  metrics,
  onRefresh,
  refreshing,
  onExport,
}) {
  return (
    <div className="overview-section">
      <Hero
        meta={meta}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onExport={onExport}
      />
      <TypeSwitch forms={forms} value={typeFilter} onChange={onTypeChange} />
      <KpiGrid metrics={metrics} />
      <div className="analytics-grid">
        <TrendPanel metrics={metrics} />
        <StatusPanel metrics={metrics} />
      </div>
    </div>
  )
}
