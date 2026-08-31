import { createServiceClient } from '@/lib/supabase/service';

// Keep-warm cron: a tiny daily query against Postgres so the free-tier Supabase
// project never reaches the ~7-day inactivity threshold that triggers an
// auto-pause (and the multi-second cold restore on next access).
//
// Wired to Vercel Cron via `vercel.json`. Runs server-side with no user session,
// so it uses the service-role client to guarantee a real query reaches the DB.
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  // Vercel Cron attaches `Authorization: Bearer <CRON_SECRET>` when the
  // CRON_SECRET env var is set.
  //
  // Fail closed in production: an unset secret there would leave the endpoint
  // open to anonymous pings, so refuse to serve rather than silently skipping
  // the check. Locally the secret is optional so `curl localhost` still works.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return new Response('CRON_SECRET is not configured', { status: 503 });
    }
  } else if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = createServiceClient();

  // HEAD count: executes against Postgres without shipping any rows back.
  const { error, count } = await supabase
    .from('families')
    .select('*', { head: true, count: 'exact' });

  const elapsedMs = Date.now() - startedAt;

  if (error) {
    return Response.json({ ok: false, error: error.message, elapsedMs }, { status: 500 });
  }

  return Response.json({ ok: true, families: count ?? 0, elapsedMs });
}
