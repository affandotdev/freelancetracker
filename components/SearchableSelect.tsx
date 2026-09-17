"use client";

import React, { useState, useRef, useEffect, useMemo, useId } from "react";

export interface SearchableOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
  error?: boolean | string;
  allowClear?: boolean;
  emptyMessage?: string;
  size?: "sm" | "md";
}

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "-- Select an option --",
  searchPlaceholder = "Type to search...",
  required = false,
  disabled = false,
  name,
  id,
  className = "",
  error,
  allowClear = false,
  emptyMessage = "No matching options",
  size = "md",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Selected Option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Filtered Options based on live search
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Handle open & focus search
  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearchQuery("");
    // Find index of current selected option in filtered list
    const currentIndex = filteredOptions.findIndex((opt) => opt.value === value);
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === "Escape" || e.key === "Tab") {
      handleClose();
      if (e.key === "Escape") {
        triggerRef.current?.focus();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
        scrollOptionIntoView(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
        scrollOptionIntoView(next);
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const chosen = filteredOptions[highlightedIndex];
        if (!chosen.disabled) {
          onChange(chosen.value);
          handleClose();
          triggerRef.current?.focus();
        }
      }
    }
  };

  const scrollOptionIntoView = (index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-option-index]");
    const target = items[index] as HTMLElement;
    if (target) {
      target.scrollIntoView({ block: "nearest" });
    }
  };

  const handleSelectOption = (opt: SearchableOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    handleClose();
    triggerRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    triggerRef.current?.focus();
  };

  const isSmall = size === "sm";

  return (
    <div
      ref={containerRef}
      className={`relative w-full text-left font-sans ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden native input for HTML5 required form validation */}
      <input
        type="text"
        tabIndex={-1}
        name={name}
        id={selectId}
        value={value || ""}
        required={required}
        onChange={() => {}}
        className="opacity-0 pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 -z-10"
        aria-hidden="true"
      />

      {/* Main Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 text-left rounded-lg transition-all border outline-none cursor-pointer select-none ${
          isSmall ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-xs"
        } ${
          error
            ? "border-signal-red focus:border-signal-red focus:ring-2 focus:ring-signal-red/20"
            : isOpen
            ? "border-accent dark:border-accent ring-2 ring-accent/20 dark:ring-accent/30"
            : "border-border dark:border-[#262626] hover:border-slate-400 dark:hover:border-neutral-600 focus:border-accent focus:ring-2 focus:ring-accent/20"
        } ${
          disabled
            ? "bg-slate-100 dark:bg-neutral-900 opacity-60 cursor-not-allowed text-slate-400"
            : "bg-white dark:bg-[#050505] text-ink dark:text-white"
        }`}
      >
        {/* Selected Value display */}
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <span className="shrink-0 text-slate-400">{selectedOption.icon}</span>
              )}
              <span className="truncate font-semibold text-ink dark:text-white">
                {selectedOption.label}
              </span>
              {selectedOption.subLabel && (
                <span className="text-[11px] text-slate-400 dark:text-neutral-400 truncate shrink-0">
                  {selectedOption.subLabel}
                </span>
              )}
              {selectedOption.badge && (
                <span className="ml-auto text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 shrink-0">
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400 dark:text-neutral-500 font-normal truncate">
              {placeholder}
            </span>
          )}
        </div>

        {/* Action icons (Clear + Chevron) */}
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {allowClear && value && !disabled && (
            <span
              onClick={handleClear}
              role="button"
              tabIndex={0}
              title="Clear selection"
              className="p-0.5 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 rounded transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-accent" : "text-slate-400"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#0c0c0c] border border-border dark:border-[#262626] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-72">
          {/* Search Box Header */}
          <div className="p-2 border-b border-border dark:border-[#262626] bg-surface dark:bg-[#111111]/80 sticky top-0 z-10">
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-slate-400 dark:text-neutral-500 pointer-events-none">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg text-ink dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 text-slate-400 hover:text-ink dark:hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
            {/* Quick stats / options counter */}
            {options.length > 5 && (
              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1.5">
                <span>
                  Showing {filteredOptions.length} of {options.length}
                </span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-accent hover:underline cursor-pointer"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            role="listbox"
            className="overflow-y-auto flex-1 p-1 space-y-0.5 overscroll-contain"
          >
            {/* Allow clearing selection if not required */}
            {!required && value && !searchQuery && (
              <div
                data-option-index={-1}
                onClick={() => {
                  onChange("");
                  handleClose();
                  triggerRef.current?.focus();
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs cursor-pointer text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2"
              >
                <span className="text-slate-400">∅</span>
                <span className="italic">None / Clear selection</span>
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 dark:text-neutral-500">
                <p className="font-medium">{emptyMessage}</p>
                {searchQuery && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={opt.value || index}
                    data-option-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectOption(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors flex items-center justify-between gap-2 select-none ${
                      opt.disabled
                        ? "opacity-40 cursor-not-allowed"
                        : isSelected
                        ? "bg-accent/10 dark:bg-accent/20 text-ink dark:text-white font-semibold"
                        : isHighlighted
                        ? "bg-slate-100 dark:bg-[#1a1a1a] text-ink dark:text-white"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#151515]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.icon && (
                        <span className="shrink-0 text-slate-400">{opt.icon}</span>
                      )}
                      <div className="min-w-0 flex-1 truncate">
                        <div className="truncate font-medium flex items-center gap-1.5">
                          <span className={isSelected ? "font-bold" : "font-medium"}>
                            {opt.label}
                          </span>
                          {opt.badge && (
                            <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.subLabel && (
                          <div className="text-[11px] text-slate-400 dark:text-neutral-400 truncate">
                            {opt.subLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected checkmark */}
                    {isSelected && (
                      <span className="text-accent shrink-0 font-bold ml-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
