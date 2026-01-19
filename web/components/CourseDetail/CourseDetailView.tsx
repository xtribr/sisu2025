'use client';

import { useState } from 'react';
import styles from './CourseDetail.module.css';
import CourseHeader from './Header';
import WeightsTable from './WeightsTable';
import StatsCharts from './StatsCharts';
import { PartialScores } from './PartialScores';
import { ApprovedList } from './ApprovedList';
import { useScores } from '../../context/ScoreContext';
import { useModality, matchModality, getModalityCode } from '../../context/ModalityContext';

interface CourseDetailViewProps {
    course: any;
}

export default function CourseDetailView({ course }: CourseDetailViewProps) {
    const { calculateAverage, scores } = useScores();
    const { selectedModality, getModalityLabel, setSelectedModality } = useModality(); // Get global state
    const [activeTab, setActiveTab] = useState('info');

    // Extract latest weights (e.g., 2025 or latest available)
    const latestWeights = course.weights.sort((a: any, b: any) => b.year - a.year)[0];

    // Calculate user's average if weights exist
    const userAverage = latestWeights ? calculateAverage(latestWeights) : 0;

    // Get latest cut score for comparison based on SELECTED MODALITY
    // We treat 'course.cut_scores' as a flat list logic or year-grouped logic?
    // Based on previous file content, 'course.cut_scores' seems to be the array of year data?
    // Wait, the previous code was: course.cut_scores.filter(cs => cs.modality_name...includes('ampla'))
    // This implies 'course.cut_scores' IS NOT grouped by year, but flat?
    // Let's re-read the audit or previous code. 
    // In page.tsx: data.cut_scores is [{year, modalities: [...]}]
    // In CourseDetailView, checking line 28: course.cut_scores.filter(...).sort(...).
    // If it filters by modality name directly, then course.cut_scores must be flat OR the previous code was wrong/different.
    // Let's assume the passed 'course' prop has the structure from 'page.tsx' transformation?
    // In page.tsx, we transform it: transformed.cut_scores.push({ year, modality_name, ... })
    // So 'course.cut_scores' IS FLATTENED in page.tsx! Yes.

    const latestCutScore = course.cut_scores
        .filter((cs: any) => {
            const match = matchModality(selectedModality, [{ modality_name: cs.modality_name, modality_code: '' }]);
            return match !== null;
        })
        .sort((a: any, b: any) => b.year - a.year)[0];

    // If cut_score is null but we have partial scores, use the LAST partial score
    // This happens when SISU is still in progress (2025)
    const partialScores = latestCutScore?.partial_scores || [];
    let cutScoreValue = latestCutScore?.cut_score || 0;

    if (!cutScoreValue && partialScores.length > 0) {
        // Get the last day's score as the current reference
        const lastPartial = partialScores[partialScores.length - 1];
        cutScoreValue = lastPartial?.score || 0;
    }

    const diff = userAverage - cutScoreValue;
    const isPassing = diff >= 0;

    // Vacancies, applicants from the cut score data
    const vacancies = latestCutScore?.vacancies || 0;
    const applicants = latestCutScore?.applicants || 0;

    return (
        <main style={{ paddingBottom: '4rem' }}>
            <CourseHeader course={course} />

            <div className="container">
                {/* Score Simulation Banner - MeuSISU Style */}
                <div style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    marginBottom: '2rem',
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', marginBottom: '1.5rem' }}>
                        Sua Simulação
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                                Sua média ponderada
                            </span>
                            <span style={{ fontSize: '2rem', fontWeight: 700, color: '#2563eb' }}>
                                {userAverage.toFixed(2).replace('.', ',')}
                            </span>
                        </div>

                        {latestCutScore && (
                            <div>
                                <span style={{ display: 'block', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                                    Nota de corte ({latestCutScore.year} - {getModalityLabel()})
                                </span>
                                <span style={{ fontSize: '2rem', fontWeight: 700, color: '#111827' }}>
                                    {cutScoreValue.toFixed(2).replace('.', ',')}
                                </span>
                            </div>
                        )}

                        <div>
                            <span style={{ display: 'block', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                                Situação
                            </span>
                            <span style={{
                                fontSize: '1.25rem',
                                fontWeight: 600,
                                color: isPassing ? '#16a34a' : '#dc2626',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                {isPassing ? '✅ Aprovado' : '❌ Reprovado'}
                                <span style={{ fontSize: '0.875rem', fontWeight: 400, opacity: 0.8 }}>
                                    ({diff > 0 ? '+' : ''}{diff.toFixed(2).replace('.', ',')})
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Informações da Modalidade - MeuSISU Style */}
                    {latestCutScore && (
                        <div style={{
                            marginTop: '1.5rem',
                            paddingTop: '1.5rem',
                            borderTop: '1px solid #e5e7eb',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                            gap: '1rem'
                        }}>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>Vagas</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#374151' }}>
                                    {vacancies || 'N/A'}
                                </span>
                            </div>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>Inscritos</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#374151' }}>
                                    {applicants || 'Em breve'}
                                </span>
                            </div>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>Bônus</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#374151' }}>0%</span>
                            </div>
                        </div>
                    )}

                    {/* Notas Parciais - MeuSISU Style */}
                    {partialScores.length > 0 && (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>
                                Notas parciais:
                            </h4>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {partialScores.map((ps: any, idx: number) => (
                                    <div key={idx} style={{
                                        background: '#f3f4f6',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '0.5rem',
                                        textAlign: 'center',
                                        minWidth: '80px'
                                    }}>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280' }}>
                                            {ps.day}º dia
                                        </span>
                                        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
                                            {ps.score > 0 ? ps.score.toFixed(2).replace('.', ',') : '-'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'info' ? styles.active : ''}`}
                        onClick={() => setActiveTab('info')}
                    >
                        Informações
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'stats' ? styles.active : ''}`}
                        onClick={() => setActiveTab('stats')}
                    >
                        Estatísticas
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'list' ? styles.active : ''}`}
                        onClick={() => setActiveTab('list')}
                    >
                        Lista de Aprovados
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'modalities' ? styles.active : ''}`}
                        onClick={() => setActiveTab('modalities')}
                    >
                        Modalidades
                    </button>
                </div>

                {activeTab === 'info' && (
                    <div className="animate-in fade-in">
                        <WeightsTable weights={latestWeights} />
                    </div>
                )}

                {activeTab === 'stats' && (
                    <div className="animate-in fade-in">
                        <StatsCharts scores={course.cut_scores} />
                    </div>
                )}

                {activeTab === 'list' && (
                    <div className="animate-in fade-in">
                        <ApprovedList
                            courseCode={course.code}
                            cutScore={cutScoreValue}
                            vacancies={vacancies}
                            year={latestCutScore?.year || new Date().getFullYear()}
                        />
                    </div>
                )}

                {activeTab === 'modalities' && (
                    <div className="animate-in fade-in">
                        <h4 style={{ marginBottom: '1rem', marginTop: '1rem' }}>Todas as Modalidades ({latestCutScore?.year || new Date().getFullYear()})</h4>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem', fontWeight: 600 }}>Modalidade</th>
                                        <th style={{ padding: '0.75rem', fontWeight: 600 }}>Nota de Corte</th>
                                        <th style={{ padding: '0.75rem', fontWeight: 600 }}>Vagas</th>
                                        <th style={{ padding: '0.75rem', fontWeight: 600 }}>Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Get unique modalities for the latest available year */}
                                    {(() => {
                                        const latestYear = course.cut_scores.reduce((max: number, cs: any) => Math.max(max, cs.year), 0);
                                        const modalitiesForYear = course.cut_scores
                                            .filter((cs: any) => cs.year === latestYear)
                                            .sort((a: any, b: any) => b.cut_score - a.cut_score);

                                        return modalitiesForYear.map((mod: any, idx: number) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                <td style={{ padding: '0.75rem', color: '#374151' }}>{mod.modality_name}</td>
                                                <td style={{ padding: '0.75rem', fontWeight: 600, color: '#111827' }}>
                                                    {mod.cut_score > 0 ? mod.cut_score.toFixed(2).replace('.', ',') : '-'}
                                                </td>
                                                <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                                                    {mod.vacancies || '-'}
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <button
                                                        onClick={() => {
                                                            const code = getModalityCode(mod.modality_name);
                                                            if (code !== 'other') {
                                                                setSelectedModality(code);
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            } else {
                                                                alert('Esta modalidade específica ainda não está mapeada no filtro global, mas a nota acima é a correta para ela.');
                                                            }
                                                        }}
                                                        style={{
                                                            fontSize: '0.8rem',
                                                            color: '#2563eb',
                                                            cursor: 'pointer',
                                                            background: 'none',
                                                            border: 'none',
                                                            fontWeight: 600,
                                                            padding: 0
                                                        }}
                                                    >
                                                        Selecionar
                                                    </button>
                                                </td>
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

