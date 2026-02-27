import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, Lock, Calendar, DollarSign, User, Building2, AlertTriangle, CheckCircle, Clock, RefreshCw } from "lucide-react";

const STATUS_CONFIG = {
  "等待中": { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  "已退回": { color: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle },
  "已到账": { color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle },
  "承兑中": { color: "bg-purple-100 text-purple-800 border-purple-200", icon: RefreshCw },
  "已完成交易": { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  "风控调解中": { color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
  "冻结（正在处理）": { color: "bg-slate-100 text-slate-700 border-slate-200", icon: Lock },
  "冻结（不能处理）": { color: "bg-red-100 text-red-700 border-red-200", icon: Lock },
};

function validateToken(token) {
  if (!token) return false;
  try {
    const decoded = JSON.parse(atob(token.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.expiresAt && Date.now() < decoded.expiresAt;
  } catch {
    return false;
  }
}

export default function ReadOnlyView() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (validateToken(token)) {
      setAuthorized(true);
      loadTransactions();
    } else {
      setLoading(false);
    }
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const data = await base44.functions.invoke('getPublicTransactions', { token });
      setTransactions(data.data?.transactions || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const filtered = transactions.filter(t => {
    const matchSearch = !searchTerm ||
      t.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transaction_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.receiving_account_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "all" || t.fund_status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!authorized && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center shadow-2xl border-0">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">链接已失效</h2>
            <p className="text-slate-500 text-sm">此查账链接已过期或无效，请联系管理员重新生成。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg">账目查看</h1>
              <p className="text-xs text-slate-500">只读模式 · 优汇结算系统</p>
            </div>
          </div>
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 border gap-1">
            <Eye className="w-3 h-3" />
            只读
          </Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Summary Stats */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "总笔数", value: transactions.length, icon: DollarSign, color: "blue" },
              { label: "等待中", value: transactions.filter(t => t.fund_status === "等待中").length, icon: Clock, color: "yellow" },
              { label: "已完成", value: transactions.filter(t => t.fund_status === "已完成交易").length, icon: CheckCircle, color: "green" },
              { label: "冻结", value: transactions.filter(t => t.fund_status?.includes("冻结")).length, icon: Lock, color: "red" },
            ].map((s, i) => (
              <Card key={i} className="bg-white/80 border border-slate-200">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${s.color}-100`}>
                    <s.icon className={`w-4 h-4 text-${s.color}-600`} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className="text-xl font-bold text-slate-900">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="搜索客户名、编号、账户名..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/80"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48 bg-white/80">
              <SelectValue placeholder="资金状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.keys(STATUS_CONFIG).map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Transactions */}
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-white/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-white/80">
            <CardContent className="py-16 text-center text-slate-400">暂无符合条件的交易记录</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => {
              const statusConf = STATUS_CONFIG[t.fund_status] || { color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock };
              const StatusIcon = statusConf.icon;
              return (
                <Card key={t.id} className="bg-white/90 border border-slate-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 truncate">{t.customer_name}</span>
                            {t.customer_age >= 70 && (
                              <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">
                                ⚠️ 高龄
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono">{t.transaction_number}</span>
                            <span>·</span>
                            <Calendar className="w-3 h-3" />
                            <span>{t.deposit_date}</span>
                          </div>
                        </div>
                      </div>

                      <Badge className={`${statusConf.color} border flex items-center gap-1 flex-shrink-0`}>
                        <StatusIcon className="w-3 h-3" />
                        {t.fund_status}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">查收金额</p>
                        <p className="font-bold text-slate-900">
                          {(t.deposit_amount || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">{t.currency?.substring(0, 3)}</span>
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">收款账户</p>
                        <p className="font-medium text-slate-800 truncate">{t.receiving_account_name || "—"}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">维护期到期</p>
                        <p className="font-medium text-slate-800">{t.maintenance_end_date || "—"}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-500">汇款笔数</p>
                        <p className="font-bold text-slate-900">{t.remittance_count || 1} 笔</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pt-4">
          此页面为只读模式，数据每次打开时刷新 · 优汇结算系统
        </p>
      </div>
    </div>
  );
}