import type { ApiSpell } from '@/types';

export const TRANSLATIONS_SPELLS: Record<string, any> = {
        "Acid Arrow": {
          "name": "Flecha Ácida",
          "desc": [
            "Uma flecha verde cintilante corre em direção a um alvo dentro do alcance e explode em um jato de ácido. Faça um ataque mágico de longo alcance contra o alvo. Em caso de acerto, o alvo recebe 4d4 de dano de ácido imediatamente e 2d4 de dano de ácido no final de seu próximo turno. Se errar, a flecha espirra ácido no alvo, causando metade do dano inicial e nenhum dano no final do próximo turno."
          ],
          "higher_level": [
            "Quando você lança esse feitiço usando um espaço de feitiço de 3º nível ou superior, o dano (tanto inicial quanto posterior) aumenta em 1d4 para cada nível de espaço acima do 2º."
          ],
          "material": "Folha de ruibarbo em pó e estômago de víbora.",
          "duration": "Instantâneo",
          "casting_time": "1 ação",
          "attack_type": "variado",
          "damage_type": "Ácido"
        },
        "Acid Splash": {
          "name": "Respingo de ácido",
          "desc": [
            "Você arremessa uma bolha de ácido. Escolha uma criatura dentro do alcance ou duas criaturas dentro do alcance que estejam a até 1,5 metro uma da outra. O alvo deve ser bem-sucedido em um arremesso de salvamento de destreza ou sofrerá 1d6 de dano de ácido.",
            "O dano desse feitiço aumenta em 1d6 quando você atinge o 5º nível (2d6), o 11º nível (3d6) e o 17º nível (4d6)."
          ],
          "duration": "Instantâneo",
          "casting_time": "1 ação",
          "damage_type": "Ácido"
        },
        "Aid": {
          "name": "Ajuda",
          "desc": [
            "Seu feitiço fortalece seus aliados com resistência e determinação. Escolha até três criaturas dentro do alcance. O máximo de pontos de vida de cada alvo e os pontos de vida atuais aumentam em 5 durante o período."
          ],
          "higher_level": [
            "Quando você lança esse feitiço usando um espaço de feitiço de 3º nível ou superior, os pontos de vida do alvo aumentam em 5 pontos adicionais para cada nível de espaço acima do 2º."
          ],
          "material": "Uma pequena tira de tecido branco.",
          "duration": "8 horas",
          "casting_time": "1 ação"
        },
        "Alarm": {
          "name": "Alarme",
          "desc": [
            "Você aciona um alarme contra intrusões indesejadas. Escolha uma porta, uma janela ou uma área dentro do alcance que não seja maior do que um cubo de 6 metros. Até o fim do feitiço, um alarme o alertará sempre que uma criatura de tamanho pequeno ou maior tocar ou entrar na área protegida. Ao lançar o feitiço, você pode designar criaturas que não dispararão o alarme. Você também escolhe se o alarme é mental ou audível.",
            "Um alarme mental o alerta com um ping em sua mente se você estiver a menos de 1 milha da área protegida. Esse ping o despertará se estiver dormindo.",
            "Um alarme sonoro produz o som de um sino de mão por 10 segundos em um raio de 60 pés."
          ],
          "material": "Um pequeno sino e um pedaço de fio de prata fina.",
          "duration": "8 horas",
          "casting_time": "1 minuto"
        },
        "Alter Self": {
          "name": "Idade Autônomo",
          "desc": [
            "Você assume uma forma diferente. Quando lançar o feitiço, escolha uma das seguintes opções, cujos efeitos duram a duração do feitiço. Enquanto o feitiço durar, você pode encerrar uma opção como uma ação para obter os benefícios de uma opção diferente.",
            "***Aquatic Adaptation.*** Você adapta seu corpo a um ambiente aquático, fazendo brotar guelras e criando teias entre os dedos. Você pode respirar debaixo d'água e ganhar uma velocidade de natação igual à sua velocidade de caminhada.",
            "***Mudança de aparência*** Você transforma sua aparência. Você decide como será sua aparência, incluindo altura, peso, características faciais, som da voz, comprimento do cabelo, coloração e características distintivas, se houver. Você pode se apresentar como um membro de outra raça, embora nenhuma de suas estatísticas seja alterada. Você também não pode aparecer como uma criatura de tamanho diferente do seu, e sua forma básica permanece a mesma; se você for bípede, não poderá usar esse feitiço para se tornar quadrúpede, por exemplo. A qualquer momento durante a duração do feitiço, você pode usar sua ação para mudar sua aparência dessa forma novamente.",
            "***Armas naturais*** Você desenvolve garras, presas, espinhos, chifres ou uma arma natural diferente de sua escolha. Seus golpes desarmados causam 1d6 de dano por contusão, perfuração ou corte, conforme apropriado à arma natural escolhida, e você é proficiente com seus golpes desarmados. Finalmente, a arma natural é mágica e você tem um bônus de +1 nas rolagens de ataque e dano que fizer com ela."
          ],
          "duration": "Até 1 hora",
          "casting_time": "1 ação"
        },
        "Animal Friendship": {
          "name": "Amizade animal",
          "desc": [
            "Esse feitiço permite que você convença uma fera de que não quer fazer mal a ela. Escolha um animal que você possa ver dentro do alcance. Ela deve ver e ouvir você. Se a Inteligência do animal for 4 ou maior, o feitiço falha. Caso contrário, o animal deve ser bem-sucedido em um lance de salvamento de sabedoria ou será encantado por você durante a duração do feitiço. Se você ou um de seus companheiros ferir o alvo, o feitiço termina."
          ],
          "material": "Um pedaço de comida.",
          "duration": "24 horas",
          "casting_time": "1 ação"
        },
        "Animal Messenger": {
          "name": "Mensageiro de animais",
          "desc": [
            "Por meio desse feitiço, você usa um animal para entregar uma mensagem. Escolha um animal minúsculo que você possa ver dentro do alcance, como um esquilo, um gaio azul ou um morcego. Você especifica um local, que deve ter visitado, e um destinatário que corresponda a uma descrição geral, como \"um homem ou mulher vestido com o uniforme da guarda da cidade\" ou \"um anão ruivo usando um chapéu pontudo\". Você também fala uma mensagem de até vinte e cinco palavras. O animal-alvo viaja durante o feitiço em direção ao local especificado, percorrendo cerca de 80 quilômetros por 24 horas para um mensageiro voador, ou 80 quilômetros para outros animais.",
            "Quando o mensageiro chega, ele entrega sua mensagem à criatura que você descreveu, reproduzindo o som de sua voz. O mensageiro fala somente com uma criatura que corresponda à descrição que você deu. Se o mensageiro não chegar ao seu destino antes do fim do feitiço, a mensagem será perdida e a criatura voltará para o local onde você lançou o feitiço."
          ],
          "higher_level": [
            "Se você lançar esse feitiço usando um espaço de feitiço de 3º nível ou superior, a duração do feitiço aumentará em 48 horas para cada nível de espaço acima do 2º."
          ],
          "material": "Um pedaço de comida.",
          "duration": "24 horas",
          "casting_time": "1 ação"
        },
        "Animal Shapes": {
          "name": "Formas de animais",
          "desc": [
            "Sua magia transforma os outros em feras. Escolha qualquer número de criaturas dispostas que você possa ver dentro do alcance. Você transforma cada alvo na forma de uma fera grande ou menor com um grau de desafio igual ou inferior a 4. Nos turnos seguintes, você pode usar sua ação para transformar as criaturas afetadas em novas formas.",
            "A transformação dura a duração de cada alvo ou até que o alvo chegue a 0 pontos de vida ou morra. Você pode escolher uma forma diferente para cada alvo. As estatísticas de jogo de um alvo são substituídas pelas estatísticas da fera escolhida, embora o alvo mantenha seu alinhamento e as pontuações de Inteligência, Sabedoria e Carisma. O alvo assume os pontos de vida de sua nova forma e, quando reverte para sua forma normal, retorna ao número de pontos de vida que tinha antes de se transformar. Se ele reverter como resultado de cair para 0 pontos de vida, qualquer dano em excesso será transferido para sua forma normal. Enquanto o excesso de dano não reduzir a forma normal da criatura a 0 pontos de vida, ela não ficará inconsciente. A criatura está limitada nas ações que pode realizar devido à natureza de sua nova forma e não pode falar nem lançar feitiços.",
            "O equipamento do alvo se funde com a nova forma. O alvo não pode ativar, empunhar ou se beneficiar de nenhum de seus equipamentos."
          ],
          "duration": "Até 24 horas",
          "casting_time": "1 ação"
        },
        "Animate Dead": {
          "name": "Animate Dead",
          "desc": [
            "Esse feitiço cria um servo morto-vivo. Escolha uma pilha de ossos ou um cadáver de um humanoide médio ou pequeno dentro do alcance. Seu feitiço imbui o alvo com uma imitação imunda de vida, transformando-o em uma criatura morta-viva. O alvo se torna um esqueleto se você escolheu ossos ou um zumbi se escolheu um cadáver (o GM tem as estatísticas de jogo da criatura).",
            "Em cada um de seus turnos, você pode usar uma ação adicional para comandar mentalmente qualquer criatura que tenha criado com esse feitiço se a criatura estiver a até 60 pés de você (se você controlar várias criaturas, poderá comandar qualquer uma ou todas elas ao mesmo tempo, emitindo o mesmo comando para cada uma). Você decide qual ação a criatura realizará e para onde ela se moverá durante o próximo turno, ou pode emitir um comando geral, como guardar uma determinada câmara ou corredor. Se você não der nenhum comando, a criatura só se defenderá contra criaturas hostis. Uma vez dada uma ordem, a criatura continua a segui-la até que sua tarefa seja concluída.",
            "A criatura fica sob seu controle por 24 horas, após as quais ela deixa de obedecer a qualquer comando que você tenha dado a ela. Para manter o controle da criatura por mais 24 horas, você deve lançar esse feitiço na criatura novamente antes que o período atual de 24 horas termine. Esse uso do feitiço reafirma o seu controle sobre até quatro criaturas que você animou com esse feitiço, em vez de animar uma nova."
          ],
          "higher_level": [
            "Ao lançar esse feitiço usando um espaço de feitiço de 4º nível ou superior, você anima ou reafirma o controle sobre duas criaturas mortas-vivas adicionais para cada nível de espaço acima do 3º. Cada uma das criaturas deve vir de um cadáver ou pilha de ossos diferente."
          ],
          "material": "Uma gota de sangue, um pedaço de carne e uma pitada de pó de osso.",
          "duration": "Instantâneo",
          "casting_time": "1 minuto"
        },
        "Animate Objects": {
          "name": "Animar objetos",
          "desc": [
            "Os objetos ganham vida ao seu comando. Escolha até dez objetos não mágicos dentro do alcance que não estejam sendo usados ou carregados. Alvos médios contam como dois objetos, alvos grandes contam como quatro objetos e alvos enormes contam como oito objetos. Não é possível animar nenhum objeto maior que Huge. Cada alvo é animado e se torna uma criatura sob seu controle até que o feitiço termine ou até que seja reduzido a 0 pontos de vida.",
            "Como uma ação bônus, você pode comandar mentalmente qualquer criatura que tenha feito com esse feitiço se ela estiver a até 500 pés de você (se você controlar várias criaturas, poderá comandar uma ou todas elas ao mesmo tempo, emitindo o mesmo comando para cada uma). Você decide qual ação a criatura realizará e para onde ela se moverá durante o próximo turno, ou pode emitir um comando geral, como guardar uma determinada câmara ou corredor. Se você não emitir nenhum comando, a criatura só se defenderá contra criaturas hostis. Uma vez dada uma ordem, a criatura continua a segui-la até que sua tarefa seja concluída.",
            "##### Estatísticas de objetos animados",
            "| Tamanho | HP | AC | Ataque | Str | Dex |",
            "|---|---|---|---|---|---|",
            "| Tiny | 20 | 18 | +8 para acertar, 1d4 + 4 de dano | 4 | 18 |",
            "| Pequeno | 25 | 16 | +6 para acertar, 1d8 + 2 de dano | 6 | 14 |",
            "| Médio | 40 | 13 | +5 para acertar, 2d6 + 1 de dano | 10 | 12 |",
            "| Grande | 50 | 10 | +6 para acertar, 2d10 + 2 de dano | 14 | 10 |",
            "| Enorme | 80 | 10 | +8 para acertar, 2d12 + 4 de dano | 18 | 6 |",
            "Um objeto animado é um construto com CA, pontos de vida, ataques, força e destreza determinados pelo seu tamanho. Sua Constituição é 10 e sua Inteligência e Sabedoria são 3, e seu Carisma é 1. Sua velocidade é de 30 pés; se o objeto não tiver pernas ou outros apêndices que possa usar para locomoção, ele terá uma velocidade de voo de 30 pés e poderá pairar. Se o objeto estiver firmemente preso a uma superfície ou a um objeto maior, como uma corrente presa a uma parede, sua velocidade é 0. Ele tem visão cega com um raio de 30 pés e fica cego além dessa distância. Quando o objeto animado chega a 0 pontos de vida, ele volta à sua forma original de objeto e qualquer dano restante é transferido para sua forma original de objeto.",
            "Se você comandar um objeto para atacar, ele poderá fazer um único ataque corpo a corpo contra uma criatura em um raio de 1,5 metro. Ele faz um ataque de slam com um bônus de ataque e dano de espancamento determinado pelo seu tamanho. O GM pode determinar que um objeto específico cause dano cortante ou perfurante com base em sua forma."
          ],
          "higher_level": [
            "Se você lançar esse feitiço usando um espaço de feitiço de 6º nível ou superior, poderá animar dois objetos adicionais para cada nível de espaço acima do 5º."
          ],
          "duration": "Até 1 minuto",
          "casting_time": "1 ação"
        },
        "Antilife Shell": {
          "name": "Concha Antilife",
          "desc": [
            "Uma barreira cintilante se estende a partir de você em um raio de 3 metros e se move com você, permanecendo centralizada em você e protegendo criaturas que não sejam mortos-vivos e construtos. A barreira dura por toda a duração.",
            "A barreira impede que uma criatura afetada passe ou alcance a barreira. Uma criatura afetada pode lançar feitiços ou fazer ataques com armas de alcance ou de longo alcance através da barreira.",
            "Se você se mover de forma que uma criatura afetada seja forçada a atravessar a barreira, o feitiço termina."
          ],
          "duration": "Até 1 hora",
          "casting_time": "1 ação"
        },
        "Antimagic Field": {
          "name": "Campo Antimagic",
          "desc": [
            "Uma esfera invisível de antimagia de 3 metros de raio o envolve. Essa área é separada da energia mágica que permeia o multiverso. Dentro da esfera, os feitiços não podem ser lançados, as criaturas convocadas desaparecem e até mesmo os itens mágicos se tornam mundanos. Até que o feitiço termine, a esfera se move com você, centrada em você.",
            "Os feitiços e outros efeitos mágicos, exceto aqueles criados por um artefato ou uma divindade, são suprimidos na esfera e não podem se projetar para dentro dela. Um espaço gasto para lançar um feitiço suprimido é consumido. Enquanto um efeito está suprimido, ele não funciona, mas o tempo que ele passa suprimido é contado em sua duração.",
            "***Efeitos direcionados *** Feitiços e outros efeitos mágicos, como míssil mágico e encantar pessoa, que têm como alvo uma criatura ou um objeto na esfera não têm efeito sobre esse alvo.",
            "***A área de outro feitiço ou efeito mágico, como a bola de fogo, não pode se estender para dentro da esfera. Se a esfera se sobrepuser a uma área de magia, a parte da área coberta pela esfera será suprimida. Por exemplo, as chamas criadas por uma parede de fogo são suprimidas dentro da esfera, criando uma lacuna na parede se a sobreposição for grande o suficiente.",
            "***Qualquer feitiço ativo ou outro efeito mágico em uma criatura ou objeto na esfera é suprimido enquanto a criatura ou o objeto estiver dentro dela.",
            "***Itens mágicos*** As propriedades e os poderes dos itens mágicos são suprimidos na esfera. Por exemplo, uma espada longa +1 na esfera funciona como uma espada longa não mágica.",
            "As propriedades e os poderes de uma arma mágica são suprimidos se ela for usada contra um alvo na esfera ou empunhada por um atacante na esfera. Se uma arma mágica ou uma munição mágica sair totalmente da esfera (por exemplo, se você disparar uma flecha mágica ou lançar uma lança mágica em um alvo fora da esfera), a magia do item deixará de ser suprimida assim que ele sair.",
            "***Viagens mágicas*** O teletransporte e as viagens planares não funcionam na esfera, quer a esfera seja o destino ou o ponto de partida dessas viagens mágicas. Um portal para outro local, mundo ou plano de existência, bem como uma abertura para um espaço extradimensional, como o criado pelo feitiço truque da corda, fecha temporariamente enquanto estiver na esfera.",
            "***Criaturas e objetos*** Uma criatura ou objeto convocado ou criado por magia deixa de existir temporariamente na esfera. Essa criatura reaparece instantaneamente quando o espaço que ela ocupava não estiver mais dentro da esfera.",
            "***Feitiços e efeitos mágicos, como dissipar magia, não têm efeito sobre a esfera. Da mesma forma, as esferas criadas por diferentes feitiços de campo antimagia não anulam umas às outras."
          ],
          "material": "Uma pitada de ferro em pó ou limalha de ferro.",
          "duration": "Até 1 hora",
          "casting_time": "1 ação"
        },
        "Antipathy/Sympathy": {
          "name": "Antipatia/Simpatia",
          "desc": [
            "Esse feitiço atrai ou repele criaturas de sua escolha. Você tem como alvo algo dentro do alcance, seja um objeto ou criatura de tamanho Enorme ou menor ou uma área que não seja maior do que um cubo de 60 metros. Em seguida, especifique um tipo de criatura inteligente, como dragões vermelhos, goblins ou vampiros. Você investe o alvo com uma aura que atrai ou repele as criaturas especificadas durante o período. Escolha antipatia ou simpatia como efeito da aura.",
            "***O encantamento faz com que as criaturas do tipo que você designou sintam um desejo intenso de deixar a área e evitar o alvo. Quando essa criatura puder ver o alvo ou estiver a menos de 60 pés dele, a criatura deve ser bem-sucedida em um arremesso de sabedoria ou ficará assustada. A criatura permanece assustada enquanto puder ver o alvo ou estiver a até 60 pés dele. Enquanto estiver assustada com o alvo, a criatura deve usar seu movimento para se deslocar para o local seguro mais próximo de onde não possa ver o alvo. Se a criatura se mover a mais de 60 pés do alvo e não puder vê-lo, a criatura não estará mais assustada, mas ficará assustada novamente se recuperar a visão do alvo ou se mover a menos de 60 pés dele.",
            "***Simpatia: O encantamento faz com que as criaturas especificadas sintam um desejo intenso de se aproximar do alvo quando estiverem a menos de 60 pés dele ou puderem vê-lo. Quando essa criatura puder ver o alvo ou estiver a menos de 60 pés dele, ela deverá ser bem-sucedida em um lançamento de sabedoria ou usar seu movimento em cada um de seus turnos para entrar na área ou se mover ao alcance do alvo. Quando essa criatura puder ver o alvo ou estiver a menos de 60 pés dele, ela deverá ser bem-sucedida em um arremesso de sabedoria ou usar seu movimento em cada um de seus turnos para entrar na área ou se mover ao alcance do alvo. Quando a criatura tiver feito isso, ela não poderá se afastar do alvo por vontade própria.",
            "Se o alvo danificar ou ferir de outra forma uma criatura afetada, essa criatura poderá fazer um lance de economia de sabedoria para encerrar o efeito, conforme descrito abaixo.",
            "***Se uma criatura afetada terminar seu turno sem estar a até 60 pés do alvo ou sem conseguir vê-lo, ela fará um arremesso salvador de sabedoria. Se o salvamento for bem-sucedido, a criatura não será mais afetada pelo alvo e reconhecerá o sentimento de repugnância ou atração como mágico. Além disso, a criatura afetada pelo feitiço pode fazer outra tentativa de defesa de sabedoria a cada 24 horas enquanto o feitiço persistir.",
            "Uma criatura que conseguir se salvar desse efeito fica imune a ele por 1 minuto, após o qual pode ser afetada novamente."
          ],
          "material": "Um pedaço de alume embebido em vinagre para o efeito de antipatia ou uma gota de mel para o efeito de simpatia.",
          "duration": "10 dias",
          "casting_time": "1 hora"
        },
        "Arcane Eye": {
          "name": "Olho Arcano",
          "desc": [
            "Você cria um olho mágico invisível dentro do alcance que paira no ar durante o período.",
            "Você recebe mentalmente informações visuais do olho, que tem visão normal e visão escura até 30 pés. O olho pode olhar em todas as direções.",
            "Como uma ação, você pode mover o olho até 30 pés em qualquer direção. Não há limite para a distância que o olho pode se afastar de você, mas ele não pode entrar em outro plano de existência. Uma barreira sólida bloqueia o movimento do olho, mas o olho pode passar por uma abertura de até 1 polegada de diâmetro."
          ],
          "material": "Um pouco de pele de morcego.",
          "duration": "Até 1 hora",
          "casting_time": "1 ação"
        },
        "Arcane Hand": {
          "name": "Mão Arcana",
          "desc": [
            "Você cria uma mão grande de força cintilante e translúcida em um espaço desocupado que você possa ver dentro do alcance. A mão dura a duração do feitiço e se move sob seu comando, imitando os movimentos de sua própria mão.",
            "A mão é um objeto que tem CA 20 e pontos de vida iguais ao seu máximo de pontos de vida. Se ela cair para 0 pontos de vida, o feitiço termina. Ela tem Força de 26 (+8) e Destreza de 10 (+0). A mão não preenche seu espaço.",
            "Ao lançar o feitiço e como uma ação bônus nos turnos seguintes, você pode mover a mão até 60 pés e causar um dos seguintes efeitos com ela.",
            "***Punho cerrado: A mão atinge uma criatura ou objeto em um raio de 1,5 metro. Faça um ataque mágico corpo a corpo para a mão usando suas estatísticas de jogo. Em caso de acerto, o alvo recebe 4d8 de dano de força.",
            "***A mão tenta empurrar uma criatura em um raio de 1,5 metro na direção que você escolher. Faça uma verificação com a Força da mão contestada pela verificação de Força (Atletismo) do alvo. Se o alvo for de tamanho Médio ou menor, você tem vantagem na verificação. Se você for bem-sucedido, a mão empurra o alvo até 1,5 metro mais um número de metros igual a cinco vezes o seu modificador de habilidade de lançamento de feitiço. A mão se move com o alvo para permanecer a até 1,5 m dele.",
            "***A mão tenta agarrar uma criatura Enorme ou menor em um raio de 1,5 m dela. Você usa a pontuação de Força da mão para resolver o agarramento. Se o alvo for Médio ou menor, você tem vantagem na verificação. Enquanto a mão estiver agarrando o alvo, você pode usar uma ação adicional para fazer com que a mão o esmague. Ao fazer isso, o alvo recebe dano de arma branca igual a 2d6 + seu modificador de habilidade de lançamento de feitiço.",
            "***A mão se interpõe entre você e uma criatura que você escolher até que você dê a ela um comando diferente. A mão se move para ficar entre você e o alvo, fornecendo-lhe meia cobertura contra o alvo. O alvo não pode se mover pelo espaço da mão se sua pontuação de Força for menor ou igual à pontuação de Força da mão. Se a pontuação de Força for maior que a pontuação de Força da mão, o alvo pode se mover em sua direção pelo espaço da mão, mas esse espaço é um terreno difícil para o alvo."
          ],
          "higher_level": [
            "Quando você conjura esse feitiço usando um espaço de feitiço de 6º nível ou superior, o dano da opção de punho cerrado aumenta em 2d8 e o dano da opção de mão agarrada aumenta em 2d6 para cada nível de espaço acima do 5º."
          ],
          "material": "Uma casca de ovo e uma luva de pele de cobra.",
          "duration": "Até 1 minuto",
          "casting_time": "1 ação"
        },
        "Arcane Lock": {
          "name": "Trava Arcana",
          "desc": [
            "Se você tocar em uma porta, janela, portão, baú ou outra porta de entrada fechada, ela ficará trancada pelo tempo que durar. Você e as criaturas designadas por você ao lançar esse feitiço podem abrir o objeto normalmente. Você também pode definir uma senha que, quando falada a menos de 1,5 m do objeto, suprime esse feitiço por 1 minuto. Caso contrário, o objeto fica intransponível até ser quebrado ou o feitiço ser dissipado ou suprimido. Lançar knock no objeto suprime o bloqueio arcano por 10 minutos.",
            "Enquanto afetado por esse feitiço, o objeto é mais difícil de ser quebrado ou aberto à força; a DC para quebrá-lo ou abrir qualquer fechadura aumenta em 10."
          ],
          "material": "Pó de ouro no valor mínimo de 25gp, que o feitiço consome.",
          "duration": "Até que seja dissipado",
          "casting_time": "1 ação"
        },
        "Arcane Sword": {
          "name": "Espada Arcana",
          "desc": [
            "Você cria um plano de força em forma de espada que paira dentro do alcance. Ele dura por toda a duração.",
            "Quando a espada aparece, você faz um ataque mágico corpo a corpo contra um alvo de sua escolha em um raio de 1,5 metro da espada. Se for atingido, o alvo recebe 3d10 de dano de força. Até que o feitiço termine, você pode usar uma ação adicional em cada um de seus turnos para mover a espada até 6 metros para um local que possa ver e repetir esse ataque contra o mesmo alvo ou um alvo diferente."
          ],
          "material": "Uma espada de platina em miniatura com empunhadura e pomo de cobre e zinco, no valor de 250 gp.",
          "duration": "Até 1 minuto",
          "casting_time": "1 ação",
          "attack_type": "corpo a corpo",
          "damage_type": "Força"
        },
        "Arcanist's Magic Aura": {
          "name": "Aura Mágica do Arcanista",
          "desc": [
            "Você coloca uma ilusão em uma criatura ou em um objeto que você toca para que os feitiços de adivinhação revelem informações falsas sobre ele. O alvo pode ser uma criatura disposta ou um objeto que não esteja sendo carregado ou usado por outra criatura.",
            "Quando você lançar o feitiço, escolha um ou ambos os efeitos a seguir. O efeito dura por toda a duração. Se você lançar esse feitiço na mesma criatura ou objeto todos os dias durante 30 dias, colocando o mesmo efeito nele todas as vezes, a ilusão durará até ser dissipada.",
            "***Aura falsa: Você altera a forma como o alvo aparece para feitiços e efeitos mágicos, como detectar magia, que detectam auras mágicas. Você pode fazer um objeto não mágico parecer mágico, um objeto mágico parecer não mágico ou alterar a aura mágica do objeto para que ele pareça pertencer a uma escola específica de magia que você escolher. Ao usar esse efeito em um objeto, você pode tornar a falsa magia aparente para qualquer criatura que manuseie o item.",
            "***Você altera a forma como o alvo aparece para os feitiços e efeitos mágicos que detectam tipos de criatura, como o Sentido Divino de um paladino ou o acionamento de um feitiço de símbolo. Você escolhe um tipo de criatura e outros feitiços e efeitos mágicos tratam o alvo como se fosse uma criatura daquele tipo ou daquele alinhamento."
          ],
          "material": "Um pequeno quadrado de seda.",
          "duration": "24 horas",
          "casting_time": "1 ação"
        },
        "Astral Projection": {
          "name": "Projeção Astral",
          "desc": [
            "Você e até oito criaturas dispostas dentro do alcance projetam seus corpos astrais no Plano Astral (o feitiço falha e a conjuração é desperdiçada se você já estiver nesse plano). O corpo material que você deixa para trás está inconsciente e em um estado de animação suspensa; ele não precisa de comida ou ar e não envelhece.",
            "Seu corpo astral se assemelha à sua forma mortal em quase todos os aspectos, reproduzindo suas estatísticas de jogo e suas posses. A principal diferença é o acréscimo de um cordão prateado que se estende entre as omoplatas e segue atrás de você, tornando-se invisível depois de 1 pé. Esse cordão é sua ligação com seu corpo material. Enquanto a corda permanecer intacta, você poderá encontrar o caminho de casa. Se o cordão for cortado - algo que só pode acontecer quando um efeito especificamente o determina - sua alma e seu corpo se separam, matando-o instantaneamente.",
            "Sua forma astral pode viajar livremente pelo Plano Astral e pode passar por portais que levam a qualquer outro plano. Se você entrar em um novo plano ou retornar ao plano em que estava quando lançou esse feitiço, seu corpo e suas posses serão transportados pelo cordão de prata, permitindo que você entre novamente em seu corpo ao entrar no novo plano. Sua forma astral é uma encarnação separada. Qualquer dano ou outros efeitos que se apliquem a ela não têm efeito sobre seu corpo físico, nem persistem quando você retorna a ele.",
            "O feitiço termina para você e seus companheiros quando você usa a sua ação para descartá-lo. Quando o feitiço termina, a criatura afetada retorna ao seu corpo físico e desperta.",
            "O feitiço também pode terminar mais cedo para você ou um de seus companheiros. Um feitiço de dissipação de magia bem-sucedido usado contra um corpo astral ou físico encerra o feitiço para essa criatura. Se o corpo original de uma criatura ou sua forma astral chegar a 0 pontos de vida, o feitiço será encerrado para essa criatura. Se o feitiço terminar e o cordão de prata estiver intacto, o cordão puxará a forma astral da criatura de volta ao seu corpo, encerrando seu estado de animação suspensa.",
            "Se você retornar ao seu corpo prematuramente, seus companheiros permanecerão em suas formas astrais e precisarão encontrar o caminho de volta para seus corpos, geralmente caindo para 0 pontos de vida."
          ],
          "material": "Para cada criatura afetada por esse feitiço, você deve fornecer um jacinto no valor de pelo menos 1.000gp e uma barra de prata ornamentada no valor de pelo menos 100gp, todos consumidos pelo feitiço.",
          "duration": "Especial",
          "casting_time": "1 hora"
        },
        "Augury": {
          "name": "Augúrio",
          "desc": [
            "Ao lançar bastões incrustados de pedras preciosas, rolar ossos de dragão, dispor cartas ornamentadas ou usar alguma outra ferramenta de adivinhação, você recebe um presságio de uma entidade de outro mundo sobre os resultados de um curso de ação específico que você planeja realizar nos próximos 30 minutos. O MJ escolhe entre os seguintes presságios possíveis:",
            "- Saúde, para bons resultados",
            "- Ai, por resultados ruins",
            "- Bem e mal, tanto para resultados bons quanto ruins",
            "- Nada, para resultados que não sejam especialmente bons ou ruins",
            "O feitiço não leva em conta nenhuma circunstância possível que possa alterar o resultado, como o lançamento de feitiços adicionais ou a perda ou ganho de um companheiro.",
            "Se você lançar o feitiço duas ou mais vezes antes de completar seu próximo descanso longo, haverá uma chance cumulativa de 25% de obter uma leitura aleatória para cada lançamento após o primeiro. O GM faz essa rolagem em segredo."
          ],
          "material": "Bastões, ossos ou fichas semelhantes especialmente marcados, com valor mínimo de 25gp.",
          "duration": "Instantâneo",
          "casting_time": "1 minuto"
        },
        "Awaken": {
          "name": "Despertar",
          "desc": [
            "Depois de passar o tempo de conjuração traçando caminhos mágicos dentro de uma pedra preciosa, você toca um animal ou planta enorme ou menor. O alvo não deve ter pontuação de Inteligência ou deve ter uma Inteligência igual ou inferior a 3. O alvo ganha uma Inteligência de 10. O alvo também ganha a capacidade de falar um idioma que você conhece. Se o alvo for uma planta, ele ganha a capacidade de mover seus membros, raízes, vinhas, trepadeiras e assim por diante, e ganha sentidos semelhantes aos de um humano. Seu MJ escolhe as estatísticas apropriadas para a planta desperta, como as estatísticas para o arbusto desperto ou a árvore desperta.",
            "O animal ou planta desperto fica encantado por você por 30 dias ou até que você ou seus companheiros façam algo prejudicial a ele. Quando a condição de encantamento termina, a criatura desperta escolhe se quer continuar amigável com você, com base em como você a tratou enquanto estava encantada."
          ],
          "material": "Uma ágata com valor mínimo de 1.000 gp, que o feitiço consome.",
          "duration": "Instantâneo",
          "casting_time": "8 horas"
        }
      };
      

      

// A more robust translation function that handles nested properties
export const translateSpell = (spell: ApiSpell): ApiSpell => {
    if (!spell) return spell;

    const translatedSpell = { ...spell };

    const spellTranslation = TRANSLATIONS_SPELLS[spell.name];

    translatedSpell.name = spellTranslation?.name || spell.name;
    translatedSpell.desc = spellTranslation?.desc || spell.desc;
    translatedSpell.higher_level = spellTranslation?.higher_level || spell.higher_level;
    translatedSpell.material = spellTranslation?.material || spell.material;

    if (translatedSpell.school?.name) {
        translatedSpell.school.name = translatedSpell.school.name;
    }

    if (translatedSpell.damage?.damage_type?.name) {
        translatedSpell.damage.damage_type.name = translatedSpell.damage.damage_type.name;
    }

    return translatedSpell;
};
