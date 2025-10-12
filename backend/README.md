# Crônicas de Aventuras - Backend

Este é o servidor backend para o jogo "Crônicas de Aventuras". Ele é construído com Node.js, Express, TypeScript e Sequelize para fornecer uma API robusta para gerenciar jogadores, personagens e a lógica do jogo.

## Como Iniciar

1.  **Instale as dependências**:
    ```bash
    npm install
    ```

2.  **Configure o Banco de Dados**:
    - Crie um arquivo `.env` na raiz do diretório `backend`.
    - Adicione as seguintes variáveis, substituindo pelos seus dados:
      ```
      DB_HOST=localhost
      DB_USER=seu_usuario
      DB_PASSWORD=sua_senha
      DB_NAME=cda_db
      JWT_SECRET=seu_segredo_jwt_super_secreto
      ```

3.  **Execute as Migrações do Banco**:
    Este comando criará as tabelas necessárias no seu banco de dados com base nos modelos do Sequelize.
    ```bash
    npm run db:migrate
    ```

4.  **Inicie o Servidor de Desenvolvimento**:
    O servidor iniciará em modo de desenvolvimento com `ts-node-dev`, reiniciando automaticamente a cada alteração.
    ```bash
    npm run dev
    ```

O servidor estará rodando em `http://localhost:8071`.

## Estrutura do Projeto

-   `/src/config`: Configurações de banco de dados e outras.
-   `/src/controllers`: Lógica que lida com as requisições HTTP e envia as respostas.
-   `/src/database`: Migrações e seeders do Sequelize.
-   `/src/middlewares`: Middlewares do Express, como autenticação e tratamento de erros.
-   `/src/models`: Definições dos modelos do Sequelize (tabelas do banco).
-   `/src/routes`: Definição de todos os endpoints da API.
-   `/src/services`: Lógica de negócio, interações com a IA e com o banco de dados.
-   `/src/utils`: Funções utilitárias, como criptografia.
-   `server.ts`: Ponto de entrada da aplicação.
