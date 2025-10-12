# Crônicas de Aventuras - Backend

Este é o servidor backend para o jogo "Crônicas de Aventuras". Ele é construído com Node.js, Express, TypeScript e TypeORM para fornecer uma API robusta para gerenciar jogadores, personagens e a lógica do jogo.

## Como Iniciar

1.  **Instale as dependências**:
    ```bash
    npm install
    ```

2.  **Configure o Banco de Dados**:
    - Na pasta `backend`, renomeie o arquivo `.env.example` para `.env`.
    - Abra o novo arquivo `.env` e substitua os valores de exemplo pelas suas credenciais do banco de dados MySQL/MariaDB:
      ```
      DB_HOST=localhost
      DB_USER=seu_usuario
      DB_PASSWORD=sua_senha
      DB_NAME=cda_db
      JWT_SECRET=seu_segredo_jwt_super_secreto
      ```

3.  **Inicie o Servidor de Desenvolvimento**:
    O servidor iniciará em modo de desenvolvimento com `nodemon` e `ts-node`, reiniciando automaticamente a cada alteração.
    ```bash
    npm run dev
    ```
    Ao iniciar, o TypeORM irá sincronizar os modelos com o banco de dados e criar as tabelas necessárias automaticamente.

O servidor estará rodando em `http://localhost:8071`.

## Estrutura do Projeto

-   `/src/config`: Configurações gerais (se necessário no futuro).
-   `/src/controllers`: Lógica que lida com as requisições HTTP e envia as respostas.
-   `/src/database`: Configuração da fonte de dados do TypeORM (`data-source.ts`).
-   `/src/middlewares`: Middlewares do Express, como autenticação e tratamento de erros.
-   `/src/models`: Definições das entidades do TypeORM (tabelas do banco).
-   `/src/routes`: Definição de todos os endpoints da API.
-   `/src/services`: Lógica de negócio, interações com a IA e com o banco de dados.
-   `server.ts`: Ponto de entrada da aplicação.
