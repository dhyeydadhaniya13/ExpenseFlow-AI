/* ===== RBAC — Role-Based Access Control ===== */

const ROLES = {
  super_admin: { name: 'Super Admin', level: 5, description: 'Full system access' },
  admin:       { name: 'Admin',       level: 4, description: 'System administration' },
  manager:     { name: 'Manager',     level: 3, description: 'Team management and approvals' },
  employee:    { name: 'Employee',    level: 2, description: 'Standard user access' },
  auditor:     { name: 'Auditor',     level: 1, description: 'Read-only audit access' },
  user:        { name: 'Employee',    level: 2, description: 'Standard user access' },
};

const PERMISSIONS = {
  super_admin: {
    expenses:['create','read','update','delete','approve','export'],
    projects:['create','read','update','delete','export'],
    tasks:['create','read','update','delete'],
    budgets:['create','read','update','delete'],
    reports:['read','export'],
    analytics:['read'],
    audit:['read','export'],
    users:['create','read','update','delete'],
    approvals:['read','approve','reject'],
  },
  admin: {
    expenses:['create','read','update','delete','approve','export'],
    projects:['create','read','update','delete','export'],
    tasks:['create','read','update','delete'],
    budgets:['create','read','update','delete'],
    reports:['read','export'],
    analytics:['read'],
    audit:['read','export'],
    users:['create','read','update'],
    approvals:['read','approve','reject'],
  },
  manager: {
    expenses:['create','read','update','delete','approve','export'],
    projects:['create','read','update','delete'],
    tasks:['create','read','update','delete'],
    budgets:['create','read','update','delete'],
    reports:['read','export'],
    analytics:['read'],
    audit:['read'],
    users:['read'],
    approvals:['read','approve','reject'],
  },
  employee: {
    expenses:['create','read','update','delete'],
    projects:['read'],
    tasks:['create','read','update'],
    budgets:['read'],
    reports:['read'],
    analytics:['read'],
    audit:[],
    users:[],
    approvals:['read'],
  },
  auditor: {
    expenses:['read','export'],
    projects:['read'],
    tasks:['read'],
    budgets:['read'],
    reports:['read','export'],
    analytics:['read'],
    audit:['read','export'],
    users:['read'],
    approvals:['read'],
  },
  user: {
    expenses:['create','read','update','delete'],
    projects:['read'],
    tasks:['create','read','update'],
    budgets:['read'],
    reports:['read'],
    analytics:['read'],
    audit:[],
    users:[],
    approvals:['read'],
  },
};

function hasPermission(user, resource, action) {
  if (!user || !user.role) return false;
  const role = user.role.toLowerCase();
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  const resourcePerms = perms[resource];
  if (!resourcePerms) return false;
  return resourcePerms.includes(action);
}

function getVisibleNavItems(role) {
  const r = (role || '').toLowerCase();
  const base = ['dashboard', 'expenses', 'projects', 'tasks', 'budgets'];
  const level = ROLES[r] ? ROLES[r].level : 2;
  if (level >= 3) base.push('analytics', 'reports', 'smart', 'approvals');
  else base.push('analytics', 'reports', 'smart');
  if (level >= 4) base.push('audit');
  if (r === 'auditor') { base.push('audit', 'analytics', 'reports'); }
  return [...new Set(base)];
}

function canApprove(user, expense) {
  if (!user) return false;
  const level = ROLES[user.role] ? ROLES[user.role].level : 0;
  if (level >= 3) return true;
  return false;
}

function getRoleBadgeClass(role) {
  const map = { super_admin:'badge-red', admin:'badge-purple', manager:'badge-blue', employee:'badge-green', auditor:'badge-orange', user:'badge-green' };
  return map[(role||'').toLowerCase()] || 'badge-ghost';
}

function getRoleDisplayName(role) {
  const r = ROLES[(role||'').toLowerCase()];
  return r ? r.name : 'User';
}

function isAtLeast(userRole, requiredRole) {
  const uLevel = ROLES[(userRole||'').toLowerCase()] ? ROLES[(userRole||'').toLowerCase()].level : 0;
  const rLevel = ROLES[(requiredRole||'').toLowerCase()] ? ROLES[(requiredRole||'').toLowerCase()].level : 0;
  return uLevel >= rLevel;
}
