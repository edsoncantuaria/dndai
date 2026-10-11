import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api/client.dart';
import 'api/token_store.dart';
import 'api/models.dart';
import 'theme.dart';
import 'ui/game_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Na web o Flutter desenha num canvas: liga a árvore de acessibilidade para leitores de tela.
  if (kIsWeb) SemanticsBinding.instance.ensureSemantics();
  runApp(const DndaiApp());
}

class DndaiApp extends StatelessWidget {
  const DndaiApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Crônicas',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: const Root(),
      );
}

/// Fluxo: servidor → campanha → jogo. Tudo lembrado no aparelho.
class Root extends StatefulWidget {
  const Root({super.key});
  @override
  State<Root> createState() => _RootState();
}

class _RootState extends State<Root> {
  SharedPreferences? _prefs;
  ApiClient? _api;
  String? _campaign;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    // Na web servida pelo motor, a própria origem é o servidor; ?campaign=&token= na URL têm prioridade.
    final q = kIsWeb ? Uri.base.queryParameters : const <String, String>{};
    final defaultUrl = kIsWeb ? Uri.base.origin : '';
    final url = prefs.getString('server') ?? defaultUrl;
    final token = q['token'] ?? await readToken(prefs);
    setState(() {
      _prefs = prefs;
      if (url.isNotEmpty) _api = ApiClient(baseUrl: url, token: token);
      _campaign = q['campaign'] ?? prefs.getString('campaign');
    });
  }

  Future<void> _connect(String url, String token) async {
    await _prefs!.setString('server', url);
    await writeToken(_prefs!, token);
    setState(() => _api = ApiClient(baseUrl: url, token: token.isEmpty ? null : token));
  }

  Future<void> _choose(String slug) async {
    await _prefs!.setString('campaign', slug);
    setState(() => _campaign = slug);
  }

  @override
  Widget build(BuildContext context) {
    if (_prefs == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_api == null) return ConnectScreen(onConnect: _connect, initialUrl: _prefs!.getString('server') ?? '');
    if (_campaign == null) {
      return CampaignScreen(
        api: _api!,
        onChoose: _choose,
        onChangeServer: () => setState(() => _api = null),
      );
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

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key, required this.onConnect, required this.initialUrl});
  final Future<void> Function(String url, String token) onConnect;
  final String initialUrl;
  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  late final _url = TextEditingController(text: widget.initialUrl.isEmpty ? 'https://' : widget.initialUrl);
  final _token = TextEditingController();

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: ListView(
                padding: const EdgeInsets.all(24),
                shrinkWrap: true,
                children: [
                  Text('Crônicas', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 40)),
                  const Text('Conecte-se à mesa do seu Mestre.', textAlign: TextAlign.center, style: TextStyle(color: Palette.textDim)),
                  const SizedBox(height: 28),
                  TextField(controller: _url, keyboardType: TextInputType.url, autocorrect: false, decoration: const InputDecoration(labelText: 'Endereço do servidor')),
                  const SizedBox(height: 12),
                  TextField(controller: _token, obscureText: true, autocorrect: false, decoration: const InputDecoration(labelText: 'Token (se o servidor exigir)')),
                  const SizedBox(height: 20),
                  FilledButton(onPressed: () => widget.onConnect(_url.text.trim(), _token.text.trim()), child: const Text('Conectar')),
                ],
              ),
            ),
          ),
        ),
      );
}

class CampaignScreen extends StatefulWidget {
  const CampaignScreen({super.key, required this.api, required this.onChoose, required this.onChangeServer});
  final ApiClient api;
  final ValueChanged<String> onChoose;
  final VoidCallback onChangeServer;
  @override
  State<CampaignScreen> createState() => _CampaignScreenState();
}

class _CampaignScreenState extends State<CampaignScreen> {
  late Future<List<Campaign>> _future = widget.api.campaigns();

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Escolha a crônica'),
          actions: [IconButton(tooltip: 'Trocar servidor', onPressed: widget.onChangeServer, icon: const Icon(Icons.dns_outlined))],
        ),
        body: FutureBuilder<List<Campaign>>(
          future: _future,
          builder: (context, snap) {
            if (snap.hasError) {
              return Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Padding(padding: const EdgeInsets.all(24), child: Text('${snap.error}', textAlign: TextAlign.center, style: const TextStyle(color: Palette.failure))),
                  FilledButton(onPressed: () => setState(() => _future = widget.api.campaigns()), child: const Text('Tentar de novo')),
                ]),
              );
            }
            if (!snap.hasData) return const Center(child: CircularProgressIndicator());
            final list = snap.data!;
            if (list.isEmpty) {
              return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Nenhuma crônica ainda. Peça ao Mestre para criar uma.', textAlign: TextAlign.center)));
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (_, i) => Card(
                child: ListTile(
                  minVerticalPadding: 16,
                  leading: const Icon(Icons.auto_stories, color: Palette.gold),
                  title: Text(list[i].name, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(list[i].slug, style: const TextStyle(color: Palette.textDim)),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => widget.onChoose(list[i].slug),
                ),
              ),
            );
          },
        ),
      );
}
