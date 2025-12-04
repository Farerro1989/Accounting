import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function ProfitVisual({ profitMetrics }) {
  const data = [
    {
      name: '佣金',
      '实际': parseFloat(profitMetrics.commission.toFixed(2)),
      '预计': parseFloat(profitMetrics.estimatedCommission.toFixed(2)),
    },
    {
      name: '手续费',
      '实际': parseFloat(profitMetrics.transferFee.toFixed(2)),
      '预计': parseFloat(profitMetrics.estimatedTransferFee.toFixed(2)),
    },
    {
      name: '汇率差',
      '实际': parseFloat(profitMetrics.exchangeRateProfit.toFixed(2)),
      '预计': parseFloat(profitMetrics.estimatedExchangeRateProfit.toFixed(2)),
    },
    {
      name: '总盈利',
      '实际': parseFloat(profitMetrics.profit.toFixed(2)),
      '预计': parseFloat(profitMetrics.estimatedProfit.toFixed(2)),
    }
  ];

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <BarChart3 className="w-5 h-5 text-purple-600" />
          盈利可视化对比
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
              <Legend />
              <Bar dataKey="实际" fill="#7c3aed" radius={[4, 4, 0, 0]} name="实际盈利 (已完成)" />
              <Bar dataKey="预计" fill="#94a3b8" radius={[4, 4, 0, 0]} name="预计盈利 (全部)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}