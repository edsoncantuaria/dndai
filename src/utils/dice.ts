// utils/dice.ts
export const rollDice = (
    dice: string, 
    modifier: number = 0, 
    options: { advantage?: boolean; disadvantage?: boolean } = {}
): { total: number, rolls: number[] } => {
    const match = dice.match(/(\d+)d(\d+)/);
    if (!match) {
        console.error(`Invalid dice string: ${dice}`);
        return { total: modifier, rolls: [] };
    }
    const numDice = parseInt(match[1], 10);
    const numSides = parseInt(match[2], 10);

    const performRoll = (): number[] => {
        const results: number[] = [];
        for (let i = 0; i < numDice; i++) {
            results.push(Math.floor(Math.random() * numSides) + 1);
        }
        return results;
    };
    
    // Advantage and disadvantage cancel each other out
    if (options.advantage && options.disadvantage) {
        options.advantage = false;
        options.disadvantage = false;
    }

    let finalRolls: number[];

    if (options.advantage) {
        const rolls1 = performRoll();
        const rolls2 = performRoll();
        const sum1 = rolls1.reduce((s, v) => s + v, 0);
        const sum2 = rolls2.reduce((s, v) => s + v, 0);
        finalRolls = sum1 >= sum2 ? rolls1 : rolls2;
    } else if (options.disadvantage) {
        const rolls1 = performRoll();
        const rolls2 = performRoll();
        const sum1 = rolls1.reduce((s, v) => s + v, 0);
        const sum2 = rolls2.reduce((s, v) => s + v, 0);
        finalRolls = sum1 <= sum2 ? rolls1 : rolls2;
    } else {
        finalRolls = performRoll();
    }

    const diceResult = finalRolls.reduce((s, v) => s + v, 0);
    return { total: diceResult + modifier, rolls: finalRolls };
};