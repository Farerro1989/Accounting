import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function ExpenseTable({ expenses, loading, onEdit, onDelete }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array(5).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>暂无开销记录</p>
      </div>
    );
  }

  const MobileCard = ({ expense }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">{expense.title}</span>
        <span className="font-bold text-emerald-600">{expense.usdt_amount?.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})} USDT</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{expense.category}</Badge>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">x{expense.quantity || 1}</Badge>
        <span className="text-slate-500">{expense.payment_method}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{expense.amount?.toLocaleString(undefined,{minimumFractionDigits:2})} {expense.currency?.substring(0,3)}</span>
        <span>{format(new Date(expense.expense_date), "yyyy-MM-dd")}</span>
      </div>
      {expense.description && <p className="text-xs text-slate-400 truncate">{expense.description}</p>}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => onEdit(expense)} className="flex-1 text-xs">
          <Edit className="w-3 h-3 mr-1" />编辑
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDelete(expense.id)} className="flex-1 text-xs text-red-600 border-red-200">
          <Trash2 className="w-3 h-3 mr-1" />删除
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {expenses.map(e => <MobileCard key={e.id} expense={e} />)}
      </div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>标题</TableHead>
            <TableHead>数量</TableHead>
            <TableHead>分类</TableHead>
            <TableHead>原始金额</TableHead>
            <TableHead>USDT金额</TableHead>
            <TableHead>日期</TableHead>
            <TableHead>支付方式</TableHead>
            <TableHead>备注</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id} className="hover:bg-slate-50/50">
              <TableCell className="font-medium">{expense.title}</TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  x{expense.quantity || 1}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {expense.category}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-slate-600">
                {expense.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {expense.currency?.substring(0, 3)}
                {expense.quantity > 1 && <div className="text-xs text-slate-500">单价 × {expense.quantity}</div>}
              </TableCell>
              <TableCell className="font-mono font-bold text-emerald-600">
                {expense.usdt_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {format(new Date(expense.expense_date), "yyyy-MM-dd")}
              </TableCell>
              <TableCell className="text-sm">{expense.payment_method}</TableCell>
              <TableCell className="text-sm text-slate-600 max-w-xs truncate">
                {expense.description || '-'}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(expense)}
                    className="hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(expense.id)}
                    className="hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}