export function projectError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "data" in error &&
    typeof error.data === "string"
  )
    return error.data;
  if (error instanceof Error && !error.message.includes("[CONVEX"))
    return error.message;
  return fallback;
}
