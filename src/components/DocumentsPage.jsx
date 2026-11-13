import { PageHeader, PageStats } from './PageParts.jsx'
import { Icon } from './Icons.jsx'
import { TypeSwitch } from './Overview.jsx'
import { FormsTable } from './FormsTable.jsx'
import { compactMoney } from '../lib/format.js'

export function DocumentsPage({
  allForms,
  typeFilter,
  onTypeChange,
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
        subtitle="检索全部报销与付款单据，组合筛选后打开单据即可查看费用构成、发票与完整审批流程。"
        aside={
          <>
            <PageStats
              items={[
                { label: '全部单据', value: allForms.length, unit: '笔' },
                { label: '当前结果', value: filteredCount, unit: '笔' },
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

      <TypeSwitch
        forms={allForms}
        value={typeFilter}
        onChange={onTypeChange}
        note="单据列表同步筛选"
      />

      <FormsTable {...tableProps} />
    </div>
  )
}
