import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
            '转账手续费(原币)', '转账手续费(USDT)', '初始USDT', '佣金(USDT)',
            '违规罚金', '维护期', '资金状态', 
            '结算USDT', '承兑回USDT', '汇率差盈利(USDT)', '总盈利(USDT)', '创建时间'
        ];
        
        // 转换数据为CSV格式
        const csvRows = [headers.join(',')];
        
        transactions.forEach(t => {
            // 计算盈利数据
            const deposit = parseFloat(t.deposit_amount) || 0;
            const rate = parseFloat(t.exchange_rate) || 0;
            const feeNative = parseFloat(t.transfer_fee) || 0;
            const commPct = parseFloat(t.commission_percentage) || 0;
            const penalty = parseFloat(t.violation_penalty) || 0;
            const acceptance = parseFloat(t.acceptance_usdt) || 0;
            
            let initialUsdt = 0;
            let feeUsdt = 0;
            let commUsdt = 0;
            let settlementUsdt = parseFloat(t.settlement_usdt) || 0;
            let exchangeProfit = 0;
            let totalProfit = 0;

            if (rate > 0) {
                initialUsdt = deposit / rate;
                commUsdt = initialUsdt * (commPct / 100);
                feeUsdt = feeNative / rate;
                
                // Recalculate settlement to ensure consistency or use DB value
                const netNative = deposit - feeNative - (deposit * commPct / 100);
                const calculatedSettlement = netNative / rate;
                // Use calculated if significantly different? Or trust DB? 
                // Let's trust DB for settlement but fallback to calculated if 0?
                // Actually, let's use the logic from dashboard:
                if (settlementUsdt === 0) settlementUsdt = calculatedSettlement;

                const actualAcceptance = acceptance > 0 ? acceptance : settlementUsdt;
                exchangeProfit = actualAcceptance - initialUsdt;
                totalProfit = exchangeProfit + commUsdt + feeUsdt - penalty;
            }

            const row = [
                `"${t.customer_name || ''}"`,
                `"${t.bank_name || ''}"`,
                `"${t.bank_account || ''}"`,
                `"${t.bank_address || ''}"`,
                `"${t.bank_location || ''}"`,
                `"${t.currency || ''}"`,
                deposit,
                t.deposit_date || '',
                rate,
                commPct,
                feeNative,
                feeUsdt.toFixed(2),
                initialUsdt.toFixed(2),
                commUsdt.toFixed(2),
                penalty,
                `"${t.maintenance_period || ''}"`,
                `"${t.fund_status || ''}"`,
                settlementUsdt.toFixed(2),
                acceptance.toFixed(2), // Export raw acceptance, not "actual" logic
                exchangeProfit.toFixed(2),
                totalProfit.toFixed(2),
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