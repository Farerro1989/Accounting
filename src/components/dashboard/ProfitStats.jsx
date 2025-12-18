import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Calculator, TrendingUp, Target, AlertCircle, Info, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ProfitStats({ profitMetrics, permissions, currentUser, timeFilterLabel, filterParams }) {
  const navigate = useNavigate();
  const canViewCommission = permissions.can_view_commission_stats || currentUser?.role === 'admin';

  const formatCurrency = (val) => {
    return val.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const navigateToDetails = (type) => {
    const params = new URLSearchParams({
      type,
      timeFilter: filterParams?.timeFilter || 'all',
      year: filterParams?.year || '',
      quarter: filterParams?.quarter || ''
    });
    navigate(`/ProfitDetails?${params.toString()}`);
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-600"/>
          盈利统计 ({timeFilterLabel})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Main Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Actual Profit */}
          <div 
            className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-6 shadow-lg relative overflow-hidden group hover:shadow-xl transition-all cursor-pointer"
            onClick={() => navigateToDetails('profit')}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-purple-900">实际盈利 (已完成)</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-purple-700/70 hover:text-purple-900 transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-white/95 backdrop-blur border-purple-200 text-slate-800 p-4 shadow-xl max-w-xs">
                      <div className="space-y-2">
                        <p className="font-bold border-b border-purple-100 pb-2 mb-2">计算公式明细 (点击查看详情)</p>
                        <div 
                          className="flex justify-between text-xs cursor-pointer hover:bg-purple-50 p-1 rounded transition-colors"
                          onClick={() => navigateToDetails('commission')}
                        >
                          <span className="flex items-center gap-1">佣金 (已完成) <ChevronRight className="w-3 h-3"/></span>
                          <span className="font-mono text-green-600">+{formatCurrency(profitMetrics.commission)}</span>
                        </div>
                        <div 
                          className="flex justify-between text-xs cursor-pointer hover:bg-purple-50 p-1 rounded transition-colors"
                          onClick={() => navigateToDetails('fee')}
                        >
                          <span className="flex items-center gap-1">手续费 (已完成) <ChevronRight className="w-3 h-3"/></span>
                          <span className="font-mono text-blue-600">+{formatCurrency(profitMetrics.transferFee)}</span>
                        </div>
                        <div 
                          className="flex justify-between text-xs cursor-pointer hover:bg-purple-50 p-1 rounded transition-colors"
                          onClick={() => navigateToDetails('exchange')}
                        >
                          <span className="flex items-center gap-1">汇率盈亏 (已完成) <ChevronRight className="w-3 h-3"/></span>
                          <span className={`font-mono ${profitMetrics.exchangeRateProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {profitMetrics.exchangeRateProfit >= 0 ? '+' : ''}{formatCurrency(profitMetrics.exchangeRateProfit)}
                          </span>
                        </div>
                        <div 
                          className="flex justify-between text-xs cursor-pointer hover:bg-purple-50 p-1 rounded transition-colors"
                          onClick={() => navigateToDetails('penalty')}
                        >
                          <span className="flex items-center gap-1">违规罚金 (全部) <ChevronRight className="w-3 h-3"/></span>
                          <span className="font-mono text-red-600">+{formatCurrency(profitMetrics.violationPenalty)}</span>
                        </div>
                        <div 
                          className="border-t border-purple-100 pt-2 mt-2 flex justify-between font-bold text-sm cursor-pointer hover:bg-purple-50 p-1 rounded transition-colors"
                          onClick={() => navigateToDetails('profit')}
                        >
                          <span className="flex items-center gap-1">总计 <ChevronRight className="w-3 h-3"/></span>
                          <span className="text-purple-700">{formatCurrency(profitMetrics.profit)}</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-3xl font-bold text-purple-700">
                {formatCurrency(profitMetrics.profit)} USDT
              </p>
              <p className="text-xs text-purple-600/70 mt-2">
                基于 {profitMetrics.completedCount} 笔已完成交易 + 所有罚金
              </p>
            </div>
            <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Target className="w-24 h-24 text-purple-600" />
            </div>
          </div>

          {/* Estimated Profit */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-6 shadow-lg relative overflow-hidden group hover:shadow-xl transition-all">
            <div className="relative z-10">
              <p className="text-sm font-medium text-indigo-900 mb-1">总预估盈利 (所有交易)</p>
              <p className="text-3xl font-bold text-indigo-700">
                {formatCurrency(profitMetrics.estimatedProfit)} USDT
              </p>
              <p className="text-xs text-indigo-600/70 mt-2">
                包含进行中及已完成的所有交易 (共 {profitMetrics.estimatedCount} 笔)
              </p>
            </div>
            <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Calculator className="w-24 h-24 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {canViewCommission && (
            <div 
              className="bg-yellow-50/50 border border-yellow-100 rounded-lg p-4 cursor-pointer hover:bg-yellow-50 transition-colors"
              onClick={() => navigateToDetails('commission')}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Coins className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-yellow-900">佣金收入</span>
                  <ChevronRight className="w-3 h-3 text-yellow-600/50" />
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold text-yellow-700">{formatCurrency(profitMetrics.commission)}</p>
                  <p className="text-xs text-yellow-600/70">实际入账</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-yellow-600/80">{formatCurrency(profitMetrics.estimatedCommission)}</p>
                  <p className="text-[10px] text-yellow-600/60">预计总额</p>
                </div>
              </div>
            </div>
          )}

          <div 
            className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 cursor-pointer hover:bg-blue-50 transition-colors"
            onClick={() => navigateToDetails('fee')}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calculator className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-blue-900">手续费收入</span>
                <ChevronRight className="w-3 h-3 text-blue-600/50" />
              </div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(profitMetrics.transferFee)}</p>
                <p className="text-xs text-blue-600/70">实际入账</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-blue-600/80">{formatCurrency(profitMetrics.estimatedTransferFee)}</p>
                <p className="text-[10px] text-blue-600/60">预计总额</p>
              </div>
            </div>
          </div>

          <div 
            className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4 cursor-pointer hover:bg-emerald-50 transition-colors"
            onClick={() => navigateToDetails('exchange')}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-emerald-900">汇率差盈亏</span>
                <ChevronRight className="w-3 h-3 text-emerald-600/50" />
              </div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className={`text-2xl font-bold ${profitMetrics.exchangeRateProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatCurrency(profitMetrics.exchangeRateProfit)}
                </p>
                <p className="text-xs text-emerald-600/70">实际盈亏</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${profitMetrics.estimatedExchangeRateProfit >= 0 ? 'text-emerald-600/80' : 'text-red-500/80'}`}>
                  {formatCurrency(profitMetrics.estimatedExchangeRateProfit)}
                </p>
                <p className="text-[10px] text-emerald-600/60">预计盈亏</p>
              </div>
            </div>
          </div>
        </div>

        {/* Violation Penalty & Frozen Funds Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-red-50/50 border border-red-100 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <span className="font-medium text-red-900">违规赔偿总额</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(profitMetrics.violationPenalty)}</p>
                <p className="text-xs text-red-600/70">实际赔偿 (已完成)</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-red-600/80">{formatCurrency(profitMetrics.estimatedViolationPenalty)}</p>
                <p className="text-[10px] text-red-600/60">预计总额 (所有交易)</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-slate-600" />
              </div>
              <span className="font-medium text-slate-900">冻结资金 (不能处理)</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-700">{formatCurrency(profitMetrics.frozenFunds || 0)}</p>
              <p className="text-xs text-slate-600/70">总冻结金额 (USDT估值)</p>
            </div>
          </div>
        </div>

        {profitMetrics.completedCount === 0 && (
          <Alert className="mt-4 bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              💡 提示：当前范围内暂无"已完成交易"，实际盈利为0。请关注预计盈利数据。
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}