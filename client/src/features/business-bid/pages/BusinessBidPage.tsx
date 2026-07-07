import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_EXPORT_FORMAT, type ExportFormatConfig, type ExportTemplateRecord, type OutlineItem, type WordExportProgressEvent } from '../../../shared/types';
import { useToast } from '../../../shared/ui';
import type { BusinessBidAttachmentItem, BusinessBidAttachmentStatus, BusinessBidClauseItem, BusinessBidClauseStatus, BusinessBidProjectProfile, BusinessBidWorkspaceState } from '../types';

const statusLabels: Record<BusinessBidClauseStatus, string> = {
  responded: '已响应',
  deviation: '有偏离',
  pending: '待确认',
};

const attachmentStatusLabels: Record<BusinessBidAttachmentStatus, string> = {
  ready: '已准备',
  review: '待复核',
  missing: '待补充',
};

const emptyState: BusinessBidWorkspaceState = {
  project: {
    projectName: '',
    bidderName: '',
    bidAmount: '',
    validityDays: '',
  },
  clauses: [],
  attachments: [],
};

interface ExportProgressState {
  open: boolean;
  running: boolean;
  progress: number;
  message: string;
  warnings: string[];
  filePath?: string;
  error?: string;
}

const initialExportProgress: ExportProgressState = {
  open: false,
  running: false,
  progress: 0,
  message: '',
  warnings: [],
};

