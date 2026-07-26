import React from 'react';
import type { PriceBreakdown as PriceBreakdownType } from '../types/index.js';
import { useSessionStore } from '../store/sessionStore.ts';

interface PriceBreakdownProps {
  breakdown: PriceBreakdownType;
}

export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({ breakdown }) => {
  const settings = useSessionStore((state) => state.settings);
  const isColor = settings.colorMode === 'color';
  const isDouble = settings.sides === 'double';

  const singleCopyPages = Math.round(breakdown.totalPages / (breakdown.copies || 1));
  const fullSheets = Math.floor(singleCopyPages / 2);
  const oddPage = singleCopyPages % 2;

  return (
    <div style={{
      width: '100%',
      padding: '18px 20px',
      backgroundColor: '#f8fafc',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <h4 style={{
        fontSize: '14px',
        fontWeight: 700,
        color: 'var(--text-primary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '6px',
        marginBottom: '2px',
      }}>
        Price Breakdown
      </h4>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Print Mode</span>
        <span style={{ fontWeight: 600 }}>
          {isColor ? '🎨 Color' : '⬛ Black & White'} ({isDouble ? 'Double-Sided' : 'Single-Sided'})
        </span>
      </div>

      {isDouble ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '8px 10px',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid #e2e8f0',
          fontSize: '12px',
        }}>
          {fullSheets > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {fullSheets} 2-sided sheet{fullSheets > 1 ? 's' : ''} ({fullSheets * 2} pages)
              </span>
              <span style={{ fontWeight: 600 }}>
                @ ₹{isColor ? '16.00' : '4.00'} / sheet
              </span>
            </div>
          )}
          {oddPage > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)' }}>
              <span>
                1 leftover page (odd page)
              </span>
              <span style={{ fontWeight: 700 }}>
                @ ₹{isColor ? '10.00' : '2.00'} (single-sided rate)
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Rate per page</span>
          <span style={{ fontWeight: 600 }}>₹{breakdown.baseRatePerPage.toFixed(2)}</span>
        </div>
      )}

      {breakdown.paperSizeMultiplier !== 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Paper Size ({settings.paperSize})</span>
          <span style={{ fontWeight: 600 }}>x {breakdown.paperSizeMultiplier.toFixed(1)}</span>
        </div>
      )}

      {breakdown.copies > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Copies</span>
          <span style={{ fontWeight: 600 }}>x {breakdown.copies}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Total Content Pages</span>
        <span style={{ fontWeight: 700 }}>{breakdown.totalPages}</span>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '18px',
        fontWeight: 800,
        color: 'var(--primary)',
        borderTop: '1px dashed var(--border)',
        paddingTop: '10px',
        marginTop: '2px',
      }}>
        <span>Total Amount</span>
        <span>₹{breakdown.total.toFixed(2)}</span>
      </div>
    </div>
  );
};
