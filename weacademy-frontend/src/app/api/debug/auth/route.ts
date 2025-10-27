// [SCAN] found by Bug Hunt - Debug auth endpoint
export const runtime = "nodejs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET() {
  const c = await cookies();
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: {
          getItem: (key: string) => {
            const cookieValue = c.get(key)?.value;
            return cookieValue || null;
          },
          setItem: (key: string, value: string) => {
            c.set(key, value);
          },
          removeItem: (key: string) => {
            c.delete(key);
          },
        },
      },
    }
  );
  
  const { data: { user }, error } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role ?? null;
  const cookieLen = (c.getAll()?.map(x=>x.value).join(";") || "").length;

  return Response.json({
    ok: !error && !!user,
    userId: user?.id ?? null,
    role,
    cookieLen,
    now: new Date().toISOString(),
    hasEnv: {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  });
}
