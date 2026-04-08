import { handleApproveAndSend } from './approve-and-send.ts';
import { handleDiscard } from './discard.ts';
import { handleGenerateWeeklyDrafts } from './generate-weekly-drafts.ts';
import { handleGenerateWorkoutDraft } from './generate-workout-draft.ts';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();

  switch (action) {
    case 'approve-and-send':
      return handleApproveAndSend(req);
    case 'discard':
      return handleDiscard(req);
    case 'generate-weekly-drafts':
      return handleGenerateWeeklyDrafts(req);
    case 'generate-workout-draft':
      return handleGenerateWorkoutDraft(req);
    default:
      return new Response(
        JSON.stringify({ error: 'Unknown action' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
  }
});
