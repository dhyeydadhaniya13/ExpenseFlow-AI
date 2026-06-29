/* ===== APP — Events & Core Logic ===== */

// --- Auth ---
document.getElementById('show-register').onclick=e=>{e.preventDefault();document.getElementById('login-form').style.display='none';document.getElementById('register-form').style.display='block';};
document.getElementById('show-login').onclick=e=>{e.preventDefault();document.getElementById('register-form').style.display='none';document.getElementById('login-form').style.display='block';};

document.getElementById('register-form').onsubmit=async e=>{
  e.preventDefault();
  const name=document.getElementById('reg-name').value.trim();
  const email=document.getElementById('reg-email').value.trim();
  const pw=document.getElementById('reg-password').value;
  const role=document.getElementById('reg-role').value;
  const users=getUsers();
  if(users.find(u=>u.email===email)){toast('Email already exists','error');return;}
  const user={id:genId(),name,email,password:btoa(pw),role,createdAt:new Date().toISOString()};
  users.push(user); saveUsers(users);
  setCurrentUser({id:user.id,name,email,role});
  seedIfEmpty(); 
  if(typeof window.syncWithDatabase === 'function') await window.syncWithDatabase();
  enterApp();
  if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.USER_REGISTER,'user',user.id,null,{name,email,role},name);
  toast('Account created!');
};

document.getElementById('login-form').onsubmit=async e=>{
  e.preventDefault();
  const email=document.getElementById('login-email').value.trim();
  const pw=document.getElementById('login-password').value;
  const users=getUsers();
  const user=users.find(u=>u.email===email&&atob(u.password)===pw);
  if(!user){toast('Invalid email or password','error');return;}
  setCurrentUser({id:user.id,name:user.name,email:user.email,role:user.role});
  seedIfEmpty(); 
  if(typeof window.syncWithDatabase === 'function') await window.syncWithDatabase();
  enterApp();
  if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.USER_LOGIN,'user',user.id,null,null,user.name);
  toast('Welcome back, '+user.name+'!');
};

document.getElementById('logout-btn').onclick=()=>{
  if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.USER_LOGOUT,'user','','','','');
  localStorage.removeItem('ef_current_user');
  document.getElementById('app').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('login-form').reset();
};

function enterApp(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='block';
  const u=getCurrentUser();
  if(u){
    document.getElementById('user-name').textContent=u.name;
    document.getElementById('user-role').textContent=getRoleDisplayName(u.role);
    document.getElementById('user-avatar').textContent=u.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  }
  populateCategorySelects(); populateProjectSelects();
  applyRBAC();
  navigateTo('dashboard');
  checkBudgetAlerts(); renderNotifications();
  /* Initialize AI modules */
  if(typeof initReceiptScanner==='function') initReceiptScanner();
  if(typeof initChatbot==='function') initChatbot();
}

/* --- RBAC — Apply role-based visibility --- */
function applyRBAC(){
  const user=getCurrentUser();
  if(!user) return;
  const visible=getVisibleNavItems(user.role);
  document.querySelectorAll('.nav-item[data-page]').forEach(n=>{
    const page=n.dataset.page;
    if(visible.includes(page)){
      n.style.display='';
    } else {
      n.style.display='none';
    }
  });
}

// --- Navigation ---
function navigateTo(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const el=document.getElementById('page-'+page);
  if(el) el.classList.add('active');
  const nav=document.querySelector(`[data-page="${page}"]`);
  if(nav) nav.classList.add('active');
  const titles={dashboard:'Dashboard',expenses:'Expenses',projects:'Projects',tasks:'Tasks',budgets:'Budgets',analytics:'Analytics',reports:'Reports',smart:'AI Insights',approvals:'Approvals',audit:'Audit Log'};
  document.getElementById('page-title').textContent=titles[page]||'Dashboard';
  if(page==='dashboard') renderDashboard();
  else if(page==='expenses') renderExpenses();
  else if(page==='projects') renderProjects();
  else if(page==='tasks') renderTasks();
  else if(page==='budgets') renderBudgets();
  else if(page==='analytics') renderAnalytics();
  else if(page==='smart') renderSmartInsights();
  else if(page==='approvals' && typeof renderApprovals==='function') renderApprovals();
  else if(page==='audit' && typeof renderAuditLog==='function') renderAuditLog();
}

