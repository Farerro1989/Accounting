import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const colorVariants = {
  blue: {
    bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
    border: "border-blue-200",
    iconBg: "bg-gradient-to-r from-blue-500 to-indigo-500",
    text: "text-blue-600"
  },
  green: {
    bg: "bg-gradient-to-br from-emerald-50 to-green-50", 
    border: "border-emerald-200",
    iconBg: "bg-gradient-to-r from-emerald-500 to-green-500",
    text: "text-emerald-600"
  },
  yellow: {
    bg: "bg-gradient-to-br from-amber-50 to-yellow-50",
    border: "border-amber-200", 
    iconBg: "bg-gradient-to-r from-amber-500 to-yellow-500",
    text: "text-amber-600"
  },
  purple: {
    bg: "bg-gradient-to-br from-purple-50 to-violet-50",
    border: "border-purple-200",
    iconBg: "bg-gradient-to-r from-purple-500 to-violet-500", 
    text: "text-purple-600"
  },
  indigo: {
    bg: "bg-gradient-to-br from-indigo-50 to-blue-50",
    border: "border-indigo-200",
    iconBg: "bg-gradient-to-r from-indigo-500 to-blue-500",
    text: "text-indigo-600"
  },
  red: {
    bg: "bg-gradient-to-br from-red-50 to-rose-50",
    border: "border-red-200",
    iconBg: "bg-gradient-to-r from-red-500 to-rose-500",
    text: "text-red-600"
  },
  orange: {
    bg: "bg-gradient-to-br from-orange-50 to-amber-50",
    border: "border-orange-200",
    iconBg: "bg-gradient-to-r from-orange-500 to-amber-500",
    text: "text-orange-600"
  }
};

export default function StatCard({ title, value, description, icon: Icon, color = "blue", loading = false, onClick, isClickable = false }) {
  const variant = colorVariants[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card 
        className={`${variant.bg} ${variant.border} border shadow-lg hover:shadow-xl transition-all duration-300 ${
          isClickable ? 'cursor-pointer hover:scale-105' : ''
        }`}
        onClick={onClick}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-600 truncate">{title}</p>
              {loading ? (
                <>
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-16" />
                </>
              ) : (
                <>
                  <p className={`text-2xl font-bold ${variant.text}`}>{value}</p>
                  {description && (
                    <p className="text-xs text-slate-500">{description}</p>
                  )}
                </>
              )}
            </div>
            <div className={`p-3 rounded-xl ${variant.iconBg} shadow-lg ml-4`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}