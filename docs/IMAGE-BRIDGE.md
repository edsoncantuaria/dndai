# Image Bridge (experimental, desativado no Cursor)

MCP removido — fluxo manual não atendeu. Código mantido só como referência.

- Túnel: **https://wbhk.cloudive.com.br/** → **localhost:8881**
- Config: **`~/.cursor/image-bridge.env`**
- Imagens: **`~/.cursor/image-bridge/output/`**

## Subir o bridge

```bash
npm run image-bridge
# no repo onde está o código (hoje: dndai)
```

## Só no projeto dndai

A regra `public/assets/AI/` aplica-se ao repo dndai. O MCP **image-bridge** é global (`~/.cursor/mcp.json`).

Para copiar uma imagem do bridge para o dndai manualmente:

```bash
cp ~/.cursor/image-bridge/output/minha-imagem.png public/assets/AI/
```

Ou defina no `image-bridge.env`:

```env
IMAGE_BRIDGE_OUTPUT_DIR=/caminho/para/dndai/public/assets/AI
```

(apenas quando estiver trabalhando nesse repo)
