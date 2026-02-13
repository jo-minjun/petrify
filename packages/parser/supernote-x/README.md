# @petrify/parser-supernote-x

Supernote X-series `.note` file parser — ParserPort implementation.

Supports: A5X, A6X, A6X2 (Nomad), A5X2 (Manta)

## Acknowledgments

The Supernote X-series binary format parsing logic in this package was developed
by referencing the following open-source implementations:

- **[SupernoteSharp](https://github.com/nelinory/SupernoteSharp)** by nelinory
  — MIT License (RLE decoding, layer compositing, color palette mapping)
- **[supernote-tool](https://github.com/jya-dev/supernote-tool)** by jya-dev
  — Apache License 2.0 (binary format structure, Flate decompression)

This is an independent TypeScript implementation, not a direct port.
