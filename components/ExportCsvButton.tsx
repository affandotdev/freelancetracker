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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-ink bg-white hover:bg-surface border border-border rounded-lg shadow-xs transition-colors cursor-pointer select-none shrink-0 ${className}`}
      title="Download as CSV spreadsheet"
    >
      <span>↓</span>
      <span>{label}</span>
    </button>
  );
}
