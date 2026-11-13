import { useMemo } from 'react'
import { Icon } from './Icons.jsx'
import { getStatusMeta, getTypeMeta } from '../lib/data.js'
import {
  avatarStyle,
  formatMoney,
  formatShortDateTime,
  initials,
} from '../lib/format.js'

const PAGE_SIZE = 10

function buildPageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const items = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('left-ellipsis')
  for (let page = start; page <= end; page++) items.push(page)
  if (end < total - 1) items.push('right-ellipsis')
  items.push(total)
  return items
}

export function FormsTable({
  forms,
  totalForms,
  query,
  onQueryChange,
  statusFilter,
  statusCounts,
  pendingCount = 0,
  onStatusChange,
  departmentFilter,
  departments,
  onDepartmentChange,
  sort,
  onSortChange,
  page,
  onPageChange,
  onOpenForm,
  onResetFilters,
  hasFilters,
  activeTypeLabel,
}) {
  const total = forms.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const rows = useMemo(
    () => forms.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [forms, safePage],
  )
  const startItem = total ? (safePage - 1) * PAGE_SIZE + 1 : 0
  const endItem = Math.min(safePage * PAGE_SIZE, total)
  const pageItems = buildPageItems(safePage, totalPages)
  const visibleStatuses = useMemo(() => {
    const order = ['APPROVING', 'COMPLETED', 'SETTLEMENT', 'REJECTED', 'DRAFT', 'ABANDON']
    const statuses = order
      .map((key) => ({ key, ...getStatusMeta(key), count: statusCounts[key] || 0 }))
      .filter((item) => item.count > 0)
    if (pendingCount > 0) {
      statuses.unshift({ key: 'PENDING', label: '待处理', color: '#D9A241', count: pendingCount })
    }
    return statuses
  }, [statusCounts, pendingCount])

  return (
    <section className="table-panel">
      <div className="table-head">
        <div>
          <p className="panel-eyebrow">
            <span className="eyebrow-tick" />
            LEDGER / 报销单据
          </p>
          <div className="table-title-row">
            <h2>单据明细</h2>
            <span className="table-count">{total.toLocaleString('zh-CN')}</span>
            <span className="table-scope">{activeTypeLabel}</span>
          </div>
        </div>
        <div className="table-tools">
          <label className="search-box">
            <Icon name="search" size={17} />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索单号、姓名或项目"
              aria-label="搜索单据"
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => onQueryChange('')}
                aria-label="清空搜索"
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </label>
          <label className="select-box select-box-dept">
            <Icon name="building" size={15} />
            <select
              value={departmentFilter}
              onChange={(event) => onDepartmentChange(event.target.value)}
              aria-label="按部门筛选"
            >
              <option value="ALL">全部部门</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={14} className="select-chevron" />
          </label>
          <label className="select-box select-box-sort">
            <Icon name="filterList" size={15} />
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value)}
              aria-label="单据排序"
            >
              <option value="newest">最新提交</option>
              <option value="oldest">等待最久</option>
              <option value="amount-desc">金额 · 高到低</option>
              <option value="amount-asc">金额 · 低到高</option>
            </select>
            <Icon name="chevronDown" size={14} className="select-chevron" />
          </label>
        </div>
      </div>

      <div className="status-bar">
        <div className="status-tabs" role="group" aria-label="按状态筛选">
          <button
            type="button"
            className={`status-tab ${statusFilter === 'ALL' ? 'is-active' : ''}`}
            onClick={() => onStatusChange('ALL')}
          >
            全部 <em>{totalForms}</em>
          </button>
          {visibleStatuses.map((status) => (
            <button
              type="button"
              key={status.key}
              className={`status-tab ${statusFilter === status.key ? 'is-active' : ''}`}
              onClick={() => onStatusChange(status.key)}
            >
              <i style={{ background: status.color }} />
              {status.label} <em>{status.count}</em>
            </button>
          ))}
        </div>
        {hasFilters && (
          <button type="button" className="reset-filters" onClick={onResetFilters}>
            <Icon name="close" size={13} />
            清除筛选
          </button>
        )}
      </div>

      <div className="table-scroll">
        <table className="forms-table">
          <thead>
            <tr>
              <th>单据编号</th>
              <th>报销人 / 部门</th>
              <th>项目 / 事由</th>
              <th>单据类型</th>
              <th className="align-right">金额</th>
              <th>状态</th>
              <th>提交时间</th>
              <th>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((form) => {
              const status = getStatusMeta(form.formStatus)
              const type = getTypeMeta(form.formSubTypeName)
              return (
                <tr
                  key={form.formCode}
                  className="form-row"
                  tabIndex={0}
                  onClick={() => onOpenForm(form)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onOpenForm(form)
                    }
                  }}
                  aria-label={`查看单据 ${form.formCode}`}
                >
                  <td>
                    <span className="form-code">{form.formCode}</span>
                  </td>
                  <td>
                    <div className="person-cell">
                      <span className="avatar" style={avatarStyle(form.coverEmployeeName)}>
                        {initials(form.coverEmployeeName)}
                      </span>
                      <div>
                        <strong>{form.coverEmployeeName}</strong>
                        <span>{form.departmentName}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="project-cell" title={form.formName}>
                      {form.formName}
                    </span>
                  </td>
                  <td>
                    <span
                      className="type-badge"
                      style={{ color: type.color, background: type.bg }}
                    >
                      <i style={{ background: type.color }} />
                      {type.label}
                    </span>
                  </td>
                  <td className="align-right">
                    <span className="amount-cell">
                      <span>¥</span>
                      {formatMoney(form.baseAmount)}
                    </span>
                  </td>
                  <td>
                    <span className={`status-chip status-${status.tone}`}>
                      <i style={{ background: status.color }} />
                      {status.label}
                    </span>
                  </td>
                  <td>
                    <span className="time-cell">{formatShortDateTime(form.submittedAt || form.createdAt)}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="row-action"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenForm(form)
                      }}
                      aria-label={`查看 ${form.formCode} 详情`}
                    >
                      <Icon name="arrowUpRight" size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="table-empty">
            <span className="empty-mark">
              <Icon name="search" size={24} />
            </span>
            <strong>没有找到匹配的单据</strong>
            <p>试试调整搜索词、状态或部门筛选。</p>
            <button type="button" className="button button-ghost button-small" onClick={onResetFilters}>
              清除筛选条件
            </button>
          </div>
        )}
      </div>

      <div className="table-foot">
        <span className="table-range">
          {total > 0 ? (
            <>
              显示 <strong>{startItem}–{endItem}</strong>，共 {total.toLocaleString('zh-CN')} 条
            </>
          ) : (
            '共 0 条'
          )}
          <em> · 每页 {PAGE_SIZE} 条</em>
        </span>
        <div className="pager">
          <button
            type="button"
            className="pager-arrow"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="上一页"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          {pageItems.map((item) =>
            typeof item === 'number' ? (
              <button
                type="button"
                key={item}
                className={`pager-page ${item === safePage ? 'is-active' : ''}`}
                onClick={() => onPageChange(item)}
                aria-current={item === safePage ? 'page' : undefined}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="pager-ellipsis">
                ···
              </span>
            ),
          )}
          <button
            type="button"
            className="pager-arrow"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="下一页"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>
    </section>
  )
}
