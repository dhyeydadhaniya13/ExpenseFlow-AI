/* ===== UI RENDERING ===== */
const colorMap={travel:'#4c8dff',food:'#fb923c',utilities:'#fbbf24',office:'#a78bfa',software:'#34d399',transport:'#4c8dff',marketing:'#f87171',salary:'#34d399',rent:'#fbbf24',other:'#8b8fa3'};

function toast(msg,type='success'){
  const c=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className='toast toast-'+type;
  t.textContent=msg;
  c.appendChild(t);
  setTimeout(()=>t.remove(),3500);
}

function populateCategorySelects(){
  const sels=[document.getElementById('exp-category'),document.getElementById('filter-category'),document.getElementById('bud-category')];
  sels.forEach(sel=>{
    if(!sel) return;
    const isFilter=sel.id.startsWith('filter')||sel.id.startsWith('bud');
    
    let html=isFilter?'<option value="">All Categories</option>':'';
    CATEGORIES.forEach(c=>{ html+=`<option value="${c.id}">${c.name}</option>`; });
    sel.innerHTML=html;

    if(sel.nextElementSibling && sel.nextElementSibling.classList.contains('custom-sel-wrap')) {
      sel.nextElementSibling.remove();
    }

    sel.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'custom-sel-wrap';
    wrap.style.position = 'relative';
    wrap.style.width = '100%';

    const trigger = document.createElement('div');
    trigger.className = sel.className.includes('input-sm') ? 'input-sm' : 'input';
    trigger.style.display = 'flex';
    trigger.style.alignItems = 'center';
    trigger.style.justifyContent = 'space-between';
    trigger.style.cursor = 'pointer';
    trigger.style.userSelect = 'none';

    const menu = document.createElement('div');
    menu.style.position = 'absolute';
    menu.style.top = '100%';
    menu.style.left = '0';
    menu.style.right = '0';
    menu.style.zIndex = '100';
    menu.style.background = 'var(--bg-1)';
    menu.style.border = '1px solid var(--border)';
    menu.style.borderRadius = 'var(--r-sm)';
    menu.style.marginTop = '4px';
    menu.style.display = 'none';
    menu.style.maxHeight = '220px';
    menu.style.overflowY = 'auto';
    menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';

    let options = isFilter ? [{id:'', name:'All Categories', icon:''}] : [];
    options = options.concat(CATEGORIES.map(c => ({id: c.id, name: c.name, icon: typeof catIcon==='function'?catIcon(c.id):''})));

    const renderTrigger = () => {
      const selected = options.find(o => o.id === sel.value) || options[0];
      trigger.innerHTML = `<div style="display:flex;align-items:center;gap:8px">${selected.icon ? `<span style="display:flex;align-items:center;width:16px;height:16px;color:var(--text-1)">${selected.icon}</span>` : ''} <span>${selected.name}</span></div> <span style="opacity:0.5;font-size:0.7rem">▼</span>`;
    };

    options.forEach(opt => {
      const item = document.createElement('div');
      item.style.padding = '8px 12px';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '8px';
      item.style.cursor = 'pointer';
      item.style.fontSize = '0.85rem';
      item.style.borderBottom = '1px solid var(--border)';
      item.innerHTML = `${opt.icon ? `<span style="display:flex;align-items:center;width:16px;height:16px;color:var(--text-1)">${opt.icon}</span>` : ''} <span>${opt.name}</span>`;
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-2)');
      item.addEventListener('mouseleave', () => item.style.background = 'transparent');
      item.addEventListener('click', () => {
        sel.value = opt.id;
        sel.dispatchEvent(new Event('change'));
        renderTrigger();
        menu.style.display = 'none';
      });
      menu.appendChild(item);
    });

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.style.display === 'block';
      document.querySelectorAll('.custom-sel-wrap > div:nth-child(2)').forEach(m => m.style.display = 'none');
      menu.style.display = isOpen ? 'none' : 'block';
    });

    renderTrigger();
    sel.addEventListener('change', renderTrigger);
    
    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    sel.parentNode.insertBefore(wrap, sel.nextSibling);
  });

  if(!window.customSelInit){
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-sel-wrap > div:nth-child(2)').forEach(m => m.style.display = 'none');
    });
    window.customSelInit = true;
  }
}

