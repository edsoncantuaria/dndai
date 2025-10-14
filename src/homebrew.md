# Crônicas de Aventuras: O Sistema Homebrew

Este documento descreve a visão, arquitetura e implementação do sistema "Homebrew", uma plataforma para criação e compartilhamento de conteúdo customizado para o "Crônicas de Aventuras".

## 1. Visão Geral

O objetivo do sistema Homebrew é transformar o "Crônicas de Aventuras" em uma ferramenta de RPG verdadeiramente aberta e expansível. A plataforma permitirá que Mestres e jogadores criem, editem, compartilhem e "instalem" conteúdo personalizado diretamente no jogo.

- **Criação de Conteúdo**: Usuários poderão criar novas raças, classes, subclasses, magias, itens, monstros e antecedentes.
- **Estrutura Baseada na API**: Todo o conteúdo homebrew seguirá a mesma estrutura de dados da API D&D 5e, documentada no `openapi.yaml`, garantindo consistência e fácil integração.
- **Loja Homebrew**: Uma interface central ("Loja") onde os jogadores poderão navegar, pesquisar e ativar conteúdos criados pela comunidade.
- **Conteúdo Pessoal e Comunitário**: Os usuários poderão manter seu conteúdo privado ou publicá-lo para toda a comunidade.
- **Integração Perfeita**: Uma vez "instalado", o conteúdo homebrew aparecerá nativamente em todas as partes do jogo, como no criador de personagens e nas interações com a IA.

## 2. Implementação Técnica

### Fase 1: Fundação - Servindo Conteúdo Customizado (Concluído)

-   **[X] Corrigir o Carregamento de Antecedentes (`backgrounds.json`):** O backend foi corrigido para servir com sucesso um arquivo de dados local (`backend/data/backgrounds.json`), provando a capacidade de servir conteúdo customizado.

### Fase 2: Armazenamento e API (Concluído)

-   **[X] Criar Entidades Homebrew no Banco de Dados:** Foi definida a entidade `HomebrewContent` (TypeORM) para armazenar os dados JSON que seguem o padrão OpenAPI, com campos para `type`, `authorId`, `isPublic` e o `content`.
-   **[X] Criar Endpoints CRUD para Homebrew:** Foi desenvolvida a API REST (`/api/homebrew`) para criar, ler, atualizar e deletar conteúdo homebrew, com validação e checagem de permissões.

### Fase 3: Integração com o Jogo (Concluído)

-   **[X] Mesclar Dados (Listas de Recursos):** A rota `GET /api/dnds/:resource` do backend foi modificada para que, ao receber uma requisição por "classes", "raças", etc., ele busque na API oficial e mescle com o conteúdo homebrew público do banco de dados antes de retornar ao frontend.
-   **[X] Integração de Detalhes no Backend:**
    -   **[✅ Concluído]** A rota `GET /api/dnds/:resource/:index` foi atualizada para detectar se um `index` é um ID de homebrew. Se for, ela busca os detalhes do nosso banco de dados em vez da API D&D.
    -   **[✅ Concluído]** O `characterService` foi atualizado para carregar os dados de uma classe homebrew durante a criação do personagem.
    -   **[✅ Concluído]** O `narrarService` e as rotas de níveis/magias agora também sabem como lidar com dados de classes homebrew.


### Fase 4: O Editor Homebrew (Concluído)

O objetivo desta fase era criar uma interface de formulário guiada para cada tipo de conteúdo, eliminando a necessidade de escrever JSON manualmente e reduzindo a possibilidade de erros.

#### **Status dos Editores:**

-   **[✅ Concluído] Raças:** Incluindo a criação de traços customizados e o suporte a sub-raças.
-   **[✅ Concluído] Antecedentes:** Formulário completo para a criação de antecedentes.
-   **[✅ Concluído] Magias:** Incluindo mecânicas de dano, escalonamento e seleção de componentes materiais.
-   **[✅ Concluído] Itens:** Com campos para categoria, custo, peso e propriedades.
-   **[✅ Concluído] Talentos (Feats):** Implementado através do "Criador de Traços".
-   **[✅ Concluído] Classes:**
    -   Estrutura básica com nome e dado de vida.
    -   Seleção de testes de resistência, proficiências e escolhas de perícias.
    -   Adição de características de classe por nível.
-   **[✅ Concluído] Subclasses:**
    -   Estrutura básica com seleção de classe original, nome e descrição.
    -   Adição de características de subclasse por nível.
-   **[✅ Concluído] Monstros:**
    - **[✅ Concluído]** Estrutura inicial do formulário (Nome, Tamanho, Tipo, Alinhamento).
    - **[✅ Concluído]** Implementação de estatísticas de combate (Atributos, PV, CA, Velocidade).
    - **[✅ Concluído]** Implementação de perícias, resistências, sentidos e idiomas.
    - **[✅ Concluído]** Sistema para adicionar ações, habilidades especiais e ações lendárias, incluindo detalhes de ataque.

**Nota sobre Sub-raças:** A criação de sub-raças não é um editor separado, mas uma funcionalidade integrada diretamente no formulário de criação de `Raças`.

#### **Sistema de Dependências (Concluído):**

-   **[✅ Concluído] Traços em Raças:** Ao criar uma raça, é possível criar e associar novos traços.
-   **[✅ Concluído] Componentes Materiais em Magias:** Ao criar uma magia, é possível selecionar um item existente ou criar um novo para servir como componente.

## 3. Estrutura de Dados e Extensibilidade

Todo o conteúdo criado DEVE aderir ao schema definido pela API D&D 5e (`openapi.yaml`). Isso garante consistência e previsibilidade para o Mestre de Jogo IA.

No entanto, o sistema foi projetado para ser extensível. Novas mecânicas que não existem no SRD (ex: Pontos de Ki, Dados de Poder Psíquico) podem ser ensinadas à IA através de regras customizadas adicionadas ao arquivo de prompt principal (`backend/src/game/prompt5e.ts`).

Com essa arquitetura, a plataforma está pronta para recriar e integrar conteúdo de qualquer livro de D&D.

**Exemplo (Raça Homebrew Simplificada):**
```json
{
  "index": "meu-golem-de-pedra",
  "name": "Golem de Pedra",
  "speed": 25,
  "ability_bonuses": [
    { "ability_score": { "index": "con", "name": "CON" }, "bonus": 2 },
    { "ability_score": { "index": "str", "name": "STR" }, "bonus": 1 }
  ],
  "size": "Medium",
  "traits": [ /* Referências a traits customizados ou existentes */ ],
  "languages": [ /* Referências a idiomas */ ]
}
```

Este documento será atualizado conforme o sistema Homebrew evoluir com novas funcionalidades.
