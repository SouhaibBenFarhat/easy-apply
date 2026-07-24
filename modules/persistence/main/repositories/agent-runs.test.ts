// @vitest-environment node
import { fileURLToPath } from 'node:url'
import type { AppDatabase } from '@persistence/main'
import {
  agentRuns,
  appendAgentStep,
  createDatabase,
  finishAgentRun,
  getAgentRunSteps,
  listAgentRuns,
  pruneAgentRuns,
  reconcileStaleRuns,
  startAgentRun,
} from '@persistence/main'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const migrationsFolder = fileURLToPath(new URL('../../../../drizzle', import.meta.url))

let db: AppDatabase

beforeAll(async () => {
  db = await createDatabase({ migrationsFolder })
})
afterAll(async () => {
  await db.close()
})
beforeEach(async () => {
  await db.drizzle.delete(agentRuns) // steps cascade
})

describe('agent run lifecycle', () => {
  it('opens a run, appends steps, and finishes it', async () => {
    const runId = await startAgentRun(db, {
      trigger: 'manual',
      startedAt: '2026-07-24T09:00:00.000Z',
    })

    await appendAgentStep(db, runId, {
      seq: 0,
      at: '2026-07-24T09:00:00.000Z',
      channel: 'sync',
      label: 'Sync started',
    })
    await appendAgentStep(db, runId, {
      seq: 1,
      at: '2026-07-24T09:00:42.000Z',
      channel: 'pipeline',
      label: 'Backend roles · 2 job(s)',
      status: 'done',
      durationMs: 42_000,
      jobs: [
        {
          id: 'linkedin:1',
          title: 'Dev',
          company: 'Acme',
          location: 'München',
          source: 'LinkedIn',
          url: 'https://x/1',
        },
      ],
    })
    await finishAgentRun(db, runId, {
      status: 'completed',
      finishedAt: '2026-07-24T09:01:00.000Z',
      emailsTotal: 12,
      emailsProcessed: 12,
      jobsKept: 2,
    })

    const [run] = await listAgentRuns(db)
    expect(run).toMatchObject({
      id: runId,
      status: 'completed',
      trigger: 'manual',
      emailsTotal: 12,
      jobsKept: 2,
      stepCount: 2,
    })
    expect(run?.finishedAt).toBe('2026-07-24T09:01:00.000Z')
  })

  it('reads back steps in seq order, shaped like the live trace (jobs preserved)', async () => {
    const runId = await startAgentRun(db, {
      trigger: 'scheduled',
      startedAt: '2026-07-24T09:00:00.000Z',
    })
    // Insert out of order to prove ordering is by seq.
    await appendAgentStep(db, runId, {
      seq: 2,
      at: '2026-07-24T09:00:02.000Z',
      channel: 'sync',
      label: 'c',
    })
    await appendAgentStep(db, runId, {
      seq: 0,
      at: '2026-07-24T09:00:00.000Z',
      channel: 'sync',
      label: 'a',
    })
    await appendAgentStep(db, runId, {
      seq: 1,
      at: '2026-07-24T09:00:01.000Z',
      channel: 'llm',
      label: 'Response · 96 chars',
      body: '[]',
      chars: 96,
    })

    const steps = await getAgentRunSteps(db, runId)
    expect(steps.map((s) => s.label)).toEqual(['a', 'Response · 96 chars', 'c'])
    expect(steps[1]).toMatchObject({ channel: 'llm', body: '[]', chars: 96 })
    // An unstated status is absent, not null — matches AgentTraceEvent's optionals.
    expect(steps[0]?.status).toBeUndefined()
  })

  it('cascade-deletes steps when its run is pruned', async () => {
    // 3 runs, keep 2 → the oldest is pruned with its steps.
    for (const [i, ts] of ['09:00', '09:05', '09:10'].entries()) {
      const id = await startAgentRun(db, {
        trigger: 'manual',
        startedAt: `2026-07-24T${ts}:00.000Z`,
      })
      await appendAgentStep(db, id, {
        seq: 0,
        at: `2026-07-24T${ts}:00.000Z`,
        channel: 'sync',
        label: `run ${i}`,
      })
    }
    const pruned = await pruneAgentRuns(db, 2)
    expect(pruned).toBe(1)
    const runs = await listAgentRuns(db)
    expect(runs).toHaveLength(2)
    // No orphaned steps: the pruned run's step is gone.
    const allSteps = runs.flatMap((r) => r.stepCount)
    expect(allSteps).toEqual([1, 1])
  })

  it('reconciles a run left running by a crash to stopped', async () => {
    await startAgentRun(db, { trigger: 'manual', startedAt: '2026-07-24T09:00:00.000Z' })
    const fixed = await reconcileStaleRuns(db)
    expect(fixed).toBe(1)
    const [run] = await listAgentRuns(db)
    expect(run?.status).toBe('stopped')
  })
})
