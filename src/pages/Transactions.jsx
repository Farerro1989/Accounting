import React, { useState, useEffect, useRef } from "react";
import { Transaction } from "@/entities/Transaction";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Plus, Search, Upload, Download, FileText, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

import { exportTransactionsToCsv } from "@/functions/exportTransactionsToCsv";
import { exportTransactionsToPdf } from "@/functions/exportTransactionsToPdf";
import { importTransactionsFromCsv } from "@/functions/importTransactionsFromCsv";

import TransactionForm from "../components/transactions/TransactionForm";
import TransactionList from "../components/transactions/TransactionList";
import TransactionFilters from "../components/transactions/TransactionFilters";
import TransactionCharts from "../components/transactions/TransactionCharts";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    currency: "all"
  });
  const [permissions, setPermissions] = useState({});
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        try {
            const [data, user] = await Promise.all([
                Transaction.list("-created_date"),
                User.me()
            ]);
            setTransactions(data);
            if (user.role === 'admin') {
                setPermissions({ can_edit_transactions: true, can_delete_transactions: true });
            } else {
                setPermissions(user.permissions || {});
            }
        } catch (error) {
            console.error("加载数据失败:", error);
        }
        setLoading(false);
    };
    init();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await Transaction.list("-created_date");
      setTransactions(data);
    } catch (error) {
      console.error("加载交易数据失败:", error);
    }
    setLoading(false);
  };

  const handleSubmit = async (transactionData) => {
    try {
      let finalData = { ...transactionData };
      
      // 如果是新建交易（没有ID），生成交易编号
      if (!editingTransaction) {
        const numberResponse = await base44.functions.invoke('generateTransactionNumber', {
          date: transactionData.deposit_date
        });
        finalData.transaction_number = numberResponse.data.transaction_number;
      }
      
      // 计算结算USDT
      const initialUsdt = finalData.deposit_amount / finalData.exchange_rate;
      const commission = initialUsdt * (finalData.commission_percentage / 100);
      finalData.settlement_usdt = initialUsdt - commission - finalData.transfer_fee + (finalData.violation_penalty || 0);

      if (editingTransaction) {
        await Transaction.update(editingTransaction.id, finalData);
      } else {
        await Transaction.create(finalData);
      }
      
      setShowForm(false);
      setEditingTransaction(null);
      loadTransactions();
    } catch (error) {
      console.error("保存交易失败:", error);
    }
  };

  const handleEdit = (transaction) => {
    if (!permissions.can_edit_transactions) return;
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleDelete = async (transactionId) => {
    if (!permissions.can_delete_transactions) return;
    try {
      await Transaction.delete(transactionId);
      const updatedTransactions = transactions.filter(t => t.id !== transactionId);
      setTransactions(updatedTransactions);
    } catch (error) {
      console.error("删除交易失败:", error);
    }
  };

  const handleFileDownload = (data, filename, contentType) => {
    const blob = new Blob([data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (format) => {
    try {
      if (format === 'pdf') {
        const { data } = await exportTransactionsToPdf();
        handleFileDownload(data, `优汇金融_交易报告_${new Date().toISOString().split('T')[0]}.pdf`, 'application/pdf');
      } else if (format === 'csv') {
        const { data } = await exportTransactionsToCsv();
        handleFileDownload(data, `优汇金融_交易数据_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
      }
      toast({ title: "导出成功", description: "报告文件已开始下载。" });
    } catch (error) {
      console.error("导出失败:", error);
      toast({ title: "导出失败", description: "无法生成报告文件，请稍后再试。", variant: "destructive" });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await importTransactionsFromCsv(formData);
      if (response.status === 200 && response.data.success) {
        toast({ title: "导入成功", description: response.data.message });
        loadTransactions();
      } else {
        throw new Error(response.data?.error || "导入失败");
      }
    } catch (error) {
      console.error("导入失败:", error);
      toast({ title: "导入失败", description: `错误：${error.message}`, variant: "destructive" });
    } finally {
      // Reset file input
      event.target.value = null;
    }
  };


  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.bank_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filters.status === "all" || transaction.fund_status === filters.status;
    const matchesCurrency = filters.currency === "all" || transaction.currency === filters.currency;
    
    return matchesSearch && matchesStatus && matchesCurrency;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              交易管理
            </h1>
            <p className="text-slate-600 mt-1">管理客户入金和结算记录</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleImportClick}>
              <Upload className="w-4 h-4 mr-2" />
              导入数据
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".csv" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  导出报告
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  导出为 Excel (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  <FileText className="w-4 h-4 mr-2" />
                  导出为 PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              onClick={() => setShowForm(!showForm)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              新增交易
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <TransactionForm
                transaction={editingTransaction}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditingTransaction(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-lg p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索客户或银行名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80"
              />
            </div>
            <TransactionFilters filters={filters} onFiltersChange={setFilters} />
          </div>

          <TransactionList 
            transactions={filteredTransactions}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            permissions={permissions}
          />
        </div>
      </div>
    </div>
  );
}