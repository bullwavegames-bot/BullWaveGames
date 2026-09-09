export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "ERROR",
  ) {
    super(message);
  }
}

export function badRequest(message: string, code = "BAD_REQUEST"): ApiError {
  return new ApiError(400, message, code);
}

export function unauthorized(message = "Sign in to continue.", code = "UNAUTHORIZED"): ApiError {
  return new ApiError(401, message, code);
}

export function forbidden(message = "Not allowed.", code = "FORBIDDEN"): ApiError {
  return new ApiError(403, message, code);
}

export function notFound(message = "Not found.", code = "NOT_FOUND"): ApiError {
  return new ApiError(404, message, code);
}

export function conflict(message: string, code = "CONFLICT"): ApiError {
  return new ApiError(409, message, code);
}

export function tooMany(message = "Too many attempts. Try again shortly."): ApiError {
  return new ApiError(429, message, "RATE_LIMIT");
}
