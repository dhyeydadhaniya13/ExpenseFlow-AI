/* ===== DATA LAYER — localStorage persistence ===== */

const CATEGORIES = [
  { id:'travel', name:'Travel', color:'var(--blue)' },
  { id:'food', name:'Food & Dining', color:'var(--orange)' },
  { id:'utilities', name:'Utilities', color:'var(--yellow)' },
  { id:'office', name:'Office Supplies', color:'var(--purple)' },
  { id:'software', name:'Software', color:'var(--green)' },
  { id:'transport', name:'Transport', color:'var(--blue)' },
  { id:'marketing', name:'Marketing', color:'var(--red)' },
  { id:'salary', name:'Salary', color:'var(--green)' },
  { id:'rent', name:'Rent', color:'var(--yellow)' },
  { id:'other', name:'Other', color:'var(--text-2)' },
];

const CAT_KEYWORDS = {
  travel:['flight','hotel','airbnb','booking','trip','visa','airport'],
  food:['lunch','dinner','breakfast','coffee','restaurant','zomato','swiggy','cafe','meal','pizza','snack'],
  utilities:['electricity','water','internet','wifi','phone','bill','recharge'],
  office:['pen','paper','printer','desk','chair','stationery'],
  software:['subscription','license','saas','cloud','hosting','domain','github','figma'],
  transport:['uber','ola','taxi','fuel','petrol','diesel','parking','toll','metro','bus'],
  marketing:['ads','campaign','google ads','facebook','social media','promotion','branding'],
  salary:['salary','payroll','wages','bonus','stipend'],
  rent:['rent','lease','office space','coworking'],
};

function genId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function today(){ return new Date().toISOString().split('T')[0]; }
function fmtDate(d){ if(!d) return '—'; const dt=new Date(d); return dt.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
function fmtCurrency(n){ return '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:0}); }
function daysLeft(d){ if(!d) return Infinity; return Math.ceil((new Date(d)-new Date())/(1000*60*60*24)); }
function getCat(id){ const c=CATEGORIES.find(x=>x.id===id)||CATEGORIES[9]; return { ...c, icon: typeof catIcon === 'function' ? catIcon(c.id) : '' }; }
function timeAgo(d){ const s=Math.floor((Date.now()-new Date(d))/1000); if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+'m ago'; if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }

/* --- API Sync Engine --- */
let syncTimeout = null;
const SYNC_KEYS = ['ef_expenses', 'ef_projects', 'ef_tasks', 'ef_budgets', 'ef_notifs', 'ef_users', 'ef_approvals', 'ef_cat_corrections'];

async function triggerBackgroundSync() {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      const user = getCurrentUser();
      if (!user) return; // Only sync if logged in
      const userId = user.email;
      
      const payload = {};
      SYNC_KEYS.forEach(key => {
        payload[key] = localStorage.getItem(key);
      });
      
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify(payload)
      });
    } catch(e) {
      console.warn('Background sync failed:', e);
    }
  }, 2000);
}

window.syncWithDatabase = async function() {
  try {
    const user = getCurrentUser();
    if (!user) return false;
    const userId = user.email;
    
    const res = await fetch('/api/sync', {
      headers: { 'X-User-Id': userId }
    });
    const { success, data } = await res.json();
    if (success && data) {
      Object.keys(data).forEach(key => {
        if(data[key]) localStorage.setItem(key, data[key]);
      });
      return true;
    }
    return false;
  } catch(e) {
    console.warn('Initial sync failed. Using local data.', e);
    return false;
  }
};

/* --- Storage helpers --- */
function load(key){ try{ return JSON.parse(localStorage.getItem(key))||[]; }catch{ return []; } }
function save(key,data){ 
  localStorage.setItem(key,JSON.stringify(data)); 
  if(SYNC_KEYS.includes(key)) triggerBackgroundSync();
}
function loadObj(key){ try{ return JSON.parse(localStorage.getItem(key))||null; }catch{ return null; } }
function saveObj(key,data){ 
  localStorage.setItem(key,JSON.stringify(data)); 
  if(SYNC_KEYS.includes(key)) triggerBackgroundSync();
}

/* --- CRUD --- */
function getExpenses(){ return load('ef_expenses'); }
function saveExpenses(d){ save('ef_expenses',d); }
function getProjects(){ return load('ef_projects'); }
function saveProjects(d){ save('ef_projects',d); }
function getTasks(){ return load('ef_tasks'); }
function saveTasks(d){ save('ef_tasks',d); }
function getBudgets(){ return load('ef_budgets'); }
function saveBudgets(d){ save('ef_budgets',d); }
function getNotifs(){ return load('ef_notifs'); }
function saveNotifs(d){ save('ef_notifs',d); }
function getUsers(){ return load('ef_users'); }
function saveUsers(d){ save('ef_users',d); }
function getCurrentUser(){ return loadObj('ef_current_user'); }
function setCurrentUser(u){ saveObj('ef_current_user',u); }

