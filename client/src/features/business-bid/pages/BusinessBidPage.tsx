import { useMemo, useState } from 'react';

type ClauseStatus = 'responded' | 'deviation' | 'pending';
type AttachmentStatus = 'ready' | 'review' | 'missing';

interface ClauseItem {
  id: string;
  clause: string;
  requirement: string;
  response: string;
  owner: string;
  status: ClauseStatus;
}

interface AttachmentItem {
  id: string;
  name: string;
  type: string;
  status: AttachmentStatus;
}

interface ProjectProfile {
  projectName: string;
  bidderName: string;
  bidAmount: string;
  validityDays: string;
}

const statusLabels: Record<ClauseStatus, string> = {
  responded: '已响应',
  deviation: '有偏离',
  pending: '待确认',
};

const attachmentStatusLabels: Record<AttachmentStatus, string> = {
  ready: '已准备',
  review: '待复核',
  missing: '待补充',
};

const defaultProject: ProjectProfile = {
  projectName: '智慧园区运维服务项目',
  bidderName: '示例科技有限公司',
  bidAmount: '3,860,000',
  validityDays: '90',
};

const defaultClauses: ClauseItem[] = [
  {
    id: 'payment',
    clause: '付款条件',
    requirement: '按月计量，验收合格后 30 日内支付。',
    response: '完全响应招标文件付款条件，配合采购人完成验收、开票和结算流程。',
    owner: '商务经理',
    status: 'responded',
  },
  {
    id: 'bond',
    clause: '履约保证金',
    requirement: '中标后 7 个工作日内提交合同金额 5% 的履约保证金。',
    response: '拟采用银行保函形式提交，需确认开函周期和银行格式要求。',
    owner: '财务',
    status: 'pending',
  },
  {
    id: 'validity',
    clause: '报价有效期',
    requirement: '投标有效期不少于 90 日历天。',
    response: '报价有效期为 90 日历天，自投标截止之日起计算。',
    owner: '报价负责人',
    status: 'responded',
  },
  {
    id: 'contract',
    clause: '合同偏离',
    requirement: '不得对违约责任、服务范围、验收标准作实质性负偏离。',
    response: '第 12.3 项违约责任表述需法务复核，当前建议列为轻微正当说明。',
    owner: '法务',
    status: 'deviation',
  },
];

const defaultAttachments: AttachmentItem[] = [
  { id: 'quote-summary', name: '报价汇总表', type: '报价附件', status: 'ready' },
  { id: 'tax-proof', name: '纳税证明', type: '资信材料', status: 'review' },
  { id: 'bank-credit', name: '银行资信证明', type: '资信材料', status: 'missing' },
  { id: 'auth-letter', name: '法定代表人授权书', type: '商务文件', status: 'ready' },
  { id: 'service-commitment', name: '服务承诺函', type: '商务文件', status: 'ready' },
  { id: 'deviation-table', name: '商务条款偏离表', type: '响应表', status: 'review' },
];

