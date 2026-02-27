import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Edit, X } from "lucide-react";
import { format } from "date-fns";

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

const FUND_STATUSES = [
  "等待中", "已退回", "已到账", "承兑中", "已完成交易", 
  "风控调解中", "冻结（正在处理）", "冻结（不能处理）"
];

export default function StatusDetailModal({ status, transactions, onClose, onUpdateTransaction }) {
  const [editingTransactions, setEditingTransactions] = useState({});
  const [editData, setEditData] = useState({});

  const handleStartEdit = (transactionId, transaction) => {
    setEditingTransactions(prev => ({ ...prev, [transactionId]: true }));
    setEditData(prev => ({
      ...prev,
      [transactionId]: {
        fund_status: transaction.fund_status,
        acceptance_usdt: transaction.acceptance_usdt || 0
      }
    }));
  };

  const handleCancelEdit = (transactionId) => {
    setEditingTransactions(prev => {
      const newState = { ...prev };
      delete newState[transactionId];
      return newState;
    });
    setEditData(prev => {
      const newState = { ...prev };
      delete newState[transactionId];
      return newState;
    });
  };

  const handleSaveEdit = async (transactionId, transaction) => {
    try {
      const updatedData = editData[transactionId];
      await onUpdateTransaction(transactionId, updatedData);
      
      setEditingTransactions(prev => {
        const newState = { ...prev };
        delete newState[transactionId];
        return newState;
      });
      setEditData(prev => {
        const newState = { ...prev };
        delete newState[transactionId];
        return newState;
      });
    } catch (error) {
      console.error("更新交易失败:", error);
    }
  };

  const handleDataChange = (transactionId, field, value) => {
    setEditData(prev => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        [field]: field === 'acceptance_usdt' ? (parseFloat(value) || 0) : value
      }
    }));
  };

  const totalUsdt = transactions.reduce((sum, t) => {
    const dep = parseFloat(t.deposit_amount) || 0;
    const rate = parseFloat(t.exchange_rate) || 0;
    return sum + (rate > 0 ? dep / rate : 0);
  }, 0);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <Badge className={`${statusColors[status]} border`}>
              {status}
            </Badge>
            <span>交易详情 ({transactions.length}笔)</span>
            <span className="text-sm font-normal text-slate-500">
              合计 ≈ <span className="text-emerald-600 font-semibold">{totalUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</span>
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>该状态下暂无交易记录</p>
            </div>
          ) : (
            transactions.map((transaction) => {
              const isEditing = editingTransactions[transaction.id];
              const currentEditData = editData[transaction.id] || {};

              return (
                <Card key={transaction.id} className="bg-slate-50">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">客户信息</p>
                        <p className="font-medium">{transaction.customer_name}</p>
                        <p className="text-sm text-slate-600">{transaction.bank_name}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-slate-500">交易金额</p>
                        <p className="font-medium">{transaction.currency}</p>
                        <p className="text-sm text-slate-600">
                          {transaction.deposit_amount?.toLocaleString()}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-slate-500">资金状态</p>
                        {isEditing ? (
                          <Select
                            value={currentEditData.fund_status || transaction.fund_status}
                            onValueChange={(value) => handleDataChange(transaction.id, 'fund_status', value)}
                          >
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FUND_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={`${statusColors[transaction.fund_status]} border mt-1`}>
                            {transaction.fund_status}
                          </Badge>
                        )}
                      </div>
                      
                      <div>
                        <p className="text-sm text-slate-500">结算给客户U</p>
                        <p className="font-mono font-medium text-orange-600 mt-1">
                          {(transaction.settlement_usdt || 0).toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-slate-500">承兑实际回U</p>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={currentEditData.acceptance_usdt !== undefined ? currentEditData.acceptance_usdt : transaction.acceptance_usdt || 0}
                            onChange={(e) => handleDataChange(transaction.id, 'acceptance_usdt', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="font-mono font-medium text-blue-600 mt-1">
                            {(transaction.acceptance_usdt || 0).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-sm text-slate-500">创建时间</p>
                          <p className="text-sm text-slate-600">
                            {format(new Date(transaction.created_date), "yyyy-MM-dd HH:mm")}
                          </p>
                        </div>
                        {transaction.deposit_date && (
                          <div>
                            <p className="text-sm text-slate-500">入金日期</p>
                            <p className="text-sm text-slate-600">
                              {format(new Date(transaction.deposit_date), "yyyy-MM-dd")}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(transaction.id, transaction)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Save className="w-4 h-4 mr-1" />
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelEdit(transaction.id)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              取消
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartEdit(transaction.id, transaction)}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            编辑
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}