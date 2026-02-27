import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, CreditCard, Users, TrendingUp, Bot, LogOut, Database, Wallet, List, FolderTree, BarChart3, Home, MessageSquare, Brain } from "lucide-react";
import BottomTabBar from "./components/mobile/BottomTabBar";
import { User } from "@/entities/User";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// 结算系统菜单
const settlementMenuItems = [
  { title: "仪表盘", url: createPageUrl("Dashboard"), icon: LayoutDashboard, requiredPermission: null },
  { title: "交易管理", url: createPageUrl("Transactions"), icon: CreditCard, requiredPermission: null },
  { title: "盈利分析", url: createPageUrl("Analytics"), icon: TrendingUp, requiredPermission: 'can_view_profit_data' },
  { title: "AI智能报告", url: createPageUrl("AIReport"), icon: Brain, requiredPermission: 'can_view_profit_data' },
  { title: "数据备份", url: createPageUrl("DataBackup"), icon: Database, requiredPermission: 'is_admin' },
  { title: "消息中心", url: createPageUrl("TelegramMessages"), icon: MessageSquare, requiredPermission: null },
  { title: "Telegram设置", url: createPageUrl("TelegramSetup"), icon: Bot, requiredPermission: 'is_admin' },
  { title: "用户管理", url: createPageUrl("UserManagement"), icon: Users, requiredPermission: 'can_manage_users' },
];

// 记账系统菜单
const expenseMenuItems = [
  { title: "记账仪表盘", url: createPageUrl("ExpenseDashboard"), icon: LayoutDashboard, requiredPermission: null },
  { title: "开销列表", url: createPageUrl("ExpenseList"), icon: List, requiredPermission: null },
  { title: "分类管理", url: createPageUrl("ExpenseCategories"), icon: FolderTree, requiredPermission: null },
  { title: "报表分析", url: createPageUrl("ExpenseReports"), icon: BarChart3, requiredPermission: null },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 判断当前在哪个系统
  const isExpenseSystem = location.pathname.includes('Expense');
  const isSystemSelector = location.pathname.includes('SystemSelector');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
      } catch (error) {
        console.error("无法获取用户信息", error);
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      await User.logout();
      window.location.reload();
    } catch (error) {
      console.error("登出失败:", error);
    }
  };

  const hasPermission = (permission) => {
    if (loading) return false;
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (permission === 'is_admin') return user.role === 'admin';
    if (!permission) return true;
    return user.permissions?.[permission] === true;
  };

  // 如果在系统选择页，不显示侧边栏
  if (isSystemSelector) {
    return <>{children}</>;
  }

  const currentMenu = isExpenseSystem ? expenseMenuItems : settlementMenuItems;
  const navigationItems = currentMenu.filter(item => hasPermission(item.requiredPermission));
  
  const systemConfig = isExpenseSystem ? {
    name: "记账系统",
    icon: Wallet,
    color: "from-emerald-600 to-green-600"
  } : {
    name: "结算系统",
    icon: CreditCard,
    color: "from-blue-600 to-indigo-600"
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Sidebar className="border-r border-slate-200 bg-white/80 backdrop-blur-sm flex flex-col">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 bg-gradient-to-r ${systemConfig.color} rounded-xl flex items-center justify-center shadow-lg`}>
                <systemConfig.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">优汇{systemConfig.name}</h2>
                <p className="text-xs text-slate-500">智能管理平台</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4 flex-1">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-3">
                系统功能
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {!loading && navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-xl px-3 py-2.5 ${
                          location.pathname === item.url 
                            ? `bg-gradient-to-r ${systemConfig.color} text-white shadow-md` 
                            : 'text-slate-700'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <div className="p-4 border-t border-slate-200 space-y-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => navigate('/SystemSelector')}
                  className="hover:bg-purple-50 hover:text-purple-700 text-slate-700 transition-all duration-200 rounded-xl px-3 py-2.5 w-full"
                >
                  <div className="flex items-center gap-3">
                    <Home className="w-5 h-5" />
                    <span className="font-medium">返回系统选择</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={handleLogout}
                  className="hover:bg-red-50 hover:text-red-700 text-slate-700 transition-all duration-200 rounded-xl px-3 py-2.5 w-full"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">登出</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-slate-900">优汇{systemConfig.name}</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto pb-16 md:pb-0">
            {children}
          </div>
        </main>
      </div>
      <BottomTabBar />
    </SidebarProvider>
  );
}