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
    - `SECRET_KEY`: Uma chave secreta longa e aleatória usada para criptografia e tokens.
    - `LICENSE_KEYS`: Um array JSON de strings com as chaves de licença válidas para registro.

3.  **Configurar o Banco de Dados:**
    - Certifique-se de que seu servidor MySQL está rodando.
    - Crie um banco de dados com o nome que você especificou em `DB_DATABASE`.
    - Execute o script `database.sql` para criar as tabelas necessárias.

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
