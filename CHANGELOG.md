# Changelog

2026-05-01

- Novo parâmetro de URL `?play=1`: ao abrir um link com `?album=...&t=N&play=1` a faixa especificada inicia automaticamente; com `?album=...&play=1` (sem `t=`) a primeira faixa do álbum é tocada — links de compartilhamento agora podem ser "click-to-play"

2026-04-30 (tarde)

- `script/fetch-covers.py`: busca capas faltantes no Discogs API (primário) e iTunes Search API (fallback); redimensiona para 200px e faz upload de `capa.jpg` + `capa-min.jpg` para o S3 — 54 de 77 álbuns sem capa cobertos (23 gravações raras de 1956–1980 sem match)
- Total de álbuns com capa: 2.143 de 2.166 (era 2.089)
- Botão de década "∞" (sem data) só aparece quando há álbuns sem ano — com 0 álbuns undated, botão não é exibido
- `.decade-buttons`: `margin-top` removido em todos os breakpoints
- Capa do álbum *Noel Rosa de Oliveira e Escola de Samba* (1968) baixada do Discogs e enviada ao S3

2026-04-30

- URL agora inclui parâmetro `t=N` por faixa — links compartilháveis apontam para faixa específica (ex: `?album=...&t=5`); URL atualiza a cada troca de faixa via `replaceState`; faixa é restaurada ao abrir o link ou navegar com voltar/avançar
- `generate-albums.js`: fallback `parseFolderMeta()` extrai ano e artista do nome da pasta (`AAAA - Artista - Álbum`) quando as tags ID3 estão ausentes — evita `year: 0` e `artist: "Unknown"` no banco
- Adicionados scripts de limpeza de tags ID3: `find-untagged.js` (detecta MP3s sem tags), `fix-missing-tags.py` (corrige por nome de pasta/arquivo), `fix-tags-mbsearch.py` (MusicBrainz), `fix-tags-audd.py` (AudD), `fix-tags-acoustid.py` (AcoustID)
- 4.523 faixas com tags ausentes corrigidas (98,5% de 4.593); anos derivados de pasta, MusicBrainz e Discogs; artistas inferidos quando todos os tracks marcados como "Unknown"
- Banco regenerado: artista "Chico Buarque" gravado nas 12 faixas de `O samba de Chico Buarque`; ano 1974 aplicado a `Os Pagodeiros Dão o Recado`; anos de Candeia (1978), Nelson Cavaquinho (1973), Cartola (1974) e Império Serrano (1973) corrigidos via lookup
- Mobile: botões de década em linha única com scroll horizontal (sem quebra de linha)
- Mobile: botão shuffle fixado à esquerda e botão de faixas (☰) à direita dos controles centrais do player

2026-04-20

- Correção de codificação de caracteres nos metadados: tags ID3 em Latin-1 agora decodificadas corretamente (15 faixas corrigidas, ex: "dúvida", "jamelão", "joão nogueira")
- `generate-albums.js` lê stdout do ffprobe como buffer e tenta re-decodificar como UTF-8 antes de manter Latin-1

- Globo 3D abre em nova aba quando o player está tocando (evita corte abrupto da música)
- Player singleton entre abas: BroadcastChannel pausa outras abas ao iniciar reprodução
- Globo 3D: corrige glitch visual puxando álbuns sobrepostos levemente para o centro

2026-04-19

- Busca com parâmetro de URL (`?q=`) para links compartilháveis com filtro
- Globo 3D: botão de entrada adicionado à barra de filtros por década
- Globo 3D: botão para ligar/apagar luz; borda dourada e rótulos em pt quando acesa; raio da tocha ampliado
- Refatoração: css e capa movidos para `assets/`, `uqt_artists.json` removido
- Removidos 139 álbuns sem caminho S3 do banco de dados
- Correção: busca voltava a mostrar todos os álbuns ao limpar o filtro de década

2026-04-19 (início)

- Globo 3D: esfera de Fibonacci com 2.090 capas, geometria de caixinha de vinil, farol spotlight, sombras PCF, clique navega ao álbum
- `has_cover` gravado no JSON; requisição de capa ignorada quando falso; geração paralelizada com 16 workers
- Melhorias de UI em index.html e uqt.css
- Popstate para navegação com botão voltar/avançar via `?album=`

2026-04-18

- Catálogo expandido para 1.658 horas; grid virtual e drawer mobile aprimorados
- Durações das faixas gravadas no JSON; correção do drawer em links compartilhados
- Media Session API, shuffle entre álbuns, skeleton loading, seek por toque
- Overlay mobile de "tocando agora" com controles SVG
- Botão limpar busca, barra de progresso estilo Spotify, atalhos de teclado, modos de repetição, persistência com localStorage
- Deploy migrado para Bun; credenciais carregadas via `.env`
- `pako` substituído por `DecompressionStream` nativa; debounce na busca
- Carregamento assíncrono do JSON gzip com scroll virtual

2026-04-17

- Meta tags Open Graph e Twitter Card para links compartilhados
- Artista da faixa exibido em cinza abaixo do título em compilações
- Controles de shuffle, repetição e volume na barra do player (desktop)
- Botão play/pause com ícones SVG
- Estatísticas do acervo (álbuns, artistas, horas) em linha única responsiva
- Layout mobile repensado: cabeçalho compacto, grid em altura total, drawer deslizante
- Correção do lazy loading de capas; lista de faixas volta ao topo ao trocar álbum
- Remoção do auto-play ao selecionar álbum (apenas prime da faixa)

2026-04-16

- Modelo de dados reestruturado centrado em álbuns
- URLs compartilháveis por álbum com botão copiar link
- URL do navegador atualizada ao selecionar álbum
- Favicon SVG de disco de vinil
- Grid de álbuns redesenhado no estilo Spotify
- Deploy via Haloy com suporte a Docker (uqt.xn--2dk.xyz)
- Proxy reverso para streaming de áudio sem custo de egresso
- Correção de CORB via CORS e MIME types corretos no proxy

2026-04-15

- Redesign para layout estilo Spotify com painel lateral
- Interface responsiva moderna com controles de player customizados
- Streaming via proxy Nginx para evitar custos de egresso

2020-07-08

- Esboço inicial
