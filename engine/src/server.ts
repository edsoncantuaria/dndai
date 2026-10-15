import { createReadStream, existsSync, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { timingSafeEqual } from "node:crypto";
import {
  createCampaign,
  listCampaigns,
  openCampaign,
  resolveCampaign,
  snapshotCampaign,
  withCampaignLock,
} from "./campaign.ts";
import { type DB, metaNum, transaction } from "./db.ts";
import { applyItemAction } from "./items.ts";
import {
  levelUp,
  longRest,
  pendingRequests,
  resolveRequest,
  shortRest,
  useResource,
} from "./mechanics.ts";
import { createPc } from "./pc.ts";
import { levelUpOptions } from "./progression.ts";
import { getCharacterCreationOptions } from "./character-options.ts";
import { requirePc } from "./world.ts";
import { sendToMaster } from "./master/client.ts";
import { chatVersion, chatView } from "./master/queue.ts";
import { buildView } from "./view.ts";

export interface ServeOptions {
  host: string;
  port: number;
  staticDir?: string;
  token?: string;
  corsOrigins: string[];
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wasm": "application/wasm",
  ".ico": "image/x-icon",
  ".apk": "application/vnd.android.package-archive",
  ".gz": "application/gzip",
  ".tgz": "application/gzip",
  ".tar": "application/x-tar",
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function startServer(opts: ServeOptions) {
  // Abre/fecha por uso: o `dnd undo` troca o arquivo do banco e conexões longas veriam o arquivo antigo.
  const withDb = <T>(slug: string, fn: (db: DB) => T): T =>
    withCampaignLock(slug, () => {
      const db = openCampaign(slug);
      try {
        return fn(db);
      } finally {
        db.close();
      }
    });
  if (process.env.DNDAI_BACKUP_DIR) {
    const timer = setInterval(
      () => {
        for (const c of listCampaigns()) {
          try {
            snapshotCampaign(c.slug, "periodico");
          } catch (error) {
            console.error(`[backup] ${c.slug}: ${(error as Error).message}`);
          }
        }
      },
      15 * 60 * 1000,
    );
    timer.unref();
  }
  const slugOf = (url: URL) =>
    resolveCampaign(url.searchParams.get("campaign") ?? undefined);

  const allowOrigin = (origin: string | undefined): string | undefined => {
    if (!origin) return undefined;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      return origin;
    return opts.corsOrigins.includes(origin) ? origin : undefined;
  };

  const authorized = (req: IncomingMessage, url: URL): boolean => {
    if (!opts.token) return true;
    const header = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const given = header ?? url.searchParams.get("token") ?? "";
    const a = Buffer.from(given);
    const b = Buffer.from(opts.token);
    return a.length === b.length && timingSafeEqual(a, b);
  };

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify(body));
  };

  const readBody = (req: IncomingMessage): Promise<unknown> =>
    new Promise((ok, fail) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => {
        size += c.length;
        if (size > 64 * 1024) {
          fail(new HttpError(413, "Corpo grande demais."));
          req.destroy();
        } else chunks.push(c);
      });
      req.on("end", () => {
        try {
          ok(
            chunks.length
              ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
              : {},
          );
        } catch {
          fail(new HttpError(400, "JSON inválido."));
        }
      });
      req.on("error", fail);
    });

  const sse = (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const slug = slugOf(url);
    withDb(slug, () => undefined);
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    let last = "";
    const tick = () => {
      try {
        const v = withDb(slug, (db) => metaNum(db, "version"));
        const chat = chatVersion(slug);
        if (`${v}/${chat}` !== last) {
          last = `${v}/${chat}`;
          res.write(
            `event: change\ndata: ${JSON.stringify({ version: v, chat })}\n\n`,
          );
        }
      } catch (error) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ error: (error as Error).message })}\n\n`,
        );
      }
    };
    tick();
    const poll = setInterval(tick, 500);
    const ping = setInterval(() => res.write(": ping\n\n"), 15000);
    req.on("close", () => {
      clearInterval(poll);
      clearInterval(ping);
    });
  };

  const checkOrStartTts = async (ttsBase: string): Promise<boolean> => {
    try {
      const res = await fetch(`${ttsBase}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) return true;
    } catch {}
    try {
      const ttsDir = resolve(import.meta.dirname ?? process.cwd(), "../tts");
      const pythonVenv = join(ttsDir, ".venv/bin/python");
      const serverPy = join(ttsDir, "server.py");
      if (existsSync(pythonVenv) && existsSync(serverPy)) {
        const cp = spawn(pythonVenv, [serverPy], {
          cwd: ttsDir,
          detached: true,
          stdio: "ignore",
          env: { ...process.env, DNDAI_TTS_PORT: "8795" },
        });
        cp.unref();
        await new Promise((r) => setTimeout(r, 1600));
        const res = await fetch(`${ttsBase}/health`, {
          signal: AbortSignal.timeout(2000),
        }).catch(() => null);
        return res?.ok ?? false;
      }
    } catch {}
    return false;
  };

  /** Voz da narração: `key` é a mesma chave do palco da mesa (`chat-<id>` ou `turn-<n>`). */
  const tts = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const slug = slugOf(url);
    const key = /^(chat|turn)-(\d+)$/.exec(url.searchParams.get("key") ?? "");
    if (!key) throw new HttpError(400, "Envie key=chat-<id> ou key=turn-<n>.");
    const id = Number(key[2]);
    const text =
      key[1] === "chat"
        ? chatView(slug).messages.find(
            (m) => m.id === id && m.role === "mestre",
          )?.text
        : withDb(slug, (db) => {
            const t = db
              .prepare("SELECT narration, summary FROM turns WHERE n = ?")
              .get(id) as { narration: string; summary: string } | undefined;
            return t && (t.narration || t.summary);
          });
    if (!text) throw new HttpError(404, "Narração não encontrada.");
    // Serviço de voz local (engine/tts): Kokoro em pt-BR, devolve MP3.
    const ttsBase = (
      process.env.DNDAI_TTS_URL ?? "http://127.0.0.1:8795"
    ).replace(/\/+$/, "");
    let upstream: Response;
    try {
      upstream = await fetch(`${ttsBase}/speak`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch {
      const recovered = await checkOrStartTts(ttsBase);
      if (recovered) {
        try {
          upstream = await fetch(`${ttsBase}/speak`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text }),
          });
        } catch {
          throw new HttpError(
            503,
            `Voz indisponível: o serviço de TTS (${ttsBase}) não respondeu.`,
          );
        }
      } else {
        throw new HttpError(
          503,
          `Voz indisponível: o serviço de TTS (${ttsBase}) não respondeu.`,
        );
      }
    }
    if (!upstream.ok) {
      const error = (
        (await upstream.json().catch(() => null)) as { error?: string } | null
      )?.error;
      throw new HttpError(
        upstream.status === 422 ? 422 : 502,
        error ?? `Voz indisponível: o TTS respondeu ${upstream.status}.`,
      );
    }
    const audioBuffer = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(200, {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
      "content-length": audioBuffer.length.toString(),
      "accept-ranges": "bytes",
    });
    res.end(audioBuffer);
  };

  const serveStatic = (
    res: ServerResponse,
    pathname: string,
    method: string = "GET",
  ): boolean => {
    if (!opts.staticDir) return false;
    const root = resolve(opts.staticDir);
    let file = normalize(join(root, decodeURIComponent(pathname)));
    if (!file.startsWith(root)) return false;
    if (!existsSync(file) || statSync(file).isDirectory())
      file = join(root, "index.html"); // SPA
    if (!existsSync(file)) return false;
    const stat = statSync(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "content-length": stat.size.toString(),
      "accept-ranges": "bytes",
    });
    if (method === "HEAD") {
      res.end();
      return true;
    }
    createReadStream(file).pipe(res);
    return true;
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const origin = allowOrigin(req.headers.origin);
    if (origin) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
      res.setHeader(
        "access-control-allow-headers",
        "content-type, authorization",
      );
      res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS, HEAD");
    }
    if (req.method === "OPTIONS") return void res.writeHead(204).end();
    try {
      if (!url.pathname.startsWith("/api/")) {
        if (
          (req.method === "GET" || req.method === "HEAD") &&
          serveStatic(res, url.pathname, req.method)
        )
          return;
        throw new HttpError(404, "Não encontrado.");
      }
      if (req.method === "POST" && url.pathname === "/api/auth/login") {
        const body = (await readBody(req)) as {
          login?: unknown;
          password?: unknown;
        };
        const login =
          typeof body.login === "string" ? body.login.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const validUser =
          (login === "edsoncantuaria@outlook.com" || login === "edson") &&
          password === "teste123";
        const validToken =
          opts.token && (password === opts.token || login === opts.token);
        if (!validUser && !validToken)
          throw new HttpError(401, "Credenciais inválidas.");
        return send(res, 200, {
          token: opts.token ?? "auth-ok",
          user: {
            email: login || "edsoncantuaria@outlook.com",
            name: "Edson Cantuária",
          },
        });
      }
      if (!authorized(req, url)) throw new HttpError(401, "Token inválido.");
      if (req.method === "POST" && url.pathname === "/api/campaigns/new") {
        const body = (await readBody(req)) as {
          slug?: unknown;
          name?: unknown;
          premise?: unknown;
          tone?: unknown;
        };
        const slug = typeof body.slug === "string" ? body.slug.trim() : "";
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!slug || !name)
          throw new HttpError(400, "Envie slug e name da campanha.");
        const db = createCampaign(slug, {
          name,
          premise: typeof body.premise === "string" ? body.premise : "",
          tone: typeof body.tone === "string" ? body.tone : "",
        });
        db.close();
        return send(res, 201, { slug, name });
      }
      if (req.method === "GET" && url.pathname === "/api/pc/creation-options") {
        const race = url.searchParams.get("race") ?? "human";
        const characterClass = url.searchParams.get("class") ?? "fighter";
        const background = url.searchParams.get("background") ?? "acolyte";
        try {
          const options = getCharacterCreationOptions(race, characterClass, background);
          return send(res, 200, options);
        } catch (err: any) {
          throw new HttpError(400, err?.message ?? "Parâmetros inválidos para criação.");
        }
      }
      if (req.method === "POST" && url.pathname === "/api/pc/create") {
        const slug = slugOf(url);
        const raw = ((await readBody(req)) ?? {}) as Record<string, any>;
        const cls =
          typeof raw.class === "string" && raw.class.trim()
            ? raw.class.trim()
            : "Guerreiro";
        const race =
          typeof raw.race === "string" && raw.race.trim()
            ? raw.race.trim()
            : "Humano";
        const name =
          typeof raw.name === "string" && raw.name.trim()
            ? raw.name.trim()
            : "Herói";
        const defaultAbilities = {
          for: 15,
          des: 13,
          con: 14,
          int: 10,
          sab: 12,
          car: 8,
        };
        const abilities =
          raw.abilities && typeof raw.abilities === "object"
            ? raw.abilities
            : raw.base_abilities
              ? undefined
              : defaultAbilities;
        const desMod = Math.floor(
          (((abilities ?? raw.base_abilities)?.des ?? 10) - 10) / 2,
        );
        const ac =
          typeof raw.ac === "number" ? raw.ac : Math.max(10, 10 + desMod);
        const payload = {
          name,
          race,
          class: cls,
          subclass: raw.subclass ?? "",
          background: raw.background ?? "Herói do Povo",
          level: typeof raw.level === "number" ? raw.level : 1,
          ...(abilities ? { abilities } : {}),
          ac,
          ...raw,
        };
        const lines = withDb(slug, (db) =>
          transaction(db, () => createPc(db, payload)),
        );
        return send(res, 201, { ok: true, lines });
      }
      if (req.method === "POST" && url.pathname === "/api/pc/levelup") {
        const slug = slugOf(url);
        const raw = ((await readBody(req)) ?? {}) as Record<string, any>;
        const hpMode = raw.hpMode === "rolar" ? "rolar" : "media";
        const text = withDb(slug, (db) => {
          const pc = requirePc(db);
          return transaction(db, () =>
            levelUp(db, pc.id, hpMode, undefined, {
              subclass:
                typeof raw.subclass === "string" && raw.subclass.trim()
                  ? raw.subclass.trim()
                  : undefined,
              asi:
                typeof raw.asi === "string" && raw.asi.trim()
                  ? raw.asi.trim()
                  : undefined,
              feat:
                typeof raw.feat === "string" && raw.feat.trim()
                  ? raw.feat.trim()
                  : undefined,
              choices:
                raw.choices && typeof raw.choices === "object"
                  ? raw.choices
                  : undefined,
            }),
          );
        });
        return send(res, 200, { ok: true, text });
      }
      if (req.method === "GET" && url.pathname === "/api/pc/levelup-options") {
        const slug = slugOf(url);
        const subclass = url.searchParams.get("subclass") ?? undefined;
        const options = withDb(slug, (db) => {
          const pc = requirePc(db);
          return levelUpOptions(pc.sheet, pc.level, subclass);
        });
        return send(res, 200, options);
      }
      if (req.method === "POST" && url.pathname === "/api/pc/rest") {
        const slug = slugOf(url);
        const raw = ((await readBody(req)) ?? {}) as Record<string, any>;
        const kind = raw.kind === "long" ? "long" : "short";
        const dice = typeof raw.dice === "number" ? raw.dice : 1;
        const text = withDb(slug, (db) => {
          const pc = requirePc(db);
          return transaction(db, () =>
            kind === "long" ? longRest(db, pc.id) : shortRest(db, pc.id, dice),
          );
        });
        return send(res, 200, { ok: true, text });
      }
      if (req.method === "GET" && url.pathname === "/api/campaigns") {
        const current = process.env.DND_CAMPAIGN;
        return send(
          res,
          200,
          listCampaigns().map((c) => ({ ...c, current: c.slug === current })),
        );
      }
      if (req.method === "GET" && url.pathname === "/api/state") {
        const slug = slugOf(url);
        const view = withDb(slug, (db) => buildView(db, slug));
        const { messages, master } = chatView(slug);
        return send(res, 200, { ...view, chat: messages, master });
      }
      if (req.method === "GET" && url.pathname === "/api/events")
        return sse(req, res, url);
      if (req.method === "GET" && url.pathname === "/api/tts")
        return await tts(req, res, url);
      const rollMatch = /^\/api\/rolls\/(\d+)$/.exec(url.pathname);
      if (req.method === "POST" && rollMatch) {
        const slug = slugOf(url);
        const body = (await readBody(req)) as { dice?: unknown };
        if (
          !Array.isArray(body.dice) ||
          !body.dice.every((d) => Number.isInteger(d))
        )
          throw new HttpError(400, 'Envie { "dice": [inteiros] }.');
        const id = Number(rollMatch[1]);
        try {
          const outcome = withDb(slug, (db) =>
            transaction(db, () =>
              resolveRequest(db, id, body.dice as number[], "mesa"),
            ),
          );
          const { text: resultText, ...rest } = outcome;
          // Mesa em modo conversa: avisa o Mestre para continuar o turno a partir do resultado.
          if (chatView(slug, 1).messages.length) {
            await sendToMaster(
              slug,
              `Rolagem #${id} resolvida na mesa: ${resultText.replaceAll("\n", " · ")}. Continue o turno aberto a partir deste resultado.`,
              "sistema",
            ).catch((error) => {
              console.error(
                `[mesa] não avisei o Mestre da rolagem #${id}: ${(error as Error).message}`,
              );
            });
          }
          return send(res, 200, rest);
        } catch (error) {
          const msg = (error as Error).message;
          throw new HttpError(
            /já está/.test(msg) ? 409 : /não existe/.test(msg) ? 404 : 400,
            msg,
          );
        }
      }
      if (req.method === "POST" && url.pathname === "/api/actions") {
        const slug = slugOf(url);
        const body = (await readBody(req)) as {
          action?: unknown;
          item?: unknown;
        };
        if (typeof body.action !== "string" || typeof body.item !== "string")
          throw new HttpError(
            400,
            'Envie { "action": "...", "item": "<id>" }.',
          );
        const pending = withDb(slug, (db) => pendingRequests(db));
        if (pending.length)
          throw new HttpError(
            409,
            `Role os dados primeiro: ${pending.map((r) => `#${r.id} ${r.label}`).join(", ")}.`,
          );

        let text: string;
        try {
          text = withDb(slug, (db) =>
            transaction(db, () =>
              applyItemAction(db, body.action as string, body.item as string),
            ),
          );
        } catch (error) {
          const msg = (error as Error).message;
          throw new HttpError(
            /não tem "|não existe/.test(msg)
              ? 404
              : /não pode agir|Não dá para/.test(msg)
                ? 409
                : 400,
            msg,
          );
        }
        // Com o Mestre conectado, ele narra a consequência (como nas rolagens).
        if (chatView(slug, 1).messages.length) {
          await sendToMaster(
            slug,
            `Ação do jogador na mesa: ${text} Narre a reação da cena a partir disto (o motor já aplicou a mecânica).`,
            "sistema",
          ).catch((error) => {
            console.error(
              `[mesa] não avisei o Mestre da ação: ${(error as Error).message}`,
            );
          });
        }
        return send(res, 200, { text });
      }
      if (req.method === "POST" && url.pathname === "/api/resources") {
        const slug = slugOf(url);
        const body = (await readBody(req)) as {
          resource?: unknown;
          amount?: unknown;
        };
        if (
          typeof body.resource !== "string" ||
          !body.resource.trim() ||
          (body.amount !== undefined &&
            (!Number.isInteger(body.amount) || Number(body.amount) < 1))
        )
          throw new HttpError(
            400,
            'Envie { "resource": "<id>", "amount": 1 }.',
          );
        let text: string;
        try {
          text = withDb(slug, (db) =>
            transaction(db, () =>
              useResource(
                db,
                requirePc(db).id,
                body.resource as string,
                body.amount as number | undefined,
              ),
            ),
          );
        } catch (error) {
          const message = (error as Error).message;
          throw new HttpError(
            /Role os dados|não pode usar/.test(message)
              ? 409
              : /não existe/.test(message)
                ? 404
                : 400,
            message,
          );
        }
        if (chatView(slug, 1).messages.length) {
          await sendToMaster(
            slug,
            `Ação do jogador na mesa: ${text} Narre a reação da cena (o motor já consumiu o recurso e aplicou cura quando cabível).`,
            "sistema",
          ).catch((error) => {
            console.error(
              `[mesa] não avisei o Mestre do recurso: ${(error as Error).message}`,
            );
          });
        }
        return send(res, 200, { text });
      }
      if (req.method === "POST" && url.pathname === "/api/messages") {
        const slug = slugOf(url);
        withDb(slug, () => undefined);
        const body = (await readBody(req)) as { text?: unknown };
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text || text.length > 4000)
          throw new HttpError(
            400,
            "Mensagem vazia ou longa demais (máx. 4000).",
          );
        // A rolagem pedida pelo Mestre não pode ficar para depois.
        const pending = withDb(slug, (db) => pendingRequests(db));
        if (pending.length)
          throw new HttpError(
            409,
            `Role os dados primeiro: ${pending.map((r) => `#${r.id} ${r.label}`).join(", ")}.`,
          );
        try {
          const { mensagem_id } = await sendToMaster(slug, text, "jogador");
          return send(res, 202, { id: mensagem_id });
        } catch (error) {
          throw new HttpError(503, (error as Error).message);
        }
      }
      if (req.method === "POST" && url.pathname === "/api/intents") {
        const slug = slugOf(url);
        const body = (await readBody(req)) as { text?: unknown };
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text || text.length > 2000)
          throw new HttpError(
            400,
            "Intenção vazia ou longa demais (máx. 2000).",
          );
        const id = withDb(slug, (db) =>
          transaction(db, () =>
            Number(
              db
                .prepare("INSERT INTO intents(text, created_at) VALUES(?, ?)")
                .run(text, new Date().toISOString()).lastInsertRowid,
            ),
          ),
        );
        return send(res, 200, { id });
      }
      throw new HttpError(404, "Rota inexistente.");
    } catch (error) {
      const status =
        error instanceof HttpError
          ? error.status
          : /campanha|Campanha/.test((error as Error).message)
            ? 404
            : 500;
      if (!res.headersSent)
        send(res, status, { error: (error as Error).message });
      else res.end();
    }
  });

  server.listen(opts.port, opts.host);
  return server;
}
