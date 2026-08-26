import os from "os";

/**
 * Detects the local IPv4 Wi-Fi/LAN IP address of this machine (e.g. 192.168.1.15).
 */
export function getLocalWifiIp(): string | null {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          // Check for standard private network ranges
          if (
            net.address.startsWith("192.168.") ||
            net.address.startsWith("10.") ||
            net.address.startsWith("172.")
          ) {
            return net.address;
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}
