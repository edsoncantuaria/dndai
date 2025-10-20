// src/utils/currency.ts

export type Currency = {
    pp?: number;
    gp?: number;
    ep?: number;
    sp?: number;
    cp?: number;
};

// Taxas de conversão para Peças de Cobre (PC), a unidade base.
export const CONVERSION_RATES_TO_CP: Required<Currency> = {
    pp: 1000, // 1 platina = 10 ouro = 1000 cobre
    gp: 100,  // 1 ouro = 10 prata = 100 cobre
    ep: 50,   // 1 electro = 5 prata = 50 cobre
    sp: 10,   // 1 prata = 10 cobre
    cp: 1,
};

export const COIN_TYPES: (keyof Currency)[] = ['pp', 'gp', 'ep', 'sp', 'cp'];

// Standard D&D 5e rule: 50 coins weigh 1 pound.
export const COIN_WEIGHT = 0.02;


/**
 * Calcula o valor total de um conjunto de moedas em peças de cobre.
 * @param currency - Objeto com a quantidade de cada tipo de moeda.
 * @returns O valor total em peças de cobre.
 */
export const calculateTotalValueInCP = (currency: Currency): number => {
    let total = 0;
    for (const unit of COIN_TYPES) {
        if (currency[unit]) {
            total += currency[unit]! * CONVERSION_RATES_TO_CP[unit];
        }
    }
    return total;
};

/**
 * Converte um valor total em peças de cobre para a menor quantidade possível de moedas.
 * @param totalCp - O valor total em peças de cobre.
 * @returns Um objeto `Currency` com a distribuição otimizada de moedas.
 */
export const convertCpToOptimalCurrency = (totalCp: number): Required<Currency> => {
    let remaining = totalCp;
    const result: Required<Currency> = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

    for (const unit of COIN_TYPES) { // A ordem (pp, gp, ep, sp, cp) é importante
        const rate = CONVERSION_RATES_TO_CP[unit];
        const amount = Math.floor(remaining / rate);
        if (amount > 0) {
            result[unit] = amount;
            remaining %= rate;
        }
    }
    return result;
};

/**
 * Verifica se um jogador pode pagar um determinado custo com as moedas que possui.
 * @param playerCurrency - As moedas do jogador.
 * @param cost - O custo do item.
 * @returns `true` se o jogador puder pagar, `false` caso contrário.
 */
export const canAfford = (playerCurrency: Currency, cost: { quantity: number; unit: keyof Currency }): boolean => {
    const playerTotalCp = calculateTotalValueInCP(playerCurrency);
    const costInCp = cost.quantity * CONVERSION_RATES_TO_CP[cost.unit];
    return playerTotalCp >= costInCp;
};

/**
 * Calcula o troco após uma compra, retornando a nova distribuição de moedas do jogador.
 * @param playerCurrency - As moedas do jogador antes da compra.
 * @param cost - O custo do item.
 * @returns Um novo objeto `Currency` representando as moedas do jogador após a transação.
 * @throws Lança um erro se o jogador não puder pagar.
 */
export const makePurchase = (playerCurrency: Currency, cost: { quantity: number; unit: keyof Currency }): Required<Currency> => {
    const playerTotalCp = calculateTotalValueInCP(playerCurrency);
    const costInCp = cost.quantity * CONVERSION_RATES_TO_CP[cost.unit];

    if (playerTotalCp < costInCp) {
        throw new Error("Fundos insuficientes.");
    }

    const remainingCp = playerTotalCp - costInCp;
    return convertCpToOptimalCurrency(remainingCp);
};

/**
 * Adiciona moedas ao inventário de um jogador.
 * @param playerCurrency - As moedas atuais do jogador.
 * @param amountToAdd - As moedas a serem adicionadas.
 * @returns Um novo objeto `Currency` com os totais combinados e otimizados.
 */
export const addCurrency = (playerCurrency: Currency, amountToAdd: Currency): Required<Currency> => {
    const playerTotalCp = calculateTotalValueInCP(playerCurrency);
    const toAddTotalCp = calculateTotalValueInCP(amountToAdd);
    return convertCpToOptimalCurrency(playerTotalCp + toAddTotalCp);
};
