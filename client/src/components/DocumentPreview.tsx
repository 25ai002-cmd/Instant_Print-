import { useEffect, useRef, useState } from "react";
import { FileText, Maximize2, X, FileImage, Loader2, RefreshCw } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { FileMeta } from "../types";
import { getFilePreviewUrl } from "../services/api";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface DocumentPreviewProps {
  sessionId: string;
  file: FileMeta;
}

export function DocumentPreview({ sessionId, file }: DocumentPreviewProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [pdfRenderError, setPdfRenderError] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const previewUrl = getFilePreviewUrl(sessionId);
  const isImage = file.mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.originalName);
  const isPdf = file.mimeType === "application/pdf" || file.originalName.toLowerCase().endsWith(".pdf");
  const isDocx = file.originalName.toLowerCase().endsWith(".docx");
  const isText = /\.(txt|csv|rtf|md|json|log|html)$/i.test(file.originalName);

  const sizeFormatted =
    file.sizeBytes >= 1024 * 1024
      ? `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.sizeBytes / 1024)} KB`;

  // Render PDF using PDF.js onto HTML canvas
  useEffect(() => {
    if (!isPdf) {
      setLoadingPreview(false);
      return;
    }

    let isMounted = true;
    setLoadingPreview(true);
    setPdfRenderError(false);

    (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(previewUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        if (!isMounted) return;

        // Render preview canvas
        if (canvasRef.current) {
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = canvasRef.current;
          const context = canvas.getContext("2d");

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
          }
        }
        setLoadingPreview(false);
      } catch (err) {
        console.warn("PDF.js render fallback:", err);
        if (isMounted) {
          setPdfRenderError(true);
          setLoadingPreview(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isPdf, previewUrl]);

  // Fetch text for text/csv files
  useEffect(() => {
    if (!isText) return;
    fetch(previewUrl)
      .then((res) => res.text())
      .then((text) => setTextContent(text.slice(0, 1500)))
      .catch(() => undefined);
  }, [isText, previewUrl]);

  return (
    <>
      <div className="mt-4 rounded-card border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-ink">
            {isImage ? <FileImage size={18} className="text-primary" /> : <FileText size={18} className="text-primary" />}
            <span className="truncate max-w-[200px]">Document Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary-light text-primary-dark uppercase">
              {file.detectedPaperSize}
            </span>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-slate-100 transition-colors"
              title="Full Preview"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>

        {/* Live Preview Container */}
        <div className="mt-3 relative rounded-control bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center min-h-[180px] max-h-[300px] p-2">
          {loadingPreview && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="animate-spin text-primary mb-2" size={32} />
              <span className="text-xs font-bold text-slate-500">Rendering document preview…</span>
            </div>
          )}

          {/* 1. Image Files */}
          {isImage && (
            <img
              src={previewUrl}
              alt={file.originalName}
              className="max-h-[280px] w-auto object-contain rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => setFullscreen(true)}
              onLoad={() => setLoadingPreview(false)}
            />
          )}

          {/* 2. PDF Canvas Preview */}
          {isPdf && !pdfRenderError && (
            <div className="overflow-auto max-h-[280px] w-full flex justify-center">
              <canvas
                ref={canvasRef}
                onClick={() => setFullscreen(true)}
                className="max-w-full h-auto object-contain rounded border border-slate-200 shadow-sm cursor-pointer"
              />
            </div>
          )}

          {/* PDF Fallback Frame if Canvas is blocked */}
          {isPdf && pdfRenderError && (
            <object data={previewUrl} type="application/pdf" className="w-full h-[240px] rounded">
              <iframe src={`${previewUrl}#toolbar=0`} title={file.originalName} className="w-full h-[240px] border-0" />
            </object>
          )}

          {/* 3. Text / Markdown / CSV Content */}
          {isText && textContent && (
            <div className="w-full h-[220px] bg-white p-4 rounded border border-slate-200 text-xs font-mono text-slate-800 overflow-auto whitespace-pre-wrap">
              {textContent}
            </div>
          )}

          {/* 4. Word DOCX / PPTX / Generic Document Card */}
          {!isImage && !isPdf && (!isText || !textContent) && (
            <div className="p-6 text-center bg-white rounded-control border border-slate-200 w-full shadow-sm">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary-light flex items-center justify-center mb-3">
                <FileText size={28} className="text-primary" />
              </div>
              <p className="text-sm font-bold text-ink truncate max-w-[260px] mx-auto">{file.originalName}</p>
              <p className="text-xs text-muted mt-1 font-semibold">
                {file.pageCount} page{file.pageCount !== 1 ? "s" : ""} · {file.orientation.toLowerCase()} orientation
              </p>
              <span className="inline-block mt-3 px-3 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-full">
                Ready for PrintATM Processing
              </span>
            </div>
          )}
        </div>

        {/* Metadata Badges */}
        <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
          <div className="bg-slate-50 rounded-lg py-1.5 px-2 border border-slate-100">
            <span className="block text-[10px] text-muted uppercase font-bold">Total Pages</span>
            <span className="font-display text-xs font-extrabold text-ink">{file.pageCount}</span>
          </div>
          <div className="bg-slate-50 rounded-lg py-1.5 px-2 border border-slate-100">
            <span className="block text-[10px] text-muted uppercase font-bold">Orientation</span>
            <span className="font-display text-xs font-extrabold text-ink capitalize">{file.orientation.toLowerCase()}</span>
          </div>
          <div className="bg-slate-50 rounded-lg py-1.5 px-2 border border-slate-100">
            <span className="block text-[10px] text-muted uppercase font-bold">File Size</span>
            <span className="font-display text-xs font-extrabold text-ink">{sizeFormatted}</span>
          </div>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4">
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/10">
            <span className="font-display font-bold text-sm truncate max-w-[280px]">{file.originalName}</span>
            <button
              onClick={() => setFullscreen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-auto p-2">
            {isImage ? (
              <img src={previewUrl} alt={file.originalName} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
            ) : isPdf ? (
              <iframe src={previewUrl} title={file.originalName} className="w-full h-full rounded-lg bg-white" />
            ) : (
              <div className="bg-white p-8 rounded-card max-w-md w-full text-center">
                <FileText size={48} className="mx-auto text-primary mb-3" />
                <h3 className="font-bold text-ink text-base">{file.originalName}</h3>
                <p className="text-xs text-muted mt-1">{file.pageCount} pages · {sizeFormatted}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
