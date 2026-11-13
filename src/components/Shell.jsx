import { Icon, BrandMark } from './Icons.jsx'
import { formatDateTime, formatRange, formatShortDateTime } from '../lib/format.js'

const NAV_ITEMS = [
  { id: 'overview', label: '数据总览', icon: 'grid' },
  { id: 'departments', label: '部门洞察', icon: 'chart' },
  { id: 'documents', label: '报销单据', icon: 'receipt', count: true },
]

export function Sidebar({
  activePage,
  onNavigate,
  onOpenRules,
  onOpenData,
  onRefresh,
  refreshing,
  meta,
  count,
  mobileOpen,
  onCloseMobile,
}) {
  const range = formatRange(meta.periodStart, meta.periodEnd)
  const updated = formatShortDateTime(new Date(meta.fetchedAt).getTime())

  return (
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="sidebar-glow" aria-hidden="true" />
      <div className="sidebar-brand-row">
        <div className="sidebar-brand">
          <BrandMark size={38} />
          <div className="sidebar-brand-copy">
            <strong>傲举财务</strong>
            <span>AUGU · FINANCE</span>
          </div>
        </div>
        <button
          type="button"
          className="icon-button sidebar-close"
          onClick={onCloseMobile}
          aria-label="关闭导航"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="sidebar-context">
        <span className="context-orb">F</span>
        <div>
          <span>当前空间</span>
          <strong>财务数据视界</strong>
        </div>
        <span className="context-chip">只读</span>
      </div>

      <nav className="sidebar-nav" aria-label="主导航">
        <p className="nav-caption">工作台</p>
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'is-active' : ''}`}
            onClick={() => {
              onNavigate(item.id)
              onCloseMobile()
            }}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            {item.count ? <em>{count}</em> : <i />}
          </button>
        ))}

        <p className="nav-caption nav-caption-spaced">参考</p>
        <button type="button" className="nav-item" onClick={onOpenRules}>
          <Icon name="book" size={18} />
          <span>报销标准</span>
          <i />
        </button>
        <button type="button" className="nav-item" onClick={onOpenData}>
          <Icon name="database" size={18} />
          <span>数据说明</span>
          <i />
        </button>
      </nav>

      <div className="sidebar-spacer" />

      <div className="sync-card">
        <div className="sync-card-head">
          <span className="sync-state">
            <i />
            实时数据已同步
          </span>
          <span className="sync-id">MK · 01</span>
        </div>
        <p>{range}</p>
        <div className="sync-meta">
          <span>{count.toLocaleString('zh-CN')} 笔单据</span>
          <span>{updated}</span>
        </div>
        <button
          type="button"
          className={`sync-button ${refreshing ? 'is-busy' : ''}`}
          onClick={onRefresh}
          disabled={refreshing}
        >
          <Icon name="refresh" size={15} />
          {refreshing ? '正在同步…' : '同步最新数据'}
        </button>
      </div>

      <div className="sidebar-footer">
        <span>
          <Icon name="shield" size={14} /> READ ONLY
        </span>
        <small>v1.0</small>
      </div>
    </aside>
  )
}

export function Topbar({ meta, pageLabel = '数据总览', onOpenMobile, dataModal }) {
  const updated = formatDateTime(new Date(meta.fetchedAt).getTime())
  const range = formatRange(meta.periodStart, meta.periodEnd)
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-button menu-button"
          onClick={onOpenMobile}
          aria-label="打开导航"
        >
          <Icon name="menu" size={20} />
        </button>
        <div className="crumbs">
          <span>财务中心</span>
          <Icon name="chevronRight" size={12} />
          <strong>{pageLabel}</strong>
        </div>
        <span className="topbar-divider" />
        <span className="topbar-range">
          <Icon name="calendar" size={14} />
          {range}
        </span>
      </div>
      <div className="topbar-right">
        <button type="button" className="readonly-pill" onClick={dataModal}>
          <span className="live-dot" />
          实时只读
        </button>
        <span className="as-of">截至 {updated}</span>
      </div>
    </header>
  )
}

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-brand">
        <BrandMark size={48} />
        <div>
          <strong>傲举财务</strong>
          <span>数据正在路上</span>
        </div>
      </div>
      <div className="loading-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="loading-copy">正在从每刻读取实时数据…</p>
      <div className="loading-lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  )
}

export function ErrorScreen({ message, onRetry }) {
  return (
    <div className="loading-screen error-screen">
      <BrandMark size={48} />
      <p className="error-kicker">DATA UNAVAILABLE</p>
      <h2>数据暂时没有连接上</h2>
      <p className="loading-copy">{message || '请确认本地数据服务已经启动。'}</p>
      <button type="button" className="button button-primary" onClick={onRetry}>
        <Icon name="refresh" size={16} />
        重新加载
      </button>
      <div className="error-hint">
        看板不保存业务数据，请检查每刻接口与 <code>key.json</code> 配置。
      </div>
    </div>
  )
}
