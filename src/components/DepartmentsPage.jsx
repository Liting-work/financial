import { useMemo, useState } from 'react'
import { PageHeader, PageStats } from './PageParts.jsx'
import { Icon } from './Icons.jsx'
import { TypeSwitch } from './Overview.jsx'
import {
  avatarStyle,
  compactMoney,
  formatMoney,
  formatPercent,
  initials,
} from '../lib/format.js'

const SORTS = [
  { key: 'amount', label: '金额' },
  { key: 'count', label: '单数' },
  { key: 'pending', label: '待处理' },
]

export function DepartmentsPage({
  allForms,
  typeFilter,
  onTypeChange,
  metrics,
  onOpenDepartment,
}) {
  const [sortBy, setSortBy] = useState('amount')
  const departments = useMemo(() => {
    const rows = [...metrics.departments]
    if (sortBy === 'count') rows.sort((a, b) => b.count - a.count || b.amount - a.amount)
    else if (sortBy === 'pending') {
      rows.sort((a, b) => b.pending - a.pending || b.amount - a.amount)
    } else rows.sort((a, b) => b.amount - a.amount)
    return rows
  }, [metrics.departments, sortBy])

  const maxAmount = Math.max(...departments.map((item) => item.amount), 1)
  const totalCount = metrics.count
  const totalAmount = metrics.total
  const totalPending = metrics.pendingCount
  const average = metrics.average

  return (
    <div className="subpage departments-page">
      <PageHeader
        eyebrow="DEPARTMENT INSIGHTS / 组织视角"
        title="部门洞察"
        subtitle="以承担部门为单位，汇总单据规模、待处理与完成进度。点击任一部门，可直接查看它名下的全部单据。"
        aside={
          <>
            <PageStats
              items={[
                { label: '覆盖部门', value: departments.length, unit: '个' },
                { label: '单据总额', value: compactMoney(totalAmount, true) },
                { label: '待处理', value: totalPending, unit: '笔' },
              ]}
            />
            <span className="page-aside-note">
              <Icon name="building" size={13} />
              按承担部门归集 · 汇总口径同步单据类型
            </span>
          </>
        }
      />

      <TypeSwitch
        forms={allForms}
        value={typeFilter}
        onChange={onTypeChange}
        note="部门汇总同步筛选"
      />

      <section className="table-panel dept-summary-panel">
        <div className="table-head">
          <div>
            <p className="panel-eyebrow">
              <span className="eyebrow-tick" />
              LEDGER / 部门单据汇总
            </p>
            <div className="table-title-row">
              <h2>部门汇总明细</h2>
              <span className="table-count">{departments.length}</span>
              <span className="table-scope">按承担部门</span>
            </div>
            <p className="dept-table-sub">单数、金额、待处理与完成率同表对照，点击行查看部门单据。</p>
          </div>
          <div className="dept-sort">
            <span>排序</span>
            <div className="mini-switch" role="group" aria-label="部门明细排序">
              {SORTS.map((sort) => (
                <button
                  type="button"
                  key={sort.key}
                  className={sortBy === sort.key ? 'is-active' : ''}
                  onClick={() => setSortBy(sort.key)}
                >
                  {sort.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="table-scroll">
          <table className="forms-table dept-table">
            <thead>
              <tr>
                <th>部门</th>
                <th className="align-right">单据数</th>
                <th>单据金额</th>
                <th className="align-right">待处理</th>
                <th>完成率</th>
                <th className="align-right">笔均金额</th>
                <th>
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept, index) => {
                const countShare = totalCount ? (dept.count / totalCount) * 100 : 0
                const amountShare = totalAmount ? (dept.amount / totalAmount) * 100 : 0
                const completeRate = dept.count ? (dept.completed / dept.count) * 100 : 0
                const average = dept.count ? dept.amount / dept.count : 0
                return (
                  <tr
                    key={dept.name}
                    className="form-row dept-row"
                    tabIndex={0}
                    onClick={() => onOpenDepartment(dept.name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onOpenDepartment(dept.name)
                      }
                    }}
                    aria-label={`查看 ${dept.name} 的单据`}
                  >
                    <td>
                      <div className="dept-cell">
                        <span className="dept-rank-no">{String(index + 1).padStart(2, '0')}</span>
                        <span className="dept-avatar" style={avatarStyle(dept.name)}>
                          {initials(dept.name)}
                        </span>
                        <div className="dept-cell-copy">
                          <strong>{dept.name}</strong>
                          <span>占 {formatPercent(countShare)} 的单据</span>
                        </div>
                      </div>
                    </td>
                    <td className="align-right">
                      <span className="dept-count">{dept.count}</span>
                      <span className="dept-count-unit"> 笔</span>
                    </td>
                    <td>
                      <div className="dept-amount-block">
                        <div className="dept-amount-line">
                          <strong>¥{formatMoney(dept.amount)}</strong>
                          <em>{formatPercent(amountShare)}</em>
                        </div>
                        <div className="dept-amount-bar" aria-hidden="true">
                          <i style={{ width: `${Math.max((dept.amount / maxAmount) * 100, 2)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="align-right">
                      {dept.pending > 0 ? (
                        <span className="dept-pending">
                          <i />
                          {dept.pending} 笔
                        </span>
                      ) : (
                        <span className="dept-zero">—</span>
                      )}
                    </td>
                    <td>
                      <div className="dept-completion">
                        <span>{formatPercent(completeRate)}</span>
                        <div aria-hidden="true">
                          <i style={{ width: `${Math.min(completeRate, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="align-right">
                      <span className="dept-average">¥{formatMoney(average)}</span>
                    </td>
                    <td>
                      <span className="row-action dept-row-action" aria-hidden="true">
                        <Icon name="arrowUpRight" size={15} />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {departments.length > 0 && (
              <tfoot>
                <tr>
                  <td>
                    <strong>合计</strong>
                    <span> · {departments.length} 个部门</span>
                  </td>
                  <td className="align-right">{formatMoney(totalCount, { decimals: 0 })} 笔</td>
                  <td>¥{formatMoney(totalAmount)}</td>
                  <td className="align-right">{totalPending} 笔</td>
                  <td>{formatPercent(metrics.completionRate)}</td>
                  <td className="align-right">¥{formatMoney(average)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
          {departments.length === 0 && (
            <div className="table-empty">
              <span className="empty-mark">
                <Icon name="building" size={24} />
              </span>
              <strong>当前类型下没有部门数据</strong>
              <p>切换单据类型后再看看。</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
