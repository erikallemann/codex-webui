import { NextRequest, NextResponse } from "next/server";
import { validateLocalApiRequest } from "@/lib/server/local-api-security";

export function middleware(request: NextRequest): NextResponse {
  const validation = validateLocalApiRequest(request);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status },
    );
  }

  const response = NextResponse.next();
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