function populateProjectSelects(){
  const projects=getProjects();
  const sels=[document.getElementById('exp-project'),document.getElementById('filter-project'),document.getElementById('task-project'),document.getElementById('task-project-filter')];
  sels.forEach(sel=>{
    if(!sel) return;
    const isFilter=sel.id.includes('filter')||sel.id==='exp-project';
    let html=isFilter?'<option value="">'+(sel.id.includes('filter')?'All Projects':'None')+'</option>':'';
    projects.forEach(p=>{ html+=`<option value="${p.id}">${p.name}</option>`; });
    sel.innerHTML=html;
  });
}

/* --- Enhanced Dashboard --- */
function renderDashboard(){
  const expenses=getExpenses(), projects=getProjects(), tasks=getTasks(), budgets=getBudgets();
  const thisMonth=new Date().toISOString().slice(0,7);
  const monthExp=expenses.filter(e=>e.date&&e.date.startsWith(thisMonth));
  const totalThisMonth=monthExp.reduce((s,e)=>s+Number(e.amount),0);
  const lastMonth=new Date(); lastMonth.setMonth(lastMonth.getMonth()-1);
  const lmKey=lastMonth.toISOString().slice(0,7);
  const totalLastMonth=expenses.filter(e=>e.date&&e.date.startsWith(lmKey)).reduce((s,e)=>s+Number(e.amount),0);
  const change=totalLastMonth?Math.round((totalThisMonth-totalLastMonth)/totalLastMonth*100):0;
  const activeProjects=projects.filter(p=>p.status==='active').length;
  const pendingTasks=tasks.filter(t=>t.status!=='done').length;
  const totalBudget=budgets.filter(b=>b.period==='monthly').reduce((s,b)=>s+Number(b.amount),0);
  const pendingApprovals=expenses.filter(e=>e.status==='submitted'||e.status==='manager_approved').length;

  /* Get health score */
  let healthScore=0, healthGrade='—';
  try { const h=calculateFinancialHealth(); healthScore=h.score; healthGrade=h.grade; } catch(e){}

  /* Get spending velocity */
  let velocity={dailyRate:0,projectedMonthEnd:0};
  try { velocity=getSpendingVelocity(); } catch(e){}

  /* 6 KPI Cards */
  document.getElementById('dashboard-stats').innerHTML=`
    <div class="stat-card animate-in stagger-1">
      <div class="stat-label">This Month</div>
      <div class="stat-value">${fmtCurrency(totalThisMonth)}</div>
      <div class="stat-change ${change>=0?'stat-down':'stat-up'}">${change>=0?icon('trending-up',14):icon('trending-down',14)} ${Math.abs(change)}% vs last month</div>
    </div>
    <div class="stat-card animate-in stagger-2">
      <div class="stat-label">Active Projects</div>
      <div class="stat-value">${activeProjects}</div>
      <div class="stat-change stat-up">${projects.length} total</div>
    </div>
    <div class="stat-card animate-in stagger-3">
      <div class="stat-label">Pending Tasks</div>
      <div class="stat-value">${pendingTasks}</div>
      <div class="stat-change">${tasks.filter(t=>t.status==='done').length} completed</div>
    </div>
    <div class="stat-card animate-in stagger-4">
      <div class="stat-label">Monthly Budget</div>
      <div class="stat-value">${fmtCurrency(totalBudget)}</div>
      <div class="stat-change ${totalThisMonth>totalBudget?'stat-down':'stat-up'}">${totalBudget?Math.round(totalThisMonth/totalBudget*100):0}% used</div>
    </div>
    <div class="stat-card animate-in stagger-5">
      <div class="stat-label">Health Score</div>
      <div class="stat-value" style="color:${healthScore>=70?'var(--green)':healthScore>=50?'var(--yellow)':'var(--red)'}">${healthScore}<span style="font-size:0.7rem;color:var(--text-3)">/100</span></div>
      <div class="stat-change">Grade ${healthGrade}</div>
    </div>
    <div class="stat-card animate-in stagger-6">
      <div class="stat-label">Pending Approvals</div>
      <div class="stat-value" style="color:${pendingApprovals>0?'var(--yellow)':'var(--green)'}">${pendingApprovals}</div>
      <div class="stat-change" style="display:flex;align-items:center;gap:4px;">${pendingApprovals>0?icon('alert-circle',14)+' Needs attention':icon('check-circle',14)+' All clear'}</div>
    </div>`;

  /* Render Health Gauge */
  renderHealthGauge(healthScore, healthGrade);

  /* Render Forecast Chart */
  renderForecastChart();

  /* Recent expenses */
  const recent=expenses.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  document.getElementById('recent-expenses').innerHTML=recent.length?
    '<div class="item-list">'+recent.map(e=>{
      const cat=getCat(e.category);
      return `<div class="item-row"><div class="item-left"><div class="item-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</div><div><div class="item-name">${e.description}</div><div class="item-sub">${fmtDate(e.date)}</div></div></div><div class="item-amount">${fmtCurrency(e.amount)}</div></div>`;
    }).join('')+'</div>':'<p class="empty-state-sm">No expenses yet</p>';

  /* Project overview */
  document.getElementById('project-overview').innerHTML=projects.length?
    '<div class="item-list">'+projects.map(p=>{
      const projExp=expenses.filter(e=>e.projectId===p.id).reduce((s,e)=>s+Number(e.amount),0);
      const pct=p.budget?Math.min(100,Math.round(projExp/p.budget*100)):0;
      const color=pct>90?'var(--red)':pct>60?'var(--yellow)':'var(--green)';
      return `<div class="item-row"><div class="item-left"><div><div class="item-name">${p.name}</div><div class="item-sub">${fmtCurrency(projExp)} / ${fmtCurrency(p.budget)}</div></div></div><span class="badge" style="background:${color}22;color:${color}">${p.status}</span></div>`;
    }).join('')+'</div>':'<p class="empty-state-sm">No projects yet</p>';

  renderDashboardCharts(expenses);
}

