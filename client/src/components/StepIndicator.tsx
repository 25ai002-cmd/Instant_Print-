import React from 'react';

const STEPS = ['Upload', 'Analyze', 'Configure', 'Pay', 'Print'];

interface StepIndicatorProps {
  currentStep: 'upload' | 'analysis' | 'settings' | 'payment' | 'printing' | 'idle' | 'failed' | 'done';
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  if (['idle', 'failed', 'done'].includes(currentStep)) return null;

  const getStepIndex = () => {
    switch (currentStep) {
      case 'upload': return 0;
      case 'analysis': return 1;
      case 'settings': return 2;
      case 'payment': return 3;
      case 'printing': return 4;
      default: return 0;
    }
  };

  const activeIndex = getStepIndex();

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 24px',
      borderBottom: '1px solid var(--border)',
      backgroundColor: '#fafafa',
      width: '100%',
    }}>
      {STEPS.map((step, idx) => {
        const isCompleted = idx < activeIndex;
        const isActive = idx === activeIndex;

        return (
          <React.Fragment key={step}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              flex: 1,
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                transition: 'var(--transition)',
                backgroundColor: isCompleted
                  ? 'var(--success)'
                  : isActive
                  ? 'var(--primary)'
                  : '#e5e7eb',
                color: isCompleted || isActive ? 'white' : 'var(--text-secondary)',
                boxShadow: isActive ? '0 0 0 4px rgba(0, 102, 204, 0.15)' : 'none',
              }}>
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-heading)',
              }}>
                {step}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                height: '2px',
                backgroundColor: idx < activeIndex ? 'var(--success)' : '#e5e7eb',
                flex: 1,
                margin: '0 4px',
                marginTop: '-12px', // pull line alignment up
                transition: 'var(--transition)',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
