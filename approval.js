/* ===== APPROVAL WORKFLOW ENGINE ===== */

/** Submit expense for approval */
function submitForApproval(expenseId) {
  const expenses = getExpenses();
  const idx = expenses.findIndex(e => e.id === expenseId);
  if (idx < 0) return;
  const prev = { ...expenses[idx] };
  expenses[idx].status = 'submitted';
  saveExpenses(expenses);

  const history = getApprovalHistory();
  history.push({
    id: genId(), expenseId, action: 'submitted',
    userId: getCurrentUser().id, userName: getCurrentUser().name,
    comment: '', timestamp: new Date().toISOString(),
  });
  saveApprovalHistory(history);

  addNotification(icon('upload',14)+' Expense Submitted', `"${expenses[idx].description}" (${fmtCurrency(expenses[idx].amount)}) submitted for approval`, 'approval_submit_' + expenseId);
  if (typeof logAudit === 'function') logAudit(AUDIT_ACTIONS.APPROVAL_SUBMITTED, 'expense', expenseId, prev.status, 'submitted', expenses[idx].description);
  toast('Expense submitted for approval');
}

/** Approve an expense at the current workflow stage */
function approveExpense(expenseId, comment) {
  const user = getCurrentUser();
  if (!user) return;
  const expenses = getExpenses();
  const idx = expenses.findIndex(e => e.id === expenseId);
  if (idx < 0) return;
  const exp = expenses[idx];
  const prev = exp.status;

  /* Determine next status based on current role */
  if (isAtLeast(user.role, 'admin')) {
    exp.status = 'approved'; /* Admin/Super Admin = final approval */
  } else if (isAtLeast(user.role, 'manager')) {
    if (exp.status === 'submitted') {
      exp.status = 'manager_approved';
    } else {
      exp.status = 'approved';
    }
  }
  saveExpenses(expenses);

  const history = getApprovalHistory();
  history.push({
    id: genId(), expenseId, action: exp.status === 'approved' ? 'finance_approved' : 'manager_approved',
    userId: user.id, userName: user.name,
    comment: comment || '', timestamp: new Date().toISOString(),
  });
  saveApprovalHistory(history);

  addNotification(icon('check-circle',14)+' Expense Approved', `"${exp.description}" ${exp.status === 'approved' ? 'fully approved' : 'approved by manager'}`, 'approval_approve_' + expenseId + '_' + Date.now());
  if (typeof logAudit === 'function') logAudit(AUDIT_ACTIONS.APPROVAL_APPROVED, 'expense', expenseId, prev, exp.status, exp.description);
  toast('Expense approved!');
}

/** Reject an expense */
function rejectExpense(expenseId, reason) {
  const user = getCurrentUser();
  if (!user) return;
  const expenses = getExpenses();
  const idx = expenses.findIndex(e => e.id === expenseId);
  if (idx < 0) return;
  const prev = expenses[idx].status;
  expenses[idx].status = 'rejected';
  saveExpenses(expenses);

  const history = getApprovalHistory();
  history.push({
    id: genId(), expenseId, action: 'rejected',
    userId: user.id, userName: user.name,
    comment: reason || 'No reason provided', timestamp: new Date().toISOString(),
  });
  saveApprovalHistory(history);

  addNotification(icon('x-circle',14)+' Expense Rejected', `"${expenses[idx].description}" was rejected: ${reason || 'No reason'}`, 'approval_reject_' + expenseId + '_' + Date.now());
  if (typeof logAudit === 'function') logAudit(AUDIT_ACTIONS.APPROVAL_REJECTED, 'expense', expenseId, prev, 'rejected', expenses[idx].description);
  toast('Expense rejected');
}

/** Get the approval queue for a user */
function getApprovalQueue(userId, userRole) {
  const expenses = getExpenses();
  let queue = [];
  if (isAtLeast(userRole, 'admin')) {
    queue = expenses.filter(e => e.status === 'submitted' || e.status === 'manager_approved');
  } else if (isAtLeast(userRole, 'manager')) {
    queue = expenses.filter(e => e.status === 'submitted');
  }
  return queue;
}