document.querySelectorAll('.nav-item').forEach(n=>{
  n.onclick=e=>{e.preventDefault();navigateTo(n.dataset.page);
    document.getElementById('sidebar').classList.remove('open');}
});

// Mobile menu
document.getElementById('mobile-menu-btn').onclick=()=>document.getElementById('sidebar').classList.toggle('open');

// --- Modals ---
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('[data-close]').forEach(b=>{b.onclick=()=>closeModal(b.dataset.close);});
document.querySelectorAll('.modal-overlay').forEach(m=>{m.onclick=e=>{if(e.target===m)closeModal(m.id);};});

// --- Notifications ---
document.getElementById('notif-btn').onclick=()=>document.getElementById('notif-dropdown').classList.toggle('open');
document.getElementById('clear-notifs').onclick=()=>{const n=getNotifs();n.forEach(x=>x.read=true);saveNotifs(n);renderNotifications();};
document.addEventListener('click',e=>{
  if(!e.target.closest('.notif-btn')&&!e.target.closest('.notif-dropdown'))
    document.getElementById('notif-dropdown').classList.remove('open');
});

// --- Expense CRUD ---
document.getElementById('add-expense-btn').onclick=()=>{
  document.getElementById('expense-form').reset();document.getElementById('exp-id').value='';
  document.getElementById('exp-date').value=today();
  document.getElementById('expense-modal-title').textContent='Add Expense';
  document.getElementById('receipt-preview').innerHTML='';
  document.getElementById('scan-results').style.display='none';
  document.getElementById('scan-progress').style.display='none';
  const confEl=document.getElementById('cat-confidence');
  if(confEl) confEl.textContent='';
  openModal('expense-modal');
};

/* Track the auto-suggested category for learning */
let _lastAutoCat='';
document.getElementById('exp-desc').addEventListener('blur',function(){
  if(!document.getElementById('exp-id').value){
    const cat=autoCategorize(this.value);
    _lastAutoCat=cat;
    document.getElementById('exp-category').value=cat;
    const confEl=document.getElementById('cat-confidence');
    if(confEl) confEl.textContent='(auto-suggested)';
  }
});

document.getElementById('exp-receipt').onchange=function(){
  const file=this.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{document.getElementById('receipt-preview').innerHTML=`<img src="${e.target.result}">`};
  reader.readAsDataURL(file);
};

document.getElementById('expense-form').onsubmit=e=>{
  e.preventDefault();
  const expenses=getExpenses();
  const id=document.getElementById('exp-id').value;
  const data={
    description:document.getElementById('exp-desc').value.trim(),
    amount:parseFloat(document.getElementById('exp-amount').value),
    category:document.getElementById('exp-category').value,
    date:document.getElementById('exp-date').value,
    projectId:document.getElementById('exp-project').value,
    paymentMethod:document.getElementById('exp-payment').value,
    status:'pending',receipt:null
  };
  const receiptImg=document.getElementById('receipt-preview').querySelector('img');
  if(receiptImg) data.receipt=receiptImg.src;

  /* Record category correction if user changed auto-suggested category */
  if(!id && _lastAutoCat && _lastAutoCat!==data.category){
    recordCategoryCorrection(data.description, _lastAutoCat, data.category);
  }

  if(id){
    const idx=expenses.findIndex(x=>x.id===id);
    const prev={...expenses[idx]};
    if(idx>=0) Object.assign(expenses[idx],data);
    if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.EXPENSE_UPDATED,'expense',id,prev,data,data.description);
    toast('Expense updated');
  } else {
    data.id=genId(); data.createdAt=new Date().toISOString();
    expenses.push(data);
    if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.EXPENSE_CREATED,'expense',data.id,null,data,data.description);
    toast('Expense added');
  }
  saveExpenses(expenses); closeModal('expense-modal');
  renderExpenses(); checkBudgetAlerts(); renderNotifications();
  _lastAutoCat='';
};