/* --- Health Gauge Rendering --- */
function renderHealthGauge(score, grade) {
  const circle = document.getElementById('health-gauge-circle');
  const scoreText = document.getElementById('health-score-text');
  const gradeText = document.getElementById('health-grade-text');
  const factorsEl = document.getElementById('health-factors');
  if (!circle) return;

  const circumference = 2 * Math.PI * 52; /* r=52 */
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--blue)' : score >= 40 ? 'var(--yellow)' : 'var(--red)';

  circle.style.stroke = color;
  setTimeout(() => { circle.style.strokeDashoffset = offset; }, 100);
  if (scoreText) scoreText.textContent = score;
  if (gradeText) gradeText.textContent = 'Grade ' + grade;

  /* Render factor bars */
  try {
    const health = calculateFinancialHealth();
    if (factorsEl) {
      factorsEl.innerHTML = health.factors.map(f => {
        const fColor = f.status === 'good' ? 'var(--green)' : f.status === 'warning' ? 'var(--yellow)' : 'var(--red)';
        const fIcon = f.status === 'good' ? icon('check-circle',16) : f.status === 'warning' ? icon('alert-triangle',16) : icon('x-circle',16);
        const pct = Math.round(f.score / f.maxScore * 100);
        return `<div class="health-factor">
          <div class="health-factor-icon" style="background:${fColor}22;color:${fColor}">${fIcon}</div>
          <div class="health-factor-info">
            <div class="health-factor-name">${f.name}</div>
            <div class="health-factor-bar"><div class="health-factor-fill" style="width:${pct}%;background:${fColor}"></div></div>
          </div>
          <div class="health-factor-score">${f.score}/${f.maxScore}</div>
        </div>`;
      }).join('');
    }
  } catch(e) {}
}

