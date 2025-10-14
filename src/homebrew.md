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

-   **[X] Mesclar Dados (Antecedentes):** O serviço do backend (`dndApiRoutes.ts`) foi modificado para que, ao receber uma requisição por "backgrounds", ele busque na fonte estática e mescle com os antecedentes homebrew públicos do banco de dados antes de retornar ao frontend.
-   **[X] Mesclagem Generalizada:** A lógica de mesclagem foi expandida para todos os tipos de conteúdo relevantes (`races`, `classes`, `spells`, `items`, etc.), garantindo que o conteúdo homebrew apareça de forma integrada em toda a aplicação.

### Fase 4: O Editor Homebrew e Gerenciamento de Dependências (Em Andamento)

O objetivo desta fase é criar uma interface de formulário guiada para cada tipo de conteúdo, eliminando a necessidade de escrever JSON manualmente e reduzindo a possibilidade de erros.

#### **Status dos Editores:**

-   **[✅ Concluído] Raças:** Incluindo a criação de traços customizados e o suporte a sub-raças.
-   **[✅ Concluído] Antecedentes:** Formulário completo para a criação de antecedentes.
-   **[✅ Concluído] Magias:** Incluindo mecânicas de dano, escalonamento e seleção de componentes materiais.
-   **[✅ Concluído] Itens:** Com campos para categoria, custo, peso e propriedades.
-   **[✅ Concluído] Talentos (Feats):** Implementado através do "Criador de Traços".
-   **[Em Andamento] Classes:**
    -   **[✅ Concluído] Estrutura básica com nome e dado de vida.**
    -   **[✅ Concluído] Seleção de testes de resistência, proficiências e escolhas de perícias.**
    -   **[Em Andamento] Adicionar características de classe por nível.**
        - **[✅ Concluído] Criado editor de Características (Features).**
        - **[Em Andamento] Integração do seletor/criador de Características no formulário de Classe.**
-   **[Em Andamento] Subclasses:**
    -   **[✅ Concluído] Estrutura básica com seleção de classe original, nome e descrição.**
    -   **[⬜️ A Fazer] Adicionar características de subclasse por nível.**
-   **[⬜️ A Fazer] Monstros:** Editor para criar NPCs e monstros, definindo suas estatísticas, ações e habilidades.

**Nota sobre Sub-raças:** A criação de sub-raças não é um editor separado, mas uma funcionalidade a ser integrada diretamente no formulário de criação de `Raças`.

#### **Sistema de Dependências (Em Andamento):**

A visão é permitir que um conteúdo homebrew referencie outro, criando um ecossistema conectado.

-   **[✅ Concluído] Traços em Raças:** Ao criar uma raça, é possível criar e associar novos traços.
-   **[✅ Concluído] Componentes Materiais em Magias:** Ao criar uma magia, é possível selecionar um item existente ou criar um novo para servir como componente.

## 3. Estrutura de Dados

Todo o conteúdo criado DEVE aderir ao schema definido pela API D&D 5e. O `openapi.yaml` na raiz do projeto é a referência canônica.

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

Este documento será atualizado conforme cada fase do sistema Homebrew for implementada.