window.editExpense=id=>{
  const e=getExpenses().find(x=>x.id===id); if(!e) return;
  document.getElementById('exp-id').value=e.id;
  document.getElementById('exp-desc').value=e.description;
  document.getElementById('exp-amount').value=e.amount;
  document.getElementById('exp-category').value=e.category;
  document.getElementById('exp-date').value=e.date;
  document.getElementById('exp-project').value=e.projectId||'';
  document.getElementById('exp-payment').value=e.paymentMethod||'cash';
  document.getElementById('receipt-preview').innerHTML=e.receipt?`<img src="${e.receipt}">`:'';
  document.getElementById('expense-modal-title').textContent='Edit Expense';
  document.getElementById('scan-results').style.display='none';
  document.getElementById('scan-progress').style.display='none';
  openModal('expense-modal');
};
window.deleteExpense=id=>{
  if(!confirm('Delete this expense?')) return;
  const expenses=getExpenses();
  const exp=expenses.find(x=>x.id===id);
  if(typeof logAudit==='function'&&exp) logAudit(AUDIT_ACTIONS.EXPENSE_DELETED,'expense',id,exp,null,exp.description);
  saveExpenses(expenses.filter(x=>x.id!==id));renderExpenses();toast('Expense deleted');
};

// Filters
document.getElementById('filter-category').onchange=renderExpenses;
document.getElementById('filter-month').onchange=renderExpenses;
document.getElementById('filter-project').onchange=renderExpenses;

// --- Project CRUD ---
document.getElementById('add-project-btn').onclick=()=>{
  document.getElementById('project-form').reset();document.getElementById('proj-id').value='';
  document.getElementById('project-modal-title').textContent='New Project';
  openModal('project-modal');
};
document.getElementById('project-form').onsubmit=e=>{
  e.preventDefault();
  const projects=getProjects();
  const id=document.getElementById('proj-id').value;
  const data={name:document.getElementById('proj-name').value.trim(),description:document.getElementById('proj-desc').value.trim(),
    budget:parseFloat(document.getElementById('proj-budget').value)||0,status:document.getElementById('proj-status').value,
    startDate:document.getElementById('proj-start').value,endDate:document.getElementById('proj-end').value};
  if(id){
    const idx=projects.findIndex(x=>x.id===id);
    const prev={...projects[idx]};
    if(idx>=0)Object.assign(projects[idx],data);
    if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.PROJECT_UPDATED,'project',id,prev,data,data.name);
    toast('Project updated');
  }
  else{
    data.id=genId();data.createdAt=new Date().toISOString();projects.push(data);
    if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.PROJECT_CREATED,'project',data.id,null,data,data.name);
    toast('Project created');
  }
  saveProjects(projects);closeModal('project-modal');renderProjects();populateProjectSelects();
};
window.editProject=id=>{
  const p=getProjects().find(x=>x.id===id);if(!p)return;
  document.getElementById('proj-id').value=p.id;document.getElementById('proj-name').value=p.name;
  document.getElementById('proj-desc').value=p.description||'';document.getElementById('proj-budget').value=p.budget;
  document.getElementById('proj-status').value=p.status;document.getElementById('proj-start').value=p.startDate||'';
  document.getElementById('proj-end').value=p.endDate||'';document.getElementById('project-modal-title').textContent='Edit Project';
  openModal('project-modal');
};
window.deleteProject=id=>{
  if(!confirm('Delete this project?'))return;
  const projects=getProjects();
  const p=projects.find(x=>x.id===id);
  if(typeof logAudit==='function'&&p) logAudit(AUDIT_ACTIONS.PROJECT_DELETED,'project',id,p,null,p.name);
  saveProjects(projects.filter(x=>x.id!==id));renderProjects();toast('Project deleted');
};

