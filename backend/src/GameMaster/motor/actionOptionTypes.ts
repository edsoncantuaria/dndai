/** Opção de ação sugerida ao jogador (dock / ActionBar). */
export type MotorActionOption = {
    text: string;
    action: string;
    skill?: string;
    needsRoll?: boolean;
    dc?: number;
};
