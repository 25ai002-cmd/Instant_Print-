import React, { useEffect, useState } from 'react';
import { useSessionStore } from './store/sessionStore.ts';
import { apiService } from './services/api.js';
import { usePolling } from './hooks/usePolling.ts';

// Screen Imports
import { IdleScreen } from './screens/IdleScreen.tsx';
import { UploadScreen } from './screens/UploadScreen.tsx';
import { AnalysisScreen } from './screens/AnalysisScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { PaymentScreen } from './screens/PaymentScreen.tsx';
import { PaymentFailedScreen } from './screens/PaymentFailedScreen.tsx';
import { PrintingScreen } from './screens/PrintingScreen.tsx';
import { DoneScreen } from './screens/DoneScreen.tsx';
import { KioskActiveScreen } from './screens/KioskActiveScreen.tsx';
import { AdminDashboard } from './admin/AdminDashboard.tsx';

// Component Imports
import { StepIndicator } from './components/StepIndicator.tsx';
import { RefreshCw, Printer, XCircle } from 'lucide-react';

// ── Mobile Session Expired / Cancelled fallback ──────────────────────────
const MobileExpiredScreen: React.FC<{ reason?: 'cancelled' | 'expired' }> = ({ reason = 'expired' }) => (
  <div className="app-container">
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      padding: '40px 24px',
      textAlign: 'center',
    }}>
      <XCircle size={64} color={reason === 'cancelled' ? 'var(--error)' : 'var(--text-tertiary)'} />
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--font-heading)' }}>
          {reason === 'cancelled' ? 'Session Cancelled' : 'Session Expired or Invalid'}
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {reason === 'cancelled'
            ? 'You cancelled this print session. Please scan a new QR code on the kiosk to start again.'
            : 'This session is no longer active. Please scan the latest QR code displayed on the kiosk screen.'
          }
        </p>
      </div>
      <div style={{
        padding: '16px 20px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        fontSize: '14px',
        color: 'var(--text-secondary)',
      }}>
        <Printer size={20} style={{ marginBottom: '6px', color: 'var(--primary)' }} />
        <p>Return to the Instant Print kiosk and scan the current QR code.</p>
      </div>
    </div>
  </div>
);

