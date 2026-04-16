# 🎵 Acervo UQT

Um arquivo digital em homenagem ao **UQT** com uma coleção curada de **100 anos de Música Popular Brasileira**. **705 horas** de MPB, samba, bossa nova e muito mais — totalmente grátis e organizado para explorar.

## ✨ Características

### 🎨 Interface Spotify-Style Grid
- **Grid de álbuns central**: Grade responsiva de capas de álbuns como foco principal
- **Painel de faixas lateral**: Clique em um álbum para exibir capa grande (160px), info e lista de faixas
- **Auto-seleção**: Primeiro álbum selecionado automaticamente ao carregar
- **Player compacto**: Barra sticky no rodapé com controles de play/pausa/próxima, progresso e stats da biblioteca

### 🔍 Busca e Filtros Inteligentes
- **Busca em tempo real**: Filtre por nome do artista, álbum ou qualquer metadado
- **Filtro por década**: Botões compactos (Todos | 1900 | 1910 | 1920 ... 2010) — clique para explorar épocas específicas
- **Filtros combinados**: Use busca + década juntos para encontrar exatamente o que procura
- **Metadados precisos**: Carregados do arquivo `uqt-artists.json` com contagem exata de artistas e álbuns

### 📱 Totalmente Responsivo
- **Desktop**: Layout lado-a-lado (painel de álbuns + faixas)
- **Tablet**: Divisão 50/50, redimensiona fluidamente
- **Mobile**: Painéis empilhados com player sempre visível no rodapé

### 🎼 Funcionalidades de Áudio
- **Auto-play da próxima**: Continua automaticamente para a próxima faixa ao final
- **Controle de progresso**: Clique na barra para pular para qualquer ponto
- **Barra de progresso visual**: Acompanhe o tempo em tempo real

## 🚀 Acesso Online

**Ao vivo em**: [rafapolo.github.io/uqt](https://rafapolo.github.io/uqt/)

Nenhuma instalação necessária — acesse direto no navegador, em qualquer dispositivo.

## 🛠️ Como Funciona

### Arquitetura
- **Frontend**: HTML5 + CSS3 moderno (Flexbox/Grid) + JavaScript vanilla
- **Dados**: Metadados estruturados em `uqt-artists.json` com artistas, álbuns, faixas e anos
- **Capas**: Servidas via proxy reverso; fallback para `/capa.jpg` (padrão) → SVG placeholder
- **Fonts**: Playfair Display (títulos) + Inter (corpo — tipografia refinada)
- **Streaming**: Proxy em `http://89.167.95.136:9001/uqt` (Hetzner HEL1, zero egress na zona)
- **Deployment**: Haloy com Docker, SSL automático via Let's Encrypt, health checks e zero-downtime deployments

### Workflow Original
1. Arquivos baixados de https://drive.google.com/drive/folders/117Bq9JjqMToU6vMLYaDUHj_AkWg3_zz1
2. Descompactação de todos os arquivos `.zip`
3. Geração de banco de dados JSON lendo tags MP3 com [ruby-mp3info](https://github.com/moumar/ruby-mp3info)
4. Interface intuitiva construída com [Umbrella JS](https://umbrellajs.com/) (dependência leve)

## 💡 Dicas de Uso

### Exploração Rápida
1. Use os **botões de década** para navegar por época
2. **Clique em qualquer álbum** para ver todas as faixas
3. Clique em uma faixa para **começar a tocar**

### Busca Avançada
- Digite nome de artista (ex: "Tom Jobim")
- Digite parte de um álbum (ex: "Garota")
- Combine com filtro de década (ex: "1960s" + busca por "Bossa")

### Controls do Player
- ⏮ **Anterior**: Pula para a faixa anterior do álbum
- ▶ **Play/Pausa**: Inicia ou pausa o áudio
- ⏭ **Próxima**: Pula para a próxima faixa
- **Barra de progresso**: Clique em qualquer ponto para avançar/retroceder

## 🎯 Otimizações de Performance

### Streaming e Deployment
- **Proxy reverso**: Node.js proxy em `http://89.167.95.136:9001/uqt` → Hetzner bucket (HEL1)
- **Deployment**: Haloy + Docker com zero-downtime rolling updates
- **SSL/TLS**: Automático via Let's Encrypt para xn--2dk.xyz
- **Health checks**: Monitoramento contínuo em `/uqt/health`
- **Zero egress**: Transferência grátis entre instância e bucket (mesma zona)
- **Fallback de capas**: Local `/capa.jpg` (padrão) → SVG se indisponível
- **Deploy local**: `haloy deploy` a partir da máquina local

### Frontend
- Zero dependências pesadas (apenas Umbrella JS, 2.6KB)
- CSS otimizado: Flexbox + Grid, sem frameworks
- Renderização eficiente de 992 álbuns com scroll nativo
- Fontes otimizadas via Google Fonts

## 📊 Números

### Coleção Completa (Local)
- **1.997+ álbuns** únicos
- **1.196+ artistas** brasileiros
- **100+ anos** de história (1902–2011)
- **~13.000+ faixas** de áudio
- **705 horas** de música (contínua)
- **137GB** total
- **Período**: Samba, bossa nova, MPB clássica e contemporânea

### Em Streaming (Hetzner Bucket)
- **941 arquivos** sincronizados (874 MP3 + 33 capas)
- **~3% do total** — sync em progresso
- **Interface completa**: Todos os 992 álbuns disponíveis, files carregam conforme sync
- **Peso da página**: ~200KB (HTML + CSS + JS otimizados)

## 🤝 Contribuições

Este é um projeto de arquivo/homenagem. Para sugerir melhorias:
1. Abra uma [issue](https://github.com/rafapolo/uqt/issues)
2. Ou submeta um [pull request](https://github.com/rafapolo/uqt/pulls)

## 📝 Licença

Respeite os direitos dos artistas e da coleção UQT original. Use este arquivo apenas para fins educacionais e de preservação cultural.

---

**Feito com ❤️ para preservar 100 anos de MPB**

[Visite o acervo →](https://rafapolo.github.io/uqt/)
