const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://sports-data-admin.dock108.ai";
const API_KEY = process.env.SPORTS_DATA_API_KEY || "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`);
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { revalidate?: number },
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
      ...options?.headers,
    },
    next:
      options?.revalidate !== undefined
        ? { revalidate: options.revalidate }
        : undefined,
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  return res.json();
}
