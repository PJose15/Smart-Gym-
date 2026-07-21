# -*- coding: utf-8 -*-
import io

def patch(p, subs, imp=None, after=None):
    s = io.open(p, encoding='utf8').read()
    for old, new in subs:
        n = s.count(old)
        assert n == 1, (p, old[:60], n)
        s = s.replace(old, new)
    if imp and imp not in s:
        assert after in s
        s = s.replace(after, after + "\n" + imp, 1)
    io.open(p, 'w', encoding='utf8', newline='').write(s)
    print('patched', p)

# 1. agents/trigger - wrap forward fetch chain
patch('src/app/api/agents/trigger/route.ts',
  [("    if (webhookUrl) {\n      fetch(webhookUrl, {",
    "    if (webhookUrl) {\n      runAfterResponse(fetch(webhookUrl, {"),
   ("        }\n      });\n    }\n\n    return NextResponse.json({ success: true, log_id: logRow?.id ?? null });",
    "        }\n      }));\n    }\n\n    return NextResponse.json({ success: true, log_id: logRow?.id ?? null });")],
  imp="import { runAfterResponse } from '@/lib/asyncWork';",
  after="import { NextResponse } from 'next/server';")

# 2. session-complete - wrap ALL fire-and-forgets
p = 'src/app/api/sessions/[sessionId]/complete/route.ts'
s = io.open(p, encoding='utf8').read()
subs = [
 ("      triggerUptimizeAIAgent('engagement-agent', {\n        event: 'level-up',",
  "      runAfterResponse(triggerUptimizeAIAgent('engagement-agent', {\n        event: 'level-up',"),
 ("}).catch(err => console.error('[session-complete] level-up agent trigger failed:', err instanceof Error ? err.message : 'Unknown error'));",
  "}).catch(err => console.error('[session-complete] level-up agent trigger failed:', err instanceof Error ? err.message : 'Unknown error')));"),
 ("      triggerUptimizeAIAgent('engagement-agent', {\n        event: 'streak-broken',",
  "      runAfterResponse(triggerUptimizeAIAgent('engagement-agent', {\n        event: 'streak-broken',"),
 ("}).catch(err => console.error('[session-complete] streak-broken agent trigger failed:', err instanceof Error ? err.message : 'Unknown error'));",
  "}).catch(err => console.error('[session-complete] streak-broken agent trigger failed:', err instanceof Error ? err.message : 'Unknown error')));"),
 ("    generateSessionFeedEvents(admin, {",
  "    runAfterResponse(generateSessionFeedEvents(admin, {"),
 ("      leveled_up: achievements.leveledUp,\n      new_level: achievements.newLevel?.level ?? null,\n    });",
  "      leveled_up: achievements.leveledUp,\n      new_level: achievements.newLevel?.level ?? null,\n    }).catch(err => console.error('[session-complete] feed event generation failed:', err instanceof Error ? err.message : 'Unknown error')));"),
 ("    updateChallengeScores(admin, member_id, session.gym_id, {",
  "    runAfterResponse(updateChallengeScores(admin, member_id, session.gym_id, {"),
 ("      machine_id: null,\n      session_id: session.id,\n    });",
  "      machine_id: null,\n      session_id: session.id,\n    }).catch(err => console.error('[session-complete] challenge scoring failed:', err instanceof Error ? err.message : 'Unknown error')));"),
 ("    triggerUptimizeAIAgent('engagement-agent', {\n      event: 'leaderboard-updated',",
  "    runAfterResponse(triggerUptimizeAIAgent('engagement-agent', {\n      event: 'leaderboard-updated',"),
 ("}).catch(err => console.error('[session-complete] leaderboard-updated agent trigger failed:', err instanceof Error ? err.message : 'Unknown error'));",
  "}).catch(err => console.error('[session-complete] leaderboard-updated agent trigger failed:', err instanceof Error ? err.message : 'Unknown error')));"),
 ("    sendSessionCompletePush({",
  "    runAfterResponse(sendSessionCompletePush({"),
 ("}).catch(err => console.error('[session-complete] push failed:', err instanceof Error ? err.message : 'Unknown error'));",
  "}).catch(err => console.error('[session-complete] push failed:', err instanceof Error ? err.message : 'Unknown error')));"),
 ("    invalidateAndRefreshReadiness(member_id, session.gym_id, admin).catch(() => {});",
  "    runAfterResponse(invalidateAndRefreshReadiness(member_id, session.gym_id, admin).catch(() => {}));"),
 ("    invalidateAndRefreshMuscleMap(member_id, session.gym_id, admin).catch(() => {});",
  "    runAfterResponse(invalidateAndRefreshMuscleMap(member_id, session.gym_id, admin).catch(() => {}));"),
]
for old, new in subs:
    assert s.count(old) == 1, (old[:70], s.count(old))
    s = s.replace(old, new)
