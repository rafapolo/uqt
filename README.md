# Acervo UQT

Um arquivo digital em homenagem ao falecido blog **Um Que Tenha** com uma coleção curada de **100 anos de Música Popular Brasileira**. **1.658 horas** de MPB, samba, bossa nova e muito mais — totalmente grátis e organizado para explorar.

> **Este repositório é uma instância do [tocador](https://github.com/rafapolo/tocador)** — a plataforma de player de arquivo. O código do player, proxy e scripts vivem lá; aqui ficam apenas os dados e a configuração de deploy desta coleção específica.

## 📊 Números

### Catálogo publicado
- **2.155 álbuns** indexados
- **26.808 faixas** indexadas
- **855 artistas**
- **~100 anos** de MPB (1902–2012)
- **Período**: Samba, choro, bossa nova, MPB clássica e contemporânea
- **1.658 horas** de música

## ✨ Características

### 🎨 Interface Spotify-Style Grid
- **Grid de álbuns central**: Grade responsiva de capas com rolagem virtual — apenas ~30 cards no DOM independente do tamanho da biblioteca
- **Painel de faixas lateral**: Clique em um álbum para exibir capa grande, info e lista de faixas
- **Capas lazy-loaded**: 2.132 capas em `capa-min.jpg` (200px, ~10KB) carregadas sob demanda — sem impacto no carregamento inicial
- **Player compacto**: Barra sticky no rodapé com controles de play/pausa/próxima, progresso e stats da biblioteca

### 🔍 Busca e Filtros Inteligentes
- **Links compartilháveis por faixa**: URL inclui `?album=...&t=N` — compartilhe um álbum ou uma faixa específica; adicione `&play=1` para que o áudio inicie automaticamente ao abrir o link
- **Busca em tempo real**: Filtre por nome do artista, álbum ou qualquer metadado — com debounce de 150ms
- **Botão de limpar** (✕): Aparece no campo de busca ao digitar; limpa e reposiciona o foco
- **Contagem de resultados**: Exibe quantos álbuns correspondem ao filtro ativo
- **Filtro por década**: Botões compactos (Todos | <1940 | 1950 … 2010) — clique para explorar épocas; linha única com scroll horizontal no mobile
- **Filtros combinados**: Use busca + década juntos para encontrar exatamente o que procura
- **Metadados precisos**: Carregados de `js/uqt-albums.json.gz` (707 KB, assíncrono) com contagem exata de artistas e álbuns

### ♿ Acessibilidade
- **Navegação por teclado**: todos os elementos interativos (álbuns, faixas, links de artista/ano, controles do player) alcançáveis via Tab e ativáveis com Enter/Espaço
- **Leitor de tela**: `aria-label` em todos os botões de ícone; `aria-pressed` em shuffle e repeat; `aria-expanded` no drawer de faixas; `role="slider"` com `aria-valuenow` atualizado em tempo real na barra de progresso
- **Anúncio automático de faixa**: região `aria-live="polite"` anuncia "Reproduzindo: [faixa] — [artista]" a cada troca sem que o usuário precise navegar
- **HTML semântico**: filtro de décadas como `<nav>`, grid de álbuns com `role="list"`, campo de busca com `<label>` visualmente oculto
- **Focus-visible**: estilo de foco explícito em todos os elementos interativos — distinguível do foco por mouse

### 📱 Totalmente Responsivo
- **Desktop**: Layout lado-a-lado (grid de álbuns + painel de faixas lateral com auto-scroll para a faixa tocando)
- **Mobile**: Grid de álbuns em tela cheia; painel de faixas como drawer deslizante no player (☰ à direita); shuffle (à esquerda) e controles centrais na barra do player; header compacto com stats visíveis

### 🎼 Funcionalidades de Áudio
- **Seleção intencional**: Clique em um álbum para carregá-lo no player — o áudio só começa ao pressionar play
- **Auto-play da próxima**: Continua automaticamente para a próxima faixa ao final
- **Barra de progresso estilo Spotify**: Linha fina com ponto de posição sempre visível; cresce levemente no hover; área de toque ampla para mobile
- **Controle de progresso**: Clique (ou toque) na barra para pular para qualquer ponto
- **Shuffle**: Embaralha a ordem das faixas do álbum atual
- **Repeat**: Cicla entre três modos — sem repetição → repetir faixa → repetir álbum
- **Volume**: Slider de volume no player (desktop)
- **Persistência**: Shuffle, modo de repetição e volume são salvos no `localStorage` e restaurados ao reabrir
- **Atalhos de teclado**: `Espaço` play/pausa · `←/→` recua/avança 10s · `n` próxima · `p` anterior

## Como o acervo foi gerado

### Pipeline de dados
Os arquivos de dados neste repo (`js/uqt-albums.json.gz`, `genres.json`) foram gerados pelos scripts do tocador a partir de ~2.200 álbuns em MP3:

```bash
# 1. Gerar catálogo de álbuns a partir dos MP3s locais
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz node tocador/script/generate-albums.js

# 2. Sincronizar áudio para o bucket S3
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz node tocador/script/sync-to-bucket.js

# 3. Redimensionar e fazer upload das capas (200px)
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz node tocador/script/resize-cover-images.js

# 4. Classificar gêneros com ML (Essentia + TensorFlow, modelo discogs519)
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz python3 tocador/script/extract-genres.py --model discogs519 --workers 6
```

### Arquitetura
- **Player**: HTML5 + CSS3 + JavaScript vanilla — código em [`tocador/`](https://github.com/rafapolo/tocador), servido pelo GitHub Pages
- **Dados**: `js/uqt-albums.json.gz` — catálogo gzipado (~700 KB), carregado assincronamente e descomprimido via `DecompressionStream` nativa do browser
- **Gêneros**: `genres.json` — classificação por faixa via ML (MAEST + discogs519, 519 géneros)
- **Capas e áudio**: Servidos pelo proxy em `https://uqt.xn--2dk.xyz/uqt/…`
- **Proxy**: Node.js + S3 SDK — acessa o armazenamento privado; os arquivos nunca expostos diretamente
- **Deployment**: Haloy + Docker (`haloy.yaml`), SSL automático, health check em `/health`

### Fluxo de uma requisição
1. Browser carrega `index.html` do GitHub Pages
2. `ui.js` lê `config.json` (baseUrl + dataUrl), faz fetch do catálogo gzipado e renderiza o grid
3. Ao clicar num álbum, constrói a URL `https://uqt.xn--2dk.xyz/uqt/{path}/{file}`
4. Proxy recebe, busca o arquivo no S3 e responde com `Content-Type` correto, CORS e suporte a `Range`

### Frontend
- Dependências mínimas: Umbrella JS (~2.6 KB); descompressão gzip via `DecompressionStream` nativa (zero KB extra)
- CSS com Flexbox, sem frameworks; grid substituído por posicionamento absoluto virtual
- Placeholder de capa embutido como data-URI (nenhum round-trip extra)
- Delegação de eventos: 3 listeners no total para álbuns, faixas e drawer mobile

## 💡 Dicas de Uso

### Exploração Rápida
1. Use os **botões de década** para navegar por época
2. **Clique em qualquer álbum** para ver todas as faixas
3. Clique em uma faixa para **começar a tocar**

## 🎯 Otimizações de Performance

### Carregamento de dados
- **Gzip assíncrono**: `js/uqt-albums.json.gz` (707 KB) carregado via `fetch` + `DecompressionStream` nativa — elimina 4.8 MB de JS bloqueante no parse inicial
- **Virtual scrolling**: `VirtualGrid` renderiza ~30 cards em posicionamento absoluto; scroll event passivo + ResizeObserver — DOM nunca passa de ~100 nós
- **Event delegation**: 3 listeners delegados substituem 2.155+ listeners individuais por álbum
- **Track list diffing**: `renderTrackList()` detecta se o álbum já está renderizado — ao trocar faixa no mesmo álbum, só atualiza `.playing` sem reconstruir o DOM (React-style reconciliation)

### DOM e JavaScript
- **Refs em módulo**: 9 elementos hot-path (`btn-play`, `mobile-track-drawer`, `drawer-cover`, `overlay-cover`, `player-title`, `search-input` etc.) inicializados uma vez no `DOMContentLoaded` — `updateNowPlaying()` e `setLoading()`, chamados a cada faixa, fazem zero `getElementById`
- **Shuffle O(1) sem alocação**: o shuffle antigo fazia `albums.flatMap(a => a.tracks.map(...)).filter(...)` a cada "próxima aleatória" — criava ~2.000 objetos temporários e depois descartava tudo. Substituído por caminhada aleatória ponderada por peso de faixas: escolhe álbum em O(nAlbums), faixa em O(1), zero alocações
- **indexOf vs findIndex**: `tracks.findIndex(t => t.num === currentTrack.num)` (closure + comparação por valor) → `tracks.indexOf(currentTrack)` (comparação por identidade, sem closure)
- **CSS deduplicado**: blocos `@media (max-width: 768px)` e `(max-width: 480px)` que estavam fragmentados em múltiplos lugares no arquivo merged em bloco único; mesma coisa para `.mobile-track-drawer.open` e `.player-controls`

### Streaming e Deployment
- **Servidor de mídia**: Node.js + S3 SDK em `https://uqt.ミ.xyz/uqt` — armazenamento privado, `Range` suportado para seek/streaming
- **Capas**: `capa-min.jpg` (200px wide, 80% quality) — 159 MB → 21.8 MB vs originais; geradas por `script/resize-cover-images.js` com upload direto via AWS SDK
- **Lazy loading**: `loading="lazy"` em todas as capas — zero impacto no carregamento inicial
- **Cache-Control em camadas**: capas recebem `public, max-age=31536000, immutable` (browser nunca re-valida após o primeiro download); áudio recebe cache longo sem `immutable`; catálogo JSON tem TTL de 1h — cada tipo com a política adequada ao seu ciclo de vida
- **Deployment**: Haloy + Docker, rolling updates sem downtime
- **Docker enxuto**: `sharp`, `@aws-sdk/lib-storage` e `fast-xml-parser` são usados apenas pelos scripts de manutenção (`script/`) — movidos para `devDependencies`; a imagem de produção instala só o que o proxy precisa (`npm ci --omit=dev`), economizando ~120–150 MB por deploy
- **SSL/TLS**: Let's Encrypt automático (Haloy)
- **Health check**: `/health` retorna `{status, timestamp}`
- **Zero egress**: proxy e bucket na mesma zona de hospedagem

Ver [Setup do Proxy](PROXY_SETUP.md)

## 🤝 Contribuições

Este é um projeto de arquivo/homenagem. Para sugerir melhorias:
1. Abra uma [issue](https://github.com/rafapolo/uqt/issues)
2. Ou submeta um [pull request](https://github.com/rafapolo/uqt/pulls)

## 📝 Licença e direitos

Este acervo é mantido exclusivamente para fins educacionais e de preservação cultural. Os direitos sobre as gravações pertencem aos seus respectivos artistas e detentores. Nenhum conteúdo é disponibilizado para fins comerciais.

Se você é titular de direitos e deseja que algum conteúdo seja removido, abra uma [issue](https://github.com/rafapolo/uqt/issues).

---

**Feito com ❤️ para preservar 100 anos de MPB**

[Visite o acervo →](https://rafapolo.github.io/uqt/)
