import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart2 } from "lucide-react";

const STATUS_CONFIG = {
  "等待中":         { color: "#f59e0b", bg: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  "已到账":         { color: "#10b981", bg: "bg-green-100 text-green-800 border-green-200" },
  "承兑中":         { color: "#3b82f6", bg: "bg-blue-100 text-blue-800 border-blue-200" },
  "已完成交易":     { color: "#059669", bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  "风控调解中":     { color: "#f97316", bg: "bg-orange-100 text-orange-800 border-orange-200" },
  "冻结（正在处理）": { color: "#8b5cf6", bg: "bg-purple-100 text-purple-800 border-purple-200" },
  "冻结（不能处理）": { color: "#6b7280", bg: "bg-gray-100 text-gray-800 border-gray-200" },
  "已退回":         { color: "#ef4444", bg: "bg-red-100 text-red-800 border-red-200" },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold text-slate-800">{d.status}</p>
        <p className="text-slate-600">{d.count} 笔</p>
        <p className="text-slate-500">≈ {d.usdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</p>
      </div>
    );
  }
  return null;
};

export default function StatusOverview({ transactions, loading, onStatusClick }) {
  const [view, setView] = useState('chart'); // 'chart' | 'list'

  if (loading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent><div className="space-y-3">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div></CardContent>
      </Card>
    );
  }

  // Build stats per status
  const statusData = ALL_STATUSES.map(status => {
    const txns = transactions.filter(t => t.fund_status === status);
    const usdt = txns.reduce((sum, t) => {
      const dep = parseFloat(t.deposit_amount) || 0;
      const rate = parseFloat(t.exchange_rate) || 0;
      return sum + (rate > 0 ? dep / rate : 0);
    }, 0);
    return { status, count: txns.length, usdt, txns };
  }).filter(d => d.count > 0);

  // Total USDT across all transactions (excluding returned)
  const totalUsdtAll = transactions.reduce((sum, t) => {
    const dep = parseFloat(t.deposit_amount) || 0;
    const rate = parseFloat(t.exchange_rate) || 0;
    return sum + (rate > 0 ? dep / rate : 0);
  }, 0);

  const totalCount = transactions.length;

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-600" />
            资金状态分布
          </CardTitle>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setView('chart')}
              className={`px-3 py-1 rounded-full transition-colors ${view === 'chart' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >图表</button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1 rounded-full transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >列表</button>
          </div>
        </div>
        {/* Total summary */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-indigo-50 rounded-lg p-3">
            <p className="text-xs text-indigo-600 font-medium">总入金笔数</p>
            <p className="text-xl font-bold text-indigo-700">{totalCount} 笔</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3">
            <p className="text-xs text-emerald-600 font-medium">总入金金额 (USDT)</p>
            <p className="text-xl font-bold text-emerald-700">
              {totalUsdtAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {view === 'chart' ? (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={100}
                  paddingAngle={2}
                  onClick={(entry) => onStatusClick(entry.status, entry.txns)}
                  style={{ cursor: 'pointer' }}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_CONFIG[entry.status]?.color || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => <span className="text-xs text-slate-700">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Click list below chart */}
            <div className="mt-3 space-y-2">
              {statusData.map(d => (
                <div
                  key={d.status}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors border border-slate-100"
                  onClick={() => onStatusClick(d.status, d.txns)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_CONFIG[d.status]?.color }} />
                    <Badge className={`${STATUS_CONFIG[d.status]?.bg} border text-xs`}>{d.status}</Badge>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-slate-700 text-sm">{d.count} 笔</span>
                    <span className="text-slate-400 mx-1 text-xs">·</span>
                    <span className="text-emerald-600 text-xs font-mono">
                      {d.usdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {ALL_STATUSES.map(status => {
              const d = statusData.find(x => x.status === status) || { count: 0, usdt: 0, txns: [] };
              return (
                <div
                  key={status}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${d.count > 0 ? 'bg-slate-50 hover:bg-slate-100 cursor-pointer border-slate-100' : 'bg-slate-50/50 border-slate-50 opacity-50'}`}
                  onClick={() => d.count > 0 && onStatusClick(status, d.txns)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_CONFIG[status]?.color }} />
                    <Badge className={`${STATUS_CONFIG[status]?.bg} border text-xs`}>{status}</Badge>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-slate-700 text-sm">{d.count} 笔</span>
                    {d.count > 0 && (
                      <>
                        <span className="text-slate-400 mx-1 text-xs">·</span>
                        <span className="text-emerald-600 text-xs font-mono">
                          {d.usdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-sm font-medium text-slate-600">
              <span>合计</span>
              <span>{totalCount} 笔 · <span className="text-emerald-600">{totalUsdtAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</span></span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}