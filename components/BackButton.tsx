"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface BackButtonProps {
  label?: string;
  fallbackHref?: string;
  className?: string;
}

export default function BackButton({
  label = "Back",
  fallbackHref = "/",
  className = "",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = (e: React.MouseEvent) => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <Link
      href={fallbackHref}
      onClick={handleBack}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer group select-none shrink-0 ${className}`}
    >
      <span className="text-slate-400 group-hover:text-blue-600 group-hover:-translate-x-0.5 transition-all text-sm font-black">
        ←
      </span>
      <span>{label}</span>
    </Link>
  );
}
