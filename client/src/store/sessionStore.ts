import { create } from 'zustand';
import { apiService } from '../services/api.js';
import type {
  PrintSession,
  PrintSettings,
  PriceBreakdown,
  DocumentAnalysis,
  PaymentInfo,
  PrintJob,
  UploadedFile,
} from '../types/index.js';

export type ScreenType =
  | 'idle'
  | 'upload'
  | 'analysis'
  | 'settings'
  | 'payment'
  | 'failed'
  | 'printing'
  | 'done';

interface SessionState {
  // Session details
  sessionId: string | null;
  localIp: string | null;
  scannedAt: string | null;
  currentScreen: ScreenType;
  fileName: string | null;
  fileSize: number | null;
  files: UploadedFile[] | null;
  analysis: DocumentAnalysis | null;
  settings: PrintSettings;
  priceBreakdown: PriceBreakdown | null;
  paymentInfo: any | null; // Razorpay payment details
  printJob: PrintJob | null;
  
  // Loading & Error States
  loading: boolean;
  error: string | null;

  // Actions
  initializeSession: () => Promise<{ sessionId: string; localIp: string }>;
  setSessionId: (id: string) => void;
  setScreen: (screen: ScreenType) => void;
  uploadFile: (files: File | File[]) => Promise<void>;
  updateSettingsAndCalculatePrice: (settings: Partial<PrintSettings>) => Promise<void>;
  generatePayment: () => Promise<void>;
  prewarmPayment: () => Promise<void>; // Pre-creates payment order silently in background
  setPaymentSuccess: (paymentId: string, signature: string) => Promise<void>;
  triggerPrint: () => Promise<void>;
  pollPrintJob: () => Promise<boolean>; // Returns true if completed
  resetStore: () => void;
  cancelSession: () => Promise<void>;
  setError: (msg: string | null) => void;
}

const DEFAULT_SETTINGS: PrintSettings = {
  copies: 1,
  sides: 'single',
  colorMode: 'bw',
  paperSize: 'A4',
};

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  localIp: null,
  scannedAt: null,
  currentScreen: 'idle',
  fileName: null,
  fileSize: null,
  files: null,
  analysis: null,
  settings: DEFAULT_SETTINGS,
  priceBreakdown: null,
  paymentInfo: null,
  printJob: null,
  loading: false,
  error: null,

  setSessionId: (id) => set({ sessionId: id }),
  setScreen: (screen) => set({ currentScreen: screen, error: null }),
  setError: (msg) => set({ error: msg }),

  initializeSession: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiService.createSession();
      set({ sessionId: data.sessionId, localIp: data.localIp, loading: false });
      return data;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  uploadFile: async (files: File | File[]) => {
    const { sessionId } = get();
    if (!sessionId) return;
    set({ loading: true, error: null });
    try {
      const data = await apiService.uploadFile(sessionId, files);
      set({
        fileName: data.fileName,
        fileSize: data.fileSize,
        files: data.files || null,
        analysis: data.analysis,
        currentScreen: 'analysis',
        loading: false,
      });
      // Immediately request price calculation with defaults
      await get().updateSettingsAndCalculatePrice(DEFAULT_SETTINGS);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateSettingsAndCalculatePrice: async (newSettings) => {
    const { sessionId, settings } = get();
    if (!sessionId) return;
    const mergedSettings = { ...settings, ...newSettings };
    // Invalidate any pre-warmed payment order since price may change
    set({ settings: mergedSettings, loading: true, paymentInfo: null });
    try {
      const data = await apiService.calculatePrice(sessionId, mergedSettings);
      set({
        priceBreakdown: data.priceBreakdown,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  prewarmPayment: async () => {
    const { sessionId, paymentInfo, priceBreakdown } = get();
    // Skip if already have a pending payment order, no session, or no price yet
    if (!sessionId || !priceBreakdown || paymentInfo) return;
    try {
      const data = await apiService.createPayment(sessionId);
      // Only store if the user hasn't already triggered generatePayment
      if (!get().paymentInfo) {
        set({ paymentInfo: data });
      }
    } catch (err) {
      // Silently fail — generatePayment will retry on click
      console.warn('[prewarmPayment] Silent pre-warm failed:', err);
    }
  },

  generatePayment: async () => {
    const { sessionId, paymentInfo } = get();
    if (!sessionId) return;

    // If payment was already pre-warmed, skip API call and navigate instantly
    if (paymentInfo) {
      set({ currentScreen: 'payment', error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const data = await apiService.createPayment(sessionId);
      set({
        paymentInfo: data,
        currentScreen: 'payment',
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  setPaymentSuccess: async (paymentId, signature) => {
    const { sessionId, paymentInfo } = get();
    if (!sessionId || !paymentInfo) return;
    set({ loading: true, error: null });
    try {
      const success = await apiService.verifyPayment(
        sessionId,
        paymentInfo.orderId,
        paymentId,
        signature
      );
      if (success) {
        set({ currentScreen: 'printing', loading: false });
        // Automatically start the print job
        await get().triggerPrint();
      } else {
        set({ currentScreen: 'failed', error: 'Payment signature could not be verified.', loading: false });
      }
    } catch (err: any) {
      set({ currentScreen: 'failed', error: err.message, loading: false });
    }
  },

  triggerPrint: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    try {
      const data = await apiService.startPrint(sessionId);
      set({ printJob: data.printJob });
    } catch (err: any) {
      set({ currentScreen: 'failed', error: `Printer Error: ${err.message}`, loading: false });
    }
  },

  pollPrintJob: async () => {
    const { sessionId } = get();
    if (!sessionId) return false;
    try {
      const data = await apiService.getPrintStatus(sessionId);
      set({ printJob: data.printJob });
      if (data.printJob.status === 'completed') {
        set({ currentScreen: 'done' });
        return true;
      }
      if (data.printJob.status === 'failed') {
        set({ currentScreen: 'failed', error: data.printJob.error || 'Printing failed' });
        return true;
      }
      return false;
    } catch (err: any) {
      // If session is deleted, it might return 404, which means it finished and was cleaned up!
      if (err.response?.status === 404) {
        set({ currentScreen: 'done' });
        return true;
      }
      return false;
    }
  },

  cancelSession: async () => {
    const { sessionId } = get();
    if (sessionId) {
      try {
        await apiService.deleteSession(sessionId);
      } catch (e) {
        console.warn('Silent session delete fail', e);
      }
    }
    // Reset the store state so kiosk goes back to idle
    // On mobile, the App-level onCancel callback handles the UI transition
    get().resetStore();
  },

  resetStore: () => {
    set({
      sessionId: null,
      localIp: null,
      scannedAt: null,
      currentScreen: 'idle',
      fileName: null,
      fileSize: null,
      files: null,
      analysis: null,
      settings: DEFAULT_SETTINGS,
      priceBreakdown: null,
      paymentInfo: null,
      printJob: null,
      loading: false,
      error: null,
    });
  },
}));
