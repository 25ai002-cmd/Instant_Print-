import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 200,
  label = 'Scan to print',
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      padding: '24px',
      background: 'white',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{
        padding: '12px',
        background: '#f8fafc',
        borderRadius: 'var(--radius-md)',
        border: '1px solid #f1f5f9',
      }}>
        <QRCodeSVG
          value={value}
          size={size}
          level="H"
          includeMargin={true}
        />
      </div>
      {label && (
        <span style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '-0.3px',
        }}>
          {label}
        </span>
      )}
    </div>
  );
};
