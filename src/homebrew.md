# Crônicas de Aventuras: O Sistema Homebrew

Este documento descreve a visão, arquitetura e implementação do sistema "Homebrew", uma plataforma para criação e compartilhamento de conteúdo customizado para o "Crônicas de Aventuras".

## 1. Visão Geral

O objetivo do sistema Homebrew é transformar o "Crônicas de Aventuras" em uma ferramenta de RPG verdadeiramente aberta e expansível. A plataforma permitirá que Mestres e jogadores criem, editem, compartilhem e "instalem" conteúdo personalizado diretamente no jogo.

- **Criação de Conteúdo**: Usuários poderão criar novas raças, classes, subclasses, magias, itens, monstros e antecedentes.
- **Estrutura Baseada na API**: Todo o conteúdo homebrew seguirá a mesma estrutura de dados da API D&D 5e, documentada no `openapi.yaml`, garantindo consistência e fácil integração.
- **Oficina Homebrew**: Uma interface central ("Oficina") onde os jogadores poderão navegar, pesquisar e ativar conteúdos criados pela comunidade.
- **Conteúdo Pessoal e Comunitário**: Os usuários poderão manter seu conteúdo privado ou publicá-lo para toda a comunidade.
- **Integração Perfeita**: Uma vez "instalado", o conteúdo homebrew aparecerá nativamente em todas as partes do jogo, como no criador de personagens e nas interações com a IA.

## 2. Implementação Técnica e Capacidades

O sistema Homebrew foi construído em fases para garantir uma base robusta e uma implementação gradual de funcionalidades.

### Fase 1 a 3: Fundação e Integração (Concluído)
- **[✅] Armazenamento de Dados:** Conteúdos homebrew são salvos no banco de dados como objetos JSON estruturados.
- **[✅] API de Conteúdo:** O backend possui rotas (`/api/homebrew` e `/api/dnds`) que mesclam de forma transparente o conteúdo oficial da API D&D 5e com o conteúdo homebrew do banco de dados.
- **[✅] Integração com o Jogo:** O criador de personagem e o Mestre de Jogo IA conseguem ler e utilizar o conteúdo homebrew "instalado" em uma sessão, tratando-o como conteúdo oficial.

### Fase 4: O Editor Homebrew (Concluído)
O objetivo desta fase era criar uma interface de formulário guiada para cada tipo de conteúdo, eliminando a necessidade de escrever JSON manualmente.

- **[✅] Editores Completos:** Foram implementados editores visuais para **Raças, Classes, Subclasses, Antecedentes, Magias, Itens (comuns e mágicos), Talentos (Feats) e Monstros**.

### Capacidades Atuais vs. Limitações

Com a estrutura atual, é possível recriar a **quase totalidade do conteúdo descritivo e estrutural do Player's Handbook (PHB)**. No entanto, é crucial entender a principal limitação:

- **Descrição vs. Mecânica Codificada:** O sistema permite que você **descreva** regras complexas, mas não possui um motor de jogo para **executá-las mecanicamente**.
    - **Exemplo:** Você pode criar a característica "Ataque Extra" e descrever "A partir do 5º nível, você pode atacar duas vezes, em vez de uma, sempre que realizar a ação de Ataque em seu turno." O Mestre de Jogo IA é treinado para ler, entender e aplicar essa regra na narrativa.
    - **A Limitação:** O que o sistema não faz é adicionar um segundo "botão de ataque" na UI. A execução da regra depende da interpretação contextual da IA. O mesmo se aplica a sistemas de recursos como "Fúria" do Bárbaro, "Pontos de Ki" do Monge ou "Metamagia" do Feiticeiro. Você pode descrevê-los, e a IA os gerenciará narrativamente.

- **Multiclasse:** O sistema atual não foi projetado para gerenciar as regras de multiclasse (pré-requisitos, proficiências ganhas, cálculo de espaços de magia, etc.).

- **Escolhas Complexas:** Características que oferecem uma lista de sub-opções com efeitos mecânicos distintos (ex: Manobras do Mestre de Batalha, Invocações do Bruxo) podem ser descritas, mas o editor não possui uma interface dedicada para criar essas "sub-características" de forma estruturada.

**Em resumo: você pode construir um clone funcional do PHB no seu banco de dados homebrew. O jogo funcionará, e a IA fará o seu melhor para seguir as regras que você escreveu. No entanto, para uma fidelidade mecânica de 100% em tempo real, seria necessário um motor de jogo totalmente codificado, o que está além do escopo atual.**

## 3. Estrutura de Dados e Extensibilidade

Todo o conteúdo criado DEVE aderir ao schema definido pela API D&D 5e (`openapi.yaml`). Isso garante consistência e previsibilidade para o Mestre de Jogo IA.

O sistema foi projetado para ser extensível. Novas mecânicas que não existem no SRD podem ser ensinadas à IA através de regras customizadas adicionadas ao arquivo de prompt principal (`backend/src/game/prompt5e.ts`).

Este documento será atualizado conforme o sistema Homebrew evoluir com novas funcionalidades.
