/* ===== AI FINANCIAL ASSISTANT — Rule-based NLU Chatbot ===== */

let chatHistory = [];
let chatOpen = false;

/** Initialize chatbot UI and event handlers */
function initChatbot() {
  const fab = document.getElementById('chat-fab');
  const panel = document.getElementById('chat-panel');
  const closeBtn = document.getElementById('chat-close');
  const sendBtn = document.getElementById('chat-send-btn');
  const input = document.getElementById('chat-input');

  if (!fab) return;

  fab.addEventListener('click', () => {
    chatOpen = !chatOpen;
    panel.classList.toggle('open', chatOpen);
    if (chatOpen && chatHistory.length === 0) {
      addChatMessage(icon('bot',18)+" Hi! I'm your **Financial Assistant**. I can analyze your expenses, budgets, forecasts, and more. Ask me anything or use the quick actions below!", 'assistant');
    }
    if (chatOpen) input.focus();
  });

  if (closeBtn) closeBtn.addEventListener('click', () => {
    chatOpen = false;
    panel.classList.remove('open');
  });

  if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMessage(); });

  /* Quick action chips */
  document.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.dataset.query;
      if (query) {
        input.value = query;
        sendChatMessage();
      }
    });
  });
}

/** Send a chat message */
function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = (input.value || '').trim();
  if (!text) return;
  input.value = '';

  addChatMessage(text, 'user');

  /* Show typing indicator */
  showTypingIndicator();

  /* Process query with slight delay for natural feel */
  setTimeout(() => {
    hideTypingIndicator();
    const result = processQuery(text);
    addChatMessage(result.response, 'assistant');
    if (result.suggestions && result.suggestions.length) {
      renderSuggestionChips(result.suggestions);
    }
  }, 600 + Math.random() * 400);
}

/** Classify intent and generate response from actual app data */
function processQuery(text) {
  const lower = text.toLowerCase();
  let intent = 'GENERAL';

  /* Intent classification — ordered by specificity */
  if (lower.includes('help') || lower.includes('what can')) intent = 'HELP';
  else if (lower.includes('health') || lower.includes('score') || lower.includes('how am i doing') || lower.includes('how is my')) intent = 'HEALTH_QUERY';
  else if (lower.includes('forecast') || lower.includes('predict') || lower.includes('next month') || lower.includes('future')) intent = 'FORECAST_QUERY';
  else if (lower.includes('compare') || lower.includes(' vs ') || lower.includes('versus') || lower.includes('last month') || lower.includes('previous')) intent = 'COMPARISON';
  else if (lower.includes('save') || lower.includes('saving') || lower.includes('reduce') || lower.includes('cut') || lower.includes('decrease')) intent = 'SAVINGS_ADVICE';
  else if (lower.includes('over budget') || lower.includes('under budget') || lower.includes('budget status') || lower.includes('budget')) intent = 'BUDGET_STATUS';
  else if (lower.includes('project') || lower.includes('which project')) intent = 'PROJECT_ANALYSIS';
  else if (lower.includes('task') || lower.includes('pending') || lower.includes('deadline') || lower.includes('overdue')) intent = 'TASK_QUERY';
  else if (lower.includes('spend') || lower.includes('most') || lower.includes('where') || lower.includes('top') || lower.includes('highest') || lower.includes('category') || lower.includes('expensive')) intent = 'SPENDING_QUERY';

  const handlers = {
    SPENDING_QUERY: handleSpendingQuery,
    BUDGET_STATUS: handleBudgetStatus,
    PROJECT_ANALYSIS: handleProjectAnalysis,
    SAVINGS_ADVICE: handleSavingsAdvice,
    FORECAST_QUERY: handleForecastQuery,
    COMPARISON: handleComparison,
    HEALTH_QUERY: handleHealthQuery,
    TASK_QUERY: handleTaskQuery,
    HELP: handleHelp,
    GENERAL: handleGeneral,
  };

  return (handlers[intent] || handleGeneral)();
}

function handleSpendingQuery() {
  const expenses = getExpenses();
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount); });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const top3 = sorted.slice(0, 3);

  let response = `${icon('pie-chart',18)} Here's your **spending breakdown**:\n\n`;
  top3.forEach(([id, v], i) => {
    const cat = getCat(id);
    response += `${i + 1}. **${cat.icon} ${cat.name}**: ${fmtCurrency(v)} (${Math.round(v / totalAll * 100)}%)\n`;
  });
  response += `\nTotal across all categories: **${fmtCurrency(totalAll)}**`;

  return { response, suggestions: ['Am I over budget?', 'How can I save money?', 'What\'s my forecast?'] };
}

