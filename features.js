/* ===== ANALYTICS, REPORTS & AI INSIGHTS ===== */

const gridC='rgba(255,255,255,0.05)',tickC='#5c6070';
let monthlyChart=null,paymentChart=null,budgetActualChart=null,dailyChart=null;

function renderAnalytics(){
  if(typeof Chart==='undefined'){return;}
  const expenses=getExpenses(),projects=getProjects();
  const now=new Date();

  // Monthly comparison (6 months)
  const months=[];for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push(d.toISOString().slice(0,7));}
  const mTotals=months.map(m=>expenses.filter(e=>e.date&&e.date.startsWith(m)).reduce((s,e)=>s+Number(e.amount),0));
  const mLabels=months.map(m=>new Date(m+'-01').toLocaleDateString('en-IN',{month:'short',year:'2-digit'}));
  if(monthlyChart)monthlyChart.destroy();
  monthlyChart=new Chart(document.getElementById('chart-monthly'),{
    type:'bar',data:{labels:mLabels,datasets:[{label:'Expenses',data:mTotals,backgroundColor:'rgba(76,141,255,0.6)',borderRadius:6,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:tickC},grid:{display:false}},y:{ticks:{color:tickC,callback:v=>'₹'+v.toLocaleString()},grid:{color:gridC},beginAtZero:true}}}
  });

  // Payment method breakdown
  const pmTotals={};expenses.forEach(e=>{pmTotals[e.paymentMethod||'cash']=(pmTotals[e.paymentMethod||'cash']||0)+Number(e.amount);});
  const pmLabels=Object.keys(pmTotals).map(k=>k.charAt(0).toUpperCase()+k.slice(1));
  const pmColors=['#4c8dff','#34d399','#fbbf24','#a78bfa'];
  if(paymentChart)paymentChart.destroy();
  paymentChart=new Chart(document.getElementById('chart-payment'),{
    type:'doughnut',data:{labels:pmLabels,datasets:[{data:Object.values(pmTotals),backgroundColor:pmColors,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'right',labels:{color:tickC,font:{size:11},padding:12,usePointStyle:true}}}}
  });

  // Project budget vs actual
  const pNames=projects.slice(0,6).map(p=>p.name);
  const pBudgets=projects.slice(0,6).map(p=>Number(p.budget)||0);
  const pActuals=projects.slice(0,6).map(p=>expenses.filter(e=>e.projectId===p.id).reduce((s,e)=>s+Number(e.amount),0));
  if(budgetActualChart)budgetActualChart.destroy();
  budgetActualChart=new Chart(document.getElementById('chart-budget-actual'),{
    type:'bar',data:{labels:pNames,datasets:[{label:'Budget',data:pBudgets,backgroundColor:'rgba(76,141,255,0.3)',borderRadius:4,borderSkipped:false},{label:'Actual',data:pActuals,backgroundColor:'rgba(248,113,113,0.5)',borderRadius:4,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:tickC,font:{size:11}}}},scales:{x:{ticks:{color:tickC,font:{size:10}},grid:{display:false}},y:{ticks:{color:tickC,callback:v=>'₹'+v.toLocaleString()},grid:{color:gridC},beginAtZero:true}}}
  });

  // Daily spending this month
  const thisMonth=now.toISOString().slice(0,7);
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const dailyData=Array(daysInMonth).fill(0);
  expenses.filter(e=>e.date&&e.date.startsWith(thisMonth)).forEach(e=>{const day=parseInt(e.date.split('-')[2]);dailyData[day-1]+=Number(e.amount);});
  const dayLabels=Array.from({length:daysInMonth},(_,i)=>i+1);
  if(dailyChart)dailyChart.destroy();
  dailyChart=new Chart(document.getElementById('chart-daily'),{
    type:'line',data:{labels:dayLabels,datasets:[{label:'Daily Spend',data:dailyData,borderColor:'#34d399',backgroundColor:'rgba(52,211,153,0.08)',fill:true,tension:0.3,pointRadius:2,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:tickC,maxTicksLimit:15},grid:{color:gridC}},y:{ticks:{color:tickC,callback:v=>'₹'+v.toLocaleString()},grid:{color:gridC},beginAtZero:true}}}
  });
}

