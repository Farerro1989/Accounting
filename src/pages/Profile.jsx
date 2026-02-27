import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, LogOut, User } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Profile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const handleDeleteAccount = async () => {
    // Log out after deletion attempt
    await base44.auth.logout();
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 space-y-6">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          个人资料
        </h1>

        <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-bold">
                  {user?.full_name?.[0] || <User className="w-5 h-5" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-slate-900 font-semibold">{user?.full_name || "—"}</p>
                <p className="text-sm text-slate-500 font-normal">{user?.email || "—"}</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">角色</span>
              <span className="font-medium capitalize">{user?.role || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full gap-2 text-slate-700"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full gap-2">
                <Trash2 className="w-4 h-4" />
                删除账户
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除账户</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将永久删除您的账户，所有数据将无法恢复。您确定要继续吗？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-red-600 hover:bg-red-700"
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}