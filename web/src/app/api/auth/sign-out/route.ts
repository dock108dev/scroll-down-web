import { NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/lib/config";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STORAGE_KEYS.SESSION, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
