import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// A chave secreta DEVE ter 32 bytes (256 bits) para aes-256-cbc
const secretKey = process.env.SECRET_KEY;
console.log('SECRET_KEY atual:', secretKey?.length);
if (!secretKey || secretKey.length < 32) {
    throw new Error('SECRET_KEY é necessária no arquivo .env e deve ter pelo menos 32 caracteres.');
}
const key = crypto.createHash('sha256').update(String(secretKey)).digest('base64').substring(0, 32);


export const encrypt = (text: string): string => {
    // O IV (Vetor de Inicialização) deve ter 16 bytes para aes-256-cbc
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Armazena o IV junto com o texto criptografado para poder descriptografar
    return iv.toString('hex') + ':' + encrypted;
};

export const decrypt = (hash: string): string | null => {
    try {
        const parts = hash.split(':');
        if (parts.length !== 2) {
            console.error("Formato de hash inválido para descriptografia.");
            return null;
        }
        // O primeiro elemento é o IV, mas precisa ser um Buffer
        const iv = Buffer.from(parts.shift()!, 'hex');
        // O restante é o texto criptografado
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error("Erro ao descriptografar:", error);
        return null;
    }
};
