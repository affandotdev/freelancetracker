"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getNavbarNotificationsAction, NavbarNotification } from "@/lib/actions";

interface NotificationDropdownProps {
  userRole: string;
}

export default function NotificationDropdown({ userRole }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NavbarNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"all" | "meeting" | "bug" | "task">("all");
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load read status from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("workplan_read_notifications");
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.warn("Could not read local notification storage", e);
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await getNavbarNotificationsAction();
      setNotifications(data);
    } catch (err) {
      console.warn("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 45s
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    try {
      localStorage.setItem("workplan_read_notifications", JSON.stringify(Array.from(allIds)));
    } catch (e) {}
  };

  const markItemAsRead = (id: string) => {
    const updated = new Set(readIds);
    updated.add(id);
    setReadIds(updated);
    try {
      localStorage.setItem("workplan_read_notifications", JSON.stringify(Array.from(updated)));
    } catch (e) {}
  };

  const filtered = notifications.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "meeting") return n.type === "meeting";
    if (activeTab === "bug") return n.type === "bug";
    if (activeTab === "task") return n.type === "task" || n.type === "objection";
    return true;
  });

  const getTypeIcon = (type: string, priority?: string) => {
    switch (type) {
      case "meeting":
        return (
          <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 text-xs font-bold">
            M
          </div>
        );
      case "bug":
        return (
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
              priority === "urgent"
                ? "bg-red-100 text-signal-red border border-red-300 animate-pulse"
                : "bg-red-50 text-signal-red border border-red-200"
            }`}
          >
            B
          </div>
        );
      case "objection":
        return (
          <div className="w-7 h-7 rounded-full bg-amber-50 text-signal-amber flex items-center justify-center shrink-0 border border-amber-200 text-xs font-bold">
            !
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-blue-50 text-accent flex items-center justify-center shrink-0 border border-blue-200 text-xs font-bold">
            T
          </div>
        );
    }
  };

  const getRelativeTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins < 2) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-1.5 text-gray-500 hover:text-ink rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        title="Notifications & Updates"
        aria-label="View notifications"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-signal-red text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums shadow-xs animate-in zoom-in duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-surface border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 bg-signal-red/10 text-signal-red text-[10px] font-bold rounded border border-signal-red/20 tabular-nums">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-2 border-b border-border bg-white text-xs">
            {[
              { id: "all" as const, label: "All" },
              { id: "meeting" as const, label: "Meetings" },
              { id: "bug" as const, label: "Bugs" },
              { id: "task" as const, label: "Tasks" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer text-[11px] ${
                  activeTab === tab.id
                    ? "bg-ink text-white font-semibold"
                    : "text-gray-500 hover:text-ink hover:bg-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification Items List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">Loading updates...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs font-semibold text-ink">All caught up!</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  No new assignments, meeting logs, or bug alerts.
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const isRead = readIds.has(item.id);
                return (
                  <Link
                    key={item.id}
                    href={item.link}
                    onClick={() => {
                      markItemAsRead(item.id);
                      setIsOpen(false);
                    }}
                    className={`p-3 block transition-colors hover:bg-surface/75 ${
                      !isRead ? "bg-blue-50/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {getTypeIcon(item.type, item.priority)}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-xs truncate ${
                              !isRead ? "font-bold text-ink" : "font-medium text-gray-700"
                            }`}
                          >
                            {item.title}
                          </span>
                          <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                            {getRelativeTime(item.createdAt)}
                          </span>
                        </div>

                        <p className="text-[11px] text-gray-600 line-clamp-2 mt-0.5 leading-snug">
                          {item.message}
                        </p>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          {item.priority === "urgent" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-signal-red/10 text-signal-red border border-signal-red/20 uppercase">
                              Urgent
                            </span>
                          )}
                          {item.priority === "high" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-signal-amber/10 text-signal-amber border border-signal-amber/20 uppercase">
                              Follow-up
                            </span>
                          )}
                          {item.authorName && (
                            <span className="text-[10px] text-gray-400">
                              By {item.authorName}
                            </span>
                          )}
                        </div>
                      </div>

                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-surface border-t border-border flex items-center justify-between text-[11px]">
            <Link
              href="/meetings"
              onClick={() => setIsOpen(false)}
              className="text-accent font-medium hover:underline"
            >
              Meetings Hub →
            </Link>
            <Link
              href="/issues"
              onClick={() => setIsOpen(false)}
              className="text-gray-500 font-medium hover:text-ink"
            >
              Issues Hub →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
