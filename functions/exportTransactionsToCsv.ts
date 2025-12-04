import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 验证用户
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 获取所有交易数据 (Limit increased to 10000 to cover most exports)
        const transactions = await base44.entities.Transaction.list("-created_date", 10000);
        
        // CSV头部
        const headers = [
            '客户姓名', '银行名称', '银行账号', '银行地址', '银行所在地',
            '币种', '入金金额', '入金日期', '汇率', '佣金百分比',
            '转账手续费', '违规罚金', '维护期', '资金状态', 
            '结算USDT', '承兑回USDT', '创建时间'
        ];
        
        // 转换数据为CSV格式
        const csvRows = [headers.join(',')];
        
        transactions.forEach(t => {
            const row = [
                `"${t.customer_name || ''}"`,
                `"${t.bank_name || ''}"`,
                `"${t.bank_account || ''}"`,
                `"${t.bank_address || ''}"`,
                `"${t.bank_location || ''}"`,
                `"${t.currency || ''}"`,
                t.deposit_amount || 0,
                t.deposit_date || '',
                t.exchange_rate || 0,
                t.commission_percentage || 0,
                t.transfer_fee || 0,
                t.violation_penalty || 0,
                `"${t.maintenance_period || ''}"`,
                `"${t.fund_status || ''}"`,
                t.settlement_usdt || 0,
                t.acceptance_usdt || 0,
                t.created_date || ''
            ];
            csvRows.push(row.join(','));
        });
        
        const csvContent = '\uFEFF' + csvRows.join('\n'); // 添加BOM以支持中文
        
        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename=transactions_${new Date().toISOString().split('T')[0]}.csv`
            }
        });

    } catch (error) {
        console.error("导出CSV失败:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});