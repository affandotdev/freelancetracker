"use client";

import React from "react";
import { exportToCsv } from "@/lib/csvExport";

interface ExportCsvButtonProps {
  filename: string;
  data: Record<string, any>[];
  label?: string;
  className?: string;
}

export default function ExportCsvButton({
  filename,
  data,
  label = "Export CSV",
  className = "",
}: ExportCsvButtonProps) {
  const handleExport = () => {
    exportToCsv(filename, data);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white hover:bg-emerald-50/70 border border-slate-200/90 hover:border-emerald-300 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer select-none shrink-0 ${className}`}
      title="Download as CSV spreadsheet"
    >
      <span className="text-emerald-600 font-black text-xs">📥</span>
      <span>{label}</span>
    </button>
  );
}
