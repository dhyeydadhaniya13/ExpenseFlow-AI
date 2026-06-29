/* ===== AI ENGINE — Forecasting, Health Score, Budget Recommendations ===== */

/**
 * Recommend monthly budgets per category based on historical spending analysis
 * Uses median + IQR to suggest reasonable limits
 */
function recommendBudgets() {
  const expenses = getExpenses();
  const now = new Date();
  const recommendations = [];

  CATEGORIES.forEach(cat => {
    /* Get monthly totals for this category over last 6 months */
    const monthlyTotals = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const total = expenses.filter(e => e.category === cat.id && e.date && e.date.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0);
      if (total > 0) monthlyTotals.push(total);
    }
    if (monthlyTotals.length < 2) return; /* Need at least 2 months of data */

    const sorted = [...monthlyTotals].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
    const average = monthlyTotals.reduce((s, v) => s + v, 0) / monthlyTotals.length;

    /* Determine trend */
    const recent = monthlyTotals.slice(0, 2);
    const older = monthlyTotals.slice(2);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const olderAvg = older.length ? older.reduce((s, v) => s + v, 0) / older.length : recentAvg;
    let trend = 'stable';
    if (recentAvg > olderAvg * 1.15) trend = 'increasing';
    else if (recentAvg < olderAvg * 0.85) trend = 'decreasing';

    /* Recommended budget: median + buffer based on trend */
    let recommended = median;
    if (trend === 'increasing') recommended = Math.round(median * 1.15);
    else if (trend === 'decreasing') recommended = Math.round(median * 0.95);
    else recommended = Math.round(median * 1.05);

    /* Confidence based on data consistency */
    const stdDev = Math.sqrt(monthlyTotals.reduce((s, v) => s + Math.pow(v - average, 2), 0) / monthlyTotals.length);
    const cv = average > 0 ? stdDev / average : 0;
    const confidence = Math.max(40, Math.min(95, Math.round(100 - cv * 100)));

    recommendations.push({
      category: cat.id, categoryName: cat.name, icon: cat.icon,
      average: Math.round(average), median: Math.round(median),
      recommended, trend, confidence,
    });
  });

  return recommendations.sort((a, b) => b.average - a.average);
}

/**
 * Forecast expenses for upcoming months using weighted moving average
 */
function forecastExpenses(monthsAhead) {
  monthsAhead = monthsAhead || 1;
  const expenses = getExpenses();
  const now = new Date();

  /* Calculate monthly totals for last 6 months */
  const monthlyData = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const total = expenses.filter(e => e.date && e.date.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0);
    monthlyData.push({ month: key, total });
  }
  monthlyData.reverse(); /* oldest first */

  /* Weighted moving average (recent months weighted higher) */
  const weights = [1, 1.5, 2, 2.5, 3, 4];
  let weightedSum = 0, weightTotal = 0;
  monthlyData.forEach((m, i) => {
    if (m.total > 0) {
      weightedSum += m.total * (weights[i] || 1);
      weightTotal += weights[i] || 1;
    }
  });
  const wma = weightTotal > 0 ? weightedSum / weightTotal : 0;

  /* Simple linear regression for trend */
  const nonZero = monthlyData.filter(m => m.total > 0);
  let slope = 0;
  if (nonZero.length >= 3) {
    const n = nonZero.length;
    const xMean = (n - 1) / 2;
    const yMean = nonZero.reduce((s, m) => s + m.total, 0) / n;
    let num = 0, den = 0;
    nonZero.forEach((m, i) => {
      num += (i - xMean) * (m.total - yMean);
      den += (i - xMean) * (i - xMean);
    });
    slope = den !== 0 ? num / den : 0;
  }

  const totalPredicted = Math.round(Math.max(0, wma + slope * monthsAhead));

  /* Forecast per category */
  const byCategory = [];
  CATEGORIES.forEach(cat => {
    const catMonthly = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const total = expenses.filter(e => e.category === cat.id && e.date && e.date.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0);
      catMonthly.push(total);
    }
    catMonthly.reverse();
    const catAvg = catMonthly.filter(v => v > 0).reduce((s, v) => s + v, 0) / Math.max(1, catMonthly.filter(v => v > 0).length);
    if (catAvg > 0) {
      const stdDev = Math.sqrt(catMonthly.filter(v => v > 0).reduce((s, v) => s + Math.pow(v - catAvg, 2), 0) / Math.max(1, catMonthly.filter(v => v > 0).length));
      const cv = catAvg > 0 ? stdDev / catAvg : 0;
      const confidence = Math.max(40, Math.min(95, Math.round(100 - cv * 80)));
      byCategory.push({ category: cat.id, categoryName: cat.name, icon: cat.icon, predicted: Math.round(catAvg), confidence });
    }
  });

  /* Overall confidence */
  const totals = monthlyData.map(m => m.total).filter(v => v > 0);
  const totalAvg = totals.reduce((s, v) => s + v, 0) / Math.max(1, totals.length);
  const totalStd = Math.sqrt(totals.reduce((s, v) => s + Math.pow(v - totalAvg, 2), 0) / Math.max(1, totals.length));
  const totalCV = totalAvg > 0 ? totalStd / totalAvg : 0;
  const overallConfidence = Math.max(35, Math.min(92, Math.round(100 - totalCV * 80)));

  const trend = slope > totalAvg * 0.05 ? 'increasing' : slope < -totalAvg * 0.05 ? 'decreasing' : 'stable';

  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
  const monthLabel = targetDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return { totalPredicted, byCategory: byCategory.sort((a, b) => b.predicted - a.predicted), overallConfidence, trend, monthLabel };
}