/* --- Enterprise Storage Helpers --- */
function getApprovalHistory(){ return load('ef_approvals'); }
function saveApprovalHistory(d){ save('ef_approvals',d); }
function getAuditLogs(){ return load('ef_audit_logs'); }
function saveAuditLogs(d){ save('ef_audit_logs',d); }
function getCatCorrections(){ return load('ef_cat_corrections'); }
function saveCatCorrections(d){ save('ef_cat_corrections',d); }

/* --- NLP Synonyms for disambiguation --- */
const NLP_SYNONYMS = {
  'uber eats':'food','zomato':'food','swiggy':'food','doordash':'food',
  'ola auto':'transport','rapido':'transport','uber ride':'transport','uber cab':'transport',
  'netflix':'software','spotify':'software','youtube premium':'software','adobe':'software',
  'aws':'software','azure':'software','gcp':'software','vercel':'software','netlify':'software',
  'linkedin premium':'software','notion':'software','slack':'software','jira':'software',
  'google workspace':'software','microsoft 365':'software',
  'airtel':'utilities','jio':'utilities','vodafone':'utilities','bsnl':'utilities',
  'starbucks':'food','mcd':'food','dominos':'food','pizza hut':'food','kfc':'food',
  'amazon':'office','flipkart':'office',
  'makemytrip':'travel','goibibo':'travel','cleartrip':'travel','irctc':'travel',
  'instagram ads':'marketing','twitter ads':'marketing','linkedin ads':'marketing',
};

/* --- Enhanced Auto-categorize with NLP scoring and learning --- */
function autoCategorize(desc){
  const lower = (desc||'').toLowerCase().trim();
  if(!lower) return 'other';

  /* Check user corrections first (learned preferences) */
  const corrections = getCatCorrections();
  const exactMatch = corrections.find(c => c.description.toLowerCase() === lower);
  if(exactMatch) return exactMatch.to;
  const partialMatch = corrections.find(c => lower.includes(c.description.toLowerCase()) || c.description.toLowerCase().includes(lower));
  if(partialMatch) return partialMatch.to;

  /* Check NLP synonyms for multi-word disambiguation */
  for(const [phrase, cat] of Object.entries(NLP_SYNONYMS)){
    if(lower.includes(phrase)) return cat;
  }

  /* TF-IDF-like scoring: score each category by keyword match density */
  const scores = {};
  for(const [cat, kws] of Object.entries(CAT_KEYWORDS)){
    let score = 0;
    kws.forEach(k => {
      if(lower.includes(k)){
        score += k.length / lower.length * 10; // longer keyword matches score higher
        if(lower.startsWith(k) || lower === k) score += 5; // exact/prefix match bonus
      }
    });
    /* Boost from user correction history frequency */
    const catCorrections = corrections.filter(c => c.to === cat);
    if(catCorrections.length > 0) score += Math.min(catCorrections.length * 0.5, 3);
    if(score > 0) scores[cat] = score;
  }

  /* Return category with highest score */
  const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
  if(sorted.length > 0 && sorted[0][1] > 0) return sorted[0][0];
  return 'other';
}

/* --- Record category correction for learning --- */
function recordCategoryCorrection(description, fromCat, toCat){
  if(fromCat === toCat) return;
  const corrections = getCatCorrections();
  corrections.push({ description: description.trim(), from: fromCat, to: toCat, timestamp: new Date().toISOString() });
  /* Keep only last 200 corrections */
  if(corrections.length > 200) corrections.splice(0, corrections.length - 200);
  saveCatCorrections(corrections);
}

