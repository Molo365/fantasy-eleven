import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express route handler so that any rejected promise is forwarded
 * to Express's error pipeline via next(err).  Without this wrapper, Express 4
 * never sees async errors and they become silent unhandled rejections.
 *
 * Usage:
 *   router.get("/foo", asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
