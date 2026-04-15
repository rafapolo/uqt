# 🎵 Acervo UQT

Um arquivo digital em homenagem ao **UQT** com uma coleção curada de **100 anos de Música Popular Brasileira**. **705 horas** de MPB, samba, bossa nova e muito mais — totalmente grátis e organizado para explorar.

## ✨ Características

### 🎨 Interface Spotify-Style
- **Navegação por álbum**: Capa grande (200px) com detalhes do artista, ano e total de faixas
- **Lista visual**: 992 álbuns com capas em miniatura (48px), organizados por ano (mais recentes primeiro)
- **Player compacto**: Barra sticky no rodapé com controles de play/pausa/próxima, progresso e tempo

### 🔍 Busca e Filtros Inteligentes
- **Busca em tempo real**: Filtre por nome do artista, álbum ou qualquer metadado
- **Filtro por década**: Botões gerados automaticamente (1920s → 2020s) — clique para explorar épocas específicas
- **Filtros combinados**: Use busca + década juntos para encontrar exatamente o que procura

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
- **Dados**: 992 álbuns dinamicamente agrupados a partir de faixas de áudio
- **Capas**: Derivadas do arquivo `cover.jpg` em cada pasta de álbum
- **Fallback**: Ícone de música em SVG para capas ausentes
- **Fonts**: Playfair Display (títulos) + Inter (corpo — tipografia refinada)

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

### Streaming
Atualmente as faixas são servidas via `https://subzku.net/uqt`. Para ambientes com múltiplos usuários, há um plano de otimização usando Nginx reverse proxy em instância Hetzner (veja `tasks/nginx-reverse-proxy.md`).

### Frontend
- Zero dependências pesadas (apenas Umbrella JS, 2.6KB)
- CSS otimizado: Flexbox + Grid, sem frameworks
- Renderização eficiente de 992 álbuns com scroll nativo
- Fontes otimizadas via Google Fonts

## 📊 Números

- **992 álbuns** únicos
- **~7.000+ faixas** de áudio
- **705 horas** de música (contínua)
- **Período**: Mais de 100 anos de MPB
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