/** Get approval timeline for a specific expense */
function getApprovalTimeline(expenseId) {
  return getApprovalHistory().filter(h => h.expenseId === expenseId).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/** Get approval statistics */
function getApprovalStats() {
  const expenses = getExpenses();
  const history = getApprovalHistory();
  return {
    pending: expenses.filter(e => e.status === 'submitted' || e.status === 'manager_approved').length,
    approved: expenses.filter(e => e.status === 'approved').length,
    rejected: expenses.filter(e => e.status === 'rejected').length,
    total: history.length,
  };
}

/** Render the approvals page */
function renderApprovals() {
  const user = getCurrentUser();
  const stats = getApprovalStats();

  /* Stats bar */
  const statsEl = document.getElementById('approval-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="approval-stat"><div class="stat-label">Pending</div><div class="stat-value" style="color:var(--yellow)">${stats.pending}</div></div>
      <div class="approval-stat"><div class="stat-label">Approved</div><div class="stat-value" style="color:var(--green)">${stats.approved}</div></div>
      <div class="approval-stat"><div class="stat-label">Rejected</div><div class="stat-value" style="color:var(--red)">${stats.rejected}</div></div>
      <div class="approval-stat"><div class="stat-label">Total Reviews</div><div class="stat-value">${stats.total}</div></div>`;
  }

  const container = document.getElementById('approval-content');
  if (!container) return;

  const queue = getApprovalQueue(user.id, user.role);
  const projects = getProjects();
  const canDoApproval = isAtLeast(user.role, 'manager');

  if (!queue.length) {
    container.innerHTML = `<p class="empty-state-sm">${icon('award',24)} No pending approvals - all caught up!</p>`;
    return;
  }

  container.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th><th>Status</th><th>Workflow</th>${canDoApproval ? '<th>Actions</th>' : ''}</tr></thead>
    <tbody>${queue.map(e => {
      const cat = getCat(e.category);
      const proj = projects.find(p => p.id === e.projectId);
      const timeline = getApprovalTimeline(e.id);
      const statusClass = e.status === 'submitted' ? 'badge-yellow' : e.status === 'manager_approved' ? 'badge-blue' : 'badge-ghost';
      const statusLabel = e.status === 'submitted' ? 'Awaiting Manager' : e.status === 'manager_approved' ? 'Awaiting Finance' : e.status;

      /* Build workflow pipeline dots */
      const steps = [
        { label: 'Submit', done: true },
        { label: 'Manager', done: e.status === 'manager_approved', active: e.status === 'submitted' },
        { label: 'Finance', done: false, active: e.status === 'manager_approved' },
        { label: 'Done', done: false },
      ];
      const pipeline = steps.map((s, i) => {
        const cls = s.done ? 'approval-step-done' : s.active ? 'approval-step-active' : 'approval-step-pending';
        return `${i > 0 ? '<div class="approval-step-line"></div>' : ''}<div class="approval-step ${cls}"><div class="approval-step-dot">${s.done ? icon('check',12) : i + 1}</div></div>`;
      }).join('');

      return `<tr>
        <td>${fmtDate(e.date)}</td>
        <td><strong>${e.description}</strong>${proj ? '<br><span style="font-size:0.72rem;color:var(--text-3)">' + proj.name + '</span>' : ''}</td>
        <td style="font-weight:600">${fmtCurrency(e.amount)}</td>
        <td><span class="badge" style="background:${colorMap[e.category] || '#4c8dff'}22;color:${colorMap[e.category] || '#4c8dff'}">${cat.icon} ${cat.name}</span></td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td><div class="approval-pipeline">${pipeline}</div></td>
        ${canDoApproval ? `<td><div class="approval-actions">
          <button class="btn btn-success btn-sm btn-with-icon" onclick="handleApprove('${e.id}')">${icon('check',14)} Approve</button>
          <button class="btn btn-danger btn-sm btn-with-icon" onclick="handleReject('${e.id}')">${icon('x',14)} Reject</button>
        </div></td>` : ''}
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

/** Handle approve button click — show modal */
window.handleApprove = function(expenseId) {
  const exp = getExpenses().find(e => e.id === expenseId);
  if (!exp) return;
  const detail = document.getElementById('approval-detail');
  if (detail) {
    detail.innerHTML = `<div style="margin-bottom:12px"><strong>${exp.description}</strong></div>
      <div style="font-size:0.85rem;color:var(--text-2)">Amount: <strong style="color:var(--text-0)">${fmtCurrency(exp.amount)}</strong> <span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom">&bull; ${fmtDate(exp.date)} &bull; ${getCat(exp.category).icon} ${getCat(exp.category).name}</span></div>`;
  }
  document.getElementById('approval-comment').value = '';
  document.getElementById('modal-approve-btn').onclick = function() {
    approveExpense(expenseId, document.getElementById('approval-comment').value);
    closeModal('approval-modal');
    renderApprovals(); renderExpenses(); renderNotifications();
  };
  document.getElementById('modal-reject-btn').onclick = function() {
    rejectExpense(expenseId, document.getElementById('approval-comment').value);
    closeModal('approval-modal');
    renderApprovals(); renderExpenses(); renderNotifications();
  };
  openModal('approval-modal');
};

/** Handle reject button click */
window.handleReject = function(expenseId) {
  const reason = prompt('Reason for rejection (optional):');
  rejectExpense(expenseId, reason || '');
  renderApprovals(); renderExpenses(); renderNotifications();
};
