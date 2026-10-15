import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api/client.dart';
import 'api/token_store.dart';
import 'api/models.dart';
import 'theme.dart';
import 'ui/character_creation_screen.dart';
import 'ui/game_screen.dart';
import 'ui/play_settings.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  if (kIsWeb) SemanticsBinding.instance.ensureSemantics();
  runApp(const DndaiApp());
}

class DndaiApp extends StatefulWidget {
  const DndaiApp({super.key});
  @override
  State<DndaiApp> createState() => _DndaiAppState();
}

class _DndaiAppState extends State<DndaiApp> {
  final _settings = PlaySettings();

  @override
  void initState() {
    super.initState();
    _settings.load();
  }

  @override
  Widget build(BuildContext context) => PlaySettingsScope(
    notifier: _settings,
    child: MaterialApp(
      title: 'Crônicas',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      builder: (context, child) => ListenableBuilder(
        listenable: _settings,
        builder: (context, _) {
          final mq = MediaQuery.of(context);
          final base = mq.textScaler.scale(100) / 100;
          final factor = (_settings.largeText ? base * 1.3 : base).clamp(
            0.8,
            2.4,
          );
          return MediaQuery(
            data: mq.copyWith(textScaler: TextScaler.linear(factor)),
            child: child ?? const SizedBox.shrink(),
          );
        },
      ),
      home: const Root(),
    ),
  );
}

/// Fluxo: Login com conta -> Escolha/Criação de Campanha & Personagem -> Mesa de Jogo.
class Root extends StatefulWidget {
  const Root({super.key});
  @override
  State<Root> createState() => _RootState();
}

class _RootState extends State<Root> {
  static const _mobileServer = 'http://100.91.215.59:8790';
  SharedPreferences? _prefs;
  ApiClient? _api;
  String? _campaign;
  String _serverUrl = _mobileServer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _api?.close();
    super.dispose();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final q = kIsWeb ? Uri.base.queryParameters : const <String, String>{};
    // Na web servida pelo motor, API e app compartilham a mesma origem. No
    // celular, a mesa oficial já é conhecida pelo app: o jogador só faz login.
    final defaultUrl = kIsWeb && Uri.base.hasScheme && Uri.base.origin != 'null'
        ? Uri.base.origin
        : _mobileServer;
    final url = defaultUrl;
    final token = q['token'] ?? await readToken(prefs);

