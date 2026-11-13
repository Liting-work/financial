import { PageHeader, PageStats } from './PageParts.jsx'
import { Icon } from './Icons.jsx'
import { FormsTable } from './FormsTable.jsx'
import { compactMoney } from '../lib/format.js'

export function DocumentsPage({
  allForms,
  filteredCount,
  filteredAmount,
  onExport,
  tableProps,
}) {
  return (
    <div className="subpage documents-page">
      <PageHeader
        eyebrow="LEDGER / 单据档案"
        title="报销单据"
        subtitle="默认载入最近 30 天提交的待处理单据，并按当前审批人「李婷」筛选；其它状态在点击对应 tab 后实时加载。"
        aside={
          <>
            <PageStats
              items={[
                { label: '当前范围', value: allForms.length, unit: '笔' },
                { label: '筛选结果', value: filteredCount, unit: '笔' },
                { label: '筛选金额', value: compactMoney(filteredAmount, true) },
              ]}
            />
            <div className="page-actions">
              <button type="button" className="button button-ghost" onClick={onExport}>
                <Icon name="download" size={15} />
                导出当前视图
              </button>
            </div>
          </>
        }
      />

      <FormsTable {...tableProps} />
    </div>
  )
}
