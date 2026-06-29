/* ===== AUDIT LOG SYSTEM ===== */

const AUDIT_ACTIONS = {
  EXPENSE_CREATED: 'Expense Created',
  EXPENSE_UPDATED: 'Expense Updated',
  EXPENSE_DELETED: 'Expense Deleted',
  BUDGET_CREATED: 'Budget Created',
  BUDGET_MODIFIED: 'Budget Modified',
  BUDGET_DELETED: 'Budget Deleted',
  PROJECT_CREATED: 'Project Created',
  PROJECT_UPDATED: 'Project Updated',
  PROJECT_DELETED: 'Project Deleted',
  TASK_CREATED: 'Task Created',
  TASK_UPDATED: 'Task Updated',
  TASK_DELETED: 'Task Deleted',
  USER_LOGIN: 'User Login',
  USER_LOGOUT: 'User Logout',
  USER_REGISTER: 'User Register',
  APPROVAL_SUBMITTED: 'Approval Submitted',
  APPROVAL_APPROVED: 'Approval Approved',
  APPROVAL_REJECTED: 'Approval Rejected',
};

/** Log an audit event */
function logAudit(action, resource, resourceId, previousValue, newValue, resourceName) {
  try {
    const user = getCurrentUser();
    const logs = getAuditLogs();
    logs.unshift({
      id: genId(),
      userId: user ? user.id : 'system',
      userName: user ? user.name : 'System',
      userRole: user ? user.role : '',
      action: action,
      resource: resource || '',
      resourceId: resourceId || '',
      resourceName: resourceName || '',
      previousValue: previousValue ? JSON.stringify(previousValue).slice(0, 300) : null,
      newValue: newValue ? JSON.stringify(newValue).slice(0, 300) : null,
      timestamp: new Date().toISOString(),
    });
    /* Keep max 500 entries */
    if (logs.length > 500) logs.length = 500;
    saveAuditLogs(logs);
  } catch (e) { console.warn('Audit log error:', e); }
}

/** Get filtered audit logs */
function getFilteredAuditLogs(filters) {
  let logs = getAuditLogs();
  if (!filters) return logs;
  if (filters.search) {
    const s = filters.search.toLowerCase();
    logs = logs.filter(l => (l.userName || '').toLowerCase().includes(s) || (l.action || '').toLowerCase().includes(s) || (l.resourceName || '').toLowerCase().includes(s) || (l.resource || '').toLowerCase().includes(s));
  }
  if (filters.action) logs = logs.filter(l => l.action === filters.action);
  if (filters.dateFrom) logs = logs.filter(l => l.timestamp >= filters.dateFrom);
  if (filters.dateTo) logs = logs.filter(l => l.timestamp <= filters.dateTo + 'T23:59:59');
  if (filters.userId) logs = logs.filter(l => l.userId === filters.userId);
  return logs;
}

/** Get badge class for action type */
function getAuditActionBadgeClass(action) {
  if (!action) return 'badge-ghost';
  const a = action.toLowerCase();
  if (a.includes('created') || a.includes('register')) return 'badge-green';
  if (a.includes('updated') || a.includes('modified')) return 'badge-blue';
  if (a.includes('deleted')) return 'badge-red';
  if (a.includes('login') || a.includes('logout')) return 'badge-purple';
  if (a.includes('approved')) return 'badge-green';
  if (a.includes('rejected')) return 'badge-red';
  if (a.includes('submitted')) return 'badge-yellow';
  return 'badge-ghost';
}

/** Get audit statistics */
function getAuditStats() {
  const logs = getAuditLogs();
  const todayStr = today();
  const todayActions = logs.filter(l => l.timestamp && l.timestamp.startsWith(todayStr)).length;
  const userCounts = {};
  const actionCounts = {};
  logs.forEach(l => {
    userCounts[l.userName] = (userCounts[l.userName] || 0) + 1;
    actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
  });
  const topUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
  const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];
  return {
    totalLogs: logs.length,
    todayActions,
    topUser: topUser ? { name: topUser[0], count: topUser[1] } : { name: '—', count: 0 },
    topAction: topAction ? { action: topAction[0], count: topAction[1] } : { action: '—', count: 0 },
  };
}