/**
 * Calculate Financial Health Score (0-100) based on 4 factors
 */
function calculateFinancialHealth() {
  const expenses = getExpenses();
  const budgets = getBudgets();
  const projects = getProjects();
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const factors = [];
  let totalScore = 0;

  /* Factor 1: Budget Adherence (25 points) */
  const monthlyBudgets = budgets.filter(b => b.period === 'monthly');
  let budgetScore = 25; /* Default if no budgets */
  if (monthlyBudgets.length > 0) {
    let adherenceTotal = 0;
    monthlyBudgets.forEach(b => {
      let relExp = expenses.filter(e => e.date && e.date.startsWith(thisMonth));
      if (b.category) relExp = relExp.filter(e => e.category === b.category);
      const spent = relExp.reduce((s, e) => s + Number(e.amount), 0);
      const ratio = b.amount > 0 ? spent / b.amount : 0;
      if (ratio <= 0.9) adherenceTotal += 1;
      else if (ratio <= 1.0) adherenceTotal += 0.8;
      else if (ratio <= 1.2) adherenceTotal += 0.4;
      else adherenceTotal += 0;
    });
    budgetScore = Math.round((adherenceTotal / monthlyBudgets.length) * 25);
  }
  const budgetStatus = budgetScore >= 20 ? 'good' : budgetScore >= 12 ? 'warning' : 'danger';
  factors.push({ name: 'Budget Adherence', score: budgetScore, maxScore: 25, description: budgetScore >= 20 ? 'Spending within budget limits' : 'Some budgets exceeded', status: budgetStatus });
  totalScore += budgetScore;

  /* Factor 2: Spending Consistency (25 points) */
  const monthlyTotals = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const total = expenses.filter(e => e.date && e.date.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0);
    if (total > 0) monthlyTotals.push(total);
  }
  let consistencyScore = 15;
  if (monthlyTotals.length >= 3) {
    const avg = monthlyTotals.reduce((s, v) => s + v, 0) / monthlyTotals.length;
    const stdDev = Math.sqrt(monthlyTotals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / monthlyTotals.length);
    const cv = avg > 0 ? stdDev / avg : 0;
    consistencyScore = Math.round(Math.max(0, Math.min(25, 25 * (1 - cv))));
  }
  const consistencyStatus = consistencyScore >= 18 ? 'good' : consistencyScore >= 10 ? 'warning' : 'danger';
  factors.push({ name: 'Spending Consistency', score: consistencyScore, maxScore: 25, description: consistencyScore >= 18 ? 'Predictable spending patterns' : 'Spending varies significantly', status: consistencyStatus });
  totalScore += consistencyScore;

  /* Factor 3: Project Utilization (25 points) */
  let projectScore = 20;
  const activeProjects = projects.filter(p => p.status === 'active');
  if (activeProjects.length > 0) {
    let projHealth = 0;
    activeProjects.forEach(p => {
      const spent = expenses.filter(e => e.projectId === p.id).reduce((s, e) => s + Number(e.amount), 0);
      const ratio = p.budget > 0 ? spent / p.budget : 0;
      if (ratio <= 0.8) projHealth += 1;
      else if (ratio <= 1.0) projHealth += 0.7;
      else projHealth += 0.2;
    });
    projectScore = Math.round((projHealth / activeProjects.length) * 25);
  }
  const projectStatus = projectScore >= 18 ? 'good' : projectScore >= 10 ? 'warning' : 'danger';
  factors.push({ name: 'Project Utilization', score: projectScore, maxScore: 25, description: projectScore >= 18 ? 'Projects within budget' : 'Some projects over budget', status: projectStatus });
  totalScore += projectScore;

  /* Factor 4: Expense Growth Trend (25 points) */
  let trendScore = 15;
  if (monthlyTotals.length >= 3) {
    const recent = monthlyTotals.slice(0, 2);
    const older = monthlyTotals.slice(2);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const olderAvg = older.length ? older.reduce((s, v) => s + v, 0) / older.length : recentAvg;
    const growthRate = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;
    if (growthRate <= -0.1) trendScore = 25; /* Decreasing = great */
    else if (growthRate <= 0.05) trendScore = 20; /* Stable */
    else if (growthRate <= 0.15) trendScore = 12; /* Slight increase */
    else trendScore = 5; /* Rapid increase */
  }
  const trendStatus = trendScore >= 18 ? 'good' : trendScore >= 10 ? 'warning' : 'danger';
  factors.push({ name: 'Expense Growth Trend', score: trendScore, maxScore: 25, description: trendScore >= 18 ? 'Spending is stable or decreasing' : 'Expenses trending upward', status: trendStatus });
  totalScore += trendScore;

  /* Grade calculation */
  let grade = 'F';
  if (totalScore >= 85) grade = 'A';
  else if (totalScore >= 70) grade = 'B';
  else if (totalScore >= 55) grade = 'C';
  else if (totalScore >= 40) grade = 'D';

  /* Generate recommendations */
  const recommendations = [];
  if (budgetScore < 20) recommendations.push('Review and adjust your budgets to match realistic spending patterns.');
  if (consistencyScore < 15) recommendations.push('Try to maintain more consistent monthly spending to improve predictability.');
  if (projectScore < 15) recommendations.push('Some projects are over budget — consider reallocating funds or cutting costs.');
  if (trendScore < 15) recommendations.push('Your expenses are increasing — review subscriptions and recurring costs.');
  if (totalScore >= 80) recommendations.push('Great financial health! Keep maintaining your current spending habits.');

  const overallTrend = trendScore >= 18 ? 'improving' : trendScore >= 10 ? 'stable' : 'declining';

  return { score: totalScore, grade, factors, recommendations, trend: overallTrend };
}

