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

### Fase 4: O Editor Homebrew e Gerenciamento de Dependências (Em Andamento)

-   **[ ] Editor de Conteúdo Guiado:** Em vez de escrever JSON manualmente, o usuário selecionará um tipo de conteúdo (ex: "Nova Raça") e preencherá um formulário com campos específicos. O sistema, então, irá gerar o JSON no formato `openapi.yaml` correto.
    -   **[X] Implementado para Raças.**
    -   **[X] Implementado para Antecedentes.**
    -   **[Em Andamento] Próximo Passo: Implementar para Magias.**
        -   **[X] Estrutura básica do formulário.**
        -   **[X] Adicionar campos estruturados para Duração, Alcance, Tempo de Conjuração e mecânicas de Ataque/Dano.**
        -   **[ ] Adicionar sistema de escalonamento de dano (por nível de personagem ou espaço de magia).**
    -   **Justificativa:** Reduz drasticamente a curva de aprendizado e a possibilidade de erros.

-   **[ ] Sistema de Dependências:**
    -   **Visão:** Permitir que um conteúdo homebrew referencie outro. Por exemplo, ao criar uma nova Classe, o usuário poderá selecionar um Talento que ele mesmo criou anteriormente. Ao criar uma magia, poderá selecionar um item (existente ou customizado) como componente material.
    -   **[X] Implementado para Traços dentro da criação de Raças.**
    -   **[Em Andamento] Próximo Passo: Implementar para Componentes Materiais em Magias.**

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
