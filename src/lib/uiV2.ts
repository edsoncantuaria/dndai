/** Feature flag — UI v2 ativa por padrão; defina NEXT_PUBLIC_UI_V2=false para legado */
export const isUiV2Enabled = (): boolean =>
  process.env.NEXT_PUBLIC_UI_V2 !== 'false';