// --- Reports ---
document.getElementById('gen-pdf-btn').onclick=()=>{
  const type=document.getElementById('report-type').value;
  if(type==='project') return generateProjectReportPDF();
  if(type==='budget') return generateBudgetReportPDF();
  if(type==='forecast') return generateForecastReportPDF();
  if(type==='audit') { if(typeof exportAuditPDF==='function') exportAuditPDF(); return; }
  /* Default expense report */
  const expenses=getFilteredReportData();
  if(!expenses.length){toast('No data for selected range','warning');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF();
  doc.setFontSize(18);doc.text('Expense Report',14,20);
  doc.setFontSize(10);doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`,14,28);
  const total=expenses.reduce((s,e)=>s+Number(e.amount),0);
  doc.text(`Total: ${fmtCurrency(total)} | Records: ${expenses.length}`,14,34);
  const rows=expenses.map(e=>[fmtDate(e.date),e.description,getCat(e.category).name,fmtCurrency(e.amount),e.status]);
  doc.autoTable({head:[['Date','Description','Category','Amount','Status']],body:rows,startY:40,
    styles:{fontSize:9,cellPadding:3},headStyles:{fillColor:[76,141,255]}});
  doc.save('expense_report.pdf');
  toast('PDF downloaded!');
};

document.getElementById('gen-excel-btn').onclick=()=>{
  const expenses=getFilteredReportData();
  if(!expenses.length){toast('No data for selected range','warning');return;}
  const wsData=[['Date','Description','Category','Amount','Payment Method','Status','Project']];
  const projects=getProjects();
  expenses.forEach(e=>{const proj=projects.find(p=>p.id===e.projectId);
    wsData.push([e.date,e.description,getCat(e.category).name,e.amount,e.paymentMethod||'',e.status,proj?proj.name:'']);});
  const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb,ws,'Expenses');
  XLSX.writeFile(wb,'expense_report.xlsx');
  toast('Excel downloaded!');
};

/* CSV Export */
document.getElementById('gen-csv-btn').onclick=()=>{
  const expenses=getFilteredReportData();
  if(!expenses.length){toast('No data for selected range','warning');return;}
  const projects=getProjects();
  const rows=[['Date','Description','Category','Amount','Payment Method','Status','Project']];
  expenses.forEach(e=>{const proj=projects.find(p=>p.id===e.projectId);
    rows.push([e.date,e.description,getCat(e.category).name,e.amount,e.paymentMethod||'',e.status,proj?proj.name:'']);});
  const csv=rows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='expense_report.csv';a.click();
  URL.revokeObjectURL(url);
  toast('CSV downloaded!');
};

/* Report tab switching */
document.querySelectorAll('.report-tab').forEach(tab=>{
  tab.addEventListener('click',function(){
    document.querySelectorAll('.report-tab').forEach(t=>t.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('report-type').value=this.dataset.report;
  });
});

function getFilteredReportData(){
  const from=document.getElementById('report-from').value;
  const to=document.getElementById('report-to').value;
  let expenses=getExpenses();
  if(from) expenses=expenses.filter(e=>e.date>=from);
  if(to) expenses=expenses.filter(e=>e.date<=to);
  expenses.sort((a,b)=>new Date(b.date)-new Date(a.date));
  const preview=document.getElementById('report-preview');
  if(!expenses.length){preview.innerHTML='<p class="empty-state-sm">No data for selected range</p>';return [];}
  const total=expenses.reduce((s,e)=>s+Number(e.amount),0);
  preview.innerHTML=`<p style="margin-bottom:10px;font-size:0.85rem;color:var(--text-1)">Total: <strong>${fmtCurrency(total)}</strong> | ${expenses.length} records</p>
    <table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>
    ${expenses.slice(0,20).map(e=>`<tr><td>${fmtDate(e.date)}</td><td>${e.description}</td><td>${getCat(e.category).icon} ${getCat(e.category).name}</td><td>${fmtCurrency(e.amount)}</td></tr>`).join('')}
    ${expenses.length>20?'<tr><td colspan="4" style="text-align:center;color:var(--text-3)">...and '+(expenses.length-20)+' more</td></tr>':''}
    </tbody></table>`;
  return expenses;
}

/* --- Project Report PDF --- */
function generateProjectReportPDF(){
  try{
    const projects=getProjects(),expenses=getExpenses();
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF();
    doc.setFontSize(18);doc.text('Project Report',14,20);
    doc.setFontSize(10);doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`,14,28);
    const rows=projects.map(p=>{
      const spent=expenses.filter(e=>e.projectId===p.id).reduce((s,e)=>s+Number(e.amount),0);
      return [p.name,p.status,fmtCurrency(p.budget),fmtCurrency(spent),p.budget?Math.round(spent/p.budget*100)+'%':'—'];
    });
    doc.autoTable({head:[['Project','Status','Budget','Spent','Utilization']],body:rows,startY:34,styles:{fontSize:9},headStyles:{fillColor:[76,141,255]}});
    doc.save('project_report.pdf');toast('Project PDF downloaded!');
  }catch(e){toast('PDF error','error');}
}

