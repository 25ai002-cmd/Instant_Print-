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

  const downloadInvoicePdf = () => {
    const totalAmount = (priceBreakdown?.total || 0).toFixed(2);
    const invoiceContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>PrintATM Invoice - ${sessionId?.substring(0, 8) || 'PRINT'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 30px; color: #0f172a; background: #ffffff; }
    .invoice-card { max-width: 550px; margin: 0 auto; border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; }
    .brand { font-size: 24px; font-weight: 800; color: #2563eb; letter-spacing: -0.02em; }
    .badge { background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 99px; }
    .meta-row { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .doc-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; }
    .doc-name { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .doc-sub { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding: 8px 4px; }
    td { padding: 12px 4px; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .total-box { display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #0f172a; padding-top: 14px; margin-top: 10px; }
    .total-price { font-size: 24px; font-weight: 900; color: #2563eb; }
    .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand">🖨️ PrintATM</div>
        <div style="font-size: 12px; color: #64748b; font-weight: 600;">Official Print Tax Invoice</div>
      </div>
      <div style="text-align: right;">
        <span class="badge">✓ PAID & VERIFIED</span>
      </div>
    </div>

    <div class="meta-row">
      <div><strong>Txn ID:</strong> #${sessionId?.slice(0, 8).toUpperCase() || 'TXN-01'}</div>
      <div><strong>Date:</strong> ${nowStr}</div>
      <div><strong>UPI VPA:</strong> 6353874452@fam</div>
    </div>

    <div class="doc-box">
      <div class="doc-name">${fileName || 'Printed Document.pdf'}</div>
      <div class="doc-sub">${settings.colorMode === 'color' ? 'Color Print' : 'Black & White'} • ${settings.sides === 'double' ? 'Double-Sided' : 'Single-Sided'} • Paper: ${settings.paperSize} (${settings.copies} ${settings.copies > 1 ? 'copies' : 'copy'})</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map(item => `
          <tr>
            <td>${item.description}<br/><small style="color: #94a3b8;">${item.rate}</small></td>
            <td style="text-align: right; font-weight: 700;">₹${item.totalCost.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="total-box">
      <span style="font-weight: 700; color: #0f172a;">Total Amount Paid</span>
      <span class="total-price">₹${totalAmount}</span>
    </div>

    <div class="footer">
      Secured via Razorpay UPI Gateway • PrintATM SaaS Platform<br/>
      Thank you for using PrintATM!
    </div>
  </div>
</body>
</html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(invoiceContent);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 300);
    }
  };

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

      {/* Auto Reset Timer & Exit Buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        maxWidth: '420px',
        marginTop: 'auto',
      }}>
        {/* Download PDF Invoice Action Button */}
        <button
          onClick={downloadInvoicePdf}
          className="btn btn-primary"
          style={{
            width: '100%',
            backgroundColor: '#0284c7',
            padding: '12px',
            fontSize: '15px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Download size={18} /> Download Tax Invoice (PDF)
        </button>

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