function BusinessBidPage() {
  const { showToast } = useToast();
  const [state, setState] = useState<BusinessBidWorkspaceState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportTemplates, setExportTemplates] = useState<ExportTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [exportProgress, setExportProgress] = useState<ExportProgressState>(initialExportProgress);
  const skipNextSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const { project, clauses, attachments } = state;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [businessState, templates] = await Promise.all([
          window.yibiao?.businessBid.loadState(),
          window.yibiao?.templates.list(),
        ]);
        if (cancelled) return;
        skipNextSaveRef.current = true;
        setState(businessState || emptyState);
        setExportTemplates(templates || []);
        setSelectedTemplateId((templates || [])[0]?.template_id || '');
      } catch (error) {
        if (!cancelled) {
          showToast(error instanceof Error ? error.message : '读取商务标工作台失败', 'error');
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [showToast]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      setSaving(true);
      setSaveError('');
      window.yibiao?.businessBid.saveState(state)
        .then((saved) => {
          if (saved) {
            skipNextSaveRef.current = true;
            setState(saved);
          }
        })
        .catch((error) => {
          setSaveError(error instanceof Error ? error.message : '保存商务标工作台失败');
        })
        .finally(() => setSaving(false));
    }, 500);
  }, [hydrated, state]);

  useEffect(() => {
    if (!window.yibiao?.export.onWordExportProgress) return;
    return window.yibiao.export.onWordExportProgress((event: WordExportProgressEvent) => {
      if (!event.requestId?.startsWith('business-bid-')) return;
      setExportProgress((current) => ({
        ...current,
        open: true,
        running: event.phase === 'running',
        progress: event.progress,
        message: event.message,
        warnings: event.warnings || current.warnings || [],
        error: event.phase === 'error' ? event.message : current.error,
      }));
    });
  }, []);

  const selectedTemplate = useMemo(() => exportTemplates.find((template) => template.template_id === selectedTemplateId) || null, [exportTemplates, selectedTemplateId]);

  const summary = useMemo(() => {
    const responded = clauses.filter((item) => item.status === 'responded').length;
    const deviations = clauses.filter((item) => item.status === 'deviation').length;
    const pending = clauses.filter((item) => item.status === 'pending').length;
    const readyAttachments = attachments.filter((item) => item.status === 'ready').length;
    const total = Math.max(1, clauses.length + attachments.length);
    const completion = Math.round(((responded + readyAttachments) / total) * 100);

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
  const outline = useMemo(() => buildBusinessBidOutline(project, clauses, attachments, summary), [attachments, clauses, project, summary]);

  const updateProject = (field: keyof BusinessBidProjectProfile, value: string) => {
    setState((current) => ({ ...current, project: { ...current.project, [field]: value } }));
  };

  const updateClause = (id: string, patch: Partial<BusinessBidClauseItem>) => {
    setState((current) => ({
      ...current,
      clauses: current.clauses.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  const deleteClause = (id: string) => {
    setState((current) => ({ ...current, clauses: current.clauses.filter((item) => item.id !== id) }));
  };

  const addClause = () => {
    setState((current) => {
      const nextIndex = current.clauses.length + 1;
      return {
        ...current,
        clauses: [
          ...current.clauses,
          {
            id: `clause-${Date.now()}`,
            clause: `新增商务条款 ${nextIndex}`,
            requirement: '请填写招标文件中的商务要求。',
            response: '请填写本次投标响应口径。',
            owner: '待分配',
            status: 'pending',
          },
        ],
      };
    });
  };

  const updateAttachment = (id: string, patch: Partial<BusinessBidAttachmentItem>) => {
    setState((current) => ({
      ...current,
      attachments: current.attachments.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  const addAttachment = () => {
    setState((current) => ({
      ...current,
      attachments: [
        ...current.attachments,
        {
          id: `attachment-${Date.now()}`,
          name: `新增商务附件 ${current.attachments.length + 1}`,
          type: '商务材料',
          status: 'missing',
        },
      ],
    }));
  };

  const deleteAttachment = (id: string) => {
    setState((current) => ({ ...current, attachments: current.attachments.filter((item) => item.id !== id) }));
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draftMarkdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      showToast('商务标草稿已复制', 'success');
    } catch {
      showToast('复制失败，请手动选择草稿内容', 'error');
    }
  };

  const downloadDraft = () => {
    const blob = new Blob([draftMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(project.projectName || '商务标')}-商务响应草稿.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportWord = async () => {
    if (!outline.length) {
      showToast('请先维护商务标内容', 'info');
      return;
    }
    const requestId = `business-bid-${Date.now()}`;
    const exportFormat: ExportFormatConfig = selectedTemplate?.config || DEFAULT_EXPORT_FORMAT;
    setExportProgress({
      ...initialExportProgress,
      open: true,
      running: true,
      message: '正在准备商务标 Word 导出。',
    });

    try {
      const result = await window.yibiao?.export.exportWord({
        requestId,
        project_name: project.projectName || '商务标材料包',
        outline,
        export_format: exportFormat,
      });
      if (result?.canceled) {
        setExportProgress({ ...initialExportProgress, open: true, message: '已取消导出。' });
        return;
      }
      setExportProgress((current) => ({
        ...current,
        open: true,
        running: false,
        progress: 100,
        message: result?.message || '商务标 Word 已导出。',
        warnings: result?.warnings || current.warnings,
        filePath: result?.path,
      }));
      showToast('商务标 Word 已导出', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出商务标 Word 失败';
      setExportProgress((current) => ({ ...current, open: true, running: false, progress: 100, message, error: message }));
      showToast(message, 'error');
    }
  };

  const openExportedFile = async () => {
    if (!exportProgress.filePath) return;
    await window.yibiao?.export.openFile(exportProgress.filePath);
  };

  const resetWorkspace = async () => {
    if (!window.confirm('会清空当前商务标工作台并恢复示例数据，是否继续？')) return;
    try {
      const result = await window.yibiao?.businessBid.clear();
      if (result?.state) {
        skipNextSaveRef.current = true;
        setState(result.state);
      }
      showToast(result?.message || '商务标工作台已重置', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '重置商务标工作台失败', 'error');
    }
  };

  return (
    <div className="business-bid-page">
      <section className="business-bid-hero">
        <div className="business-bid-hero-copy">
          <span className="section-kicker">商务标</span>
          <h2>商务响应工作台</h2>
          <p>集中维护项目口径、商务条款响应、资信附件和偏离风险，形成可保存、可导出的商务标材料包。</p>
        </div>
        <div className="business-bid-summary" aria-label="商务标进度">
          <article><span>完成度</span><strong>{summary.completion}%</strong></article>
          <article><span>已响应</span><strong>{summary.responded}</strong></article>
          <article><span>待处理</span><strong>{summary.risks}</strong></article>
        </div>
      </section>

      <div className="business-bid-workspace">
        <section className="business-bid-panel business-bid-project-panel">
          <div className="business-bid-panel-head">
            <div>
              <span className="section-kicker">项目口径</span>
              <h3>基础商务信息</h3>
            </div>
            <span className={`business-bid-save-state${saveError ? ' is-error' : saving ? ' is-saving' : ''}`}>
              {saveError || (saving ? '保存中' : hydrated ? '已本地保存' : '读取中')}
            </span>
          </div>
          <div className="business-bid-form-grid">
            <label><span>项目名称</span><input value={project.projectName} onChange={(event) => updateProject('projectName', event.target.value)} /></label>
            <label><span>投标人</span><input value={project.bidderName} onChange={(event) => updateProject('bidderName', event.target.value)} /></label>
            <label><span>投标报价</span><input value={project.bidAmount} onChange={(event) => updateProject('bidAmount', event.target.value)} /></label>
            <label><span>投标有效期</span><input value={project.validityDays} onChange={(event) => updateProject('validityDays', event.target.value)} /></label>
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
                  <select value={item.status} onChange={(event) => updateClause(item.id, { status: event.target.value as BusinessBidClauseStatus })} aria-label="响应状态">
                    <option value="responded">已响应</option>
                    <option value="pending">待确认</option>
                    <option value="deviation">有偏离</option>
                  </select>
                </div>
                <label><span>招标要求</span><textarea value={item.requirement} onChange={(event) => updateClause(item.id, { requirement: event.target.value })} rows={2} /></label>
                <label><span>响应口径</span><textarea value={item.response} onChange={(event) => updateClause(item.id, { response: event.target.value })} rows={3} /></label>
                <div className="business-bid-clause-footer">
                  <label><span>负责人</span><input value={item.owner} onChange={(event) => updateClause(item.id, { owner: event.target.value })} /></label>
                  <div className="business-bid-row-actions">
                    <span className={`business-bid-status is-${item.status}`}>{statusLabels[item.status]}</span>
                    <button type="button" className="business-bid-icon-action is-danger" onClick={() => deleteClause(item.id)} aria-label="删除条款">×</button>
                  </div>
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
              <button type="button" className="secondary-action" onClick={addAttachment}>新增附件</button>
            </div>
            <div className="business-bid-attachment-list">
              {attachments.map((item) => (
                <article key={item.id} className={`business-bid-attachment-edit is-${item.status}`}>
                  <label><span>材料名称</span><input value={item.name} onChange={(event) => updateAttachment(item.id, { name: event.target.value })} /></label>
                  <label><span>类型</span><input value={item.type} onChange={(event) => updateAttachment(item.id, { type: event.target.value })} /></label>
                  <div className="business-bid-attachment-edit-footer">
                    <select value={item.status} onChange={(event) => updateAttachment(item.id, { status: event.target.value as BusinessBidAttachmentStatus })}>
                      <option value="ready">已准备</option>
                      <option value="review">待复核</option>
                      <option value="missing">待补充</option>
                    </select>
                    <button type="button" className="business-bid-icon-action is-danger" onClick={() => deleteAttachment(item.id)} aria-label="删除附件">×</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="business-bid-panel">
            <div className="business-bid-panel-head">
              <div>
                <span className="section-kicker">风险复核</span>
                <h3>待处理事项</h3>
              </div>
              <span className="business-bid-soft-pill">{summary.readyAttachments}/{attachments.length}</span>
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
            <label className="business-bid-template-select">
              <span>Word 模板</span>
              <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                <option value="">默认模板</option>
                {exportTemplates.map((template) => (
                  <option key={template.template_id} value={template.template_id}>{template.template_name}</option>
                ))}
              </select>
            </label>
            <pre>{draftMarkdown}</pre>
            <div className="business-bid-draft-actions">
              <button type="button" className="secondary-action" onClick={() => void copyDraft()}>{copied ? '已复制' : '复制草稿'}</button>
              <button type="button" className="secondary-action" onClick={downloadDraft}>下载 Markdown</button>
              <button type="button" className="primary-action" onClick={() => void exportWord()} disabled={exportProgress.running}>导出 Word</button>
              <button type="button" className="danger-action" onClick={() => void resetWorkspace()} disabled={exportProgress.running}>重置</button>
            </div>
          </section>
        </aside>
      </div>

      {exportProgress.open && (
        <div className="business-bid-export-toast" role="status" aria-live="polite">
          <div>
            <strong>{exportProgress.error ? '导出失败' : exportProgress.running ? '正在导出 Word' : '导出完成'}</strong>
            <span>{exportProgress.message || '正在生成商务标 Word 文档。'}</span>
          </div>
          <div className="business-bid-export-progress"><span style={{ width: `${exportProgress.progress}%` }} /></div>
          <div className="business-bid-export-actions">
            {!exportProgress.running && exportProgress.filePath && <button type="button" className="primary-action" onClick={() => void openExportedFile()}>打开文件</button>}
            {!exportProgress.running && <button type="button" className="secondary-action" onClick={() => setExportProgress(initialExportProgress)}>知道了</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function sanitizeFileName(value: string) {
  return String(value || '商务标').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || '商务标';
}

function escapeTableCell(value: string) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function buildDraftMarkdown(project: BusinessBidProjectProfile, clauses: BusinessBidClauseItem[], attachments: BusinessBidAttachmentItem[]) {
  const clauseRows = clauses
    .map((item, index) => `| ${index + 1} | ${escapeTableCell(item.clause)} | ${statusLabels[item.status]} | ${escapeTableCell(item.owner)} | ${escapeTableCell(item.response)} |`)
    .join('\n');
  const attachmentRows = attachments
    .map((item, index) => `| ${index + 1} | ${escapeTableCell(item.name)} | ${escapeTableCell(item.type)} | ${attachmentStatusLabels[item.status]} |`)
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
    clauseRows || '| - | 暂无 | - | - | - |',
    '',
    '## 商务附件清单',
    '',
    '| 序号 | 材料名称 | 类型 | 状态 |',
    '| --- | --- | --- | --- |',
    attachmentRows || '| - | 暂无 | - | - |',
    '',
    '## 复核建议',
    '',
    '- 对待确认、偏离条款进行项目经理、财务、法务三级复核。',
    '- 对待补充附件设置截止时间，导出前再次核对签章、日期、授权范围。',
  ].join('\n');
}

function buildBusinessBidOutline(
  project: BusinessBidProjectProfile,
  clauses: BusinessBidClauseItem[],
  attachments: BusinessBidAttachmentItem[],
  summary: { completion: number; risks: number },
): OutlineItem[] {
  return [
    {
      id: 'business-bid-overview',
      title: '商务标概况',
      description: '项目商务口径与整体完成情况。',
      content: [
        `项目名称：${project.projectName || '未填写'}`,
        `投标人：${project.bidderName || '未填写'}`,
        `投标报价：${project.bidAmount || '未填写'}`,
        `投标有效期：${project.validityDays || '未填写'} 日历天`,
        `商务标完成度：${summary.completion}%`,
        `待处理事项：${summary.risks} 项`,
      ].join('\n\n'),
    },
    {
      id: 'business-bid-clauses',
      title: '商务条款响应矩阵',
      description: '付款、履约、合同等商务条款的响应口径。',
      content: [
        '| 序号 | 条款 | 招标要求 | 响应口径 | 状态 | 负责人 |',
        '| --- | --- | --- | --- | --- | --- |',
        ...(clauses.length ? clauses.map((item, index) => `| ${index + 1} | ${escapeTableCell(item.clause)} | ${escapeTableCell(item.requirement)} | ${escapeTableCell(item.response)} | ${statusLabels[item.status]} | ${escapeTableCell(item.owner)} |`) : ['| - | 暂无 | - | - | - | - |']),
      ].join('\n'),
    },
    {
      id: 'business-bid-attachments',
      title: '商务附件清单',
      description: '报价、资信、授权、承诺等商务材料状态。',
      content: [
        '| 序号 | 材料名称 | 类型 | 状态 |',
        '| --- | --- | --- | --- |',
        ...(attachments.length ? attachments.map((item, index) => `| ${index + 1} | ${escapeTableCell(item.name)} | ${escapeTableCell(item.type)} | ${attachmentStatusLabels[item.status]} |`) : ['| - | 暂无 | - | - |']),
      ].join('\n'),
    },
    {
      id: 'business-bid-review',
      title: '复核建议',
      description: '导出和提交前需要人工复核的商务风险。',
      content: [
        '- 对待确认、偏离条款进行项目经理、财务、法务三级复核。',
        '- 对待补充附件设置截止时间，导出前再次核对签章、日期、授权范围。',
        '- 导出前复核报价金额、投标有效期、履约保证金、付款条件与合同偏离表是否一致。',
      ].join('\n'),
    },
  ];
}

export default BusinessBidPage;
