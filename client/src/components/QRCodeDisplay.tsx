import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

// FamPay emblem logo in dark circular badge
const FAMPAY_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23241c15" stroke="%23f97316" stroke-width="2"/><path d="M 28 46 C 38 32, 60 34, 74 42 C 62 52, 48 50, 40 64 C 50 56, 64 56, 72 65 C 52 78, 32 64, 28 46 Z" fill="%23f97316"/></svg>`;

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
  darkTheme?: boolean;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 180,
  label,
  darkTheme = true,
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '16px',
      backgroundColor: darkTheme ? '#141416' : '#ffffff',
      borderRadius: '20px',
      border: darkTheme ? '1px solid #27272a' : '1px solid #e2e8f0',
      boxShadow: darkTheme ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.08)',
    }}>
      {/* Outer QR Card Container */}
      <div style={{
        padding: '12px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <QRCodeSVG
          value={value}
          size={size}
          level="H"
          includeMargin={false}
          imageSettings={{
            src: FAMPAY_LOGO_SVG,
            x: undefined,
            y: undefined,
            height: Math.round(size * 0.22),
            width: Math.round(size * 0.22),
            excavate: true,
          }}
        />
      </div>

      {label && (
        <span style={{
          fontSize: '13px',
          fontWeight: 700,
          color: darkTheme ? '#ffffff' : '#1e293b',
          textAlign: 'center',
          letterSpacing: '-0.01em',
        }}>
          {label}
        </span>
      )}
    </div>
  );
};