function handleBudgetStatus() {
  const budgets = getBudgets();
  const expenses = getExpenses();
  const thisMonth = new Date().toISOString().slice(0, 7);

  if (!budgets.length) return { response: `${icon('bar-chart',18)} You haven't set any budgets yet. Head to the **Budgets** page to set up monthly limits!`, suggestions: ['Where am I spending the most?', 'What\'s my health score?'] };

  let response = `${icon('target',18)} **Budget Status** for this month:\n\n`;
  let overBudget = 0;
  budgets.filter(b => b.period === 'monthly').forEach(b => {
    let relExp = expenses.filter(e => e.date && e.date.startsWith(thisMonth));
    if (b.category) relExp = relExp.filter(e => e.category === b.category);
    const spent = relExp.reduce((s, e) => s + Number(e.amount), 0);
    const pct = Math.round(spent / b.amount * 100);
    const catName = b.category ? getCat(b.category).name : 'Overall';
    const status = pct >= 100 ? icon('alert-triangle',14)+' Over!' : pct >= 80 ? icon('alert-circle',14)+' Warning' : icon('check-circle',14)+' On track';
    response += `• **${catName}**: ${fmtCurrency(spent)} / ${fmtCurrency(b.amount)} (${pct}%) ${status}\n`;
    if (pct >= 100) overBudget++;
  });

  if (overBudget > 0) response += `\n${icon('alert-triangle',16)} **${overBudget} budget(s)** exceeded. Consider reviewing these categories.`;
  else response += `\n${icon('check-circle',16)} All budgets are under control!`;

  return { response, suggestions: ['How can I save money?', 'What\'s my forecast?', 'Show spending breakdown'] };
}

function handleProjectAnalysis() {
  const projects = getProjects();
  const expenses = getExpenses();

  if (!projects.length) return { response: `${icon('folder',18)} No projects found. Create projects to track expenses by project!`, suggestions: ['Where am I spending the most?'] };

  let response = `${icon('folder',18)} **Project Budget Analysis**:\n\n`;
  let hasOverBudget = false;
  projects.forEach(p => {
    const spent = expenses.filter(e => e.projectId === p.id).reduce((s, e) => s + Number(e.amount), 0);
    const pct = p.budget ? Math.round(spent / p.budget * 100) : 0;
    const status = pct >= 100 ? icon('x-circle',14) : pct >= 75 ? icon('alert-triangle',14) : icon('check-circle',14);
    response += `${status} **${p.name}**: ${fmtCurrency(spent)} / ${fmtCurrency(p.budget)} (${pct}%) — ${p.status}\n`;
    if (pct >= 100) hasOverBudget = true;
  });

  if (hasOverBudget) response += `\n${icon('alert-triangle',16)} Some projects are **over budget**. Review spending allocations.`;

  return { response, suggestions: ['Am I over budget?', 'Show pending tasks', 'What\'s my health score?'] };
}

function handleSavingsAdvice() {
  const expenses = getExpenses();
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount); });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);

  let response = `${icon('lightbulb',18)} **Savings Tips** based on your data:\n\n`;
  const tips = [];

  if (sorted[0]) {
    const [id, v] = sorted[0];
    const pct = Math.round(v / totalAll * 100);
    tips.push(`Your biggest spending area is **${getCat(id).name}** (${pct}% of total). Look for ways to reduce this — even a 10% cut would save **${fmtCurrency(Math.round(v * 0.1))}**.`);
  }

  const subscriptions = expenses.filter(e => ['software'].includes(e.category));
  if (subscriptions.length > 3) {
    const subTotal = subscriptions.reduce((s, e) => s + Number(e.amount), 0);
    tips.push(`You have **${subscriptions.length} software expenses** totaling ${fmtCurrency(subTotal)}. Review if all subscriptions are still needed.`);
  }

  const velocity = typeof getSpendingVelocity === 'function' ? getSpendingVelocity() : null;
  if (velocity && !velocity.onTrack) {
    tips.push(`At your current pace, you'll spend **${fmtCurrency(velocity.projectedMonthEnd)}** this month. Try limiting daily spending to **${fmtCurrency(Math.round(velocity.dailyRate * 0.8))}** for the rest of the month.`);
  }

  tips.push('Set up **category budgets** to get alerts before overspending. This alone can reduce expenses by 15-20%.');

  tips.forEach((t, i) => { response += `${i + 1}. ${t}\n\n`; });

  return { response, suggestions: ['Show spending breakdown', 'Am I over budget?', 'What\'s my forecast?'] };
}