    setState(() {
      _prefs = prefs;
      _serverUrl = url;
      if (token != null && token.isNotEmpty) {
        _api = ApiClient(baseUrl: url, token: token);
      }
      _campaign = q['campaign'] ?? prefs.getString('campaign');
    });
  }

  Future<void> _handleLogin(String email, String password) async {
    final client = ApiClient(baseUrl: _serverUrl);
    final res = await client.login(email, password);
    final token = res['token'] as String? ?? 'auth-ok';

    await writeToken(_prefs!, token);

    setState(() {
      _serverUrl = client.baseUrl;
      _api = ApiClient(baseUrl: client.baseUrl, token: token);
    });
  }

  Future<void> _logout() async {
    _api?.close();
    await writeToken(_prefs!, '');
    await _prefs!.remove('campaign');
    setState(() {
      _api = null;
      _campaign = null;
    });
  }

  Future<void> _choose(String slug) async {
    await _prefs!.setString('campaign', slug);
    setState(() => _campaign = slug);
  }

  @override
  Widget build(BuildContext context) {
    if (_prefs == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_api == null) {
      return LoginScreen(onLogin: _handleLogin);
    }

    if (_campaign == null) {
      return CampaignScreen(api: _api!, onChoose: _choose, onLogout: _logout);
    }

    return GameScreen(
      key: ValueKey('${_api!.baseUrl}/$_campaign'),
      api: _api!,
      campaign: _campaign!,
      onLeave: () async {
        await _prefs!.remove('campaign');
        setState(() => _campaign = null);
      },
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onLogin});
  final Future<void> Function(String email, String password) onLogin;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_email.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Informe seu login e senha ou token.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.onLogin(_email.text.trim(), _password.text);
    } catch (e) {
      setState(() => _error = 'Falha ao autenticar: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF2A1C14), Palette.leather],
        ),
      ),
      child: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              shrinkWrap: true,
              children: [
                const Icon(
                  Icons.shield_outlined,
                  size: 56,
                  color: Palette.gold,
                ),
                const SizedBox(height: 12),
                Text(
                  'Crônicas D&D',
                  textAlign: TextAlign.center,
                  style: displayStyle(size: 38),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Sua mesa inteligente com narrador e mestre.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Palette.textDim,
                    fontFamily: 'EBGaramond',
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 32),
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Palette.failure.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Palette.failure),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        color: Palette.failure,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  style: const TextStyle(
                    color: Palette.ink,
                    fontFamily: 'EBGaramond',
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Email da conta',
                    prefixIcon: Icon(Icons.email_outlined, color: Palette.gold),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _password,
                  obscureText: true,
                  autocorrect: false,
                  style: const TextStyle(
                    color: Palette.ink,
                    fontFamily: 'EBGaramond',
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Senha',
                    prefixIcon: Icon(Icons.lock_outline, color: Palette.gold),
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Entrar no Reino'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class CampaignScreen extends StatefulWidget {
  const CampaignScreen({
    super.key,
    required this.api,
    required this.onChoose,
    required this.onLogout,
  });
  final ApiClient api;
  final ValueChanged<String> onChoose;
  final VoidCallback onLogout;

  @override
  State<CampaignScreen> createState() => _CampaignScreenState();
}

class _CampaignScreenState extends State<CampaignScreen> {
  late Future<List<Campaign>> _future = widget.api.campaigns();

  void _refresh() {
    setState(() => _future = widget.api.campaigns());
  }

  Future<void> _openCreateCampaignDialog() async {
    final nameCtrl = TextEditingController();
    final premiseCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final created = await showDialog<Campaign>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(
          'Criar Nova Aventura',
          style: TextStyle(fontFamily: 'Cinzel', color: Palette.gold),
        ),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: nameCtrl,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Nome da Crônica (ex: A Mina Perdida)',
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Informe um nome' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: premiseCtrl,
                decoration: const InputDecoration(
                  labelText: 'Premissa / Enredo (opcional)',
                ),
                maxLines: 2,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              try {
                final campaign = await widget.api.createCampaign(
                  nameCtrl.text.trim(),
                  premise: premiseCtrl.text.trim(),
                );
                if (ctx.mounted) Navigator.pop(ctx, campaign);
              } catch (e) {
                if (ctx.mounted) {
                  ScaffoldMessenger.of(
                    ctx,
                  ).showSnackBar(SnackBar(content: Text('Erro ao criar: $e')));
                }
              }
            },
            child: const Text('Criar'),
          ),
        ],
      ),
    );

    if (created != null) {
      _refresh();
      await _selectCampaign(created);
    }
  }

  Future<void> _selectCampaign(Campaign camp) async {
    try {
      final state = await widget.api.state(camp.slug);
      final hasCharacter =
          state.pc != null &&
          state.pc!.name.trim().isNotEmpty &&
          state.pc!.name != '—';

      if (!hasCharacter && mounted) {
        final created = await Navigator.of(context).push<bool>(
          MaterialPageRoute(
            builder: (_) => CharacterCreationScreen(
              api: widget.api,
              campaignSlug: camp.slug,
              onCreated: () => Navigator.of(context).pop(true),
            ),
          ),
        );
        if (created != true) return;
      }
      widget.onChoose(camp.slug);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Erro ao carregar crônica: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Suas Aventuras'),
      actions: [
        IconButton(
          tooltip: 'Criar Nova Aventura',
          icon: const Icon(Icons.add, color: Palette.gold),
          onPressed: _openCreateCampaignDialog,
        ),
        IconButton(
          tooltip: 'Sair da conta',
          icon: const Icon(Icons.logout),
          onPressed: widget.onLogout,
        ),
      ],
    ),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: _openCreateCampaignDialog,
      icon: const Icon(Icons.add),
      label: const Text('Nova Aventura'),
      backgroundColor: Palette.gold,
      foregroundColor: Palette.parchment,
    ),
    body: FutureBuilder<List<Campaign>>(
      future: _future,
      builder: (context, snap) {
        if (snap.hasError) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    '${snap.error}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Palette.failure),
                  ),
                ),
                FilledButton(
                  onPressed: _refresh,
                  child: const Text('Tentar de novo'),
                ),
              ],
            ),
          );
        }
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final list = snap.data!;
        if (list.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.auto_stories, size: 64, color: Palette.gold),
                  const SizedBox(height: 16),
                  const Text(
                    'Nenhuma crônica encontrada',
                    style: TextStyle(
                      fontFamily: 'Cinzel',
                      fontSize: 20,
                      color: Palette.ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Crie sua primeira aventura para começar a jogar com o narrador!',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Palette.textDim),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: _openCreateCampaignDialog,
                    icon: const Icon(Icons.add),
                    label: const Text('Criar Primeira Aventura'),
                  ),
                ],
              ),
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
          itemCount: list.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (_, i) => Card(
            elevation: 2,
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 8,
              ),
              leading: const CircleAvatar(
                backgroundColor: Palette.leather,
                child: Icon(Icons.auto_stories, color: Palette.gold),
              ),
              title: Text(
                list[i].name,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 17,
                ),
              ),
              subtitle: Text(
                list[i].slug,
                style: const TextStyle(color: Palette.textDim, fontSize: 13),
              ),
              trailing: const Icon(Icons.chevron_right, color: Palette.gold),
              onTap: () => _selectCampaign(list[i]),
            ),
          ),
        );
      },
    ),
  );
}
