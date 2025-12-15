import React, { useState, useEffect } from "react";
import { Transaction } from "@/entities/Transaction";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, DollarSign, CreditCard, Calendar, BarChartHorizontal, Coins, Calculator, Target, AlertCircle, Download } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, isValid, isWithinInterval, startOfYear, endOfYear } from "date-fns";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

import StatCard from "../components/dashboard/StatCard";
import TransactionChart from "../components/dashboard/TransactionChart";
import StatusOverview from "../components/dashboard/StatusOverview";
import StatusDetailModal from "../components/dashboard/StatusDetailModal";
import MaintenanceAlert from "../components/dashboard/MaintenanceAlert";
import ProfitVisual from "../components/dashboard/ProfitVisual";
import ProfitStats from "../components/dashboard/ProfitStats";
import ProfitReportTable from "../components/dashboard/ProfitReportTable";
import CustomerStatsChart from "../components/dashboard/CustomerStatsChart";

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState("all");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
        const navigate = useNavigate();

        useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [transactionData, userData] = await Promise.all([
          Transaction.list("-created_date", 1000),
          User.me()
        ]);
        setTransactions(transactionData);
        setCurrentUser(userData);
      } catch (error) {
        console.error("加载数据失败:", error);
      }
      setLoading(false);
    };
    init();
  }, []);

  const permissions = React.useMemo(() => {
    if (!currentUser) return {};
    if (currentUser.role === 'admin') {
      return { 
        can_view_commission_stats: true, 
        can_view_profit_data: true 
      };
    }
    return currentUser.permissions || {};
  }, [currentUser]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await Transaction.list("-created_date", 1000);
      setTransactions(data);
    } catch (error) {
      console.error("加载交易数据失败:", error);
    }
    setLoading(false);
  };

  const getQuarterDates = (year, quarter) => {
    const yearNum = parseInt(year);
    switch (quarter) {
      case "Q1":
        return {
          start: new Date(yearNum, 0, 1),
          end: new Date(yearNum, 2, 31, 23, 59, 59)
        };
      case "Q2":
        return {
          start: new Date(yearNum, 3, 1),
          end: new Date(yearNum, 5, 30, 23, 59, 59)
        };
      case "Q3":
        return {
          start: new Date(yearNum, 6, 1),
          end: new Date(yearNum, 8, 30, 23, 59, 59)
        };
      case "Q4":
        return {
          start: new Date(yearNum, 9, 1),
          end: new Date(yearNum, 11, 31, 23, 59, 59)
        };
      default:
        return { start: new Date(), end: new Date() };
    }
  };

  const getFilteredTransactions = () => {
    const now = new Date();
    
    switch (timeFilter) {
      case "today":
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        return transactions.filter(t => {
          const transactionDate = new Date(t.created_date);
          return isValid(transactionDate) && 
                 isWithinInterval(transactionDate, { start: todayStart, end: todayEnd });
        });
        
      case "month":
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        return transactions.filter(t => {
          const transactionDate = new Date(t.created_date);
          return isValid(transactionDate) && 
                 isWithinInterval(transactionDate, { start: monthStart, end: monthEnd });
        });

      case "quarter":
        const { start: quarterStart, end: quarterEnd } = getQuarterDates(selectedYear, selectedQuarter);
        return transactions.filter(t => {
          const transactionDate = new Date(t.created_date);
          return isValid(transactionDate) && 
                 isWithinInterval(transactionDate, { start: quarterStart, end: quarterEnd });
        });

      case "year":
        const yearStart = startOfYear(new Date(parseInt(selectedYear), 0, 1));
        const yearEnd = endOfYear(new Date(parseInt(selectedYear), 0, 1));
        return transactions.filter(t => {
          const transactionDate = new Date(t.created_date);
          return isValid(transactionDate) && 
                 isWithinInterval(transactionDate, { start: yearStart, end: yearEnd });
        });
        
      case "all":
      default:
        return transactions;
    }
  };

  const calculateMetrics = () => {
    const allFilteredTransactions = getFilteredTransactions();
    
    const depositsByCurrency = allFilteredTransactions.reduce((acc, t) => {
      // 已退回的资金不计入总账目
      if (t.fund_status === '已退回') return acc;

      const currencyCode = t.currency?.replace(/[\u4e00-\u9fa5]/g, '') || 'OTHER';
      if (!acc[currencyCode]) {
        acc[currencyCode] = { amount: 0, count: 0 };
      }
      acc[currencyCode].amount += (t.deposit_amount || 0);
      acc[currencyCode].count += 1;
      return acc;
    }, {});

    // 总笔数也排除已退回的吗？通常"Total Accounts"指金额。
    // 但用户说"不能记录进总账目"，为了一致性，这里只统计有效的交易笔数
    const effectiveTransactions = allFilteredTransactions.filter(t => t.fund_status !== '已退回');
    const totalTransactions = effectiveTransactions.length;

    return {
      depositsByCurrency,
      totalTransactions,
    };
  };

  const calculateProfitMetrics = () => {
    const filteredTransactions = getFilteredTransactions();
    const completedTransactions = filteredTransactions.filter(t => t.fund_status === '已完成交易');

    let totalCommission = 0;
    let totalTransferFee = 0;
    let totalExchangeRateProfit = 0;
    let totalViolationPenalty = 0;
    let completedCount = 0;

    for (const t of completedTransactions) {
      const depositAmount = parseFloat(t.deposit_amount);
      const exchangeRate = parseFloat(t.exchange_rate);
      
      if (!depositAmount || !exchangeRate || exchangeRate === 0) {
        continue;
      }

      // New Logic:
      // 1. Fee (Native) = 25 (or t.transfer_fee)
      // 2. Comm (Native) = Deposit * %
      // 3. Net (Native) = Deposit - Fee - Comm
      // 4. Settlement (USDT) = Net / Rate
      // 5. Acceptance (USDT) = Manual Input
      // 6. Profit = Acceptance - Settlement

      const feeNative = parseFloat(t.transfer_fee) || 0;
      const commNative = depositAmount * ((parseFloat(t.commission_percentage) || 0) / 100);
      const netNative = depositAmount - feeNative - commNative;
      const settlementUsdt = netNative / exchangeRate;
      
      const acceptanceUsdt = parseFloat(t.acceptance_usdt) || 0;
      const violationPenalty = parseFloat(t.violation_penalty) || 0;

      // To calculate components in USDT for display:
      const commissionUsdt = commNative / exchangeRate;
      const feeUsdt = feeNative / exchangeRate;

      // If acceptance is 0 (not entered), assume break-even (profit = commission + fee)
      // i.e. effectively Acceptance = Settlement + Comm + Fee? No.
      // If not entered, we can't calculate real profit. We will use 0 for acceptance.
      // But to avoid massive negative numbers in "Actual Profit" if user hasn't entered data,
      // we might want to use settlementUsdt as a fallback for Acceptance? 
      // No, let's stick to strict logic. If no acceptance, then profit is negative (we paid client but got nothing?). 
      // Wait, usually "Completed" means we have the money.
      // Let's use settlementUsdt as fallback for Acceptance if 0, so profit is 0.
      const actualAcceptance = acceptanceUsdt > 0 ? acceptanceUsdt : settlementUsdt;

      // Profit = Acceptance - Settlement - Penalty
      // (User formula said "Total Profit = Comm + Fee + ExchangeProfit", but ExchangeProfit = Acceptance - Settlement)
      // We will use Acceptance - Settlement as the Total Profit because that is the physical money remaining.
      const totalTradeProfit = actualAcceptance - settlementUsdt - violationPenalty;

      totalCommission += commissionUsdt;
      totalTransferFee += feeUsdt;
      // Exchange Profit = Acceptance - Initial USDT
      const initialUsdt = depositAmount / exchangeRate;
      const exchangeProfit = actualAcceptance - initialUsdt;
      totalExchangeRateProfit += exchangeProfit; 
      
      totalViolationPenalty += violationPenalty;
      completedCount++;
    }

    const totalProfit = totalCommission + totalTransferFee + totalExchangeRateProfit - totalViolationPenalty;

    let estimatedCommission = 0;
    let estimatedTransferFee = 0;
    let estimatedExchangeRateProfit = 0;
    let estimatedViolationPenalty = 0;
    let estimatedCount = 0;
    let totalFrozenFunds = 0; // 新增：冻结资金总额

    for (const t of filteredTransactions) {
      // 已退回的资金不计入预估盈利
      if (t.fund_status === '已退回') continue;

      const depositAmount = parseFloat(t.deposit_amount);
      const exchangeRate = parseFloat(t.exchange_rate);

      if (!depositAmount || !exchangeRate || exchangeRate === 0) {
        continue;
      }

      const feeNative = parseFloat(t.transfer_fee) || 0;
      const commNative = depositAmount * ((parseFloat(t.commission_percentage) || 0) / 100);
      const netNative = depositAmount - feeNative - commNative;
      const settlementUsdt = netNative / exchangeRate;
      
      const acceptanceUsdt = parseFloat(t.acceptance_usdt) || 0;
      const violationPenalty = parseFloat(t.violation_penalty) || 0;

      const commissionUsdt = commNative / exchangeRate;
      const feeUsdt = feeNative / exchangeRate;

      // For estimation, if acceptance is 0, we assume we get the full value of deposit converted at market rate?
      // Or we assume we get enough to cover settlement?
      // Let's assume Acceptance = Settlement + Comm + Fee (i.e. the Spread is 0) if not entered.
      // Or assume Acceptance = Deposit / ExchangeRate (Market)?
      // Since we don't have a separate market rate, we can't estimate spread.
      // So we assume Spread is 0.
      // Thus Acceptance = Settlement + Comm + Fee.
      // So Profit = Comm + Fee.
      
      const estimatedAcceptance = acceptanceUsdt > 0 ? acceptanceUsdt : (settlementUsdt + commissionUsdt + feeUsdt);
      
      // Exchange Profit = Acceptance - Initial USDT
      const initialUsdt = depositAmount / exchangeRate;
      const estimatedExchangeProfit = estimatedAcceptance - initialUsdt;

      estimatedCommission += commissionUsdt;
      estimatedTransferFee += feeUsdt;
      estimatedExchangeRateProfit += estimatedExchangeProfit;
      estimatedViolationPenalty += violationPenalty;
      estimatedCount++;
      
      // 统计冻结资金 (冻结（不能处理）)
      if (t.fund_status === '冻结（不能处理）') {
        // 计算冻结资金的USDT价值 (Deposit / Rate)
        const frozenUsdt = depositAmount / exchangeRate;
        totalFrozenFunds += frozenUsdt;
      }
    }

    const estimatedProfit = estimatedCommission + estimatedTransferFee + estimatedExchangeRateProfit - estimatedViolationPenalty;

    return {
      commission: totalCommission,
      transferFee: totalTransferFee,
      exchangeRateProfit: totalExchangeRateProfit,
      violationPenalty: totalViolationPenalty,
      frozenFunds: totalFrozenFunds, // 返回冻结资金
      profit: totalProfit,
      completedCount: completedCount,
      
      estimatedCommission: estimatedCommission,
      estimatedTransferFee: estimatedTransferFee,
      estimatedExchangeRateProfit: estimatedExchangeRateProfit,
      estimatedViolationPenalty: estimatedViolationPenalty,
      estimatedProfit: estimatedProfit,
      estimatedCount: estimatedCount
    };
  };

  const getStatusTransactions = (status) => {
    return getFilteredTransactions().filter(t => t.fund_status === status);
  };

  const handleStatusClick = (status, transactions) => {
    setSelectedStatus({ status, transactions });
    setShowStatusModal(true);
  };

  const handleUpdateTransaction = async (transactionId, updateData) => {
    try {
      await Transaction.update(transactionId, updateData);
      await loadTransactions();
      
      if (selectedStatus) {
        const updatedTransactionInFullList = transactions.find(transaction => transaction.id === transactionId);
        
        const updatedTransactionsInModal = selectedStatus.transactions.map((t) => {
          if (t.id === transactionId) {
            return { ...t, ...updateData, ...updatedTransactionInFullList };
          }
          return t;
        });
        setSelectedStatus({
          ...selectedStatus,
          transactions: updatedTransactionsInModal
        });
      }
    } catch (error) {
      console.error("更新交易失败:", error);
      throw error;
    }
  };

  const metrics = calculateMetrics();
  const profitMetrics = calculateProfitMetrics();

  const getTimeFilterLabel = () => {
    switch (timeFilter) {
      case "today": return "今日";
      case "month": return "本月";
      case "quarter": return `${selectedYear}年第${selectedQuarter.slice(1)}季度`;
      case "year": return `${selectedYear}年全年`;
      case "all": return "累计";
      default: return "累计";
    }
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const startYear = 2025;
    const endYear = Math.max(currentYear + 2, 2030);
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year.toString());
    }
    return years;
  };

  const currencyColors = ["green", "blue", "yellow", "purple", "red", "orange", "indigo"];
  const majorCurrencies = ['USD', 'EUR', 'GBP'];
  const otherCurrencies = Object.entries(metrics.depositsByCurrency).filter(
    ([currency]) => !majorCurrencies.includes(currency)
  );

  // 统计各个入款账户（按公司+币种分类）
  const accountStats = React.useMemo(() => {
    const filteredTxns = getFilteredTransactions();
    const stats = {};

    filteredTxns.forEach(t => {
      // 已退回的资金不计入账户统计
      if (t.fund_status === '已退回') return;

      const company = t.receiving_account_name || '未知公司';
      const currency = t.currency?.substring(0, 3) || 'XXX';
      const account = t.receiving_account_number || '未知账户';

      if (!stats[company]) {
        stats[company] = {};
      }
      if (!stats[company][currency]) {
        stats[company][currency] = {
          count: 0,
          totalAmount: 0,
          accountDetails: {} // 用于存储每个账户的具体统计
        };
      }

      // 总计
      stats[company][currency].count += 1;
      stats[company][currency].totalAmount += (t.deposit_amount || 0);

      // 单个账户统计
      if (!stats[company][currency].accountDetails[account]) {
        stats[company][currency].accountDetails[account] = {
          count: 0,
          amount: 0
        };
      }
      stats[company][currency].accountDetails[account].count += 1;
      stats[company][currency].accountDetails[account].amount += (t.deposit_amount || 0);
    });

    return stats;
  }, [transactions, timeFilter, selectedQuarter, selectedYear]);

  return (
    <div className="p-4 md:p-8 space-y-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              仪表盘
            </h1>
            <p className="text-slate-600 mt-2">实时监控您的加密货币结算业务</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <Button 
              variant="outline" 
              className="bg-white/80 backdrop-blur-sm hover:bg-white"
              onClick={async () => {
                try {
                  const { data } = await base44.functions.invoke('exportTransactionsToCsv');
                  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  a.remove();
                } catch (e) {
                  console.error("Export failed:", e);
                  alert("导出失败，请重试");
                }
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              导出流水
            </Button>
            <Tabs value={timeFilter} onValueChange={setTimeFilter} className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-5 bg-white/80 backdrop-blur-sm border border-slate-200">
                <TabsTrigger value="today" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  今日
                </TabsTrigger>
                <TabsTrigger value="month">本月</TabsTrigger>
                <TabsTrigger value="quarter">季度</TabsTrigger>
                <TabsTrigger value="year">年份</TabsTrigger>
                <TabsTrigger value="all">累计</TabsTrigger>
              </TabsList>
            </Tabs>

            {timeFilter === "quarter" && (
              <div className="flex gap-2">
                <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                  <SelectTrigger className="w-28 bg-white/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">第一季度</SelectItem>
                    <SelectItem value="Q2">第二季度</SelectItem>
                    <SelectItem value="Q3">第三季度</SelectItem>
                    <SelectItem value="Q4">第四季度</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-20 bg-white/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateYearOptions().map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {timeFilter === "year" && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-20 bg-white/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateYearOptions().map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <MaintenanceAlert transactions={getFilteredTransactions()} />

        {(permissions.can_view_profit_data || currentUser?.role === 'admin') && (
          <>
            <ProfitStats 
              profitMetrics={profitMetrics} 
              permissions={permissions} 
              currentUser={currentUser}
              timeFilterLabel={getTimeFilterLabel()}
            />
            <ProfitReportTable transactions={transactions} />
            <ProfitVisual profitMetrics={profitMetrics} />
          </>
        )}

        <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600"/>
              入金统计 ({getTimeFilterLabel()})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="总转账笔数"
                value={metrics.totalTransactions}
                description="所有币种入金交易"
                icon={CreditCard}
                color="blue"
                loading={loading}
              />

              {majorCurrencies.map((currency, index) => {
                const data = metrics.depositsByCurrency[currency] || { amount: 0, count: 0 };
                return (
                  <StatCard
                    key={currency}
                    title={`${currency} 总入金`}
                    value={`${data.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    description={`${data.count} 笔交易`}
                    icon={Coins}
                    color={currencyColors[index % currencyColors.length]}
                    loading={loading}
                  />
                );
              })}

              {otherCurrencies.map(([currency, data], index) => (
                <StatCard
                  key={currency}
                  title={`${currency} 总入金`}
                  value={`${data.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                  description={`${data.count} 笔交易`}
                  icon={Coins}
                  color={currencyColors[(majorCurrencies.length + index) % currencyColors.length]}
                  loading={loading}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-indigo-600"/>
              入款账户统计 - 按公司&币种 ({getTimeFilterLabel()})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-32 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : Object.keys(accountStats).length === 0 ? (
              <div className="text-center py-8 text-slate-500">暂无数据</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(accountStats).map(([company, currencies]) => (
                  <div key={company} className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-5 shadow-md">
                    <div 
                      className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 cursor-pointer hover:bg-slate-100/50 rounded-lg p-2 -mx-2 transition-colors"
                      onClick={() => navigate(`/AccountDetail?company=${encodeURIComponent(company)}`)}
                    >
                      <div className="p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 shadow-md">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-slate-900">{company}</h3>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">点击查看详情</span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {Object.keys(currencies).length} 种币种 · 共 {Object.values(currencies).reduce((sum, cur) => sum + cur.count, 0)} 笔
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(currencies).map(([currency, data]) => (
                        <div 
                          key={currency}
                          className="bg-white border border-indigo-100 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                          onClick={() => navigate(`/AccountDetail?company=${encodeURIComponent(company)}&currency=${encodeURIComponent(currency)}`)}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{currency}</span>
                              </div>
                              <span className="text-sm font-semibold text-slate-700">{currency} 账户</span>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-600">入账笔数</span>
                              <span className="text-base font-bold text-indigo-600">{data.count} 笔</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-600">总金额</span>
                              <span className="text-sm font-bold text-emerald-600">
                                {data.totalAmount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })} {currency}
                              </span>
                            </div>
                            <div className="pt-2 border-t border-slate-100">
                              <span className="text-xs text-slate-500 font-medium">账户明细 ({Object.keys(data.accountDetails).length}个):</span>
                              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {Object.entries(data.accountDetails).map(([account, detail]) => (
                                  <div key={account} className="bg-slate-50 rounded p-2 text-xs">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-mono text-slate-600 font-medium truncate flex-1 mr-2" title={account}>
                                        {account}
                                      </span>
                                      <span className="text-indigo-600 font-bold">{detail.count}笔</span>
                                    </div>
                                    <div className="text-right text-emerald-600">
                                      {detail.amount.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <StatusOverview 
            transactions={getFilteredTransactions()} 
            loading={loading} 
            onStatusClick={handleStatusClick}
          />
          <TransactionChart transactions={getFilteredTransactions()} loading={loading} />
        </div>

        <CustomerStatsChart transactions={getFilteredTransactions()} />

        {showStatusModal && selectedStatus && (
          <StatusDetailModal
            status={selectedStatus.status}
            transactions={selectedStatus.transactions}
            onClose={() => setShowStatusModal(false)}
            onUpdateTransaction={handleUpdateTransaction}
          />
        )}
      </div>
    </div>
  );
}