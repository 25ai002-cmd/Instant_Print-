import React, { useState, useEffect, useRef } from 'react';
import { X, Settings as SettingsIcon, Printer, FileText, Image as ImageIcon, Loader2, ZoomIn, ZoomOut, RotateCcw, Monitor } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { apiService } from '../services/api.js';
import type { PrintSettings } from '../types/index.js';

export interface PreviewFileItem {
  id?: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  pageCount?: number;
  url?: string;
  previewUrl?: string;
  fileObj?: File;
}

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: PreviewFileItem[];
  settings?: PrintSettings;
  initialFileIndex?: number;
  onConfirmPrint?: () => void;
  onOpenSettings?: () => void;
  sessionId?: string;
}

/**
 * Fast client-side PDF page counter directly from PDF binary buffer
 */
async function getPdfPageCount(file: File | Blob | string): Promise<number | null> {
  try {
    let buffer: ArrayBuffer;
    if (typeof file === 'string') {
      const res = await fetch(file);
      buffer = await res.arrayBuffer();
    } else {
      buffer = await file.arrayBuffer();
    }
    const text = new TextDecoder('latin1').decode(new Uint8Array(buffer));

    // 1. Search for /Count N in PDF catalog
    const countMatches = Array.from(text.matchAll(/\/Count\s+(\d+)/g));
    if (countMatches.length > 0) {
      const counts = countMatches.map((m) => parseInt(m[1], 10)).filter((n) => !isNaN(n) && n > 0);
      if (counts.length > 0) {
        return Math.max(...counts);
      }
    }

    // 2. Fallback: count /Type /Page objects
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }
  } catch (e) {
    console.warn('[PDF Page Counter Note]:', e);
  }
  return null;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  files,
  settings = { copies: 1, colorMode: 'bw', sides: 'single', paperSize: 'A4' },
  initialFileIndex = 0,
  onConfirmPrint,
  onOpenSettings,
  sessionId,
}) => {
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(initialFileIndex);
  const [objectUrls, setObjectUrls] = useState<Record<number, string>>({});
  const [isDocxRendering, setIsDocxRendering] = useState<boolean>(false);
  const [renderedDocxPages, setRenderedDocxPages] = useState<number | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [useOfficeEngine, setUseOfficeEngine] = useState<boolean>(false);
  const [convertedPdfUrl, setConvertedPdfUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(100);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !files.length) return;

    setSelectedFileIdx(Math.min(initialFileIndex, files.length - 1));

    const urls: Record<number, string> = {};
    files.forEach((file, idx) => {
      if (file.fileObj) {
        urls[idx] = URL.createObjectURL(file.fileObj);
      } else if (file.previewUrl || file.url) {
        urls[idx] = file.previewUrl || file.url || '';
      }
    });

    setObjectUrls(urls);

    return () => {
      Object.values(urls).forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [isOpen, files, initialFileIndex]);

  const activeFile = files[selectedFileIdx] || files[0];
  let activeUrl = objectUrls[selectedFileIdx] || activeFile?.previewUrl || activeFile?.url || '';

  // Keep /uploads paths as relative URLs so Vite's proxy handles them.
  // Only resolve to absolute if we have an explicit external VITE_API_URL env var.
  if (activeUrl && !activeUrl.startsWith('blob:') && !activeUrl.startsWith('http://') && !activeUrl.startsWith('https://')) {
    const externalApiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
    if (externalApiUrl) {
      const cleanedBase = externalApiUrl.replace(/\/api\/?$/, '');
      activeUrl = `${cleanedBase}${activeUrl.startsWith('/') ? '' : '/'}${activeUrl}`;
    }
    // else: leave as relative path (e.g. /uploads/...) — Vite proxy forwards to backend
  }

  const isImg = activeFile?.mimeType?.startsWith('image/') ||
    activeFile?.fileName?.match(/\.(png|jpe?g|webp|gif|bmp)$/i);
  const isPdf = activeFile?.mimeType === 'application/pdf' ||
    activeFile?.fileName?.toLowerCase().endsWith('.pdf');
  const isDocx = activeFile?.mimeType?.includes('wordprocessingml') ||
    activeFile?.fileName?.toLowerCase().endsWith('.docx');

  const isOnlineUrl = activeUrl.startsWith('http://') || activeUrl.startsWith('https://');

  // Effective URL — use converted PDF URL if available (keep as relative path for Vite proxy)
  const effectivePdfUrl = convertedPdfUrl
    ? (() => {
        const externalBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
        if (externalBase) {
          return `${externalBase.replace(/\/api\/?$/, '')}${convertedPdfUrl}`;
        }
        // Relative URL — Vite proxy handles /uploads routing
        return convertedPdfUrl;
      })()
    : null;

  const isShowingPdf = !!effectivePdfUrl || (isPdf && !!activeUrl);
  const isShowingDocx = isDocx && !effectivePdfUrl;

  // On-demand convert to PDF for pixel-perfect preview (watermarks, boxes, etc.)
  const convertAndPreview = async () => {
    if (!sessionId || !activeFile?.id) return;
    setIsConverting(true);
    try {
      const result = await apiService.convertPreview(sessionId, activeFile.id);
      if (result.pdfUrl) {
        setConvertedPdfUrl(result.pdfUrl);
      }
    } catch (err) {
      console.warn('[ConvertPreview] Error:', err);
    } finally {
      setIsConverting(false);
    }
  };

  // Reset converted PDF when switching files
  useEffect(() => {
    setConvertedPdfUrl(null);
  }, [selectedFileIdx]);

  // Extract PDF page count on client
  useEffect(() => {
    if (isPdf && (activeFile?.fileObj || activeUrl)) {
      const target = activeFile.fileObj || activeUrl;
      getPdfPageCount(target).then((count) => {
        if (count && count > 0) {
          setPdfPageCount(count);
        }
      });
    } else {
      setPdfPageCount(null);
    }
  }, [selectedFileIdx, activeFile, activeUrl, isPdf]);

  // Render DOCX file with headers, footers, watermarks, shapes & borders enabled
  useEffect(() => {
    if (isDocx && docxContainerRef.current && !useOfficeEngine && (activeFile?.fileObj || activeUrl)) {
      setIsDocxRendering(true);
      setRenderedDocxPages(null);
      const targetContainer = docxContainerRef.current;
      targetContainer.innerHTML = '';

      const getBuffer = (): Promise<ArrayBuffer> => {
        if (activeFile?.fileObj) {
          return activeFile.fileObj.arrayBuffer();
        }
        // Fetch from server when no local fileObj (e.g. after upload)
        return fetch(activeUrl).then((r) => {
          if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
          return r.arrayBuffer();
        });
      };

      getBuffer()
        .then((buffer) => {
          return renderAsync(buffer, targetContainer, undefined, {
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            className: 'docx-preview-sheet-wrapper',
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
            experimental: true,
          } as any);
        })
        .then(() => {
          const count = targetContainer.querySelectorAll('section').length;
          if (count > 0) setRenderedDocxPages(count);
        })
        .catch((err) => console.warn('[DOCX Render Warning]:', err))
        .finally(() => setIsDocxRendering(false));
    }
  }, [selectedFileIdx, activeFile, activeUrl, isDocx, useOfficeEngine]);

  if (!isOpen || !files.length || !activeFile) return null;

  const totalDocPages = pdfPageCount || renderedDocxPages || activeFile?.pageCount || 1;
  const isBwMode = settings.colorMode === 'bw';

  return (
    <>
      {/* Inject responsive styles */}
      <style>{`
        .preview-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 8px;
        }

        .preview-modal-box {
          background-color: #0f172a;
          border-radius: 16px;
          width: 100%;
          max-width: 940px;
          height: 96vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 60px -15px rgba(0,0,0,0.7);
          overflow: hidden;
          border: 1px solid #334155;
        }

        /* ── Header ── */
        .preview-header {
          background-color: #0f172a;
          color: white;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #334155;
          gap: 8px;
          flex-shrink: 0;
        }

        .preview-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }

        .preview-header-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background-color: #1e293b;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #475569;
          flex-shrink: 0;
        }

        .preview-header-title {
          font-size: 15px;
          font-weight: 700;
          margin: 0;
          color: #f8fafc;
          font-family: var(--font-heading);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }

        .preview-header-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
          flex-wrap: wrap;
        }

        .preview-header-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .preview-zoom-group {
          display: flex;
          align-items: center;
          background-color: #1e293b;
          border-radius: 8px;
          padding: 2px;
          border: 1px solid #334155;
        }

        .preview-zoom-btn {
          border: none;
          background: none;
          color: #cbd5e1;
          padding: 5px;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
        }

        .preview-zoom-label {
          font-size: 11px;
          font-weight: 700;
          color: #e2e8f0;
          min-width: 36px;
          text-align: center;
        }

        .preview-close-btn {
          background: #1e293b;
          color: #cbd5e1;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid #334155;
          transition: all 0.2s;
          flex-shrink: 0;
          touch-action: manipulation;
        }

        /* ── Tab bar ── */
        .preview-tab-bar {
          display: flex;
          gap: 6px;
          padding: 8px 14px;
          background-color: #1e293b;
          border-bottom: 1px solid #334155;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          flex-shrink: 0;
        }

        .preview-tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 8px;
          border: 1px solid;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          touch-action: manipulation;
        }

        /* ── Canvas ── */
        .preview-canvas {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          background-color: #1e293b;
          position: relative;
          min-height: 0;
        }

        .preview-canvas.pdf-mode {
          padding: 0;
        }

        .preview-pdf-wrapper {
          width: 100%;
          height: 100%;
          border-radius: 0;
          overflow: hidden;
          background-color: #ffffff;
          box-shadow: 0 15px 35px rgba(0,0,0,0.6);
        }

        .preview-iframe {
          width: 100%;
          height: 100%;
          border: none;
          background-color: #ffffff;
          display: block;
        }

        /* ── Bottom dock ── */
        .preview-dock {
          background-color: #0f172a;
          color: white;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid #334155;
          gap: 12px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        .preview-dock-info {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }

        .preview-dock-printer-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background-color: #1e293b;
          border: 1px solid #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .preview-dock-printer-name {
          font-size: 13px;
          font-weight: 700;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .preview-dock-printer-sub {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .preview-confirm-btn {
          background-color: #16a34a;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 11px 22px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(22, 163, 74, 0.4);
          transition: all 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
          touch-action: manipulation;
        }

        .preview-highres-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          border: 1px solid #334155;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          touch-action: manipulation;
        }

        /* ── Mobile breakpoint ── */
        @media (max-width: 480px) {
          .preview-modal-overlay {
            padding: 0;
            align-items: flex-end;
          }

          .preview-modal-box {
            height: 98vh;
            border-radius: 20px 20px 0 0;
            max-width: 100%;
          }

          .preview-header {
            padding: 10px 12px;
          }

          .preview-header-title {
            font-size: 13px;
            max-width: 120px;
          }

          /* Hide zoom controls on very small screens to save space */
          .preview-zoom-group {
            display: none;
          }

          .preview-canvas {
            padding: 0;
          }

          .preview-canvas.pdf-mode {
            padding: 0;
          }

          .preview-pdf-wrapper {
            border-radius: 0;
          }

          .preview-dock {
            padding: 10px 12px;
            gap: 8px;
          }

          .preview-dock-printer-name {
            font-size: 12px;
          }

          .preview-dock-printer-sub {
            font-size: 10px;
          }

          .preview-confirm-btn {
            padding: 10px 18px;
            font-size: 13px;
          }

          .preview-highres-btn {
            font-size: 10px;
            padding: 4px 8px;
          }
        }

        @media (max-width: 360px) {
          .preview-header-title {
            max-width: 90px;
          }

          .preview-header-icon {
            display: none;
          }
        }
      `}</style>

      <div className="preview-modal-overlay">
        <div className="preview-modal-box">
          {/* Sleek Executive Header Bar */}
          <div className="preview-header">
            <div className="preview-header-left">
              <div className="preview-header-icon">
                {isImg ? <ImageIcon size={18} color="#38bdf8" /> : <FileText size={18} color="#38bdf8" />}
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 className="preview-header-title">{activeFile.fileName}</h3>
                <div className="preview-header-meta">
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Preview</span>
                  <span style={{ color: '#475569' }}>•</span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    padding: '2px 7px',
                    borderRadius: '99px',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                  }}>
                    {totalDocPages}pg
                  </span>
                </div>
              </div>
            </div>

            <div className="preview-header-right">
              {/* High-Res Preview button */}
              {isDocx && !effectivePdfUrl && (
                <button
                  onClick={convertAndPreview}
                  disabled={isConverting}
                  className="preview-highres-btn"
                  style={{
                    backgroundColor: isConverting ? '#334155' : '#1e293b',
                    color: isConverting ? '#64748b' : '#38bdf8',
                  }}
                  title="Convert to PDF for pixel-perfect preview"
                >
                  {isConverting ? (
                    <><Loader2 size={12} className="animate-spin" />Converting</>
                  ) : (
                    <><Monitor size={12} />Hi-Res</>
                  )}
                </button>
              )}
              {isDocx && effectivePdfUrl && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, color: '#22c55e',
                  backgroundColor: 'rgba(34,197,94,0.1)', padding: '3px 8px',
                  borderRadius: '99px', border: '1px solid rgba(34,197,94,0.2)',
                }}>
                  ✓ PDF
                </span>
              )}

              {/* Zoom Controls */}
              <div className="preview-zoom-group">
                <button
                  onClick={() => setZoomScale(Math.max(60, zoomScale - 10))}
                  className="preview-zoom-btn"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="preview-zoom-label">{zoomScale}%</span>
                <button
                  onClick={() => setZoomScale(Math.min(150, zoomScale + 10))}
                  className="preview-zoom-btn"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                {zoomScale !== 100 && (
                  <button
                    onClick={() => setZoomScale(100)}
                    className="preview-zoom-btn"
                    title="Reset Zoom"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>

              <button onClick={onClose} className="preview-close-btn">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Multi-File Tab Bar if multiple files */}
          {files.length > 1 && (
            <div className="preview-tab-bar">
              {files.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFileIdx(idx)}
                  className="preview-tab-btn"
                  style={{
                    borderColor: selectedFileIdx === idx ? '#38bdf8' : '#334155',
                    backgroundColor: selectedFileIdx === idx ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                    color: selectedFileIdx === idx ? '#38bdf8' : '#94a3b8',
                  }}
                >
                  {file.mimeType?.startsWith('image/') ? <ImageIcon size={12} /> : <FileText size={12} />}
                  {file.fileName}
                </button>
              ))}
            </div>
          )}

          {/* Main Document Scroll Canvas */}
          <div className={`preview-canvas${isShowingPdf ? ' pdf-mode' : ''}`}>
            {isShowingPdf ? (
              /* Real Native PDF Viewer Embed — also used for converted DOCX→PDF with watermarks */
              <div
                className="preview-pdf-wrapper"
                style={{
                  filter: isBwMode ? 'grayscale(100%)' : 'none',
                  transform: `scale(${zoomScale / 100})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease',
                }}
              >
                <iframe
                  src={(() => {
                    const url = effectivePdfUrl || activeUrl;
                    return url.startsWith('blob:') ? url : `${url}#toolbar=0&navpanes=0&scrollbar=1`;
                  })()}
                  title={activeFile.fileName}
                  className="preview-iframe"
                  style={{ minHeight: '100%' }}
                />
              </div>
            ) : isShowingDocx ? (
              /* Microsoft Office Web Viewer for 100% Exact Word Rendering */
              <div
                className="preview-pdf-wrapper"
                style={{ filter: isBwMode ? 'grayscale(100%)' : 'none' }}
              >
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(activeUrl)}`}
                  title={activeFile.fileName}
                  className="preview-iframe"
                  style={{ minHeight: '100%' }}
                />
              </div>
            ) : isDocx ? (
              /* Real DOCX Word Document Rendered Pages */
              <div style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                transform: `scale(${zoomScale / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease',
              }}>
                {isDocxRendering && (
                  <div style={{
                    padding: '32px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}>
                    <Loader2 className="animate-spin" size={20} color="#38bdf8" />
                    Rendering Document...
                  </div>
                )}
                <div
                  ref={docxContainerRef}
                  style={{
                    width: '100%',
                    maxWidth: '820px',
                    filter: isBwMode ? 'grayscale(100%)' : 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ) : isImg && activeUrl ? (
              /* Real Image Preview Sheet */
              <div style={{
                maxWidth: '100%',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                filter: isBwMode ? 'grayscale(100%)' : 'none',
                transform: `scale(${zoomScale / 100})`,
                transformOrigin: 'top center',
              }}>
                <img
                  src={activeUrl}
                  alt={activeFile.fileName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    borderRadius: '4px',
                  }}
                />
              </div>
            ) : (
              /* General Presentation Preview Card */
              <div style={{
                width: '100%',
                maxWidth: '540px',
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                filter: isBwMode ? 'grayscale(100%)' : 'none',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  borderBottom: '2px solid #0f172a',
                  paddingBottom: '14px',
                  marginBottom: '16px',
                }}>
                  <FileText size={28} color="#0066cc" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{activeFile.fileName}</h4>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                      {activeFile.mimeType || 'Document'} • {totalDocPages} Page(s)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Executive Bottom Dock */}
          <div className="preview-dock">
            {/* Printer Info */}
            <div className="preview-dock-info">
              <div className="preview-dock-printer-icon">
                <Printer size={20} color="#38bdf8" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="preview-dock-printer-name">Brother DCP-L2531DW</div>
                <div className="preview-dock-printer-sub">
                  {settings.paperSize || 'A4'} • {settings.colorMode === 'bw' ? 'B&W' : 'Color'} • {settings.sides === 'double' ? 'Duplex' : 'Single'}
                </div>
              </div>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  style={{
                    background: '#1e293b',
                    color: '#94a3b8',
                    borderRadius: '8px',
                    padding: '7px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #334155',
                    marginLeft: '4px',
                    flexShrink: 0,
                  }}
                  title="Printer Settings"
                >
                  <SettingsIcon size={16} />
                </button>
              )}
            </div>

            {/* Confirm & Print Button */}
            <button
              onClick={() => {
                onClose();
                if (onConfirmPrint) {
                  onConfirmPrint();
                }
              }}
              className="preview-confirm-btn"
            >
              CONFIRM & PRINT
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
