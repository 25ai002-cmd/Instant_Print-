import React from 'react';
import { useSessionStore } from '../store/sessionStore.ts';
import { useCountdown } from '../hooks/useCountdown.ts';
import { CheckCircle, LogOut, Printer, Receipt, ShieldCheck, Download, FileText } from 'lucide-react';
import type { PrintSettings } from '../types/index.js';

function computeReceiptDetails(
  pageCount: number,
  settings: PrintSettings
) {
  const isColor = settings.colorMode === 'color';
  const isDouble = settings.sides === 'double';
  const copies = settings.copies || 1;

  if (isDouble) {
    const fullSheets = Math.floor(pageCount / 2);
    const oddPage = pageCount % 2;
    const doubleSheetCost = isColor ? 16.0 : 4.0;
    const singleSheetCost = isColor ? 10.0 : 2.0;

    const items = [];
    if (fullSheets > 0) {
      items.push({
        description: `${fullSheets} Double-Sided Sheet${fullSheets > 1 ? 's' : ''} (${fullSheets * 2} content pages)`,
        rate: `₹${doubleSheetCost.toFixed(2)} / 2-sided sheet`,
        totalCost: fullSheets * doubleSheetCost * copies,
      });
    }
    if (oddPage > 0) {
      items.push({
        description: `1 Single-Sided Sheet (1 content page)`,
        rate: `₹${singleSheetCost.toFixed(2)} / 1-sided sheet`,
        totalCost: oddPage * singleSheetCost * copies,
      });
    }
    return items;
  } else {
    const pageCost = isColor ? 10.0 : 2.0;
    return [{
      description: `${pageCount} Single-Sided Page${pageCount > 1 ? 's' : ''}`,
      rate: `₹${pageCost.toFixed(2)} / page`,
      totalCost: pageCount * pageCost * copies,
    }];
  }
}

export const DoneScreen: React.FC = () => {
  const {
    sessionId,
    fileName,
    analysis,
    settings,
    priceBreakdown,
    resetStore,
  } = useSessionStore();

  // 25 seconds auto-reset countdown so user can view receipt
  const { seconds } = useCountdown(25, () => {
    resetStore();
  });

  const pageCount = priceBreakdown?.totalPages || analysis?.pageCount || 1;
  const lineItems = computeReceiptDetails(pageCount / (settings.copies || 1), settings);
  const nowStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flex: 1,
      padding: '24px 16px',
      overflowY: 'auto',
    }}>
      {/* Success Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          backgroundColor: 'var(--success-light)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--success)',
        }}>
          <CheckCircle size={26} />
        </div>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{
            fontSize: '22px',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}>
            Print Job Complete!
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Please collect your printed pages from the tray
          </span>
        </div>
      </div>

      {/* Itemized Kiosk Receipt Card */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: '#ffffff',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        marginBottom: '20px',
      }}>
        {/* Receipt Header */}
        <div style={{
          backgroundColor: '#1e293b',
          color: 'white',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Receipt size={22} color="#38bdf8" />
            <div>
              <span style={{ fontSize: '15px', fontWeight: 800, display: 'block', letterSpacing: '0.3px' }}>
                Instant Print Tax Invoice / Receipt
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Kiosk Txn #{sessionId?.slice(0, 8) || 'PRINT-01'} • {nowStr}
              </span>
            </div>
          </div>
        </div>

        {/* Receipt Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Document & Config Details */}
          <div style={{
            padding: '12px 14px',
            backgroundColor: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <FileText size={22} color="var(--primary)" />
            <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {fileName || 'Document.pdf'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {settings.colorMode === 'color' ? '🎨 Color' : '⬛ Black & White'} • {settings.sides === 'double' ? '📖 Double-Sided' : '📄 Single-Sided'} • {settings.paperSize}
              </span>
            </div>
          </div>

          {/* Detailed Line Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Cost Breakdown
            </span>

            {lineItems.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                fontSize: '13px',
                paddingBottom: '8px',
                borderBottom: '1px dashed #e2e8f0',
              }}>
                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                    {item.description}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Rate: {item.rate}
                  </span>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  ₹{item.totalCost.toFixed(2)}
                </span>
              </div>
            ))}

            {settings.copies > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Number of Copies</span>
                <span>x {settings.copies}</span>
              </div>
            )}

            {priceBreakdown?.paperSizeMultiplier !== 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Paper Size ({settings.paperSize})</span>
                <span>x {priceBreakdown?.paperSizeMultiplier}</span>
              </div>
            )}
          </div>

          {/* Total Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '12px',
            borderTop: '2px solid var(--border)',
          }}>
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>
                Payment Method: UPI (Razorpay)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>
                ✓ PAID &amp; VERIFIED
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block' }}>
                TOTAL PAID
              </span>
              <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}>
                ₹{(priceBreakdown?.total || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Security & Clean Footer */}
        <div style={{
          backgroundColor: '#f1f5f9',
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          <ShieldCheck size={14} color="var(--success)" />
          <span>Files permanently deleted after printing</span>
        </div>
      </div>

      {/* Auto Reset Timer & Exit Button */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        maxWidth: '420px',
        marginTop: 'auto',
      }}>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
          Screen resets for next user in <strong style={{ color: 'var(--primary)', fontSize: '15px' }}>{seconds}s</strong>
        </span>

        <button
          onClick={resetStore}
          className="btn btn-secondary"
          style={{ width: '100%' }}
        >
          <LogOut size={16} /> Finish &amp; Return to Home
        </button>
      </div>
    </div>
  );
};
