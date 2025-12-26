import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check admin permission
    const user = await base44.auth.me();
    if (user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin only' }, { status: 403 });
    }

    // Get all transactions with special statuses
    const allTransactions = await base44.asServiceRole.entities.Transaction.list();
    
    const targetStatuses = ['已退回', '冻结（不能处理）', '冻结（正在处理）'];
    const targetTransactions = allTransactions.filter(t => targetStatuses.includes(t.fund_status));

    const updates = [];
    
    for (const t of targetTransactions) {
      // Update to zero all relevant fields
      await base44.asServiceRole.entities.Transaction.update(t.id, {
        commission_percentage: 0,
        transfer_fee: 0,
        acceptance_usdt: 0,
        settlement_usdt: 0
      });
      
      updates.push({
        id: t.id,
        transaction_number: t.transaction_number,
        customer_name: t.customer_name,
        fund_status: t.fund_status,
        cleared_fields: {
          commission_percentage: t.commission_percentage,
          transfer_fee: t.transfer_fee,
          acceptance_usdt: t.acceptance_usdt,
          settlement_usdt: t.settlement_usdt
        }
      });
    }

    return Response.json({
      success: true,
      message: '已成功清零所有特殊状态交易的费用和结算',
      total_checked: allTransactions.length,
      total_updated: updates.length,
      target_statuses: targetStatuses,
      updates
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});