function BusinessBidPage() {
  const [project, setProject] = useState<ProjectProfile>(defaultProject);
  const [clauses, setClauses] = useState<ClauseItem[]>(defaultClauses);
  const [attachments, setAttachments] = useState<AttachmentItem[]>(defaultAttachments);
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => {
    const responded = clauses.filter((item) => item.status === 'responded').length;
    const deviations = clauses.filter((item) => item.status === 'deviation').length;
    const pending = clauses.filter((item) => item.status === 'pending').length;
    const readyAttachments = attachments.filter((item) => item.status === 'ready').length;
    const completion = Math.round(((responded + readyAttachments) / (clauses.length + attachments.length)) * 100);

    return {
      responded,
      deviations,
      pending,
      readyAttachments,
      completion,
      risks: deviations + pending + attachments.filter((item) => item.status !== 'ready').length,
    };
  }, [attachments, clauses]);

  const draftMarkdown = useMemo(() => buildDraftMarkdown(project, clauses, attachments), [attachments, clauses, project]);

  const updateProject = (field: keyof ProjectProfile, value: string) => {
    setProject((current) => ({ ...current, [field]: value }));
  };

  const updateClause = (id: string, patch: Partial<ClauseItem>) => {
    setClauses((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const addClause = () => {
    const nextIndex = clauses.length + 1;
    setClauses((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        clause: `新增商务条款 ${nextIndex}`,
        requirement: '请填写招标文件中的商务要求。',
        response: '请填写本次投标响应口径。',
        owner: '待分配',
        status: 'pending',
      },
    ]);
  };

  const cycleAttachmentStatus = (id: string) => {
    const order: AttachmentStatus[] = ['missing', 'review', 'ready'];
    setAttachments((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = order[(order.indexOf(item.status) + 1) % order.length];
      return { ...item, status: next };
    }));
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draftMarkdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const downloadDraft = () => {
    const blob = new Blob([draftMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.projectName || '商务标'}-商务响应草稿.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="business-bid-page">
      <section className="business-bid-hero">
        <div className="business-bid-hero-copy">
          <span className="section-kicker">商务标</span>
          <h2>商务响应工作台</h2>
          <p>集中维护项目口径、商务条款响应、资信附件和偏离风险，先形成可人工复核的商务标材料包。</p>
        </div>
        <div className="business-bid-summary" aria-label="商务标进度">
          <article>
            <span>完成度</span>
            <strong>{summary.completion}%</strong>
          </article>
          <article>
            <span>已响应</span>
            <strong>{summary.responded}</strong>
          </article>
          <article>
            <span>待处理</span>
            <strong>{summary.risks}</strong>
          </article>
        </div>
      </section>

      <div className="business-bid-workspace">
        <section className="business-bid-panel business-bid-project-panel">
          <div className="business-bid-panel-head">
            <div>
              <span className="section-kicker">项目口径</span>
              <h3>基础商务信息</h3>
            </div>
          </div>
          <div className="business-bid-form-grid">
            <label>
              <span>项目名称</span>
              <input value={project.projectName} onChange={(event) => updateProject('projectName', event.target.value)} />
            </label>
            <label>
              <span>投标人</span>
              <input value={project.bidderName} onChange={(event) => updateProject('bidderName', event.target.value)} />
            </label>
            <label>
              <span>投标报价</span>
              <input value={project.bidAmount} onChange={(event) => updateProject('bidAmount', event.target.value)} />
            </label>
            <label>
              <span>投标有效期</span>
              <input value={project.validityDays} onChange={(event) => updateProject('validityDays', event.target.value)} />
            </label>
          </div>
        </section>

        <section className="business-bid-panel business-bid-clause-panel">
          <div className="business-bid-panel-head">
            <div>
              <span className="section-kicker">条款矩阵</span>
              <h3>商务响应与偏离</h3>
            </div>
            <button type="button" className="secondary-action" onClick={addClause}>新增条款</button>
          </div>
          <div className="business-bid-clause-list">
            {clauses.map((item) => (
              <article key={item.id} className={`business-bid-clause-card is-${item.status}`}>
                <div className="business-bid-clause-title">
                  <input value={item.clause} onChange={(event) => updateClause(item.id, { clause: event.target.value })} aria-label="条款名称" />
                  <select value={item.status} onChange={(event) => updateClause(item.id, { status: event.target.value as ClauseStatus })} aria-label="响应状态">
                    <option value="responded">已响应</option>
                    <option value="pending">待确认</option>
                    <option value="deviation">有偏离</option>
                  </select>
                </div>
                <label>
                  <span>招标要求</span>
                  <textarea value={item.requirement} onChange={(event) => updateClause(item.id, { requirement: event.target.value })} rows={2} />
                </label>
                <label>
                  <span>响应口径</span>
                  <textarea value={item.response} onChange={(event) => updateClause(item.id, { response: event.target.value })} rows={3} />
                </label>
                <div className="business-bid-clause-footer">
                  <label>
                    <span>负责人</span>
                    <input value={item.owner} onChange={(event) => updateClause(item.id, { owner: event.target.value })} />
                  </label>
                  <span className={`business-bid-status is-${item.status}`}>{statusLabels[item.status]}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="business-bid-side">
          <section className="business-bid-panel">
            <div className="business-bid-panel-head">
              <div>
                <span className="section-kicker">材料清单</span>
                <h3>商务附件</h3>
              </div>
              <span className="business-bid-soft-pill">{summary.readyAttachments}/{attachments.length}</span>
            </div>
            <div className="business-bid-attachment-list">
              {attachments.map((item) => (
                <button key={item.id} type="button" className={`business-bid-attachment is-${item.status}`} onClick={() => cycleAttachmentStatus(item.id)}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.type}</small>
                  </span>
                  <em>{attachmentStatusLabels[item.status]}</em>
                </button>
              ))}
            </div>
          </section>

          <section className="business-bid-panel">
            <div className="business-bid-panel-head">
              <div>
                <span className="section-kicker">风险复核</span>
                <h3>待处理事项</h3>
              </div>
            </div>
            <div className="business-bid-risk-list">
              {summary.risks === 0 ? (
                <strong>当前没有待处理事项</strong>
              ) : (
                <>
                  {summary.pending > 0 && <p>{summary.pending} 项商务条款仍需确认响应口径。</p>}
                  {summary.deviations > 0 && <p>{summary.deviations} 项合同或商务条款存在偏离，需要法务或项目负责人复核。</p>}
                  {attachments.filter((item) => item.status !== 'ready').map((item) => (
                    <p key={item.id}>{item.name}：{attachmentStatusLabels[item.status]}</p>
                  ))}
                </>
              )}
            </div>
          </section>

          <section className="business-bid-panel business-bid-draft-panel">
            <div className="business-bid-panel-head">
              <div>
                <span className="section-kicker">输出草稿</span>
                <h3>商务标材料包</h3>
              </div>
            </div>
            <pre>{draftMarkdown}</pre>
            <div className="business-bid-draft-actions">
              <button type="button" className="secondary-action" onClick={() => void copyDraft()}>{copied ? '已复制' : '复制草稿'}</button>
              <button type="button" className="primary-action" onClick={downloadDraft}>下载 Markdown</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function buildDraftMarkdown(project: ProjectProfile, clauses: ClauseItem[], attachments: AttachmentItem[]) {
  const clauseRows = clauses
    .map((item, index) => `| ${index + 1} | ${item.clause} | ${statusLabels[item.status]} | ${item.owner} | ${item.response.replace(/\n/g, ' ')} |`)
    .join('\n');
  const attachmentRows = attachments
    .map((item, index) => `| ${index + 1} | ${item.name} | ${item.type} | ${attachmentStatusLabels[item.status]} |`)
    .join('\n');

  return [
    `# ${project.projectName || '商务标'}商务响应草稿`,
    '',
    `- 投标人：${project.bidderName || '未填写'}`,
    `- 投标报价：${project.bidAmount || '未填写'}`,
    `- 投标有效期：${project.validityDays || '未填写'} 日历天`,
    '',
    '## 商务条款响应矩阵',
    '',
    '| 序号 | 条款 | 状态 | 负责人 | 响应口径 |',
    '| --- | --- | --- | --- | --- |',
    clauseRows,
    '',
    '## 商务附件清单',
    '',
    '| 序号 | 材料名称 | 类型 | 状态 |',
    '| --- | --- | --- | --- |',
    attachmentRows,
    '',
    '## 复核建议',
    '',
    '- 对待确认、偏离条款进行项目经理、财务、法务三级复核。',
    '- 对待补充附件设置截止时间，导出前再次核对签章、日期、授权范围。',
  ].join('\n');
}

export default BusinessBidPage;
