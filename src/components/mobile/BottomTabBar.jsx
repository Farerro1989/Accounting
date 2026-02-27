import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, CreditCard, Wallet } from "lucide-react";

const tabs = [
  { title: "仪表盘", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "交易", url: createPageUrl("Transactions"), icon: CreditCard },
  { title: "记账", url: createPageUrl("ExpenseDashboard"), icon: Wallet },
];

export default function BottomTabBar() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden bg-white border-t border-slate-200 select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {tabs.map((tab) => {
        const isActive =
          location.pathname === tab.url ||
          location.pathname.endsWith(tab.url);
        return (
          <Link
            key={tab.title}
            to={tab.url}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
              isActive ? "text-blue-600" : "text-slate-500"
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span>{tab.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}