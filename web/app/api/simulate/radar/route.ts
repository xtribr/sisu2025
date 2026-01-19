import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';;
import { getModalityCode, matchModality } from '@/context/ModalityContext';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { grades, courseName, modalityCode } = body;

        console.log('Radar Simulation Request:', { courseName, modalityCode });

        if (!grades || !courseName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Search for courses matching the name (loose match)
        // Construction the PostgREST query
        // We select fields needed for display and calculation
        const selectParams = [
            'id', 'code', 'name', 'university', 'campus', 'city', 'state', 'degree', 'schedule',
            'weights(pesos,year)',
            'cut_scores(year,modality_name,cut_score,vacancies)'
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

        if (!courses || courses.length === 0) {
            return NextResponse.json([]);
        }

        // 2. Process each course to calculate user score and find cut score
        const results = courses.map((course: any) => {
            // A. Get best weights (latest)
            // Weights is an array, we want the latest year
            const latestWeights = course.weights?.sort((a: any, b: any) => b.year - a.year)[0];

            if (!latestWeights || !latestWeights.pesos) {
                return null; // Cannot calculate without weights
            }

            // Calculate User Weighted Score
            const w = latestWeights.pesos;
            // Default to 1 if weight is missing (unlikely if record exists)
            const userScore = (
                (grades.redacao * (w.redacao || 1)) +
                (grades.linguagens * (w.linguagens || 1)) +
                (grades.humanas * (w.humanas || 1)) +
                (grades.natureza * (w.natureza || 1)) +
                (grades.matematica * (w.matematica || 1))
            ) / ((w.redacao || 1) + (w.linguagens || 1) + (w.humanas || 1) + (w.natureza || 1) + (w.matematica || 1));


            // B. Find matching cut score for selected modality
            // We need to filter cut_scores for the requested modality
            // And preferably pick the latest year available (2025/2026/2024)
            if (!course.cut_scores || course.cut_scores.length === 0) {
                return null;
            }

            // Group by year to find the "best" year
            // Logic: prefer 2026 > 2025 > 2024
            // But we first need to see if the year HAS the modality

            // Let's gather all relevant cut scores first
            const candidates = course.cut_scores.map((cs: any) => ({
                ...cs,
                _derivedCode: getModalityCode(cs.modality_name)
            }));

            // We try to match the specific selected code
            // We reuse the logic from ModalityContext slightly modified for backend

            // Find specific match
            // We iterate years descending
            const relevantYears = Array.from(new Set(candidates.map((c: any) => c.year))).sort((a: any, b: any) => b - a);

            let finalCutScore = null;
            let finalYear = 0;

            for (const year of relevantYears) {
                const yearModalities = candidates.filter((c: any) => c.year === year);

                // Try specific match
                let match = null;
                if (modalityCode === 'ampla') {
                    match = yearModalities.find((m: any) => m.modality_name.toLowerCase().includes('ampla'));
                } else {
                    match = yearModalities.find((m: any) => m._derivedCode === modalityCode);
                }

                if (match) {
                    finalCutScore = match;
                    finalYear = year as number;
                    break; // Found latest valid data
                }
            }

            // If no specific match found, do we return null? 
            // Previous logic says "don't show false info". 
            // So if user wants L1 and this uni doesn't have L1, we skip it.
            if (!finalCutScore || !finalCutScore.cut_score) {
                return null;
            }

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
                cutScore: finalCutScore.cut_score,
                cutScoreYear: finalYear,
                margin: userScore - finalCutScore.cut_score,
                modalityName: finalCutScore.modality_name
            };
        })
            .filter(Boolean) // Remove nulls
            .sort((a: any, b: any) => b.margin - a.margin); // Sort by best margin (highest chance first)

        return NextResponse.json(results);

    } catch (error) {
        console.error('Radar API Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
