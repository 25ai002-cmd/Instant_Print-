import axios from 'axios';
import type { ApiResponse, PrintSession, PrintSettings } from '../types/index.js';

const api = axios.create({
  baseURL: '/api',
  // NOTE: Do NOT set a global Content-Type here.
  // FormData uploads need the browser to auto-set multipart/form-data with the
  // correct boundary. A global JSON header would override that and break Multer.
});

export const apiService = {
  createSession: async (): Promise<{ sessionId: string; localIp: string }> => {
    const res = await api.post<ApiResponse<{ sessionId: string; localIp: string }>>('/sessions');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to create session');
    }
    return res.data.data;
  },

  /** Get full session status */
  getSession: async (sessionId: string, isMobile = false): Promise<PrintSession> => {
    const url = isMobile ? `/sessions/${sessionId}?isMobile=true` : `/sessions/${sessionId}`;
    const res = await api.get<ApiResponse<PrintSession>>(url, {
      headers: isMobile ? { 'X-Mobile-Scan': 'true' } : {},
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to get session');
    }
    return res.data.data;
  },

  /** Upload one or multiple document files to the session */
  uploadFile: async (sessionId: string, files: File | File[]): Promise<any> => {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    
    const fileArray = Array.isArray(files) ? files : [files];
    fileArray.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const res = await api.post<ApiResponse<any>>(`/upload?sessionId=${encodeURIComponent(sessionId)}`, formData, {
        headers: {
          'X-Session-ID': sessionId,
        },
      });

      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error?.message || 'File upload failed');
      }
      return res.data.data;
    } catch (err: any) {
      const apiMsg = err.response?.data?.error?.message;
      if (apiMsg) {
        throw new Error(apiMsg);
      }
      throw err;
    }
  },

  /** Compute price based on printing preferences */
  calculatePrice: async (
    sessionId: string,
    settings: PrintSettings
  ): Promise<any> => {
    const res = await api.post<ApiResponse<any>>('/calculate-price', {
      sessionId,
      ...settings,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Price calculation failed');
    }
    return res.data.data;
  },

  /** Request payment order with UPI QR string */
  createPayment: async (sessionId: string): Promise<any> => {
    const res = await api.post<ApiResponse<any>>('/create-payment', { sessionId });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to create payment order');
    }
    return res.data.data;
  },

  /** Verify backend signature */
  verifyPayment: async (
    sessionId: string,
    orderId: string,
    paymentId: string,
    signature: string
  ): Promise<boolean> => {
    const res = await api.post<ApiResponse<any>>('/verify-payment', {
      sessionId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    });
    return !!res.data.success;
  },

  /** Trigger print job submission */
  startPrint: async (sessionId: string): Promise<any> => {
    const res = await api.post<ApiResponse<any>>('/print', { sessionId });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to start printing');
    }
    return res.data.data;
  },

  /** Get progress of print job */
  getPrintStatus: async (sessionId: string): Promise<any> => {
    const res = await api.get<ApiResponse<any>>(`/print-status?sessionId=${sessionId}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to poll print status');
    }
    return res.data.data;
  },

  /** Clean session directories explicitly */
  deleteSession: async (sessionId: string): Promise<void> => {
    await api.delete(`/sessions/${sessionId}`);
  },
};