/* --- Budget Report PDF --- */
function generateBudgetReportPDF(){
  try{
    const budgets=getBudgets(),expenses=getExpenses();
    const thisMonth=new Date().toISOString().slice(0,7);
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF();
    doc.setFontSize(18);doc.text('Budget Report',14,20);
    doc.setFontSize(10);doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} | Period: ${thisMonth}`,14,28);
    const rows=budgets.map(b=>{
      let rel=expenses.filter(e=>e.date&&e.date.startsWith(thisMonth));
      if(b.category)rel=rel.filter(e=>e.category===b.category);
      const spent=rel.reduce((s,e)=>s+Number(e.amount),0);
      return [b.category?getCat(b.category).name:'Overall',b.period,fmtCurrency(b.amount),fmtCurrency(spent),Math.round(spent/b.amount*100)+'%'];
    });
    doc.autoTable({head:[['Category','Period','Budget','Spent','Usage']],body:rows,startY:34,styles:{fontSize:9},headStyles:{fillColor:[76,141,255]}});
    doc.save('budget_report.pdf');toast('Budget PDF downloaded!');
  }catch(e){toast('PDF error','error');}
}

/* --- Forecast Report PDF --- */
function generateForecastReportPDF(){
  try{
    const forecast=forecastExpenses(1);
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF();
    doc.setFontSize(18);doc.text('Expense Forecast Report',14,20);
    doc.setFontSize(10);doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} | Forecast: ${forecast.monthLabel}`,14,28);
    doc.text(`Predicted Total: ${fmtCurrency(forecast.totalPredicted)} | Confidence: ${forecast.overallConfidence}% | Trend: ${forecast.trend}`,14,36);
    const rows=forecast.byCategory.map(c=>[c.icon+' '+c.categoryName,fmtCurrency(c.predicted),c.confidence+'%']);
    doc.autoTable({head:[['Category','Predicted','Confidence']],body:rows,startY:42,styles:{fontSize:9},headStyles:{fillColor:[167,139,250]}});
    doc.save('forecast_report.pdf');toast('Forecast PDF downloaded!');
  }catch(e){toast('Forecast report error','error');}
}

