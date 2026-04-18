# 🎵 Acervo UQT

Um arquivo digital em homenagem ao falecido blog **Um Que Tenha** com uma coleção curada de **100 anos de Música Popular Brasileira**. **1.658 horas** de MPB, samba, bossa nova e muito mais — totalmente grátis e organizado para explorar.

## 📊 Números

### Catálogo publicado
- **2.303 álbuns** indexados
- **28.742 faixas** indexadas
- **816 artistas**
- **~100 anos** de MPB (1902–2012)
- **Período**: Samba, choro, bossa nova, MPB clássica e contemporânea
- **1.658 horas** de música

## ✨ Características

### 🎨 Interface Spotify-Style Grid
- **Grid de álbuns central**: Grade responsiva de capas com rolagem virtual — apenas ~30 cards no DOM independente do tamanho da biblioteca
- **Painel de faixas lateral**: Clique em um álbum para exibir capa grande, info e lista de faixas
- **Capas lazy-loaded**: 2.087 capas em `capa-min.jpg` (200px, ~10KB) carregadas sob demanda — sem impacto no carregamento inicial
- **Player compacto**: Barra sticky no rodapé com controles de play/pausa/próxima, progresso e stats da biblioteca

### 🔍 Busca e Filtros Inteligentes
- **Busca em tempo real**: Filtre por nome do artista, álbum ou qualquer metadado — com debounce de 150ms
- **Botão de limpar** (✕): Aparece no campo de busca ao digitar; limpa e reposiciona o foco
- **Contagem de resultados**: Exibe quantos álbuns correspondem ao filtro ativo
- **Filtro por década**: Botões compactos (Todos | 1900 | 1910 | 1920 ... 2010) — clique para explorar épocas específicas
- **Filtros combinados**: Use busca + década juntos para encontrar exatamente o que procura
- **Metadados precisos**: Carregados de `js/uqt-albums.json.gz` (693 KB, assíncrono) com contagem exata de artistas e álbuns

### 📱 Totalmente Responsivo
- **Desktop**: Layout lado-a-lado (grid de álbuns + painel de faixas lateral com auto-scroll para a faixa tocando)
- **Mobile**: Grid de álbuns em tela cheia; painel de faixas como drawer deslizante no player (botão ☰); header compacto com stats visíveis

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

## 🛠️ Como Funciona

### Arquitetura
- **Frontend**: HTML5 + CSS3 + JavaScript vanilla, servido pelo GitHub Pages
- **Dados**: `js/uqt-albums.json.gz` — catálogo gzipado (4.8 MB → 693 KB), carregado assincronamente e descomprimido via `DecompressionStream` nativa do browser
- **Rolagem virtual**: `VirtualGrid` em `js/uqt.js` renderiza apenas os cards visíveis (~30 nós) com posicionamento absoluto; ResizeObserver recalcula colunas ao redimensionar
- **Capas e áudio**: Servidos pelo proxy em `https://uqt.ミ.xyz/uqt/…`; placeholder SVG inline quando não há capa
- **Proxy**: Node.js com o SDK S3 — acessa o bucket privado na Hetzner usando credenciais; o bucket nunca é exposto diretamente ao cliente
- **Deployment do proxy**: Haloy + Docker, SSL automático via Let's Encrypt, health check em `/health`
- **Scripts**: `script/` — `generate-albums.js`, `sync-to-bucket.js`, `resize-cover-images.js`, `deploy.sh`
- **Fonts**: Playfair Display (títulos) + Inter (corpo)

### Fluxo de uma requisição
1. Browser carrega `index.html` do GitHub Pages (sem bloqueio — `uqt-albums.js` não é mais um script tag)
2. `uqt.js` faz `fetch('js/uqt-albums.json.gz')`, descomprime com pako e renderiza o grid
3. Ao clicar em um álbum, constrói a URL `https://uqt.ミ.xyz/uqt/{path}/{file}`
4. Proxy recebe a requisição e faz `GetObject` assinado no bucket `sambaraiz/uqt/{path}/{file}`
5. Responde com `Content-Type` correto, CORS e suporte a `Range` (streaming de MP3)

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
- **Gzip assíncrono**: `js/uqt-albums.json.gz` (693 KB) carregado via `fetch` + `DecompressionStream` nativa — elimina 4.8 MB de JS bloqueante no parse inicial
- **Virtual scrolling**: `VirtualGrid` renderiza ~30 cards em posicionamento absoluto; scroll event passivo + ResizeObserver — DOM nunca passa de ~100 nós
- **Event delegation**: 3 listeners delegados substituem 2.164+ listeners individuais por álbum
- **Track list diffing**: `renderTrackList()` detecta se o álbum já está renderizado — ao trocar faixa no mesmo álbum, só atualiza `.playing` sem reconstruir o DOM (React-style reconciliation)

### Streaming e Deployment
- **Proxy**: Node.js + S3 SDK em `https://uqt.ミ.xyz/uqt` — bucket privado, GetObject assinado, `Range` suportado para seek/streaming
- **Capas**: `capa-min.jpg` (200px wide, 80% quality) — 159 MB → 21.8 MB vs originais; geradas por `script/resize-cover-images.js` com upload direto via AWS SDK
- **Lazy loading**: `loading="lazy"` em todas as capas — zero impacto no carregamento inicial
- **Deployment**: Haloy + Docker, rolling updates sem downtime
- **SSL/TLS**: Let's Encrypt automático (Haloy)
- **Health check**: `/health` retorna `{status, timestamp}`
- **Zero egress**: proxy e bucket ambos na zona HEL1 da Hetzner

Ver [Setup do Proxy](PROXY_SETUP.md)

## 🤝 Contribuições

Este é um projeto de arquivo/homenagem. Para sugerir melhorias:
1. Abra uma [issue](https://github.com/rafapolo/uqt/issues)
2. Ou submeta um [pull request](https://github.com/rafapolo/uqt/pulls)

## 📝 Licença

Respeite os direitos dos artistas e da coleção UQT original. Use este arquivo apenas para fins educacionais e de preservação cultural.

---

**Feito com ❤️ para preservar 100 anos de MPB**

[Visite o acervo →](https://rafapolo.github.io/uqt/)
