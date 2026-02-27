import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, TrendingUp, PieChart as PieIcon } from "lucide-react";

const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

const currencyBase = {
  "USD美元": 1, "EUR欧元": 1.08, "SGD新元": 0.74, "MYR马币": 0.21,
  "AUD澳币": 0.64, "CHF瑞郎": 1.12, "THB泰铢": 0.028, "VND越南盾": 0.000039,
  "GBP英镑": 1.27, "CAD加元": 0.73, "HKD港币": 0.128, "KRW韩币": 0.00072,
  "CNY人民币": 0.138, "JPY日元": 0.0066, "AED迪拉姆": 0.272,
  "PHP菲律宾比索": 0.0174, "IDR印尼盾": 0.000062
};

function toUSD(amount, currency) {
  const rate = currencyBase[currency] || 1;
  return amount * rate;
}

const CustomTooltip = ({ active, payload, label, prefix = "", suffix = "" }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="text-xs">
            {p.name}: {prefix}{Number(p.value).toLocaleString()}{suffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TransactionCharts({ transactions }) {
  const [timeRange, setTimeRange] = useState("all");

  const filtered = useMemo(() => {
    if (timeRange === "all") return transactions;
    const now = new Date();
    const cutoff = new Date();
    if (timeRange === "7d") cutoff.setDate(now.getDate() - 7);
    else if (timeRange === "30d") cutoff.setDate(now.getDate() - 30);
    else if (timeRange === "90d") cutoff.setDate(now.getDate() - 90);
    return transactions.filter(t => new Date(t.deposit_date || t.created_date) >= cutoff);
  }, [transactions, timeRange]);

  // 按币种聚合
  const byCurrency = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      const cur = t.currency?.split(/[A-Z]{3}/)[0] ? t.currency : (t.currency || "未知");
      // 提取3字母代码显示
      const code = t.currency?.match(/^[A-Z]{3}/)?.[0] || t.currency || "未知";
      if (!map[code]) map[code] = { currency: code, count: 0, totalUSD: 0 };
      map[code].count += 1;
      map[code].totalUSD += toUSD(t.deposit_amount || 0, t.currency || "");
    });
    return Object.values(map).sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 10);
  }, [filtered]);

  // 按客户聚合（Top 10）
  const byCustomer = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      const name = t.customer_name || "未知";
      if (!map[name]) map[name] = { name, count: 0, totalUSD: 0 };
      map[name].count += 1;
      map[name].totalUSD += toUSD(t.deposit_amount || 0, t.currency || "");
    });
    return Object.values(map).sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 10);
  }, [filtered]);

  // 按时间（月）聚合
  const byMonth = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      const date = new Date(t.deposit_date || t.created_date);
      if (isNaN(date)) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { month: key, count: 0, totalUSD: 0 };
      map[key].count += 1;
      map[key].totalUSD += toUSD(t.deposit_amount || 0, t.currency || "");
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [filtered]);

  // 资金状态饼图
  const byStatus = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      const s = t.fund_status || "未知";
      if (!map[s]) map[s] = { name: s, value: 0 };
      map[s].value += 1;
    });
    return Object.values(map);
  }, [filtered]);

  if (!transactions.length) return null;

  return (
    <div className="space-y-4">
      {/* 时间范围筛选 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-500" />
          数据图表
        </h2>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 text-xs">
          {[["all","全部"],["7d","近7天"],["30d","近30天"],["90d","近90天"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTimeRange(v)}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                timeRange === v ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="time">
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="time" className="gap-1 text-xs">
            <TrendingUp className="w-3.5 h-3.5" />按月趋势
          </TabsTrigger>
          <TabsTrigger value="currency" className="gap-1 text-xs">
            <BarChart2 className="w-3.5 h-3.5" />按币种
          </TabsTrigger>
          <TabsTrigger value="customer" className="gap-1 text-xs">
            <BarChart2 className="w-3.5 h-3.5" />按客户
          </TabsTrigger>
          <TabsTrigger value="status" className="gap-1 text-xs">
            <PieIcon className="w-3.5 h-3.5" />资金状态
          </TabsTrigger>
        </TabsList>

        {/* 按月趋势 */}
        <TabsContent value="time">
          <Card className="bg-white/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">每月交易金额趋势 (折算USD)</CardTitle>
            </CardHeader>
            <CardContent>
              {byMonth.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">暂无数据</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={byMonth} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip prefix="$" />} />
                    <Legend />
                    <Line type="monotone" dataKey="totalUSD" name="交易额(USD)" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="count" name="笔数" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} yAxisId={0} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 按币种 */}
        <TabsContent value="currency">
          <Card className="bg-white/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">各币种交易金额 (折算USD)</CardTitle>
            </CardHeader>
            <CardContent>
              {byCurrency.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">暂无数据</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byCurrency} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="currency" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip prefix="$" />} />
                    <Legend />
                    <Bar dataKey="totalUSD" name="交易额(USD)" radius={[4, 4, 0, 0]}>
                      {byCurrency.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                    <Bar dataKey="count" name="笔数" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 按客户 */}
        <TabsContent value="customer">
          <Card className="bg-white/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Top 10 客户交易额 (折算USD)</CardTitle>
            </CardHeader>
            <CardContent>
              {byCustomer.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">暂无数据</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byCustomer} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={75} />
                    <Tooltip content={<CustomTooltip prefix="$" />} />
                    <Bar dataKey="totalUSD" name="交易额(USD)" radius={[0, 4, 4, 0]}>
                      {byCustomer.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 资金状态 */}
        <TabsContent value="status">
          <Card className="bg-white/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">资金状态分布</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-center gap-4">
              {byStatus.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm w-full">暂无数据</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={true}>
                        {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {byStatus.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-600">{item.name}</span>
                        <span className="ml-auto font-semibold text-slate-800">{item.value}笔</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}