// --- AI/Smart Insights ---
function renderSmartInsights(){
  const expenses=getExpenses(),budgets=getBudgets();
  const now=new Date(),thisMonth=now.toISOString().slice(0,7);
  const monthExp=expenses.filter(e=>e.date&&e.date.startsWith(thisMonth));
  const totalThisMonth=monthExp.reduce((s,e)=>s+Number(e.amount),0);

  /* Forecast section */
  try{
    const forecast=forecastExpenses(1);
    const confColor=forecast.overallConfidence>=70?'var(--green)':forecast.overallConfidence>=50?'var(--yellow)':'var(--red)';
    const confBg=forecast.overallConfidence>=70?'var(--green-soft)':forecast.overallConfidence>=50?'var(--yellow-soft)':'var(--red-soft)';
    const trendIcon=forecast.trend==='increasing'?icon('trending-up',16):forecast.trend==='decreasing'?icon('trending-down',16):icon('minus',16);
    document.getElementById('forecast-cards').innerHTML=`
      <div class="forecast-summary">
        <div><div class="forecast-big-number">${fmtCurrency(forecast.totalPredicted)}</div><div class="forecast-meta">Predicted for ${forecast.monthLabel}</div></div>
        <div><span class="forecast-card-confidence" style="background:${confBg};color:${confColor}">${forecast.overallConfidence}% confidence</span></div>
        <div style="font-size:0.85rem">${trendIcon} ${forecast.trend}</div>
      </div>
      <div class="forecast-grid">${forecast.byCategory.slice(0,6).map(c=>{
        const cColor=c.confidence>=70?'var(--green)':c.confidence>=50?'var(--yellow)':'var(--red)';
        const cBg=c.confidence>=70?'var(--green-soft)':c.confidence>=50?'var(--yellow-soft)':'var(--red-soft)';
        return `<div class="forecast-card">
          <div class="forecast-card-header"><span class="forecast-card-cat">${c.icon} ${c.categoryName}</span><span class="forecast-card-confidence" style="background:${cBg};color:${cColor}">${c.confidence}%</span></div>
          <div class="forecast-card-amount">${fmtCurrency(c.predicted)}</div>
        </div>`;
      }).join('')}</div>`;
  }catch(e){
    document.getElementById('forecast-cards').innerHTML='<p class="empty-state-sm">Need more data for forecasting</p>';
  }

  /* Health score detail */
  try{
    const health=calculateFinancialHealth();
    const gradeColor=health.score>=80?'var(--green)':health.score>=60?'var(--blue)':health.score>=40?'var(--yellow)':'var(--red)';
    document.getElementById('ai-health-detail').innerHTML=`
      <div style="text-align:center;margin-bottom:16px"><span style="font-size:2.5rem;font-weight:800;color:${gradeColor}">${health.score}</span><span style="font-size:1rem;color:var(--text-3)">/100</span><div style="font-size:0.85rem;color:${gradeColor};font-weight:600">Grade ${health.grade}</div></div>
      ${health.factors.map(f=>{
        const fColor=f.status==='good'?'var(--green)':f.status==='warning'?'var(--yellow)':'var(--red)';
        return `<div class="health-factor"><div class="health-factor-icon" style="background:${fColor}22;color:${fColor}">${f.status==='good'?icon('check-circle',16):f.status==='warning'?icon('alert-triangle',16):icon('x-circle',16)}</div><div class="health-factor-info"><div class="health-factor-name">${f.name}</div><div class="health-factor-bar"><div class="health-factor-fill" style="width:${Math.round(f.score/f.maxScore*100)}%;background:${fColor}"></div></div></div><div class="health-factor-score">${f.score}/${f.maxScore}</div></div>`;
      }).join('')}
      ${health.recommendations.length?'<div class="insight-card" style="margin-top:12px"><h4><span class="insight-icon icon-yellow">'+icon('lightbulb',18)+'</span>Recommendations</h4><p>'+health.recommendations.join('<br>')+'</p></div>':''}`;
  }catch(e){
    document.getElementById('ai-health-detail').innerHTML='<p class="empty-state-sm">Need more data for health analysis</p>';
  }

  // Spending patterns
  const catTotals={};expenses.forEach(e=>{catTotals[e.category]=(catTotals[e.category]||0)+Number(e.amount);});
  const topCats=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const totalAll=expenses.reduce((s,e)=>s+Number(e.amount),0);
  const dayTotals={};expenses.forEach(e=>{const day=new Date(e.date).toLocaleDateString('en-IN',{weekday:'long'});dayTotals[day]=(dayTotals[day]||0)+Number(e.amount);});
  const topDay=Object.entries(dayTotals).sort((a,b)=>b[1]-a[1])[0];
  const avgPerDay=totalAll/Math.max(1,new Set(expenses.map(e=>e.date)).size);

  document.getElementById('ai-patterns').innerHTML=`
    <div class="insight-card"><h4><span class="insight-icon icon-blue">${icon('pie-chart',18)}</span>Top Spending Categories</h4><p>${topCats.map(([id,v])=>`${getCat(id).icon} ${getCat(id).name}: ${fmtCurrency(v)} (${Math.round(v/totalAll*100)}%)`).join('<br>')}</p></div>
    <div class="insight-card"><h4><span class="insight-icon icon-green">${icon('calendar',18)}</span>Peak Spending Day</h4><p>You tend to spend the most on <strong>${topDay?topDay[0]:'N/A'}</strong> with an average of ${fmtCurrency(topDay?topDay[1]/4:0)} per week.</p></div>
    <div class="insight-card"><h4><span class="insight-icon icon-purple">${icon('bar-chart',18)}</span>Daily Average</h4><p>Your average daily spend is <strong>${fmtCurrency(Math.round(avgPerDay))}</strong> based on your expense history.</p></div>`;

  // Budget predictions
  const months=[];for(let i=3;i>=1;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push(d.toISOString().slice(0,7));}
  const mTotals=months.map(m=>expenses.filter(e=>e.date&&e.date.startsWith(m)).reduce((s,e)=>s+Number(e.amount),0));
  const avg3m=mTotals.reduce((s,v)=>s+v,0)/Math.max(1,mTotals.filter(v=>v>0).length);
  const trend=mTotals.length>=2&&mTotals[mTotals.length-1]>mTotals[0]?'increasing':'stable';
  const predicted=Math.round(avg3m*(trend==='increasing'?1.1:1));
  const daysGone=now.getDate(),daysTotal=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const projectedMonth=Math.round(totalThisMonth/Math.max(1,daysGone)*daysTotal);

  document.getElementById('ai-predictions').innerHTML=`
    <div class="insight-card"><h4><span class="insight-icon icon-orange">${icon('sparkles',18)}</span>Next Month Prediction</h4><p>Based on your 3-month average (${fmtCurrency(Math.round(avg3m))}), your predicted spend next month is <strong>${fmtCurrency(predicted)}</strong>. Trend: <strong>${trend}</strong>.</p></div>
    <div class="insight-card"><h4><span class="insight-icon icon-blue">${icon('trending-up',18)}</span>This Month Projection</h4><p>At your current pace, you'll spend approximately <strong>${fmtCurrency(projectedMonth)}</strong> this month (${daysGone}/${daysTotal} days elapsed, ${fmtCurrency(totalThisMonth)} spent so far).</p></div>`;

  // Smart suggestions
  const suggestions=[];
  topCats.forEach(([id,v])=>{
    const pct=Math.round(v/totalAll*100);
    if(pct>30) suggestions.push({icon:icon('lightbulb',18),cls:'icon-yellow',title:`Reduce ${getCat(id).name} spending`,desc:`${getCat(id).name} accounts for ${pct}% of your total expenses. Consider setting a specific budget limit for this category.`});
  });
  if(trend==='increasing') suggestions.push({icon:icon('trending-down',18),cls:'icon-red',title:'Spending is trending up',desc:'Your expenses have been increasing over the last 3 months. Review recurring subscriptions and non-essential spending.'});
  const unusedBudgets=budgets.filter(b=>{
    let rel=monthExp; if(b.category)rel=rel.filter(e=>e.category===b.category);
    return rel.reduce((s,e)=>s+Number(e.amount),0)/b.amount<0.3;
  });
  if(unusedBudgets.length) suggestions.push({icon:icon('check-circle',18),cls:'icon-green',title:'Under-utilized budgets',desc:`${unusedBudgets.length} budget(s) are less than 30% used. You could reallocate funds to higher-spending categories.`});
  if(avgPerDay>2000) suggestions.push({icon:icon('target',18),cls:'icon-orange',title:'Set daily spending limits',desc:`Your average daily spend of ${fmtCurrency(Math.round(avgPerDay))} is high. Try setting a daily cap to control expenses.`});
  if(!suggestions.length) suggestions.push({icon:icon('award',18),cls:'icon-blue',title:'Great job!',desc:'Your spending patterns look healthy. Keep tracking to maintain financial discipline!'});

  document.getElementById('ai-suggestions').innerHTML=suggestions.map(s=>`
    <div class="insight-card"><h4><span class="insight-icon ${s.cls||''}">${s.icon}</span>${s.title}</h4><p>${s.desc}</p></div>`).join('');
}