export const App: React.FC = () => {
  // Synchronously detect if opened on mobile via QR code parameter or admin view
  const searchParams = new URLSearchParams(window.location.search);
  const sessionParam = searchParams.get('session');
  const isAdminParam = searchParams.get('admin') === 'true';
  const isMobile = Boolean(sessionParam);

  const [isAdminMode, setIsAdminMode] = useState(isAdminParam);

  const {
    currentScreen,
    sessionId,
    setSessionId,
    setScreen,
    resetStore,
    loading,
  } = useSessionStore();

  const [sessionRestoring, setSessionRestoring] = useState(isMobile);
  const [mobileState, setMobileState] = useState<'active' | 'cancelled' | 'expired'>('active');

  // Mobile session initialization effect - runs ONCE on mount if sessionParam exists
  useEffect(() => {
    if (!isMobile || !sessionParam) return;

    setSessionId(sessionParam);
    
    let isSubscribed = true;

    const restoreSession = async () => {
      setSessionRestoring(true);
      try {
        const session = await apiService.getSession(sessionParam, true);
        if (!isSubscribed) return;

        // Populate store with session state from server
        useSessionStore.setState({
          sessionId: sessionParam,
          fileName: session.fileName || null,
          fileSize: session.fileSize || null,
          files: session.files || null,
          analysis: session.analysis || null,
          settings: session.settings || useSessionStore.getState().settings,
          priceBreakdown: session.priceBreakdown || null,
          paymentInfo: session.payment || null,
          printJob: session.printJob || null,
        });

        // Set mobile screen based on server session status
        switch (session.status) {
          case 'created':
            setScreen('upload');
            break;
          case 'uploaded':
          case 'analyzed':
            setScreen('analysis');
            break;
          case 'configured':
            setScreen('settings');
            break;
          case 'payment_pending':
            setScreen('payment');
            break;
          case 'payment_verified':
          case 'printing':
            setScreen('printing');
            break;
          case 'completed':
            setScreen('done');
            break;
          case 'failed':
            setScreen('failed');
            break;
          default:
            setScreen('upload');
        }
      } catch (err: any) {
        console.error('[Mobile] Failed to load session:', err);
        if (isSubscribed) {
          setMobileState('expired');
        }
      } finally {
        if (isSubscribed) {
          setSessionRestoring(false);
        }
      }
    };

    restoreSession();

    return () => {
      isSubscribed = false;
    };
  }, [sessionParam]);

  // Listen for mobile session cancellation
  useEffect(() => {
    if (currentScreen === ('mobile-cancelled' as any)) {
      setMobileState('cancelled');
    }
  }, [currentScreen]);

  // Kiosk-side Session Syncer:
  // ONLY runs on Kiosk mode (when NOT mobile) and when an active session exists
  usePolling(
    async () => {
      if (isMobile || !sessionId) return false;
      try {
        const session = await apiService.getSession(sessionId);
        
        // Sync kiosk state
        useSessionStore.setState({
          scannedAt: session.scannedAt || null,
          fileName: session.fileName || null,
          fileSize: session.fileSize || null,
          files: session.files || null,
          analysis: session.analysis || null,
          settings: session.settings || useSessionStore.getState().settings,
          priceBreakdown: session.priceBreakdown || null,
          paymentInfo: session.payment || null,
          printJob: session.printJob || null,
        });

        // Update kiosk screen layout
        if (session.status === 'created') {
          setScreen('idle');
        } else if (session.status === 'uploaded' || session.status === 'analyzed') {
          setScreen('analysis');
        } else if (session.status === 'configured') {
          setScreen('settings');
        } else if (session.status === 'payment_pending') {
          setScreen('payment');
        } else if (session.status === 'payment_verified' || session.status === 'printing') {
          setScreen('printing');
        } else if (session.status === 'completed') {
          setScreen('done');
          return true;
        } else if (session.status === 'failed') {
          setScreen('failed');
          return true;
        }

        return false;
      } catch (err: any) {
        if (err.response?.status === 404) {
          if (currentScreen === 'printing') {
            setScreen('done');
          } else if (currentScreen !== 'idle') {
            resetStore();
          }
          return true;
        }
        return false;
      }
    },
    1500,
    !isMobile && !!sessionId
  );

  // ── Render Mobile End-States ──────────────────────────────────────────
  if (isMobile && mobileState === 'cancelled') {
    return <MobileExpiredScreen reason="cancelled" />;
  }
  if (isMobile && mobileState === 'expired') {
    return <MobileExpiredScreen reason="expired" />;
  }

  // Render Restoring Spinner on Mobile
  if (isMobile && sessionRestoring) {
    return (
      <div className="app-container">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
        }}>
          <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
          <span style={{ fontSize: '16px', fontWeight: 600 }}>Connecting to Instant Print Kiosk...</span>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    // If on Kiosk Monitor (not mobile), show KioskActiveScreen during setup steps
    if (!isMobile && ['upload', 'analysis', 'settings'].includes(currentScreen)) {
      return <KioskActiveScreen />;
    }

    switch (currentScreen) {
      case 'idle':
        if (isMobile) {
          return <MobileExpiredScreen reason="expired" />;
        }
        return <IdleScreen />;
      case 'upload':
        return <UploadScreen isMobile={isMobile} onCancel={() => setMobileState('cancelled')} />;
      case 'analysis':
        return <AnalysisScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'payment':
        return <PaymentScreen />;
      case 'failed':
        return <PaymentFailedScreen />;
      case 'printing':
        return <PrintingScreen />;
      case 'done':
        return <DoneScreen />;
      default:
        return isMobile ? <UploadScreen isMobile={true} /> : <IdleScreen />;
    }
  };

  if (isAdminMode) {
    return <AdminDashboard onBackToKiosk={() => setIsAdminMode(false)} />;
  }

  return (
    <div className="app-container">
      <div className="kiosk-wrapper">
        {/* Kiosk / Mobile Header */}
        {currentScreen !== 'idle' && currentScreen !== 'done' && (
          <>
            <div className="brand-header">
              <div className="brand-logo">P</div>
              <span className="brand-name">Instant Print Kiosk</span>
            </div>
            <StepIndicator currentStep={currentScreen} />
          </>
        )}

        {/* Active Screen */}
        {renderScreen()}

        {/* Global Action Loader */}
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99,
            backdropFilter: 'blur(2px)',
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}>
              <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Processing...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
