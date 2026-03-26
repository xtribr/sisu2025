import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getModalityCode } from '@/utils/modality';

// Haversine formula to calculate distance between two points in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Map numeric DB modality codes to string codes used by getModalityCode
const NUMERIC_CODE_MAP: Record<number, string> = {
    41: 'ampla',
    686: 'L1',
    682: 'L2',
    687: 'L5',
    683: 'L6',
    685: 'L9',
    // L10, L13, L14 can be added as needed
    689: 'quilombola',
};

function normalizeModalityCode(code: unknown): string {
    if (code === undefined || code === null || code === '') return 'ampla';
    if (typeof code === 'string') return code;
    if (typeof code === 'number') return NUMERIC_CODE_MAP[code] ?? 'ampla';
    return 'ampla';
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { grades, courseName, modalityCode: rawModalityCode, referenceCourseId } = body;

        // Normalize modalityCode: default to 'ampla' when missing,
        // and convert numeric DB codes to string codes
        const modalityCode = normalizeModalityCode(rawModalityCode);

        console.log('Radar Simulation Request:', { courseName, modalityCode, rawModalityCode, referenceCourseId });

        if (!grades || !courseName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get reference course for location-based sorting
        let refLat: number | null = null;
        let refLon: number | null = null;
        let refState: string | null = null;

        if (referenceCourseId) {
            const { data: refCourse } = await supabase.request<any[]>(
                `courses?id=eq.${referenceCourseId}&select=latitude,longitude,state`
            );
            if (refCourse && refCourse[0]) {
                refLat = parseFloat(refCourse[0].latitude);
                refLon = parseFloat(refCourse[0].longitude);
                refState = refCourse[0].state;
            }
        }

        // Search for courses matching the name
        const selectParams = [
            'id', 'code', 'name', 'university', 'campus', 'city', 'state', 'degree', 'schedule',
            'latitude', 'longitude',
            'course_weights(peso_red,peso_ling,peso_mat,peso_ch,peso_cn,year)',
            'cut_scores(year,modality_name,modality_code,cut_score,vacancies,partial_scores)'
        ].join(',');

        const query = new URLSearchParams({
            select: selectParams,
            name: `ilike.%${courseName}%`,
            limit: '500'
        });

        const { data: courses, error: courseError } = await supabase.request<any[]>(`courses?${query.toString()}`);

        if (courseError) {
            console.error('Supabase Error:', courseError);
            throw courseError;
        }

        console.log(`[Radar] Found ${courses?.length} potential courses for "${courseName}"`);

        if (!courses || courses.length === 0) {
            return NextResponse.json([]);
        }

        const debugInfo: any[] = [];

        // Process each course
        const results = courses.map((course: any) => {
            // Skip the reference course itself
            if (referenceCourseId && course.id === referenceCourseId) {
                return null;
            }

            // Calculate distance if we have reference coordinates
            let distance: number | null = null;
            if (refLat && refLon && course.latitude && course.longitude) {
                const courseLat = parseFloat(course.latitude);
                const courseLon = parseFloat(course.longitude);
                if (!isNaN(courseLat) && !isNaN(courseLon)) {
                    distance = calculateDistance(refLat, refLon, courseLat, courseLon);
                }
            }

            // Get weights (latest year)
            const weightsList = course.course_weights || [];
            const latestWeights = weightsList.sort((a: any, b: any) => b.year - a.year)[0];

            const hasWeights = latestWeights && (
                latestWeights.pesos ||
                (latestWeights.peso_red !== undefined && latestWeights.peso_red !== null)
            );

            if (!hasWeights) {
                if (debugInfo.length < 10) debugInfo.push({ name: course.name, reason: 'No weights' });
                return null;
            }

            const w = latestWeights.pesos || {
                redacao: latestWeights.peso_red,
                linguagens: latestWeights.peso_ling,
                matematica: latestWeights.peso_mat,
                humanas: latestWeights.peso_ch,
                natureza: latestWeights.peso_cn
            };

            const userScore = (
                (grades.redacao * (w.redacao || 1)) +
                (grades.linguagens * (w.linguagens || 1)) +
                (grades.humanas * (w.humanas || 1)) +
                (grades.natureza * (w.natureza || 1)) +
                (grades.matematica * (w.matematica || 1))
            ) / ((w.redacao || 1) + (w.linguagens || 1) + (w.humanas || 1) + (w.natureza || 1) + (w.matematica || 1));

            // Find the LATEST cut score available
            if (!course.cut_scores || course.cut_scores.length === 0) {
                if (debugInfo.length < 10) debugInfo.push({ name: course.name, reason: 'No cut_scores array' });
                return null;
            }

            // Helper to get effective score (prioritize partials for current year)
            const getEffectiveScore = (cs: any) => {
                // For 2026, check partial_scores first (live data)
                if (cs.partial_scores && cs.partial_scores.length > 0) {
                    const sorted = [...cs.partial_scores].sort((a: any, b: any) => {
                        const dayA = parseInt(a.day) || 0;
                        const dayB = parseInt(b.day) || 0;
                        return dayB - dayA;
                    });
                    if (sorted[0]?.score > 0) return sorted[0].score;
                }
                // Fallback to cut_score
                if (cs.cut_score && cs.cut_score > 0) return cs.cut_score;
                return 0;
            };

            // Process all cut scores and find the best match
            const candidates = course.cut_scores
                .map((cs: any) => ({
                    ...cs,
                    _derivedCode: getModalityCode(cs.modality_name),
                    _effectiveScore: getEffectiveScore(cs)
                }))
                .filter((cs: any) => cs._effectiveScore > 0);

            // Sort years descending: 2026 > 2025 > 2024
            const relevantYears = Array.from(new Set(candidates.map((c: any) => c.year)))
                .sort((a: any, b: any) => b - a);

            let finalCutScore = null;
            let finalYear = 0;

            for (const year of relevantYears) {
                const yearModalities = candidates.filter((c: any) => c.year === year);
                let match = null;

                if (modalityCode === 'ampla') {
                    match = yearModalities.find((m: any) => m.modality_name?.toLowerCase().includes('ampla'));
                } else if (modalityCode === 'deficiencia') {
                    match = yearModalities.find((m: any) =>
                        ['L9', 'L10', 'L13', 'L14', 'deficiencia'].includes(m._derivedCode)
                    );
                } else {
                    match = yearModalities.find((m: any) => m._derivedCode === modalityCode);
                }

                if (match) {
                    finalCutScore = match;
                    finalYear = year as number;
                    break;
                }
            }

            if (!finalCutScore) {
                if (debugInfo.length < 10) debugInfo.push({
                    name: course.name,
                    reason: 'No matching cut score',
                    modalityCode
                });
                return null;
            }

            const cutScoreValue = finalCutScore._effectiveScore;
            const difference = userScore - cutScoreValue; // Positive = passing, negative = below

            return {
                courseId: course.id,
                courseCode: course.code,
                name: course.name,
                university: course.university,
                campus: course.campus,
                city: course.city,
                state: course.state,
                degree: course.degree,
                schedule: course.schedule,
                userScore,
                cutScore: cutScoreValue,
                cutScoreYear: finalYear,
                difference, // Raw difference (can be negative)
                margin: difference, // Keep for compatibility
                modalityName: finalCutScore.modality_name,
                vacancies: finalCutScore.vacancies || 0,
                distance: distance ? Math.round(distance) : null // Distance in km
            };
        })
            .filter(Boolean);

        // Sort by difference (closest to passing first, then passing)
        // Smallest absolute difference first, with passing courses prioritized
        results.sort((a: any, b: any) => {
            // Both passing: sort by margin ascending (smallest advantage first)
            if (a.difference >= 0 && b.difference >= 0) {
                return a.difference - b.difference;
            }
            // Both failing: sort by difference descending (closest to passing first)
            if (a.difference < 0 && b.difference < 0) {
                return b.difference - a.difference; // Less negative = closer
            }
            // One passing, one failing: passing first
            return b.difference - a.difference;
        });

        if (results.length === 0) {
            console.log('[Radar] No results found. Debug info:', JSON.stringify(debugInfo, null, 2));
            return NextResponse.json({ results: [], debug: debugInfo });
        }

        return NextResponse.json(results);

    } catch (error) {
        console.error('Radar API Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
