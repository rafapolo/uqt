# Acervo UQT

Um arquivo digital em homenagem ao falecido blog **Um Que Tenha** com uma coleção curada de **100 anos de Música Popular Brasileira**. MPB, samba, bossa nova e muito mais — totalmente grátis e organizado para explorar.

> **Este repositório é uma instância do [tocador](https://github.com/rafapolo/tocador)**. O código do player, proxy e scripts vivem lá; aqui ficam apenas os dados e a configuração de deploy desta coleção.

## Catálogo

- **2.155 álbuns**, **855 artistas**, **1.658 horas**
- ~100 anos de MPB (1902–2012)

## Pipeline

```bash
# 1. Gerar catálogo a partir dos MP3s locais
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz bun tocador/script/generate-albums.js

# 2. Sincronizar áudio para o bucket S3
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz bun tocador/script/sync-to-bucket.js

# 3. Redimensionar e fazer upload das capas (200px)
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz bun tocador/script/resize-cover-images.js

# 4. Classificar gêneros com ML (discogs519)
ARCHIVE_DIR=/Volumes/EXTRA/bkps/UQT/sambaderaiz python3 tocador/script/extract-genres.py --model discogs519 --workers 6
```

## Licença e direitos

Mantido para fins educacionais e de preservação cultural. Os direitos pertencem aos respectivos artistas e detentores.

Se você é titular de direitos e deseja que algum conteúdo seja removido, abra uma [issue](https://github.com/rafapolo/uqt/issues).

---

[Visite o acervo →](https://rafapolo.github.io/uqt/)
