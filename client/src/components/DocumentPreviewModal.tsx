import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  FileText,
  Image as ImageIcon,
  Grid,
  Layers,
  CheckCircle2,
  ListFilter,
} from 'lucide-react';
import type { PrintSettings, PageRange } from '../types/index.js';

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
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  files,
  settings = { copies: 1, colorMode: 'bw', sides: 'single', paperSize: 'A4' },
  initialFileIndex = 0,
}) => {
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(initialFileIndex);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [singlePageView, setSinglePageView] = useState<number>(1);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Sync selected index when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedFileIdx(Math.min(initialFileIndex, files.length - 1));
      setZoomLevel(100);
      setViewMode('continuous');
      setSinglePageView(1);
      setShowThumbnails(false);
    }
  }, [isOpen, initialFileIndex, files.length]);

  const activeFile = files[selectedFileIdx] || files[0];

  // Generate object URL for raw browser File object if available
  useEffect(() => {
    if (activeFile?.fileObj) {
      const url = URL.createObjectURL(activeFile.fileObj);
      setObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setObjectUrl(activeFile?.previewUrl || activeFile?.url || null);
    }
  }, [activeFile]);

  // Determine total pages & allowed pages list based on settings.pageRanges
  const rawTotalPages = activeFile?.pageCount || 1;

  const validPagesList = useMemo(() => {
    if (!settings.pageRanges || settings.pageRanges.length === 0) {
      return Array.from({ length: rawTotalPages }, (_, i) => i + 1);
    }

    const pagesSet = new Set<number>();
    settings.pageRanges.forEach((range: PageRange) => {
      for (let p = Math.max(1, range.from); p <= Math.min(rawTotalPages, range.to); p++) {
        pagesSet.add(p);
      }
    });

    const list = Array.from(pagesSet).sort((a, b) => a - b);
    return list.length > 0 ? list : Array.from({ length: rawTotalPages }, (_, i) => i + 1);
  }, [settings.pageRanges, rawTotalPages]);

  if (!isOpen || !activeFile) return null;

  const isImage = activeFile.mimeType?.startsWith('image/') ||
    activeFile.fileName.match(/\.(png|jpe?g|webp|gif|bmp)$/i);

  const isBwMode = settings.colorMode === 'bw';
  const isDoubleSided = settings.sides === 'double';

  const pagesToRender = viewMode === 'continuous' ? validPagesList : [singlePageView];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '12px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}>
              <Eye size={20} />
            </div>
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: 0,
                fontFamily: 'var(--font-heading)',
              }}>
                Document Print Preview
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Showing all pages sequentially (First page, second page below)
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: '#e2e8f0',
              color: '#475569',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Multi-File Tab Bar if multiple files */}
        {files.length > 1 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '8px 20px',
            backgroundColor: '#f1f5f9',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
          }}>
            {files.map((file, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedFileIdx(idx);
                  setSinglePageView(1);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '99px',
                  border: '1px solid',
                  borderColor: selectedFileIdx === idx ? 'var(--primary)' : 'var(--border)',
                  backgroundColor: selectedFileIdx === idx ? 'var(--primary)' : 'white',
                  color: selectedFileIdx === idx ? 'white' : 'var(--text-secondary)',
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

        {/* Top Control Bar (Layout Toggle, Zoom & Live Settings Badges) */}
        <div style={{
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          {/* View Mode & Page Count Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="pill-group" style={{ margin: 0 }}>
              <button
                onClick={() => setViewMode('continuous')}
                className={`pill-btn ${viewMode === 'continuous' ? 'active' : ''}`}
                style={{ padding: '5px 12px', fontSize: '12px' }}
              >
                <ListFilter size={13} style={{ marginRight: '4px' }} /> All Pages Scroll
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={`pill-btn ${viewMode === 'single' ? 'active' : ''}`}
                style={{ padding: '5px 12px', fontSize: '12px' }}
              >
                Single Page
              </button>
            </div>

            {viewMode === 'single' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => setSinglePageView((p) => Math.max(1, p - 1))}
                  disabled={singlePageView <= 1}
                  style={{ border: '1px solid var(--border)', background: 'white', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>
                  P.{singlePageView} / {rawTotalPages}
                </span>
                <button
                  onClick={() => setSinglePageView((p) => Math.min(rawTotalPages, p + 1))}
                  disabled={singlePageView >= rawTotalPages}
                  style={{ border: '1px solid var(--border)', background: 'white', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Total: {validPagesList.length} Page{validPagesList.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
              style={{
                border: '1px solid var(--border)',
                background: 'white',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              <ZoomOut size={15} />
            </button>
            <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '45px', textAlign: 'center' }}>
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(175, z + 15))}
              style={{
                border: '1px solid var(--border)',
                background: 'white',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              style={{
                border: '1px solid var(--border)',
                background: 'white',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
              }}
              title="Reset Zoom"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          {/* Active Settings Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '99px',
              backgroundColor: isBwMode ? '#e2e8f0' : '#dbeafe',
              color: isBwMode ? '#334155' : '#1d4ed8',
            }}>
              {isBwMode ? '⬛ Black & White' : '🎨 Color Mode'}
            </span>

            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '99px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
            }}>
              {isDoubleSided ? '📖 Double-Sided' : '📄 Single-Sided'}
            </span>

            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '99px',
              backgroundColor: '#fef3c7',
              color: '#b45309',
            }}>
              📐 {settings.paperSize}
            </span>
          </div>
        </div>

        {/* Main Document Viewer Canvas Area - Continuous Vertical Scroll View */}
        <div style={{
          flex: 1,
          backgroundColor: '#0f172a',
          padding: '24px 16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
          position: 'relative',
        }}>
          {pagesToRender.map((pageNumber) => {
            const isFrontPage = pageNumber % 2 !== 0;

            return (
              <div
                key={pageNumber}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.2s ease-out',
                }}
              >
                {/* Page Label Header Badge */}
                <div style={{
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(30, 41, 59, 0.9)',
                  color: '#cbd5e1',
                  padding: '4px 14px',
                  borderRadius: '99px',
                  fontSize: '12px',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  border: '1px solid #334155',
                }}>
                  <FileText size={14} color="#38bdf8" />
                  <span>Page {pageNumber} of {rawTotalPages}</span>
                  {isDoubleSided && (
                    <span style={{
                      color: isFrontPage ? '#4ade80' : '#f59e0b',
                      fontSize: '11px',
                      marginLeft: '4px',
                    }}>
                      • {isFrontPage ? 'Front Side (Recto)' : 'Back Side (Verso)'}
                    </span>
                  )}
                </div>

                {/* Physical Paper Sheet */}
                <div
                  className="paper-sheet"
                  style={{
                    width: settings.paperSize === 'A3' ? '480px' : '380px',
                    minHeight: settings.paperSize === 'A3' ? '640px' : '510px',
                    backgroundColor: '#ffffff',
                    borderRadius: '4px',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.45)',
                    padding: '28px 24px',
                    boxSizing: 'border-box',
                    position: 'relative',
                    filter: isBwMode ? 'grayscale(100%) contrast(105%)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  {/* Trim Guidelines */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    right: '8px',
                    bottom: '8px',
                    border: '1px dashed #e2e8f0',
                    pointerEvents: 'none',
                  }} />

                  {/* Real Image Preview or Rendered Document Page */}
                  {isImage && objectUrl ? (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      <img
                        src={objectUrl}
                        alt={activeFile.fileName}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '440px',
                          objectFit: 'contain',
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Page Top Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1.5px solid #0f172a',
                        paddingBottom: '8px',
                      }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: isBwMode ? '#000000' : 'var(--primary)',
                          fontFamily: 'var(--font-heading)',
                        }}>
                          INSTANT PRINT OUTPUT
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                          PAGE {pageNumber} / {rawTotalPages}
                        </span>
                      </div>

                      {/* Document Title Header */}
                      <div style={{ marginTop: '4px' }}>
                        <h4 style={{
                          fontSize: '15px',
                          fontWeight: 800,
                          color: '#0f172a',
                          marginBottom: '2px',
                          lineHeight: 1.3,
                          fontFamily: 'var(--font-heading)',
                        }}>
                          {activeFile.fileName}
                        </h4>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Page {pageNumber} Content Layout • Format: {activeFile.mimeType || 'Document'}
                        </span>
                      </div>

                      {/* Document Content Skeleton lines for Page N */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                        <div style={{
                          height: '10px',
                          backgroundColor: isBwMode ? '#334155' : 'var(--primary)',
                          borderRadius: '3px',
                          width: `${80 + (pageNumber % 3) * 5}%`,
                        }} />
                        <div style={{ height: '8px', backgroundColor: '#94a3b8', borderRadius: '3px', width: '95%' }} />
                        <div style={{ height: '8px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '90%' }} />
                        <div style={{ height: '8px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '75%' }} />

                        <div style={{ height: '10px' }} />

                        {/* Page Section Highlight */}
                        <div style={{
                          padding: '10px 12px',
                          backgroundColor: isBwMode ? '#f1f5f9' : '#e0f2fe',
                          borderLeft: `4px solid ${isBwMode ? '#334155' : 'var(--primary)'}`,
                          borderRadius: '4px',
                        }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: isBwMode ? '#1e293b' : 'var(--primary)', display: 'block', marginBottom: '4px' }}>
                            SECTION {pageNumber}
                          </span>
                          <div style={{ height: '8px', backgroundColor: isBwMode ? '#64748b' : '#38bdf8', borderRadius: '2px', width: '85%' }} />
                        </div>

                        <div style={{ height: '8px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '96%' }} />
                        <div style={{ height: '8px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '88%' }} />
                        <div style={{ height: '8px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '78%' }} />
                      </div>

                      {/* Footer Stamp */}
                      <div style={{
                        marginTop: 'auto',
                        borderTop: '1px dashed #cbd5e1',
                        paddingTop: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '10px',
                        color: '#94a3b8',
                      }}>
                        <span>Instant Print Kiosk • Page {pageNumber}</span>
                        <span>{isBwMode ? 'Monochrome (B&W)' : 'Color Print'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Action Bar */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>All {validPagesList.length} pages rendered in sequential vertical preview</span>
          </div>

          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '14px' }}
          >
            Done Previewing
          </button>
        </div>
      </div>
    </div>
  );
};
