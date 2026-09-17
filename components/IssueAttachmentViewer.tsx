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
      <div className={`mt-2 pt-2 border-t border-border ${compact ? "space-y-1" : "space-y-1.5"}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-gray-500">
            {items.length > 1 ? `Attachments (${items.length})` : "Attachment"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {items.map((item, index) => {
            const kind = detectType(item);
            const title = item.name || (kind === "image" ? "Screenshot" : kind === "video" ? "Recording" : "Attachment");
            const isLoom = /loom\.com/i.test(item.url);
            const isYoutube = /youtube\.com|youtu\.be/i.test(item.url);

            if (kind === "image") {
              return (
                <div
                  key={index}
                  onClick={() => setLightboxItem(item)}
                  className="group relative cursor-pointer overflow-hidden rounded-md border border-border bg-surface hover:border-accent transition-colors"
                >
                  <img
                    src={item.url}
                    alt={title}
                    className={`${
                      compact ? "h-14 w-20" : "h-20 w-32"
                    } object-cover`}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 bg-white/90 text-ink text-[10px] font-medium rounded shadow-sm">
                      Preview
                    </span>
                  </div>
                </div>
              );
            }

            if (kind === "video") {
              const isExternal = item.url.startsWith("http://") || item.url.startsWith("https://");
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 p-1.5 bg-surface border border-border rounded-md text-[12px]"
                >
                  <span className="text-gray-500 font-medium">Video</span>
                  <span className="font-medium text-ink truncate max-w-xs">{title}</span>
                  {isExternal ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-0.5 bg-accent text-white text-[11px] font-medium rounded hover:bg-blue-700 transition-colors"
                    >
                      Open Link →
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLightboxItem(item)}
                      className="px-2 py-0.5 bg-accent text-white text-[11px] font-medium rounded hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      Play
                    </button>
                  )}
                </div>
              );
            }

            return (
              <a
                key={index}
                href={item.url}
                download={title}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-1.5 bg-surface border border-border rounded-md text-[12px] text-ink hover:text-accent"
              >
                <span className="truncate">{title}</span>
                <span className="text-accent text-[11px]">Download</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* LIGHTBOX MODAL */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-white rounded-lg overflow-hidden border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="px-4 py-3 bg-surface border-b border-border flex items-center justify-between text-ink">
              <p className="text-[13px] font-medium truncate">
                {lightboxItem.name || "Attachment Preview"}
              </p>

              <div className="flex items-center gap-2">
                <a
                  href={lightboxItem.url}
                  download={lightboxItem.name || "attachment"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-100 border border-border rounded"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  className="text-gray-400 hover:text-ink text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content Display */}
            <div className="p-4 flex-1 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)]">
              {detectType(lightboxItem) === "image" ? (
                <img
                  src={lightboxItem.url}
                  alt={lightboxItem.name || "Evidence"}
                  className="max-w-full max-h-[75vh] object-contain rounded"
                />
              ) : detectType(lightboxItem) === "video" ? (
                <video
                  src={lightboxItem.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[75vh] rounded bg-black"
                />
              ) : (
                <div className="text-center p-8 space-y-2">
                  <p className="text-[13px] text-ink font-medium">{lightboxItem.name}</p>
                  <a
                    href={lightboxItem.url}
                    download={lightboxItem.name || "attachment"}
                    className="inline-block px-3.5 py-1.5 bg-accent text-white rounded text-[12px] font-medium"
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
