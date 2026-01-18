import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/simulate
 * Calculate weighted average for SISU
 *
 * Body:
 *   - course_code: SISU course code
 *   - scores: { redacao, linguagens, matematica, humanas, natureza }
 *   - weights?: optional custom weights (uses course weights if not provided)
 */

interface SimulateRequest {
  course_code?: number
  scores: {
    redacao: number
    linguagens: number
    matematica: number
    humanas: number
    natureza: number
  }
  weights?: {
    redacao: number
    linguagens: number
    matematica: number
    humanas: number
    natureza: number
  }
}

interface SimulateResponse {
  media_ponderada: number
  scores: SimulateRequest['scores']
  weights_used: SimulateRequest['weights']
  course?: {
    code: number
    name: string
    university: string | null
  }
  comparison?: {
    modality: string
    cut_score: number | null
    difference: number | null
    status: 'above' | 'below' | 'equal' | 'unknown'
  }[]
  meets_minimums: boolean
  minimum_issues?: string[]
}

export async function POST(request: NextRequest) {
  let body: SimulateRequest

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Validate scores
  const { scores, course_code, weights: customWeights } = body

  if (!scores) {
    return NextResponse.json(
      { error: 'Missing scores object' },
      { status: 400 }
    )
  }

  const requiredFields = ['redacao', 'linguagens', 'matematica', 'humanas', 'natureza'] as const
  for (const field of requiredFields) {
    if (typeof scores[field] !== 'number' || scores[field] < 0 || scores[field] > 1000) {
      return NextResponse.json(
        { error: `Invalid score for ${field}: must be a number between 0 and 1000` },
        { status: 400 }
      )
    }
  }

  try {
    let weights = customWeights
    let course = null
    let cutScores: { modality_name: string; cut_score: number | null }[] = []
    let minimums: Record<string, number | null> = {}

    // If course_code provided, fetch weights from database
    if (course_code) {
      const result = await supabase.getFullCourseData(course_code)

      if (result.data) {
        course = {
          code: result.data.code,
          name: result.data.name,
          university: result.data.university,
        }

        // Get latest weights
        const latestWeights = result.data.weights[0]
        if (latestWeights && !customWeights) {
          weights = {
            redacao: latestWeights.peso_red || 1,
            linguagens: latestWeights.peso_ling || 1,
            matematica: latestWeights.peso_mat || 1,
            humanas: latestWeights.peso_ch || 1,
            natureza: latestWeights.peso_cn || 1,
          }
          minimums = {
            redacao: latestWeights.min_red,
            linguagens: latestWeights.min_ling,
            matematica: latestWeights.min_mat,
            humanas: latestWeights.min_ch,
            natureza: latestWeights.min_cn,
            enem: latestWeights.min_enem,
          }
        }

        // Get latest cut scores (most recent year)
        const years = Array.from(new Set(result.data.cut_scores.map(s => s.year))).sort((a, b) => b - a)
        if (years.length > 0) {
          cutScores = result.data.cut_scores
            .filter(s => s.year === years[0])
            .map(s => ({
              modality_name: s.modality_name,
              cut_score: s.cut_score,
            }))
        }
      }
    }

    // Use default weights if none provided
    if (!weights) {
      weights = {
        redacao: 1,
        linguagens: 1,
        matematica: 1,
        humanas: 1,
        natureza: 1,
      }
    }

    // Calculate weighted average
    const totalWeight = weights.redacao + weights.linguagens + weights.matematica +
      weights.humanas + weights.natureza

    const weightedSum = (scores.redacao * weights.redacao) +
      (scores.linguagens * weights.linguagens) +
      (scores.matematica * weights.matematica) +
      (scores.humanas * weights.humanas) +
      (scores.natureza * weights.natureza)

    const mediaPonderada = Math.round((weightedSum / totalWeight) * 100) / 100

    // Check minimums
    const minimumIssues: string[] = []
    const scoreMap: Record<string, number> = {
      redacao: scores.redacao,
      linguagens: scores.linguagens,
      matematica: scores.matematica,
      humanas: scores.humanas,
      natureza: scores.natureza,
      enem: mediaPonderada,
    }

    for (const [area, minScore] of Object.entries(minimums)) {
      if (minScore && scoreMap[area] < minScore) {
        minimumIssues.push(`${area}: ${scoreMap[area]} < ${minScore}`)
      }
    }

    // Compare with cut scores
    const comparison = cutScores.map(cs => {
      const cutScore = cs.cut_score
      let status: 'above' | 'below' | 'equal' | 'unknown' = 'unknown'
      let difference: number | null = null

      if (cutScore !== null) {
        difference = Math.round((mediaPonderada - cutScore) * 100) / 100
        if (difference > 0) status = 'above'
        else if (difference < 0) status = 'below'
        else status = 'equal'
      }

      return {
        modality: cs.modality_name,
        cut_score: cutScore,
        difference,
        status,
      }
    })

    const response: SimulateResponse = {
      media_ponderada: mediaPonderada,
      scores,
      weights_used: weights,
      meets_minimums: minimumIssues.length === 0,
    }

    if (course) {
      response.course = course
    }

    if (comparison.length > 0) {
      response.comparison = comparison
    }

    if (minimumIssues.length > 0) {
      response.minimum_issues = minimumIssues
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Simulation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
