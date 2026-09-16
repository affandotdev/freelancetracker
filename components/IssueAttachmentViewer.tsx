"use client";

import React, { useState, useEffect } from "react";

export interface AttachmentData {
  url: string;
  name?: string | null;
  type?: string | null; // "image" | "video" | "file" | "link"
  size?: number | null;
}

interface IssueAttachmentViewerProps {
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  compact?: boolean;
}

export default function IssueAttachmentViewer({
  attachmentUrl,
  attachmentName,
  attachmentType,
  compact = false,
}: IssueAttachmentViewerProps) {
  const [lightboxItem, setLightboxItem] = useState<AttachmentData | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxItem(null);
    };
    if (lightboxItem) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxItem]);

  if (!attachmentUrl) return null;

  // Parse if JSON array or single item
  let items: AttachmentData[] = [];
  if (attachmentUrl.trim().startsWith("[") && attachmentUrl.trim().endsWith("]")) {
    try {
      const parsed = JSON.parse(attachmentUrl);
      if (Array.isArray(parsed)) {
        items = parsed;
      }
    } catch {
      items = [{ url: attachmentUrl, name: attachmentName, type: attachmentType }];
    }
  } else {
    items = [{ url: attachmentUrl, name: attachmentName, type: attachmentType }];
  }

  if (items.length === 0) return null;

  // Helper to determine item media type
  const detectType = (item: AttachmentData) => {
    if (item.type) return item.type;
    const url = item.url.toLowerCase();
    if (url.startsWith("data:image/") || /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url)) return "image";
    if (url.startsWith("data:video/") || /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url)) return "video";
    if (/loom\.com|youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com/i.test(url)) return "video";
    return "file";
  };

  return (
    <>
      <div className={`mt-2.5 pt-2.5 border-t border-slate-100 ${compact ? "space-y-1.5" : "space-y-2"}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 flex items-center gap-1">
            📎 {items.length > 1 ? `Attachments (${items.length})` : "Bug Evidence / Attachment"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {items.map((item, index) => {
            const kind = detectType(item);
            const title = item.name || (kind === "image" ? "Screenshot" : kind === "video" ? "Screen Recording" : "Attachment");
            const isLoom = /loom\.com/i.test(item.url);
            const isYoutube = /youtube\.com|youtu\.be/i.test(item.url);

            if (kind === "image") {
              return (
                <div
                  key={index}
                  onClick={() => setLightboxItem(item)}
                  className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all bg-slate-900/5 hover:border-rose-300"
                >
                  <img
                    src={item.url}
                    alt={title}
                    className={`${
                      compact ? "h-16 w-24" : "h-24 sm:h-28 w-36 sm:w-44"
                    } object-cover group-hover:scale-105 transition-transform duration-200`}
                  />
                  <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/30 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-white/90 text-slate-800 text-[10px] font-bold rounded-lg shadow-sm">
                      🔍 Enlarge
                    </span>
                  </div>
                  <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 bg-slate-900/70 backdrop-blur-xs rounded text-[9px] font-medium text-white truncate">
                    🖼️ {title}
                  </div>
                </div>
              );
            }

            if (kind === "video") {
              // If external video link
              const isExternal = item.url.startsWith("http://") || item.url.startsWith("https://");
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-rose-50/80 hover:bg-rose-100/80 border border-rose-200 rounded-xl transition-colors max-w-full"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    🎥
                  </div>
                  <div className="min-w-0 flex-1 pr-1">
                    <p className="text-xs font-bold text-rose-950 truncate">{title}</p>
                    <p className="text-[10px] text-rose-600 truncate">
                      {isLoom ? "Loom Screen Recording" : isYoutube ? "YouTube Video Demo" : "Video Recording"}
                    </p>
                  </div>
                  {isExternal ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1"
                    >
                      <span>Play</span>
                      <span className="text-[10px]">↗</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLightboxItem(item)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 cursor-pointer"
                    >
                      Watch Video
                    </button>
                  )}
                </div>
              );
            }

            // Generic File or Log
            return (
              <a
                key={index}
                href={item.url}
                download={title}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors max-w-full"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                  📄
                </div>
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-xs font-bold text-slate-800 truncate">{title}</p>
                  <p className="text-[10px] text-slate-400">Click to view / download</p>
                </div>
                <span className="text-xs font-bold text-indigo-600 shrink-0">⬇ Download</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* LIGHTBOX MODAL */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] flex flex-col bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between text-white">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">
                  {detectType(lightboxItem) === "image" ? "🖼️" : "🎥"}
                </span>
                <p className="text-sm font-bold truncate">
                  {lightboxItem.name || "Bug Evidence Preview"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={lightboxItem.url}
                  download={lightboxItem.name || "bug-evidence"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <span>⬇</span>
                  <span className="hidden sm:inline">Save File</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  className="w-8 h-8 rounded-full bg-slate-700/70 hover:bg-slate-600 flex items-center justify-center text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content Display */}
            <div className="p-2 sm:p-4 flex-1 flex items-center justify-center overflow-auto max-h-[calc(92vh-60px)]">
              {detectType(lightboxItem) === "image" ? (
                <img
                  src={lightboxItem.url}
                  alt={lightboxItem.name || "Evidence"}
                  className="max-w-full max-h-[78vh] object-contain rounded-xl shadow-lg"
                />
              ) : detectType(lightboxItem) === "video" ? (
                <video
                  src={lightboxItem.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[78vh] rounded-xl bg-black"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <p className="text-4xl">📄</p>
                  <p className="text-sm text-slate-300 font-bold">{lightboxItem.name}</p>
                  <a
                    href={lightboxItem.url}
                    download={lightboxItem.name || "attachment"}
                    className="inline-block px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
