import React from 'react';
import { Printer } from 'lucide-react';

interface PrinterAnimationProps {
  progress: number;
}

export const PrinterAnimation: React.FC<PrinterAnimationProps> = ({ progress }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      padding: '40px 0',
      width: '100%',
    }}>
      <div style={{ position: 'relative', width: '120px', height: '120px' }}>
        {/* Glow behind printer */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90px',
          height: '90px',
          backgroundColor: 'var(--primary-light)',
          borderRadius: '50%',
          filter: 'blur(16px)',
          opacity: 0.6,
          zIndex: 0,
        }} />

        {/* Paper emerging animation */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '56px',
          height: `${Math.min(50, progress * 0.5)}px`,
          backgroundColor: '#fff',
          border: '1.5px solid var(--border)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          zIndex: 1,
          transition: 'height 0.3s ease-out',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {/* Simulated text lines on paper */}
          <div style={{ width: '40px', height: '2px', backgroundColor: '#e2e8f0', margin: '3px 0' }} />
          <div style={{ width: '32px', height: '2px', backgroundColor: '#e2e8f0', margin: '3px 0' }} />
          <div style={{ width: '40px', height: '2px', backgroundColor: '#e2e8f0', margin: '3px 0' }} />
        </div>

        {/* Floating printer device */}
        <div className="animate-printer" style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80px',
          height: '65px',
          backgroundColor: '#fff',
          border: '2.5px solid var(--text-primary)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          boxShadow: 'var(--shadow-md)',
        }}>
          <Printer size={32} color="var(--primary)" />
          {/* Status light indicator */}
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--success)',
            boxShadow: '0 0 6px var(--success)',
          }} />
        </div>
      </div>

      {/* Progress tracker bar */}
      <div style={{ width: '100%', maxWidth: '280px' }}>
        <div style={{
          height: '8px',
          width: '100%',
          backgroundColor: '#f1f5f9',
          borderRadius: '9999px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            backgroundColor: 'var(--primary)',
            borderRadius: '9999px',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginTop: '8px',
        }}>
          <span>Printing...</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
};
