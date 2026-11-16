# Experimental browser compiler — third-party components

Piko's TypeScript worker, build driver, and asset preparation code are independent implementations. No Arduino Web (AGPL) application code is included.

The pinned development dependency `@horang-corp/avr-gcc-wasm@0.2.0` supplies:

- GCC 7.3.0 cc1plus and GNU binutils WebAssembly binaries and generated JS runtime: GPL-3.0-or-later; https://github.com/horang-corp/avr-gcc-wasm/tree/e3a563f765b041623734991125d5640c7e56053e
- Arduino AVR core 1.8.8 headers and non-LTO Uno objects: LGPL-2.1-or-later; https://github.com/arduino/ArduinoCore-avr/tree/1.8.8
- AVR Libc headers, startup and libraries: upstream BSD-style notices apply; https://github.com/avrdudes/avr-libc
- libgcc: GPL with GCC Runtime Library Exception; https://github.com/arduino/toolchain-avr

LiquidCrystal 1.0.7 source is vendored, unchanged, from https://github.com/arduino-libraries/LiquidCrystal/tree/1.0.7 (LGPL-2.1-or-later). Its source comments and copyright notices are retained.

## Distribution status

This is an opt-in local experiment, not the default production compiler. The WASM publisher's notice says redistribution needs corresponding source, patches and reproducible build scripts. The published package does not supply all of those. Before public deployment, obtain and archive the complete corresponding compiler sources/build materials and applicable license texts (including generated runtime provenance), and ship the Arduino/LiquidCrystal sources and notices alongside their artifacts. An upstream repository link alone is not a substitute for those materials.

See upstream notices: https://github.com/horang-corp/avr-gcc-wasm/blob/e3a563f765b041623734991125d5640c7e56053e/THIRD_PARTY_NOTICES.md