/* --- Seed data --- */
function seedIfEmpty(){
  if(getExpenses().length>0) return;
  const projId1=genId(), projId2=genId(), projId3=genId(), projId4=genId();
  const projects=[
    {id:projId1,name:'Website Redesign',description:'Company website overhaul with modern UI/UX',budget:150000,status:'active',startDate:'2026-03-01',endDate:'2026-06-30',createdAt:new Date().toISOString()},
    {id:projId2,name:'Mobile App MVP',description:'Build cross-platform mobile app prototype',budget:250000,status:'active',startDate:'2026-02-15',endDate:'2026-08-15',createdAt:new Date().toISOString()},
    {id:projId3,name:'Marketing Campaign',description:'Q2 digital marketing push across all channels',budget:80000,status:'planning',startDate:'2026-04-01',endDate:'2026-06-30',createdAt:new Date().toISOString()},
    {id:projId4,name:'Cloud Migration',description:'Migrate on-premise infrastructure to AWS',budget:180000,status:'active',startDate:'2026-01-15',endDate:'2026-07-30',createdAt:new Date().toISOString()},
  ];
  saveProjects(projects);

  const now=new Date();
  const expenses=[];
  const descs=[
    ['Team lunch at office','food',1200,projId1],['Figma subscription','software',1200,projId1],
    ['Uber to client meeting','transport',450,''],['AWS hosting March','software',3200,projId2],
    ['Office printer paper','office',680,''],['Flight to Mumbai','travel',8500,projId1],
    ['Google Ads campaign','marketing',15000,projId3],['Electricity bill March','utilities',4200,''],
    ['Coffee meeting','food',350,''],['Metro pass','transport',1500,''],
    ['Domain renewal','software',900,projId2],['Client dinner','food',3200,projId1],
    ['Facebook ads','marketing',8000,projId3],['Coworking space','rent',12000,''],
    ['UI design freelancer','salary',25000,projId1],['Petrol','transport',2000,''],
    ['Team snacks','food',800,projId2],['Phone bill','utilities',699,''],
    ['GitHub Pro','software',750,projId2],['Stationery','office',420,''],
    ['AWS Lambda usage','software',4500,projId4],['Docker Hub subscription','software',800,projId4],
    ['Client travel Delhi','travel',12000,projId4],['LinkedIn Ads','marketing',6000,projId3],
    ['Water bill April','utilities',1800,''],['Team dinner celebration','food',4500,projId2],
    ['Parking charges','transport',300,''],['Adobe Creative Cloud','software',2400,projId1],
    ['Office chairs','office',18000,''],['Slack Pro','software',1600,projId2],
    ['Instagram Ads Q2','marketing',10000,projId3],['Electricity bill April','utilities',3800,''],
    ['Uber Eats team order','food',2200,projId1],['Train tickets','transport',850,''],
    ['Microsoft Azure','software',5200,projId4],['Office rent May','rent',15000,''],
    ['Freelance developer','salary',35000,projId4],['Google Workspace','software',1400,''],
    ['Taxi to airport','transport',1200,projId1],['Lunch meeting client','food',1800,projId3],
  ];
  descs.forEach(([desc,cat,amt,proj],i)=>{
    const d=new Date(now); d.setDate(d.getDate()-Math.floor(Math.random()*90));
    expenses.push({id:genId(),description:desc,category:cat,amount:amt,projectId:proj,
      date:d.toISOString().split('T')[0],paymentMethod:['cash','card','upi','bank'][i%4],
      status:['approved','approved','pending','approved','submitted'][i%5],
      receipt:null,createdAt:d.toISOString()});
  });
  saveExpenses(expenses);

  const tasks=[
    {id:genId(),title:'Design homepage wireframe',description:'Create wireframes for new homepage',projectId:projId1,priority:'high',status:'done',dueDate:'2026-04-10',createdAt:new Date().toISOString()},
    {id:genId(),title:'Setup CI/CD pipeline',description:'Configure GitHub Actions',projectId:projId2,priority:'critical',status:'in-progress',dueDate:'2026-04-22',createdAt:new Date().toISOString()},
    {id:genId(),title:'Write API documentation',description:'Document all REST endpoints',projectId:projId2,priority:'medium',status:'todo',dueDate:'2026-04-25',createdAt:new Date().toISOString()},
    {id:genId(),title:'Create ad creatives',description:'Design banners for campaign',projectId:projId3,priority:'high',status:'review',dueDate:'2026-04-20',createdAt:new Date().toISOString()},
    {id:genId(),title:'User testing round 1',description:'Test with 5 users',projectId:projId1,priority:'medium',status:'todo',dueDate:'2026-05-01',createdAt:new Date().toISOString()},
    {id:genId(),title:'Database optimization',description:'Index slow queries',projectId:projId2,priority:'high',status:'in-progress',dueDate:'2026-04-23',createdAt:new Date().toISOString()},
    {id:genId(),title:'SEO audit',description:'Run full site SEO check',projectId:projId3,priority:'low',status:'todo',dueDate:'2026-05-10',createdAt:new Date().toISOString()},
    {id:genId(),title:'Deploy staging build',description:'Push to staging server',projectId:projId1,priority:'critical',status:'todo',dueDate:'2026-04-21',createdAt:new Date().toISOString()},
    {id:genId(),title:'Setup AWS VPC',description:'Configure virtual private cloud',projectId:projId4,priority:'critical',status:'in-progress',dueDate:'2026-04-18',createdAt:new Date().toISOString()},
    {id:genId(),title:'Migrate databases',description:'Move PostgreSQL to RDS',projectId:projId4,priority:'high',status:'todo',dueDate:'2026-05-15',createdAt:new Date().toISOString()},
    {id:genId(),title:'Performance benchmarks',description:'Run load tests on new infra',projectId:projId4,priority:'medium',status:'todo',dueDate:'2026-05-20',createdAt:new Date().toISOString()},
    {id:genId(),title:'Social media calendar',description:'Plan Q3 content calendar',projectId:projId3,priority:'medium',status:'review',dueDate:'2026-04-28',createdAt:new Date().toISOString()},
  ];
  saveTasks(tasks);

  const budgets=[
    {id:genId(),amount:50000,period:'monthly',category:'',alertThreshold:80,createdAt:new Date().toISOString()},
    {id:genId(),amount:5000,period:'monthly',category:'food',alertThreshold:75,createdAt:new Date().toISOString()},
    {id:genId(),amount:20000,period:'monthly',category:'software',alertThreshold:90,createdAt:new Date().toISOString()},
    {id:genId(),amount:8000,period:'monthly',category:'transport',alertThreshold:80,createdAt:new Date().toISOString()},
    {id:genId(),amount:25000,period:'monthly',category:'marketing',alertThreshold:85,createdAt:new Date().toISOString()},
  ];
  saveBudgets(budgets);
}
