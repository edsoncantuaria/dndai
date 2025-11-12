
# Crônicas de Aventuras - Backend (Refatorado)

Este é o novo backend para o jogo "Crônicas de Aventuras", reconstruído para ser uma plataforma robusta e escalável, capaz de gerenciar múltiplas sessões de jogo de IA de forma isolada e paralela.

## Tecnologias

- **Node.js**: Ambiente de execução JavaScript.
- **Express.js**: Framework para a construção da API REST.
- **TypeScript**: Para um código mais seguro e manutenível.
- **TypeORM**: ORM (Object-Relational Mapper) para interagir com o banco de dados.
- **MySQL**: Banco de dados relacional para persistência de dados.
- **Genkit (Google Gemini)**: Para a geração de conteúdo narrativo pela IA.
- **dotenv**: Para gerenciamento de variáveis de ambiente.
1
## Pipeline de IA em alto nível

- **Prompt rico + memória estruturada:** cada turno envia o log condensado, timeline, resumos, grafo de memória (`MEMORIA_GRAFO=...`) e um snippet real (`EXEMPLO_STATE/NARRATIVE`) obtido de execuções anteriores (`scenario_examples`). Isso garante que a IA tenha o mesmo contexto que o jogador.
- **Playbooks por cenário:** regras em `scenarioPlaybooks.ts` limitam o que cada fase pode fazer (combate não termina sem hostis, loja não abre durante luta, revisão exige XP, etc.). Se o modelo quebrar a regra, o guard impede a resposta e pede retry com o hint correto.
- **Templates oficiais:** combatentes referenciam `enemy_templates` (persistidos no banco com CRUD/seed). Sempre que recebemos um combate, stats/HP/dano são normalizados com base nesses templates.
- **Sanitizadores + validadores semânticos:** corrigimos loot/XP/relógio, mantemos apenas deltas, e verificamos coerência (hostis vivos, motivo de rolagem com perícia, iniciativa válida). Problemas geram retries automáticos.
- **Feedback persistente:** avisos (ex.: `state_guard_retry`) são gravados em `ai_feedback_notes`; o próximo turno daquele cenário recebe automaticamente um `validationFeedback` explicando o erro.
- **Observabilidade e métricas:** cada warning incrementa contadores em `logs/metrics/warnings.log` e expomos `/metrics/warnings` para Prometheus/ELK.
- **Fallback resiliente:** se o modelo insiste em errar, geramos uma resposta mínima válida, registramos snapshots em `logs/phase-debug` e o jogador nunca vê estado quebrado.

Esse pipeline garante consistência de sessão, combate, inventário, quests e memórias mesmo usando um modelo generativo externo.

## Como Iniciar

### 1. Pré-requisitos

- Node.js (versão 20 ou superior)
- NPM
- Um servidor de banco de dados MySQL ou MariaDB acessível.

### 2. Instalação

Na raiz da pasta `backend`, execute o comando para instalar todas as dependências:

```bash
npm install
```

### 3. Configuração do Banco de Dados

1.  Ainda na pasta `backend`, renomeie o arquivo `.env.example` para `.env`.
2.  Abra o novo arquivo `.env` e substitua os valores de exemplo pelas suas credenciais do banco de dados MySQL/MariaDB:

    ```env
    # Configurações do Banco de Dados MySQL
    DB_HOST=localhost
    DB_PORT=3306
    DB_USER=seu_usuario_aqui
    DB_PASSWORD=sua_senha_aqui
    DB_NAME=cda_db

    # Porta do servidor
    PORT=8071
    ```

### 4. Iniciando o Servidor de Desenvolvimento

Execute o comando abaixo. O servidor iniciará em modo de desenvolvimento com `ts-node-dev`, reiniciando automaticamente a cada alteração no código.

```bash
npm run dev
```

Ao iniciar, o TypeORM irá se conectar ao banco de dados e, como a opção `synchronize: true` está ativa, ele **criará automaticamente todas as tabelas necessárias** (`sessoes_ia`, `session_logs`, etc.) com base nas suas entidades. **Não é necessário rodar migrações manualmente em ambiente de desenvolvimento.**

O servidor estará rodando em `http://localhost:8071`.

### 5. Populando o Banco de Dados (Seeding)

Para que o jogo funcione com as traduções e os dados base (antecedentes, magias, itens), você precisa popular o banco de dados. Isso é feito através de um script que lê os arquivos de dados e os insere na tabela de conteúdo "homebrew".

**Importante:** Execute este comando sempre que você limpar ou recriar o banco de dados.

```bash
npm run seed:data
```

Este comando irá:
- Garantir que um usuário "Sistema" exista.
- Ler os arquivos de tradução de magias, equipamentos e os dados de antecedentes.
- Inserir ou atualizar esses dados na tabela `homebrew_content`, marcando-os como públicos para que possam ser usados no jogo.

### 6. Templates oficiais de inimigos

Os combates usam fichas persistidas na tabela `enemy_templates`. Para carregar os templates padrão e habilitar o CRUD:

```bash
npm run seed:enemy-templates
```

- O servidor sincroniza o cache com o banco durante o startup.
- Há rotas autenticadas em `/api/ai/enemy-templates` (GET/POST/PUT/DELETE) para gerenciar novas fichas.
- O sanitizador referencia esses templates automaticamente ao normalizar combatentes.

## Testando a API (Exemplos)

Você pode usar ferramentas como o [Postman](https://www.postman.com/), [Insomnia](https://insomnia.rest/) ou `curl` para testar os endpoints.

### 1. Criar uma nova sessão de jogo

Primeiro, você precisa criar uma sessão de jogo. Note que você precisa de uma chave de API válida do Google AI Studio para isso.

**Request (`curl`):**

```bash
curl -X POST http://localhost:8071/api/sessoes \
-H "Content-Type: application/json" \
-d '{
  "nome": "Aventuras na Montanha do Eco",
  "apiKey": "SUA_CHAVE_DE_API_DO_GOOGLE_AI_AQUI"
}'
```

**Resposta de Sucesso:**

```json
{
    "message": "Sessão criada com sucesso!",
    "sessao": {
        "nome": "Aventuras na Montanha do Eco",
        "apiKey": "SUA_CHAVE_DE_API_DO_GOOGLE_AI_AQUI",
        "logs": [],
        "id": 1,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

Anote o `id` da sessão criada (neste caso, `1`).

### 2. Enviar um prompt para a IA narrar

Agora, use o `id` da sessão para enviar um prompt e obter uma resposta da IA.

**Request (`curl`):**

```bash
# Substitua :sessionId pelo ID da sua sessão (ex: 1)
curl -X POST http://localhost:8071/api/narrar/1 \
-H "Content-Type: application/json" \
-d '{
  "prompt": "Eu entro na taverna com aparência sombria e peço a bebida mais forte que eles tiverem."
}'
```

**Resposta de Sucesso:**

```json
{
    "response": "O taverneiro, um homem robusto com um olho de vidro, te encara por um momento antes de pegar uma garrafa escura e empoeirada de debaixo do balcão. Ele serve um líquido âmbar em um copo sujo e o desliza em sua direção. 'Por sua conta e risco, forasteiro', ele grunhe. O cheiro de álcool forte e algo vagamente medicinal enche suas narinas. O que você faz?"
}
```

A cada chamada para este endpoint, a interação é salva no banco de dados e associada à sessão correta.
