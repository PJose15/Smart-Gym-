import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/dev/seed
 * Seeds mock data for local development.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.
 * Body: { email: string } — the email of the signed-up user to make gym owner.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Seed disabled in production' }, { status: 403 })
  }

  let admin
  try {
    admin = getSupabaseAdmin()
  } catch {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY not configured. Add it to apps/web-admin/.env' },
      { status: 500 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const email = body.email as string | undefined

  if (!email) {
    return NextResponse.json({ error: 'Missing email in request body' }, { status: 400 })
  }

  try {
    // 1. Find the auth user
    const { data: authList, error: authErr } = await admin.auth.admin.listUsers()
    if (authErr) throw authErr
    const authUser = authList.users.find((u) => u.email === email)
    if (!authUser) {
      return NextResponse.json({ error: `No auth user found for ${email}` }, { status: 404 })
    }
    const userId = authUser.id

    // 2. Upsert into public.users
    await admin.from('users').upsert({
      id: userId,
      email,
      display_name: authUser.user_metadata?.display_name || email.split('@')[0],
      first_name: authUser.user_metadata?.display_name || 'Admin',
      platform_role: 'gym_owner',
    }, { onConflict: 'id' })

    // 3. Create gym
    const { data: gym, error: gymErr } = await admin.from('gyms').insert({
      name: 'Nexera Fitness Lab',
      slug: 'nexera-fitness-lab',
      owner_id: userId,
      gym_type: 'independent',
      description: 'AI-powered strength & conditioning facility',
      member_count_estimate: 120,
      address: '123 Fitness Ave, San Juan',
      city: 'San Juan',
      country: 'PR',
      phone: '+1-787-555-0100',
      subscription_tier: 'pro',
      subscription_status: 'active',
      is_active: true,
    }).select('id').single()

    if (gymErr) {
      // Gym might already exist
      if (gymErr.code === '23505') {
        const { data: existing } = await admin.from('gyms').select('id').eq('slug', 'nexera-fitness-lab').single()
        if (existing) return await seedGymData(admin, existing.id, userId, email)
      }
      throw gymErr
    }

    return await seedGymData(admin, gym.id, userId, email)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Seed failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function seedGymData(admin: SupabaseClient, gymId: string, ownerId: string, ownerEmail: string) {
  const results: string[] = []

  // 4. Gym membership for owner
  await admin.from('gym_memberships').upsert({
    user_id: ownerId,
    gym_id: gymId,
    role: 'owner',
    status: 'active',
  }, { onConflict: 'user_id,gym_id' })
  results.push('gym_membership: owner')

  // 5. Create trainer user
  const trainerEmail = 'trainer@nexera-demo.com'
  let trainerId: string
  const { data: existingTrainer } = await admin.auth.admin.listUsers()
  const foundTrainer = existingTrainer?.users?.find((u: { email?: string }) => u.email === trainerEmail)

  if (foundTrainer) {
    trainerId = foundTrainer.id
  } else {
    const { data: newTrainer, error: trainerErr } = await admin.auth.admin.createUser({
      email: trainerEmail,
      password: 'trainer123',
      email_confirm: true,
      user_metadata: { display_name: 'Carlos Rivera' },
    })
    if (trainerErr) throw trainerErr
    trainerId = newTrainer.user.id
  }

  await admin.from('users').upsert({
    id: trainerId,
    email: trainerEmail,
    display_name: 'Carlos Rivera',
    first_name: 'Carlos',
    platform_role: 'trainer',
  }, { onConflict: 'id' })

  await admin.from('gym_memberships').upsert({
    user_id: trainerId,
    gym_id: gymId,
    role: 'trainer',
    status: 'active',
  }, { onConflict: 'user_id,gym_id' })
  results.push('trainer: Carlos Rivera')

  // 6. Machines
  const machines = [
    { name: 'Bench Press Station', brand: 'Rogue', model: 'Monster Bench', category: 'strength', muscle_groups: ['chest', 'triceps', 'shoulders'], qr_slug: 'bench-press-1', location_in_gym: 'Zone A - Free Weights' },
    { name: 'Squat Rack', brand: 'Rogue', model: 'Monster Squat Stand', category: 'strength', muscle_groups: ['quads', 'glutes', 'hamstrings'], qr_slug: 'squat-rack-1', location_in_gym: 'Zone A - Free Weights' },
    { name: 'Deadlift Platform', brand: 'Rogue', model: 'Oly Platform', category: 'strength', muscle_groups: ['back', 'glutes', 'hamstrings'], qr_slug: 'deadlift-1', location_in_gym: 'Zone A - Free Weights' },
    { name: 'Lat Pulldown', brand: 'Life Fitness', model: 'Pro2 SE', category: 'cable', muscle_groups: ['back', 'biceps'], qr_slug: 'lat-pulldown-1', location_in_gym: 'Zone B - Cables' },
    { name: 'Cable Crossover', brand: 'Life Fitness', model: 'Dual Adjustable Pulley', category: 'cable', muscle_groups: ['chest', 'shoulders'], qr_slug: 'cable-cross-1', location_in_gym: 'Zone B - Cables' },
    { name: 'Leg Press', brand: 'Hammer Strength', model: 'Linear Leg Press', category: 'strength', muscle_groups: ['quads', 'glutes'], qr_slug: 'leg-press-1', location_in_gym: 'Zone C - Machines' },
    { name: 'Shoulder Press Machine', brand: 'Hammer Strength', model: 'Plate-Loaded', category: 'strength', muscle_groups: ['shoulders', 'triceps'], qr_slug: 'shoulder-press-1', location_in_gym: 'Zone C - Machines' },
    { name: 'Treadmill', brand: 'Technogym', model: 'Run Personal', category: 'cardio', muscle_groups: ['quads', 'calves'], qr_slug: 'treadmill-1', location_in_gym: 'Zone D - Cardio' },
    { name: 'Rowing Machine', brand: 'Concept2', model: 'Model D', category: 'cardio', muscle_groups: ['back', 'legs', 'core'], qr_slug: 'rower-1', location_in_gym: 'Zone D - Cardio' },
    { name: 'Smith Machine', brand: 'Life Fitness', model: 'Signature Series', category: 'strength', muscle_groups: ['chest', 'shoulders', 'quads'], qr_slug: 'smith-1', location_in_gym: 'Zone A - Free Weights' },
  ]

  for (const m of machines) {
    await admin.from('machines').upsert({
      ...m,
      gym_id: gymId,
      is_active: true,
    }, { onConflict: 'qr_slug' })
  }
  results.push(`machines: ${machines.length}`)

  // 7. Members
  const memberData = [
    { display_name: 'Maria Santos', first_name: 'Maria', email: 'maria@example.com', phone: '+17875550101', primary_goal: 'muscle-gain', experience_level: 'intermediate', smartgym_score: 78, current_streak: 12 },
    { display_name: 'Jose Ortiz', first_name: 'Jose', email: 'jose@example.com', phone: '+17875550102', primary_goal: 'strength', experience_level: 'advanced', smartgym_score: 92, current_streak: 24 },
    { display_name: 'Ana Rodriguez', first_name: 'Ana', email: 'ana@example.com', phone: '+17875550103', primary_goal: 'weight-loss', experience_level: 'beginner', smartgym_score: 45, current_streak: 5 },
    { display_name: 'Luis Garcia', first_name: 'Luis', email: 'luis@example.com', phone: '+17875550104', primary_goal: 'endurance', experience_level: 'intermediate', smartgym_score: 67, current_streak: 8 },
    { display_name: 'Carmen Diaz', first_name: 'Carmen', email: 'carmen@example.com', phone: '+17875550105', primary_goal: 'general-fitness', experience_level: 'beginner', smartgym_score: 38, current_streak: 3 },
    { display_name: 'Miguel Torres', first_name: 'Miguel', email: 'miguel@example.com', phone: '+17875550106', primary_goal: 'muscle-gain', experience_level: 'advanced', smartgym_score: 88, current_streak: 30 },
    { display_name: 'Sofia Ramos', first_name: 'Sofia', email: 'sofia@example.com', phone: '+17875550107', primary_goal: 'strength', experience_level: 'intermediate', smartgym_score: 71, current_streak: 15 },
    { display_name: 'Diego Mendez', first_name: 'Diego', email: 'diego@example.com', phone: '+17875550108', primary_goal: 'muscle-gain', experience_level: 'intermediate', smartgym_score: 62, current_streak: 9 },
  ]

  const memberIds: string[] = []
  for (const m of memberData) {
    const { data: inserted } = await admin.from('members').upsert({
      ...m,
      gym_id: gymId,
      assigned_trainer_id: trainerId,
      onboarding_status: 'active',
      is_active: true,
      status: 'active',
    }, { onConflict: 'gym_id,phone' }).select('id').single()
    if (inserted) memberIds.push(inserted.id)
  }
  results.push(`members: ${memberIds.length}`)

  // 8. Workout sessions (recent activity)
  const { data: machineRows } = await admin.from('machines').select('id, name').eq('gym_id', gymId).limit(10)
  const machineIds = machineRows?.map((m: { id: string }) => m.id) || []

  if (memberIds.length > 0 && machineIds.length > 0) {
    const sessions = []
    const now = new Date()

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const day = new Date(now)
      day.setDate(day.getDate() - dayOffset)
      const dateStr = day.toISOString().split('T')[0]

      // 2-4 sessions per day
      const count = 2 + Math.floor(Math.random() * 3)
      for (let s = 0; s < count; s++) {
        const memberId = memberIds[Math.floor(Math.random() * memberIds.length)]
        const machineId = machineIds[Math.floor(Math.random() * machineIds.length)]
        const sets = []
        const numSets = 3 + Math.floor(Math.random() * 2)
        let totalVolume = 0
        let bestWeight = 0

        for (let i = 0; i < numSets; i++) {
          const weight = 45 + Math.floor(Math.random() * 200)
          const reps = 5 + Math.floor(Math.random() * 12)
          totalVolume += weight * reps
          if (weight > bestWeight) bestWeight = weight
          sets.push({ weight, reps, rpe: 6 + Math.floor(Math.random() * 4) })
        }

        sessions.push({
          gym_id: gymId,
          machine_id: machineId,
          member_id: memberId,
          session_date: dateStr,
          workout_mode: 'free',
          sets,
          sets_count: numSets,
          total_volume_lbs: totalVolume,
          best_weight_lbs: bestWeight,
          best_reps: sets[0].reps,
          is_personal_best: Math.random() > 0.7,
          personal_best_type: Math.random() > 0.5 ? 'weight' : 'volume',
        })
      }
    }

    const { error: sessErr } = await admin.from('workout_sessions').insert(sessions)
    if (sessErr && sessErr.code !== '23505') {
      results.push(`workout_sessions: error - ${sessErr.message}`)
    } else {
      results.push(`workout_sessions: ${sessions.length}`)
    }
  }

  // 9. Programs
  if (memberIds.length >= 3) {
    const programs = [
      {
        member_id: memberIds[0],
        gym_id: gymId,
        title: 'Hypertrophy Push/Pull/Legs',
        description: '12-week muscle building program focused on progressive overload',
        goal: 'muscle-gain',
        experience_level: 'intermediate',
        duration_weeks: 12,
        sessions_per_week: 4,
        focus: 'hypertrophy',
        generated_by: 'ai',
        is_active: true,
        week_number: 3,
        sessions_completed: 10,
        sessions_total: 48,
        on_track: true,
        program_data: { weeks: [] },
      },
      {
        member_id: memberIds[1],
        gym_id: gymId,
        title: '5/3/1 Strength Foundation',
        description: 'Wendler 5/3/1 progression for compound lifts',
        goal: 'strength',
        experience_level: 'advanced',
        duration_weeks: 16,
        sessions_per_week: 4,
        focus: 'strength',
        generated_by: 'ai',
        is_active: true,
        week_number: 6,
        sessions_completed: 22,
        sessions_total: 64,
        on_track: true,
        program_data: { weeks: [] },
      },
      {
        member_id: memberIds[2],
        gym_id: gymId,
        title: 'Beginner Full Body',
        description: 'Introduction to resistance training with full-body sessions',
        goal: 'general-fitness',
        experience_level: 'beginner',
        duration_weeks: 8,
        sessions_per_week: 3,
        focus: 'full-body',
        generated_by: 'trainer',
        trainer_approved: true,
        is_active: true,
        week_number: 2,
        sessions_completed: 4,
        sessions_total: 24,
        on_track: true,
        program_data: { weeks: [] },
      },
    ]

    const { error: progErr } = await admin.from('ai_programs').insert(programs)
    if (progErr && progErr.code !== '23505') {
      results.push(`programs: error - ${progErr.message}`)
    } else {
      results.push(`programs: ${programs.length}`)
    }
  }

  return NextResponse.json({
    success: true,
    gym_id: gymId,
    owner: ownerEmail,
    seeded: results,
  })
}
