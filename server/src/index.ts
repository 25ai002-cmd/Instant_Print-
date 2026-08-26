import express from "express";
import cors from "cors";
import path from "path";
import sessionRoutes from "./routes/session";
import uploadRoutes from "./routes/upload";
import priceRoutes from "./routes/price";
import paymentRoutes from "./routes/payment";
import printRoutes from "./routes/print";
import dbRoutes from "./routes/dbRoutes";
import { initDatabase } from "./services/database";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { getLocalWifiIp } from "./utils/network";
import { startCloudPrinterBridge } from "./services/cloudPrinterBridge";

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "printatm-server" }));

app.use("/api", sessionRoutes);
app.use("/api", uploadRoutes);
app.use("/api", priceRoutes);
app.use("/api", paymentRoutes);
app.use("/api", printRoutes);
app.use("/api", dbRoutes);

// Serve client static files in production
const clientDistPath = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDistPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
    if (err) next();
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Boot sequence: initialize SQLite database before opening port
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      const wifiIp = getLocalWifiIp();
      console.log(`==================================================`);
      console.log(`  PrintATM Server active on port ${PORT}`);
      console.log(`  Local Access: http://localhost:${PORT}`);
      if (wifiIp) {
        console.log(`  Local Wi-Fi Access: http://${wifiIp}:${PORT}`);
      }
      console.log(`==================================================`);

      // Start Cloud-to-Local Printer Bridge worker
      startCloudPrinterBridge();
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
