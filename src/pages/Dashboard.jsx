import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, DollarSign, CreditCard, Coins, AlertCircle, Download } from "lucide-react";
import { isValid } from "date-fns";
import DateRangeFilter from "../components/dashboard/DateRangeFilter";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PullToRefresh from "../components/mobile/PullToRefresh";

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
  const now = new Date();
  const [dateFilter, setDateFilter] = useState({
    filterMode: "month",
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    day: String(now.getDate()),
  });
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
        const navigate = useNavigate();

        useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [transactionData, userData] = await Promise.all([
          base44.entities.Transaction.list("-created_date", 1000),
          base44.auth.me()
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

  const permissions = useMemo(() => {
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

  const getFilteredTransactions = () => {
    const { filterMode, year, month, day } = dateFilter;
    if (filterMode === "all") return transactions;

    return transactions.filter(t => {
      const d = new Date(t.deposit_date || t.created_date);
      if (!isValid(d)) return false;
      const tYear = d.getFullYear();
      const tMonth = d.getMonth() + 1;
      const tDay = d.getDate();
      if (filterMode === "year") return tYear === parseInt(year);
      if (filterMode === "month") return tYear === parseInt(year) && tMonth === parseInt(month);
      if (filterMode === "day") return tYear === parseInt(year) && tMonth === parseInt(month) && tDay === parseInt(day);
      return true;
    });
  };

  const calculateMetrics = () => {
    const allFilteredTransactions = getFilteredTransactions();
    
    const depositsByCurrency = allFilteredTransactions.reduce((acc, t) => {
      // 已退回、冻结（不能处理）、冻结（正在处理）不计入总账目
      if (t.fund_status === '已退回' || t.fund_status === '冻结（不能处理）' || t.fund_status === '冻结（正在处理）') return acc;

      const currencyCode = t.currency?.replace(/[\u4e00-\u9fa5]/g, '') || 'OTHER';
      if (!acc[currencyCode]) {
        acc[currencyCode] = { amount: 0, count: 0 };
      }
      acc[currencyCode].amount += (t.deposit_amount || 0);
      acc[currencyCode].count += 1;
      return acc;
    }, {});

    // 总笔数排除已退回、冻结（不能处理）、冻结（正在处理）的交易
    const effectiveTransactions = allFilteredTransactions.filter(t => 
      t.fund_status !== '已退回' && t.fund_status !== '冻结（不能处理）' && t.fund_status !== '冻结（正在处理）'
    );
    const totalTransactions = effectiveTransactions.length;

    // 总入金 USDT（所有有效交易按汇率换算）
    const totalDepositUsdt = effectiveTransactions.reduce((sum, t) => {
      const dep = parseFloat(t.deposit_amount) || 0;
      const rate = parseFloat(t.exchange_rate) || 0;
      return sum + (rate > 0 ? dep / rate : 0);
    }, 0);

    return {
      depositsByCurrency,
      totalTransactions,
      totalDepositUsdt,
    };
  };

  const calculateProfitMetrics = () => {
    const filteredTransactions = getFilteredTransactions();

    // Actual (completed only)
    let totalCommission = 0;
    let totalTransferFee = 0;
    let totalExchangeRateProfit = 0;
    let totalViolationPenalty = 0;
    let completedCount = 0;

    // Estimated (all valid, excluding returned/frozen-cannot)
    let estimatedCommission = 0;
    let estimatedTransferFee = 0;
    let estimatedExchangeRateProfit = 0;
    let estimatedViolationPenalty = 0;
    let estimatedCount = 0;
    let totalFrozenFunds = 0;

    for (const t of filteredTransactions) {
      const depositAmount = parseFloat(t.deposit_amount) || 0;
      const exchangeRate = parseFloat(t.exchange_rate) || 0;
      // transfer_fee is already in USDT (fixed fee, not in native currency)
      const feeUsdt = parseFloat(t.transfer_fee) || 0;
      const violationPenalty = parseFloat(t.violation_penalty) || 0;

      // Returned: only count violation penalty
      if (t.fund_status === '已退回') {
        totalViolationPenalty += violationPenalty;
        estimatedViolationPenalty += violationPenalty;
        continue;
      }

      // Frozen (Cannot Process): track frozen funds + penalty, skip profit
      if (t.fund_status === '冻结（不能处理）') {
        if (depositAmount > 0 && exchangeRate > 0) {
          totalFrozenFunds += depositAmount / exchangeRate;
        }
        totalViolationPenalty += violationPenalty;
        estimatedViolationPenalty += violationPenalty;
        continue;
      }

      // Frozen (Processing): track frozen funds + penalty, skip profit
      if (t.fund_status === '冻结（正在处理）') {
        if (depositAmount > 0 && exchangeRate > 0) {
          totalFrozenFunds += depositAmount / exchangeRate;
        }
        totalViolationPenalty += violationPenalty;
        estimatedViolationPenalty += violationPenalty;
        continue;
      }

      // Skip invalid data
      if (depositAmount <= 0 || exchangeRate <= 0) continue;

      // Commission is calculated on native amount, then converted to USDT
      const commissionPct = parseFloat(t.commission_percentage) || 0;
      const commNative = depositAmount * (commissionPct / 100);
      const commissionUsdt = commNative / exchangeRate;

      const initialUsdt = depositAmount / exchangeRate; // gross USDT before any deductions

      // Penalty always counted
      totalViolationPenalty += violationPenalty;
      estimatedViolationPenalty += violationPenalty;

      // ACTUAL profit: only completed transactions
      if (t.fund_status === '已完成交易') {
        const acceptanceUsdt = parseFloat(t.acceptance_usdt) || 0;
        // Exchange profit = what we actually received back minus what we sent
        // If acceptance_usdt is recorded, use it; otherwise assume no exchange gain/loss
        const actualAcceptance = acceptanceUsdt > 0 ? acceptanceUsdt : initialUsdt;
        const exchangeProfit = actualAcceptance - initialUsdt;

        totalCommission += commissionUsdt;
        totalTransferFee += feeUsdt;
        totalExchangeRateProfit += exchangeProfit;
        completedCount++;
      }

      // ESTIMATED profit: all valid transactions (waiting, processing, completed)
      const acceptanceUsdt = parseFloat(t.acceptance_usdt) || 0;
      // For estimated: if acceptance recorded use it, else assume no exchange gain (0)
      const estimatedAcceptance = acceptanceUsdt > 0 ? acceptanceUsdt : initialUsdt;
      const estimatedExchangeProfit = estimatedAcceptance - initialUsdt;

      estimatedCommission += commissionUsdt;
      estimatedTransferFee += feeUsdt;
      estimatedExchangeRateProfit += estimatedExchangeProfit;
      estimatedCount++;
    }

    const totalProfit = totalCommission + totalTransferFee + totalExchangeRateProfit + totalViolationPenalty;
    const estimatedProfit = estimatedCommission + estimatedTransferFee + estimatedExchangeRateProfit + estimatedViolationPenalty;

    return {
      commission: totalCommission,
      transferFee: totalTransferFee,
      exchangeRateProfit: totalExchangeRateProfit,
      violationPenalty: totalViolationPenalty,
      frozenFunds: totalFrozenFunds,
      profit: totalProfit,
      completedCount,

      estimatedCommission,
      estimatedTransferFee,
      estimatedExchangeRateProfit,
      estimatedViolationPenalty,
      estimatedProfit,
      estimatedCount
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
    const { filterMode, year, month, day } = dateFilter;
    if (filterMode === "all") return "全部累计";
    if (filterMode === "year") return `${year}年`;
    if (filterMode === "month") return `${year}年${month}月`;
    if (filterMode === "day") return `${year}年${month}月${day}日`;
    return "全部";
  };

  const currencyColors = ["green", "blue", "yellow", "purple", "red", "orange", "indigo"];
  const majorCurrencies = ['USD', 'EUR', 'GBP'];
  const otherCurrencies = Object.entries(metrics.depositsByCurrency).filter(
    ([currency]) => !majorCurrencies.includes(currency)
  );

  // 统计各个入款账户（按公司+币种分类）
  const accountStats = useMemo(() => {
  const filteredTxns = getFilteredTransactions();
  const stats = {};

  filteredTxns.forEach(t => {
    // 已退回、冻结（不能处理）、冻结（正在处理）不计入账户统计
    if (t.fund_status === '已退回' || t.fund_status === '冻结（不能处理）' || t.fund_status === '冻结（正在处理）') return;

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
  }, [transactions, dateFilter]);

  return (
    <PullToRefresh onRefresh={loadTransactions}>
    <div className="p-4 md:p-8 space-y-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              仪表盘
            </h1>
            <p className="text-slate-600 mt-2">实时监控您的加密货币结算业务</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 items-end flex-wrap">
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
            <DateRangeFilter
              {...dateFilter}
              onChange={setDateFilter}
            />
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
              filterParams={dateFilter}
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
              <StatCard
                title="总入金金额 (USDT)"
                value={metrics.totalDepositUsdt?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                description="按各币种汇率换算"
                icon={Coins}
                color="indigo"
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
    </PullToRefresh>
  );
}