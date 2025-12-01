import React, { useState, useEffect } from "react";
import { Transaction } from "@/entities/Transaction";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, DollarSign, CreditCard, Calendar, BarChartHorizontal, Coins, Calculator, Target, AlertCircle } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, isValid, isWithinInterval, startOfYear, endOfYear } from "date-fns";

import StatCard from "../components/dashboard/StatCard";
import TransactionChart from "../components/dashboard/TransactionChart";
import StatusOverview from "../components/dashboard/StatusOverview";
import StatusDetailModal from "../components/dashboard/StatusDetailModal";
import MaintenanceAlert from "../components/dashboard/MaintenanceAlert";

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState("month");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [transactionData, userData] = await Promise.all([
          Transaction.list("-created_date"),
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
      const data = await Transaction.list("-created_date");
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
      const currencyCode = t.currency?.replace(/[\u4e00-\u9fa5]/g, '') || 'OTHER';
      if (!acc[currencyCode]) {
        acc[currencyCode] = { amount: 0, count: 0 };
      }
      acc[currencyCode].amount += (t.deposit_amount || 0);
      acc[currencyCode].count += 1;
      return acc;
    }, {});

    const totalTransactions = allFilteredTransactions.length;

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
      if (!t.deposit_amount || !t.exchange_rate || t.exchange_rate === 0) {
        continue;
      }

      const initialUsdt = t.deposit_amount / t.exchange_rate;
      const commission = initialUsdt * ((t.commission_percentage || 0) / 100);
      const transferFee = t.transfer_fee || 0;
      const acceptanceUsdt = t.acceptance_usdt || 0;
      const exchangeRateProfit = initialUsdt - acceptanceUsdt;
      const violationPenalty = t.violation_penalty || 0;

      totalCommission += commission;
      totalTransferFee += transferFee;
      totalExchangeRateProfit += exchangeRateProfit;
      totalViolationPenalty += violationPenalty;
      completedCount++;
    }

    const totalProfit = totalCommission + totalTransferFee + totalExchangeRateProfit - totalViolationPenalty;

    let estimatedCommission = 0;
    let estimatedTransferFee = 0;
    let estimatedExchangeRateProfit = 0;
    let estimatedViolationPenalty = 0;
    let estimatedCount = 0;

    for (const t of filteredTransactions) {
      if (!t.deposit_amount || !t.exchange_rate || t.exchange_rate === 0) {
        continue;
      }

      const initialUsdt = t.deposit_amount / t.exchange_rate;
      const commission = initialUsdt * ((t.commission_percentage || 0) / 100);
      const transferFee = t.transfer_fee || 0;
      const acceptanceUsdt = t.acceptance_usdt || initialUsdt;
      const exchangeRateProfit = initialUsdt - acceptanceUsdt;
      const violationPenalty = t.violation_penalty || 0;

      estimatedCommission += commission;
      estimatedTransferFee += transferFee;
      estimatedExchangeRateProfit += exchangeRateProfit;
      estimatedViolationPenalty += violationPenalty;
      estimatedCount++;
    }

    const estimatedProfit = estimatedCommission + estimatedTransferFee + estimatedExchangeRateProfit - estimatedViolationPenalty;

    return {
      commission: totalCommission,
      transferFee: totalTransferFee,
      exchangeRateProfit: totalExchangeRateProfit,
      violationPenalty: totalViolationPenalty,
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
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BarChartHorizontal className="w-6 h-6 text-green-600"/>
                  盈利统计 ({getTimeFilterLabel()})
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-600"></div>
                    <span className="text-slate-700 font-medium">实际盈利 - 已完成 {profitMetrics.completedCount} 笔</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                    <span className="text-slate-500 italic">预计盈利 - 含未完成 {profitMetrics.estimatedCount - profitMetrics.completedCount} 笔</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {(permissions.can_view_commission_stats || currentUser?.role === 'admin') && (
                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-6 shadow-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <p className="text-sm font-medium text-slate-600">佣金收入</p>
                          <p className="text-2xl font-bold text-yellow-600">
                            {profitMetrics.commission.toLocaleString(undefined, { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })} USDT
                          </p>
                          <p className="text-xs text-slate-500">初始USDT × 佣金%</p>
                          <p className="text-sm text-slate-400 italic mt-2">
                            预计: {profitMetrics.estimatedCommission.toLocaleString(undefined, { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })} USDT
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 shadow-lg">
                          <Coins className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-lg">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <p className="text-sm font-medium text-slate-600">手续费收入</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {profitMetrics.transferFee.toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })} USDT
                        </p>
                        <p className="text-xs text-slate-500">转账手续费总计</p>
                        <p className="text-sm text-slate-400 italic mt-2">
                          预计: {profitMetrics.estimatedTransferFee.toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })} USDT
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg">
                        <Calculator className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-6 shadow-lg">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <p className="text-sm font-medium text-slate-600">汇率差盈利</p>
                        <p className="text-2xl font-bold text-emerald-600">
                          {profitMetrics.exchangeRateProfit.toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })} USDT
                        </p>
                        <p className="text-xs text-slate-500">初始USDT - 承兑回USDT</p>
                        <p className="text-sm text-slate-400 italic mt-2">
                          预计: {profitMetrics.estimatedExchangeRateProfit.toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })} USDT
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 shadow-lg">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-6 shadow-lg">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <p className="text-sm font-medium text-slate-600">总盈利</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {profitMetrics.profit.toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })} USDT
                        </p>
                        <p className="text-xs text-slate-500">佣金+手续费+汇率差-罚金</p>
                        <p className="text-sm text-slate-400 italic mt-2">
                          预计: {profitMetrics.estimatedProfit.toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })} USDT
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 shadow-lg">
                        <Target className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                {profitMetrics.completedCount === 0 && (
                  <Alert className="mt-4 bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 text-sm">
                      💡 提示：当前时间范围内没有"已完成交易"状态的记录。显示的是预计盈利数据。
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
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
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                      <div className="p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 shadow-md">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{company}</h3>
                        <p className="text-xs text-slate-600">
                          {Object.keys(currencies).length} 种币种 · 共 {Object.values(currencies).reduce((sum, cur) => sum + cur.count, 0)} 笔
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(currencies).map(([currency, data]) => (
                        <div 
                          key={currency}
                          className="bg-white border border-indigo-100 rounded-lg p-4 hover:shadow-md transition-shadow"
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