/* --- Forecast Chart on Dashboard --- */
let forecastChart = null;
function renderForecastChart() {
  try {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById('chart-forecast');
    if (!canvas) return;

    const expenses = getExpenses();
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d.toISOString().slice(0, 7)); }
    const actuals = months.map(m => expenses.filter(e => e.date && e.date.startsWith(m)).reduce((s, e) => s + Number(e.amount), 0));
    const labels = months.map(m => new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short' }));

    /* Add forecast months */
    let forecast = null;
    try { forecast = forecastExpenses(1); } catch(e) {}
    const forecastMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    labels.push(forecastMonth.toLocaleDateString('en-IN', { month: 'short' }));
    const forecastData = [...actuals.map(() => null), forecast ? forecast.totalPredicted : 0];
    const actualData = [...actuals, null];

    const gridC = 'rgba(255,255,255,0.05)', tickC = '#5c6070';
    if (forecastChart) forecastChart.destroy();
    forecastChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Actual', data: actualData, borderColor: '#4c8dff', backgroundColor: 'rgba(76,141,255,0.08)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2 },
          { label: 'Forecast', data: forecastData, borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', fill: true, tension: 0.4, pointRadius: 5, borderWidth: 2, borderDash: [6, 4], pointStyle: 'triangle' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tickC, font: { size: 11 }, usePointStyle: true } } },
        scales: { x: { ticks: { color: tickC }, grid: { color: gridC } }, y: { ticks: { color: tickC, callback: v => '₹' + v.toLocaleString() }, grid: { color: gridC }, beginAtZero: true } }
      }
    });
  } catch(e) { console.warn('Forecast chart error', e); }
}

/* --- Dashboard Charts --- */
let trendChart=null, catChart=null;
function renderDashboardCharts(expenses){
  const months=[]; const now=new Date();
  for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); months.push(d.toISOString().slice(0,7)); }
  const monthTotals=months.map(m=>expenses.filter(e=>e.date&&e.date.startsWith(m)).reduce((s,e)=>s+Number(e.amount),0));
  const monthLabels=months.map(m=>new Date(m+'-01').toLocaleDateString('en-IN',{month:'short'}));
  const gridC='rgba(255,255,255,0.05)', tickC='#5c6070';

  try {
  if(typeof Chart==='undefined') return;
  if(trendChart) trendChart.destroy();
  trendChart=new Chart(document.getElementById('chart-trend'),{
    type:'line',data:{labels:monthLabels,datasets:[{label:'Expenses',data:monthTotals,borderColor:'#4c8dff',backgroundColor:'rgba(76,141,255,0.08)',fill:true,tension:0.4,pointRadius:3,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:tickC,font:{size:11}},grid:{color:gridC}},y:{ticks:{color:tickC,font:{size:10},callback:v=>'₹'+v.toLocaleString()},grid:{color:gridC},beginAtZero:true}}}
  });

  const catTotals={};
  expenses.forEach(e=>{ catTotals[e.category]=(catTotals[e.category]||0)+Number(e.amount); });
  const catEntries=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,6);

  if(catChart) catChart.destroy();
  catChart=new Chart(document.getElementById('chart-category'),{
    type:'doughnut',data:{labels:catEntries.map(([id])=>getCat(id).name),datasets:[{data:catEntries.map(([,v])=>v),backgroundColor:catEntries.map(([id])=>colorMap[id]||'#4c8dff'),borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'right',labels:{color:tickC,font:{size:11},padding:12,usePointStyle:true,pointStyleWidth:8}}}}
  });
  } catch(e){ console.warn('Charts unavailable',e); }
}

