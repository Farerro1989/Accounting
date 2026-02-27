import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2 } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusColors = {
  "等待中": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "已退回": "bg-red-100 text-red-800 border-red-200",
  "已到账": "bg-green-100 text-green-800 border-green-200",
  "承兑中": "bg-blue-100 text-blue-800 border-blue-200",
  "已完成交易": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "风控调解中": "bg-orange-100 text-orange-800 border-orange-200",
  "冻结（正在处理）": "bg-purple-100 text-purple-800 border-purple-200",
  "冻结（不能处理）": "bg-gray-100 text-gray-800 border-gray-200"
};

export default function TransactionList({ transactions, loading, onEdit, onDelete, permissions }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  const safeFormatDate = (dateString, formatString = "yyyy-MM-dd") => {
    try {
      if (!dateString) return "-";
      let date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
      if (!isValid(date)) date = new Date(dateString);
      if (!isValid(date)) return "-";
      return format(date, formatString);
    } catch {
      return "-";
    }
  };

  const getMaintenance = (transaction) => {
    if (!transaction.maintenance_end_date) return {};
    const today = new Date(); today.setHours(0,0,0,0);
    const endDate = new Date(transaction.maintenance_end_date); endDate.setHours(0,0,0,0);
    const daysLeft = Math.ceil((endDate - today) / 86400000);
    return { daysLeft, isExpiring: daysLeft <= 3 && daysLeft >= 0, isExpired: daysLeft < 0 };
  };

  const MobileCard = ({ transaction }) => {
    const { daysLeft, isExpiring, isExpired } = getMaintenance(transaction);
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-slate-400">{transaction.transaction_number || '-'}</span>
          <Badge className={`${statusColors[transaction.fund_status]} border text-xs`}>{transaction.fund_status}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900">{transaction.customer_name}</span>
          <span className="font-bold text-emerald-600">{transaction.currency?.substring(0,3)} {transaction.deposit_amount?.toLocaleString()}</span>
        </div>
        <div className="text-xs text-slate-500 flex justify-between">
          <span>{transaction.receiving_account_name}</span>
          <span>{safeFormatDate(transaction.deposit_date)}</span>
        </div>
        {transaction.maintenance_end_date && (
          <div className={`text-xs ${isExpired ? 'text-red-600 font-semibold' : isExpiring ? 'text-orange-600 font-semibold' : 'text-slate-500'}`}>
            维护期: {isExpired ? '已过期' : daysLeft !== null ? `剩${daysLeft}天` : '-'}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {permissions?.can_edit_transactions && (
            <Button variant="outline" size="sm" onClick={() => onEdit(transaction)} className="flex-1 text-xs">
              <Edit className="w-3 h-3 mr-1" />编辑
            </Button>
          )}
          {permissions?.can_delete_transactions && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 text-xs text-red-600 border-red-200">
                  <Trash2 className="w-3 h-3 mr-1" />删除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                  <AlertDialogDescription>确定要删除 "{transaction.customer_name}" 的这笔交易吗？此操作不可撤销。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(transaction.id)} className="bg-red-600 hover:bg-red-700">删除</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile card list */}
      <div className="flex flex-col gap-3 md:hidden">
        {transactions.map(t => <MobileCard key={t.id} transaction={t} />)}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>编号</TableHead>
              <TableHead>客户信息</TableHead>
              <TableHead>收款账户</TableHead>
              <TableHead>币种/金额</TableHead>
              <TableHead>汇款日期</TableHead>
              <TableHead>维护期</TableHead>
              <TableHead>汇率/佣金</TableHead>
              <TableHead>结算客户U</TableHead>
              <TableHead>承兑回U</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => {
              const { daysLeft, isExpiring, isExpired } = getMaintenance(transaction);
              return (
                <TableRow key={transaction.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div className="font-mono text-xs">{transaction.transaction_number || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-900">{transaction.customer_name}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{transaction.receiving_account_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{transaction.receiving_account_number}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{transaction.currency}</p>
                    <p className="text-sm text-slate-600">{transaction.deposit_amount?.toLocaleString()}</p>
                  </TableCell>
                  <TableCell className="text-sm">{safeFormatDate(transaction.deposit_date)}</TableCell>
                  <TableCell>
                    <p className="text-sm">{transaction.maintenance_days ? `${transaction.maintenance_days}天` : '-'}</p>
                    {transaction.maintenance_end_date && (
                      <p className={`text-xs ${isExpired ? 'text-red-600 font-semibold' : isExpiring ? 'text-orange-600 font-semibold' : 'text-slate-500'}`}>
                        {isExpired ? '已过期' : isExpiring && daysLeft >= 0 ? `${daysLeft}天后到期` : daysLeft !== null && daysLeft >= 0 ? `剩${daysLeft}天` : ''}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{transaction.exchange_rate}</p>
                    <p className="text-xs text-slate-500">{transaction.commission_percentage}%</p>
                  </TableCell>
                  <TableCell className="font-mono font-medium text-orange-600">{transaction.settlement_usdt?.toFixed(2)}</TableCell>
                  <TableCell className="font-mono font-medium text-blue-600">{transaction.acceptance_usdt ? transaction.acceptance_usdt.toFixed(2) : '-'}</TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[transaction.fund_status]} border text-xs`}>{transaction.fund_status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{safeFormatDate(transaction.created_date, "yyyy-MM-dd HH:mm")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {permissions?.can_edit_transactions && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(transaction)} className="hover:bg-blue-50 hover:text-blue-600">
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      {permissions?.can_delete_transactions && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除</AlertDialogTitle>
                              <AlertDialogDescription>您确定要删除客户 "{transaction.customer_name}" 的这笔交易吗？此操作不可撤销。</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(transaction.id)} className="bg-red-600 hover:bg-red-700">删除</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}