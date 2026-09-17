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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-ink bg-white hover:bg-surface border border-border rounded-lg shadow-xs transition-colors cursor-pointer group select-none shrink-0 ${className}`}
    >
      <span className="text-slate-400 group-hover:text-ink transition-colors text-xs font-semibold">
        ←
      </span>
      <span>{label}</span>
    </Link>
  );
}