function handleForecastQuery() {
  try {
    const forecast = forecastExpenses(1);
    let response = `${icon('sparkles',18)} **Expense Forecast** for ${forecast.monthLabel}:\n\n`;
    response += `Predicted total: **${fmtCurrency(forecast.totalPredicted)}** (${forecast.overallConfidence}% confidence)\n`;
    response += `Trend: **${forecast.trend}**\n\n`;

    if (forecast.byCategory.length > 0) {
      response += 'Top predicted categories:\n';
      forecast.byCategory.slice(0, 4).forEach(c => {
        response += `• **${c.icon} ${c.categoryName}**: ${fmtCurrency(c.predicted)}\n`;
      });
    }

    return { response, suggestions: ['How can I save money?', 'Am I over budget?', 'What\'s my health score?'] };
  } catch (e) {
    return { response: `${icon('sparkles',18)} I need more spending history to make accurate predictions. Keep tracking expenses for a few months!`, suggestions: ['Where am I spending the most?', 'Am I over budget?'] };
  }
}

function handleComparison() {
  const expenses = getExpenses();
  const now = new Date();
  const thisKey = now.toISOString().slice(0, 7);
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = lastDate.toISOString().slice(0, 7);

  const thisTotal = expenses.filter(e => e.date && e.date.startsWith(thisKey)).reduce((s, e) => s + Number(e.amount), 0);
  const lastTotal = expenses.filter(e => e.date && e.date.startsWith(lastKey)).reduce((s, e) => s + Number(e.amount), 0);
  const change = lastTotal > 0 ? Math.round((thisTotal - lastTotal) / lastTotal * 100) : 0;
  const direction = change > 0 ? icon('trending-up',16)+' increased' : change < 0 ? icon('trending-down',16)+' decreased' : icon('minus',16)+' stayed the same';

  let response = `${icon('bar-chart',18)} **Month-over-Month Comparison**:\n\n`;
  response += `This month: **${fmtCurrency(thisTotal)}**\n`;
  response += `Last month: **${fmtCurrency(lastTotal)}**\n`;
  response += `Change: ${direction} by **${Math.abs(change)}%**\n\n`;

  /* Category comparison */
  const catThis = {};
  const catLast = {};
  expenses.filter(e => e.date && e.date.startsWith(thisKey)).forEach(e => { catThis[e.category] = (catThis[e.category] || 0) + Number(e.amount); });
  expenses.filter(e => e.date && e.date.startsWith(lastKey)).forEach(e => { catLast[e.category] = (catLast[e.category] || 0) + Number(e.amount); });

  const bigChanges = [];
  Object.keys({ ...catThis, ...catLast }).forEach(cat => {
    const t = catThis[cat] || 0;
    const l = catLast[cat] || 0;
    if (l > 0) {
      const catChange = Math.round((t - l) / l * 100);
      if (Math.abs(catChange) >= 20) bigChanges.push({ cat, change: catChange });
    }
  });

  if (bigChanges.length > 0) {
    response += 'Notable category changes:\n';
    bigChanges.slice(0, 3).forEach(({ cat, change: c }) => {
      response += `• **${getCat(cat).name}**: ${c > 0 ? '+' : ''}${c}%\n`;
    });
  }

  return { response, suggestions: ['Where am I spending the most?', 'What\'s my forecast?', 'How can I save money?'] };
}

function handleHealthQuery() {
  try {
    const health = calculateFinancialHealth();
    const gradeEmoji = { A: icon('award',16), B: icon('check-circle',16), C: icon('alert-triangle',16), D: icon('trending-down',16), F: icon('x-circle',16) };
    let response = `${icon('activity',18)} **Financial Health Score**: **${health.score}/100** (Grade: ${gradeEmoji[health.grade] || ''} ${health.grade})\n\n`;
    response += 'Factor breakdown:\n';
    health.factors.forEach(f => {
      const fIcon = f.status === 'good' ? icon('check-circle',14) : f.status === 'warning' ? icon('alert-triangle',14) : icon('x-circle',14);
      response += `${fIcon} **${f.name}**: ${f.score}/${f.maxScore}\n`;
    });
    if (health.recommendations.length > 0) {
      response += `\n${icon('lightbulb',16)} ` + health.recommendations[0];
    }

    return { response, suggestions: ['How can I save money?', 'Am I over budget?', 'Compare with last month'] };
  } catch (e) {
    return { response: `${icon('activity',18)} I need more data to calculate your financial health score. Keep tracking expenses!`, suggestions: ['Where am I spending the most?'] };
  }
}