/** Render the audit log page */
function renderAuditLog() {
  const stats = getAuditStats();
  const statsBar = document.getElementById('audit-stats-bar');
  if (statsBar) {
    statsBar.innerHTML = `
      <div class="audit-stat"><div class="stat-label">Total Logs</div><div class="stat-value">${stats.totalLogs}</div></div>
      <div class="audit-stat"><div class="stat-label">Today's Actions</div><div class="stat-value">${stats.todayActions}</div></div>
      <div class="audit-stat"><div class="stat-label">Most Active User</div><div class="stat-value" style="font-size:0.95rem">${stats.topUser.name}</div><div class="stat-change">${stats.topUser.count} actions</div></div>
      <div class="audit-stat"><div class="stat-label">Top Action</div><div class="stat-value" style="font-size:0.95rem">${stats.topAction.action}</div><div class="stat-change">${stats.topAction.count} times</div></div>`;
  }

  const container = document.getElementById('audit-content');
  if (!container) return;

  const filters = {
    search: container.querySelector('#audit-search') ? container.querySelector('#audit-search').value : '',
    action: container.querySelector('#audit-action-filter') ? container.querySelector('#audit-action-filter').value : '',
    dateFrom: container.querySelector('#audit-date-from') ? container.querySelector('#audit-date-from').value : '',
    dateTo: container.querySelector('#audit-date-to') ? container.querySelector('#audit-date-to').value : '',
  };
  const logs = getFilteredAuditLogs(filters.search || filters.action || filters.dateFrom || filters.dateTo ? filters : null);

  const actionOptions = Object.values(AUDIT_ACTIONS).map(a => `<option value="${a}" ${filters.action === a ? 'selected' : ''}>${a}</option>`).join('');

  container.innerHTML = `
    <div class="audit-filters">
      <input type="text" id="audit-search" class="input-sm" placeholder="Search logs..." value="${filters.search}" style="min-width:180px">
      <select id="audit-action-filter" class="input-sm"><option value="">All Actions</option>${actionOptions}</select>
      <input type="date" id="audit-date-from" class="input-sm" value="${filters.dateFrom}">
      <input type="date" id="audit-date-to" class="input-sm" value="${filters.dateTo}">
      <button class="btn btn-secondary btn-sm btn-with-icon" onclick="exportAuditCSV()">${icon('file-text',14)} CSV</button>
      <button class="btn btn-secondary btn-sm btn-with-icon" onclick="exportAuditPDF()">${icon('file',14)} PDF</button>
    </div>
    ${logs.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Resource</th><th>Details</th></tr></thead>
      <tbody>${logs.slice(0, 100).map(l => `<tr>
        <td style="white-space:nowrap;font-size:0.75rem">${fmtDate(l.timestamp)}<br><span style="color:var(--text-3)">${new Date(l.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span></td>
        <td><span class="badge ${getRoleBadgeClass(l.userRole)}" style="margin-right:4px">${getRoleDisplayName(l.userRole)}</span>${l.userName}</td>
        <td><span class="badge ${getAuditActionBadgeClass(l.action)}">${l.action}</span></td>
        <td>${l.resourceName || l.resource || '—'}</td>
        <td class="audit-detail-cell">${l.previousValue && l.newValue ? icon('refresh-cw',14)+' changed' : l.newValue ? 'created' : l.previousValue ? 'removed' : '-'}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="empty-state-sm">No audit logs match your filters</p>'}`;

  /* Attach filter listeners */
  const search = container.querySelector('#audit-search');
  const actionFilter = container.querySelector('#audit-action-filter');
  const dateFrom = container.querySelector('#audit-date-from');
  const dateTo = container.querySelector('#audit-date-to');
  if (search) search.oninput = () => renderAuditLog();
  if (actionFilter) actionFilter.onchange = () => renderAuditLog();
  if (dateFrom) dateFrom.onchange = () => renderAuditLog();
  if (dateTo) dateTo.onchange = () => renderAuditLog();
}

/** Export audit logs as CSV */
function exportAuditCSV() {
  const logs = getFilteredAuditLogs(null);
  if (!logs.length) { toast('No audit logs to export', 'warning'); return; }
  const rows = [['Timestamp', 'User', 'Role', 'Action', 'Resource', 'Resource Name', 'Details']];
  logs.forEach(l => rows.push([l.timestamp, l.userName, l.userRole, l.action, l.resource, l.resourceName, (l.newValue || '').slice(0, 100)]));
  const csv = rows.map(r => r.map(c => '"' + String(c || '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'audit_log.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('Audit CSV exported!');
}

/** Export audit logs as PDF */
function exportAuditPDF() {
  const logs = getFilteredAuditLogs(null);
  if (!logs.length) { toast('No audit logs to export', 'warning'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Audit Log Report', 14, 20);
    doc.setFontSize(9); doc.text('Generated: ' + new Date().toLocaleDateString('en-IN'), 14, 27);
    const rows = logs.slice(0, 200).map(l => [new Date(l.timestamp).toLocaleString('en-IN'), l.userName, l.action, l.resourceName || l.resource || '—']);
    doc.autoTable({ head: [['Timestamp', 'User', 'Action', 'Resource']], body: rows, startY: 32, styles: { fontSize: 8 }, headStyles: { fillColor: [76, 141, 255] } });
    doc.save('audit_log.pdf');
    toast('Audit PDF exported!');
  } catch (e) { toast('PDF export error', 'error'); }
}
