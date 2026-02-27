import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

const generateYears = () => {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = 2024; y <= current + 1; y++) years.push(y);
  return years;
};

const generateDays = (year, month) => {
  const days = new Date(year, month, 0).getDate(); // last day of month
  return Array.from({ length: days }, (_, i) => i + 1);
};

export default function DateRangeFilter({ filterMode, year, month, day, onChange }) {
  const years = generateYears();
  const days = generateDays(parseInt(year), parseInt(month));

  const set = (key, value) => onChange({ filterMode, year, month, day, [key]: value });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 bg-white/80 border border-slate-200 rounded-lg px-2 py-1">
        <Calendar className="w-4 h-4 text-slate-500" />
        <span className="text-sm text-slate-500">查账范围</span>
      </div>

      {/* Mode selector */}
      <Select value={filterMode} onValueChange={(v) => onChange({ filterMode: v, year, month, day })}>
        <SelectTrigger className="w-28 bg-white/80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部累计</SelectItem>
          <SelectItem value="year">按年份</SelectItem>
          <SelectItem value="month">按月份</SelectItem>
          <SelectItem value="day">按日期</SelectItem>
        </SelectContent>
      </Select>

      {/* Year selector (shown for year/month/day) */}
      {filterMode !== "all" && (
        <Select value={year} onValueChange={(v) => set("year", v)}>
          <SelectTrigger className="w-24 bg-white/80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Month selector (shown for month/day) */}
      {(filterMode === "month" || filterMode === "day") && (
        <Select value={month} onValueChange={(v) => set("month", v)}>
          <SelectTrigger className="w-20 bg-white/80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Day selector (shown for day) */}
      {filterMode === "day" && (
        <Select value={day} onValueChange={(v) => set("day", v)}>
          <SelectTrigger className="w-20 bg-white/80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {days.map(d => (
              <SelectItem key={d} value={String(d)}>{d}日</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}