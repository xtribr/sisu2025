/**
 * Supabase Server Client
 * Uses service_role key for backend operations only
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sisymqzxvuktdcbsbpbp.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

// Log environment status for debugging
console.log('Supabase Config:', {
  url: SUPABASE_URL,
  hasKey: !!SUPABASE_SERVICE_KEY,
  keyLength: SUPABASE_SERVICE_KEY.length
})

interface SupabaseResponse<T> {
  data: T | null
  error: string | null
  count?: number
}

class SupabaseServer {
  private url: string
  private headers: Record<string, string>

  constructor() {
    this.url = SUPABASE_URL
    this.headers = {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    }
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<SupabaseResponse<T>> {
    try {
      const response = await fetch(`${this.url}/rest/v1/${endpoint}`, {
        ...options,
        cache: 'no-store',
        headers: {
          ...this.headers,
          ...options.headers,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        return { data: null, error }
      }

      const data = await response.json()
      const contentRange = response.headers.get('content-range')
      const count = contentRange ? parseInt(contentRange.split('/')[1]) : undefined

      return { data, error: null, count }
    } catch (error) {
      return { data: null, error: String(error) }
    }
  }

  /**
   * Search courses by name, university, or city
   */
  async searchCourses(query: string, limit = 20) {
    const params = new URLSearchParams({
      or: `(name.ilike.%${query}%,university.ilike.%${query}%,city.ilike.%${query}%)`,
      order: 'name',
      limit: String(limit),
    })

    return this.request<Course[]>(`courses?${params}`)
  }

  /**
   * Get all courses (paginated)
   */
  async getCourses(limit = 50, offset = 0) {
    const params = new URLSearchParams({
      order: 'name',
      limit: String(limit),
      offset: String(offset),
    })

    return this.request<Course[]>(`courses?${params}`, {
      headers: { 'Prefer': 'count=exact' },
    })
  }

  /**
   * Get course by SISU code
   */
  async getCourseByCode(code: number) {
    const params = new URLSearchParams({
      code: `eq.${code}`,
    })

    const result = await this.request<Course[]>(`courses?${params}`)
    return {
      data: result.data?.[0] || null,
      error: result.error,
    }
  }

  /**
   * Get course weights for a specific year
   */
  async getCourseWeights(courseId: number, year?: number) {
    const params = new URLSearchParams({
      course_id: `eq.${courseId}`,
      order: 'year.desc',
    })
    if (year) {
      params.set('year', `eq.${year}`)
    }

    return this.request<CourseWeights[]>(`course_weights?${params}`)
  }

  /**
   * Get latest cut scores for a course
   */
  async getLatestCutScores(courseId: number, year?: number) {
    const params = new URLSearchParams({
      course_id: `eq.${courseId}`,
      order: 'captured_at.desc',
    })
    if (year) {
      params.set('year', `eq.${year}`)
    }

    return this.request<CutScore[]>(`cut_scores?${params}`)
  }

  /**
   * Get course by ID
   */
  async getCourseById(id: number) {
    const params = new URLSearchParams({
      id: `eq.${id}`,
    })

    const result = await this.request<Course[]>(`courses?${params}`)
    return {
      data: result.data?.[0] || null,
      error: result.error,
    }
  }

  /**
   * Get full course data by ID with weights and cut scores
   */
  async getFullCourseDataById(id: number) {
    // Get course
    const courseResult = await this.getCourseById(id)
    if (!courseResult.data) {
      return { data: null, error: courseResult.error || 'Course not found' }
    }

    const course = courseResult.data
    const courseId = course.id

    // Get weights and cut scores in parallel
    const [weightsResult, scoresResult] = await Promise.all([
      this.getCourseWeights(courseId),
      this.getLatestCutScores(courseId),
    ])

    // Group cut scores by modality (latest only)
    const latestScores = new Map<string, CutScore>()
    for (const score of scoresResult.data || []) {
      const key = `${score.year}-${score.modality_code}`
      if (!latestScores.has(key)) {
        latestScores.set(key, score)
      }
    }

    return {
      data: {
        ...course,
        weights: weightsResult.data || [],
        cut_scores: Array.from(latestScores.values()),
      },
      error: null,
    }
  }

  /**
   * Get full course data with weights and cut scores
   */
  async getFullCourseData(code: number) {
    // Get course
    const courseResult = await this.getCourseByCode(code)
    if (!courseResult.data) {
      return { data: null, error: courseResult.error || 'Course not found' }
    }

    const course = courseResult.data
    const courseId = course.id

    // Get weights and cut scores in parallel
    const [weightsResult, scoresResult] = await Promise.all([
      this.getCourseWeights(courseId),
      this.getLatestCutScores(courseId),
    ])

    // Group cut scores by modality (latest only)
    const latestScores = new Map<string, CutScore>()
    for (const score of scoresResult.data || []) {
      const key = `${score.year}-${score.modality_code}`
      if (!latestScores.has(key)) {
        latestScores.set(key, score)
      }
    }

    return {
      data: {
        ...course,
        weights: weightsResult.data || [],
        cut_scores: Array.from(latestScores.values()),
      },
      error: null,
    }
  }

  /**
   * Get approved students for a course
   */
  async getApprovedStudents(courseId: number, page = 1, limit = 50, year?: number) {
    const offset = (page - 1) * limit

    // If no year specified, first find the latest year with data
    if (!year) {
      const latestYearResult = await this.request<ApprovedStudent[]>(
        `approved_students?course_id=eq.${courseId}&select=year&order=year.desc&limit=1`
      )
      if (latestYearResult.data && latestYearResult.data.length > 0) {
        year = latestYearResult.data[0].year
      }
    }

    const params = new URLSearchParams({
      course_id: `eq.${courseId}`,
      order: 'rank.asc',
      limit: String(limit),
      offset: String(offset),
    })

    // Filter by year if we have one
    if (year) {
      params.set('year', `eq.${year}`)
    }

    return this.request<ApprovedStudent[]>(`approved_students?${params}`, {
      headers: { 'Prefer': 'count=exact' },
    })
  }
}

// Types
export interface Course {
  id: number
  code: number
  name: string
  university: string | null
  campus: string | null
  city: string | null
  state: string | null
  degree: string | null
  schedule: string | null
  latitude: string | null
  longitude: string | null
  created_at: string
}

export interface CourseWeights {
  id: number
  course_id: number
  year: number
  peso_red: number | null
  peso_ling: number | null
  peso_mat: number | null
  peso_ch: number | null
  peso_cn: number | null
  min_red: number | null
  min_ling: number | null
  min_mat: number | null
  min_ch: number | null
  min_cn: number | null
  min_enem: number | null
}

export interface CutScore {
  id: number
  course_id: number
  year: number
  modality_code: number | null
  modality_name: string
  cut_score: number | null
  applicants: number | null
  vacancies: number | null
  captured_at: string
  partial_scores?: Array<{ day: string; score: number }>
}

export interface FullCourseData extends Course {
  weights: CourseWeights[]
  cut_scores: CutScore[]
}

export interface ApprovedStudent {
  id: number
  course_id: number
  year: number
  modality_code: number
  rank: number
  name: string
  score: number
  bonus: number
  call_number: number
  status: string
}

// Export singleton instance
export const supabase = new SupabaseServer()
