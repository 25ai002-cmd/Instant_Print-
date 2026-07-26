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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.90)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '12px',
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '940px',
        height: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
        border: '1px solid #334155',
      }}>
        {/* Sleek Executive Header Bar */}
        <div style={{
          backgroundColor: '#0f172a',
          color: 'white',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #475569',
            }}>
              {isImg ? <ImageIcon size={20} color="#38bdf8" /> : <FileText size={20} color="#38bdf8" />}
            </div>
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 700,
                margin: 0,
                color: '#f8fafc',
                fontFamily: 'var(--font-heading)',
              }}>
                {activeFile.fileName}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                  Print Preview
                </span>
                <span style={{ color: '#475569' }}>•</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#38bdf8',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                }}>
                  {totalDocPages} Page{totalDocPages > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* High-Res Preview: convert DOCX to PDF on server for 100% fidelity watermarks & boxes */}
            {isDocx && !effectivePdfUrl && (
              <button
                onClick={convertAndPreview}
                disabled={isConverting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: isConverting ? '#334155' : '#1e293b',
                  color: isConverting ? '#64748b' : '#38bdf8',
                  border: '1px solid #334155',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: isConverting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                title="Convert to PDF for pixel-perfect preview with all watermarks & boxes"
              >
                {isConverting ? (
                  <><Loader2 size={14} className="animate-spin" /> Converting...</>
                ) : (
                  <><Monitor size={14} /> High-Res Preview</>
                )}
              </button>
            )}
            {isDocx && effectivePdfUrl && (
              <span style={{
                fontSize: '12px', fontWeight: 700, color: '#22c55e',
                backgroundColor: 'rgba(34,197,94,0.1)', padding: '4px 12px',
                borderRadius: '99px', border: '1px solid rgba(34,197,94,0.2)',
              }}>
                ✓ PDF Preview Active
              </span>
            )}

            {/* Zoom Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid #334155',
            }}>
              <button
                onClick={() => setZoomScale(Math.max(60, zoomScale - 10))}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#cbd5e1',
                  padding: '6px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', minWidth: '42px', textAlign: 'center' }}>
                {zoomScale}%
              </span>
              <button
                onClick={() => setZoomScale(Math.min(150, zoomScale + 10))}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#cbd5e1',
                  padding: '6px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              {zoomScale !== 100 && (
                <button
                  onClick={() => setZoomScale(100)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#94a3b8',
                    padding: '6px',
                    cursor: 'pointer',
                  }}
                  title="Reset Zoom"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              style={{
                background: '#1e293b',
                color: '#cbd5e1',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: '1px solid #334155',
                transition: 'all 0.2s',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Multi-File Tab Bar if multiple files */}
        {files.length > 1 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #334155',
            overflowX: 'auto',
          }}>
            {files.map((file, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedFileIdx(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: selectedFileIdx === idx ? '#38bdf8' : '#334155',
                  backgroundColor: selectedFileIdx === idx ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                  color: selectedFileIdx === idx ? '#38bdf8' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.mimeType?.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                {file.fileName}
              </button>
            ))}
          </div>
        )}

        {/* Main Document Scroll Canvas */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isShowingPdf ? 'stretch' : 'flex-start',
          backgroundColor: '#1e293b',
          position: 'relative',
        }}>
          {isShowingPdf ? (
            /* Real Native PDF Viewer Embed — also used for converted DOCX→PDF with watermarks */
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
              filter: isBwMode ? 'grayscale(100%)' : 'none',
              transform: `scale(${zoomScale / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
            }}>
              <iframe
                src={(() => {
                  const url = effectivePdfUrl || activeUrl;
                  return url.startsWith('blob:') ? url : `${url}#toolbar=0&navpanes=0&scrollbar=1`;
                })()}
                title={activeFile.fileName}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '560px',
                  border: 'none',
                  backgroundColor: '#ffffff',
                }}
              />
            </div>
          ) : isShowingDocx ? (
            /* Microsoft Office Web Viewer for 100% Exact Word Rendering with Watermarks & Boxes */
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
              filter: isBwMode ? 'grayscale(100%)' : 'none',
            }}>
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(activeUrl)}`}
                title={activeFile.fileName}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '560px',
                  border: 'none',
                  backgroundColor: '#ffffff',
                }}
              />
            </div>
          ) : isDocx ? (
            /* Real DOCX Word Document Rendered Pages (Headers, Footers, Watermarks & Boxes Enabled) */
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
                  fontSize: '14px',
                  fontWeight: 600,
                }}>
                  <Loader2 className="animate-spin" size={22} color="#38bdf8" />
                  Rendering Word Document & Watermarks...
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
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
                  maxHeight: '75vh',
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
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              filter: isBwMode ? 'grayscale(100%)' : 'none',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                borderBottom: '2px solid #0f172a',
                paddingBottom: '16px',
                marginBottom: '20px',
              }}>
                <FileText size={32} color="#0066cc" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{activeFile.fileName}</h4>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                    {activeFile.mimeType || 'Document'} • {totalDocPages} Page(s)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Executive Bottom Dock (Printer Info + Sleek Confirm & Print Button) */}
        <div style={{
          backgroundColor: '#0f172a',
          color: 'white',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #334155',
          gap: '20px',
        }}>
          {/* Printer Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Printer size={22} color="#38bdf8" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                Brother DCP-L2531DW
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                Plain Paper, {settings.paperSize || 'A4'} • {settings.colorMode === 'bw' ? 'Black & White' : 'Color'} • {settings.sides === 'double' ? 'Double-Sided' : 'Single-Sided'}
              </div>
            </div>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                style={{
                  background: '#1e293b',
                  color: '#94a3b8',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #334155',
                  marginLeft: '8px',
                }}
                title="Printer Settings"
              >
                <SettingsIcon size={18} />
              </button>
            )}
          </div>

          {/* Sleek High-Contrast Confirm & Print Button */}
          <button
            onClick={() => {
              onClose();
              if (onConfirmPrint) {
                onConfirmPrint();
              }
            }}
            style={{
              backgroundColor: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 32px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            CONFIRM & PRINT
          </button>
        </div>
      </div>
    </div>
  );
};
