import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { X, Save, Wand2, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { base44 } from "@/api/base44Client";
import { format, addDays } from "date-fns";
import { Transaction } from "@/entities/Transaction";

const CURRENCIES = [
  "USD美元", "EUR欧元", "SGD新元", "MYR马币", "AUD澳币", 
  "CHF瑞郎", "THB泰铢", "VND越南盾", "GBP英镑", "CAD加元", "HKD港币", "KRW韩币",
  "CNY人民币", "JPY日元", "AED迪拉姆", "PHP菲律宾比索", "IDR印尼盾"
];

const FUND_STATUSES = [
  "等待中", "已退回", "已到账", "承兑中", "已完成交易", 
  "风控调解中", "冻结（正在处理）", "冻结（不能处理）"
];

export default function TransactionForm({ transaction, initialTransferInfo = "", onSubmit, onCancel }) {
  const [formData, setFormData] = useState(transaction || {
    customer_name: "",
    receiving_account_name: "",
    receiving_account_number: "",
    currency: "",
    deposit_amount: 0,
    deposit_date: format(new Date(), "yyyy-MM-dd"),
    maintenance_days: 15,
    exchange_rate: 0.96,
    commission_percentage: 13.5,
    transfer_fee: 30,
    violation_penalty: 0,
    fund_status: "等待中",
    acceptance_usdt: 0
  });

  const [transferInfo, setTransferInfo] = useState(initialTransferInfo);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [companyAccounts, setCompanyAccounts] = useState({});
  const [availableAccounts, setAvailableAccounts] = useState([]);

  // 加载所有公司及其账户
  useEffect(() => {
    const loadCompanyAccounts = async () => {
      try {
        const transactions = await Transaction.list();
        const accountMap = {};
        
        transactions.forEach(t => {
          const company = t.receiving_account_name;
          const account = t.receiving_account_number;
          
          if (company && account) {
            if (!accountMap[company]) {
              accountMap[company] = new Set();
            }
            accountMap[company].add(account);
          }
        });
        
        // Convert Sets to Arrays
        const finalMap = {};
        Object.keys(accountMap).forEach(company => {
          finalMap[company] = Array.from(accountMap[company]);
        });
        
        setCompanyAccounts(finalMap);
      } catch (error) {
        console.error('加载公司账户失败:', error);
      }
    };
    
    loadCompanyAccounts();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 计算维护期到期日期
    const maintenanceEndDate = addDays(new Date(formData.deposit_date), formData.maintenance_days);
    const dataWithMaintenance = {
      ...formData,
      maintenance_end_date: format(maintenanceEndDate, "yyyy-MM-dd")
    };
    
    onSubmit(dataWithMaintenance);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCompanyChange = (company) => {
    handleChange('receiving_account_name', company);
    // 更新可用账户列表
    setAvailableAccounts(companyAccounts[company] || []);
    // 如果只有一个账户，自动选中
    if (companyAccounts[company]?.length === 1) {
      handleChange('receiving_account_number', companyAccounts[company][0]);
    } else {
      handleChange('receiving_account_number', '');
    }
  };
  
  const handleCurrencyChange = async (value) => {
    handleChange('currency', value);
    if (!value) {
      handleChange('exchange_rate', 0.96);
      return;
    }

    const currencyCode = value.substring(0, 3);
    
    if (currencyCode === 'USD') {
      handleChange('exchange_rate', 0.96);
      return;
    }

    setIsFetchingRate(true);
    try {
      const response = await base44.functions.invoke('getExchangeRate', { currencyCode });
      if (response.data && response.data.rate) {
        handleChange('exchange_rate', parseFloat((response.data.rate * 0.97).toFixed(5)));
      } else {
        console.warn(`未获取到 ${currencyCode} 汇率，使用默认值`);
        handleChange('exchange_rate', 0.96);
      }
    } catch (error) {
      console.error("获取汇率失败:", error);
      handleChange('exchange_rate', 0.96);
    } finally {
      setIsFetchingRate(false);
    }
  };

  const handleAutoExtract = async () => {
    if (!transferInfo.trim()) {
      setParseError("请先粘贴转账信息");
      return;
    }

    setIsProcessing(true);
    setParseError("");

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `请从以下水单信息中提取相关数据，并按照指定格式返回JSON：

转账信息：
${transferInfo}

请提取以下信息：
- 查收币种 (currency)：提取币种代码，如EUR、USD等，然后映射为：USD美元、EUR欧元、SGD新元、MYR马币、AUD澳币、CHF瑞郎、THB泰铢、VND越南盾、GBP英镑、CAD加元、HKD港币、KRW韩币 中的一个
- 汇款人姓名 (customer_name)：客户姓名
- 入款账户名 (receiving_account_name)：收款公司名称
- 入款账户号 (receiving_account_number)：收款公司银行账号
- 查收金额 (deposit_amount)：转账金额
- 汇款日期 (deposit_date)：转账日期，格式YYYY-MM-DD
- 维护期 (maintenance_days)：维护期天数（数字），如果未提供默认15

如果某些信息未找到，请返回空字符串或默认值。`,
        response_json_schema: {
          type: "object",
          properties: {
            currency: { type: "string" },
            customer_name: { type: "string" },
            receiving_account_name: { type: "string" },
            receiving_account_number: { type: "string" },
            deposit_amount: { type: "number" },
            deposit_date: { type: "string" },
            maintenance_days: { type: "number" }
          }
        }
      });

      if (result) {
        setFormData(prev => ({
          ...prev,
          currency: result.currency || prev.currency,
          customer_name: result.customer_name || prev.customer_name,
          receiving_account_name: result.receiving_account_name || prev.receiving_account_name,
          receiving_account_number: result.receiving_account_number || prev.receiving_account_number,
          deposit_amount: result.deposit_amount || prev.deposit_amount,
          deposit_date: result.deposit_date || prev.deposit_date,
          maintenance_days: result.maintenance_days || prev.maintenance_days || 15
        }));
        setTransferInfo("");
        if (result.currency) {
          handleCurrencyChange(result.currency);
        }
      }
    } catch (error) {
      console.error("解析转账信息失败:", error);
      setParseError("解析转账信息失败，请检查信息格式或手动填写");
    }

    setIsProcessing(false);
  };

  // 计算维护期到期日期（用于显示）
  const maintenanceEndDate = formData.deposit_date && formData.maintenance_days
    ? format(addDays(new Date(formData.deposit_date), formData.maintenance_days), "yyyy-MM-dd")
    : "";

  return (
    <Card className="bg-white/90 backdrop-blur-sm border border-slate-200 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold text-slate-900">
          {transaction ? '编辑交易' : '新增交易'}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">自动抓取水单信息</h3>
            </div>
            
            <div className="space-y-3">
              <Label>粘贴水单信息</Label>
              <Textarea
                placeholder="请粘贴水单信息，例如：
编号: 20250119/0001
汇款日期: 2025-01-19
维护期: 15天
查收币种: EUR
汇款人姓名: Zhang San
入款账户名: ABC Company Ltd
入款账户号: DE89370400440532013000
查收金额: 5000"
                value={transferInfo}
                onChange={(e) => setTransferInfo(e.target.value)}
                rows={8}
                className="bg-white/80 text-sm"
              />
              
              <Button 
                onClick={handleAutoExtract}
                disabled={isProcessing || !transferInfo.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {isProcessing ? "解析中..." : "自动填充表单"}
              </Button>

              {parseError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <Separator />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deposit_date">汇款日期 *</Label>
                <Input
                  id="deposit_date"
                  type="date"
                  value={formData.deposit_date}
                  onChange={(e) => handleChange('deposit_date', e.target.value)}
                  required
                  className="bg-white/80"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance_days">维护期（天数） *</Label>
                <Input
                  id="maintenance_days"
                  type="number"
                  value={formData.maintenance_days}
                  onChange={(e) => handleChange('maintenance_days', parseInt(e.target.value) || 15)}
                  required
                  className="bg-white/80"
                />
                {maintenanceEndDate && (
                  <p className="text-xs text-slate-500">
                    到期日期: {maintenanceEndDate}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>查收币种 *</Label>
                <Select value={formData.currency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger className="bg-white/80">
                    <SelectValue placeholder="选择币种" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_name">汇款人姓名（客户姓名） *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => handleChange('customer_name', e.target.value)}
                  required
                  className="bg-white/80"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiving_account_name">入款账户名（收款公司名） *</Label>
                {Object.keys(companyAccounts).length > 0 ? (
                  <Select value={formData.receiving_account_name} onValueChange={handleCompanyChange}>
                    <SelectTrigger className="bg-white/80">
                      <SelectValue placeholder="选择公司名或输入新公司" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(companyAccounts).map((company) => (
                        <SelectItem key={company} value={company}>
                          {company} ({companyAccounts[company].length} 个账户)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="receiving_account_name"
                    value={formData.receiving_account_name}
                    onChange={(e) => handleChange('receiving_account_name', e.target.value)}
                    required
                    className="bg-white/80"
                    placeholder="例如: ABC Company Ltd"
                  />
                )}
                <Input
                  value={formData.receiving_account_name}
                  onChange={(e) => handleChange('receiving_account_name', e.target.value)}
                  className="bg-white/80 text-sm"
                  placeholder="或手动输入新公司名"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiving_account_number">入款账户号（收款公司账号） *</Label>
                {availableAccounts.length > 0 ? (
                  <>
                    <Select 
                      value={formData.receiving_account_number} 
                      onValueChange={(value) => handleChange('receiving_account_number', value)}
                    >
                      <SelectTrigger className="bg-white/80">
                        <SelectValue placeholder="选择账号或输入新账号" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAccounts.map((account) => (
                          <SelectItem key={account} value={account}>
                            {account}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={formData.receiving_account_number}
                      onChange={(e) => handleChange('receiving_account_number', e.target.value)}
                      className="bg-white/80 text-sm"
                      placeholder="或手动输入新账号"
                    />
                  </>
                ) : (
                  <Input
                    id="receiving_account_number"
                    value={formData.receiving_account_number}
                    onChange={(e) => handleChange('receiving_account_number', e.target.value)}
                    required
                    className="bg-white/80"
                    placeholder="例如: DE89370400440532013000"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="deposit_amount">查收金额 *</Label>
                <Input
                  id="deposit_amount"
                  type="number"
                  step="0.01"
                  value={formData.deposit_amount}
                  onChange={(e) => handleChange('deposit_amount', parseFloat(e.target.value) || 0)}
                  required
                  className="bg-white/80"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exchange_rate">汇率 *</Label>
                <div className="relative">
                  <Input
                    id="exchange_rate"
                    type="number"
                    step="0.00001"
                    value={formData.exchange_rate}
                    onChange={(e) => handleChange('exchange_rate', parseFloat(e.target.value) || 0)}
                    required
                    className="bg-white/80"
                  />
                  {isFetchingRate && (
                    <Loader2 className="absolute right-2 top-2 h-5 w-5 animate-spin text-slate-400" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission_percentage">佣金% * (默认13.5%)</Label>
                <Input
                  id="commission_percentage"
                  type="number"
                  step="0.01"
                  value={formData.commission_percentage}
                  onChange={(e) => handleChange('commission_percentage', parseFloat(e.target.value) || 0)}
                  required
                  className="bg-white/80"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer_fee">转账手续费 * (默认30)</Label>
                <Input
                  id="transfer_fee"
                  type="number"
                  step="0.01"
                  value={formData.transfer_fee}
                  onChange={(e) => handleChange('transfer_fee', parseFloat(e.target.value) || 0)}
                  required
                  className="bg-white/80"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="violation_penalty">违规罚金</Label>
                <Input
                  id="violation_penalty"
                  type="number"
                  step="0.01"
                  value={formData.violation_penalty}
                  onChange={(e) => handleChange('violation_penalty', parseFloat(e.target.value) || 0)}
                  className="bg-white/80"
                />
              </div>

              <div className="space-y-2">
                <Label>资金状态</Label>
                <Select value={formData.fund_status} onValueChange={(value) => handleChange('fund_status', value)}>
                  <SelectTrigger className="bg-white/80">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="acceptance_usdt">承兑回USDT (手动输入)</Label>
                <Input
                  id="acceptance_usdt"
                  type="number"
                  step="0.01"
                  value={formData.acceptance_usdt}
                  onChange={(e) => handleChange('acceptance_usdt', parseFloat(e.target.value) || 0)}
                  className="bg-white/80"
                  placeholder="等待数据后手动输入"
                />
                <p className="text-xs text-slate-500">
                  需要获得实际数据后手动输入此字段
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={onCancel}>
                取消
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}