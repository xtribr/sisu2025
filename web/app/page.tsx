'use client';

import { useState, useEffect } from 'react';
import { useScores } from '../context/ScoreContext';
import { useModality, MODALITY_OPTIONS, matchModality, getModalityCode } from '../context/ModalityContext';
import CourseDetailView from '../components/CourseDetail/CourseDetailView';
import ScoreEvolutionChart from '../components/CourseDetail/ScoreEvolutionChart';
import ProbabilityGauge from '../components/CourseDetail/ProbabilityGauge';
import ApprovalRadarModal from '../components/CourseDetail/ApprovalRadarModal';
import ShareModal from '../components/CourseDetail/ShareModal';
import styles from './page.module.css';

interface CourseData {
  id: number;
  code: number;
  name: string;
  university: string;
  campus: string;
  city: string;
  state: string;
  degree: string;
  schedule: string;
  latitude?: string;
  longitude?: string;
  weights: any[];
  cut_scores: any[];
}

interface Course {
  id: number;
  code: number;
  name: string;
  degree: string;
  schedule: string;
}

interface YearCutScore {
  year: number;
  cut_score: number;
  cut_score_type: string;
  partial_scores: Array<{ day: number; score: number }>;
}

interface CoursePreview {
  code: number;
  name: string;
  degree: string;
  university: string;
  campus: string;
  schedule: string;
  cut_score: number;
  cut_score_year: number;
  cut_score_type: string; // "Corte 1", "Corte 2", "Corte 3", "Corte 4", "Corte Final", or "Em breve"
  highest_weight: string;
  weights: any;
  // Separate data for each year
  data2024?: YearCutScore;
  data2025?: YearCutScore;
  data2026?: YearCutScore;
}

