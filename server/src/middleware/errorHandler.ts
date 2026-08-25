import { NextFunction, Request, Response } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // eslint-disable-next-line no-console
  console.error("[error]", err?.message ?? err);

  const statusCode = err?.statusCode ?? 500;
  const message = err?.message ?? "Something went wrong. Please try again.";

  res.status(statusCode).json({
    error: {
      message,
      code: err?.code ?? "INTERNAL_ERROR",
    },
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: "Not found", code: "NOT_FOUND" } });
}

/** Wraps async route handlers so thrown errors reach errorHandler instead of hanging the request. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
