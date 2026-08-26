import { useState } from "react";
import { FileText, Eye, Maximize2, X, FileImage, Layers } from "lucide-react";
import { FileMeta } from "../types";
import { getFilePreviewUrl } from "../services/api";

interface DocumentPreviewProps {
  sessionId: string;
  file: FileMeta;
}

export function DocumentPreview({ sessionId, file }: DocumentPreviewProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const previewUrl = getFilePreviewUrl(sessionId);
  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";

  const sizeFormatted =
    file.sizeBytes >= 1024 * 1024
      ? `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.sizeBytes / 1024)} KB`;

  return (
    <>
      <div className="mt-4 rounded-card border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-ink">
            {isImage ? <FileImage size={18} className="text-primary" /> : <FileText size={18} className="text-primary" />}
            <span>Document Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-light text-primary-dark">
              {file.detectedPaperSize}
            </span>
            {(isImage || isPdf) && (
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                className="p-1 rounded-lg text-muted hover:text-ink hover:bg-slate-100 transition-colors"
                title="Expand Preview"
              >
                <Maximize2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Live Visual Content Preview */}
        <div className="mt-3 relative rounded-control bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center min-h-[160px] max-h-[260px]">
          {isImage ? (
            <img
              src={previewUrl}
              alt={file.originalName}
              className="max-h-[250px] w-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => setFullscreen(true)}
            />
          ) : isPdf ? (
            <iframe
              src={`${previewUrl}#toolbar=0&navpanes=0`}
              title={file.originalName}
              className="w-full h-[220px] border-0"
            />
          ) : (
            <div className="p-6 text-center">
              <FileText size={42} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-bold text-ink truncate max-w-[240px]">{file.originalName}</p>
              <p className="text-xs text-muted mt-1">{file.pageCount} pages · {file.orientation.toLowerCase()}</p>
            </div>
          )}
        </div>

        {/* File Metadata Badges */}
        <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
          <div className="bg-surface-alt rounded-lg py-1.5 px-2">
            <span className="block text-[10px] text-muted uppercase font-bold">Pages</span>
            <span className="font-display text-xs font-extrabold text-ink">{file.pageCount}</span>
          </div>
          <div className="bg-surface-alt rounded-lg py-1.5 px-2">
            <span className="block text-[10px] text-muted uppercase font-bold">B&amp;W / Color</span>
            <span className="font-display text-xs font-extrabold text-ink">
              {file.bwPageCount} / {file.colorPageCount}
            </span>
          </div>
          <div className="bg-surface-alt rounded-lg py-1.5 px-2">
            <span className="block text-[10px] text-muted uppercase font-bold">Size</span>
            <span className="font-display text-xs font-extrabold text-ink">{sizeFormatted}</span>
          </div>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center justify-between text-white pb-3">
            <span className="font-display font-bold text-sm truncate max-w-[280px]">{file.originalName}</span>
            <button
              onClick={() => setFullscreen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-auto">
            {isImage ? (
              <img src={previewUrl} alt={file.originalName} className="max-h-full max-w-full object-contain rounded-lg" />
            ) : (
              <iframe src={previewUrl} title={file.originalName} className="w-full h-full rounded-lg bg-white" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
