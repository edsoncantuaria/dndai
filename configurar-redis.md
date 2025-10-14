# Guia de Instalação e Configuração do Redis no Ubuntu

Este guia irá orientá-lo na instalação e configuração de um servidor Redis em uma máquina Ubuntu. O Redis será usado como um cache para acelerar as respostas da API e reduzir a carga em serviços externos.

## Passo 1: Atualizar o Sistema

Primeiro, certifique-se de que a lista de pacotes do seu servidor está atualizada.

```bash
sudo apt update
sudo apt upgrade
```

## Passo 2: Instalar o Servidor Redis

Instale o pacote `redis-server` usando o `apt`.

```bash
sudo apt install redis-server
```

## Passo 3: Verificar se o Redis está Rodando

Após a instalação, o Redis deve iniciar automaticamente. Você pode verificar seu status com o seguinte comando:

```bash
sudo systemctl status redis-server
```

Você deverá ver uma saída indicando que o serviço está `active (running)`. Pressione `Q` para sair da tela de status.

Se não estiver rodando, você pode iniciá-lo com: `sudo systemctl start redis-server`.

## Passo 4: Habilitar o Redis na Inicialização do Sistema

Para garantir que o Redis inicie automaticamente sempre que o servidor for reiniciado, habilite-o no `systemctl`:

```bash
sudo systemctl enable redis-server
```

## Passo 5: Configurar uma Senha (Segurança Recomendada)

Por padrão, o Redis não exige senha. É uma prática de segurança **altamente recomendada** configurar uma.

1.  Abra o arquivo de configuração do Redis com um editor de texto, como o `nano`:

    ```bash
    sudo nano /etc/redis/redis.conf
    ```

2.  Dentro do arquivo, procure pela diretiva `# requirepass foobared`. Ela estará comentada.

3.  Remova o `#` do início da linha e substitua `foobared` por uma senha forte e segura de sua escolha.

    ```conf
    # Antes:
    # requirepass foobared

    # Depois (exemplo):
    requirepass SuaSenhaSuperSegura123!
    ```

4.  Salve o arquivo e saia do editor (no `nano`, pressione `Ctrl+X`, depois `Y` e `Enter`).

5.  Reinicie o serviço do Redis para que as alterações entrem em vigor:

    ```bash
    sudo systemctl restart redis-server
    ```

## Passo 6: Obter a URL de Conexão do Redis

O backend da nossa aplicação se conecta ao Redis usando uma única URL. Com a configuração acima, sua `REDIS_URL` terá o seguinte formato:

```
redis://:[sua_senha]@[host]:[porta]
```

-   **[sua_senha]**: A senha que você configurou no Passo 5.
-   **[host]**: Se o Redis estiver rodando na mesma máquina que o backend, use `localhost` ou `127.0.0.1`.
-   **[porta]**: A porta padrão do Redis é `6379`.

**Exemplo de URL:**

```
redis://:SuaSenhaSuperSegura123!@localhost:6379
```

## Passo 7: Adicionar a URL ao Arquivo `.env`

Agora, adicione a URL que você montou ao arquivo `.env` localizado na pasta `backend` do seu projeto:

```env
# backend/.env

# ... outras variáveis ...

# Configuração do Redis
REDIS_URL="redis://:SuaSenhaSuperSegura123!@localhost:6379"
```

Após adicionar a variável de ambiente, reinicie o servidor do backend para que ele se conecte ao Redis. Agora, seu cache de dados da API D&D 5e está funcionando!
