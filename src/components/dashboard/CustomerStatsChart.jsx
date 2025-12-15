import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { Users, Coins } from "lucide-react";

export default function CustomerStatsChart({ transactions }) {
  const stats = useMemo(() => {
    const customerData = {};
    const currencyData = {};

    transactions.forEach(t => {
      // Exclude Returned and Frozen funds from stats
      if (t.fund_status === '已退回' || t.fund_status === '冻结（不能处理）') return;

      // Customer stats (Top customers by USDT volume)
      const depositAmount = parseFloat(t.deposit_amount) || 0;
      const exchangeRate = parseFloat(t.exchange_rate) || 1; // Avoid division by zero
      const usdtValue = exchangeRate > 0 ? depositAmount / exchangeRate : 0;
      
      const customerName = t.customer_name || "未知客户";
      if (!customerData[customerName]) {
        customerData[customerName] = { name: customerName, value: 0, count: 0 };
      }
      customerData[customerName].value += usdtValue;
      customerData[customerName].count += 1;

      // Currency stats
      const currency = t.currency ? t.currency.substring(0, 3) : "OTH";
      if (!currencyData[currency]) {
        currencyData[currency] = { name: currency, value: 0, count: 0 };
      }
      currencyData[currency].value += usdtValue;
      currencyData[currency].count += 1;
    });

    // Sort and take top 10
    const topCustomers = Object.values(customerData)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
      
    const topCurrencies = Object.values(currencyData)
      .sort((a, b) => b.value - a.value);

    return { topCustomers, topCurrencies };
  }, [transactions]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658', '#8dd1e1'];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600"/>
            客户入金排行 (Top 10 USDT估值)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={stats.topCustomers}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={80} 
                  tick={{fontSize: 12}}
                  tickFormatter={(value) => value.length > 8 ? value.substring(0, 8) + '...' : value}
                />
                <Tooltip 
                  formatter={(value) => [`${value.toLocaleString(undefined, {maximumFractionDigits: 0})} USDT`, '入金总额']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {stats.topCustomers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-600"/>
            币种分布 (USDT估值占比)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.topCurrencies}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.topCurrencies.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`${value.toLocaleString(undefined, {maximumFractionDigits: 0})} USDT`, '总额']}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}