/* --- Expenses Table --- */
function renderExpenses(){
  const expenses=getExpenses(), projects=getProjects();
  const filterCat=document.getElementById('filter-category').value;
  const filterMonth=document.getElementById('filter-month').value;
  const filterProj=document.getElementById('filter-project').value;
  let filtered=expenses;
  if(filterCat) filtered=filtered.filter(e=>e.category===filterCat);
  if(filterMonth) filtered=filtered.filter(e=>e.date&&e.date.startsWith(filterMonth));
  if(filterProj) filtered=filtered.filter(e=>e.projectId===filterProj);
  filtered.sort((a,b)=>new Date(b.date)-new Date(a.date));

  const tbody=document.getElementById('expense-tbody');
  if(!filtered.length){ tbody.innerHTML='<tr><td colspan="7" class="empty-state-sm">No expenses found</td></tr>'; return; }
  const user=getCurrentUser();
  const canSubmit=user&&isAtLeast(user.role,'employee');
  tbody.innerHTML=filtered.map(e=>{
    const cat=getCat(e.category);
    const proj=projects.find(p=>p.id===e.projectId);
    const statusColors={approved:'badge-green',rejected:'badge-red',pending:'badge-yellow',submitted:'badge-blue',manager_approved:'badge-cyan'};
    const statusClass=statusColors[e.status]||'badge-ghost';
    const statusLabel=e.status==='manager_approved'?'Mgr Approved':e.status;
    return `<tr>
      <td>${fmtDate(e.date)}</td><td>${e.description}</td>
      <td><span class="badge" style="background:${colorMap[e.category]||'#4c8dff'}22;color:${colorMap[e.category]||'#4c8dff'}">${cat.icon} ${cat.name}</span></td>
      <td>${proj?proj.name:'—'}</td><td style="font-weight:600">${fmtCurrency(e.amount)}</td>
      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td><div style="display:flex;gap:4px">
        <button class="btn-icon" onclick="editExpense('${e.id}')" title="Edit">${icon('edit',16)}</button>
        <button class="btn-icon" onclick="deleteExpense('${e.id}')" title="Delete">${icon('trash',16)}</button>
        ${canSubmit&&(e.status==='pending'||e.status==='draft')?`<button class="btn-icon" onclick="submitForApproval('${e.id}');renderExpenses();renderNotifications();" title="Submit for Approval" style="color:var(--blue)">${icon('upload',16)}</button>`:''}
      </div></td></tr>`;
  }).join('');
}

/* --- Projects --- */
function renderProjects(){
  const projects=getProjects(), expenses=getExpenses(), tasks=getTasks();
  const grid=document.getElementById('projects-grid');
  if(!projects.length){ grid.innerHTML='<p class="empty-state-sm">No projects yet. Create one!</p>'; return; }
  grid.innerHTML=projects.map(p=>{
    const projExp=expenses.filter(e=>e.projectId===p.id).reduce((s,e)=>s+Number(e.amount),0);
    const projTasks=tasks.filter(t=>t.projectId===p.id);
    const doneTasks=projTasks.filter(t=>t.status==='done').length;
    const taskPct=projTasks.length?Math.round(doneTasks/projTasks.length*100):0;
    const budgetPct=p.budget?Math.min(100,Math.round(projExp/p.budget*100)):0;
    const budgetColor=budgetPct>90?'var(--red)':budgetPct>60?'var(--yellow)':'var(--green)';
    const statusColors={planning:'badge-blue',active:'badge-green',completed:'badge-purple','on-hold':'badge-yellow'};
    return `<div class="project-card">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px"><div class="p-name">${p.name}</div><span class="badge ${statusColors[p.status]||'badge-ghost'}">${p.status}</span></div>
      <div class="p-desc">${p.description||'No description'}</div>
      <div class="p-meta"><span style="display:inline-flex;align-items:center;gap:4px">${icon('calendar',14)} ${fmtDate(p.startDate)} — ${fmtDate(p.endDate)}</span></div>
      <div style="font-size:0.75rem;color:var(--text-2);margin-bottom:4px">Tasks: ${doneTasks}/${projTasks.length} (${taskPct}%)</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${taskPct}%;background:var(--blue)"></div></div>
      <div style="font-size:0.75rem;color:var(--text-2);margin-bottom:4px">Budget: ${fmtCurrency(projExp)} / ${fmtCurrency(p.budget)} (${budgetPct}%)</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${budgetPct}%;background:${budgetColor}"></div></div>
      <div class="p-footer"><div class="p-actions"><button class="btn-icon" onclick="editProject('${p.id}')" title="Edit">${icon('edit',16)}</button><button class="btn-icon" onclick="deleteProject('${p.id}')" title="Delete">${icon('trash',16)}</button></div></div></div>`;
  }).join('');
}

