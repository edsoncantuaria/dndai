# Diagnóstico Técnico e Guia dos Sistemas: dndai & Shellby MCP

> Relatório detalhado sobre a qualidade do narrador, execução em VPS, concorrência de sessões, mapas, fluxo de rolagem (obrigatoriedade e barganha), combate, economia, inventário, magias e conformidade com o D&D 5e.

---

## Sumário
1. [Qualidade do Narrador e Melhorias Práticas](#1-qualidade-do-narrador-e-melhorias-práticas)
2. [Como Rodar o Shellby MCP em VPS (Headless Linux)](#2-como-rodar-o-shellby-mcp-em-vps-headless-linux)
3. [Comportamento Multi-Sessão e Concorrência](#3-comportamento-multi-sessão-e-concorrência)
4. [Auditoria dos Mapas: Local, Múndi e Combate](#4-auditoria-dos-mapas-local-múndi-e-combate)
5. [Fluxo de Rolagem de Dados: "Rolar Depois", Minimização e Barganha](#5-fluxo-de-rolagem-de-dados-rolar-depois-minimização-e-barganha)
6. [Sistemas de Jogo: Combate, Loja, Loot e Itens](#6-sistemas-de-jogo-combate-loja-loot-e-itens)
7. [Sistema de Magias: Funcionamento e Exibição](#7-sistema-de-magias-funcionamento-e-exibição)
8. [Conformidade do Motor com D&D 5e (SRD)](#8-conformidade-do-motor-com-dd-5e-srd)

---

## 1. Qualidade do Narrador e Melhorias Práticas

### Problemas Reais Encontrados nas Avaliações
Na análise da execução mais recente (`engine/eval/runs/2026-10-12T07-07-02/turnos.jsonl`), o Mestre ChatGPT teve comportamento mecânico sólido, mas foram identificadas falhas reais:

1. **Falso-positivo do Validador de Nomes Próprios (Bug no Motor):**
   * **Evidência:** No Turno 38, o Mestre teve sua narração rejeitada com o erro:
     `"Não" não é uma entidade do motor. Nomes novos só nascem via apply`.
   * **Causa:** Em [`engine/src/narration.ts:75-88`](../engine/src/narration.ts#L75-L88), a lista `STARTERS` contém palavras que podem abrir frases sem serem consideradas nomes próprios de NPCs. A palavra **"não"** ficou de fora. Quando o Mestre iniciou duas frases com *"Não..."* num diálogo, o motor concluiu que "Não" era um NPC repetido não registrado e barrou a publicação.
   * **Correção:** Adicionar `"nao"` à lista `STARTERS` em `engine/src/narration.ts`.

2. **Tentativas de Comandos Inválidos pelo Mestre (Tool Call Wasted):**
   * No Turno 1, o Mestre tentou executar `move pc` direto na CLI, recebendo erro de sintaxe.
   * **Melhoria:** Reforçar em [`engine/skill/SKILL.md:35-40`](../engine/skill/SKILL.md#L35-L40) que mutações espaciais e econômicas (`move`, `money`, `item.give`) **só existem dentro de lotes `apply`**, nunca como comandos da raiz.

3. **Esquecimento da Linha de Dados (🎲):**
   * No Turno 40, a narração foi recusada porque o Mestre narrou a consequência de uma rolagem mas esqueceu a linha obrigatória com o emoji `🎲` (ex: `🎲 Percepção 18 vs CD 13 — sucesso`).

4. **Latência de Resposta (25s a 45s por turno):**
   * Como o Mestre faz de 5 a 7 chamadas MCP sequenciais pelo Chrome (`start_here`, `turn begin`, `check`, `apply`, `turn end`), cada turno sofre a latência somada de múltiplos roundtrips.

---

## 2. Como Rodar o Shellby MCP em VPS (Headless Linux)

O Shellby controla uma instância real do Google Chrome/Chromium via Chrome DevTools Protocol (CDP) na porta `9222` e expõe um servidor MCP na porta `3333`.

### Requisitos da VPS
* **SO:** Ubuntu 22.04 / 24.04 LTS (x64 ou arm64).
* **Dependências:** Node.js 22.18+, npm, Git, Rust/Cargo 1.95+ (para compilar `apply_patch`), Google Chrome estável.
* **Memória:** Mínimo 2 GB RAM (recomendado 4 GB por causa do Chrome).

### O Desafio da Autenticação sem Interface Gráfica
Em uma máquina headless não há display para o login inicial do ChatGPT. Existem duas soluções:

#### Opção A (Recomendada): Copiar a Sessão Local (Perfil do Chrome)
1. Faça o setup e o login no seu computador local:
   ```bash
   cd ~/Projetos/shellby-mcp
   npm run setup:chatgpt
   ```
2. Após logar no ChatGPT e aprovar o MCP no Chrome, copie a pasta de perfil gerada para a VPS:
   ```bash
   rsync -avz ~/.shellby/chatgpt-chrome/ usuario@vps:~/.shellby/chatgpt-chrome/
   ```

#### Opção B: Túnel SSH ou Display Virtual na VPS
1. Instale `xvfb` na VPS:
   ```bash
   sudo apt install -y xvfb x11vnc
   Xvfb :99 -screen 0 1920x1080x24 &
   export DISPLAY=:99
   ```
2. Abra um túnel SSH encaminhando a porta CDP:
   ```bash
   ssh -L 9222:127.0.0.1:9222 usuario@vps
   ```
3. No seu navegador local, acesse `http://localhost:9222` para visualizar e interagir com as abas remotas do Chrome da VPS.

### Configuração do Túnel Público (Cloudflare Tunnel ou ngrok)
O ChatGPT Developer Mode precisa alcançar o endpoint MCP do Shellby:
* O Shellby já suporta **Cloudflare Tunnel (`cloudflared`)** em `.shellby/config.toml`.
* Ele escuta na porta `3334` (porta de origem protegida) com um token secreto de 256 bits gerado pelo comando:
  ```bash
  npm run print-url
  ```
* **Segurança:** Nunca abra as portas `3333` (MCP cru) ou `9222` (CDP) no firewall público da VPS. Mantenha-as apenas em `127.0.0.1`.

> [!WARNING]
> **Risco de Bloqueio por IP de Datacenter:**
> A Cloudflare e a OpenAI costumam apresentar desafios Turnstile/Captcha ou bloquear logins vindos de faixas de IP de datacenters comuns (AWS, DigitalOcean, Hetzner). Se isso ocorrer, configure um proxy de saída residencial na VPS.

---

## 3. Comportamento Multi-Sessão e Concorrência

### Caso 1: Campanhas Diferentes (`slug_A` e `slug_B`)
* **Isolamento Completo:** Cada campanha opera em seus próprios bancos SQLite (`campaigns/<slug>/world.db` e `chat.db`).
* **Sessões do Shellby:** Em [`engine/src/master/queue.ts:143`](../engine/src/master/queue.ts#L143), cada campanha envia o cabeçalho `x-openai-session: dndai-<slug>-<geracao>`. O Shellby trata como conversas independentes.
* **Multiverso Compartilhado:** Compartilham apenas o Atlas (`atlas.db`), sincronizando locais e fatos públicos (`lore: true`), sem vazar PV, inventário, memórias de NPCs ou missões.

### Caso 2: Duas Abas / Dois Clientes na MESMA Campanha
* **Personagem Único:** O motor possui exatamente 1 personagem do jogador (`pc`) por campanha. Não há suporte a grupo multiplayer com fichas separadas.
* **Fila Anti-Colisão:** Se duas mensagens forem enviadas ao mesmo tempo, a fila de [`queue.ts:348`](../engine/src/master/queue.ts#L348) retém a segunda como `status = 'fila'`. Quando o Mestre conclui a resposta da primeira, todas as mensagens pendentes são entregues juntas ao Mestre em lote.
* **Sincronização:** Ambas as telas recebem as mesmas atualizações via Server-Sent Events (`GET /api/events`).

---

## 4. Auditoria dos Mapas: Local, Múndi e Combate

1. **Mapa de Exploração (Locais):**
   * **Modelo:** Grafo topológico relacional (nós = `places`, arestas = `links`).
   * **Conexões:** Cada ligação define tempo em minutos (ex: `15m` a pé), direção (`via`) e sentido único (`oneway`).
   * **Interface:** Tanto a mesa Web quanto o app Flutter ([`drawers.dart:670`](../app/lib/ui/fantasy/drawers.dart#L670)) desenham os locais como nós arrastáveis sobre um pergaminho com linhas de conexão.

2. **Mapa-Múndi:**
   * **Situação Atual:** **Não existe mapa-múndi cartográfico/geográfico** (imagem de continentes ou hex-grid de viagem por coordenadas).
   * **O que existe:** Hierarquia de pertencimento (`parent`), permitindo aninhar salas em tavernas, tavernas em vilas, e vilas em províncias.

3. **Mapa de Combate (Grid Tático):**
   * **Situação Atual:** **Não existe grid tático de 5 pés**. O combate é "Teatro da Mente" com regras mecânicas de iniciativa, CA, ataques e PV.

---

## 5. Fluxo de Rolagem de Dados: "Rolar Depois", Minimização e Barganha

### A) "Rolar Depois" vs "Minimizar"
* **No Motor (Backend):**
  * O backend **já bloqueia categoricamente** qualquer avanço enquanto houver rolagem pendente ([`turns.ts:16`](../engine/src/turns.ts#L16) e [`server.ts:241`](../engine/src/server.ts#L241)): mensagens e ações de item retornam **HTTP 409 "Role os dados primeiro"**.
* **No App Flutter:**
  * O modal de dados ([`dice.dart:18-28`](../app/lib/ui/dice.dart#L18-L28)) possui `isDismissible: false` e `PopScope(canPop: false)`. O jogador é obrigado a rolar.
* **Na Mesa Web React:**
  * No arquivo [`DiceModal.tsx:269-271`](../mesa/src/components/DiceModal.tsx#L269-L271), o botão que recolhe o modal temporariamente para leitura estava rotulado como **`"Rolar depois"`**, embora execute `onMinimize()`.
  * **Correção Recomendada:** Renomear o botão para **`"Minimizar"`** e exibir uma barra persistente no topo da mesa: `🎲 Rolagem Pendente [Abrir Dados]`.

### B) Barganha e Proposta de Rolagem pelo Jogador
* **Antes do Mestre pedir a rolagem:** O jogador pode propor livremente no chat (*"Posso usar Acrobacia em vez de Atletismo para descer a colina?"*). O Mestre avalia e dispara o comando correspondente.
* **Depois que o Mestre já pediu a rolagem:** Como o backend devolve HTTP 409 para novas mensagens, o jogador não consegue barganhar após o gatilho da rolagem.
* **Melhoria Proposta:** Adicionar um botão no modal de rolagem para *"Contestar / Propor Perícia"*, permitindo uma mensagem de barganha que autorize o Mestre a cancelar o pedido anterior (`dnd roll-cancel <id>`) e abrir outro.

---

## 6. Sistemas de Jogo: Combate, Loja, Loot e Itens

| Sistema | Status | Onde fica | Como funciona |
| :--- | :---: | :--- | :--- |
| **Combate** | **Funcional** | [`simulation.ts:175`](../engine/src/simulation.ts#L175) | `combat start` rola iniciativa (d20 + Des, desempate por Des). `combat next` avança rodadas e pula mortos. `combat end` computa tempo decorrido (6s/rodada). |
| **Itens & Ações** | **Funcional** | [`items.ts:8`](../engine/src/items.ts#L8) | Suporta `usar`, `equipar`, `guardar`, `empunhar`, `embainhar`, `largar`. Recalcula CA automaticamente respeitando teto de Destreza. Sacar armas em vilas reduz atitude de NPCs. |
| **Loja & Comércio** | **Funcional** | [`ops.ts:85`](../engine/src/ops.ts#L85) | Realizado via lote `apply` com `op: "money"` e `op: "item.give"`. O motor impede gastos se o saldo for menor que o custo (`c.cp + delta < 0`). |
| **Loot & Tesouros** | **Funcional** | [`ops.ts:59`](../engine/src/ops.ts#L59) | O Mestre cria itens no chão do local (`owner: "place:..."`) ou entrega ao PC. Trava de segurança em [`guard.ts:44`](../engine/src/guard.ts#L44) impede geração de ouro arbitrário sem justificativa. |

---

## 7. Sistema de Magias: Funcionamento e Exibição

### Funcionamento no Motor
1. **Slots por Classe e Nível:**
   * Implementado em [`rules.ts:155`](../engine/src/rules.ts#L155) (`spellSlots(cls, level)`).
   * Segue a tabela oficial do SRD 2014 para todas as classes conjuradoras, incluindo a progressão única de *Pact Magic* do Bruxo (Warlock).
2. **Consumo e Recuperação:**
   * Consumo via `useSlot(db, id, circle)` em [`mechanics.ts:400`](../engine/src/mechanics.ts#L400).
   * Recuperação integral de todos os slots no descanso longo (`dnd rest long`).
3. **Catálogo Oficial SRD:**
   * Busca completa de magias oficiais em [`srd.ts:31`](../engine/src/srd.ts#L31) (`dnd srd spell <nome>`), carregando atributos, tempo de conjuração, alcance e componentes do JSON do SRD.
4. **Adição/Remoção na Ficha:**
   * O Mestre gerencia o grimório do personagem via `op: "update"` com `spells_add` e `spells_remove` ([`ops.ts:507`](../engine/src/ops.ts#L507)).

### Exibição na Interface
* **No App Flutter ([`drawers.dart:359`](../app/lib/ui/fantasy/drawers.dart#L359)):**
  * Possui uma gaveta dedicada: **Grimório**.
  * Exibe atributo de conjuração, CD de resistência da magia e bônus de ataque mágico.
  * Renderiza os **espaços de magia por círculo com círculos visuais interativos** (preenchidos em azul-mana quando disponíveis e vazios quando consumidos).
  * Lista todas as magias preparadas e conhecidas.
* **Na Mesa Web React ([`CharacterSheet.tsx:106`](../mesa/src/components/panels/CharacterSheet.tsx#L106)):**
  * Exibe o painel arcano com CD, ataque mágico e cada magia listada em chips visuais com o tema arcano (`tone="arcane"`).

---

## 8. Conformidade do Motor com D&D 5e (SRD)

O motor é determinístico e atende fielmente às regras do SRD 5e:
* **Modificadores:** Calculados rigorosamente por $\lfloor (\text{atributo} - 10) / 2 \rfloor$ ([`rules.ts:72`](../engine/src/rules.ts#L72)).
* **Bônus de Proficiência:** Escala de +2 (nível 1) a +6 (nível 17+) ([`rules.ts:80`](../engine/src/rules.ts#L80)).
* **Ataques e Críticos:**
  * 20 natural é acerto crítico e duplica os dados de dano ([`mechanics.ts:243`](../engine/src/mechanics.ts#L243)).
  * 1 natural é erro automático.
* **Dano e PV Temporários:** PV temporários absorvem o dano prioritariamente ([`mechanics.ts:274`](../engine/src/mechanics.ts#L274)).
* **Regras de Morte:**
  * Dano massivo causa morte instantânea se o excedente for $\ge$ PV máximo.
  * Sofrer dano a 0 PV adiciona 1 falha contra a morte (ou 2 se for crítico).
  * Teste de morte CD 10: 20 natural cura 1 PV imediatamente; 1 natural soma 2 falhas; 3 falhas = morte.
---

## 9. Progressão de Personagem: Subida de Nível, Multiclasse, Arquétipos e Talentos

| Mecânica | Suporte no Motor | Como funciona |
| :--- | :---: | :--- |
| **Subir de Nível** | **100% Automatizado** | Baseado na tabela oficial de XP 5e (`XP_THRESHOLDS`). Quando atinge o marco, o motor sinaliza `⚠ SUBIDA DE NÍVEL DISPONÍVEL`. O comando `dnd levelup pc [--roll]` incrementa o nível, recalcula bônus de proficiência (+2 a +6), soma PV (média oficial ou rolagem com `--roll` + mod Con), atualiza Dados de Vida máximos e expande os espaços de magia. |
| **Arquétipos (Subclasses)** | **Suporte Nativo na Ficha** | Existe campo dedicado `subclass: string` na ficha (`Sheet`). Aparece no cabeçalho da mesa (ex: *Guerreiro (Campeão)*). As habilidades específicas do arquétipo são adicionadas pelo Mestre à lista `features` via `op: "update"` (`features_add`). |
| **Talentos (Feats)** | **Via Sistema de Características (`features`)** | Não há tabela rígida de talentos isolada. Talentos são registrados na lista de `features: string[]`. Eles são exibidos na ficha na Web/App e injetados diretamente no contexto do Mestre ChatGPT para aplicação nas cenas. |
| **Multiclasse** | **Não Automatizado (Classe Única)** | O motor modela `class` como uma chave única de classe primária. Não calcula progressão dividida (ex: Nível 3 Bruxo / Nível 2 Paladino). Se desejado, deve ser emulada narrativamente e via `features`, mas os dados de vida e slots de magia seguem a classe primária. |

---

## 10. O que falta e Plano de Melhoria para Arquétipos, Talentos, Classes e Raças

Para transformar o sistema descritivo atual em um motor de regras com progressão rica e automatizada, foi elaborada a especificação técnica detalhada em:
👉 **[`docs/SPEC-PROGRESSAO-HABILIDADES.md`](SPEC-PROGRESSAO-HABILIDADES.md)**

### Principais Lacunas Identificadas:
1. **Banco SRD Subutilizado:** A base oficial em `data/srd/2014/normalized/` já contém `features.json` (408 KB), `subclasses.json` (105 KB), `races.json`, `feats.json` e `traits.json`, mas o motor só indexava `monsters` e `spells`.
2. **Subida de Nível Passiva:** No nível 2 de Guerreiro, por exemplo, o motor sobe PV e proficiência, mas exige que o Mestre lembre de adicionar o *Surto de Ação* manualmente via JSON.
3. **Falta de Recursos Contáveis (Pool/Charges):** Poderes como *Segundo Fôlego (1/descanso curto)*, *Surto de Ação (1/descanso curto)*, *Fúria (2/dia)* e *Cura pelas Mãos* são meras anotações de texto, sem contadores com recarga automática nos descansos.
4. **Marcos de Nível (Subclasse & ASI/Talentos):** Nos níveis 3 (escolha de arquétipo) e 4, 8, 12, 16, 19 (ASI ou Talento), o comando `levelup` não assiste nem valida a escolha.

### O que o plano propõe implementar:
* **Indexação Total do SRD:** Novos comandos `dnd srd feat`, `dnd srd subclass`, `dnd srd feature`, `dnd srd race`.
* **Anexação Automática no `levelup`:** Ao atingir o nível, as features da classe e arquétipo são consultadas e auto-injetadas na ficha.
* **Sistema de `TrackedResource`:** Recursos com marcadores de uso interativos na Mesa Web e no Flutter (ex: botões de gastar Segundo Fôlego com cura automática de 1d10 + nível) e recarga em descansos curtos/longos.
* **Validação de Talentos e Bônus Raciais:** Validação de pré-requisitos nos talentos do PHB e injeção automática de traços raciais (*Visão no Escuro*, *Ancestralidade Feérica*, etc.) no `dnd pc create`.

## 11. Mudanças implementadas (12/10/2026)

- Corrigido o falso positivo de “Não” repetido na narração, preservando rejeição de nomes novos não registrados.
- Guia do Mestre reforça que `move`, `money` e `item.give` pertencem ao lote `apply`; a linha 🎲 já é exigida pelo guia e pelo motor.
- Mesa Web: botão “Minimizar” e aviso persistente no topo “🎲 Rolagem pendente”, com “Abrir dados”. O bloqueio de avanço enquanto há dados pendentes continua em vigor.
- Fase 1 da especificação de progressão implementada: consultas SRD ampliadas e helper de habilidades por nível. O snapshot possui apenas Grappler e uma subclasse por classe (Druida: Círculo da Terra).
- Pendentes: barganha após pedido de dados e otimização de latência. As fases 2–4 foram entregues na etapa abaixo. VPS, multiplayer e mapas são descrições do estado atual, sem alterações nesta etapa.

## 12. Progressão e habilidades implementadas (12/10/2026)

As fases 2–4 da especificação estão implementadas: características SRD automáticas, recursos com cargas/recargas, escolhas validadas de subclasse/ASI/talento e opções de habilidades, traços raciais e interfaces Web/Flutter. Constituição aplica PV retroativos. A ficha mostra escolhas pendentes para combinar com o Mestre; a subida não conclui sem as escolhas exigidas pelo novo nível.

Consumo e cura de Segundo Fôlego, Cura pelas Mãos e Integridade Corporal são aplicados pelo motor. Outras características e recursos preservam descrições oficiais para o Mestre conduzir efeitos contextuais; isto não representa automação integral de todos os efeitos passivos ou da economia de ações. Detalhes, compatibilidade e limites estão na seção 7 da especificação.
