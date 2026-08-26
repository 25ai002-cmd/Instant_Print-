import { useEffect, useRef, useState } from "react";
import { FileText, Maximize2, X, FileImage, Loader2, Presentation, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { ColorMode, FileMeta, SidesMode } from "../types";
import { getFilePreviewUrl } from "../services/api";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface DocumentPreviewProps {
  sessionId: string;
  file: FileMeta;
  colorMode?: ColorMode;
  sides?: SidesMode;
  selectedPagesCount?: number;
}

export function DocumentPreview({ sessionId, file, colorMode = "BW", sides = "SINGLE", selectedPagesCount }: DocumentPreviewProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [pdfRenderError, setPdfRenderError] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const previewUrl = getFilePreviewUrl(sessionId);
  const ext = file.originalName.toLowerCase().split(".").pop() ?? "";

  const isImage = file.mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext);
  const isPdf = file.mimeType === "application/pdf" || ext === "pdf";
  const isDocx = ["docx", "doc"].includes(ext);
  const isPptx = ["pptx", "ppt"].includes(ext);
  const isExcel = ["xlsx", "xls", "csv"].includes(ext);
  const isText = ["txt", "rtf", "md", "json", "log", "html"].includes(ext);

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

  // Fetch text for text files
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
            {isImage && <FileImage size={18} className="text-primary" />}
            {isPptx && <Presentation size={18} className="text-amber-500" />}
            {isExcel && <FileSpreadsheet size={18} className="text-emerald-600" />}
            {isDocx && <FileText size={18} className="text-blue-600" />}
            {!isImage && !isPptx && !isExcel && !isDocx && <FileText size={18} className="text-primary" />}

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
        <div className="mt-3 relative rounded-control bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center min-h-[190px] max-h-[300px] p-3">
          {loadingPreview && isPdf && (
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
              className="max-h-[280px] w-auto object-contain rounded-lg cursor-pointer hover:opacity-95 transition-opacity shadow-sm"
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

          {/* 3. PowerPoint (.pptx / .ppt) Slide Visual Mock Preview */}
          {isPptx && (
            <div
              onClick={() => setFullscreen(true)}
              className="w-full max-w-sm aspect-[16/9] bg-slate-900 text-white rounded-xl p-4 shadow-lg border-2 border-slate-700 flex flex-col justify-between cursor-pointer hover:border-amber-400 transition-all relative overflow-hidden group"
            >
              <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-xs">
                  <Presentation size={16} />
                  <span>POWERPOINT SLIDE</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  Slide {activeSlide} of {file.pageCount}
                </span>
              </div>

              <div className="my-auto space-y-2">
                <p className="font-display font-bold text-sm text-slate-100 truncate">{file.originalName.replace(/\.[^/.]+$/, "")}</p>
                <div className="space-y-1">
                  <div className="h-1.5 bg-slate-700 rounded w-3/4" />
                  <div className="h-1.5 bg-slate-700 rounded w-1/2" />
                  <div className="h-1.5 bg-slate-700 rounded w-2/3" />
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-800">
                <span>{file.orientation} Presentation</span>
                <span className="text-amber-400 font-bold group-hover:underline">Tap to Open Full Modal Preview</span>
              </div>
            </div>
          )}

          {/* 4. Excel (.xlsx / .xls) Spreadsheet Visual Grid Preview */}
          {isExcel && !isText && (
            <div
              onClick={() => setFullscreen(true)}
              className="w-full h-[210px] bg-white rounded-xl p-3 border-2 border-emerald-500/40 shadow-sm cursor-pointer overflow-hidden flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-xs">
                  <FileSpreadsheet size={16} />
                  <span>EXCEL WORKSHEET</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {file.pageCount} Printable Sheets
                </span>
              </div>

              <div className="my-2 border border-slate-200 rounded overflow-hidden text-[10px]">
                <div className="grid grid-cols-4 bg-slate-100 font-bold text-slate-600 border-b border-slate-200 text-center py-1">
                  <span>A</span>
                  <span>B</span>
                  <span>C</span>
                  <span>D</span>
                </div>
                <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 py-1 text-slate-600 px-1">
                  <span className="font-semibold text-slate-400">1</span>
                  <span>Data</span>
                  <span>Value</span>
                  <span>Total</span>
                </div>
                <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 py-1 text-slate-600 px-1">
                  <span className="font-semibold text-slate-400">2</span>
                  <span>Item A</span>
                  <span>150</span>
                  <span>₹300</span>
                </div>
                <div className="grid grid-cols-4 divide-x divide-slate-100 py-1 text-slate-600 px-1 bg-slate-50/50">
                  <span className="font-semibold text-slate-400">3</span>
                  <span>Item B</span>
                  <span>200</span>
                  <span>₹400</span>
                </div>
              </div>

              <div className="text-[10px] text-emerald-700 font-bold text-center group-hover:underline">
                Tap to Open Full Modal Preview
              </div>
            </div>
          )}

          {/* 5. Word (.docx / .doc) Document Paper Sheet Mock Preview */}
          {isDocx && (
            <div
              onClick={() => setFullscreen(true)}
              className="w-48 h-[220px] bg-white rounded-lg p-4 shadow-md border-2 border-blue-200 flex flex-col justify-between cursor-pointer hover:border-blue-500 transition-all group relative"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-blue-600 text-[10px] font-bold uppercase pb-1 border-b border-blue-100">
                  <FileText size={12} /> Word Document
                </div>
                <p className="font-display text-xs font-bold text-ink truncate">{file.originalName}</p>
                <div className="space-y-1.5 pt-1">
                  <div className="h-1.5 bg-slate-200 rounded w-full" />
                  <div className="h-1.5 bg-slate-200 rounded w-5/6" />
                  <div className="h-1.5 bg-slate-200 rounded w-4/5" />
                  <div className="h-1.5 bg-slate-100 rounded w-full" />
                  <div className="h-1.5 bg-slate-100 rounded w-2/3" />
                </div>
              </div>

              <div className="text-[10px] text-blue-600 font-bold text-center pt-2 border-t border-slate-100 group-hover:underline">
                {file.pageCount} Pages · Tap to Open Modal Preview
              </div>
            </div>
          )}

          {/* 6. Text / Markdown / CSV Content */}
          {isText && textContent && (
            <div
              onClick={() => setFullscreen(true)}
              className="w-full h-[220px] bg-white p-4 rounded border border-slate-200 text-xs font-mono text-slate-800 overflow-auto whitespace-pre-wrap cursor-pointer"
            >
              {textContent}
            </div>
          )}

          {/* 7. Generic Fallback */}
          {!isImage && !isPdf && !isPptx && !isExcel && !isDocx && (!isText || !textContent) && (
            <div onClick={() => setFullscreen(true)} className="p-6 text-center bg-white rounded-control border border-slate-200 w-full shadow-sm cursor-pointer">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary-light flex items-center justify-center mb-3">
                <FileText size={28} className="text-primary" />
              </div>
              <p className="text-sm font-bold text-ink truncate max-w-[260px] mx-auto">{file.originalName}</p>
              <p className="text-xs text-muted mt-1 font-semibold">
                {file.pageCount} page{file.pageCount !== 1 ? "s" : ""} · {file.orientation.toLowerCase()} orientation
              </p>
              <span className="inline-block mt-3 px-3 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-full">
                Tap to Open Full Modal Preview
              </span>
            </div>
          )}
        </div>

        {/* Metadata Badges */}
        <div className="mt-3 grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 text-center">
          <div className="bg-slate-50 rounded-lg py-1.5 px-1 border border-slate-100">
            <span className="block text-[9px] text-muted uppercase font-bold">Pages</span>
            <span className="font-display text-[11px] font-extrabold text-ink">
              {selectedPagesCount !== undefined ? `${selectedPagesCount}/${file.pageCount}` : `${file.pageCount}`}
            </span>
          </div>
          <div className="bg-slate-50 rounded-lg py-1.5 px-1 border border-slate-100">
            <span className="block text-[9px] text-muted uppercase font-bold">Color</span>
            <span className="font-display text-[11px] font-extrabold text-primary">
              {colorMode === "COLOR" ? "Color" : "B & W"}
            </span>
          </div>
          <div className="bg-slate-50 rounded-lg py-1.5 px-1 border border-slate-100">
            <span className="block text-[9px] text-muted uppercase font-bold">Sides</span>
            <span className="font-display text-[11px] font-extrabold text-emerald-600">
              {sides === "DOUBLE" ? "Double" : "Single"}
            </span>
          </div>
          <div className="bg-slate-50 rounded-lg py-1.5 px-1 border border-slate-100">
            <span className="block text-[9px] text-muted uppercase font-bold">Size</span>
            <span className="font-display text-[11px] font-extrabold text-ink">{sizeFormatted}</span>
          </div>
        </div>
      </div>

      {/* Fullscreen Document Preview Modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4">
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm truncate max-w-[240px]">{file.originalName}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white/20 text-white font-semibold">
                {file.pageCount} pgs
              </span>
            </div>
            <button
              onClick={() => setFullscreen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-auto p-2">
            {/* 1. Image Fullscreen */}
            {isImage && (
              <img src={previewUrl} alt={file.originalName} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
            )}

            {/* 2. PDF Fullscreen */}
            {isPdf && (
              <iframe src={previewUrl} title={file.originalName} className="w-full h-full rounded-lg bg-white shadow-2xl" />
            )}

            {/* 3. PowerPoint Interactive Slide Modal Viewer */}
            {isPptx && (
              <div className="w-full max-w-2xl bg-slate-900 text-white rounded-2xl p-6 shadow-2xl border border-slate-700 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Presentation size={20} />
                    <span>PowerPoint Slide Presentation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveSlide((s) => Math.max(1, s - 1))}
                      disabled={activeSlide === 1}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-xs font-bold text-slate-300">
                      Slide {activeSlide} / {file.pageCount}
                    </span>
                    <button
                      onClick={() => setActiveSlide((s) => Math.min(file.pageCount, s + 1))}
                      disabled={activeSlide === file.pageCount}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                <div className="my-8 space-y-4">
                  <h3 className="font-display text-xl font-extrabold text-amber-400">
                    {file.originalName.replace(/\.[^/.]+$/, "")} — Slide #{activeSlide}
                  </h3>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-800 rounded w-5/6" />
                    <div className="h-3 bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-800 rounded w-2/3" />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
                  <span>Size: {sizeFormatted}</span>
                  <span className="text-emerald-400 font-bold">Ready to Print at Kiosk</span>
                </div>
              </div>
            )}

            {/* 4. Excel Interactive Spreadsheet Modal Viewer */}
            {isExcel && !isText && (
              <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl border border-emerald-200 flex flex-col justify-between max-h-[85vh] overflow-auto">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                    <FileSpreadsheet size={20} />
                    <span>Excel Spreadsheet Preview</span>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded bg-emerald-100 text-emerald-800">
                    {file.pageCount} Printable Worksheets
                  </span>
                </div>

                <div className="my-4 border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <div className="grid grid-cols-5 bg-slate-100 font-bold text-slate-700 border-b border-slate-200 text-center py-2">
                    <span>#</span>
                    <span>Column A</span>
                    <span>Column B</span>
                    <span>Column C</span>
                    <span>Column D</span>
                  </div>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((row) => (
                    <div key={row} className="grid grid-cols-5 divide-x divide-slate-100 border-b border-slate-100 py-2 text-slate-700 px-2 text-center">
                      <span className="font-semibold text-slate-400">{row}</span>
                      <span>Row Entry {row}</span>
                      <span>₹{(row * 150).toFixed(2)}</span>
                      <span>Category {row}</span>
                      <span className="text-emerald-600 font-bold">Active</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 flex justify-between">
                  <span>Filename: {file.originalName}</span>
                  <span className="text-emerald-700 font-bold">Formulas &amp; Sheets Analyzed</span>
                </div>
              </div>
            )}

            {/* 5. Word DOCX Modal Viewer */}
            {isDocx && (
              <div className="w-full max-w-xl bg-white rounded-2xl p-8 shadow-2xl border border-blue-200 flex flex-col justify-between max-h-[85vh] overflow-auto">
                <div className="pb-3 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                    <FileText size={20} />
                    <span>Microsoft Word Document</span>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {file.pageCount} Pages
                  </span>
                </div>

                <div className="my-6 space-y-3 text-slate-700 text-sm">
                  <h2 className="font-display font-bold text-lg text-ink">{file.originalName}</h2>
                  <p className="text-xs text-slate-500">Document Structure &amp; Layout Preserved for Kiosk Spooler</p>
                  <div className="space-y-2 pt-2">
                    <div className="h-2 bg-slate-200 rounded w-full" />
                    <div className="h-2 bg-slate-200 rounded w-11/12" />
                    <div className="h-2 bg-slate-200 rounded w-4/5" />
                    <div className="h-2 bg-slate-100 rounded w-full" />
                    <div className="h-2 bg-slate-100 rounded w-3/4" />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                  <span>Size: {sizeFormatted}</span>
                  <span className="text-blue-600 font-bold">Ready for Printing</span>
                </div>
              </div>
            )}

            {/* 6. Text Modal Viewer */}
            {isText && textContent && (
              <div className="w-full max-w-xl bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-2xl border border-slate-700 font-mono text-xs overflow-auto max-h-[80vh] whitespace-pre-wrap">
                {textContent}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
