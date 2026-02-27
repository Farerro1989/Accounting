import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Search, X, CreditCard, Wallet, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ transactions: [], expenses: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ transactions: [], expenses: [] });
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.trim().toLowerCase();
        const [txns, exps] = await Promise.all([
          base44.entities.Transaction.list("-deposit_date", 200),
          base44.entities.Expense.list("-expense_date", 200),
        ]);

        const matchTxn = txns.filter(t =>
          [t.customer_name, t.transaction_number, t.receiving_account_name,
           t.receiving_account_number, t.currency, t.fund_status]
            .some(v => v?.toLowerCase().includes(q))
        ).slice(0, 5);

        const matchExp = exps.filter(e =>
          [e.title, e.category, e.description, e.payment_method]
            .some(v => v?.toLowerCase().includes(q))
        ).slice(0, 5);

        setResults({ transactions: matchTxn, expenses: matchExp });
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelectTransaction = (t) => {
    setOpen(false);
    setQuery("");
    navigate(createPageUrl("Transactions") + `?highlight=${t.id}`);
  };

  const handleSelectExpense = (e) => {
    setOpen(false);
    setQuery("");
    navigate(createPageUrl("ExpenseList") + `?highlight=${e.id}`);
  };

  const hasResults = results.transactions.length > 0 || results.expenses.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div
        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 transition-colors rounded-xl px-3 py-2 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        {open ? (
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索交易或开销..."
            className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 shadow-none"
          />
        ) : (
          <span className="text-sm text-slate-400">搜索交易或开销...</span>
        )}
        {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
        {open && query && !loading && (
          <button onClick={(e) => { e.stopPropagation(); setQuery(""); }} className="shrink-0">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {!hasResults && !loading && (
            <div className="p-4 text-sm text-slate-500 text-center">无匹配结果</div>
          )}

          {results.transactions.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> 交易记录
              </div>
              {results.transactions.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTransaction(t)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t.customer_name}</p>
                      <p className="text-xs text-slate-500">{t.transaction_number} · {t.receiving_account_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">{t.currency?.substring(0,3)} {t.deposit_amount?.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">{t.fund_status}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.expenses.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> 开销记录
              </div>
              {results.expenses.map(e => (
                <button
                  key={e.id}
                  onClick={() => handleSelectExpense(e)}
                  className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{e.title}</p>
                      <p className="text-xs text-slate-500">{e.category} · {e.expense_date}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600">{e.usdt_amount?.toFixed(2)} USDT</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}