/* --- Tasks / Kanban --- */
function renderTasks(){
  const tasks=getTasks(), projects=getProjects();
  const filterProj=document.getElementById('task-project-filter').value;
  let filtered=filterProj?tasks.filter(t=>t.projectId===filterProj):tasks;
  const statuses=['todo','in-progress','review','done'];
  const containers={todo:'kanban-todo','in-progress':'kanban-progress',review:'kanban-review',done:'kanban-done'};
  const counts={todo:'count-todo','in-progress':'count-progress',review:'count-review',done:'count-done'};

  statuses.forEach(st=>{
    const stTasks=filtered.filter(t=>t.status===st);
    document.getElementById(counts[st]).textContent=stTasks.length;
    const container=document.getElementById(containers[st]);
    if(!stTasks.length){ container.innerHTML='<p class="empty-state-sm" style="padding:12px;font-size:0.75rem">No tasks</p>'; return; }
    container.innerHTML=stTasks.map(t=>{
      const proj=projects.find(p=>p.id===t.projectId);
      const dl=daysLeft(t.dueDate);
      const dueColor=dl<0?'var(--red)':dl<=2?'var(--yellow)':'var(--text-3)';
      const nextStatus=st==='todo'?'in-progress':st==='in-progress'?'review':st==='review'?'done':'done';
      return `<div class="task-card">
        <div class="t-title"><span class="priority-dot pri-${t.priority}"></span>${t.title}</div>
        <div class="t-meta"><span class="t-project">${proj?proj.name:''}</span><span class="t-due" style="color:${dueColor}">${t.dueDate?fmtDate(t.dueDate):''}</span></div>
        <div class="t-actions">
          ${st!=='done'?`<button class="btn-icon" onclick="moveTask('${t.id}','${nextStatus}')" title="Move forward">${icon('chevron-right',16)}</button>`:''}
          <button class="btn-icon" onclick="editTask('${t.id}')" title="Edit">${icon('edit',16)}</button>
          <button class="btn-icon" onclick="deleteTask('${t.id}')" title="Delete">${icon('trash',16)}</button>
        </div></div>`;
    }).join('');
  });
}

/* --- Budgets --- */
function renderBudgets(){
  const budgets=getBudgets(), expenses=getExpenses();
  const grid=document.getElementById('budgets-grid');
  if(!budgets.length){ grid.innerHTML='<p class="empty-state-sm">No budgets set yet.</p>'; return; }
  const thisMonth=new Date().toISOString().slice(0,7);
  grid.innerHTML=budgets.map(b=>{
    let relExpenses=expenses.filter(e=>e.date&&e.date.startsWith(thisMonth));
    if(b.category) relExpenses=relExpenses.filter(e=>e.category===b.category);
    const spent=relExpenses.reduce((s,e)=>s+Number(e.amount),0);
    const pct=Math.min(100,Math.round(spent/b.amount*100));
    const color=pct>=b.alertThreshold?'var(--red)':pct>=60?'var(--yellow)':'var(--green)';
    const catName=b.category?getCat(b.category).name+' '+getCat(b.category).icon:'All Categories';
    return `<div class="budget-card">
      <div class="b-label">${b.period} budget — ${catName}</div>
      <div class="b-amount">${fmtCurrency(b.amount)}</div>
      <div class="b-spent">Spent: ${fmtCurrency(spent)}</div>
      <div class="b-bar"><div class="b-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="b-footer"><span>${pct}% used</span><button class="btn-icon" onclick="deleteBudget('${b.id}')">${icon('trash',16)}</button></div></div>`;
  }).join('');

  /* Render AI budget recommendations */
  renderBudgetRecommendations();
}

