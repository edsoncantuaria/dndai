# Backend do Crônicas de Aventuras

Este é o servidor backend para o jogo, construído com Node.js, Express e MySQL.

## Configuração

1.  **Instalar Dependências:**
    ```bash
    npm install
    ```

2.  **Configurar Variáveis de Ambiente:**
    - Copie o arquivo `.env.example` para um novo arquivo chamado `.env`.
    - Edite o arquivo `.env` com suas configurações de banco de dados e chaves.
    - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`: Credenciais do seu banco de dados MySQL.
    - `SECRET_KEY`: Uma chave secreta longa e aleatória de **pelo menos 32 caracteres** usada para criptografia.

3.  **Configurar o Banco de Dados:**
    - Certifique-se de que seu servidor MySQL está rodando.
    - Crie um banco de dados com o nome que você especificou em `DB_DATABASE`.
    - O TypeORM com `synchronize: true` (em `data-source.ts`) criará as tabelas automaticamente na primeira vez que o servidor iniciar. **Atenção:** Use isso apenas em desenvolvimento.

## Gerando Chaves de Licença (Desenvolvimento)

Para testar o fluxo de ativação, você precisará inserir chaves de licença manualmente no seu banco de dados. Conecte-se ao seu banco de dados MySQL e execute o seguinte comando SQL para adicionar algumas chaves:

```sql
INSERT INTO license_keys (key, isActive, expiresAt) VALUES
('CHAVE-TESTE-01', false, '2025-12-31 23:59:59'),
('CHAVE-TESTE-02', false, '2025-12-31 23:59:59'),
('CHAVE-JA-USADA', true, '2025-12-31 23:59:59'),
('CHAVE-EXPIRADA', false, '2020-01-01 23:59:59');

```
- `key`: A string da chave que o usuário irá digitar.
- `isActive`: Deve ser `false` para uma nova chave.
- `expiresAt`: A data em que a chave expira.

## Rodando o Servidor

-   **Para desenvolvimento (com recarregamento automático):**
    ```bash
    npm run dev
    ```
-   **Para produção:**
    ```bash
    npm start
    ```

O servidor iniciará na porta especificada no seu arquivo `.env` (padrão: 8080).
