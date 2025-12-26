import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 验证用户权限
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
        }

        // 获取所有USD美元且已完成交易的记录
        const transactions = await base44.asServiceRole.entities.Transaction.filter({
            currency: 'USD美元',
            fund_status: '已完成交易'
        });

        let updatedCount = 0;
        const updates = [];

        // 重新计算每笔交易的acceptance_usdt
        for (const transaction of transactions) {
            const depositAmount = parseFloat(transaction.deposit_amount) || 0;
            if (depositAmount > 0) {
                const newAcceptanceUsdt = parseFloat((depositAmount / 1.02).toFixed(2));
                
                // 只在值不同时更新
                if (Math.abs((transaction.acceptance_usdt || 0) - newAcceptanceUsdt) > 0.01) {
                    await base44.asServiceRole.entities.Transaction.update(transaction.id, {
                        acceptance_usdt: newAcceptanceUsdt
                    });
                    updatedCount++;
                    updates.push({
                        id: transaction.id,
                        customer_name: transaction.customer_name,
                        deposit_amount: depositAmount,
                        old_acceptance: transaction.acceptance_usdt,
                        new_acceptance: newAcceptanceUsdt
                    });
                }
            }
        }

        return Response.json({
            success: true,
            message: `成功重算 ${updatedCount} 笔USD交易`,
            total_checked: transactions.length,
            updated_count: updatedCount,
            details: updates
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});