/* --- AI Budget Recommendations --- */
function renderBudgetRecommendations() {
  const container = document.getElementById('budget-recommendations');
  if (!container) return;
  try {
    const recs = recommendBudgets();
    if (!recs.length) {
      container.innerHTML = '<p class="empty-state-sm">Need more spending history to generate recommendations. Keep tracking!</p>';
      return;
    }
    container.innerHTML = '<div class="rec-grid">' + recs.slice(0, 6).map(r => {
      const trendIcon = r.trend === 'increasing' ? icon('trending-up',16) : r.trend === 'decreasing' ? icon('trending-down',16) : icon('minus',16);
      const trendColor = r.trend === 'increasing' ? 'var(--red)' : r.trend === 'decreasing' ? 'var(--green)' : 'var(--text-2)';
      return `<div class="rec-card">
        <div class="rec-card-header"><span class="rec-card-icon">${r.icon}</span><span class="rec-card-name">${r.categoryName}</span></div>
        <div class="rec-card-amount">${fmtCurrency(r.recommended)}<span style="font-size:0.72rem;color:var(--text-3)">/mo</span></div>
        <div class="rec-card-meta" style="display:flex;align-items:center;justify-content:center;gap:6px;">Avg: ${fmtCurrency(r.average)} <span style="opacity:0.5">•</span> Median: ${fmtCurrency(r.median)}</div>
        <div class="rec-card-trend" style="color:${trendColor}">${trendIcon} Trend: ${r.trend} (${r.confidence}% conf.)</div>
        <button class="btn btn-secondary btn-sm" onclick="applyBudgetRec('${r.category}',${r.recommended})">Apply</button>
      </div>`;
    }).join('') + '</div>';
  } catch (e) {
    container.innerHTML = '<p class="empty-state-sm">Unable to generate recommendations</p>';
  }
}

/** Apply AI budget recommendation */
window.applyBudgetRec = function(category, amount) {
  const budgets = getBudgets();
  /* Check if budget already exists for this category */
  const existing = budgets.find(b => b.category === category && b.period === 'monthly');
  if (existing) {
    existing.amount = amount;
    toast('Budget updated to AI recommendation');
  } else {
    budgets.push({ id: genId(), amount, period: 'monthly', category, alertThreshold: 80, createdAt: new Date().toISOString() });
    toast('AI-recommended budget created!');
  }
  saveBudgets(budgets);
  if (typeof logAudit === 'function') logAudit(AUDIT_ACTIONS.BUDGET_CREATED, 'budget', category, null, { amount, category }, getCat(category).name + ' Budget');
  renderBudgets();
};

/* --- Notifications --- */
function checkBudgetAlerts(){
  const budgets=getBudgets(), expenses=getExpenses(), notifs=getNotifs();
  const thisMonth=new Date().toISOString().slice(0,7);
  budgets.forEach(b=>{
    let relExp=expenses.filter(e=>e.date&&e.date.startsWith(thisMonth));
    if(b.category) relExp=relExp.filter(e=>e.category===b.category);
    const spent=relExp.reduce((s,e)=>s+Number(e.amount),0);
    const pct=Math.round(spent/b.amount*100);
    const key='budget_'+b.id+'_'+thisMonth;
    if(pct>=b.alertThreshold && !notifs.find(n=>n.key===key)){
      const catName=b.category?getCat(b.category).name:'Overall';
      addNotification(icon('alert-triangle',14)+' Budget Alert',`${catName} budget is ${pct}% used (${fmtCurrency(spent)}/${fmtCurrency(b.amount)})`,key);
    }
  });
  /* Task deadline reminders */
  getTasks().filter(t=>t.status!=='done'&&t.dueDate).forEach(t=>{
    const dl=daysLeft(t.dueDate);
    const key='task_'+t.id+'_due';
    if(dl<=1 && dl>=0 && !notifs.find(n=>n.key===key)){
      addNotification(icon('clock',14)+' Deadline',`"${t.title}" is due ${dl===0?'today':'tomorrow'}!`,key);
    }
  });
}

function addNotification(title,message,key){
  const notifs=getNotifs();
  notifs.unshift({id:genId(),title,message,key,read:false,time:new Date().toISOString()});
  saveNotifs(notifs);
  renderNotifications();
}

function renderNotifications(){
  const notifs=getNotifs();
  const unread=notifs.filter(n=>!n.read).length;
  const badge=document.getElementById('notif-badge');
  badge.textContent=unread; badge.dataset.count=unread;
  const list=document.getElementById('notif-list');
  if(!notifs.length){ list.innerHTML='<p class="empty-state-sm">No notifications</p>'; return; }
  list.innerHTML=notifs.slice(0,15).map(n=>`
    <div class="notif-item ${n.read?'':'unread'}"><div class="n-title">${n.title}</div><div class="n-msg">${n.message}</div><div class="n-time">${timeAgo(n.time)}</div></div>
  `).join('');
}
