import express from "express";
import cors from "cors";
import sessionRoutes from "./routes/session";
import uploadRoutes from "./routes/upload";
import priceRoutes from "./routes/price";
import paymentRoutes from "./routes/payment";
import printRoutes from "./routes/print";
import dbRoutes from "./routes/dbRoutes";
import { initDatabase } from "./services/database";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

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

app.use(notFoundHandler);
app.use(errorHandler);

// Boot sequence: initialize SQLite database before opening port
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`PrintATM server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
