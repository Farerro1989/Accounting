import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// 智能分析引擎
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { analysisType, dateRange, filters } = await req.json();
    const transactions = await base44.entities.Transaction.list();
    
    // 根据分析类型执行不同的分析
    let analysisResult = {};
    
    switch (analysisType) {
      case 'profit_trend':
        analysisResult = analyzeProfitTrend(transactions, dateRange);
        break;
      case 'currency_performance':
        analysisResult = analyzeCurrencyPerformance(transactions);
        break;
      case 'customer_behavior':
        analysisResult = analyzeCustomerBehavior(transactions);
        break;
      case 'risk_assessment':
        analysisResult = analyzeRiskFactors(transactions);
        break;
      default:
        analysisResult = performComprehensiveAnalysis(transactions);
    }

    // 使用AI生成深度洞察
    const aiInsights = await generateAIInsights(base44, analysisResult, transactions);
    
    return new Response(JSON.stringify({
      analysis_type: analysisType,
      result: analysisResult,
      ai_insights: aiInsights,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('智能分析失败:', error);
    return new Response(JSON.stringify({ 
      error: '分析失败', 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// 盈利趋势分析
function analyzeProfitTrend(transactions, dateRange) {
  const completedTransactions = transactions.filter(t => t.fund_status === '已完成交易');
  const trendData = [];
  
  // 按日分组分析
  const groupedByDate = groupTransactionsByDate(completedTransactions);
  
  for (const [date, dayTransactions] of Object.entries(groupedByDate)) {
    const dayProfit = dayTransactions.reduce((total, t) => {
      if (!t.exchange_rate || t.exchange_rate === 0) return total;
      
      const initialUsdt = t.deposit_amount / t.exchange_rate;
      const commission = initialUsdt * (t.commission_percentage / 100);
      const feeUsdt = (t.transfer_fee || 0) / t.exchange_rate;
      
      // Exchange Profit = Acceptance - Initial
      const acceptance = t.acceptance_usdt || 0;
      // If acceptance is 0, we can assume break even on exchange profit (Acceptance = Initial)? 
      // Or use settlement as fallback like dashboard?
      // Dashboard uses: actualAcceptance = acceptance > 0 ? acceptance : settlementUsdt
      const settlementUsdt = t.settlement_usdt || 0;
      const actualAcceptance = acceptance > 0 ? acceptance : settlementUsdt;
      
      const exchangeProfit = actualAcceptance - initialUsdt;
      const penalty = t.violation_penalty || 0;

      // Total Profit = Comm + Fee + ExchangeProfit - Penalty
      const transactionProfit = commission + feeUsdt + exchangeProfit - penalty;
      
      return total + transactionProfit;
    }, 0);
    
    trendData.push({
      date,
      profit: dayProfit,
      volume: dayTransactions.length,
      avgProfit: dayProfit / dayTransactions.length
    });
  }
  
  return {
    trend_data: trendData.sort((a, b) => new Date(a.date) - new Date(b.date)),
    total_profit: trendData.reduce((sum, d) => sum + d.profit, 0),
    growth_rate: calculateGrowthRate(trendData)
  };
}

// 币种表现分析
function analyzeCurrencyPerformance(transactions) {
  const currencyStats = {};
  
  transactions.forEach(t => {
    if (!currencyStats[t.currency]) {
      currencyStats[t.currency] = {
        volume: 0,
        amount: 0,
        profit: 0,
        completedCount: 0,
        averageRate: 0,
        rates: []
      };
    }
    
    const stats = currencyStats[t.currency];
    stats.volume++;
    stats.amount += t.deposit_amount || 0;
    stats.rates.push(t.exchange_rate);
    
    if (t.fund_status === '已完成交易' && t.exchange_rate > 0) {
      stats.completedCount++;
      const initialUsdt = t.deposit_amount / t.exchange_rate;
      const commission = initialUsdt * (t.commission_percentage / 100);
      const feeUsdt = (t.transfer_fee || 0) / t.exchange_rate;
      
      const acceptance = t.acceptance_usdt || 0;
      const settlementUsdt = t.settlement_usdt || 0;
      const actualAcceptance = acceptance > 0 ? acceptance : settlementUsdt;
      
      const exchangeProfit = actualAcceptance - initialUsdt;
      const penalty = t.violation_penalty || 0;
      
      stats.profit += (commission + feeUsdt + exchangeProfit - penalty);
    }
  });
  
  // 计算统计数据
  Object.keys(currencyStats).forEach(currency => {
    const stats = currencyStats[currency];
    stats.averageRate = stats.rates.reduce((sum, rate) => sum + rate, 0) / stats.rates.length;
    stats.completionRate = (stats.completedCount / stats.volume) * 100;
    stats.profitPerTransaction = stats.profit / stats.completedCount || 0;
  });
  
  return currencyStats;
}

// 客户行为分析
function analyzeCustomerBehavior(transactions) {
  const customerStats = {};
  
  transactions.forEach(t => {
    if (!customerStats[t.customer_name]) {
      customerStats[t.customer_name] = {
        transactionCount: 0,
        totalAmount: 0,
        currencies: new Set(),
        avgAmount: 0,
        lastTransaction: null,
        status: t.fund_status
      };
    }
    
    const stats = customerStats[t.customer_name];
    stats.transactionCount++;
    stats.totalAmount += t.deposit_amount || 0;
    stats.currencies.add(t.currency);
    stats.lastTransaction = t.created_date;
  });
  
  // 转换为数组并计算额外指标
  const customerArray = Object.entries(customerStats).map(([name, stats]) => ({
    name,
    ...stats,
    currencies: Array.from(stats.currencies),
    avgAmount: stats.totalAmount / stats.transactionCount,
    loyaltyScore: calculateLoyaltyScore(stats)
  }));
  
  return {
    customers: customerArray.sort((a, b) => b.totalAmount - a.totalAmount),
    topCustomers: customerArray.slice(0, 10),
    newCustomers: customerArray.filter(c => c.transactionCount === 1).length
  };
}

// 辅助函数
function groupTransactionsByDate(transactions) {
  return transactions.reduce((groups, transaction) => {
    const date = new Date(transaction.created_date).toISOString().split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {});
}

function calculateGrowthRate(trendData) {
  if (trendData.length < 2) return 0;
  const recent = trendData.slice(-7); // 最近7天
  const earlier = trendData.slice(-14, -7); // 前7天
  
  const recentAvg = recent.reduce((sum, d) => sum + d.profit, 0) / recent.length;
  const earlierAvg = earlier.reduce((sum, d) => sum + d.profit, 0) / earlier.length;
  
  return earlierAvg === 0 ? 0 : ((recentAvg - earlierAvg) / earlierAvg) * 100;
}

function calculateLoyaltyScore(stats) {
  // 基于交易次数、金额和多样性计算忠诚度评分
  const frequencyScore = Math.min(stats.transactionCount * 10, 50);
  const amountScore = Math.min(stats.totalAmount / 1000, 30);
  const diversityScore = stats.currencies.length * 5;
  
  return frequencyScore + amountScore + diversityScore;
}

// AI洞察生成
async function generateAIInsights(base44, analysisResult, transactions) {
  try {
    const prompt = `作为金融数据分析专家，请分析以下数据并提供专业洞察：

分析结果：
${JSON.stringify(analysisResult, null, 2)}

总交易数：${transactions.length}

请提供：
1. 关键发现和趋势
2. 业务机会识别
3. 潜在风险预警
4. 优化建议

请用专业且易懂的中文回答，每点不超过100字。`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          key_findings: { type: "string", description: "关键发现" },
          opportunities: { type: "string", description: "业务机会" },
          risks: { type: "string", description: "风险预警" },
          recommendations: { type: "string", description: "优化建议" }
        }
      }
    });

    return aiResponse;
  } catch (error) {
    console.error('AI洞察生成失败:', error);
    return {
      key_findings: "数据分析完成，建议关注主要业务指标趋势",
      opportunities: "考虑扩展表现良好的币种业务",
      risks: "注意监控异常交易模式和汇率波动",
      recommendations: "建议优化流程效率，提升客户体验"
    };
  }
}