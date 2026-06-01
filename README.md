# Acervo UQT

Um arquivo digital em homenagem ao falecido blog **Um Que Tenha** com uma coleção curada de **100 anos de Música Popular Brasileira**. **1.658 horas** de MPB, samba, bossa nova e muito mais — totalmente grátis e organizado para explorar.

> **Este repositório é uma instância do [tocador](https://github.com/rafapolo/tocador)** — a plataforma de player de arquivo. O código do player, proxy e scripts vivem lá; aqui ficam apenas os dados e a configuração de deploy desta coleção específica.

## 📊 Catálogo

- **2.155 álbuns** indexados
- **26.808 faixas** indexadas
- **855 artistas**
- **~100 anos** de MPB (1902–2012)
- **1.658 horas** de música

## Como gerar os dados

Os arquivos de dados (`data/uqt-albums.json.gz`, `genres.json`) são gerados pelos scripts do tocador a partir dos MP3s locais:

```bash
# 1. Gerar catálogo de álbuns a partir dos MP3s locais
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz bun tocador/script/generate-albums.js

# 2. Sincronizar áudio para o bucket S3
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz bun tocador/script/sync-to-bucket.js

# 3. Redimensionar e fazer upload das capas (200px)
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz bun tocador/script/resize-cover-images.js

# 4. Classificar gêneros com ML (Essentia + TensorFlow, modelo discogs519)
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz python3 tocador/script/extract-genres.py --model discogs519 --workers 6
```

## Arquitetura

- **Player**: código em [`tocador/`](https://github.com/rafapolo/tocador), servido pelo GitHub Pages
- **Dados**: `data/uqt-albums.json.gz` — catálogo gzipado (~700 KB), carregado assincronamente
- **Gêneros**: `genres.json` — classificação por faixa via ML (MAEST + discogs519, 519 gêneros)
- **Capas e áudio**: servidos pelo proxy em `https://uqt.xn--2dk.xyz/uqt/…`
- **Proxy**: Bun + `Bun.S3Client` nativo — acessa o armazenamento privado
- **Deployment**: Haloy + Docker (`haloy.yaml`), SSL automático, health check em `/health`

## Deploy

```bash
haloy deploy
```

Requer `HALOY_API_TOKEN`. Faz deploy do proxy em `uqt.xn--2dk.xyz`.

## 📝 Licença e direitos

Este acervo é mantido exclusivamente para fins educacionais e de preservação cultural. Os direitos sobre as gravações pertencem aos seus respectivos artistas e detentores. Nenhum conteúdo é disponibilizado para fins comerciais.

Se você é titular de direitos e deseja que algum conteúdo seja removido, abra uma [issue](https://github.com/rafapolo/uqt/issues).

---

**Feito com ❤️ para preservar 100 anos de MPB**

[Visite o acervo →](https://rafapolo.github.io/uqt/)