function handleTaskQuery() {
  const tasks = getTasks();
  const pending = tasks.filter(t => t.status !== 'done');
  const overdue = pending.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
  const upcoming = pending.filter(t => {
    if (!t.dueDate) return false;
    const dl = daysLeft(t.dueDate);
    return dl >= 0 && dl <= 3;
  });

  let response = `${icon('clipboard',18)} **Task Overview**:\n\n`;
  response += `Total pending: **${pending.length}** tasks\n`;
  response += `Overdue: **${overdue.length}** ${overdue.length > 0 ? icon('alert-triangle',14) : icon('check-circle',14)}\n`;
  response += `Due within 3 days: **${upcoming.length}**\n\n`;

  if (overdue.length > 0) {
    response += 'Overdue tasks:\n';
    overdue.slice(0, 3).forEach(t => {
      response += `• ${icon('x-circle',14)} **${t.title}** (was due ${fmtDate(t.dueDate)})\n`;
    });
  }

  return { response, suggestions: ['Show project analysis', 'What\'s my health score?', 'Where am I spending the most?'] };
}

function handleHelp() {
  return {
    response: `${icon('bot',18)} I can help you with:\n\n` +
      `${icon('pie-chart',14)} **"Where am I spending the most?"** — Top spending categories\n` +
      `${icon('target',14)} **"Am I over budget?"** — Budget status check\n` +
      `${icon('folder',14)} **"Which project is over budget?"** — Project analysis\n` +
      `${icon('lightbulb',14)} **"How can I save money?"** — Personalized savings tips\n` +
      `${icon('sparkles',14)} **"What's my forecast?"** — Next month prediction\n` +
      `${icon('bar-chart',14)} **"Compare with last month"** — Month-over-month changes\n` +
      `${icon('activity',14)} **"What's my health score?"** — Financial health assessment\n` +
      `${icon('clipboard',14)} **"Show pending tasks"** — Task overview\n\n` +
      `Just type a question or use the quick actions below!`,
    suggestions: ['Where am I spending the most?', 'Am I over budget?', 'What\'s my health score?']
  };
}

function handleGeneral() {
  const expenses = getExpenses();
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  return {
    response: `${icon('bar-chart',18)} You've tracked **${expenses.length} expenses** totaling **${fmtCurrency(total)}**. I can analyze your spending patterns, check budgets, forecast future expenses, and more. Try asking me a specific question!\n\nType **"help"** to see all available commands.`,
    suggestions: ['Help', 'Where am I spending the most?', 'Am I over budget?']
  };
}

/** Add a message to the chat UI */
function addChatMessage(text, sender) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + sender;

  /* Format markdown-like bold text */
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  bubble.innerHTML = formatted;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  chatHistory.push({ text, sender, time: new Date().toISOString() });
}

/** Show typing indicator */
function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const existing = container.querySelector('.typing-indicator');
  if (existing) return;
  const div = document.createElement('div');
  div.className = 'typing-indicator chat-bubble assistant';
  div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

/** Hide typing indicator */
function hideTypingIndicator() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const el = container.querySelector('.typing-indicator');
  if (el) el.remove();
}

/** Render clickable suggestion chips after assistant response */
function renderSuggestionChips(suggestions) {
  const container = document.getElementById('chat-messages');
  if (!container || !suggestions.length) return;

  const chipsDiv = document.createElement('div');
  chipsDiv.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;align-self:flex-start;';
  suggestions.forEach(s => {
    const chip = document.createElement('button');
    chip.className = 'chat-chip';
    chip.textContent = s;
    chip.onclick = () => {
      document.getElementById('chat-input').value = s;
      sendChatMessage();
      chipsDiv.remove(); /* Remove chips after use */
    };
    chipsDiv.appendChild(chip);
  });
  container.appendChild(chipsDiv);
  container.scrollTop = container.scrollHeight;
}
