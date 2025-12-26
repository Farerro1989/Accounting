import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, getQuarter } from "date-fns";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfitReportTable({ transactions }) {
  const [reportType, setReportType] = useState("month"); // month, quarter, year

  const reportData = useMemo(() => {
    // Process ALL transactions to capture penalties from non-completed ones
    const groupedData = {};

    transactions.forEach(t => {
      if (!t.created_date) return;
      const date = new Date(t.created_date);
      let key;
      let label;
      let sortKey;

      if (reportType === "month") {
        key = format(date, "yyyy-MM");
        label = format(date, "yyyy年MM月");
        sortKey = key;
      } else if (reportType === "quarter") {
        const q = getQuarter(date);
        const y = format(date, "yyyy");
        key = `${y}-Q${q}`;
        label = `${y}年第${q}季度`;
        sortKey = key;
      } else {
        key = format(date, "yyyy");
        label = `${key}年`;
        sortKey = key;
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          key,
          label,
          sortKey,
          count: 0,
          commission: 0,
          fees: 0,
          exchangeProfit: 0,
          totalProfit: 0,
          penalty: 0
        };
      }

      // --- LOGIC MUST MATCH Dashboard.js calculateProfitMetrics ---

      // 1. Violation Penalty (All transactions)
      const violationPenalty = parseFloat(t.violation_penalty) || 0;
      groupedData[key].penalty += violationPenalty;
      groupedData[key].totalProfit += violationPenalty;

      // 2. Exclude special statuses from profit calculations
      const depositAmount = parseFloat(t.deposit_amount) || 0;
      const exchangeRate = parseFloat(t.exchange_rate) || 0;

      // Returned: Skip completely
      if (t.fund_status === '已退回') return;

      // Frozen (Cannot Process): Skip profit calculations (penalty already added)
      if (t.fund_status === '冻结（不能处理）') return;

      // Frozen (Processing): Skip profit calculations (penalty already added)
      if (t.fund_status === '冻结（正在处理）') return;

      if (exchangeRate <= 0) return;

      // 4. Calculate Profit Components ONLY for Completed Transactions
      if (t.fund_status === '已完成交易') {
        const feeNative = parseFloat(t.transfer_fee) || 0;
        const commNative = depositAmount * ((parseFloat(t.commission_percentage) || 0) / 100);
        
        // USDT conversions
        const commissionUsdt = commNative / exchangeRate;
        const feeUsdt = feeNative / exchangeRate;
        const initialUsdt = depositAmount / exchangeRate;

        // Exchange Profit Logic: Actual Acceptance - Initial
        const acceptanceUsdt = parseFloat(t.acceptance_usdt) || 0;
        // If acceptance_usdt is 0, assume it equals initialUsdt (no exchange gain/loss)
        const actualAcceptance = acceptanceUsdt > 0 ? acceptanceUsdt : initialUsdt;
        const exchangeProfit = actualAcceptance - initialUsdt;

        // Aggregate
        groupedData[key].count += 1;
        groupedData[key].commission += commissionUsdt;
        groupedData[key].fees += feeUsdt;
        groupedData[key].exchangeProfit += exchangeProfit;
        
        // Total Profit = Comm + Fee + ExchProfit + Penalty
        groupedData[key].totalProfit += (commissionUsdt + feeUsdt + exchangeProfit);
      }
    });

    return Object.values(groupedData).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [transactions, reportType]);

  const formatCurrency = (val) => {
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold text-slate-900">盈利报表</CardTitle>
        <Tabs value={reportType} onValueChange={setReportType}>
          <TabsList>
            <TabsTrigger value="month">月度</TabsTrigger>
            <TabsTrigger value="quarter">季度</TabsTrigger>
            <TabsTrigger value="year">年度</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间段</TableHead>
                <TableHead className="text-right">交易笔数</TableHead>
                <TableHead className="text-right">佣金 (USDT)</TableHead>
                <TableHead className="text-right">手续费 (USDT)</TableHead>
                <TableHead className="text-right">汇率差盈亏 (USDT)</TableHead>
                <TableHead className="text-right font-bold">总盈利 (USDT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    暂无已完成的交易数据
                  </TableCell>
                </TableRow>
              ) : (
                reportData.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right text-slate-600">{formatCurrency(row.commission)}</TableCell>
                    <TableCell className="text-right text-slate-600">{formatCurrency(row.fees)}</TableCell>
                    <TableCell className={`text-right ${row.exchangeProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(row.exchangeProfit)}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${row.totalProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                      {formatCurrency(row.totalProfit)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}