// --- Task CRUD ---
document.getElementById('add-task-btn').onclick=()=>{
  document.getElementById('task-form').reset();document.getElementById('task-id').value='';
  document.getElementById('task-modal-title').textContent='Add Task';openModal('task-modal');
};
document.getElementById('task-form').onsubmit=e=>{
  e.preventDefault(); const tasks=getTasks(); const id=document.getElementById('task-id').value;
  const data={title:document.getElementById('task-title').value.trim(),description:document.getElementById('task-desc-input').value.trim(),
    projectId:document.getElementById('task-project').value,priority:document.getElementById('task-priority').value,
    status:document.getElementById('task-status').value,dueDate:document.getElementById('task-due').value};
  if(id){
    const idx=tasks.findIndex(x=>x.id===id);
    const prev={...tasks[idx]};
    if(idx>=0)Object.assign(tasks[idx],data);
    if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.TASK_UPDATED,'task',id,prev,data,data.title);
    toast('Task updated');
  }
  else{
    data.id=genId();data.createdAt=new Date().toISOString();tasks.push(data);
    if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.TASK_CREATED,'task',data.id,null,data,data.title);
    toast('Task added');
  }
  saveTasks(tasks);closeModal('task-modal');renderTasks();
};
window.editTask=id=>{
  const t=getTasks().find(x=>x.id===id);if(!t)return;
  document.getElementById('task-id').value=t.id;document.getElementById('task-title').value=t.title;
  document.getElementById('task-desc-input').value=t.description||'';document.getElementById('task-project').value=t.projectId||'';
  document.getElementById('task-priority').value=t.priority;document.getElementById('task-status').value=t.status;
  document.getElementById('task-due').value=t.dueDate||'';document.getElementById('task-modal-title').textContent='Edit Task';
  openModal('task-modal');
};
window.deleteTask=id=>{
  if(!confirm('Delete?'))return;
  const tasks=getTasks();
  const t=tasks.find(x=>x.id===id);
  if(typeof logAudit==='function'&&t) logAudit(AUDIT_ACTIONS.TASK_DELETED,'task',id,t,null,t.title);
  saveTasks(tasks.filter(x=>x.id!==id));renderTasks();toast('Task deleted');
};
window.moveTask=(id,status)=>{const tasks=getTasks();const t=tasks.find(x=>x.id===id);if(t){const prev=t.status;t.status=status;saveTasks(tasks);if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.TASK_UPDATED,'task',id,{status:prev},{status},t.title);renderTasks();toast('Task moved');}};
document.getElementById('task-project-filter').onchange=renderTasks;

// --- Budget CRUD ---
document.getElementById('add-budget-btn').onclick=()=>{document.getElementById('budget-form').reset();document.getElementById('bud-id').value='';openModal('budget-modal');};
document.getElementById('budget-form').onsubmit=e=>{
  e.preventDefault();const budgets=getBudgets();const id=document.getElementById('bud-id').value;
  const data={amount:parseFloat(document.getElementById('bud-amount').value),period:document.getElementById('bud-period').value,
    category:document.getElementById('bud-category').value,alertThreshold:parseInt(document.getElementById('bud-alert').value)||80};
  if(id){
    const idx=budgets.findIndex(x=>x.id===id);
    const prev={...budgets[idx]};
    if(idx>=0)Object.assign(budgets[idx],data);
    if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.BUDGET_MODIFIED,'budget',id,prev,data,(data.category?getCat(data.category).name:'Overall')+' Budget');
    toast('Budget updated');
  }
  else{
    data.id=genId();data.createdAt=new Date().toISOString();budgets.push(data);
    if(typeof logAudit==='function') logAudit(AUDIT_ACTIONS.BUDGET_CREATED,'budget',data.id,null,data,(data.category?getCat(data.category).name:'Overall')+' Budget');
    toast('Budget set');
  }
  saveBudgets(budgets);closeModal('budget-modal');renderBudgets();checkBudgetAlerts();renderNotifications();
};
window.deleteBudget=id=>{
  if(!confirm('Delete?'))return;
  const budgets=getBudgets();
  const b=budgets.find(x=>x.id===id);
  if(typeof logAudit==='function'&&b) logAudit(AUDIT_ACTIONS.BUDGET_DELETED,'budget',id,b,null,(b.category?getCat(b.category).name:'Overall')+' Budget');
  saveBudgets(budgets.filter(x=>x.id!==id));renderBudgets();toast('Budget removed');
};

/* Budget recommendations refresh */
const refreshRecBtn=document.getElementById('refresh-recommendations-btn');
if(refreshRecBtn) refreshRecBtn.onclick=()=>{renderBudgetRecommendations();toast('Recommendations refreshed');};

// --- Init ---
(async function init(){
  const user=getCurrentUser();
  if(user){
    seedIfEmpty();
    if(typeof window.syncWithDatabase === 'function') await window.syncWithDatabase();
    enterApp();
  }
  else{document.getElementById('auth-screen').style.display='flex';}
})();
