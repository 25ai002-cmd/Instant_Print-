import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore.ts';
import { PriceBreakdown } from '../components/PriceBreakdown.tsx';
import { ArrowLeft, CreditCard, Minus, Plus, Eye } from 'lucide-react';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal.tsx';
import type { PageRange } from '../types/index.js';

/** Parse human string like "1-4, 6-10, 12" into PageRange array */
function parsePageRanges(input: string, maxPages: number): { ranges: PageRange[]; error: string | null; totalSelected: number } {
  if (!input.trim()) {
    return { ranges: [], error: 'Please enter page numbers (e.g. 1-4, 6-10)', totalSelected: 0 };
  }

  const parts = input.split(',').map(s => s.trim()).filter(Boolean);
  const ranges: PageRange[] = [];
  const selectedPages = new Set<number>();

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const from = parseInt(startStr, 10);
      const to = parseInt(endStr, 10);

      if (isNaN(from) || isNaN(to)) {
        return { ranges: [], error: `Invalid range format: "${part}"`, totalSelected: 0 };
      }
      if (from < 1 || to > maxPages || from > to) {
        return { ranges: [], error: `Range ${from}-${to} is out of bounds (1–${maxPages})`, totalSelected: 0 };
      }
      ranges.push({ from, to });
      for (let p = from; p <= to; p++) selectedPages.add(p);
    } else {
      const page = parseInt(part, 10);
      if (isNaN(page)) {
        return { ranges: [], error: `Invalid page number: "${part}"`, totalSelected: 0 };
      }
      if (page < 1 || page > maxPages) {
        return { ranges: [], error: `Page ${page} is out of bounds (1–${maxPages})`, totalSelected: 0 };
      }
      ranges.push({ from: page, to: page });
      selectedPages.add(page);
    }
  }

  return { ranges, error: null, totalSelected: selectedPages.size };
}

