'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Common modality codes used in SISU
// Reference: https://www.gov.br/mec/pt-br/assuntos/noticias/cotas
export const MODALITY_OPTIONS = [
    { code: 'ampla', name: 'Ampla Concorrência', shortName: 'Ampla' },
    { code: 'L1', name: 'Escola Pública + Renda ≤ 1,5 SM', shortName: 'L1 (EP+Renda)' },
    { code: 'L2', name: 'Escola Pública + Renda + PPI', shortName: 'L2 (EP+Renda+PPI)' },
    { code: 'L5', name: 'Escola Pública (Independente de Renda)', shortName: 'L5 (EP)' },
    { code: 'L6', name: 'Escola Pública + PPI (Independente de Renda)', shortName: 'L6 (EP+PPI)' },
    { code: 'L9', name: 'Escola Pública + Renda + PcD', shortName: 'L9 (EP+Renda+PcD)' },
    { code: 'L10', name: 'Escola Pública + Renda + PPI + PcD', shortName: 'L10 (EP+Renda+PPI+PcD)' },
    { code: 'L13', name: 'Escola Pública + PcD (Independente de Renda)', shortName: 'L13 (EP+PcD)' },
    { code: 'L14', name: 'Escola Pública + PPI + PcD (Independente de Renda)', shortName: 'L14 (EP+PPI+PcD)' },
    { code: 'quilombola', name: 'Quilombolas', shortName: 'Quilombolas' },
    { code: 'indigenas', name: 'Indígenas', shortName: 'Indígenas' },
    { code: 'ciganos', name: 'Ciganos', shortName: 'Ciganos' },
    { code: 'trans', name: 'Pessoas Trans', shortName: 'Trans' },
    { code: 'deficiencia', name: 'Pessoas com Deficiência (Geral)', shortName: 'PcD' },
    { code: 'rural', name: 'Educação do Campo', shortName: 'Rural' },
];

// Mapping from modality name patterns to codes
export function getModalityCode(modalityName: string): string {
    const name = modalityName.toLowerCase();

    if (name.includes('ampla')) return 'ampla';

    // PcD + PPI + Renda
    if (name.includes('deficiência') && name.includes('pretos') && name.includes('1,5')) return 'L10';
    if (name.includes('deficiência') && name.includes('pretos') && name.includes('1 salário')) return 'L10';

    // PcD + PPI (sem renda)
    if (name.includes('deficiência') && name.includes('pretos') && name.includes('independente')) return 'L14';

    // PcD + Renda
    if (name.includes('deficiência') && name.includes('1,5')) return 'L9';
    if (name.includes('deficiência') && name.includes('1 salário')) return 'L9';

    // PcD (sem renda)
    if (name.includes('deficiência') && name.includes('independente')) return 'L13';

    // PPI + Renda
    if (name.includes('pretos') && name.includes('1,5')) return 'L2';
    if (name.includes('pretos') && name.includes('1 salário')) return 'L2';

    // PPI (sem renda)
    if (name.includes('pretos') && name.includes('independente')) return 'L6';

    // Renda only
    if (name.includes('1,5') || name.includes('1 salário')) return 'L1';

    // Escola pública (sem renda)
    if (name.includes('independente')) return 'L5';

    // Quilombola
    if (name.includes('quilombola')) return 'quilombola';

    // Indígenas
    if (name.includes('indígena') || name.includes('indigena')) return 'indigenas';

    // Ciganos
    if (name.includes('cigano')) return 'ciganos';

    // Trans / Travestis
    if (name.includes('trans') || name.includes('travesti')) return 'trans';

    // Deficiência (Generico/Outros) - if not matched by specific L-codes
    if (name.includes('deficiência')) return 'deficiencia';

    // Rural / Campo
    if (name.includes('campo') || name.includes('rural')) return 'rural';

    return 'other';
}

// Function to match user-selected modality to database modality
export function matchModality<T extends { modality_name: string; modality_code?: string }>(selectedCode: string, availableModalities: T[]): T | null {
    if (selectedCode === 'ampla') {
        return availableModalities.find(m => m.modality_name.toLowerCase().includes('ampla')) || null;
    }

    // Try to match by derived code
    for (const mod of availableModalities) {
        const derivedCode = getModalityCode(mod.modality_name);
        if (derivedCode === selectedCode) {
            return mod;
        }
    }

    return null;
}

interface ModalityContextType {
    selectedModality: string;
    setSelectedModality: (modality: string) => void;
    getModalityLabel: () => string;
}

const ModalityContext = createContext<ModalityContextType | undefined>(undefined);

export function ModalityProvider({ children }: { children: ReactNode }) {
    const [selectedModality, setSelectedModality] = useState<string>('ampla');

    const getModalityLabel = () => {
        const option = MODALITY_OPTIONS.find(o => o.code === selectedModality);
        return option?.shortName || 'Ampla';
    };

    return (
        <ModalityContext.Provider value={{ selectedModality, setSelectedModality, getModalityLabel }}>
            {children}
        </ModalityContext.Provider>
    );
}

export function useModality() {
    const context = useContext(ModalityContext);
    if (context === undefined) {
        throw new Error('useModality must be used within a ModalityProvider');
    }
    return context;
}
