import axios from "axios";
import { DbDocumentRecord, KioskSession, PriceBreakdown, PrintOptions } from "../types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? `${window.location.origin}/api`
    : "http://localhost:4000/api");

const client = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

export interface CreateSessionResponse {
  sessionId: string;
  mobileUrl: string;
  qrImageDataUrl: string;
  stage: string;
}

export async function createSession(): Promise<CreateSessionResponse> {
  const { data } = await client.post<CreateSessionResponse>("/session");
  return data;
}

export async function getSession(sessionId: string): Promise<KioskSession> {
  const { data } = await client.get<KioskSession>(`/session/${sessionId}`);
  return data;
}

export async function attachSession(sessionId: string): Promise<KioskSession> {
  const { data } = await client.post<KioskSession>(`/session/${sessionId}/attach`);
  return data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await client.delete(`/session/${sessionId}`);
}

export async function uploadFile(
  sessionId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<KioskSession> {
  const form = new FormData();
  form.append("sessionId", sessionId);
  form.append("file", file);

  const { data } = await client.post<KioskSession>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
  return data;
}

export async function calculatePrice(
  sessionId: string,
  options: PrintOptions
): Promise<{ session: KioskSession; price: PriceBreakdown }> {
  const { data } = await client.post("/calculate-price", { sessionId, options });
  return data;
}

export async function createPayment(
  sessionId: string
): Promise<{ session: KioskSession; devMode: boolean }> {
  const { data } = await client.post("/create-payment", { sessionId });
  return data;
}

export async function retryPayment(
  sessionId: string
): Promise<{ session: KioskSession; devMode: boolean }> {
  const { data } = await client.post("/create-payment/retry", { sessionId });
  return data;
}

export async function verifyPayment(sessionId: string): Promise<KioskSession> {
  const { data } = await client.post<KioskSession>("/verify-payment", { sessionId });
  return data;
}

export async function devSimulatePayment(sessionId: string, result: "PAID" | "FAILED"): Promise<void> {
  await client.post("/dev/simulate-payment", { sessionId, result });
}

export async function startPrint(sessionId: string): Promise<KioskSession> {
  const { data } = await client.post<KioskSession>("/start-print", { sessionId });
  return data;
}

export async function getPrintStatus(sessionId: string) {
  const { data } = await client.get(`/print-status`, { params: { sessionId } });
  return data as { stage: string; printJob: KioskSession["printJob"] };
}

export async function listDbDocuments(): Promise<DbDocumentRecord[]> {
  const { data } = await client.get<DbDocumentRecord[]>("/db/documents");
  return data;
}

export async function getDbDocumentByCode(accessCode: string): Promise<DbDocumentRecord> {
  const { data } = await client.get<DbDocumentRecord>(`/db/document/code/${accessCode}`);
  return data;
}

export async function loadSessionFromCode(accessCode: string, kioskSessionId?: string): Promise<KioskSession> {
  const { data } = await client.post<KioskSession>("/db/load-session", { accessCode, kioskSessionId });
  return data;
}

/** Extracts a friendly message from any API error shape this backend returns. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.error?.message;
    if (typeof message === "string") return message;
    if (err.code === "ECONNABORTED" || err.message === "Network Error") {
      return "Lost connection to PrintATM. Please check your internet and try again.";
    }
  }
  return fallback;
}
