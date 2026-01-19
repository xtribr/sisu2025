'use client';

import { useState, useEffect } from 'react';
import styles from './ApprovalRadar.module.css';
import { useScores } from '../../context/ScoreContext';
import { useModality } from '../../context/ModalityContext';

interface RadarResult {
    courseId: number;
    courseCode: string;
    name: string;
    university: string;
    campus: string;
    city: string;
    state: string;
    degree: string;
    schedule: string;
    userScore: number;
    cutScore: number;
    cutScoreYear: number;
    margin: number;
    modalityName: string;
}

interface ApprovalRadarProps {
    isOpen: boolean;
    onClose: () => void;
    baseCourseName: string; // e.g. "Medicina"
}

export default function ApprovalRadarModal({ isOpen, onClose, baseCourseName }: ApprovalRadarProps) {
    const { scores } = useScores();
    const { selectedModality, getModalityLabel } = useModality();
    const [results, setResults] = useState<RadarResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterState, setFilterState] = useState('');

    useEffect(() => {
        if (isOpen && baseCourseName) {
            fetchResults();
        }
    }, [isOpen, baseCourseName, selectedModality]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const fetchResults = async () => {
        setLoading(true);
        try {
            // Remove specific degree/campus types from name to search broadly
            // e.g. "Medicina - Bacharelado" -> "Medicina"
            const cleanName = baseCourseName.split(' - ')[0];

            const response = await fetch('/api/simulate/radar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    courseName: cleanName,
                    modalityCode: selectedModality,
                    grades: scores
                })
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const data = await response.json();
            setResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Filter results locally if needed
    const filteredResults = filterState
        ? results.filter(r => r.state === filterState)
        : results;

    // Separate passing and near-passing
    const passingResults = filteredResults.filter(r => r.margin >= 0);
    const nearResults = filteredResults.filter(r => r.margin < 0 && r.margin > -20); // Close calls within 20 points

    const displayResults = [...passingResults, ...nearResults];
    const uniqueStates = Array.from(new Set(results.map(r => r.state))).sort();

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2>🔍 Radar de Aprovação - {baseCourseName}</h2>
                        <p>Simulação automática para <strong>{getModalityLabel()}</strong> em todas as universidades</p>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.content}>
                    {loading ? (
                        <div className={styles.loading}>
                            <div className={styles.spinner}></div>
                            <p>Analisando todas as universidades...</p>
                        </div>
                    ) : (
                        <>
                            {/* Simple Filters */}
                            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <select
                                    className="p-2 rounded bg-neutral-800 text-white border border-neutral-700"
                                    value={filterState}
                                    onChange={e => setFilterState(e.target.value)}
                                >
                                    <option value="">Todos os Estados</option>
                                    {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>

                                <span style={{ color: '#666', fontSize: '0.9rem', alignSelf: 'center' }}>
                                    {passingResults.length} aprovações encontradas
                                </span>
                            </div>

                            {displayResults.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <p>Nenhuma aprovação encontrada com os critérios atuais.</p>
                                    <p>Tente melhorar suas notas ou buscar outro curso.</p>
                                </div>
                            ) : (
                                <div className={styles.resultsGrid}>
                                    {displayResults.map((result, idx) => (
                                        <div key={idx} className={styles.resultCard}>
                                            <div className={styles.cardHeader}>
                                                <div>
                                                    <div className={styles.universityName}>{result.university}</div>
                                                    <div className={styles.universityLocation}>{result.campus} • {result.city}-{result.state}</div>
                                                </div>
                                                <span className={`${styles.shiftBadge} ${result.schedule === 'Integral' ? styles.shiftIntegral :
                                                        result.schedule === 'Noturno' ? styles.shiftNoturno :
                                                            styles.shiftMatutino
                                                    }`}>
                                                    {result.schedule}
                                                </span>
                                            </div>

                                            <div className={styles.cardBody}>
                                                <div className={styles.scoreRow}>
                                                    <span className={styles.scoreLabel}>Sua Média Ponderada</span>
                                                    <span className={styles.scoreValue}>{result.userScore.toFixed(2)}</span>
                                                </div>
                                                <div className={styles.scoreRow}>
                                                    <span className={styles.scoreLabel}>Corte {result.cutScoreYear}</span>
                                                    <span className={styles.cutScoreValue}>{result.cutScore.toFixed(2)}</span>
                                                </div>

                                                <div className={styles.marginRow}>
                                                    <span className={styles.scoreLabel} style={{ color: '#fff' }}>Margem</span>
                                                    <span className={`${styles.marginValue} ${result.margin >= 0 ? styles.marginPassing : styles.marginFailing}`}>
                                                        {result.margin > 0 ? '+' : ''}{result.margin.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={`${styles.statusBadge} ${result.margin >= 0 ? '' : styles.statusNear}`}>
                                                {result.margin >= 0 ? '✅ Aprovado' : '⚠️ Quase lá'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