/**
 * Get category spending trend over N months
 */
function getCategorySpendingTrend(categoryId, months) {
  months = months || 6;
  const expenses = getExpenses();
  const now = new Date();
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const total = expenses.filter(e => e.category === categoryId && e.date && e.date.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0);
    result.push({ month: key, amount: total });
  }
  return result;
}

/**
 * Calculate current month spending velocity
 */
function getSpendingVelocity() {
  const expenses = getExpenses();
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const monthExp = expenses.filter(e => e.date && e.date.startsWith(thisMonth));
  const totalSpent = monthExp.reduce((s, e) => s + Number(e.amount), 0);
  const daysGone = now.getDate();
  const daysTotal = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysTotal - daysGone;
  const dailyRate = daysGone > 0 ? totalSpent / daysGone : 0;
  const projectedMonthEnd = Math.round(dailyRate * daysTotal);

  const budgets = getBudgets();
  const totalBudget = budgets.filter(b => b.period === 'monthly' && !b.category).reduce((s, b) => s + Number(b.amount), 0);
  const onTrack = totalBudget > 0 ? projectedMonthEnd <= totalBudget : true;

  return { dailyRate: Math.round(dailyRate), projectedMonthEnd, daysRemaining, onTrack, totalSpent: Math.round(totalSpent) };
}

/**
 * Generate natural-language budget insights
 */
function generateBudgetInsights() {
  const recs = recommendBudgets();
  const insights = [];
  recs.forEach(r => {
    if (r.trend === 'increasing') insights.push(`${r.icon} ${r.categoryName} spending is trending up. Consider setting a budget cap at ${fmtCurrency(r.recommended)}.`);
    if (r.confidence >= 80 && r.trend === 'stable') insights.push(`${r.icon} ${r.categoryName} spending is very consistent at ~${fmtCurrency(r.median)}/month.`);
  });
  const velocity = getSpendingVelocity();
  if (!velocity.onTrack) insights.push(`${icon('alert-triangle',14)} At current pace, you'll spend ${fmtCurrency(velocity.projectedMonthEnd)} this month, which may exceed your budget.`);
  if (insights.length === 0) insights.push(`${icon('check-circle',14)} Your spending patterns look healthy. Keep tracking expenses regularly!`);
  return insights;
}
