import type { NextRequest } from "next/server";
import { getSupabaseService } from "@/lib/supabase/admin";

/**
 * Generates a short-lived signed URL for the result file of a completed order.
 * Clients only need the tracking code; the bucket itself is private.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/download/[code]">,
) {
  const { code } = await ctx.params;
  const trackingCode = decodeURIComponent(code).trim().toUpperCase();

  let supabase;
  try {
    supabase = getSupabaseService();
  } catch {
    return new Response("Server belum dikonfigurasi.", { status: 500 });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("status, result_file_path, result_file_name")
    .eq("tracking_code", trackingCode)
    .maybeSingle();

  if (error || !order || order.status !== "completed" || !order.result_file_path) {
    return new Response("File tidak tersedia.", { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("results")
    .createSignedUrl(order.result_file_path, 60, {
      download: order.result_file_name ?? true,
    });

  if (signError || !signed) {
    return new Response("Gagal membuat link unduhan.", { status: 500 });
  }

  return Response.redirect(signed.signedUrl, 302);
}

