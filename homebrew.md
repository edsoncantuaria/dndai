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

### Fase 1: Fundação - Servindo Conteúdo Customizado (Estático)

*   **[X] Corrigir o Carregamento de Antecedentes (`backgrounds.json`):**
    *   **Problema:** A rota de backend não estava encontrando o arquivo JSON local devido a um caminho incorreto.
    *   **Solução:** O caminho em `backend/src/routes/dndApiRoutes.ts` foi corrigido para apontar para `backend/data/backgrounds.json`.
    *   **Resultado:** O backend agora serve com sucesso um arquivo de dados local em vez de depender apenas da API externa. Este é o nosso "caso de teste" para o sistema homebrew.

### Fase 2: Armazenamento no Banco de Dados

*   **[Próximo Passo] Criar Entidades Homebrew no Banco de Dados:**
    *   **Tarefa:** Definir novas entidades TypeORM no backend (ex: `HomebrewContent`) para armazenar os dados JSON que seguem o padrão OpenAPI.
    *   **Campos:** A entidade terá campos como `type` (raça, classe, etc.), `authorId` (para permissões de edição), `isPublic` e `content` (um campo do tipo `JSON` para armazenar o objeto de dados).

*   **Criar Endpoints CRUD para Homebrew:**
    *   **Tarefa:** Desenvolver uma API REST (`/api/homebrew`) para `criar`, `ler`, `atualizar` e `deletar` conteúdo homebrew, com validação e checagem de permissões.

### Fase 3: Integração com o Jogo

*   **Mesclar Dados**:
    *   **Tarefa:** Modificar os serviços do backend (ex: `dndApiService`) para que, ao receber uma requisição por "raças", por exemplo, ele primeiro busque na API oficial e depois busque no nosso banco de dados por raças homebrew que o usuário tenha "instalado", mesclando as duas listas antes de retornar ao frontend.

*   **Interface da Loja Homebrew:**
    *   **Tarefa:** Construir a UI no frontend que permitirá aos usuários navegar, pesquisar, ativar e desativar conteúdo homebrew.

### Fase 4: O Editor Homebrew e Gerenciamento de Dependências

*   **Editor de Conteúdo Guiado:**
    *   **Visão:** Implementar um "wizard" de criação no frontend. Em vez de escrever JSON manualmente, o usuário selecionará um tipo de conteúdo (ex: "Nova Raça") e preencherá um formulário com campos específicos (`Nome`, `Bônus de Atributo`, `Traços`, etc.). O sistema, então, irá gerar o JSON no formato `openapi.yaml` correto.
    *   **Justificativa:** Reduz drasticamente a curva de aprendizado e a possibilidade de erros, garantindo que todo o conteúdo criado seja válido.

*   **Sistema de Dependências:**
    *   **Visão:** Permitir que um conteúdo homebrew referencie outro. Por exemplo, ao criar uma nova Classe, o usuário poderá selecionar um Talento que ele mesmo criou anteriormente.
    *   **Implementação:** Quando um conteúdo com dependências for "instalado" por outro jogador, o sistema identificará e instalará todas as dependências necessárias juntas, garantindo a integridade do conteúdo.

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