export const SettingsScreen: React.FC = () => {
  const {
    fileName,
    fileSize,
    files,
    analysis,
    settings,
    priceBreakdown,
    updateSettingsAndCalculatePrice,
    generatePayment,
    setScreen,
    cancelSession,
  } = useSessionStore();

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const maxPages = analysis?.pageCount || 1;

  const [rangeMode, setRangeMode] = useState<'all' | 'custom'>(
    settings.pageRanges && settings.pageRanges.length > 0 ? 'custom' : 'all'
  );
  
  const [rangeInput, setRangeInput] = useState<string>(
    settings.pageRanges && settings.pageRanges.length > 0
      ? settings.pageRanges.map(r => r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`).join(', ')
      : ''
  );
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [selectedPagesCount, setSelectedPagesCount] = useState<number>(
    settings.pageRanges && settings.pageRanges.length > 0
      ? parsePageRanges(
          settings.pageRanges.map(r => r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`).join(', '),
          maxPages
        ).totalSelected
      : maxPages
  );

  const applyCustomRange = (inputStr: string) => {
    const res = parsePageRanges(inputStr, maxPages);
    if (res.error) {
      setRangeError(res.error);
    } else {
      setRangeError(null);
      setSelectedPagesCount(res.totalSelected);
      updateSettingsAndCalculatePrice({ pageRanges: res.ranges });
    }
  };

  const handleCopiesChange = (val: number) => {
    const copies = Math.max(1, Math.min(50, settings.copies + val));
    updateSettingsAndCalculatePrice({ copies });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      padding: '24px 16px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <button
          onClick={() => setScreen('analysis')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--text-secondary)',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 700,
          fontFamily: 'var(--font-heading)',
        }}>
          Print Settings
        </h2>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        marginBottom: '28px',
      }}>
        {/* Copies Counter */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>Number of Copies</span>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>How many sets do you need?</p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid var(--border)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'white',
          }}>
            <button
              onClick={() => handleCopiesChange(-1)}
              disabled={settings.copies <= 1}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: settings.copies <= 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
              }}
            >
              <Minus size={16} />
            </button>
            <span style={{
              fontSize: '18px',
              fontWeight: 700,
              minWidth: '24px',
              textAlign: 'center',
            }}>
              {settings.copies}
            </span>
            <button
              onClick={() => handleCopiesChange(1)}
              disabled={settings.copies >= 50}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: settings.copies >= 50 ? 'var(--text-tertiary)' : 'var(--text-primary)',
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Color Mode */}
        <div>
          <span style={{ fontSize: '15px', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
            Color Mode
          </span>
          <div className="pill-group">
            <button
              onClick={() => updateSettingsAndCalculatePrice({ colorMode: 'bw' })}
              className={`pill-btn ${settings.colorMode === 'bw' ? 'active' : ''}`}
            >
              Black & White
            </button>
            <button
              onClick={() => updateSettingsAndCalculatePrice({ colorMode: 'color' })}
              className={`pill-btn ${settings.colorMode === 'color' ? 'active' : ''}`}
            >
              Color
            </button>
          </div>
        </div>

        {/* Double Sided */}
        <div>
          <span style={{ fontSize: '15px', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
            Print Sides
          </span>
          <div className="pill-group">
            <button
              onClick={() => updateSettingsAndCalculatePrice({ sides: 'single' })}
              className={`pill-btn ${settings.sides === 'single' ? 'active' : ''}`}
            >
              Single-Sided
            </button>
            <button
              onClick={() => updateSettingsAndCalculatePrice({ sides: 'double' })}
              className={`pill-btn ${settings.sides === 'double' ? 'active' : ''}`}
            >
              Double-Sided
            </button>
          </div>
        </div>

        {/* Page Range Selection */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>
              Pages to Print
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Doc total: {analysis?.pageCount || 1} pages
            </span>
          </div>

          <div className="pill-group" style={{ marginBottom: rangeMode === 'custom' ? '12px' : '0' }}>
            <button
              onClick={() => {
                setRangeMode('all');
                updateSettingsAndCalculatePrice({ pageRanges: undefined });
              }}
              className={`pill-btn ${rangeMode === 'all' ? 'active' : ''}`}
            >
              All Pages (1–{analysis?.pageCount || 1})
            </button>
            <button
              onClick={() => {
                setRangeMode('custom');
                if (!rangeInput) {
                  const defaultRange = `1-${Math.min(4, analysis?.pageCount || 1)}`;
                  setRangeInput(defaultRange);
                  applyCustomRange(defaultRange);
                }
              }}
              className={`pill-btn ${rangeMode === 'custom' ? 'active' : ''}`}
            >
              Custom Range
            </button>
          </div>

          {rangeMode === 'custom' && (
            <div style={{
              padding: '12px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Enter range (e.g. 1-4, 6-10)
              </label>
              <input
                type="text"
                value={rangeInput}
                onChange={(e) => {
                  setRangeInput(e.target.value);
                  applyCustomRange(e.target.value);
                }}
                placeholder="e.g. 1-4, 6-10"
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: rangeError ? '1.5px solid var(--error)' : '1px solid var(--border)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  backgroundColor: 'white',
                }}
              />
              {rangeError ? (
                <span style={{ fontSize: '11px', color: 'var(--error)', fontWeight: 500 }}>
                  {rangeError}
                </span>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  Selected {selectedPagesCount} of {analysis?.pageCount || 1} pages
                </span>
              )}
            </div>
          )}
        </div>

        {/* Paper Size */}
        <div>
          <span style={{ fontSize: '15px', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
            Paper Size
          </span>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
          }}>
            {(['A4', 'A3', 'Letter', 'Legal'] as const).map((size) => (
              <button
                key={size}
                onClick={() => updateSettingsAndCalculatePrice({ paperSize: size })}
                style={{
                  padding: '10px 4px',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid',
                  borderColor: settings.paperSize === size ? 'var(--primary)' : 'var(--border)',
                  backgroundColor: settings.paperSize === size ? 'var(--primary-light)' : 'white',
                  color: settings.paperSize === size ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  textAlign: 'center',
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Summary */}
      {priceBreakdown && (
        <div style={{ marginBottom: '24px' }}>
          <PriceBreakdown breakdown={priceBreakdown} />
        </div>
      )}

      {/* Actions */}
      <div style={{
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <button
          onClick={() => setIsPreviewOpen(true)}
          className="btn btn-secondary"
          style={{
            borderColor: 'var(--primary)',
            color: 'var(--primary)',
            backgroundColor: 'var(--primary-light)',
          }}
        >
          <Eye size={18} /> View Print Preview
        </button>

        <button
          onClick={generatePayment}
          className="btn btn-primary"
        >
          <CreditCard size={18} /> Proceed to Pay
        </button>

        <button
          onClick={cancelSession}
          className="btn btn-secondary"
        >
          Cancel Print
        </button>
      </div>

      {isPreviewOpen && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setIsPreviewOpen(false)}
          files={files && files.length > 0 ? files : [{
            fileName: fileName || 'Document.pdf',
            fileSize: fileSize || 0,
            mimeType: 'application/pdf',
            pageCount: analysis?.pageCount || 1,
          }]}
          settings={settings}
        />
      )}
    </div>
  );
};
