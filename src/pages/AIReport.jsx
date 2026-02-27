import React, { useState, useEffect } from "react";
import { Transaction } from "@/entities/Transaction";
import { Expense } from "@/entities/Expense";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Brain, FileText, TrendingUp, AlertTriangle, Lightbulb, 
  RefreshCw, Download, Calendar, BarChart3, Shield, Loader2,
  ChevronRight, CheckCircle, XCircle, Info
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";

export default function AIReport() {
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [reportType, setReportType] = useState("comprehensive");
  const [timePeriod, setTimePeriod] = useState("month");
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const user = await User.me();
        const canView = user.role === "admin" || user.permissions?.can_view_profit_data;
        setHasPermission(canView);
        if (canView) {
          const [txData, expData] = await Promise.all([
            Transaction.list("-created_date", 500),
            Expense.list("-created_date", 200).catch(() => [])
          ]);
          setTransactions(txData);
          setExpenses(expData);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    init();
  }, []);

  const getFilteredData = () => {
    const now = new Date();
    let startDate;
    switch (timePeriod) {
      case "week": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7); break;
      case "month": startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case "quarter": startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
      case "year": startDate = new Date(now.getFullYear(), 0, 1); break;
      default: startDate = new Date(0);
    }
    const filtered = transactions.filter(t => new Date(t.created_date) >= startDate);
    const filteredExp = expenses.filter(e => new Date(e.created_date) >= startDate);
    return { transactions: filtered, expenses: filteredExp };
  };

  const buildDataSummary = () => {
    const { transactions: txns, expenses: exps } = getFilteredData();

    // Transaction metrics
    const completed = txns.filter(t => t.fund_status === "已完成交易");
    const pending = txns.filter(t => t.fund_status === "等待中");
    const frozen = txns.filter(t => t.fund_status?.includes("冻结"));
    const returned = txns.filter(t => t.fund_status === "已退回");

    let totalCommission = 0, totalFee = 0, totalExchangeProfit = 0, totalViolation = 0;
    completed.forEach(t => {
      const deposit = parseFloat(t.deposit_amount) || 0;
      const rate = parseFloat(t.exchange_rate) || 1;
      const comm = deposit * ((parseFloat(t.commission_percentage) || 0) / 100);
      const fee = parseFloat(t.transfer_fee) || 0;
      const acceptance = parseFloat(t.acceptance_usdt) || deposit / rate;
      totalCommission += comm / rate;
      totalFee += fee / rate;
      totalExchangeProfit += acceptance - (deposit / rate);
      totalViolation += parseFloat(t.violation_penalty) || 0;
    });

    // Currency distribution
    const currencyMap = {};
    txns.filter(t => !["已退回","冻结（不能处理）","冻结（正在处理）"].includes(t.fund_status)).forEach(t => {
      const code = t.currency?.substring(0, 3) || "OTHER";
      currencyMap[code] = (currencyMap[code] || 0) + (parseFloat(t.deposit_amount) || 0);
    });

    // Customer age analysis
    const ages = txns.map(t => parseFloat(t.customer_age)).filter(a => a > 0);
    const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "N/A";
    const elderlyCount = ages.filter(a => a >= 70).length;

    // Expense summary
    const totalExpenseUSDT = exps.reduce((sum, e) => sum + (parseFloat(e.usdt_amount) || 0), 0);

    return {
      period: timePeriod,
      totalTransactions: txns.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      frozenCount: frozen.length,
      returnedCount: returned.length,
      totalProfit: (totalCommission + totalFee + totalExchangeProfit + totalViolation).toFixed(2),
      commission: totalCommission.toFixed(2),
      transferFee: totalFee.toFixed(2),
      exchangeProfit: totalExchangeProfit.toFixed(2),
      violationPenalty: totalViolation.toFixed(2),
      currencyDistribution: currencyMap,
      avgCustomerAge: avgAge,
      elderlyCustomers: elderlyCount,
      totalExpenses: totalExpenseUSDT.toFixed(2),
      expenseCount: exps.length,
      netProfit: (parseFloat((totalCommission + totalFee + totalExchangeProfit + totalViolation).toFixed(2)) - totalExpenseUSDT).toFixed(2)
    };
  };

  const generateReport = async () => {
    setGenerating(true);
    setError(null);
    setReport(null);

    try {
      const summary = buildDataSummary();
      const { transactions: txns } = getFilteredData();

      const periodLabel = { week: "过去7天", month: "本月", quarter: "本季度", year: "今年", all: "所有时间" }[timePeriod];

      const reportTypePrompts = {
        comprehensive: `生成一份完整的综合业务报告，包括：摘要、各项指标分析、趋势判断和可操作的改进建议。`,
        profit: `重点分析盈利情况，包括：利润来源分解、盈利效率、风险因素和提升盈利的具体建议。`,
        risk: `进行风险评估分析，重点关注：冻结资金风险、高龄客户风险、资金退回情况和风险缓解策略。`,
        trend: `进行趋势分析，包括：业务量变化趋势、货币结构变化、客户结构特征和未来业务预测。`
      };

      const prompt = `你是一位专业的金融业务分析师，请根据以下业务数据${periodLabel}为我${reportTypePrompts[reportType]}

## 业务数据摘要（${periodLabel}）

**交易概况：**
- 总交易笔数：${summary.totalTransactions} 笔
- 已完成交易：${summary.completedCount} 笔
- 等待中：${summary.pendingCount} 笔
- 冻结中：${summary.frozenCount} 笔
- 已退回：${summary.returnedCount} 笔
- 完成率：${summary.totalTransactions > 0 ? ((summary.completedCount / summary.totalTransactions) * 100).toFixed(1) : 0}%

**盈利数据（基于已完成交易，单位 USDT）：**
- 总利润：${summary.totalProfit} USDT
- 佣金收入：${summary.commission} USDT
- 手续费收入：${summary.transferFee} USDT
- 汇率差收益：${summary.exchangeProfit} USDT
- 违规罚金：${summary.violationPenalty} USDT
- 总开支：${summary.totalExpenses} USDT
- 净利润：${summary.netProfit} USDT

**币种分布：**
${Object.entries(summary.currencyDistribution).map(([k, v]) => `- ${k}: ${v.toLocaleString()} (金额)`).join('\n')}

**客户特征：**
- 平均客户年龄：${summary.avgCustomerAge} 岁
- 70岁以上高龄客户：${summary.elderlyCustomers} 人

**开支情况：**
- 总开支笔数：${summary.expenseCount} 笔
- 总开支（USDT）：${summary.totalExpenses} USDT

请用中文生成专业报告，格式要求：
1. 使用 ## 二级标题分节（例如：## 摘要、## 关键指标分析、## 趋势洞察、## 风险提示、## 可行性建议）
2. 使用要点列表（- 开头）呈现关键数据
3. 对异常数据用⚠️标注，对正面指标用✅标注
4. 建议部分要具体可操作，按优先级排列
5. 报告结尾给出一个0-100的业务健康评分及简短说明`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false
      });

      setReport({
        content: result,
        generatedAt: new Date().toLocaleString("zh-CN"),
        period: periodLabel,
        type: reportType,
        summary
      });
    } catch (e) {
      setError("报告生成失败：" + e.message);
    }

    setGenerating(false);
  };

  const downloadReport = () => {
    if (!report) return;
    const content = `AI智能分析报告\n生成时间：${report.generatedAt}\n报告周期：${report.period}\n\n${report.content}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AI报告_${report.period}_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-8 text-center text-lg text-slate-700">加载中...</div>;
  }

  if (!hasPermission) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Card className="max-w-lg text-center p-8">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <Shield className="w-16 h-16 text-red-400" />
            <h2 className="text-xl font-bold text-red-600">访问受限</h2>
            <p className="text-slate-600">您没有查看此页面的权限，请联系管理员。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = buildDataSummary();

  return (
    <div className="p-4 md:p-8 space-y-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
              <Brain className="w-9 h-9 text-purple-600" />
              AI智能报告
            </h1>
            <p className="text-slate-600 mt-2">基于业务数据自动生成深度分析报告</p>
          </div>
          {report && (
            <Button variant="outline" onClick={downloadReport} className="gap-2">
              <Download className="w-4 h-4" />
              下载报告
            </Button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "总交易笔数", value: summary.totalTransactions, icon: FileText, color: "blue" },
            { label: "总利润 (USDT)", value: `${parseFloat(summary.totalProfit).toLocaleString()}`, icon: TrendingUp, color: "green" },
            { label: "净利润 (USDT)", value: `${parseFloat(summary.netProfit).toLocaleString()}`, icon: BarChart3, color: summary.netProfit >= 0 ? "emerald" : "red" },
            { label: "冻结/退回笔数", value: summary.frozenCount + summary.returnedCount, icon: AlertTriangle, color: "amber" },
          ].map((stat, i) => (
            <Card key={i} className="bg-white/80 border border-slate-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-${stat.color}-100`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Config & Generate */}
        <Card className="bg-white/90 border border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="w-5 h-5 text-purple-600" />
              配置报告参数
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> 分析时间段
                </label>
                <Select value={timePeriod} onValueChange={setTimePeriod}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">过去7天</SelectItem>
                    <SelectItem value="month">本月</SelectItem>
                    <SelectItem value="quarter">本季度</SelectItem>
                    <SelectItem value="year">今年</SelectItem>
                    <SelectItem value="all">所有时间</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <FileText className="w-4 h-4" /> 报告类型
                </label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comprehensive">综合报告</SelectItem>
                    <SelectItem value="profit">盈利分析报告</SelectItem>
                    <SelectItem value="risk">风险评估报告</SelectItem>
                    <SelectItem value="trend">趋势分析报告</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {[
                { type: "comprehensive", label: "综合报告", desc: "全面业务概览", icon: FileText },
                { type: "profit", label: "盈利分析", desc: "利润深度拆解", icon: TrendingUp },
                { type: "risk", label: "风险评估", desc: "潜在风险识别", icon: AlertTriangle },
                { type: "trend", label: "趋势分析", desc: "未来业务预测", icon: BarChart3 },
              ].map(item => (
                <button
                  key={item.type}
                  onClick={() => setReportType(item.type)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    reportType === item.type
                      ? "border-purple-500 bg-purple-50"
                      : "border-slate-200 hover:border-purple-300 bg-white"
                  }`}
                >
                  <item.icon className={`w-5 h-5 mb-1 ${reportType === item.type ? "text-purple-600" : "text-slate-400"}`} />
                  <p className={`text-sm font-semibold ${reportType === item.type ? "text-purple-700" : "text-slate-700"}`}>{item.label}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </button>
              ))}
            </div>

            <Button
              onClick={generateReport}
              disabled={generating}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white h-12 text-base"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  AI正在生成报告...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5 mr-2" />
                  生成AI分析报告
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-center gap-3 text-red-700">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        {/* Report Output */}
        {generating && (
          <Card className="bg-white/90 border border-purple-200 shadow-lg">
            <CardContent className="p-8 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                  <Brain className="w-8 h-8 text-purple-600 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-purple-300 border-t-purple-600 animate-spin"></div>
              </div>
              <p className="text-slate-600 text-center">AI正在深度分析您的业务数据，请稍候...</p>
              <p className="text-sm text-slate-400">这通常需要10-30秒</p>
            </CardContent>
          </Card>
        )}

        {report && !generating && (
          <Card className="bg-white/90 border border-slate-200 shadow-xl">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  报告生成完毕
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-purple-700 border-purple-300">
                    {report.period}
                  </Badge>
                  <Badge variant="outline" className="text-slate-600">
                    生成于 {report.generatedAt}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => (
                      <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                        <ChevronRight className="w-5 h-5 text-purple-500" />
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-base font-semibold text-slate-700 mt-4 mb-2">{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-slate-700 leading-relaxed my-2">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="space-y-1 my-2 ml-4">{children}</ul>
                    ),
                    li: ({ children }) => (
                      <li className="text-slate-700 flex gap-2 items-start">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0"></span>
                        <span>{children}</span>
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-slate-900">{children}</strong>
                    ),
                  }}
                >
                  {report.content}
                </ReactMarkdown>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3 justify-end">
                <Button variant="outline" onClick={generateReport} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  重新生成
                </Button>
                <Button onClick={downloadReport} className="gap-2 bg-purple-600 hover:bg-purple-700">
                  <Download className="w-4 h-4" />
                  下载报告
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}