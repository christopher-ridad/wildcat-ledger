// Removes a deleted transaction's uploaded documents from Storage, called
// by approvePendingChange (see useLedgerMutations.ts) right after a delete
// request is approved. Has to run server-side: storage.objects has no
// client-facing delete RLS policy (see 0002_storage.sql), so only the
// service role can actually remove an object.
//
// Re-checks can_manage_org itself using the caller's own forwarded auth,
// rather than trusting the client to have already gated the call correctly
// -- the RPC that actually deletes the transaction row
// (resolve_pending_change_with_audit) is still the only place the real
// approval decision is made; this only ever removes files for an org the
// caller could already manage, and only paths under that org's own Storage
// prefix (see filterPathsForOrg in paths.ts).
//
// SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY are provided
// automatically to every deployed Edge Function -- no new secrets need to
// be configured for this to work.
// A direct URL import, not the '@supabase/supabase-js' bare specifier from
// deno.json's import map -- deploying without Docker uses a remote bundler
// that only picks up this function's own files, not that shared import
// map, and fails to resolve the bare specifier. A URL import needs no
// import map at all, so it works the same way locally (deno test) and
// deployed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { filterPathsForOrg } from './paths.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'documents';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header.');

    const { orgId, paths } = await req.json();
    if (!orgId || typeof orgId !== 'string') throw new Error('orgId is required.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Runs as the calling user (their JWT is forwarded, not the service
    // role), so this only ever confirms what that user is already allowed
    // to do -- it doesn't grant anything new.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: canManage, error: authError } = await callerClient.rpc(
      'can_manage_org',
      {
        p_org_id: orgId,
      },
    );
    if (authError) throw authError;
    if (!canManage) {
      return jsonResponse({ error: 'Not authorized for this organization.' }, 403);
    }

    const validPaths = filterPathsForOrg(paths, orgId);
    if (validPaths.length === 0) return jsonResponse({ removed: 0 });

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: removeError } = await serviceClient.storage
      .from(BUCKET)
      .remove(validPaths);
    if (removeError) throw removeError;

    return jsonResponse({ removed: validPaths.length });
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 400);
  }
});
