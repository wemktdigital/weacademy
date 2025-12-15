// [SCAN] found by Bug Hunt - Middleware simplificado
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  // Middleware simplificado - verificação de auth será feita nas rotas
  // Permitir todas as requisições passarem
  return NextResponse.next();
}

export const config = { 
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/my-courses/:path*",
    "/settings/:path*"
  ]
};
