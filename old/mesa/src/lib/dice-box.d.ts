// Tipagem mínima de @3d-dice/dice-box 1.1.x (o pacote não publica tipos).
declare module "@3d-dice/dice-box" {
  export interface DiceBoxConfig {
    container: string
    assetPath: string
    id?: string
    theme?: string
    themeColor?: string
    offscreen?: boolean
    scale?: number
    gravity?: number
    throwForce?: number
    spinForce?: number
    startingHeight?: number
    settleTimeout?: number
    lightIntensity?: number
  }
  export interface DiceGroupResult {
    groupId: number
    qty: number
    sides: number | string
    value: number
    rolls: { value: number; sides: number | string; groupId: number; rollId: number }[]
  }
  export default class DiceBox {
    constructor(config: DiceBoxConfig)
    init(): Promise<DiceBox>
    roll(notation: string | string[] | { qty: number; sides: number }[]): Promise<DiceGroupResult[]>
    clear(): DiceBox
    resizeWorld(): void
  }
}
