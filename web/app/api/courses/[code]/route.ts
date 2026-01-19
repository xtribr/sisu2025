import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface RouteParams {
  params: Promise<{ code: string }>
}

/**
 * GET /api/courses/[code]
 * Get full course data by SISU code
 *
 * Returns course info, weights, and latest cut scores
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { code: codeStr } = await params
  const code = parseInt(codeStr)

  if (isNaN(code)) {
    return NextResponse.json(
      { error: 'Invalid course code' },
      { status: 400 }
    )
  }

  try {
    // Get by SISU Code (the URL param is the SISU code, not internal ID)
    const result = await supabase.getFullCourseData(code)

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Course not found' },
        { status: 404 }
      )
    }

    // Transform cut scores to a more usable format
    const course = result.data
    const scoresByYear = new Map<number, typeof course.cut_scores>()

    for (const score of course.cut_scores) {
      const year = score.year
      if (!scoresByYear.has(year)) {
        scoresByYear.set(year, [])
      }
      scoresByYear.get(year)!.push(score)
    }

    // Get latest weights
    const latestWeights = course.weights[0] || null

    return NextResponse.json({
      course: {
        code: course.code,
        name: course.name,
        university: course.university,
        campus: course.campus,
        city: course.city,
        state: course.state,
        degree: course.degree,
        schedule: course.schedule,
        location: {
          latitude: course.latitude,
          longitude: course.longitude,
        },
      },
      weights: latestWeights ? {
        year: latestWeights.year,
        pesos: {
          redacao: latestWeights.peso_red,
          linguagens: latestWeights.peso_ling,
          matematica: latestWeights.peso_mat,
          humanas: latestWeights.peso_ch,
          natureza: latestWeights.peso_cn,
        },
        minimos: {
          redacao: latestWeights.min_red,
          linguagens: latestWeights.min_ling,
          matematica: latestWeights.min_mat,
          humanas: latestWeights.min_ch,
          natureza: latestWeights.min_cn,
          enem: latestWeights.min_enem,
        },
      } : null,
      cut_scores: Array.from(scoresByYear.entries()).map(([year, scores]) => ({
        year,
        modalities: scores.map(s => ({
          code: s.modality_code,
          name: s.modality_name,
          cut_score: s.cut_score,
          applicants: s.applicants,
          vacancies: s.vacancies,
          updated_at: s.captured_at,
          partial_scores: s.partial_scores || [],
        })),
      })),
      weights_history: course.weights.map(w => ({
        year: w.year,
        pesos: {
          redacao: w.peso_red,
          linguagens: w.peso_ling,
          matematica: w.peso_mat,
          humanas: w.peso_ch,
          natureza: w.peso_cn,
        },
      })),
    })
  } catch (error) {
    console.error('Error fetching course:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