first_import = s.split('\n')[0]
s = s.replace(first_import, first_import + "\nimport { runAfterResponse } from '@/lib/asyncWork';", 1)
io.open(p, 'w', encoding='utf8', newline='').write(s)
print('patched', p)

# 3. onboard/register
patch('src/app/api/onboard/register/route.ts',
  [("  triggerUptimizeAIAgent('growth-agent', {\n    event: 'new-gym-onboarded',",
    "  runAfterResponse(triggerUptimizeAIAgent('growth-agent', {\n    event: 'new-gym-onboarded',"),
   ("  }).catch((err: unknown) => {\n    console.error('[onboard/register] new-gym-onboarded trigger failed:', err);\n  });",
    "  }).catch((err: unknown) => {\n    console.error('[onboard/register] new-gym-onboarded trigger failed:', err);\n  }));")],
  imp="import { runAfterResponse } from '@/lib/asyncWork';",
  after="import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';")

# 4. sessionPush
patch('src/lib/notifications/sessionPush.ts',
  [("  sendNotification({\n    gym_id,\n    member_id,",
    "  runAfterResponse(sendNotification({\n    gym_id,\n    member_id,"),
   ("  }).catch(err =>\n    console.error('[sessionPush] push dispatch failed:', err instanceof Error ? err.message : 'Unknown error')\n  );",
    "  }).catch(err =>\n    console.error('[sessionPush] push dispatch failed:', err instanceof Error ? err.message : 'Unknown error')\n  ));")],
  imp="import { runAfterResponse } from '@/lib/asyncWork';")

# 5. billing/webhook - 3 trigger chains + 3 IIFEs
p = 'src/app/api/billing/webhook/route.ts'
s = io.open(p, encoding='utf8').read()
pairs = [
 ("          triggerUptimizeAIAgent('retention-agent', {", "          runAfterResponse(triggerUptimizeAIAgent('retention-agent', {"),
 ("}).catch(err => console.error('[webhook] retention-agent trigger failed:', err instanceof Error ? err.message : 'Unknown error'));", "}).catch(err => console.error('[webhook] retention-agent trigger failed:', err instanceof Error ? err.message : 'Unknown error')));"),
 ("          triggerUptimizeAIAgent('revenue-agent', {", "          runAfterResponse(triggerUptimizeAIAgent('revenue-agent', {"),
 ("}).catch(err => console.error('[webhook] revenue-agent trigger failed:', err instanceof Error ? err.message : 'Unknown error'));", "}).catch(err => console.error('[webhook] revenue-agent trigger failed:', err instanceof Error ? err.message : 'Unknown error')));"),
 ("          triggerUptimizeAIAgent('engagement-agent', {", "          runAfterResponse(triggerUptimizeAIAgent('engagement-agent', {"),
 ("}).catch(err => console.error('[webhook] engagement-agent trigger failed:', err instanceof Error ? err.message : 'Unknown error'));", "}).catch(err => console.error('[webhook] engagement-agent trigger failed:', err instanceof Error ? err.message : 'Unknown error')));"),
]
for old, new in pairs:
    assert s.count(old) == 1, (old[:60], s.count(old))
    s = s.replace(old, new)
assert s.count(";(async () => {") == 3
assert s.count("          })();") == 3
s = s.replace(";(async () => {", "runAfterResponse((async () => {")
s = s.replace("          })();", "          })());")
first = s.split('\n')[0]
s = s.replace(first, first + "\nimport { runAfterResponse } from '@/lib/asyncWork';", 1)
io.open(p, 'w', encoding='utf8', newline='').write(s)
print('patched', p)
