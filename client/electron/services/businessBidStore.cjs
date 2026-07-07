const crypto = require('node:crypto');

const defaultProject = {
  projectName: '智慧园区运维服务项目',
  bidderName: '示例科技有限公司',
  bidAmount: '3,860,000',
  validityDays: '90',
};

const defaultClauses = [
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

const defaultAttachments = [
  { id: 'quote-summary', name: '报价汇总表', type: '报价附件', status: 'ready' },
  { id: 'tax-proof', name: '纳税证明', type: '资信材料', status: 'review' },
  { id: 'bank-credit', name: '银行资信证明', type: '资信材料', status: 'missing' },
  { id: 'auth-letter', name: '法定代表人授权书', type: '商务文件', status: 'ready' },
  { id: 'service-commitment', name: '服务承诺函', type: '商务文件', status: 'ready' },
  { id: 'deviation-table', name: '商务条款偏离表', type: '响应表', status: 'review' },
];

function now() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeClauseStatus(value) {
  return ['responded', 'pending', 'deviation'].includes(value) ? value : 'pending';
}

function normalizeAttachmentStatus(value) {
  return ['ready', 'review', 'missing'].includes(value) ? value : 'missing';
}

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeProject(project = {}) {
  return {
    projectName: normalizeText(project.projectName ?? project.project_name, defaultProject.projectName),
    bidderName: normalizeText(project.bidderName ?? project.bidder_name, defaultProject.bidderName),
    bidAmount: normalizeText(project.bidAmount ?? project.bid_amount, defaultProject.bidAmount),
    validityDays: normalizeText(project.validityDays ?? project.validity_days, defaultProject.validityDays),
  };
}

function normalizeClause(item = {}, index = 0) {
  return {
    id: normalizeText(item.id, createId('clause')),
    clause: normalizeText(item.clause, `商务条款 ${index + 1}`),
    requirement: String(item.requirement ?? ''),
    response: String(item.response ?? ''),
    owner: normalizeText(item.owner, '待分配'),
    status: normalizeClauseStatus(item.status),
  };
}

function normalizeAttachment(item = {}, index = 0) {
  return {
    id: normalizeText(item.id, createId('attachment')),
    name: normalizeText(item.name, `附件 ${index + 1}`),
    type: normalizeText(item.type, '商务材料'),
    status: normalizeAttachmentStatus(item.status),
  };
}

function createBusinessBidStore({ db }) {
  function ensureMetaRow() {
    const existing = db.prepare('SELECT * FROM business_bid_meta WHERE id = 1').get();
    if (existing) return existing;
    const timestamp = now();
    db.prepare(`
      INSERT INTO business_bid_meta (id, project_name, bidder_name, bid_amount, validity_days, created_at, updated_at)
      VALUES (1, @project_name, @bidder_name, @bid_amount, @validity_days, @created_at, @updated_at)
    `).run({
      project_name: defaultProject.projectName,
      bidder_name: defaultProject.bidderName,
      bid_amount: defaultProject.bidAmount,
      validity_days: defaultProject.validityDays,
      created_at: timestamp,
      updated_at: timestamp,
    });
    return db.prepare('SELECT * FROM business_bid_meta WHERE id = 1').get();
  }

  function seedDefaultRowsIfEmpty() {
    const clauseCount = db.prepare('SELECT COUNT(*) AS count FROM business_bid_clauses').get().count;
    const attachmentCount = db.prepare('SELECT COUNT(*) AS count FROM business_bid_attachments').get().count;
    const timestamp = now();
    if (!clauseCount) {
      const insertClause = db.prepare(`
        INSERT INTO business_bid_clauses (clause_id, clause, requirement, response, owner, status, sort_order, created_at, updated_at)
        VALUES (@id, @clause, @requirement, @response, @owner, @status, @sort_order, @created_at, @updated_at)
      `);
      defaultClauses.forEach((item, index) => insertClause.run({ ...item, sort_order: index, created_at: timestamp, updated_at: timestamp }));
    }
    if (!attachmentCount) {
      const insertAttachment = db.prepare(`
        INSERT INTO business_bid_attachments (attachment_id, name, type, status, sort_order, created_at, updated_at)
        VALUES (@id, @name, @type, @status, @sort_order, @created_at, @updated_at)
      `);
      defaultAttachments.forEach((item, index) => insertAttachment.run({ ...item, sort_order: index, created_at: timestamp, updated_at: timestamp }));
    }
  }

  function loadState() {
    const meta = ensureMetaRow();
    seedDefaultRowsIfEmpty();
    const clauses = db.prepare(`
      SELECT clause_id, clause, requirement, response, owner, status
      FROM business_bid_clauses
      ORDER BY sort_order ASC, created_at ASC
    `).all().map((row, index) => normalizeClause({
      id: row.clause_id,
      clause: row.clause,
      requirement: row.requirement,
      response: row.response,
      owner: row.owner,
      status: row.status,
    }, index));
    const attachments = db.prepare(`
      SELECT attachment_id, name, type, status
      FROM business_bid_attachments
      ORDER BY sort_order ASC, created_at ASC
    `).all().map((row, index) => normalizeAttachment({
      id: row.attachment_id,
      name: row.name,
      type: row.type,
      status: row.status,
    }, index));

    return {
      project: normalizeProject({
        projectName: meta.project_name,
        bidderName: meta.bidder_name,
        bidAmount: meta.bid_amount,
        validityDays: meta.validity_days,
      }),
      clauses,
      attachments,
      updatedAt: meta.updated_at,
    };
  }

  const saveStateTransaction = db.transaction((state = {}) => {
    const timestamp = now();
    const project = normalizeProject(state.project);
    const clauses = (Array.isArray(state.clauses) ? state.clauses : defaultClauses).map(normalizeClause);
    const attachments = (Array.isArray(state.attachments) ? state.attachments : defaultAttachments).map(normalizeAttachment);

    ensureMetaRow();
    db.prepare(`
      UPDATE business_bid_meta
      SET project_name = @project_name,
          bidder_name = @bidder_name,
          bid_amount = @bid_amount,
          validity_days = @validity_days,
          updated_at = @updated_at
      WHERE id = 1
    `).run({
      project_name: project.projectName,
      bidder_name: project.bidderName,
      bid_amount: project.bidAmount,
      validity_days: project.validityDays,
      updated_at: timestamp,
    });

    db.prepare('DELETE FROM business_bid_clauses').run();
    db.prepare('DELETE FROM business_bid_attachments').run();

    const insertClause = db.prepare(`
      INSERT INTO business_bid_clauses (clause_id, clause, requirement, response, owner, status, sort_order, created_at, updated_at)
      VALUES (@id, @clause, @requirement, @response, @owner, @status, @sort_order, @created_at, @updated_at)
    `);
    clauses.forEach((item, index) => insertClause.run({ ...item, sort_order: index, created_at: timestamp, updated_at: timestamp }));

    const insertAttachment = db.prepare(`
      INSERT INTO business_bid_attachments (attachment_id, name, type, status, sort_order, created_at, updated_at)
      VALUES (@id, @name, @type, @status, @sort_order, @created_at, @updated_at)
    `);
    attachments.forEach((item, index) => insertAttachment.run({ ...item, sort_order: index, created_at: timestamp, updated_at: timestamp }));
  });

  function saveState(state) {
    saveStateTransaction(state);
    return loadState();
  }

  function clear() {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM business_bid_meta').run();
      db.prepare('DELETE FROM business_bid_clauses').run();
      db.prepare('DELETE FROM business_bid_attachments').run();
      ensureMetaRow();
      seedDefaultRowsIfEmpty();
    });
    transaction();
    return { success: true, message: '商务标工作台已重置', state: loadState() };
  }

  return {
    loadState,
    saveState,
    clear,
  };
}

module.exports = {
  createBusinessBidStore,
};
