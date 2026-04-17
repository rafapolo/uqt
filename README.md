# 🎵 Acervo UQT

Um arquivo digital em homenagem ao falecido blog **Um Que Tenha** com uma coleção curada de **100 anos de Música Popular Brasileira**. **705 horas** de MPB, samba, bossa nova e muito mais — totalmente grátis e organizado para explorar.

## ✨ Características

### 🎨 Interface Spotify-Style Grid
- **Grid de álbuns central**: Grade responsiva de capas de álbuns como foco principal
- **Painel de faixas lateral**: Clique em um álbum para exibir capa grande (160px), info e lista de faixas
- **Capas lazy-loaded**: 2.087 capas em `capa-min.jpg` (200px, ~10KB) carregadas sob demanda — sem impacto no carregamento inicial
- **Player compacto**: Barra sticky no rodapé com controles de play/pausa/próxima, progresso e stats da biblioteca

### 🔍 Busca e Filtros Inteligentes
- **Busca em tempo real**: Filtre por nome do artista, álbum ou qualquer metadado
- **Filtro por década**: Botões compactos (Todos | 1900 | 1910 | 1920 ... 2010) — clique para explorar épocas específicas
- **Filtros combinados**: Use busca + década juntos para encontrar exatamente o que procura
- **Metadados precisos**: Carregados de `js/uqt-albums.js` com contagem exata de artistas e álbuns

### 📱 Totalmente Responsivo
- **Desktop**: Layout lado-a-lado (grid de álbuns + painel de faixas lateral)
- **Mobile**: Grid de álbuns em tela cheia; painel de faixas como drawer deslizante no player (botão ☰); header compacto com stats visíveis

### 🎼 Funcionalidades de Áudio
- **Seleção intencional**: Clique em um álbum para carregá-lo no player — o áudio só começa ao pressionar play
- **Auto-play da próxima**: Continua automaticamente para a próxima faixa ao final
- **Controle de progresso**: Clique na barra para pular para qualquer ponto
- **Shuffle**: Embaralha a ordem das faixas do álbum atual
- **Repeat**: Repete a faixa atual em loop (`audio.loop`)
- **Volume**: Slider de volume no player (desktop)

## 🚀 Acesso Online

**Ao vivo em**: [rafapolo.github.io/uqt](https://rafapolo.github.io/uqt/)

Nenhuma instalação necessária — acesse direto no navegador, em qualquer dispositivo.

## 🛠️ Como Funciona

### Arquitetura
- **Frontend**: HTML5 + CSS3 (Flexbox/Grid) + JavaScript vanilla, servido pelo GitHub Pages
- **Dados**: `js/uqt-albums.js` com o catálogo album-centric (título, ano, path, tracks)
- **Capas e áudio**: Servidos pelo proxy em `https://uqt.ミ.xyz/uqt/…`; placeholder SVG inline quando não há capa
- **Proxy**: Node.js com o SDK S3 — acessa o bucket privado na Hetzner usando credenciais; o bucket nunca é exposto diretamente ao cliente
- **Deployment do proxy**: Haloy + Docker, SSL automático via Let's Encrypt, health check em `/health`
- **Fonts**: Playfair Display (títulos) + Inter (corpo)

### Fluxo de uma requisição
1. Browser carrega `index.html` e `js/uqt-albums.js` do GitHub Pages
2. Ao clicar em um álbum, constrói a URL `https://uqt.ミ.xyz/uqt/{path}/{file}`
3. Proxy recebe a requisição e faz `GetObject` assinado no bucket `sambaraiz/uqt/{path}/{file}`
4. Responde com `Content-Type` correto, CORS e suporte a `Range` (streaming de MP3)


### Frontend
- Zero dependências pesadas (Umbrella JS, ~2.6KB)
- CSS com Flexbox + Grid, sem frameworks
- Placeholder de capa embutido como data-URI (nenhum round-trip extra)

## 📊 Números

### Catálogo publicado
- **2.164 álbuns** com path verificado contra o bucket
- **26.910 faixas** indexadas
- **~100 anos** de MPB (1902–2012)
- **Período**: Samba, choro, bossa nova, MPB clássica e contemporânea
- **137 GB** em S3 bucket
- **705 horas** de música
## 💡 Dicas de Uso

### Exploração Rápida
1. Use os **botões de década** para navegar por época
2. **Clique em qualquer álbum** para ver todas as faixas
3. Clique em uma faixa para **começar a tocar**

### Busca Avançada
- Digite nome de artista (ex: "Tom Jobim")
- Digite parte de um álbum (ex: "Garota")
- Combine com filtro de década (ex: "1960s" + busca por "Bossa")

## 🎯 Otimizações de Performance

### Streaming e Deployment
- **Proxy**: Node.js + S3 SDK em `https://uqt.ミ.xyz/uqt` — bucket privado, GetObject assinado, `Range` suportado para seek/streaming
- **Capas**: `capa-min.jpg` (200px wide, 80% quality) — 159MB → 21.8MB vs originais; geradas por `js/resize-cover-images.js` com upload direto via AWS SDK
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
