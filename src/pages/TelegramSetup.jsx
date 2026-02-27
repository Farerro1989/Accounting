import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator"; // Added Separator
import { Copy, CheckCircle, AlertCircle, Rocket, KeyRound, MousePointerClick, ShieldCheck, TestTube, Users, CreditCard, Wallet } from "lucide-react"; // Added CreditCard, Wallet
import { Textarea } from "@/components/ui/textarea";

export default function TelegramSetup() {
  const [deployedWebhookUrl, setDeployedWebhookUrl] = useState("");
  const [deployedExpenseWebhookUrl, setDeployedExpenseWebhookUrl] = useState("");
  
  const testMessage = `汇款日期: 2024-01-15
维护期: 15
币种: EUR
汇款人姓名: Zhang San
入款账户名: ABC Company Ltd
入款账户号: DE89370400440532013000
银行名称: Deutsche Bank
金额: 5000`;


  const testExpenseMessage = `标题: 午餐
商家: 麦当劳
金额: 45.50
币种: MYR
分类: 餐饮
支付: 银行卡`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const botTokenPlaceholder = "你的机器人令牌";
  const expenseBotTokenPlaceholder = "开销机器人令牌";
  const webhookUrlPlaceholder = "你部署的Webhook URL";
  const expenseWebhookUrlPlaceholder = "开销Webhook URL";
  
  const setWebhookApiUrl = `https://api.telegram.org/bot${botTokenPlaceholder}/setWebhook?url=${deployedWebhookUrl || webhookUrlPlaceholder}`;
  const setExpenseWebhookApiUrl = `https://api.telegram.org/bot${expenseBotTokenPlaceholder}/setWebhook?url=${deployedExpenseWebhookUrl || expenseWebhookUrlPlaceholder}`;

  return (
    <div className="p-4 md:p-8 space-y-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Telegram 机器人设置
          </h1>
          <p className="text-slate-600 mt-2">配置两个机器人：结算系统 + 开销记账</p>
        </div>

        {/* 系统选择提示 */}
        <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <p className="font-semibold mb-2">📱 两个独立的机器人系统</p>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="bg-white/50 p-3 rounded">
                <p className="font-medium">💰 结算系统机器人</p>
                <p className="text-xs text-slate-600">自动记录客户转账水单</p>
              </div>
              <div className="bg-white/50 p-3 rounded">
                <p className="font-medium">💳 开销记账机器人</p>
                <p className="text-xs text-slate-600">自动记录日常消费账目</p>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* ========== 结算系统机器人设置 ========== */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-600" />
              结算系统机器人设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 步骤1：创建机器人 */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                步骤1：创建机器人并获取Token
              </h3>
              
              <ol className="list-decimal list-inside pl-4 space-y-2 text-sm">
                <li>在Telegram搜索 <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">@BotFather</a></li>
                <li>发送 <code className="bg-white px-2 py-1 rounded">/newbot</code> 命令</li>
                <li>按提示设置机器人名称（例如：优汇结算助手）</li>
                <li>获得 Token</li>
              </ol>

              <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                <ShieldCheck className="h-4 w-4 text-yellow-700" />
                <AlertDescription className="text-yellow-800">
                  <p className="font-semibold mb-2">⚠️ 设置Token为环境变量：TELEGRAM_BOT_TOKEN</p>
                  <ol className="list-decimal list-inside pl-2 space-y-1 text-sm">
                    <li>打开项目 <strong>Settings</strong></li>
                    <li>找到 <strong>Environment Variables</strong></li>
                    <li>点击 <strong>Add New</strong></li>
                    <li>名称: <code className="bg-yellow-100 px-1">TELEGRAM_BOT_TOKEN</code></li>
                    <li>值: 粘贴您的Token</li>
                    <li>保存并重新部署</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </div>

            <Separator />

            {/* 步骤2：配置权限 */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                步骤2：配置群组权限
              </h3>
              
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-lg border">
                  <p className="font-medium mb-2">1. 允许机器人加入群组</p>
                  <code className="text-sm">发送: /setjoingroups</code>
                  <p className="text-xs text-slate-600 mt-1">选择您的机器人 → 选择 Enable</p>
                </div>

                <div className="bg-white p-4 rounded-lg border">
                  <p className="font-medium mb-2">2. 关闭隐私模式（重要！）</p>
                  <code className="text-sm">发送: /setprivacy</code>
                  <p className="text-xs text-slate-600 mt-1">选择您的机器人 → 选择 Disable</p>
                  <Alert className="mt-2 bg-red-50 border-red-200">
                    <AlertCircle className="h-3 w-3 text-red-600" />
                    <AlertDescription className="text-xs text-red-800">
                      <strong>必须关闭隐私模式！</strong>否则机器人无法看到群组消息
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </div>

            <Separator />

            {/* 步骤3：设置Webhook */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Rocket className="w-5 h-5 text-green-600" />
                步骤3：设置Webhook
              </h3>

              <Alert variant="default" className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  ✅ 系统已自动创建 <strong>telegramWebhook</strong> 函数
                </AlertDescription>
              </Alert>
              
              <div>
                <Label htmlFor="webhook-url">Webhook URL（从 Code → Functions → telegramWebhook 复制）</Label>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  <p>1. 打开左侧 <strong>Code → Functions</strong></p>
                  <p>2. 点击 <strong>telegramWebhook</strong></p>
                  <p>3. 复制顶部的URL</p>
                </div>
                <Input
                  id="webhook-url"
                  placeholder="https://你的应用.base44.run/telegramWebhook"
                  value={deployedWebhookUrl}
                  onChange={(e) => setDeployedWebhookUrl(e.target.value)}
                  className="mt-2 bg-white"
                />
              </div>

              <div>
                <Label>设置Webhook链接</Label>
                <div className="flex items-center gap-2 bg-white p-3 rounded-lg mt-2">
                  <code className="flex-1 text-xs break-all">{setWebhookApiUrl}</code>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => copyToClipboard(setWebhookApiUrl)}
                    disabled={!deployedWebhookUrl}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>重要步骤：</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                    <li>复制上面的链接</li>
                    <li>将 <code>{botTokenPlaceholder}</code> 替换为真实Token</li>
                    <li>在浏览器打开替换后的链接</li>
                    <li>看到 <code>{'"ok": true'}</code> 表示成功</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </div>

            <Separator />

            {/* 测试模板 */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <TestTube className="w-5 h-5 text-green-600" />
                测试水单模板
              </h3>
              <Textarea
                value={testMessage}
                readOnly
                rows={8}
                className="bg-white font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-2">
                💡 复制此模板到群组测试，或发送转账截图
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ========== 开销记账机器人设置 ========== */}
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Wallet className="w-6 h-6 text-emerald-600" />
              开销记账机器人设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 步骤1：创建机器人 */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-600" />
                步骤1：创建开销机器人
              </h3>
              
              <ol className="list-decimal list-inside pl-4 space-y-2 text-sm">
                <li>在Telegram搜索 <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">@BotFather</a></li>
                <li>再次发送 <code className="bg-white px-2 py-1 rounded">/newbot</code> 创建第二个机器人</li>
                <li>设置机器人名称（例如：优汇记账助手）</li>
                <li>获得第二个 Token</li>
              </ol>

              <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                <ShieldCheck className="h-4 w-4 text-yellow-700" />
                <AlertDescription className="text-yellow-800">
                  <p className="font-semibold mb-2">⚠️ 设置Token为环境变量：EXPENSE_BOT_TOKEN</p>
                  <ol className="list-decimal list-inside pl-2 space-y-1 text-sm">
                    <li>打开项目 <strong>Settings</strong></li>
                    <li>找到 <strong>Environment Variables</strong></li>
                    <li>点击 <strong>Add New</strong></li>
                    <li>名称: <code className="bg-yellow-100 px-1">EXPENSE_BOT_TOKEN</code></li>
                    <li>值: 粘贴您的第二个Token</li>
                    <li>保存并重新部署</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </div>

            <Separator />

            {/* 步骤2：配置权限（同上）*/}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                步骤2：配置群组权限
              </h3>
              
              <p className="text-sm text-slate-600">
                与结算机器人相同，需要：
              </p>
              
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-lg border">
                  <p className="font-medium mb-2">1. 允许机器人加入群组</p>
                  <code className="text-sm">发送: /setjoingroups</code>
                  <p className="text-xs text-slate-600 mt-1">选择您的机器人 → 选择 Enable</p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="font-medium mb-2">2. 关闭隐私模式（重要！）</p>
                  <code className="text-sm">发送: /setprivacy</code>
                  <p className="text-xs text-slate-600 mt-1">选择您的机器人 → 选择 Disable</p>
                  <Alert className="mt-2 bg-red-50 border-red-200">
                    <AlertCircle className="h-3 w-3 text-red-600" />
                    <AlertDescription className="text-xs text-red-800">
                      <strong>必须关闭隐私模式！</strong>否则机器人无法看到群组消息
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </div>

            <Separator />

            {/* 步骤3：设置Webhook */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Rocket className="w-5 h-5 text-green-600" />
                步骤3：设置Webhook
              </h3>
              
              <Alert className="bg-emerald-100 border-emerald-300">
                <CheckCircle className="h-4 w-4 text-emerald-700" />
                <AlertDescription className="text-emerald-900">
                  ✅ 系统已自动创建 <strong>expenseWebhook</strong> 函数
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="expense-webhook-url">Webhook URL（从 Code → Functions → expenseWebhook 复制）</Label>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  <p>1. 打开左侧 <strong>Code → Functions</strong></p>
                  <p>2. 点击 <strong>expenseWebhook</strong></p>
                  <p>3. 复制顶部的URL</p>
                </div>
                <Input
                  id="expense-webhook-url"
                  placeholder="https://你的应用.base44.run/expenseWebhook"
                  value={deployedExpenseWebhookUrl}
                  onChange={(e) => setDeployedExpenseWebhookUrl(e.target.value)}
                  className="mt-2 bg-white"
                />
              </div>

              <div>
                <Label>设置Webhook链接</Label>
                <div className="flex items-center gap-2 bg-white p-3 rounded-lg mt-2">
                  <code className="flex-1 text-xs break-all">{setExpenseWebhookApiUrl}</code>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => copyToClipboard(setExpenseWebhookApiUrl)}
                    disabled={!deployedExpenseWebhookUrl}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>重要步骤：</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                    <li>复制上面的链接</li>
                    <li>将 <code>{expenseBotTokenPlaceholder}</code> 替换为真实Token</li>
                    <li>在浏览器打开替换后的链接</li>
                    <li>看到 <code>{'"ok": true'}</code> 表示成功</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </div>

            <Separator />

            {/* 功能说明 */}
            <Alert className="bg-gradient-to-r from-emerald-100 to-green-100 border-emerald-300">
              <AlertCircle className="h-4 w-4 text-emerald-700" />
              <AlertDescription className="text-emerald-900">
                <p className="font-semibold mb-2">🎯 开销机器人功能</p>
                <ul className="space-y-1 text-sm list-disc list-inside">
                  <li>自动识别消费小票图片</li>
                  <li>提取金额、币种、商家信息</li>
                  <li>自动获取实时汇率</li>
                  <li>转换为USDT（+1%）</li>
                  <li>自动保存到开销系统</li>
                  <li>支持多币种：EUR、USD、MYR等</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* 测试模板 */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <TestTube className="w-5 h-5 text-green-600" />
                测试消费记录模板
              </h3>
              <Textarea
                value={testExpenseMessage}
                readOnly
                rows={6}
                className="bg-white font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                💡 也可以直接发送消费小票图片，AI会自动识别！
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ========== 机器人命令大全 ========== */}
        <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-indigo-600" />
              结算机器人命令大全
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { cmd: "查账", desc: "生成24小时只读查账链接，分享给需要查看账目的人", type: "🔐" },
                { cmd: "/process_batch", desc: "批量处理当前群组最近未处理的图片/文档，自动关联证件与水单", type: "📦" },
                { cmd: "/reanalyze [消息ID]", desc: "重新分析指定消息的图片内容（也可回复该消息发送此命令）", type: "🔄" },
              ].map(item => (
                <div key={item.cmd} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{item.type}</span>
                    <div>
                      <code className="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{item.cmd}</code>
                      <p className="text-sm text-slate-600 mt-1">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-emerald-200">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <code className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">自动触发（无需命令）</code>
                    <p className="text-sm text-slate-600 mt-1">发送含「汇款」「转账」「水单」关键词的文本、或上传转账单图片/PDF，自动识别并录入交易</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-700">🤖 AI 自动识别规则</h4>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="bg-white p-3 rounded border space-y-1">
                  <p className="font-medium text-slate-800">📸 图片识别</p>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside text-xs">
                    <li>自动判断：证件照 vs 转账水单</li>
                    <li>证件照 → 提取姓名、年龄、国籍</li>
                    <li>水单 → 提取金额、币种、收款方</li>
                    <li>证件+水单同时发送 → 自动关联</li>
                    <li>5分钟内先发的证件会自动匹配后发的水单</li>
                  </ul>
                </div>
                <div className="bg-white p-3 rounded border space-y-1">
                  <p className="font-medium text-slate-800">📝 文本识别</p>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside text-xs">
                    <li>支持标准格式（见下方模板）</li>
                    <li>正则解析 + AI兜底双重保障</li>
                    <li>自动填充默认值（汇率、点位等）</li>
                    <li>高龄客户（≥70岁）自动预警</li>
                    <li>仅有证件照时主动询问用途</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 使用指南 */}
        <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              使用指南
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> 结算机器人
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 pl-4">
                  <li>添加机器人到结算群组并关闭隐私模式</li>
                  <li>发送含汇款关键词的文本，或上传转账单图片</li>
                  <li>可同时或提前5分钟发送证件照（自动关联）</li>
                  <li>机器人自动录入并回复确认，如有误到后台修改</li>
                  <li>发送「查账」获取只读查账链接</li>
                </ol>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-emerald-700 flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> 开销机器人
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 pl-4">
                  <li>添加机器人到记账群组或直接私聊</li>
                  <li>拍照上传消费小票或发送消费文本</li>
                  <li>AI自动识别金额、币种、商家信息</li>
                  <li>自动获取实时汇率转换为USDT（+1%）</li>
                  <li>自动保存到开销系统</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}