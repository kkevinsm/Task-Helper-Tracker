import { Client } from "pg";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== "migrate-urtaskhelper-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawConnectionString =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;

  let connectionString: string | undefined = undefined;
  if (rawConnectionString) {
    try {
      const parsed = new URL(rawConnectionString);
      parsed.searchParams.delete("sslmode");
      connectionString = parsed.toString();
    } catch {
      connectionString = rawConnectionString;
    }
  }

  const client = connectionString
    ? new Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
      })
    : new Client({
        host: process.env.POSTGRES_HOST,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE,
        port: 5432,
        ssl: { rejectUnauthorized: false },
      });

  try {
    await client.connect();

    // 1. Add enum values individually
    await client.query("ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'revision'");
    await client.query("ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'revision_completed'");

    // 2. Update RPC function
    await client.query(`
      CREATE OR REPLACE FUNCTION public.get_public_order(code text)
      RETURNS TABLE (
        tracking_code text,
        client_name   text,
        title         text,
        category      text,
        status        public.order_status,
        deadline      date,
        notes         text,
        has_file      boolean,
        result_file_name text,
        result_link   text,
        started_at    timestamptz,
        completed_at  timestamptz,
        created_at    timestamptz,
        updated_at    timestamptz
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT
          o.tracking_code,
          public.mask_name(o.client_name),
          o.title,
          o.category,
          o.status,
          o.deadline,
          o.notes,
          (o.status IN ('completed', 'revision_completed') AND o.result_file_path IS NOT NULL),
          CASE WHEN o.status IN ('completed', 'revision_completed') THEN o.result_file_name END,
          CASE WHEN o.status IN ('completed', 'revision_completed') THEN o.result_link END,
          o.started_at,
          o.completed_at,
          o.created_at,
          o.updated_at
        FROM public.orders o
        WHERE UPPER(o.tracking_code) = UPPER(TRIM(code))
        LIMIT 1;
      $$;
    `);

    // 3. Update orders_before_update trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION public.orders_before_update()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        new.updated_at := now();
        IF new.status = 'in_progress' AND old.status IS DISTINCT FROM 'in_progress' AND new.started_at IS NULL THEN
          new.started_at := now();
        END IF;
        IF new.status IN ('completed', 'revision_completed') AND old.status NOT IN ('completed', 'revision_completed') THEN
          new.completed_at := now();
        ELSIF new.status NOT IN ('completed', 'revision_completed') THEN
          new.completed_at := null;
        END IF;
        RETURN new;
      END;
      $$;
    `);

    await client.end();
    return NextResponse.json({ success: true, message: "Migration executed successfully!" });
  } catch (err: unknown) {
    try {
      await client.end();
    } catch {}
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