export default function Home() {
  const { scores, setScores, calculateAverage } = useScores();
  const { selectedModality, setSelectedModality, getModalityLabel } = useModality();
  const [selectedCourseCode, setSelectedCourseCode] = useState<number | null>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showScoreInput, setShowScoreInput] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    state: '',
    city: '',
    institution: '',
    course: ''
  });

  const [options, setOptions] = useState({
    states: [] as string[],
    cities: [] as string[],
    institutions: [] as string[],
    courses: [] as Course[]
  });

  const [loadingFilters, setLoadingFilters] = useState({
    cities: false,
    institutions: false,
    courses: false,
    details: false
  });

  const [coursePreview, setCoursePreview] = useState<CoursePreview | null>(null);

  // System stats
  const [systemStats, setSystemStats] = useState({
    totalCourses: 8500,
    totalUniversities: 120,
    totalStates: 27
  });

  // Local score inputs
  const [tempScores, setTempScores] = useState({
    redacao: scores.redacao?.toString() || '',
    linguagens: scores.linguagens?.toString() || '',
    matematica: scores.matematica?.toString() || '',
    humanas: scores.humanas?.toString() || '',
    natureza: scores.natureza?.toString() || ''
  });

  // Fetch states and system stats on mount
  useEffect(() => {
    fetch('/api/filters?type=states')
      .then(res => res.json())
      .then(data => {
        setOptions(prev => ({ ...prev, states: data }));
        setSystemStats(prev => ({ ...prev, totalStates: data.length }));
      })
      .catch(console.error);
  }, []);

  // Cascading filters
  useEffect(() => {
    if (!filters.state) {
      setOptions(prev => ({ ...prev, cities: [], institutions: [], courses: [] }));
      setCoursePreview(null);
      return;
    }
    setLoadingFilters(prev => ({ ...prev, cities: true }));
    fetch(`/api/filters?type=cities&state=${filters.state}`)
      .then(res => res.json())
      .then(data => {
        setOptions(prev => ({ ...prev, cities: data, institutions: [], courses: [] }));
        setLoadingFilters(prev => ({ ...prev, cities: false }));
      });
  }, [filters.state]);

  useEffect(() => {
    if (!filters.city) {
      setOptions(prev => ({ ...prev, institutions: [], courses: [] }));
      setCoursePreview(null);
      return;
    }
    setLoadingFilters(prev => ({ ...prev, institutions: true }));
    fetch(`/api/filters?type=universities&state=${filters.state}&city=${filters.city}`)
      .then(res => res.json())
      .then(data => {
        setOptions(prev => ({ ...prev, institutions: data, courses: [] }));
        setLoadingFilters(prev => ({ ...prev, institutions: false }));
      });
  }, [filters.city]);

  useEffect(() => {
    if (!filters.institution) {
      setOptions(prev => ({ ...prev, courses: [] }));
      setCoursePreview(null);
      return;
    }
    setLoadingFilters(prev => ({ ...prev, courses: true }));
    fetch(`/api/filters?type=courses&state=${filters.state}&city=${filters.city}&university=${filters.institution}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setOptions(prev => ({ ...prev, courses: data }));
        }
        setLoadingFilters(prev => ({ ...prev, courses: false }));
      });
  }, [filters.institution]);


  // Fetch course preview when course selected
  useEffect(() => {
    if (!filters.course) {
      setCoursePreview(null);
      return;
    }

    const selectedCourse = options.courses.find(c => String(c.id) === filters.course);
    if (!selectedCourse) return;

    setLoadingFilters(prev => ({ ...prev, details: true }));

    fetch(`/api/courses/${selectedCourse.code}`)
      .then(res => res.json())
      .then(data => {
        const courseData = data.course;
        const weightsData = data.weights;

        let highestWeight = '';
        if (weightsData?.pesos) {
          const weightMap: Record<string, string> = {
            redacao: 'Redação',
            linguagens: 'Linguagens',
            matematica: 'Matemática',
            humanas: 'Humanas',
            natureza: 'Natureza'
          };
          let maxWeight = 0;
          for (const [key, label] of Object.entries(weightMap)) {
            const pesoKey = key as keyof typeof weightsData.pesos;
            if (weightsData.pesos[pesoKey] > maxWeight) {
              maxWeight = weightsData.pesos[pesoKey];
              highestWeight = label;
            }
          }
        }

        // Find best cut score data
        // Priority: 2026 with data > 2025 with data > 2024 with data > latest available
        let latestCutScore = null;
        let cutScore2026 = null;
        let cutScore2025 = null;
        let cutScore2024 = null;
        let allModalities: { modality_name: string; modality_code: string; cut_score: number; vacancies?: number }[] = [];

        if (data.cut_scores && Array.isArray(data.cut_scores)) {
          // Helper to process a year's modalities for easier lookup
          const getModalityData = (yearData: any, targetModality: string) => {
            const modalities = yearData.modalities || [];
            // Store modalities for inspection/fallback
            if (yearData.year === new Date().getFullYear()) { // or just collect from latest year
              // Logic to populate allModalities can go here if needed
            }

            // 1. Try exact match or code match
            const mappedObjs = modalities.map((m: any) => ({
              ...m,
              modality_name: m.name, // ensure property name matches what matchModality expects
              modality_code: getModalityCode(m.name) // optional, matchModality can derive it
            }));

            const match = matchModality(targetModality, mappedObjs);
            if (match) return match;

            // 2. Fallback to Ampla if selected is missing (optional strategy, currently defaulting to keeping null implies "no data" which is better)
            // But user requirement implies we should try to show something if possible, or maybe just Ampla as fallback?
            // For now, let's stick to strict matching to avoid misleading info, or fallback to Ampla ONLY if user explicitly wants Ampla.
            // However, to mimic previous behavior where "everything was Ampla", we might need a fallback if data is sparse.
            // Let's rely on strict match first.
            return null;
          };

          // Iterate years to find data for *selected* modality
          for (const yearData of data.cut_scores) {
            const modData = getModalityData(yearData, selectedModality);

            // Fallback: If no data for selected modality, try finding Ampla to at least show something? 
            // No, showing Ampla when user asked for L1 is bad UX. Better show "No data".
            // BUT, for the transitional phase, if we return null, everything breaks. 
            // Let's implement a "Soft Fallback" - we find the data, but we track if it was indeed the requested modality or 'ampla' default if we decide to force default.
            // Current decision: Strict match.

            // Actually, let's implement the specific year logic using the found modality data
            if (modData) {
              const scoreData = { ...modData, year: yearData.year };
              if (yearData.year === 2026) cutScore2026 = scoreData;
              if (yearData.year === 2025) cutScore2025 = scoreData;
              if (yearData.year === 2024) cutScore2024 = scoreData;
              if (!latestCutScore || yearData.year > latestCutScore.year) {
                latestCutScore = scoreData;
              }
            }
          }

          // If we found NOTHING for the selected modality (e.g. user selected L1 but this course doesn't have L1),
          // maybe we should fallback to Ampla to show *something* (like "Cota não disponível, visualizando Ampla")?
          // For this first iteration, if no data found for selected modality, we try to find Ampla as a safe default.
          if (!latestCutScore && !cutScore2026 && !cutScore2025 && !cutScore2024) {
            for (const yearData of data.cut_scores) {
              const ampla = yearData.modalities?.find((m: any) => m.name?.toLowerCase().includes('ampla'));
              if (ampla) {
                const scoreData = { ...ampla, year: yearData.year, isFallback: true };
                if (yearData.year === 2026) cutScore2026 = scoreData;
                if (yearData.year === 2025) cutScore2025 = scoreData;
                if (yearData.year === 2024) cutScore2024 = scoreData;
                if (!latestCutScore || yearData.year > latestCutScore.year) {
                  latestCutScore = scoreData;
                }
              }
            }
          }
        }

        // Determine which data to use
        let cutScoreValue = 0;
        let cutScoreYear = new Date().getFullYear();
        let cutScoreType = 'Em breve';

        // Check 2026 first (highest priority)
        if (cutScore2026) {
          const has2026Data = cutScore2026.cut_score > 0 ||
            (cutScore2026.partial_scores?.some((p: any) => p.score > 0));

          if (has2026Data) {
            cutScoreYear = 2026;
            if (cutScore2026.cut_score > 0) {
              cutScoreValue = cutScore2026.cut_score;
              cutScoreType = 'Corte Final';
            } else if (cutScore2026.partial_scores?.length > 0) {
              const partials = cutScore2026.partial_scores
                .filter((p: any) => p.score > 0)
                .sort((a: any, b: any) => b.day - a.day);
              if (partials.length > 0) {
                cutScoreValue = partials[0].score;
                cutScoreType = `Corte ${partials[0].day}`;
              }
            }
          }
        }

        // If no 2026 data, check 2025
        if (cutScoreValue === 0 && cutScore2025) {
          const has2025Data = cutScore2025.cut_score > 0 ||
            (cutScore2025.partial_scores?.some((p: any) => p.score > 0));

          if (has2025Data) {
            cutScoreYear = 2025;
            if (cutScore2025.cut_score > 0) {
              cutScoreValue = cutScore2025.cut_score;
              cutScoreType = 'Corte Final';
            } else if (cutScore2025.partial_scores?.length > 0) {
              const partials = cutScore2025.partial_scores
                .filter((p: any) => p.score > 0)
                .sort((a: any, b: any) => b.day - a.day);
              if (partials.length > 0) {
                cutScoreValue = partials[0].score;
                cutScoreType = `Corte ${partials[0].day}`;
              }
            }
          }
        }

        // If no 2025 data, use 2024
        if (cutScoreValue === 0 && cutScore2024?.cut_score > 0) {
          cutScoreValue = cutScore2024.cut_score;
          cutScoreYear = 2024;
          cutScoreType = 'Corte Final';
        }

        // Fallback to any available data
        if (cutScoreValue === 0 && latestCutScore?.cut_score > 0) {
          cutScoreValue = latestCutScore.cut_score;
          cutScoreYear = latestCutScore.year;
          cutScoreType = 'Corte Final';
        }

        // Helper to check if weights are trivial (all 1)
        const areWeightsTrivial = (w: any) => {
          if (!w?.pesos) return true;
          const { redacao, linguagens, matematica, humanas, natureza } = w.pesos;
          return redacao === 1 && linguagens === 1 && matematica === 1 && humanas === 1 && natureza === 1;
        };

        let weightsToUse = weightsData;

        // If current weights are trivial, try to find distinct weights in history
        if (areWeightsTrivial(weightsToUse) && data.weights_history?.length > 0) {
          const complexWeights = data.weights_history.find((w: any) => !areWeightsTrivial(w));
          if (complexWeights) {
            weightsToUse = complexWeights;
          }
        }

        const weightsForCalc = weightsToUse?.pesos ? {
          peso_red: weightsToUse.pesos.redacao || 1,
          peso_ling: weightsToUse.pesos.linguagens || 1,
          peso_mat: weightsToUse.pesos.matematica || 1,
          peso_ch: weightsToUse.pesos.humanas || 1,
          peso_cn: weightsToUse.pesos.natureza || 1
        } : null;

        // Prepare 2024 data
        const data2024: YearCutScore | undefined = cutScore2024 ? {
          year: 2024,
          cut_score: cutScore2024.cut_score || 0,
          cut_score_type: cutScore2024.cut_score > 0 ? 'Corte Final' : 'Em breve',
          partial_scores: (cutScore2024.partial_scores || []).map((p: any) => ({
            day: parseInt(p.day) || p.day,
            score: p.score || 0
          }))
        } : undefined;

        // Prepare 2025 data
        let data2025: YearCutScore | undefined = undefined;
        if (cutScore2025) {
          const partials2025 = (cutScore2025.partial_scores || [])
            .map((p: any) => ({ day: parseInt(p.day) || p.day, score: p.score || 0 }))
            .filter((p: any) => p.score > 0);

          let type2025 = 'Em breve';
          let score2025 = cutScore2025.cut_score || 0;

          if (score2025 > 0) {
            type2025 = 'Corte Final';
          } else if (partials2025.length > 0) {
            const lastPartial = partials2025.sort((a: any, b: any) => b.day - a.day)[0];
            score2025 = lastPartial.score;
            type2025 = `Corte ${lastPartial.day}`;
          }

          data2025 = {
            year: 2025,
            cut_score: score2025,
            cut_score_type: type2025,
            partial_scores: partials2025
          };
        }

        // Prepare 2026 data
        let data2026: YearCutScore | undefined = undefined;
        if (cutScore2026) {
          const partials2026 = (cutScore2026.partial_scores || [])
            .map((p: any) => ({ day: parseInt(p.day) || p.day, score: p.score || 0 }))
            .filter((p: any) => p.score > 0);

          let type2026 = 'Em breve';
          let score2026 = cutScore2026.cut_score || 0;

          if (score2026 > 0) {
            type2026 = 'Corte Final';
          } else if (partials2026.length > 0) {
            const lastPartial = partials2026.sort((a: any, b: any) => b.day - a.day)[0];
            score2026 = lastPartial.score;
            type2026 = `Corte ${lastPartial.day}`;
          }

          data2026 = {
            year: 2026,
            cut_score: score2026,
            cut_score_type: type2026,
            partial_scores: partials2026
          };
        }

        setCoursePreview({
          code: courseData?.code || selectedCourse.code,
          name: courseData?.name || selectedCourse.name,
          degree: courseData?.degree || 'Bacharelado',
          university: filters.institution,
          campus: courseData?.campus || '',
          schedule: courseData?.schedule || 'Integral',
          cut_score: cutScoreValue,
          cut_score_year: cutScoreYear,
          cut_score_type: cutScoreType,
          highest_weight: highestWeight,
          weights: weightsForCalc,
          data2024,
          data2025,
          data2026
        });
        setLoadingFilters(prev => ({ ...prev, details: false }));
      });
  }, [filters.course, options.courses, filters.institution, selectedModality]);

  // Fetch full course data
  useEffect(() => {
    if (!selectedCourseCode) {
      setCourseData(null);
      return;
    }

    setLoading(true);
    fetch(`/api/courses/${selectedCourseCode}`)
      .then(res => res.json())
      .then(data => {
        // Transform weights from API format to WeightsTable expected format
        const transformedWeights = (data.weights_history || []).map((w: any) => ({
          year: w.year,
          peso_red: w.pesos?.redacao || w.peso_red,
          peso_ling: w.pesos?.linguagens || w.peso_ling,
          peso_mat: w.pesos?.matematica || w.peso_mat,
          peso_ch: w.pesos?.humanas || w.peso_ch,
          peso_cn: w.pesos?.natureza || w.peso_cn,
          min_red: w.minimos?.redacao || w.min_red,
          min_ling: w.minimos?.linguagens || w.min_ling,
          min_mat: w.minimos?.matematica || w.min_mat,
          min_ch: w.minimos?.humanas || w.min_ch,
          min_cn: w.minimos?.natureza || w.min_cn,
          min_enem: w.minimos?.enem || w.min_enem
        }));

        // Also transform from the single 'weights' object if weights_history is empty
        if (transformedWeights.length === 0 && data.weights) {
          transformedWeights.push({
            year: data.weights.year,
            peso_red: data.weights.pesos?.redacao,
            peso_ling: data.weights.pesos?.linguagens,
            peso_mat: data.weights.pesos?.matematica,
            peso_ch: data.weights.pesos?.humanas,
            peso_cn: data.weights.pesos?.natureza,
            min_red: data.weights.minimos?.redacao,
            min_ling: data.weights.minimos?.linguagens,
            min_mat: data.weights.minimos?.matematica,
            min_ch: data.weights.minimos?.humanas,
            min_cn: data.weights.minimos?.natureza,
            min_enem: data.weights.minimos?.enem
          });
        }

        const transformed: CourseData = {
          id: data.course?.id || 0,
          code: data.course?.code || selectedCourseCode,
          name: data.course?.name || '',
          university: data.course?.university || '',
          campus: data.course?.campus || '',
          city: data.course?.city || '',
          state: data.course?.state || '',
          degree: data.course?.degree || '',
          schedule: data.course?.schedule || '',
          weights: transformedWeights,
          cut_scores: []
        };

        if (data.cut_scores && Array.isArray(data.cut_scores)) {
          for (const yearData of data.cut_scores) {
            for (const modality of yearData.modalities || []) {
              transformed.cut_scores.push({
                year: yearData.year,
                modality_code: modality.code,
                modality_name: modality.name,
                cut_score: modality.cut_score,
                applicants: modality.applicants,
                vacancies: modality.vacancies,
                partial_scores: modality.partial_scores || []
              });
            }
          }
        }

        setCourseData(transformed);
        setLoading(false);
      });
  }, [selectedCourseCode]);

  const handleViewDetails = () => {
    if (coursePreview) {
      setSelectedCourseCode(coursePreview.code);
      // Scroll to inline details after render
      setTimeout(() => {
        const detailsSection = document.querySelector('[class*="inlineDetails"]');
        if (detailsSection) {
          detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  const handleBack = () => {
    setSelectedCourseCode(null);
    setCourseData(null);
  };

  const handleSaveScores = () => {
    setScores({
      redacao: parseFloat(tempScores.redacao) || 0,
      linguagens: parseFloat(tempScores.linguagens) || 0,
      matematica: parseFloat(tempScores.matematica) || 0,
      humanas: parseFloat(tempScores.humanas) || 0,
      natureza: parseFloat(tempScores.natureza) || 0
    });
    setShowScoreInput(false);
  };

  const userAverage = coursePreview?.weights ? calculateAverage(coursePreview.weights) : 0;
  const simpleAverage = (scores.redacao + scores.linguagens + scores.matematica + scores.humanas + scores.natureza) / 5;

  // Check if course has real differentiated weights (not all 1)
  const hasRealWeights = coursePreview?.weights && (
    coursePreview.weights.peso_red !== 1 ||
    coursePreview.weights.peso_ling !== 1 ||
    coursePreview.weights.peso_mat !== 1 ||
    coursePreview.weights.peso_ch !== 1 ||
    coursePreview.weights.peso_cn !== 1
  );

  // Details are now shown inline, not on a separate page

  return (
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logoContainer}>
            <img src="/xtri-logo.png" alt="XTRI" className={styles.logoImage} />
            <h1 className={styles.logo}>XTRI SISU</h1>
          </div>
          <div className={styles.headerBadge}>
            <span className={styles.liveDot} />
            TEMPO REAL
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.hero}>
        <h2 className={styles.heroTitle}>
          Monitoramento do SISU 2026
          <span className={styles.heroHighlight}> em Tempo Real</span>
        </h2>
        <p className={styles.heroSubtitle}>
          Acompanhe as notas de corte, compare com suas notas e descubra suas chances de aprovação
        </p>
      </section>

      {/* Stats Bar */}
      <section className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>8.500+</span>
          <span className={styles.statLabel}>Cursos</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{systemStats.totalUniversities}+</span>
          <span className={styles.statLabel}>Universidades</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{systemStats.totalStates}</span>
          <span className={styles.statLabel}>Estados</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{simpleAverage > 0 ? simpleAverage.toFixed(2).replace('.', ',') : '---'}</span>
          <span className={styles.statLabel}>Média Simples</span>
        </div>
      </section>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Left Column - Score Input */}
        <aside className={styles.sidebar}>
          <div className={styles.scoreCard}>
            <div className={styles.scoreCardHeader}>
              <h3>📊 Suas Notas do ENEM</h3>
              {!showScoreInput && (
                <button className={styles.editButton} onClick={() => setShowScoreInput(true)}>
                  Editar
                </button>
              )}
            </div>

            {showScoreInput ? (
              <div className={styles.scoreInputs}>
                <div className={styles.inputGroup}>
                  <label>Redação</label>
                  <input
                    type="number"
                    value={tempScores.redacao}
                    onChange={e => setTempScores({ ...tempScores, redacao: e.target.value })}
                    placeholder="0 - 1000"
                    min="0"
                    max="1000"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Linguagens</label>
                  <input
                    type="number"
                    value={tempScores.linguagens}
                    onChange={e => setTempScores({ ...tempScores, linguagens: e.target.value })}
                    placeholder="0 - 1000"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Matemática</label>
                  <input
                    type="number"
                    value={tempScores.matematica}
                    onChange={e => setTempScores({ ...tempScores, matematica: e.target.value })}
                    placeholder="0 - 1000"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Humanas</label>
                  <input
                    type="number"
                    value={tempScores.humanas}
                    onChange={e => setTempScores({ ...tempScores, humanas: e.target.value })}
                    placeholder="0 - 1000"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Natureza</label>
                  <input
                    type="number"
                    value={tempScores.natureza}
                    onChange={e => setTempScores({ ...tempScores, natureza: e.target.value })}
                    placeholder="0 - 1000"
                  />
                </div>
                <button className={styles.saveButton} onClick={handleSaveScores}>
                  Salvar Notas
                </button>
              </div>
            ) : (
              <div className={styles.scoreDisplay}>
                <div className={styles.scoreRow}>
                  <span>Redação</span>
                  <strong>{scores.redacao || '---'}</strong>
                </div>
                <div className={styles.scoreRow}>
                  <span>Linguagens</span>
                  <strong>{scores.linguagens || '---'}</strong>
                </div>
                <div className={styles.scoreRow}>
                  <span>Matemática</span>
                  <strong>{scores.matematica || '---'}</strong>
                </div>
                <div className={styles.scoreRow}>
                  <span>Humanas</span>
                  <strong>{scores.humanas || '---'}</strong>
                </div>
                <div className={styles.scoreRow}>
                  <span>Natureza</span>
                  <strong>{scores.natureza || '---'}</strong>
                </div>
                <div className={styles.scoreDivider} />
                <div className={styles.scoreRow}>
                  <span>Média Simples</span>
                  <strong className={styles.averageHighlight}>
                    {simpleAverage > 0 ? simpleAverage.toFixed(2) : '---'}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Probability Gauge - Only if course is selected */}
          {coursePreview && (
            <ProbabilityGauge
              userScore={userAverage}
              cutScore={coursePreview.cut_score}
            />
          )}

          {/* Daily Cut Scores - 2026 (shows real data when available, otherwise listening mode) */}
          {coursePreview && (
            <div className={styles.dailyCutsCard}>
              <h3>📈 Cortes Diários 2026</h3>

              {coursePreview.data2026?.partial_scores?.length ? (
                /* Show real 2026 data */
                <div className={styles.dailyCutsList}>
                  {coursePreview.data2026.partial_scores
                    .sort((a, b) => a.day - b.day)
                    .map((p) => (
                      <div key={p.day} className={styles.dailyCutRow}>
                        <span className={styles.dailyCutDay}>DIA {p.day}</span>
                        <span className={styles.dailyCutScore}>{p.score.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  <div className={styles.dailyCutsNote}>🔴 SISU 2026 ao vivo</div>
                </div>
              ) : (
                /* Listening mode - waiting for data */
                <div className={styles.dailyCutsList}>
                  {[1, 2, 3, 4, 5].map((day) => (
                    <div key={day} className={`${styles.dailyCutRow} ${styles.dailyCutRowPending}`}>
                      <span className={styles.dailyCutDay}>DIA {day}</span>
                      <span className={styles.dailyCutScorePending}>---</span>
                    </div>
                  ))}
                  <div className={styles.dailyCutsNote}>⏳ Aguardando SISU 2026</div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Right Column - Course Search */}
        <section className={styles.searchSection}>
          <div className={styles.searchCard}>
            <h3>🎯 Encontre seu Curso</h3>

            <div className={styles.filterGrid}>
              <div className={styles.filterGroup}>
                <label>Estado</label>
                <select
                  value={filters.state}
                  onChange={e => setFilters({ state: e.target.value, city: '', institution: '', course: '' })}
                >
                  <option value="">Selecione</option>
                  {options.states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label>Cidade</label>
                <select
                  value={filters.city}
                  disabled={!filters.state}
                  onChange={e => setFilters({ ...filters, city: e.target.value, institution: '', course: '' })}
                >
                  <option value="">{loadingFilters.cities ? 'Carregando...' : 'Selecione'}</option>
                  {options.cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label>Instituição</label>
                <select
                  value={filters.institution}
                  disabled={!filters.city}
                  onChange={e => setFilters({ ...filters, institution: e.target.value, course: '' })}
                >
                  <option value="">{loadingFilters.institutions ? 'Carregando...' : 'Selecione'}</option>
                  {options.institutions.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label>Curso</label>
                <select
                  value={filters.course}
                  disabled={!filters.institution}
                  onChange={e => setFilters({ ...filters, course: e.target.value })}
                >
                  <option value="">{loadingFilters.courses ? 'Carregando...' : 'Selecione'}</option>
                  {options.courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.degree} - {c.schedule}</option>
                  ))}
                </select>
              </div>

              {/* New Modality Dropdown */}
              <div className={styles.filterGroup} style={{ minWidth: '100%' }}>
                <label>Modalidade de Concorrência</label>
                <select
                  value={selectedModality}
                  onChange={(e) => setSelectedModality(e.target.value)}
                  style={{ fontWeight: 500 }}
                >
                  {MODALITY_OPTIONS.map(opt => (
                    <option key={opt.code} value={opt.code}>{opt.shortName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Course Preview */}
            {coursePreview && !loadingFilters.details && (
              <div className={styles.coursePreview}>
                <div className={styles.previewHeader}>
                  <h4>{coursePreview.name}</h4>
                  <span className={styles.previewDegree}>{coursePreview.degree}</span>
                </div>

                <div className={styles.previewInfo}>
                  <div className={styles.previewRow}>
                    <span>🏛️ {coursePreview.university}</span>
                  </div>
                  {coursePreview.campus && (
                    <div className={styles.previewRow}>
                      <span>📍 {coursePreview.campus}</span>
                    </div>
                  )}
                  <div className={styles.previewRow}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: coursePreview.schedule === 'Integral' ? '#dbeafe' :
                        coursePreview.schedule === 'Noturno' ? '#f3e8ff' :
                          '#fef3c7',
                      color: coursePreview.schedule === 'Integral' ? '#1e40af' :
                        coursePreview.schedule === 'Noturno' ? '#6b21a8' :
                          '#92400e'
                    }}>
                      ⏰ {coursePreview.schedule}
                    </span>
                  </div>
                  {coursePreview.highest_weight && (
                    <div className={styles.previewRow}>
                      <span>⚖️ Maior peso: {coursePreview.highest_weight}</span>
                    </div>
                  )}
                </div>

                {/* Year Comparison Section */}
                <div className={styles.yearComparison}>
                  {/* Latest/Best Available */}
                  <div className={`${styles.yearCard} ${styles.yearCardHighlight}`}>
                    <div className={styles.yearHeader}>
                      <span className={styles.yearBadge2025}>2025</span>
                      <span className={styles.yearLabel}>
                        {coursePreview.data2025?.cut_score_type || 'Em breve'}
                      </span>
                    </div>
                    {coursePreview.data2025 && coursePreview.data2025.cut_score > 0 ? (
                      <>
                        <div className={styles.yearScore}>
                          <span className={styles.yearScoreLabel}>
                            {coursePreview.data2025.cut_score_type}
                          </span>
                          <span className={styles.yearScoreValue2025}>
                            {coursePreview.data2025.cut_score.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        {coursePreview.data2025.partial_scores?.length > 0 && (
                          <div className={styles.partialScoresPreview}>
                            {coursePreview.data2025.partial_scores.map((p) => (
                              <div key={p.day} className={styles.partialDay}>
                                <span>Dia {p.day}</span>
                                <strong>{p.score.toFixed(2).replace('.', ',')}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className={styles.yearPending}>
                        <span>⏳</span>
                        <span>Aguardando início do SISU</span>
                        <span className={styles.dateHint}>Inicia 19/01</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Score Evolution Chart */}
                {coursePreview && (
                  <ScoreEvolutionChart
                    data2024={coursePreview.data2024}
                    data2025={coursePreview.data2025}
                    data2026={coursePreview.data2026}
                  />
                )}


                {/* User Score Comparison */}
                <div className={styles.previewScores}>
                  <div className={styles.previewScoreItem}>
                    <span className={styles.previewScoreLabel}>
                      {hasRealWeights ? 'Sua Nota Ponderada' : 'Sua Média (pesos iguais)'}
                    </span>
                    <span className={`${styles.previewScoreValue} ${userAverage >= coursePreview.cut_score ? styles.passing : styles.failing}`}>
                      {userAverage > 0 ? userAverage.toFixed(2).replace('.', ',') : '---'}
                    </span>
                  </div>

                  <div className={styles.actionButtons}>
                    <button className={styles.compareButton} onClick={() => setShowRadar(true)}>
                      🔍 Radar de Aprovação
                    </button>
                    <button className={styles.shareButton} onClick={() => setShowShare(true)}>
                      📱 Share
                    </button>
                  </div>

                  {userAverage > 0 && coursePreview.cut_score > 0 && (
                    <div className={styles.previewStatus}>
                      {userAverage >= coursePreview.cut_score ? (
                        <span className={styles.statusPassing}>✅ Aprovado com base em {coursePreview.cut_score_year} (+{(userAverage - coursePreview.cut_score).toFixed(2).replace('.', ',')})</span>
                      ) : (
                        <span className={styles.statusFailing}>❌ Reprovado com base em {coursePreview.cut_score_year} ({(userAverage - coursePreview.cut_score).toFixed(2).replace('.', ',')})</span>
                      )}
                    </div>
                  )}
                </div>

                <button className={styles.viewButton} onClick={handleViewDetails}>
                  Ver Detalhes Completos →
                </button>
              </div>
            )}

            {loadingFilters.details && (
              <div className={styles.loadingPreview}>
                <div className={styles.spinner} />
                <p>Carregando informações...</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Inline Course Details - Shows below when 'Ver Detalhes Completos' is clicked */}
      {selectedCourseCode && (
        <div className={styles.inlineDetails}>
          <div className={styles.inlineDetailsHeader}>
            <h2>📚 Detalhes Completos</h2>
            <button className={styles.closeButton} onClick={handleBack}>
              ✕ Fechar
            </button>
          </div>

          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner} />
              <p>Carregando detalhes...</p>
            </div>
          ) : courseData ? (
            <CourseDetailView course={courseData} />
          ) : null}
        </div>
      )}

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.disclaimer}>
          Os dados exibidos na plataforma são obtidos dos portais de transparência do Ministério da Educação
          e atualizados ao longo do período do SISU. Além disso, verificamos regularmente as informações
          para assegurar que estejam sempre corretas e atualizadas.
        </p>
        <div className={styles.contacts}>
          <a href="https://instagram.com/xandaoxtri" target="_blank" rel="noopener noreferrer">
            📸 @xandaoxtri
          </a>
          <span className={styles.contactDivider}>•</span>
          <a href="mailto:contato@xtri.online">
            ✉️ contato@xtri.online
          </a>
        </div>
        <p>© 2026 XTRI SISU - Monitoramento em Tempo Real</p>
      </footer>


      {/* Logic Components */}
      {
        coursePreview && (
          <ApprovalRadarModal
            isOpen={showRadar}
            onClose={() => setShowRadar(false)}
            baseCourseName={coursePreview.name} // Pass the name to search for matches
          />
        )
      }
      {coursePreview && (
        <ShareModal
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          course={coursePreview}
          userScore={userAverage}
        />
      )}
    </main>
  );
}
